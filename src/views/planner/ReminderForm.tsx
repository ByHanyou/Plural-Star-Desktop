import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlannerData, PlannerReminder, fmtClockHHMM, localDateKey, parseFieldDate, parseTime24, time12to24, uses12HourClock } from '../../utils';
import { Btn, Field, Section } from '../../components/ui';
import { AmPmToggle } from '../../components/AmPmToggle';
import { REM_REPEAT_CHOICES, ReminderDraft, addReminderTime, reminderDraft, repeatKey, upsertReminder } from '../../planner/planner';
import { ChoicePills, PlannerForm, fieldLabelStyle } from './PlannerParts';
import { tint } from '../../theme';

export function ReminderForm({ reminder, defaultStart, planner, onClose, onSave }: {
  reminder: PlannerReminder | null; defaultStart: number; planner: () => PlannerData;
  onClose: () => void; onSave: (next: PlannerData) => void;
}) {
  const { t } = useTranslation();
  const twelveHour = uses12HourClock();
  const [draft, setDraft] = useState<ReminderDraft>(() => reminderDraft(reminder, defaultStart));
  const [newTime, setNewTime] = useState('');
  const [amPm, setAmPm] = useState<'AM' | 'PM'>('AM');
  const patch = (p: Partial<ReminderDraft>) => setDraft(d => ({ ...d, ...p }));
  const startLabel = draft.repeat === 'once' ? t('planner.onDateLabel') : t('planner.startingLabel');

  const addTime = () => {
    const times = addReminderTime(draft.times, twelveHour ? time12to24(newTime, amPm) : parseTime24(newTime));
    if (!times) return;
    patch({ times });
    setNewTime('');
  };

  const save = () => {
    const next = upsertReminder(planner(), reminder?.id ?? null, draft);
    if (next) onSave(next);
  };

  return (
    <PlannerForm title={reminder ? t('planner.editReminder') : t('planner.addReminder')} onClose={onClose} onSave={save} canSave={!!draft.title.trim() && draft.times.length > 0}>
      <Field label={t('planner.reminderTitlePlaceholder')} value={draft.title} onChange={title => patch({ title })} placeholder={t('planner.reminderTitlePlaceholder')} />
      <Section label={t('planner.timesLabel')} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {draft.times.map(tm => (
          <button key={tm} type="button" onClick={() => patch({ times: draft.times.filter(x => x !== tm) })} aria-label={t('planner.removeTime', { time: fmtClockHHMM(tm) })}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
              background: tint('var(--accent)', 15), border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            {fmtClockHHMM(tm)} <span aria-hidden style={{ color: 'var(--dim)', fontSize: 11 }}>✕</span>
          </button>
        ))}
      </div>
      <div className="add-row">
        <input className="field__input" value={newTime} onChange={e => setNewTime(e.target.value)} aria-label={t('planner.addTime')}
          placeholder={twelveHour ? '9:00' : '08:00'} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTime(); } }} />
        {twelveHour && <AmPmToggle value={amPm} onChange={setAmPm} />}
        <Btn onClick={addTime}>{t('common.add')}</Btn>
      </div>
      <Section label={t('planner.repeatLabel')} />
      <ChoicePills choices={REM_REPEAT_CHOICES} value={draft.repeat} label={rep => t(repeatKey(rep))} onPick={repeat => patch({ repeat })} style={{ marginBottom: 10 }} />
      {draft.repeat !== 'daily' && (
        <label style={fieldLabelStyle}>
          {startLabel}
          <input className="field__input" aria-label={startLabel} type="date" value={localDateKey(new Date(draft.start))}
            onChange={e => { const d = parseFieldDate(e.target.value); if (d) patch({ start: d.getTime() }); }} style={{ display: 'block', marginTop: 6, width: 180 }} />
        </label>
      )}
      <Field label={t('planner.notesPlaceholder')} value={draft.notes} onChange={notes => patch({ notes })} placeholder={t('planner.notesPlaceholder')} multiline />
    </PlannerForm>
  );
}
