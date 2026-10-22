import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, RelationshipTypeDef, relTypeLabel, toggleId } from '../../utils';
import { Btn, Dropdown, Modal } from '../../components/ui';
import { MemberToggleChip } from '../../components/MemberChip';

export interface RelationshipDraft { from: string; toIds: string[]; typeId: string; note: string }

export function RelationshipEditor({ draft, onChange, fromIds, toMembers, toFacets, memberById, types, duplicate, onSave, onClose }: {
  draft: RelationshipDraft | null;
  onChange: (d: RelationshipDraft) => void;
  fromIds: string[];
  toMembers: Member[];
  toFacets: Member[];
  memberById: Map<string, Member>;
  types: RelationshipTypeDef[];
  duplicate: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const typeById = new Map(types.map(ty => [ty.id, ty]));
  const chips = (list: Member[]) => draft
    ? list.filter(m => m.id !== draft.from).map(m => (
      <MemberToggleChip key={m.id} member={m} on={draft.toIds.includes(m.id)} onToggle={() => onChange({ ...draft, toIds: toggleId(draft.toIds, m.id) })} />
    ))
    : null;
  const facetChips = chips(toFacets);
  return (
    <Modal open={!!draft} title={t('systemMap.addRelationship')} onClose={onClose}
      footer={<Btn variant="solid" onClick={onSave}>{t('common.save')}</Btn>}>
      {draft && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Dropdown<string> label={t('systemMap.from')} value={draft.from} options={fromIds} onChange={v => onChange({ ...draft, from: v })} renderOption={mid => memberById.get(mid)?.name || '?'} />
          <div>
            <div className="field__label" id={`${id}-to`}>{t('systemMap.to')}</div>
            <div className="field__label" id={`${id}-tom`} style={{ marginTop: 4 }}>{t('members.title')}</div>
            <div role="group" aria-labelledby={`${id}-to ${id}-tom`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{chips(toMembers)}</div>
            {facetChips && facetChips.length > 0 && (
              <>
                <div className="field__label" id={`${id}-tof`} style={{ marginTop: 8 }}>{t('members.facets')}</div>
                <div role="group" aria-labelledby={`${id}-to ${id}-tof`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{facetChips}</div>
              </>
            )}
          </div>
          <Dropdown<string> label={t('systemMap.type')} value={draft.typeId} options={types.map(ty => ty.id)} onChange={v => onChange({ ...draft, typeId: v })}
            renderOption={tid => { const ty = typeById.get(tid); return ty ? relTypeLabel(ty, t) : tid; }} />
          {duplicate && <div role="alert" style={{ fontSize: 12, color: 'var(--danger)' }}>{t('systemMap.duplicate')}</div>}
        </div>
      )}
    </Modal>
  );
}
