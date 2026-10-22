import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FrontTier, FrontTierKey, TIER_I18N_KEY } from '../../utils';
import { Btn, Field, Modal } from '../../components/ui';
import { DetailDraft, detailOf, resolveMood } from './drafts';
import { MoodChips, LocationChips } from './DetailChips';

export function EditDetailModal({ tier, tierData, allMoods, allLocations, onClose, onSave }: {
  tier: FrontTierKey; tierData: FrontTier;
  allMoods: string[]; allLocations: string[];
  onClose: () => void; onSave: (mood?: string, location?: string, note?: string) => void;
}) {
  const { t } = useTranslation();
  const detailId = useId();
  const [draft, setDraft] = useState<DetailDraft>(() => detailOf(tierData));
  const patch = (p: Partial<DetailDraft>) => setDraft(d => ({ ...d, ...p }));

  return (
    <Modal open title={t('tier.editTier', { tier: t(TIER_I18N_KEY[tier]) })} onClose={onClose}
      footer={<Btn variant="solid" onClick={() => onSave(resolveMood(draft), draft.location || undefined, draft.note || undefined)}>{t('common.save')}</Btn>}>
      <MoodChips id={`${detailId}-mood`} draft={draft} patch={patch} allMoods={allMoods} />
      <LocationChips id={`${detailId}-loc`} location={draft.location} onChange={location => patch({ location })} locations={allLocations} />
      <Field label={t('modal.note')} value={draft.note} onChange={note => patch({ note })} placeholder={t('modal.whatHappening')} multiline />
    </Modal>
  );
}
