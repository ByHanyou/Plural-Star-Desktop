import { useState, useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, FrontTier, FrontState, AppSettings, EMPTY_TIER, moodChoices, statusIdsOf, toggleInSet } from '../../utils';
import { Btn, Field, Section, Modal, ConfirmDialog } from '../../components/ui';
import { MemberToggleChip } from '../../components/MemberChip';
import { TierDraft, draftToTier, seedDrafts } from './drafts';
import { EnergyButtons, LocationChips, MoodChips } from './DetailChips';

export type StatusSave = (p: Partial<FrontTier>, cf: Partial<FrontTier>, cc: Partial<FrontTier>) => void;

const statusDraft = (current: FrontState | null, selfId?: string): TierDraft => {
  const seeded = seedDrafts(current).primary;
  return { ...seeded, ids: new Set(statusIdsOf(current, selfId)) };
};

export function SetStatusModal({ open, onClose, onSave, statuses, selfId, current, settings }: {
  open: boolean; onClose: () => void; onSave: StatusSave;
  statuses: Member[]; selfId?: string; current: FrontState | null; settings: AppSettings;
}) {
  const { t } = useTranslation();
  const statusFormId = useId();
  const [draft, setDraft] = useState<TierDraft>(() => statusDraft(null));
  const [confirmClear, setConfirmClear] = useState(false);
  const patch = (p: Partial<TierDraft>) => setDraft(d => ({ ...d, ...p }));

  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) setDraft(statusDraft(current, selfId));
    prevOpen.current = open;
  }, [open, current, selfId]);

  const handleSave = () => {
    const tier = draftToTier(draft);
    onSave({ ...tier, memberIds: [selfId, ...tier.memberIds || []].filter((id): id is string => !!id) }, EMPTY_TIER, EMPTY_TIER);
    onClose();
  };

  const handleConfirmClear = () => {
    onSave(EMPTY_TIER, EMPTY_TIER, EMPTY_TIER);
    setConfirmClear(false);
    onClose();
  };

  return (
    <>
      <Modal open={open} title={t('status.update')} onClose={onClose}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <Btn variant="ghost" onClick={() => setConfirmClear(true)}>{t('common.clear')}</Btn>
            <Btn variant="solid" onClick={handleSave}>{t('common.save')}</Btn>
          </div>
        }>
        <Section label={t('status.statuses')} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {statuses.map(m => <MemberToggleChip key={m.id} member={m} on={draft.ids.has(m.id)} onToggle={() => patch({ ids: toggleInSet(draft.ids, m.id) })} />)}
          {statuses.length === 0 && (
            <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{t('profile.noStatuses')}</span>
          )}
        </div>

        <MoodChips id={`${statusFormId}-mood`} draft={draft} patch={patch} allMoods={moodChoices(settings.customMoods)} />
        <LocationChips id={`${statusFormId}-loc`} location={draft.location} onChange={location => patch({ location })} locations={settings.locations || []} />
        <EnergyButtons id={`${statusFormId}-energy`} value={draft.energy} onChange={energy => patch({ energy })} />
        <Field label={t('modal.noteOptional')} value={draft.note} onChange={note => patch({ note })} placeholder={t('modal.whatHappening')} multiline />
      </Modal>
      <ConfirmDialog
        open={confirmClear}
        title={t('status.clearTitle')}
        message={t('status.clearMsg')}
        danger
        onConfirm={handleConfirmClear}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}
