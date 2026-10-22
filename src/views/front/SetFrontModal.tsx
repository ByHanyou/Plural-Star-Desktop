import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, FrontState, FrontTier, FrontTierKey, AppSettings, EMPTY_TIER, FRONT_TIER_KEYS, TIER_I18N_KEY, TIER_SHORT_I18N_KEY, toggleInSet } from '../../utils';
import { Btn, Modal, ConfirmDialog, Section } from '../../components/ui';
import { MemberSelect } from '../../components/MemberSelect';
import { PICKER_RESULTS_MAX, pickerPool } from '../../picker/memberPicker';
import type { PickerPool } from '../../picker/memberPicker';
import { TIER_COLOR } from '../../theme';
import { TierDraft, TierDrafts, seedDrafts, draftToTier } from './drafts';
import { MoodChips, LocationChips } from './DetailChips';

function TierPicker({ tierKey, baseId, members, draft, patch, searchLabel, allAssigned, onToggleMember, allMoods, locations }: {
  tierKey: FrontTierKey; baseId: string; members: Member[];
  draft: TierDraft; patch: (p: Partial<TierDraft>) => void;
  searchLabel: string; allAssigned: ReadonlyMap<string, FrontTierKey>; onToggleMember: (id: string) => void;
  allMoods: string[]; locations: string[];
}) {
  const { t } = useTranslation();
  const color = TIER_COLOR[tierKey];
  const pools: PickerPool[] = useMemo(() => {
    const live = members.filter(m => !m.deleted);
    return [
      pickerPool('members', live.filter(m => !m.isCustomFront && !m.isFacet), t),
      pickerPool('facets', live.filter(m => m.isFacet && !m.isCustomFront), t),
      pickerPool('customFronts', live.filter(m => m.isCustomFront), t),
    ];
  }, [members, t]);
  const pid = `${baseId}-${tierKey}`;

  return (
    <div style={{ marginBottom: 16 }} role="group" aria-labelledby={`${pid}-tier`}>
      <Section label={t(TIER_I18N_KEY[tierKey])} color={color} id={`${pid}-tier`} />

      <MemberSelect pools={pools} selected={draft.ids} onPick={m => onToggleMember(m.id)} multi hideSelected requireSearch selectedChips kindToggles
        maxResults={PICKER_RESULTS_MAX} search={draft.search} onSearch={search => patch({ search })} searchLabel={searchLabel} hint={t('members.searchHint')}
        annotate={m => {
          const assignedTo = allAssigned.get(m.id);
          return assignedTo && assignedTo !== tierKey ? { label: t('tier.assignedTo', { tier: t(TIER_SHORT_I18N_KEY[assignedTo]), applyPostProcessor: false }) } : null;
        }} />

      <MoodChips id={`${pid}-mood`} draft={draft} patch={patch} allMoods={allMoods} />

      <LocationChips id={`${pid}-loc`} location={draft.location} onChange={location => patch({ location })} locations={locations} />

      <div className="field__label" id={`${pid}-energy`} style={{ marginTop: 4 }}>{t('energy.level')}</div>
      <div role="group" aria-labelledby={`${pid}-energy`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 28 }}>{draft.energy ?? '-'}</span>
        <input type="range" min={1} max={10} value={draft.energy ?? 5} aria-label={t('energy.level')}
          onChange={e => patch({ energy: Number(e.target.value) })}
          style={{ flex: 1, accentColor: color }} />
        <button type="button" className="btn btn--ghost" style={{ padding: '2px 8px', fontSize: 10 }}
          aria-label={t('energy.clear')} onClick={() => patch({ energy: undefined })}>✕</button>
      </div>

      <textarea className="field__input field__input--multi" value={draft.note} onChange={e => patch({ note: e.target.value })}
        aria-label={t('modal.whatHappening')} placeholder={t('modal.whatHappening')} style={{ minHeight: 48, fontSize: 12 }} />
    </div>
  );
}

export function SetFrontModal({ open, onClose, onSave, members, current, settings, allMoods }: {
  open: boolean; onClose: () => void; onSave: (p: Partial<FrontTier>, cf: Partial<FrontTier>, cc: Partial<FrontTier>) => void;
  members: Member[]; current: FrontState | null;
  settings: AppSettings; allMoods: string[];
}) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<TierDrafts>(() => seedDrafts(null));
  const [confirmClear, setConfirmClear] = useState(false);
  const searchLabel = t('members.searchToAddKind', { kind: t('terminology.fronters') });
  const pickerBaseId = useId();

  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) setDrafts(seedDrafts(current));
    prevOpen.current = open;
  }, [open, current]);

  const { primary: { ids: primaryIds }, coFront: { ids: coFrontIds }, coConscious: { ids: coConsciousIds } } = drafts;
  const allAssigned = useMemo(() => {
    const map = new Map<string, FrontTierKey>();
    primaryIds.forEach(id => map.set(id, 'primary'));
    coFrontIds.forEach(id => map.set(id, 'coFront'));
    coConsciousIds.forEach(id => map.set(id, 'coConscious'));
    return map;
  }, [primaryIds, coFrontIds, coConsciousIds]);

  const patchTier = (tier: FrontTierKey, p: Partial<TierDraft>) => setDrafts(d => ({ ...d, [tier]: { ...d[tier], ...p } }));

  const toggleMember = (tier: FrontTierKey, id: string) => setDrafts(d => {
    const next = toggleInSet(d[tier].ids, id);
    const out: TierDrafts = { ...d, [tier]: { ...d[tier], ids: next } };
    FRONT_TIER_KEYS.forEach(key => {
      if (key === tier) return;
      const kept = [...d[key].ids].filter(x => !next.has(x));
      if (kept.length !== d[key].ids.size) out[key] = { ...d[key], ids: new Set(kept) };
    });
    return out;
  });

  const handleSave = () => {
    onSave(draftToTier(drafts.primary), draftToTier(drafts.coFront), draftToTier(drafts.coConscious));
    onClose();
  };

  const handleConfirmClear = () => {
    onSave(EMPTY_TIER, EMPTY_TIER, EMPTY_TIER);
    setConfirmClear(false);
    onClose();
  };

  return (
    <>
      <Modal open={open} title={t('modal.updateFront')} onClose={onClose}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <Btn variant="ghost" onClick={() => setConfirmClear(true)}>{t('front.clearFront')}</Btn>
            <Btn variant="solid" onClick={handleSave}>{t('common.save')}</Btn>
          </div>
        }>
        {FRONT_TIER_KEYS.map(tier => (
          <TierPicker key={tier} tierKey={tier} baseId={pickerBaseId} members={members}
            draft={drafts[tier]} patch={p => patchTier(tier, p)} searchLabel={searchLabel} allAssigned={allAssigned}
            onToggleMember={id => toggleMember(tier, id)} allMoods={allMoods} locations={settings.locations} />
        ))}
      </Modal>
      <ConfirmDialog open={confirmClear} title={t('front.clearFrontTitle')} message={t('front.clearFrontMsg')} danger single
        onConfirm={handleConfirmClear} onCancel={() => setConfirmClear(false)} />
    </>
  );
}
