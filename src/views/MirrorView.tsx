import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Field, Modal } from '../components/ui';
import { NetworkManager } from '../network/NetworkManager';
import { MirrorFeature, MirrorCacheEntry, MirrorMember, MirrorGroup } from '../network/types';
import { fmtTime } from '../utils';
import { logError } from '../log';

interface Props {
  open: boolean;
  peerId: string;
  displayName: string;
  feature: MirrorFeature;
  online: boolean;
  onClose: () => void;
}

interface MirrorJournalEntry {
  id: string;
  title?: string;
  body?: string;
  timestamp?: number;
  password?: string;
  pinned?: boolean;
}

export function MirrorView({ open, peerId, displayName, feature, online, onClose }: Props) {
  const { t } = useTranslation();
  const [entry, setEntry] = useState<MirrorCacheEntry | null>(null);
  const [memberCache, setMemberCache] = useState<MirrorMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [groupPath, setGroupPath] = useState<string[]>([]);
  const [openEntry, setOpenEntry] = useState<MirrorJournalEntry | null>(null);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
  const onlineRef = useRef(false);

  const request = useCallback(() => {
    if (!online) return;
    setLoading(true);
    NetworkManager.requestMirror(peerId, feature).catch(e => logError('mirror', e));
    const to = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(to);
  }, [peerId, feature, online]);

  useEffect(() => {
    if (!open) return;
    setExpanded(null);
    setGroupPath([]);
    setOpenEntry(null);
    setUnlocked({});
    NetworkManager.loadMirror(peerId, feature)
      .then(e => setEntry(e))
      .catch(e => logError('mirror', e));
    if (feature !== 'members') {
      NetworkManager.loadMirror(peerId, 'members')
        .then(e => setMemberCache(Array.isArray(e?.data) ? (e!.data as MirrorMember[]) : []))
        .catch(() => {});
    }
    const unsub = NetworkManager.onMirrorUpdated((pid, feat) => {
      if (pid !== peerId || feat !== feature) return;
      setLoading(false);
      NetworkManager.loadMirror(peerId, feature)
        .then(e => setEntry(e))
        .catch(e => logError('mirror', e));
    });
    // Ask again the moment they come online — a cached "not shared" (or an unanswered
    // request) would otherwise sit there until the view is reopened, which is exactly what
    // a freshly-granted bucket looks like from the other side.
    const unsubNet = NetworkManager.subscribe(s => {
      const isOnline = s.onlinePeers.includes(peerId);
      const was = onlineRef.current;
      onlineRef.current = isOnline;
      if (isOnline && !was) request();
    });
    request();
    return () => {
      unsub();
      unsubNet();
    };
  }, [open, peerId, feature, request]);

  const featureLabel =
    feature === 'members' ? t('tabs.members')
    : feature === 'groups' ? t('memberGroups.title')
    : t('tabs.journal');

  const dim: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' };
  const avatarFor = (id: string): string | undefined => entry?.media?.[id];

  const renderMembers = () => {
    const list: MirrorMember[] = Array.isArray(entry?.data) ? (entry!.data as MirrorMember[]) : [];
    if (list.length === 0) return <p style={dim}>{t('network.mirrorNothing')}</p>;
    return (
      <div>
        {list.map(m => {
          const isOpen = expanded === m.id;
          const av = avatarFor(m.id);
          return (
            <div key={m.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
              <button
                onClick={() => setExpanded(isOpen ? null : m.id)}
                aria-expanded={isOpen}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                {av ? (
                  <img src={av} alt="" style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <span aria-hidden style={{ width: 36, height: 36, borderRadius: 18, flexShrink: 0, background: m.color || 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontWeight: 600 }}>
                    {(m.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{m.name}</span>
                  {(m.pronouns || m.role) && (
                    <span style={{ display: 'block', ...dim }}>{[m.pronouns, m.role].filter(Boolean).join('  ·  ')}</span>
                  )}
                </span>
              </button>
              {isOpen && (
                <div style={{ paddingLeft: 46, paddingTop: 6 }}>
                  {m.description && (
                    <p style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', margin: '4px 0' }}>{m.description}</p>
                  )}
                  {(m.customFields || []).map((cf, i) => (
                    <p key={i} style={{ margin: '2px 0', fontSize: 13, color: 'var(--text)' }}>
                      <span style={dim}>{cf.name}: </span>
                      {typeof cf.value === 'boolean' ? (cf.value ? '✓' : '✕') : String(cf.value ?? '')}
                    </p>
                  ))}
                  {!m.description && (m.customFields || []).length === 0 && <p style={dim}>{t('network.mirrorNothing')}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderGroups = () => {
    const data = entry?.data as { groups?: MirrorGroup[]; membership?: Record<string, { id: string; name: string }[]> } | null;
    const groups: MirrorGroup[] = Array.isArray(data?.groups) ? data!.groups! : [];
    const membership = data?.membership || {};
    const parentId = groupPath.length > 0 ? groupPath[groupPath.length - 1] : undefined;
    const children = groups
      .filter(g => (g.parentId || undefined) === parentId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const membersHere = parentId ? membership[parentId] || [] : membership[''] || [];
    const empty = children.length === 0 && membersHere.length === 0;
    return (
      <div>
        {groupPath.length > 0 && (
          <Btn onClick={() => setGroupPath(groupPath.slice(0, -1))}>← {t('common.back')}</Btn>
        )}
        {children.map(g => (
          <button
            key={g.id}
            onClick={() => setGroupPath([...groupPath, g.id])}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', padding: '10px 0', cursor: 'pointer', textAlign: 'left' }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: g.color || 'var(--border)' }} />
            <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{g.name}</span>
            <span aria-hidden style={dim}>›</span>
          </button>
        ))}
        {membersHere.map(m => (
          <div key={m.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0', fontSize: 14, color: 'var(--text)' }}>{m.name}</div>
        ))}
        {empty && <p style={dim}>{t('network.mirrorNothing')}</p>}
      </div>
    );
  };

  const renderJournal = () => {
    const list: MirrorJournalEntry[] = Array.isArray(entry?.data) ? (entry!.data as MirrorJournalEntry[]) : [];
    if (list.length === 0) return <p style={dim}>{t('network.mirrorNothing')}</p>;
    const sorted = [...list].sort(
      (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.timestamp || 0) - (a.timestamp || 0),
    );
    return (
      <div>
        {sorted.map(e => (
          <button
            key={e.id}
            onClick={() => {
              setPwInput('');
              setPwError(false);
              setOpenEntry(e);
            }}
            style={{ display: 'block', width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', padding: '10px 0', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              {e.password && !unlocked[e.id] ? '🔒 ' : ''}{e.title || fmtTime(e.timestamp || 0)}
            </span>
            {e.timestamp ? <span style={{ display: 'block', ...dim }}>{fmtTime(e.timestamp)}</span> : null}
          </button>
        ))}
      </div>
    );
  };

  const body = () => {
    if (!entry) {
      return <p style={dim}>{online ? t('network.mirrorLoading') : t('network.mirrorEmptyOffline')}</p>;
    }
    if (entry.none) return <p style={dim}>{t('network.mirrorNothing')}</p>;
    if (feature === 'members') return renderMembers();
    if (feature === 'groups') return renderGroups();
    return renderJournal();
  };

  const locked = !!openEntry?.password && !unlocked[openEntry.id];

  return (
    <>
      <Modal
        open={open && !openEntry}
        title={`${displayName} — ${featureLabel}`}
        onClose={onClose}
        footer={<Btn onClick={() => request()} disabled={!online || loading}>{loading ? t('network.mirrorLoading') : t('network.mirrorRefresh')}</Btn>}>
        {!online && entry && <p style={{ ...dim, marginTop: 0 }}>{t('network.mirrorOffline')}</p>}
        {entry?.fetchedAt ? (
          <p style={{ ...dim, marginTop: 0 }}>{t('network.mirrorUpdated', { time: fmtTime(entry.fetchedAt) })}</p>
        ) : null}
        {body()}
      </Modal>

      <Modal
        open={!!openEntry}
        title={openEntry?.title || t('tabs.journal')}
        onClose={() => setOpenEntry(null)}>
        {locked ? (
          <>
            <p style={dim}>{t('journal.passwordPrompt', { defaultValue: 'This entry is password protected.' })}</p>
            <Field
              label={t('journal.password', { defaultValue: 'Password' })}
              value={pwInput}
              onChange={v => {
                setPwInput(v);
                setPwError(false);
              }}
              placeholder={t('journal.password', { defaultValue: 'Password' })}
              type="password"
            />
            {pwError && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{t('journal.wrongPassword', { defaultValue: 'Incorrect password.' })}</p>}
            <Btn
              onClick={() => {
                if (openEntry && pwInput === openEntry.password) {
                  setUnlocked({ ...unlocked, [openEntry.id]: true });
                  setPwError(false);
                } else {
                  setPwError(true);
                }
              }}
              disabled={!pwInput}>
              {t('common.unlock', { defaultValue: 'Unlock' })}
            </Btn>
          </>
        ) : (
          <>
            {openEntry?.timestamp ? <p style={dim}>{fmtTime(openEntry.timestamp)}</p> : null}
            <p style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{openEntry?.body || ''}</p>
          </>
        )}
      </Modal>
    </>
  );
}
