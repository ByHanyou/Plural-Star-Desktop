import { useTranslation } from 'react-i18next';
import { useNetwork } from '../network/useNetwork';
import { Tile } from '../components/Tile';
import { netStatusColor, netStatusKey } from '../network/status';
import { isAcceptedDevice, isAcceptedFriend } from '../network/friendState';

interface Props { onClick: () => void; }

export default function NetworkTile({ onClick }: Props) {
  const { t } = useTranslation();
  const net = useNetwork();
  const acceptedFriends = net.friends.filter(isAcceptedFriend);
  const onlineFriends = acceptedFriends.filter(f => net.onlinePeers.includes(f.peerId));
  const devices = net.devices.filter(isAcceptedDevice);

  return (
    <Tile glyph="🛰" title={t('network.title')} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
        <span style={{ width: 9, height: 9, borderRadius: 5, background: netStatusColor(net.status, 'var(--muted)'), flexShrink: 0 }} aria-hidden />
        <span>{t(netStatusKey(net.status))}</span>
      </div>
      {net.enabled ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>{t('network.tileFriends', { count: acceptedFriends.length })}{acceptedFriends.length > 0 ? ` · ${t('network.tileOnline', { count: onlineFriends.length })}` : ''}</span>
          <span>{t('network.tileDevices', { count: devices.length })}</span>
        </div>
      ) : (
        <span className="tile__empty">{t('network.enableDesc')}</span>
      )}
    </Tile>
  );
}
