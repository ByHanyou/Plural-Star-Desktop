import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HistoryEntry, FrontState, FrontTierKey, FRONT_TIER_KEYS, TIER_I18N_KEY, fmtTime, fmtList, allFrontMemberIds, singletStatuses, withMemberSince, closeOpenFrontEntry, localDateTimeValue, isRosterMember, isFacetMember, isCustomFrontMember } from '../utils';
import {
  RetroDrafts, RetroTierDraft, retroDraftsFrom, retroHasMembers, retroEntry, retroFront, mergeRetroIntoFront,
  historyEntryKey, findRetroOverlaps, insertHistoryEntry,
} from '../history/retro';
import { saveBatch } from '../store/actions';
import { useAppStore } from '../store/appStore';
import { Btn, Toggle, AlertDialog, ChoiceDialog, SaveErrorDialog } from '../components/ui';
import { pickerPool } from '../picker/memberPicker';
import type { PickerPool } from '../picker/memberPicker';
import { TIER_COLOR } from '../theme';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { RetroTierDetails, RetroTierPicker } from './retro/RetroTierFields';

interface Props {
  onDone: () => void;
  singlet?: boolean;
  selfId?: string;
}

type Prompt =
  | { kind: 'notice'; title: string; message: string }
  | { kind: 'activeFront'; front: FrontState; entry: HistoryEntry }
  | { kind: 'overlap'; overlaps: HistoryEntry[]; entry: HistoryEntry };

const dateTimeInput = (label: string, value: Date, onChange: (d: Date) => void) => (
  <input className="field__input" aria-label={label} type="datetime-local" value={localDateTimeValue(value)}
    onChange={e => { if (e.target.value) onChange(new Date(e.target.value)); }}
    style={{ marginBottom: 14 }} />
);

