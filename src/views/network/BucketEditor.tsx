import { useTranslation } from 'react-i18next';
import { Btn, CheckRow, Field, Modal, toggleChipStyle } from '../../components/ui';
import { Friend, PrivacyScopeMode } from '../../network/types';
import { isAcceptedFriend } from '../../network/friendState';
import { Bucket, BucketFeature, BUCKET_ROWS, FRONT_DETAILS, featureLabel, scopeModesFor, withFriendToggled, withScopeMode } from '../../network/buckets';

const SCOPE_LABEL: Record<PrivacyScopeMode, string> = { all: 'network.scopeAll', select: 'network.scopeSelect', none: 'network.scopeNone' };

export function BucketEditor({ open, bucket, isExisting, friends, onChange, onPick, onSave, onCancel }: {
  open: boolean; bucket: Bucket; isExisting: boolean; friends: Friend[]; onChange: (next: Bucket) => void;
  onPick: (f: BucketFeature) => void; onSave: () => void; onCancel: () => void;
}) {
  const { t } = useTranslation();
  const setScopeMode = (f: BucketFeature, mode: PrivacyScopeMode) => {
    onChange(withScopeMode(bucket, f, mode));
    if (mode === 'select') onPick(f);
  };
  const accepted = friends.filter(isAcceptedFriend);
  return (
    <Modal
      open={open}
      title={isExisting ? bucket.name : t('network.newBucket')}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onCancel}>{t('common.cancel')}</Btn>
          <Btn onClick={onSave} disabled={!bucket.name.trim()}>{t('common.save')}</Btn>
        </div>
      }>
      <Field label={t('network.bucketName')} value={bucket.name} onChange={v => onChange({ ...bucket, name: v })} placeholder={t('network.bucketName')} />
      {BUCKET_ROWS.map(f => (
        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{featureLabel(t, f)}</span>
          {scopeModesFor(f).map(mode => {
            const sel = bucket[f].mode === mode;
            const label = t(SCOPE_LABEL[mode]);
            return (
              <button key={mode} type="button" className="chip" aria-pressed={sel} aria-label={t('network.bucketScope', { feature: featureLabel(t, f), scope: label })}
                style={toggleChipStyle(sel)} onClick={() => setScopeMode(f, mode)}>
                {label}
              </button>
            );
          })}
          {bucket[f].mode === 'select' && (
            <Btn variant="ghost" aria-label={t('network.bucketPickCount', { feature: featureLabel(t, f), count: bucket[f].ids.length })}
              onClick={() => onPick(f)}>
              {bucket[f].ids.length} ✎
            </Btn>
          )}
          {f === 'front' && bucket.front.mode !== 'none' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, width: '100%', paddingTop: 6 }}>
              {FRONT_DETAILS.map(([key, labelKey]) => {
                const on = bucket[key] !== false;
                return (
                  <button key={key} type="button" className="chip" role="checkbox" aria-checked={on} aria-label={t(labelKey)}
                    style={toggleChipStyle(on)} onClick={() => onChange({ ...bucket, [key]: !on })}>
                    {on ? '✓ ' : ''}{t(labelKey)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('network.friends')}</div>
        {accepted.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--dim)', margin: 0 }}>{t('network.noFriends')}</p>
        ) : accepted.map(f => (
          <CheckRow key={f.peerId} checked={(bucket.friendPeerIds || []).includes(f.peerId)} label={f.displayName} onToggle={() => onChange(withFriendToggled(bucket, f.peerId))}>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.displayName}</span>
          </CheckRow>
        ))}
      </div>
    </Modal>
  );
}
