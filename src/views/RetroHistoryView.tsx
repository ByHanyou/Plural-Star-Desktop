import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, HistoryEntry, FrontState, FrontTierKey, TIER_LABELS, fmtTime, allFrontMemberIds, singletStatuses } from '../utils';
import { store, KEYS } from '../storage';
import { Btn, Field, Toggle } from '../components/ui';

interface Props {
  members: Member[];
  history: HistoryEntry[];
  front: FrontState | null;
  onUpdate: () => void;
  onDone: () => void;
  singlet?: boolean;
  selfId?: string;
}

interface ChoiceButton {
  label: string;
  danger?: boolean;
  onClick: () => void;
}

interface Choice {
  title: string;
  message: string;
  buttons: ChoiceButton[];
}

const toLocalInput = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function RetroHistoryView({ members, history, front, onUpdate, onDone, singlet = false, selfId }: Props) {
  const { t } = useTranslation();
  const regularMembers = members.filter(m => !m.isCustomFront && !m.archived);
  const customFronts = members.filter(m => m.isCustomFront && !m.archived);
  const statusPool = singletStatuses(members);

  const [primaryIds, setPrimaryIds] = useState<string[]>([]);
  const [coFrontIds, setCoFrontIds] = useState<string[]>([]);
  const [coConIds, setCoConIds] = useState<string[]>([]);
  const [mood, setMood] = useState('');
  const [note, setNote] = useState('');
  const [location, setLocation] = useState('');
  const [energy, setEnergy] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [isCurrent, setIsCurrent] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [search, setSearch] = useState<Record<string, string>>({});

  const allSelected: Record<FrontTierKey, string[]> = { primary: primaryIds, coFront: coFrontIds, coConscious: coConIds };

  const findOverlaps = (start: number, end: number | null): HistoryEntry[] => {
    const effectiveEnd = end ?? Date.now();
    return history.filter(e => {
      if (!e.startTime) return false;
      const eEnd = e.endTime ?? Date.now();
      return e.startTime < effectiveEnd && start < eEnd;
    });
  };

  const effectivePrimary = (): string[] =>
    singlet && selfId ? [selfId, ...primaryIds.filter(id => id !== selfId)] : primaryIds;

  const buildEntry = (): HistoryEntry => ({
    memberIds: effectivePrimary(),
    startTime: startDate.getTime(),
    endTime: isCurrent ? null : endDate.getTime(),
    note: note,
    mood: mood || undefined,
    location: location || undefined,
    energyLevel: energy,
    coFrontIds: coFrontIds.length > 0 ? coFrontIds : undefined,
    coConsciousIds: coConIds.length > 0 ? coConIds : undefined,
    changeType: 'front',
  });

  const saveHistory = async (h: HistoryEntry[]) => {
    await store.set(KEYS.history, h);
  };

  const setFrontState = async (f: FrontState | null) => {
    await store.set(KEYS.front, f);
  };

  const replaceEntries = (deleteOverlapKeys?: Set<string>): HistoryEntry[] => {
    const newEntry = buildEntry();
    let base = history;
    if (deleteOverlapKeys) {
      base = base.filter(e => !deleteOverlapKeys.has(`${e.startTime}-${(e.memberIds || []).join(',')}`));
    }
    return [newEntry, ...base].sort((a, b) => b.startTime - a.startTime);
  };

  const finish = () => {
    setChoice(null);
    onUpdate();
    onDone();
  };

  const handleSave = async () => {
    if (!singlet && primaryIds.length === 0 && coFrontIds.length === 0 && coConIds.length === 0) {
      setChoice({ title: t('hub.noMembersSelected'), message: t('hub.selectAtLeastOne'), buttons: [{ label: t('common.cancel'), onClick: () => setChoice(null) }] });
      return;
    }
    if (!isCurrent && endDate.getTime() <= startDate.getTime()) {
      setChoice({ title: t('hub.invalidTime'), message: t('hub.endBeforeStart'), buttons: [{ label: t('common.cancel'), onClick: () => setChoice(null) }] });
      return;
    }

    const newEntry = buildEntry();
    const overlaps = findOverlaps(newEntry.startTime, newEntry.endTime);

    if (isCurrent && front) {
      setChoice({
        title: t('hub.activeFrontExists'),
        message: t('hub.activeFrontExistsMsg', { names: allFrontMemberIds(front).map(id => members.find(m => m.id === id)?.name || '?').join(', ') }),
        buttons: [
          { label: t('common.cancel'), onClick: () => setChoice(null) },
          { label: t('hub.overwrite'), danger: true, onClick: async () => {
            const now = Date.now();
            const closed = history.map(e =>
              e.endTime === null && e.startTime === front.startTime && (!e.changeType || e.changeType === 'front')
                ? { ...e, endTime: now } : e
            );
            const newFront: FrontState = {
              primary: { memberIds: effectivePrimary(), mood: mood || undefined, note, location: location || undefined, energyLevel: energy },
              coFront: { memberIds: coFrontIds, note: '' },
              coConscious: { memberIds: coConIds, note: '' },
              startTime: startDate.getTime(),
            };
            await setFrontState(newFront);
            await saveHistory([newEntry, ...closed]);
            finish();
          } },
          { label: t('hub.addTo'), onClick: async () => {
            const newFront: FrontState = {
              primary: { memberIds: [...(front?.primary.memberIds || []), ...effectivePrimary().filter(id => !front?.primary.memberIds.includes(id))], mood: mood || front?.primary.mood, note: note || front?.primary.note || '', location: location || front?.primary.location },
              coFront: { memberIds: [...(front?.coFront.memberIds || []), ...coFrontIds.filter(id => !front?.coFront.memberIds.includes(id))], note: front?.coFront.note || '' },
              coConscious: { memberIds: [...(front?.coConscious.memberIds || []), ...coConIds.filter(id => !front?.coConscious.memberIds.includes(id))], note: front?.coConscious.note || '' },
              startTime: front?.startTime || startDate.getTime(),
            };
            await setFrontState(newFront);
            await saveHistory(replaceEntries());
            finish();
          } },
        ],
      });
      return;
    }

    if (overlaps.length > 0) {
      const overlapNames = overlaps.slice(0, 3).map(e => {
        const names = (e.memberIds || []).map(id => members.find(m => m.id === id)?.name || '?').join(', ');
        return `${names} (${fmtTime(e.startTime)})`;
      }).join('\n');
      setChoice({
        title: t('hub.overlapDetected'),
        message: `${t('hub.overlapMsg')}\n\n${overlapNames}${overlaps.length > 3 ? `\n+${overlaps.length - 3} more` : ''}`,
        buttons: [
          { label: t('common.cancel'), onClick: () => setChoice(null) },
          { label: t('hub.keepBoth'), onClick: async () => { await saveHistory(replaceEntries()); finish(); } },
          { label: t('hub.replace'), danger: true, onClick: async () => {
            const overlapSet = new Set(overlaps.map(e => `${e.startTime}-${e.memberIds.join(',')}`));
            await saveHistory(replaceEntries(overlapSet));
            finish();
          } },
        ],
      });
      return;
    }

    if (isCurrent) {
      const newFront: FrontState = {
        primary: { memberIds: effectivePrimary(), mood: mood || undefined, note, location: location || undefined, energyLevel: energy },
        coFront: { memberIds: coFrontIds, note: '' },
        coConscious: { memberIds: coConIds, note: '' },
        startTime: startDate.getTime(),
      };
      await setFrontState(newFront);
    }
    await saveHistory(replaceEntries());
    finish();
  };

  const TierMemberPicker = ({ tierKey, poolKey, label, color, selected, setSelected, pool }: {
    tierKey: FrontTierKey; poolKey: string; label: string; color: string;
    selected: string[]; setSelected: (ids: string[]) => void; pool: Member[];
  }) => {
    const q = search[poolKey] || '';
    const ql = q.toLowerCase();
    const filtered = ql ? pool.filter(m => !selected.includes(m.id) && m.name.toLowerCase().includes(ql)) : [];
    const poolSelected = pool.filter(m => selected.includes(m.id));
    const toggle = (id: string) => {
      setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    };
    return (
      <div style={{ marginBottom: 16 }}>
        <div className="section-div">
          <span className="section-div__dot" style={{ background: color }} />
          <span className="section-div__label" style={{ color }}>{label}</span>
          <span className="section-div__line" />
        </div>
        {poolSelected.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {poolSelected.map(m => (
              <button key={m.id} className="chip" style={{ borderColor: `${m.color}50`, background: `${m.color}20` }}
                onClick={() => toggle(m.id)}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                <span style={{ color: m.color }}>{m.name}</span>
                <span style={{ fontSize: 10, color: m.color }}>✕</span>
              </button>
            ))}
          </div>
        )}
        <input className="field__input" value={q}
          onChange={e => setSearch({ ...search, [poolKey]: e.target.value })}
          placeholder={t('members.searchToAdd')} style={{ marginBottom: 6, fontSize: 12 }} />
        {ql && filtered.length > 0 && (
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', marginBottom: 4 }}>
            {filtered.slice(0, 20).map(m => {
              const otherTier = (Object.entries(allSelected) as [FrontTierKey, string[]][]).find(([tk, ids]) => tk !== tierKey && ids.includes(m.id));
              return (
                <button key={m.id} onClick={() => { toggle(m.id); setSearch({ ...search, [poolKey]: '' }); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: otherTier ? 0.5 : 1 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                  {m.pronouns ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{m.pronouns}</span> : null}
                  {otherTier && (
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>({TIER_LABELS[otherTier[0]].split(' ')[0]})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <label className="field__label">{t('hub.startTime')}</label>
      <input className="field__input" type="datetime-local" value={toLocalInput(startDate)}
        onChange={e => { if (e.target.value) setStartDate(new Date(e.target.value)); }}
        style={{ marginBottom: 14 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label className="field__label" style={{ marginBottom: 0 }}>{t('hub.endTime')}</label>
        <Toggle value={isCurrent} onChange={setIsCurrent} label={t('hub.current')} />
      </div>
      {!isCurrent && (
        <input className="field__input" type="datetime-local" value={toLocalInput(endDate)}
          onChange={e => { if (e.target.value) setEndDate(new Date(e.target.value)); }}
          style={{ marginBottom: 14 }} />
      )}

      <div style={{ height: 1, background: 'var(--border)', margin: '10px 0 16px' }} />

      {singlet ? (
        <TierMemberPicker tierKey="primary" poolKey="primary" label={t('status.statuses')} color="var(--accent)" selected={primaryIds} setSelected={setPrimaryIds} pool={statusPool} />
      ) : (<>
        <TierMemberPicker tierKey="primary" poolKey="primary" label={TIER_LABELS.primary} color="var(--accent)" selected={primaryIds} setSelected={setPrimaryIds} pool={regularMembers} />
        {customFronts.length > 0 && (
          <TierMemberPicker tierKey="primary" poolKey="primaryCf" label={t('members.customFronts')} color="var(--accent)" selected={primaryIds} setSelected={setPrimaryIds} pool={customFronts} />
        )}
        <TierMemberPicker tierKey="coFront" poolKey="coFront" label={TIER_LABELS.coFront} color="var(--info)" selected={coFrontIds} setSelected={setCoFrontIds} pool={regularMembers} />
        {customFronts.length > 0 && (
          <TierMemberPicker tierKey="coFront" poolKey="coFrontCf" label={t('members.customFronts')} color="var(--info)" selected={coFrontIds} setSelected={setCoFrontIds} pool={customFronts} />
        )}
        <TierMemberPicker tierKey="coConscious" poolKey="coConscious" label={TIER_LABELS.coConscious} color="var(--success)" selected={coConIds} setSelected={setCoConIds} pool={regularMembers} />
      </>)}

      <Field label={t('modal.mood')} value={mood} onChange={setMood} placeholder={t('modal.enterMood')} />
      <Field label={t('modal.location')} value={location} onChange={setLocation} placeholder={t('modal.typeLocation')} />

      <label className="field__label">{t('energy.level')}</label>
      <div style={{ display: 'flex', gap: 3, marginBottom: 14, alignItems: 'center' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button key={n} onClick={() => setEnergy(energy === n ? undefined : n)}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 600,
              background: energy === n ? 'var(--accent-bg)' : 'var(--surface)',
              border: `1px solid ${energy !== undefined && n <= energy ? 'var(--accent)' : 'var(--border)'}`,
              color: energy !== undefined && n <= energy ? 'var(--accent)' : 'var(--dim)',
            }}>{n}</button>
        ))}
      </div>

      <Field label={t('modal.note')} value={note} onChange={setNote} placeholder={t('modal.whatHappening')} multiline />

      <div style={{ display: 'flex', gap: 10, marginTop: 16, marginBottom: 30 }}>
        <Btn variant="ghost" onClick={onDone}>{t('common.cancel')}</Btn>
        <Btn variant="solid" onClick={handleSave}>{t('common.save')}</Btn>
      </div>

      {choice && (
        <div className="modal-overlay" onClick={() => setChoice(null)}>
          <div className="modal modal--sm" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">{choice.title}</span>
            </div>
            <div className="modal__body" style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--dim)', padding: 16 }}>
              {choice.message}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 16px 16px' }}>
              {choice.buttons.map((b, i) => (
                <Btn key={i} variant={b.danger ? 'danger' : i === 0 ? 'ghost' : 'solid'} onClick={b.onClick}>{b.label}</Btn>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
