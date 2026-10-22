import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { NetworkManager } from '../../network/NetworkManager';
import { Friend } from '../../network/types';
import { friendNotifyLevel } from '../../network/friendState';
import { NOTIFY_GLYPH, NOTIFY_KEY, ONLINE_COLOR, deviceStatusKey, nextNotifyLevel } from '../../network/status';
import { frontShareDetailLines, frontShareTierLines } from '../../network/frontShare';
import { fmtDur, fmtTime } from '../../utils';
import { SaveErrorDialog } from '../../components/ui';
import { SaveRun, useSaveGuard } from '../../hooks/useSaveGuard';

const friendStatusLines = (t: TFunction, f: Friend, online: boolean): string[] => {
  if (f.status === 'entered_theirs') return [t('network.waitingThem')];
  if (f.status === 'entered_mine') return [t('network.waitingYou')];
  if (f.needsRefriend) return [t('network.needsRefriend')];
  const s = f.lastStatus;
  if (!s) return [online ? t('network.online') : t('network.offline')];
  const dur = s.startTime ? fmtDur(s.startTime) : '';
  const lines = [`◈ ${s.fronters}${dur ? `  ·  ${dur}` : ''}`, ...frontShareTierLines(s, t), ...frontShareDetailLines(s, t)];
  if (s.startTime) lines.push(t('notification.since', { time: fmtTime(s.startTime) }));
  if (!online) lines.push(t('network.offline'));
  return lines;
};

function NotifyLevelButton({ friend: f, fullNotifyCount, run }: { friend: Friend; fullNotifyCount: number; run: SaveRun }) {
  const { t } = useTranslation();
  const level = friendNotifyLevel(f);
  const next = nextNotifyLevel(level, fullNotifyCount);
  return (
    <button type="button" className="icon-btn" title={t(NOTIFY_KEY[level])}
      aria-label={t('network.notifyLevelCycle', { name: f.displayName, level: t(NOTIFY_KEY[level]), next: t(NOTIFY_KEY[next]) })}
      onClick={() => void run(() => NetworkManager.setFriendNotifyLevel(f.peerId, next))}
      style={{ color: level === 'full' ? 'var(--accent)' : undefined, opacity: level === 'off' ? 0.45 : 1 }}>{NOTIFY_GLYPH[level]}</button>
  );
}

export function FriendRow({ friend: f, peerOnline, orderIdx, orderCount, fullNotifyCount, onMirror, onRemove }: {
  friend: Friend; peerOnline: boolean; orderIdx?: number; orderCount?: number; fullNotifyCount: number;
  onMirror: (f: Friend) => void; onRemove: (f: Friend) => void;
}) {
  const { t } = useTranslation();
  const [saveError, run, clearSaveError] = useSaveGuard();
  const accepted = f.status === 'accepted';
  const online = accepted && peerOnline;
  const isFriend = f.kind !== 'device';
  const lines = isFriend ? friendStatusLines(t, f, peerOnline) : [t(deviceStatusKey(f, peerOnline))];
  const canOrder = orderIdx !== undefined && orderCount !== undefined && orderCount > 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0, background: online ? ONLINE_COLOR : 'var(--muted)' }} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: online || !accepted ? 'var(--text)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.displayName}</div>
        {lines.map((line, i) => (
          <div key={i} style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{line}</div>
        ))}
      </div>
      {canOrder && (
        <>
          <button type="button" className="icon-btn" aria-label={t('common.moveUpNamed', { name: f.displayName })} title={t('members.moveUp')}
            disabled={orderIdx === 0} onClick={() => void run(() => NetworkManager.moveFriend(f.peerId, -1))} style={{ fontSize: 13 }}>▲</button>
          <button type="button" className="icon-btn" aria-label={t('common.moveDownNamed', { name: f.displayName })} title={t('members.moveDown')}
            disabled={orderIdx === orderCount - 1} onClick={() => void run(() => NetworkManager.moveFriend(f.peerId, 1))} style={{ fontSize: 13 }}>▼</button>
        </>
      )}
      {isFriend && accepted && (
        <>
          <button type="button" className="icon-btn" aria-label={t('network.viewSharedNamed', { name: f.displayName })} onClick={() => onMirror(f)}>⋯</button>
          <NotifyLevelButton friend={f} fullNotifyCount={fullNotifyCount} run={run} />
        </>
      )}
      <button type="button" className="icon-btn" aria-label={t('network.removeNamed', { name: f.displayName })} onClick={() => onRemove(f)}>✕</button>
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
