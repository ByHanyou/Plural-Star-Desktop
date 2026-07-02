// Network view (desktop) — Friends & device Sync. Mirrors mobile's
// NetworkScreen: mutual friend codes, directed initial device clone with an
// explicit send/receive choice, live status, and a custom-relay override.

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Field, Toggle, Section, Modal, ConfirmDialog } from '../components/ui';
import { useNetwork } from '../network/useNetwork';
import { NetworkManager } from '../network/NetworkManager';
import { Friend } from '../network/types';
import { fmtDur, fmtTime } from '../utils';

type Kind = 'friend' | 'device';

export default function NetworkView() {
  const { t } = useTranslation();
  const net = useNetwork();

  const [theirFriend, setTheirFriend] = useState('');
  const [theirDevice, setTheirDevice] = useState('');
  const [relayUrl, setRelayUrl] = useState('');
  const [relayToken, setRelayToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKind, setCopiedKind] = useState<Kind | null>(null);
  const [directionFor, setDirectionFor] = useState<string | null>(null); // device code awaiting send/receive choice
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
    } catch {}
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
      // The initial copy is directed: the user must say which device's data
      // survives. After that first copy, sync runs both ways.
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
    lines.push(`◈ ${s.fronters}${dur ? `  ·  ${dur}` : ''}`);
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

      {/* Connection */}
      <Section label={t('network.enable')} />
      <Toggle value={net.enabled} onChange={v => guard(() => NetworkManager.setEnabled(v))} label={t('network.enable')} description={t('network.enableDesc')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 20 }} role="status" aria-label={`${t('network.enable')} — ${statusLabel()}`}>
        <span style={{ width: 9, height: 9, borderRadius: 5, background: statusColor() }} aria-hidden />
        <span style={{ fontSize: 13, color: 'var(--text)' }}>{statusLabel()}</span>
      </div>

      {/* Add a friend */}
      <Section label={t('network.addFriend')} />
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>{t('network.howItWorks')}</p>
      {renderPairing('friend', net.activeFriendCode, net.activeFriendExpiresAt, theirFriend, setTheirFriend)}

      {/* Friends */}
      <div style={{ marginTop: 20 }}>
        <Section label={t('network.friends')} />
        {net.friends.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{t('network.noFriends')}</p>
        ) : (
          net.friends.map(f => renderRow(f, friendStatusLines(f)))
        )}
      </div>

      {/* Sync your devices */}
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

      {/* Other / custom network */}
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

      {/* Direction chooser for the initial device copy */}
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

      {/* Remove confirmation */}
      <ConfirmDialog
        open={!!removeTarget}
        title={t('network.remove')}
        message={removeTarget?.displayName || ''}
        danger
        onConfirm={() => { const f = removeTarget!; setRemoveTarget(null); guard(() => NetworkManager.removeFriend(f.peerId)); }}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
