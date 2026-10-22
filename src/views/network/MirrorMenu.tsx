import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/ui';
import type { Friend } from '../../network/types';
import type { MirrorServedFeature } from '../../network/mirror/build';
import { MIRROR_FEATURE_KEY, MIRROR_MENU } from '../mirror/shared';
import { Bucket, BUCKET_ROWS, effectiveShare, featureLabel, scopeSummary } from '../../network/buckets';

export function MirrorMenu({ friend, buckets, onClose, onOpen }: {
  friend: Friend | null; buckets: Bucket[]; onClose: () => void; onOpen: (feature: MirrorServedFeature) => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={!!friend}
      title={t('network.viewSharedNamed', { name: friend?.displayName || '' })}
      onClose={onClose}>
      {friend && (
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 0 }}>
          {BUCKET_ROWS
            .map(f => t('network.bucketScope', { feature: featureLabel(t, f), scope: scopeSummary(t, effectiveShare(buckets, friend.peerId, f), true) }))
            .join('  ·  ')}
        </p>
      )}
      {MIRROR_MENU.map(feature => (
        <button
          key={feature}
          type="button"
          onClick={() => onOpen(feature)}
          style={{ display: 'block', width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', padding: '12px 0', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: 'var(--text)' }}>
          {t(MIRROR_FEATURE_KEY[feature])}
        </button>
      ))}
    </Modal>
  );
}
