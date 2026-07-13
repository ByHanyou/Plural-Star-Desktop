import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Field, Toggle, Section, Modal, ConfirmDialog } from '../components/ui';
import { useNetwork } from '../network/useNetwork';
import { NetworkManager } from '../network/NetworkManager';
import { Friend, PrivacyBucket, PrivacyScope, PrivacyScopeMode, PRIVACY_BUCKETS_KEY, MirrorFeature } from '../network/types';
import { MirrorView } from './MirrorView';
import { fmtDur, fmtTime, uid, CustomFieldDef, Relationship, RelationshipTypeDef, PRESET_RELATIONSHIP_TYPES } from '../utils';
import { store, KEYS } from '../storage';
import { logError } from '../log';
import { useAppStore } from '../store/appStore';

type Kind = 'friend' | 'device';
type BucketFeature = 'members' | 'groups' | 'journal' | 'history' | 'customFields' | 'medical' | 'connections';

const emptyScope = (): PrivacyScope => ({ mode: 'none', ids: [] });
const newBucket = (): PrivacyBucket => ({
  id: uid(),
  name: '',
  members: emptyScope(),
  groups: emptyScope(),
  journal: emptyScope(),
  history: emptyScope(),
  customFields: emptyScope(),
  medical: emptyScope(),
  connections: emptyScope(),
  friendPeerIds: [],
  createdAt: Date.now(),
});

const normalizeBucket = (b: PrivacyBucket): PrivacyBucket => ({
  ...b,
  members: b.members || emptyScope(),
  groups: b.groups || emptyScope(),
  journal: b.journal || emptyScope(),
  history: b.history || emptyScope(),
  customFields: b.customFields || emptyScope(),
  medical: b.medical || emptyScope(),
  connections: b.connections || emptyScope(),
  friendPeerIds: b.friendPeerIds || [],
});

