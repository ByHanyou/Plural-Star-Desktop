import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Hint, Section, ConfirmDialog, SaveErrorDialog, clickable } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { useSaveGuard } from '../../hooks/useSaveGuard';
import { Friend } from '../../network/types';
import { fmtList, upsertById } from '../../utils';
import { Bucket, BucketFeature, BUCKET_ROWS, newBucket, copyBucket, splitKinds, featureLabel, scopeSummary } from '../../network/buckets';
import { BucketEditor } from './BucketEditor';
import { BucketPicker } from './BucketPicker';

export function BucketsPanel({ buckets, onSave, friends }: {
  buckets: Bucket[]; onSave: (next: Bucket[]) => Promise<void>; friends: Friend[];
}) {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const [editBucket, setEditBucket] = useState<Bucket | null>(null);
  const [pickerFeature, setPickerFeature] = useState<BucketFeature | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bucket | null>(null);
  const [saveError, run, clearSaveError] = useSaveGuard();

  const commitBucket = async () => {
    if (!editBucket) return;
    const name = editBucket.name.trim();
    if (!name) return;
    const next = upsertById(buckets, { ...editBucket, name });
    if (await run(() => onSave(next))) setEditBucket(null);
  };
  const summary = (b: Bucket): string[] => BUCKET_ROWS.map(f => t('network.bucketScope', { feature: featureLabel(t, f), scope: scopeSummary(t, b[f], true) }));

  return (
    <>
      <div style={{ marginTop: 24 }}>
        <Section label={t('network.tabPrivacy')} />
        <Hint>{t('network.privacyDesc')}</Hint>
        <Btn onClick={() => setEditBucket(newBucket())}>{t('network.newBucket')}</Btn>
        <div style={{ marginTop: 12 }}>
          {buckets.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>{t('network.noBuckets')}</p>
          ) : buckets.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, background: 'var(--card)' }}>
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                {...clickable(() => setEditBucket(splitKinds(b, members)), t('network.bucketLabel', { name: b.name, scopes: fmtList(summary(b)) }))}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {summary(b).join('  ·  ')}
                </div>
              </div>
              <Btn variant="ghost" aria-label={t('network.cloneBucketNamed', { name: b.name })} onClick={() => setEditBucket(copyBucket(b, t('network.bucketCopyName', { name: b.name })))}>⧉</Btn>
              <Btn variant="danger" aria-label={t('network.deleteBucketNamed', { name: b.name })} onClick={() => setDeleteTarget(b)}>✕</Btn>
            </div>
          ))}
        </div>
      </div>

      {editBucket && (
        <BucketEditor open={!pickerFeature} bucket={editBucket} isExisting={buckets.some(b => b.id === editBucket.id)} friends={friends}
          onChange={setEditBucket} onPick={setPickerFeature} onSave={() => void commitBucket()} onCancel={() => setEditBucket(null)} />
      )}
      {editBucket && pickerFeature && (
        <BucketPicker bucket={editBucket} feature={pickerFeature} onChange={setEditBucket} onClose={() => setPickerFeature(null)} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('network.deleteBucket')}
        message={t('network.deleteBucketMsg', { name: deleteTarget?.name || '' })}
        danger
        onConfirm={() => { const b = deleteTarget; setDeleteTarget(null); if (b) void run(() => onSave(buckets.filter(x => x.id !== b.id))); }}
        onCancel={() => setDeleteTarget(null)}
      />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </>
  );
}
