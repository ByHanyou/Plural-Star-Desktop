import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNetwork } from '../network/useNetwork';

interface Props { onClick: () => void; }

export default function NetworkTile({ onClick }: Props) {
  const { t } = useTranslation();
  const net = useNetwork();

  const statusColor =
    net.status === 'online' ? '#2faa55'
    : net.status === 'connecting' || net.status === 'reconnecting' ? '#d6a435'
    : net.status === 'error' ? '#cc4444'
    : 'var(--muted)';
  const statusLabel =
    net.status === 'online' ? t('network.status.online')
    : net.status === 'connecting' ? t('network.status.connecting')
    : net.status === 'reconnecting' ? t('network.status.reconnecting')
    : net.status === 'error' ? t('network.status.error')
    : t('network.status.disabled');

  const acceptedFriends = net.friends.filter(f => f.status === 'accepted');
  const onlineFriends = acceptedFriends.filter(f => net.onlinePeers.includes(f.peerId));
  const devices = net.devices.filter(f => f.status === 'accepted');

  return (
    <div className="tile tile--clickable" role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>
      <div className="tile__header"><div className="tile__glyph">🛰</div><span className="tile__title">{t('network.title')}</span></div>
      <div className="tile__body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
          <span style={{ width: 9, height: 9, borderRadius: 5, background: statusColor, flexShrink: 0 }} aria-hidden />
          <span>{statusLabel}</span>
        </div>
        {net.enabled ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>{t('network.friends')}: {acceptedFriends.length}{acceptedFriends.length > 0 ? ` · ${onlineFriends.length} ${t('network.online').toLowerCase()}` : ''}</span>
            <span>{t('network.linkedDevices')}: {devices.length}</span>
          </div>
        ) : (
          <span className="tile__empty">{t('network.enableDesc')}</span>
        )}
      </div>
    </div>
  );
}