export default function NetworkView() {
  const { t } = useTranslation();
  const net = useNetwork();
  const members = useAppStore(s => s.state.members);
  const groups = useAppStore(s => s.state.groups);
  const journal = useAppStore(s => s.state.journal);

  const [theirFriend, setTheirFriend] = useState('');
  const [theirDevice, setTheirDevice] = useState('');
  const [relayUrl, setRelayUrl] = useState('');
  const [relayToken, setRelayToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [buckets, setBuckets] = useState<PrivacyBucket[]>([]);
  const [editBucket, setEditBucket] = useState<PrivacyBucket | null>(null);
  const [pickerFeature, setPickerFeature] = useState<BucketFeature | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [deleteBucketTarget, setDeleteBucketTarget] = useState<PrivacyBucket | null>(null);
  const [mirrorMenuFor, setMirrorMenuFor] = useState<Friend | null>(null);
  const [mirror, setMirror] = useState<{ peerId: string; name: string; feature: MirrorFeature } | null>(null);
  const [fieldDefs, setFieldDefs] = useState<CustomFieldDef[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [relTypes, setRelTypes] = useState<RelationshipTypeDef[]>([]);

  useEffect(() => {
    store.get<PrivacyBucket[]>(PRIVACY_BUCKETS_KEY, []).then(saved => {
      if (saved && Array.isArray(saved)) setBuckets(saved.map(normalizeBucket));
    }).catch(e => logError('network', e));
    store.get<CustomFieldDef[]>(KEYS.customFieldDefs, []).then(d => setFieldDefs(d || [])).catch(e => logError('network', e));
    store.get<Relationship[]>(KEYS.relationships, []).then(r => setRelationships(r || [])).catch(e => logError('network', e));
    store.get<RelationshipTypeDef[]>(KEYS.relationshipTypes, []).then(rt => setRelTypes(rt || [])).catch(e => logError('network', e));
  }, []);

  // What this friend can ACTUALLY see: buckets are additive, so a friend sitting in two
  // buckets gets the union — a second "All" bucket silently widens a careful "Select".
  const effectiveShare = (peerId: string, f: BucketFeature): PrivacyScope => {
    const mine = buckets.filter(b => (b.friendPeerIds || []).includes(peerId));
    const ids = new Set<string>();
    let all = false;
    for (const b of mine) {
      const s = b[f];
      if (!s || s.mode === 'none') continue;
      if (s.mode === 'all') { all = true; continue; }
      (s.ids || []).forEach(id => ids.add(id));
    }
    if (all) return { mode: 'all', ids: [] };
    if (ids.size === 0) return { mode: 'none', ids: [] };
    return { mode: 'select', ids: [...ids] };
  };

  const saveBuckets = async (next: PrivacyBucket[]) => {
    setBuckets(next);
    await store.set(PRIVACY_BUCKETS_KEY, next);
    NetworkManager.notifyDataChanged();
    // Push the new scopes over any copy friends already hold — tightening a bucket has to
    // reach them, or they keep showing the wider snapshot they were sent earlier.
    NetworkManager.refreshAllMirrors();
  };

  const featureLabel = (f: BucketFeature): string =>
    f === 'members' ? t('tabs.members') : f === 'groups' ? t('memberGroups.title') : f === 'journal' ? t('tabs.journal') : f === 'history' ? t('tabs.history') : f === 'customFields' ? t('customFields.title', { defaultValue: 'Custom Fields' }) : t('systemMap.title', { defaultValue: 'Connections' });
  const scopeSummary = (s: PrivacyScope): string =>
    s.mode === 'all' ? t('network.scopeAll') : s.mode === 'none' ? t('network.scopeNone') : `${s.ids.length}`;
  const setScopeMode = (f: BucketFeature, mode: PrivacyScopeMode) => {
    if (!editBucket) return;
    setEditBucket({ ...editBucket, [f]: { ...editBucket[f], mode } });
    if (mode === 'select') { setPickerSearch(''); setPickerFeature(f); }
  };
  const togglePickId = (id: string) => {
    if (!editBucket || !pickerFeature) return;
    const sc = editBucket[pickerFeature];
    const ids = sc.ids.includes(id) ? sc.ids.filter(x => x !== id) : [...sc.ids, id];
    setEditBucket({ ...editBucket, [pickerFeature]: { ...sc, ids } });
  };
  const commitBucket = async () => {
    if (!editBucket) return;
    const name = editBucket.name.trim();
    if (!name) return;
    const exists = buckets.some(b => b.id === editBucket.id);
    const next = exists ? buckets.map(b => (b.id === editBucket.id ? { ...editBucket, name } : b)) : [...buckets, { ...editBucket, name }];
    await saveBuckets(next);
    setEditBucket(null);
  };
  const cloneBucket = (b: PrivacyBucket) => {
    setEditBucket({
      id: uid(),
      name: `${b.name} 2`,
      members: { mode: b.members.mode, ids: [...b.members.ids] },
      groups: { mode: b.groups.mode, ids: [...b.groups.ids] },
      journal: { mode: b.journal.mode, ids: [...b.journal.ids] },
      history: { mode: b.history.mode, ids: [...b.history.ids] },
      customFields: { mode: b.customFields.mode, ids: [...b.customFields.ids] },
      medical: { mode: b.medical.mode, ids: [...b.medical.ids] },
      connections: { mode: b.connections.mode, ids: [...b.connections.ids] },
      friendPeerIds: [],
      createdAt: Date.now(),
    });
  };
  const pickableMembers = members.filter(m => !m.deleted && !m.isCustomFront);
  const memberName = (id: string) => members.find(m => m.id === id)?.name || '?';
  const relLabel = (r: Relationship): string => {
    const rt = relTypes.find(x => x.id === r.typeId) || PRESET_RELATIONSHIP_TYPES.find(x => x.id === r.typeId);
    const arrow = rt?.directional ? '→' : '↔';
    return `${memberName(r.fromId)} ${arrow} ${memberName(r.toId)}${rt ? `  ·  ${rt.name}` : ''}`;
  };
  const [error, setError] = useState<string | null>(null);
  const [copiedKind, setCopiedKind] = useState<Kind | null>(null);
  const [directionFor, setDirectionFor] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Friend | null>(null);
  const [, setNowTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      const msg = String(e?.message || e).toLowerCase();
      if (msg.includes('own')) setError(t('network.ownCode'));
      else if (msg.includes('not found') || msg.includes('expired')) setError(t('network.notFound'));
      else if (msg.includes('not connected')) setError(t('network.status.error'));
      else setError(t('network.invalidCode'));
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (): string => {
    switch (net.status) {
      case 'connecting': return t('network.status.connecting');
      case 'online': return t('network.status.online');
      case 'reconnecting': return t('network.status.reconnecting');
      case 'error': return t('network.status.error');
      default: return t('network.status.disabled');
    }
  };
  const statusColor = (): string => {
    switch (net.status) {
      case 'online': return '#2faa55';
      case 'connecting':
      case 'reconnecting': return '#d6a435';
      case 'error': return '#cc4444';
      default: return 'var(--muted)';
    }
  };

  const onGenerate = (kind: Kind) => guard(async () => {
    try {
      await NetworkManager.generateCode(kind);
    } catch {
      throw new Error(t('network.publishFailed'));
    }
  });

  const onCopy = async (kind: Kind, code: string | null) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedKind(kind);
      setTimeout(() => setCopiedKind(c => (c === kind ? null : c)), 1500);
    } catch (e) { logError('network', e); }
  };

  const enterWith = (kind: Kind, value: string, clear: () => void, role?: 'source' | 'target') =>
    guard(async () => {
      if (kind === 'device') await NetworkManager.enterDeviceCode(value.trim(), role || 'source');
      else await NetworkManager.enterFriendCode(value.trim());
      clear();
    });

  const onEnter = (kind: Kind, value: string, clear: () => void) => {
    if (!value.trim()) return;
    if (kind === 'device') {
      setDirectionFor(value.trim());
      return;
    }
    enterWith(kind, value, clear);
  };

  const mmss = (expiresAt: number | null): string => {
    const ms = expiresAt ? Math.max(0, expiresAt - Date.now()) : 0;
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const friendStatusLines = (f: Friend): string[] => {
    if (f.status === 'entered_theirs') return [t('network.waitingThem')];
    if (f.status === 'entered_mine') return [t('network.waitingYou')];
    const online = net.onlinePeers.includes(f.peerId);
    const s = f.lastStatus;
    if (!s) return [online ? t('network.online') : t('network.offline')];
    const lines: string[] = [];
    const dur = s.startTime ? fmtDur(s.startTime) : '';
    const tierLines: string[] = [];
    if (s.primary) tierLines.push(t('notification.primary', { names: s.primary, defaultValue: `Primary: ${s.primary}` }));
    if (s.coFront) tierLines.push(t('notification.coFront', { names: s.coFront, defaultValue: `Co-Front: ${s.coFront}` }));
    if (s.coConscious) tierLines.push(t('notification.coConscious', { names: s.coConscious, defaultValue: `Co-Conscious: ${s.coConscious}` }));
    if (tierLines.length === 0) tierLines.push(s.fronters);
    tierLines[0] = `◈ ${tierLines[0]}${dur ? `  ·  ${dur}` : ''}`;
    lines.push(...tierLines);
    if (s.mood) lines.push(t('notification.mood', { mood: s.mood, defaultValue: `Mood: ${s.mood}` }));
    if (s.location) lines.push(t('notification.at', { location: s.location, defaultValue: `At: ${s.location}` }));
    if (s.note) lines.push(t('notification.note', { note: s.note, defaultValue: `Note: ${s.note}` }));
    if (s.startTime) lines.push(t('notification.since', { time: fmtTime(s.startTime), defaultValue: `Since ${fmtTime(s.startTime)}` }));
    if (!online) lines.push(t('network.offline'));
    return lines;
  };

  const deviceStatusText = (f: Friend): string => {
    if (f.status === 'entered_theirs') return t('network.waitingThem');
    if (f.status === 'entered_mine') return t('network.waitingYou');
    if (f.initPending) {
      return f.initRole === 'source' ? t('network.syncCloneSending') : t('network.syncCloneReceiving');
    }
    return net.onlinePeers.includes(f.peerId) ? t('network.online') : t('network.offline');
  };

  const renderRow = (f: Friend, lines: string[]) => {
    const online = f.status === 'accepted' && net.onlinePeers.includes(f.peerId);
    return (
      <div key={f.peerId} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0, background: f.status !== 'accepted' ? 'var(--muted)' : online ? '#2faa55' : 'var(--muted)' }} aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: online || f.status !== 'accepted' ? 'var(--text)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.displayName}</div>
          {lines.map((line, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{line}</div>
          ))}
        </div>
        {f.kind !== 'device' && f.status === 'accepted' && (
          <button
            className="icon-btn"
            aria-label={`${t('network.viewShared')}, ${f.displayName}`}
            onClick={() => setMirrorMenuFor(f)}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, cursor: 'pointer', padding: 8 }}>⋯</button>
        )}
        <button className="icon-btn" aria-label={`${t('network.remove')}, ${f.displayName}`} onClick={() => setRemoveTarget(f)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, cursor: 'pointer', padding: 8 }}>✕</button>
      </div>
    );
  };

  const renderPairing = (kind: Kind, code: string | null, expiresAt: number | null, theirVal: string, setTheirVal: (s: string) => void) => (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Field
            label={kind === 'device' ? t('network.deviceCode') : t('network.enterTheirCode')}
            value={theirVal}
            onChange={setTheirVal}
            placeholder={kind === 'device' ? t('network.deviceCodePlaceholder') : t('network.enterCodePlaceholder')}
            mono
          />
        </div>
        <Btn onClick={() => onEnter(kind, theirVal, () => setTheirVal(''))} disabled={busy || !theirVal.trim()}>{t('network.add')}</Btn>
      </div>
      <div style={{ marginTop: 10 }}>
        {code ? (
          <button
            onClick={() => onCopy(kind, code)}
            aria-label={`${t('network.yourCode')}: ${code}. ${t('network.tapToCopy')}`}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 8, padding: '12px 8px', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: kind === 'device' ? 16 : 19, fontWeight: 700, letterSpacing: 2, color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>{code}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {copiedKind === kind ? t('network.codeCopied') : `${t('network.tapToCopy')} · ${t('network.expiresIn', { time: mmss(expiresAt) })}`}
            </div>
          </button>
        ) : (
          <Btn onClick={() => onGenerate(kind)} disabled={busy || !net.enabled}>{t('network.generateCode')}</Btn>
        )}
      </div>
    </>
  );

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 32 }}>
      {error && (
        <div role="alert" style={{ background: 'rgba(204,68,68,0.12)', border: '1px solid #cc4444', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', marginBottom: 14 }}>
          {error}
        </div>
      )}

      <Section label={t('network.enable')} />
      <Toggle value={net.enabled} onChange={v => guard(() => NetworkManager.setEnabled(v))} label={t('network.enable')} description={t('network.enableDesc')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 20 }} role="status" aria-label={`${t('network.enable')} — ${statusLabel()}`}>
        <span style={{ width: 9, height: 9, borderRadius: 5, background: statusColor() }} aria-hidden />
        <span style={{ fontSize: 13, color: 'var(--text)' }}>{statusLabel()}</span>
      </div>

      <Section label={t('network.addFriend')} />
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>{t('network.howItWorks')}</p>
      {renderPairing('friend', net.activeFriendCode, net.activeFriendExpiresAt, theirFriend, setTheirFriend)}

      <div style={{ marginTop: 20 }}>
        <Section label={t('network.friends')} />
        {net.friends.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{t('network.noFriends')}</p>
        ) : (
          net.friends.map(f => renderRow(f, friendStatusLines(f)))
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <Section label={t('network.syncTitle')} />
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>{t('network.syncDesc')}</p>
        {renderPairing('device', net.activeDeviceCode, net.activeDeviceExpiresAt, theirDevice, setTheirDevice)}
        <div style={{ marginTop: 14 }}>
          <Section label={t('network.linkedDevices')} />
          {net.devices.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>{t('network.noDevices')}</p>
          ) : (
            net.devices.map(f => renderRow(f, [deviceStatusText(f)]))
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Section label={t('network.customNetwork')} />
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>{t('network.customNetworkDesc')}</p>
        <Field label={t('network.relayUrl')} value={relayUrl} onChange={setRelayUrl} placeholder="http://192.168.1.20:7523" mono />
        <Field label={t('network.relayToken')} value={relayToken} onChange={setRelayToken} placeholder="—" mono />
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 12px' }}>{t('network.relayHint')}</p>
        <Btn onClick={() => guard(() => NetworkManager.setRelayOverride(relayUrl.trim() || undefined, relayToken.trim() || undefined))} disabled={busy}>
          {t('network.saveRelay')}
        </Btn>
      </div>

      <div style={{ marginTop: 24 }}>
        <Section label={t('network.tabPrivacy')} />
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>{t('network.privacyDesc')}</p>
        <Btn onClick={() => setEditBucket(newBucket())}>{t('network.newBucket')}</Btn>
        <div style={{ marginTop: 12 }}>
          {buckets.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>{t('network.noBuckets')}</p>
          ) : buckets.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, background: 'var(--card)' }}>
              <div role="button" tabIndex={0} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                onClick={() => setEditBucket({ ...b })}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditBucket({ ...b }); } }}
                aria-label={`${b.name}. ${(['members', 'groups', 'journal', 'history', 'customFields', 'connections'] as BucketFeature[]).map(f => `${featureLabel(f)}: ${scopeSummary(b[f])}`).join(', ')}`}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {(['members', 'groups', 'journal', 'history', 'customFields', 'connections'] as BucketFeature[]).map(f => `${featureLabel(f)}: ${scopeSummary(b[f])}`).join('  ·  ')}
                </div>
              </div>
              <Btn variant="ghost" aria-label={`${t('network.cloneBucket')} — ${b.name}`} onClick={() => cloneBucket(b)}>⧉</Btn>
              <button className="btn btn--danger" aria-label={`${t('network.deleteBucket')} — ${b.name}`} onClick={() => setDeleteBucketTarget(b)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={!!editBucket && !pickerFeature}
        title={editBucket && buckets.some(b => b.id === editBucket.id) ? editBucket.name : t('network.newBucket')}
        onClose={() => setEditBucket(null)}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setEditBucket(null)}>{t('common.cancel')}</Btn>
            <Btn onClick={commitBucket} disabled={!editBucket?.name.trim()}>{t('common.save')}</Btn>
          </div>
        }>
        <Field label={t('network.bucketName')} value={editBucket?.name || ''} onChange={v => editBucket && setEditBucket({ ...editBucket, name: v })} placeholder={t('network.bucketName')} />
        {editBucket && (['members', 'groups', 'journal', 'history', 'customFields', 'connections'] as BucketFeature[]).map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{featureLabel(f)}</span>
            {((f === 'history' ? ['all', 'none'] : ['all', 'select', 'none']) as PrivacyScopeMode[]).map(mode => {
              const sel = editBucket[f].mode === mode;
              const label = mode === 'all' ? t('network.scopeAll') : mode === 'select' ? t('network.scopeSelect') : t('network.scopeNone');
              return (
                <button key={mode} className="chip" aria-pressed={sel} aria-label={`${featureLabel(f)}: ${label}`}
                  style={{
                    borderColor: sel ? 'var(--accent)' : 'var(--border)',
                    background: sel ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--surface)',
                    color: sel ? 'var(--accent)' : 'var(--dim)',
                  }}
                  onClick={() => setScopeMode(f, mode)}>
                  {label}
                </button>
              );
            })}
            {editBucket[f].mode === 'select' && (
              <Btn variant="ghost" aria-label={`${featureLabel(f)}: ${t('network.scopeSelect')}, ${editBucket[f].ids.length}`}
                onClick={() => { setPickerSearch(''); setPickerFeature(f); }}>
                {editBucket[f].ids.length} ✎
              </Btn>
            )}
          </div>
        ))}
      </Modal>

      <Modal
        open={!!editBucket && !!pickerFeature}
        title={`${pickerFeature ? featureLabel(pickerFeature) : ''} — ${t('network.scopeSelect')}`}
        onClose={() => setPickerFeature(null)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn onClick={() => setPickerFeature(null)}>{t('common.close')}</Btn>
          </div>
        }>
        {pickerFeature !== 'groups' && (
          <Field label={t('common.search')} value={pickerSearch} onChange={setPickerSearch} placeholder={t('common.search')} />
        )}
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {(pickerFeature === 'groups'
            ? groups.map(g => ({ id: g.id, name: g.name }))
            : pickerFeature === 'journal'
            ? journal
                .filter(e => !pickerSearch.trim() || (e.title || '').toLowerCase().includes(pickerSearch.trim().toLowerCase()))
                .map(e => ({ id: e.id, name: `${e.password ? '🔒 ' : ''}${e.title || fmtTime(e.timestamp)}` }))
            : pickerFeature === 'customFields'
            ? [...fieldDefs]
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map(d => ({ id: d.id, name: d.name }))
                .filter(x => !pickerSearch.trim() || (x.name || '').toLowerCase().includes(pickerSearch.trim().toLowerCase()))
            : pickerFeature === 'connections'
            ? relationships
                .map(r => ({ id: r.id, name: relLabel(r) }))
                .filter(x => !pickerSearch.trim() || (x.name || '').toLowerCase().includes(pickerSearch.trim().toLowerCase()))
            : pickableMembers
                .filter(m => !pickerSearch.trim() || m.name.toLowerCase().includes(pickerSearch.trim().toLowerCase()))
                .map(m => ({ id: m.id, name: m.name }))
          ).map(item => {
            const checked = !!(editBucket && pickerFeature && editBucket[pickerFeature].ids.includes(item.id));
            return (
              <div key={item.id} role="checkbox" aria-checked={checked} tabIndex={0}
                onClick={() => togglePickId(item.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePickId(item.id); } }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                <span aria-hidden style={{ width: 18, height: 18, borderRadius: 9, border: `2px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, background: checked ? 'var(--accent)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--bg)', fontWeight: 700 }}>
                  {checked ? '✓' : ''}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
              </div>
            );
          })}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteBucketTarget}
        title={t('network.deleteBucket')}
        message={t('network.deleteBucketMsg', { name: deleteBucketTarget?.name || '' })}
        danger
        onConfirm={() => { const b = deleteBucketTarget!; setDeleteBucketTarget(null); saveBuckets(buckets.filter(x => x.id !== b.id)); }}
        onCancel={() => setDeleteBucketTarget(null)}
      />

      <Modal
        open={!!directionFor}
        title={t('network.syncDirectionTitle')}
        onClose={() => setDirectionFor(null)}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => setDirectionFor(null)}>{t('common.cancel')}</Btn>
            <Btn onClick={() => { const code = directionFor!; setDirectionFor(null); enterWith('device', code, () => setTheirDevice(''), 'source'); }}>
              {t('network.syncSendMine')}
            </Btn>
            <Btn onClick={() => { const code = directionFor!; setDirectionFor(null); enterWith('device', code, () => setTheirDevice(''), 'target'); }}>
              {t('network.syncReceiveTheirs')}
            </Btn>
          </div>
        }>
        <p style={{ fontSize: 13, color: 'var(--text)' }}>{t('network.syncDirectionMsg')}</p>
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        title={t('network.remove')}
        message={removeTarget?.displayName || ''}
        danger
        onConfirm={() => { const f = removeTarget!; setRemoveTarget(null); guard(() => NetworkManager.removeFriend(f.peerId)); }}
        onCancel={() => setRemoveTarget(null)}
      />

      <Modal
        open={!!mirrorMenuFor}
        title={`${mirrorMenuFor?.displayName || ''} — ${t('network.viewShared')}`}
        onClose={() => setMirrorMenuFor(null)}>
        {mirrorMenuFor && (
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 0 }}>
            {(['members', 'groups', 'journal', 'history', 'customFields', 'connections'] as BucketFeature[])
              .map(f => `${featureLabel(f)}: ${scopeSummary(effectiveShare(mirrorMenuFor.peerId, f))}`)
              .join('  ·  ')}
          </p>
        )}
        {([
          { feature: 'members' as MirrorFeature, label: t('tabs.members') },
          { feature: 'groups' as MirrorFeature, label: t('memberGroups.title') },
          { feature: 'journal' as MirrorFeature, label: t('tabs.journal') },
        ]).map(opt => (
          <button
            key={opt.feature}
            onClick={() => {
              const f = mirrorMenuFor;
              setMirrorMenuFor(null);
              if (f) setMirror({ peerId: f.peerId, name: f.displayName, feature: opt.feature });
            }}
            style={{ display: 'block', width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', padding: '12px 0', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: 'var(--text)' }}>
            {opt.label}
          </button>
        ))}
      </Modal>

      {mirror && (
        <MirrorView
          open
          peerId={mirror.peerId}
          displayName={mirror.name}
          feature={mirror.feature}
          online={net.onlinePeers.includes(mirror.peerId)}
          onClose={() => setMirror(null)}
        />
      )}
    </div>
  );
}
