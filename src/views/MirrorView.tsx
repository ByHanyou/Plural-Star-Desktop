import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Field, Modal } from '../components/ui';
import { NetworkManager } from '../network/NetworkManager';
import { MirrorFeature, MirrorCacheEntry, MirrorMember, MirrorGroup, MirrorSystemProfile, MIRROR_SYSTEM_AVATAR_ID, MIRROR_SYSTEM_BANNER_ID } from '../network/types';
import SystemProfileCard from '../components/SystemProfileCard';
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

interface MirrorHistoryEntry {
  memberIds?: string[];
  startTime?: number;
  endTime?: number | null;
  note?: string;
  mood?: string;
  location?: string;
  energyLevel?: number;
  coFrontIds?: string[];
  coFrontMood?: string;
  coFrontNote?: string;
  coFrontEnergy?: number;
  coFrontLocation?: string;
  coConsciousIds?: string[];
  coConsciousMood?: string;
  coConsciousNote?: string;
  coConsciousEnergy?: number;
  coConsciousLocation?: string;
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
    // The system profile stands alone — it never resolves member ids, so
    // loading the roster mirror for it is a read for nothing.
    if (feature !== 'members' && feature !== 'systemProfile') {
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
    : feature === 'history' ? t('tabs.history')
    : feature === 'systemProfile' ? t('systemProfile.title')
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
                  {(m.customFields || []).map((cf, i) => {
                    if (cf.type === 'image') {
                      const img = entry?.media?.[`${m.id}#cf:${cf.fieldId || ''}`];
                      return (
                        <div key={i} style={{ margin: '2px 0' }}>
                          <span style={dim}>{cf.name}: </span>
                          {img ? (
                            <img src={img} alt={cf.name} style={{ display: 'block', maxWidth: '100%', maxHeight: 220, borderRadius: 8, marginTop: 4, objectFit: 'cover' }} />
                          ) : (
                            <span style={{ ...dim, fontStyle: 'italic' }}>{t('markdown.imageUnavailable', {defaultValue: '[image unavailable]'})}</span>
                          )}
                        </div>
                      );
                    }
                    return (
                      <p key={i} style={{ margin: '2px 0', fontSize: 13, color: 'var(--text)' }}>
                        <span style={dim}>{cf.name}: </span>
                        {typeof cf.value === 'boolean' ? (cf.value ? '✓' : '✕') : String(cf.value ?? '')}
                      </p>
                    );
                  })}
                  {/* Connections are a member subtab in the real member view, so
                      the mirror shows them the same way instead of omitting them. */}
                  {(m.connections || []).length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 4 }}>
                        {t('systemMap.connections', { defaultValue: 'Connections' })}
                      </div>
                      {(m.connections || []).map(c => (
                        <p key={c.id} style={{ margin: '2px 0', fontSize: 13, color: 'var(--text)' }}>
                          <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: c.color || 'var(--border)', marginRight: 6 }} />
                          <span style={dim}>{c.labelKey ? t(c.labelKey, { defaultValue: c.label }) : c.label}: </span>
                          {c.otherName}
                          {c.note ? <span style={{ ...dim, fontStyle: 'italic' }}>{'  ·  ' + c.note}</span> : null}
                        </p>
                      ))}
                    </div>
                  )}
                  {!m.description && (m.customFields || []).length === 0 && (m.connections || []).length === 0 && <p style={dim}>{t('network.mirrorNothing')}</p>}
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

  // Read-only mirror of the History tab: same row shape, same per-tier detail
  // lines, no editing and no delete.
  const renderHistory = () => {
    const list: MirrorHistoryEntry[] = Array.isArray(entry?.data) ? (entry!.data as MirrorHistoryEntry[]) : [];
    if (list.length === 0) return <p style={dim}>{t('network.mirrorNothing')}</p>;
    const nameOf = (id: string): string => memberCache.find(m => m.id === id)?.name || '—';
    const chips = (ids?: string[]) => (ids || []).map(id => {
      const m = memberCache.find(x => x.id === id);
      return (
        <span key={id} className="chip" style={{ borderColor: `${m?.color || 'var(--border)'}50`, background: `${m?.color || 'transparent'}20` }}>
          <span style={{ color: m?.color || 'var(--text)' }}>{nameOf(id)}</span>
        </span>
      );
    });
    const tierLine = (mood?: string, location?: string, energy?: number, note?: string) =>
      (mood || location || energy || note) ? (
        <div style={{ display: 'flex', gap: 12, marginTop: 3, marginLeft: 4, fontSize: 11, color: 'var(--dim)' }}>
          {mood && <span>😊 {mood}</span>}
          {location && <span>📍 {location}</span>}
          {energy ? <span>⚡ {energy}/10</span> : null}
          {note && <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>{note}</span>}
        </div>
      ) : null;
    const sorted = [...list].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    return (
      <div>
        {sorted.map((e, i) => (
          <div key={`${e.startTime}-${i}`} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {chips(e.memberIds)}
              <span style={{ marginLeft: 'auto', ...dim, fontVariantNumeric: 'tabular-nums' }}>
                {fmtTime(e.startTime || 0)}{e.endTime ? ` — ${fmtTime(e.endTime)}` : ''}
              </span>
            </div>
            {tierLine(e.mood, e.location, e.energyLevel, e.note)}
            {(e.coFrontIds || []).length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('tier.coFront')}:</span>
                  {chips(e.coFrontIds)}
                </div>
                {tierLine(e.coFrontMood, e.coFrontLocation, e.coFrontEnergy, e.coFrontNote)}
              </div>
            )}
            {(e.coConsciousIds || []).length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('tier.coConShort')}:</span>
                  {chips(e.coConsciousIds)}
                </div>
                {tierLine(e.coConsciousMood, e.coConsciousLocation, e.coConsciousEnergy, e.coConsciousNote)}
              </div>
            )}
          </div>
        ))}
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
    if (feature === 'systemProfile') {
      const sp = (entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data)
        ? entry.data
        : {}) as MirrorSystemProfile;
      return (
        <SystemProfileCard
          name={sp.name || displayName}
          description={sp.description}
          avatar={avatarFor(MIRROR_SYSTEM_AVATAR_ID)}
          banner={avatarFor(MIRROR_SYSTEM_BANNER_ID)}
        />
      );
    }
    if (feature === 'members') return renderMembers();
    if (feature === 'groups') return renderGroups();
    if (feature === 'history') return renderHistory();
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