export default function RetroHistoryView({ onDone, singlet = false, selfId }: Props) {
  const members = useAppStore(s => s.members);
  const history = useAppStore(s => s.history);
  const front = useAppStore(s => s.front);
  const { t } = useTranslation();
  const retroPools = useMemo<PickerPool[]>(() => [
    pickerPool('members', members.filter(isRosterMember), t),
    pickerPool('facets', members.filter(m => isFacetMember(m) && !m.archived), t),
    pickerPool('customFronts', members.filter(m => isCustomFrontMember(m) && !m.archived), t),
  ], [members, t]);
  const statusPools = useMemo<PickerPool[]>(() => [{ label: t('status.statuses'), members: singletStatuses(members) }], [members, t]);

  const [drafts, setDrafts] = useState<RetroDrafts>(() => retroDraftsFrom(undefined));
  const [search, setSearch] = useState<Record<FrontTierKey, string>>({ primary: '', coFront: '', coConscious: '' });
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => new Date());
  const [isCurrent, setIsCurrent] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [saveError, run, clearSaveError] = useSaveGuard();

  const patchTier = (tier: FrontTierKey) => (p: Partial<RetroTierDraft>) => setDrafts(d => ({ ...d, [tier]: { ...d[tier], ...p } }));
  const primaryIds = singlet && selfId ? [selfId, ...drafts.primary.ids.filter(id => id !== selfId)] : drafts.primary.ids;
  const allSelected: Record<FrontTierKey, string[]> = { primary: drafts.primary.ids, coFront: drafts.coFront.ids, coConscious: drafts.coConscious.ids };
  const namesOf = (ids: string[]) => fmtList(ids.map(id => members.find(m => m.id === id)?.name || '?'));
  const frontSince = () => {
    const at = startDate.getTime();
    const now = Date.now();
    return Number.isFinite(at) && at > 0 ? Math.min(at, now) : now;
  };

  const commit = async (nextHistory: HistoryEntry[], nextFront?: FrontState) => {
    const ok = await run(() => saveBatch(nextFront
      ? { history: nextHistory, front: withMemberSince(nextFront, useAppStore.getState().front, frontSince()) }
      : { history: nextHistory }));
    if (ok) {
      setPrompt(null);
      onDone();
    }
  };

  const handleSave = () => {
    if (!singlet && !retroHasMembers(drafts)) {
      setPrompt({ kind: 'notice', title: t('hub.noMembersSelected'), message: t('hub.selectAtLeastOne') });
      return;
    }
    if (!isCurrent && endDate.getTime() <= startDate.getTime()) {
      setPrompt({ kind: 'notice', title: t('hub.invalidTime'), message: t('hub.endBeforeStart') });
      return;
    }
    const entry = retroEntry(drafts, primaryIds, startDate.getTime(), isCurrent ? null : endDate.getTime());
    if (isCurrent && front) {
      setPrompt({ kind: 'activeFront', front, entry });
      return;
    }
    const overlaps = findRetroOverlaps(history, entry.startTime, entry.endTime);
    if (overlaps.length > 0) {
      setPrompt({ kind: 'overlap', overlaps, entry });
      return;
    }
    void commit(insertHistoryEntry(history, entry), isCurrent ? retroFront(drafts, primaryIds, entry.startTime) : undefined);
  };

  const overwriteFront = (current: FrontState, entry: HistoryEntry) => {
    const now = Date.now();
    const closed = closeOpenFrontEntry(history, current.startTime, now);
    void commit(insertHistoryEntry(closed, entry), retroFront(drafts, primaryIds, entry.startTime));
  };

  const overlapMessage = (overlaps: HistoryEntry[]) => {
    const lines = overlaps.slice(0, 3).map(e => t('hub.overlapEntry', { names: namesOf(e.memberIds || []), time: fmtTime(e.startTime) })).join('\n');
    const more = overlaps.length > 3 ? `\n${t('hub.overlapMore', { count: overlaps.length - 3 })}` : '';
    return `${t('hub.overlapMsg')}\n\n${lines}${more}`;
  };

  const detailTiers = FRONT_TIER_KEYS.filter(tier => tier === 'primary' || (!singlet && drafts[tier].ids.length > 0));

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <label className="field__label">{t('hub.startTime')}</label>
      {dateTimeInput(t('hub.startTime'), startDate, setStartDate)}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label className="field__label" style={{ marginBottom: 0 }}>{t('hub.endTime')}</label>
        <Toggle value={isCurrent} onChange={setIsCurrent} label={t('hub.current')} />
      </div>
      {!isCurrent && dateTimeInput(t('hub.endTime'), endDate, setEndDate)}

      <div style={{ height: 1, background: 'var(--border)', margin: '10px 0 16px' }} />

      {(singlet ? (['primary'] as FrontTierKey[]) : FRONT_TIER_KEYS).map(tier => (
        <RetroTierPicker key={tier} tierKey={tier} label={singlet ? t('status.statuses') : t(TIER_I18N_KEY[tier])} color={TIER_COLOR[tier]}
          selected={drafts[tier].ids} onChange={ids => patchTier(tier)({ ids })} pools={singlet ? statusPools : retroPools}
          searchKind={singlet ? t('status.statuses') : undefined} search={search[tier]} onSearch={v => setSearch(s => ({ ...s, [tier]: v }))} allSelected={allSelected} />
      ))}

      {detailTiers.map(tier => (
        <RetroTierDetails key={tier} label={singlet ? '' : t(TIER_I18N_KEY[tier])} color={TIER_COLOR[tier]} draft={drafts[tier]} patch={patchTier(tier)} />
      ))}

      <div style={{ display: 'flex', gap: 10, marginTop: 16, marginBottom: 30 }}>
        <Btn variant="ghost" onClick={onDone}>{t('common.cancel')}</Btn>
        <Btn variant="solid" onClick={handleSave}>{t('common.save')}</Btn>
      </div>

      <AlertDialog open={prompt?.kind === 'notice'} title={prompt?.kind === 'notice' ? prompt.title : ''} message={prompt?.kind === 'notice' ? prompt.message : ''} onClose={() => setPrompt(null)} />

      <ChoiceDialog open={prompt?.kind === 'activeFront'} title={t('hub.activeFrontExists')}
        message={prompt?.kind === 'activeFront' ? t('hub.activeFrontExistsMsg', { names: namesOf(allFrontMemberIds(prompt.front)) }) : ''}
        onCancel={() => setPrompt(null)}>
        {prompt?.kind === 'activeFront' && (
          <>
            <Btn variant="danger" onClick={() => overwriteFront(prompt.front, prompt.entry)}>{t('hub.overwrite')}</Btn>
            <Btn variant="solid" onClick={() => void commit(insertHistoryEntry(history, prompt.entry), mergeRetroIntoFront(prompt.front, drafts, primaryIds))}>{t('hub.addTo')}</Btn>
          </>
        )}
      </ChoiceDialog>

      <ChoiceDialog open={prompt?.kind === 'overlap'} title={t('hub.overlapDetected')} message={prompt?.kind === 'overlap' ? overlapMessage(prompt.overlaps) : ''}
        onCancel={() => setPrompt(null)}>
        {prompt?.kind === 'overlap' && (
          <>
            <Btn variant="solid" onClick={() => void commit(insertHistoryEntry(history, prompt.entry))}>{t('hub.keepBoth')}</Btn>
            <Btn variant="danger" onClick={() => void commit(insertHistoryEntry(history, prompt.entry, { dropKeys: new Set(prompt.overlaps.map(historyEntryKey)) }))}>{t('hub.replace')}</Btn>
          </>
        )}
      </ChoiceDialog>

      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
