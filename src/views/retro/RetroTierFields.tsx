import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, FrontTierKey, FRONT_TIER_KEYS, TIER_SHORT_I18N_KEY, toggleId } from '../../utils';
import type { RetroTierDraft } from '../../history/retro';
import { Field, Section } from '../../components/ui';
import { MemberSelect } from '../../components/MemberSelect';
import { PICKER_RESULTS_MAX } from '../../picker/memberPicker';
import type { PickerPool } from '../../picker/memberPicker';
import { EnergyButtons } from '../front/DetailChips';

export function RetroTierDetails({ label, color, draft, patch }: {
  label: string; color: string; draft: RetroTierDraft; patch: (p: Partial<RetroTierDraft>) => void;
}) {
  const { t } = useTranslation();
  const baseId = useId();
  return (
    <div role={label ? 'group' : undefined} aria-labelledby={label ? `${baseId}-tier` : undefined}>
      {label ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: color, display: 'inline-block' }} />
          <span role="heading" aria-level={3} id={`${baseId}-tier`} style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
        </div>
      ) : null}
      <Field label={t('modal.mood')} value={draft.mood} onChange={mood => patch({ mood })} placeholder={t('modal.enterMood')} />
      <Field label={t('modal.location')} value={draft.location} onChange={location => patch({ location })} placeholder={t('modal.typeLocation')} />

      <EnergyButtons id={`${baseId}-energy`} value={draft.energy} onChange={energy => patch({ energy })} color={color} marginBottom={14} />

      <Field label={t('modal.note')} value={draft.note} onChange={note => patch({ note })} placeholder={t('modal.whatHappening')} multiline />
      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 14px' }} />
    </div>
  );
}

export function RetroTierPicker({ tierKey, label, color, selected, onChange, pools, searchKind, search, onSearch, allSelected }: {
  tierKey: FrontTierKey; label: string; color: string;
  selected: string[]; onChange: (ids: string[]) => void; pools: PickerPool[];
  searchKind?: string;
  search: string; onSearch: (value: string) => void;
  allSelected: Record<FrontTierKey, string[]>;
}) {
  const { t } = useTranslation();
  const labelId = useId();
  const searchLabel = t('members.searchToAddKind', { kind: searchKind || t('terminology.fronters') });
  return (
    <div style={{ marginBottom: 16 }} role="group" aria-labelledby={labelId}>
      <Section label={label} color={color} id={labelId} />
      <MemberSelect pools={pools} selected={selected} onPick={(m: Member) => onChange(toggleId(selected, m.id))} multi hideSelected requireSearch selectedChips kindToggles
        maxResults={PICKER_RESULTS_MAX} search={search} onSearch={onSearch} searchLabel={searchLabel}
        annotate={m => {
          const other = FRONT_TIER_KEYS.find(tk => tk !== tierKey && allSelected[tk].includes(m.id));
          return other ? { label: `(${t(TIER_SHORT_I18N_KEY[other])})` } : null;
        }} />
    </div>
  );
}
