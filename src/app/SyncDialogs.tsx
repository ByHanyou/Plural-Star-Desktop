import { useTranslation } from 'react-i18next';
import { NetworkManager } from '../network/NetworkManager';
import { log } from '../utils/log';
import { Modal, Btn } from '../components/ui';
import type { RoleMismatchPrompt, SyncConflictPrompt } from './lifecycle';

export function SyncDialogs({ syncConflict, onConflictClosed, roleMismatch, onRoleMismatchClosed }: {
  syncConflict: SyncConflictPrompt | null;
  onConflictClosed: () => void;
  roleMismatch: RoleMismatchPrompt | null;
  onRoleMismatchClosed: () => void;
}) {
  const { t } = useTranslation();

  const resolveSyncConflict = (keep: 'mine' | 'theirs') => {
    if (!syncConflict) return;
    onConflictClosed();
    NetworkManager.resolveConflict(syncConflict.peerId, keep).catch(e => log.error('network', 'resolve conflict failed:', e));
  };

  return (
    <>
      <Modal
        open={!!syncConflict}
        title={t('network.syncConflictTitle')}
        onClose={onConflictClosed}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn onClick={() => resolveSyncConflict('mine')}>
              {t('network.keepThisDevice')}
            </Btn>
            <Btn onClick={() => resolveSyncConflict('theirs')}>
              {t('network.keepOtherDevice')}
            </Btn>
          </div>
        }>
        <p style={{ fontSize: 13, color: 'var(--text)' }}>
          {t('network.syncConflictMsg', { device: syncConflict?.deviceName || '' })}
        </p>
      </Modal>

      <Modal
        open={!!roleMismatch}
        title={t('network.syncRoleMismatchTitle')}
        onClose={onRoleMismatchClosed}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn onClick={onRoleMismatchClosed}>{t('common.ok')}</Btn>
          </div>
        }>
        <p style={{ fontSize: 13, color: 'var(--text)' }}>
          {t('network.syncRoleMismatchMsg', { device: roleMismatch?.deviceName || '' })}
        </p>
      </Modal>
    </>
  );
}
