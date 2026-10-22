import { useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { useMinuteTick } from '../hooks/useMinuteTick';
import { Btn, Hint, Toggle, Section, Modal, ConfirmDialog, SrOnly } from '../components/ui';
import { useNetwork } from '../network/useNetwork';
import { NetworkManager } from '../network/NetworkManager';
import { Friend } from '../network/types';
import { friendNotifyLevel } from '../network/friendState';
import type { MirrorServedFeature } from '../network/mirror/build';
import { MirrorView } from './MirrorView';
import { fmtTime } from '../utils';
import { errorMessage, log } from '../utils/log';
import { ERROR_COLOR, isOfflineError, netStatusColor, netStatusKey } from '../network/status';
import { useCloud } from '../cloud/useCloud';
import { Pairing, PairingKind } from './network/Pairing';
import { FriendRow } from './network/FriendRow';
import { CloudPanel } from './network/CloudPanel';
import { RelayPanel } from './network/RelayPanel';
import { BucketsPanel } from './network/BucketsPanel';
import { MirrorMenu } from './network/MirrorMenu';
import { usePrivacyBuckets } from './network/usePrivacyBuckets';
import { tint } from '../theme';

const mutedText: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' };

const alertBox: React.CSSProperties = {
  background: tint(ERROR_COLOR, 12), border: `1px solid ${ERROR_COLOR}`, borderRadius: 8,
  padding: '10px 12px', fontSize: 13, color: 'var(--text)', marginBottom: 14,
};

export default function NetworkView() {
  useMinuteTick();
  const { t } = useTranslation();
  const net = useNetwork();
  const cloud = useCloud();
  const [buckets, saveBuckets] = usePrivacyBuckets();

  const [theirFriend, setTheirFriend] = useState('');
  const [theirDevice, setTheirDevice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directionFor, setDirectionFor] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Friend | null>(null);
  const [removeArmed, setRemoveArmed] = useState(false);
  const [mirrorMenuFor, setMirrorMenuFor] = useState<Friend | null>(null);
  const [mirror, setMirror] = useState<{ peerId: string; name: string; feature: MirrorServedFeature } | null>(null);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const raw = errorMessage(e);
      setError(isOfflineError(raw.toLowerCase()) ? t('network.status.error') : raw);
    } finally {
      setBusy(false);
    }
  };

  const codeError = (kind: PairingKind, e: unknown): string => {
    const msg = errorMessage(e).toLowerCase();
    const sync = kind === 'device';
    if (msg.includes('own')) return t(sync ? 'network.ownSyncCode' : 'network.ownCode');
    if (msg.includes('not found') || msg.includes('expired')) return t('network.notFound');
    if (isOfflineError(msg)) return t('network.publishFailed');
    return t(sync ? 'network.invalidSyncCode' : 'network.invalidCode');
  };

  const statusLabel = t(netStatusKey(net.status));

  const cloudBlocksSync = (kind: PairingKind): boolean => {
    if (kind !== 'device' || !cloud.linked) return false;
    setError(t('network.cloudBlocksSync'));
    return true;
  };
  const onGenerate = (kind: PairingKind) => {
    if (cloudBlocksSync(kind)) return;
    void guard(async () => {
      try {
        await NetworkManager.generateCode(kind);
      } catch (e) {
        log.debug('network', e);
        throw new Error(t('network.publishFailed'));
      }
    });
  };

  const enterWith = (kind: PairingKind, value: string, clear: () => void, role: 'source' | 'target' = 'source') =>
    guard(async () => {
      try {
        if (kind === 'device') await NetworkManager.enterDeviceCode(value.trim(), role);
        else await NetworkManager.enterFriendCode(value.trim());
        clear();
      } catch (e) {
        throw new Error(codeError(kind, e));
      }
    });

  const onEnter = (kind: PairingKind, value: string, clear: () => void) => {
    if (!value.trim()) return;
    if (cloudBlocksSync(kind)) return;
    if (kind === 'device') {
      setDirectionFor(value.trim());
      return;
    }
    void enterWith(kind, value, clear);
  };

  const chooseDirection = (role: 'source' | 'target') => {
    const code = directionFor;
    setDirectionFor(null);
    if (code) void enterWith('device', code, () => setTheirDevice(''), role);
  };

  const removePeer = (f: Friend) => {
    setRemoveTarget(null);
    setRemoveArmed(false);
    void guard(() => NetworkManager.removeFriend(f.peerId));
  };

  const isOnline = (peerId: string) => net.onlinePeers.includes(peerId);
  const fullNotifyCount = net.friends.filter(x => friendNotifyLevel(x) === 'full').length;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 32 }}>
      {error && (
        <div role="alert" style={alertBox}>
          {error}
        </div>
      )}

      {net.identityResetAt !== null && (
        <div role="alert" style={{ ...alertBox, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1 }}>{t('network.identityResetNotice', { date: fmtTime(net.identityResetAt) })}</span>
          <Btn onClick={() => void guard(() => NetworkManager.dismissIdentityReset())} disabled={busy}>{t('common.ok')}</Btn>
        </div>
      )}

      <Section label={t('network.enable')} />
      <Toggle value={net.enabled} onChange={v => void guard(() => NetworkManager.setEnabled(v))} label={t('network.enable')} description={t('network.enableDesc')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 20 }} role="status">
        <span style={{ width: 9, height: 9, borderRadius: 5, background: netStatusColor(net.status, 'var(--muted)') }} aria-hidden />
        <span style={{ fontSize: 13, color: 'var(--text)' }} aria-hidden>{statusLabel}</span>
        <SrOnly>{t('network.statusLabel', { status: statusLabel })}</SrOnly>
      </div>

      <Section label={t('network.addFriend')} />
      <Hint>{t('network.howItWorks')}</Hint>
      <Pairing kind="friend" code={net.activeFriendCode} expiresAt={net.activeFriendExpiresAt} value={theirFriend} onChange={setTheirFriend}
        busy={busy} canGenerate={net.enabled} onGenerate={() => onGenerate('friend')} onEnter={(value, clear) => onEnter('friend', value, clear)} />

      <div style={{ marginTop: 20 }}>
        <Section label={t('network.friends')} />
        {net.friends.length === 0 ? (
          <p style={mutedText}>{t('network.noFriends')}</p>
        ) : (
          net.friends.map((f, i) => (
            <FriendRow key={f.peerId} friend={f} peerOnline={isOnline(f.peerId)}
              orderIdx={i} orderCount={net.friends.length} fullNotifyCount={fullNotifyCount}
              onMirror={setMirrorMenuFor} onRemove={setRemoveTarget} />
          ))
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <Section label={t('network.syncTitle')} />
        <Hint>{t('network.syncDesc')}</Hint>
        <Pairing kind="device" code={net.activeDeviceCode} expiresAt={net.activeDeviceExpiresAt} value={theirDevice} onChange={setTheirDevice}
          busy={busy} canGenerate={net.enabled} onGenerate={() => onGenerate('device')} onEnter={(value, clear) => onEnter('device', value, clear)} />
        <div style={{ marginTop: 14 }}>
          <Section label={t('network.linkedDevices')} />
          {net.devices.length === 0 ? (
            <p style={mutedText}>{t('network.noDevices')}</p>
          ) : (
            net.devices.map(f => (
              <FriendRow key={f.peerId} friend={f} peerOnline={isOnline(f.peerId)}
                fullNotifyCount={fullNotifyCount} onMirror={setMirrorMenuFor} onRemove={setRemoveTarget} />
            ))
          )}
        </div>
      </div>

      <CloudPanel deviceCount={net.devices.length} />

      <RelayPanel busy={busy} onSave={(url, token) => void guard(() => NetworkManager.setRelayOverride(url, token))} />

      <BucketsPanel buckets={buckets} onSave={saveBuckets} friends={net.friends} />

      <Modal
        open={!!directionFor}
        title={t('network.syncDirectionTitle')}
        onClose={() => setDirectionFor(null)}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => setDirectionFor(null)}>{t('common.cancel')}</Btn>
            <Btn onClick={() => chooseDirection('source')}>
              {t('network.syncSendMine')}
            </Btn>
            <Btn onClick={() => chooseDirection('target')}>
              {t('network.syncReceiveTheirs')}
            </Btn>
          </div>
        }>
        <p style={{ fontSize: 13, color: 'var(--text)' }}>{t('network.syncDirectionMsg')}</p>
      </Modal>

      <ConfirmDialog
        open={!!removeTarget && !removeArmed}
        title={t('network.remove')}
        message={
          !removeTarget ? ''
            : removeTarget.kind === 'device' ? t('network.removeDeviceWarn', { name: removeTarget.displayName })
            : t('network.removeFriendWarn', { name: removeTarget.displayName })
        }
        danger
        onConfirm={() => {
          if (removeTarget?.kind === 'device') removePeer(removeTarget);
          else if (removeTarget) setRemoveArmed(true);
        }}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        open={!!removeTarget && removeArmed}
        title={t('journal.areYouSure')}
        message={removeTarget ? t('network.removeFriendWarn', { name: removeTarget.displayName }) : ''}
        danger
        onConfirm={() => { if (removeTarget) removePeer(removeTarget); }}
        onCancel={() => { setRemoveTarget(null); setRemoveArmed(false); }}
      />

      <MirrorMenu friend={mirrorMenuFor} buckets={buckets} onClose={() => setMirrorMenuFor(null)}
        onOpen={feature => {
          const f = mirrorMenuFor;
          setMirrorMenuFor(null);
          if (f) setMirror({ peerId: f.peerId, name: f.displayName, feature });
        }} />

      {mirror && (
        <MirrorView
          open
          peerId={mirror.peerId}
          displayName={mirror.name}
          feature={mirror.feature}
          online={isOnline(mirror.peerId)}
          onClose={() => setMirror(null)}
        />
      )}
    </div>
  );
}
