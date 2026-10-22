import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, CheckRow, Field, Modal } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { Bucket, BucketFeature, allPicked, bucketPickItems, featureLabel, withAllPickedToggled, withPickToggled } from '../../network/buckets';

export function BucketPicker({ bucket, feature, onChange, onClose }: {
  bucket: Bucket; feature: BucketFeature; onChange: (next: Bucket) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const groups = useAppStore(s => s.groups);
  const journal = useAppStore(s => s.journal);
  const fieldDefs = useAppStore(s => s.customFieldDefs);
  const relationships = useAppStore(s => s.relationships);
  const relTypes = useAppStore(s => s.relationshipTypes);
  const [search, setSearch] = useState('');

  const items = bucketPickItems(feature, { members, groups, journal, fieldDefs, relationships, relTypes }, search, t);
  const allChecked = allPicked(bucket, feature, items);

  return (
    <Modal
      open
      title={t('network.pickerTitle', { feature: featureLabel(t, feature) })}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn onClick={onClose}>{t('common.close')}</Btn>
        </div>
      }>
      {feature !== 'groups' && (
        <Field label={t('common.search')} value={search} onChange={setSearch} placeholder={t('common.search')} />
      )}
      {items.length > 0 && (
        <CheckRow square checked={allChecked} label={allChecked ? t('network.deselectAll') : t('network.selectAll')} onToggle={() => onChange(withAllPickedToggled(bucket, feature, items))}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
            {allChecked ? t('network.deselectAll') : t('network.selectAll')}
          </span>
        </CheckRow>
      )}
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {items.map(item => (
          <CheckRow key={item.id} checked={bucket[feature].ids.includes(item.id)} label={item.name} onToggle={() => onChange(withPickToggled(bucket, feature, item.id))}>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
          </CheckRow>
        ))}
      </div>
    </Modal>
  );
}
