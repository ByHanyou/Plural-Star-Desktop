import { useTranslation } from 'react-i18next';
import { RelationshipTypeDef, DEFAULT_REL_COLOR, RELATIONSHIP_COLOR_CHOICES, relTypeLabel, uid } from '../../utils';
import { Btn, Modal, linkButton } from '../../components/ui';
import { ColorCarousel } from '../../components/ColorCarousel';

export type TypeDraft = { id: string; name: string; inverseName: string; directional: boolean; color: string; preset: boolean; isNew: boolean };

export const newTypeDraft = (): TypeDraft => ({ id: uid(), name: '', inverseName: '', directional: false, color: RELATIONSHIP_COLOR_CHOICES[0], preset: false, isNew: true });

export const typeDraftOf = (ty: RelationshipTypeDef, label: string): TypeDraft =>
  ({ id: ty.id, name: label, inverseName: ty.inverseName || '', directional: !!ty.directional, color: ty.color || RELATIONSHIP_COLOR_CHOICES[0], preset: !!ty.preset, isNew: false });

export function TypesModal({ open, types, onEdit, onDelete, onNew, onClose }: {
  open: boolean; types: RelationshipTypeDef[]; onEdit: (ty: RelationshipTypeDef) => void; onDelete: (ty: RelationshipTypeDef) => void; onNew: () => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={t('systemMap.manageTypes')} onClose={onClose}
      footer={<Btn variant="ghost" onClick={onNew}>{t('systemMap.newType')}</Btn>}>
      {types.map(ty => {
        const label = relTypeLabel(ty, t);
        return (
          <div key={ty.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: 6, background: ty.color || DEFAULT_REL_COLOR }} />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{label}{ty.preset ? ` · ${t('systemMap.preset')}` : ''}</span>
            <button type="button" onClick={() => onEdit(ty)} aria-label={t('common.editNamed', { name: label })}
              style={linkButton('var(--accent)')}>{t('common.edit')}</button>
            <button type="button" onClick={() => onDelete(ty)} aria-label={t('common.deleteNamed', { name: label })}
              style={linkButton('var(--danger)', 12)}>✕</button>
          </div>
        );
      })}
    </Modal>
  );
}

export function TypeDraftModal({ draft, onChange, onSave, onClose }: {
  draft: TypeDraft | null; onChange: (d: TypeDraft) => void; onSave: () => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={!!draft} title={draft?.isNew ? t('systemMap.newType') : t('systemMap.editType')} onClose={onClose}
      footer={<Btn variant="solid" onClick={onSave}>{t('common.save')}</Btn>}>
      {draft && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="field__label">{t('systemMap.typeName')}</label>
            <input className="field__input" aria-label={t('systemMap.typeName')} value={draft.name} onChange={e => onChange({ ...draft, name: e.target.value })} />
          </div>
          <ColorCarousel value={draft.color} onChange={v => onChange({ ...draft, color: v })} />
          {draft.preset && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{t('systemMap.presetEditNote')}</p>}
        </div>
      )}
    </Modal>
  );
}
