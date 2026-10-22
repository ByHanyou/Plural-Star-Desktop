import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlannerAppointment, PlannerData, localDateTimeValue } from '../../utils';
import { Field, Section } from '../../components/ui';
import { ColorCarousel } from '../../components/ColorCarousel';
import { AppointmentDraft, APPT_REPEAT_CHOICES, REMIND_CHOICES, appointmentDraft, repeatKey, upsertAppointment } from '../../planner/planner';
import { ChoicePills, PlannerForm, fieldLabelStyle } from './PlannerParts';

export function AppointmentForm({ appointment, defaultTime, markColor, planner, onClose, onSave }: {
  appointment: PlannerAppointment | null; defaultTime: number; markColor: string; planner: () => PlannerData;
  onClose: () => void; onSave: (next: PlannerData, entry: PlannerAppointment) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AppointmentDraft>(() => appointmentDraft(appointment, defaultTime));
  const patch = (p: Partial<AppointmentDraft>) => setDraft(d => ({ ...d, ...p }));
  const save = () => {
    const result = upsertAppointment(planner(), appointment?.id ?? null, draft);
    if (result) onSave(result.planner, result.entry);
  };

  return (
    <PlannerForm title={appointment ? t('planner.editAppt') : t('planner.addAppt')} onClose={onClose} onSave={save} canSave={!!draft.title.trim() && Number.isFinite(draft.time)}>
      <Field label={t('planner.apptTitlePlaceholder')} value={draft.title} onChange={title => patch({ title })} placeholder={t('planner.apptTitlePlaceholder')} />
      <label style={fieldLabelStyle}>
        {t('planner.when')}
        <input className="field__input" aria-label={t('planner.when')} type="datetime-local" value={Number.isFinite(draft.time) ? localDateTimeValue(new Date(draft.time)) : ''}
          onChange={e => patch({ time: new Date(e.target.value).getTime() })} style={{ display: 'block', marginTop: 6, width: 220 }} />
      </label>
      <Field label={t('planner.locationPlaceholder')} value={draft.location} onChange={location => patch({ location })} placeholder={t('planner.locationPlaceholder')} />
      <Field label={t('planner.notesPlaceholder')} value={draft.notes} onChange={notes => patch({ notes })} placeholder={t('planner.notesPlaceholder')} multiline />
      <Section label={t('planner.repeatLabel')} />
      <ChoicePills choices={APPT_REPEAT_CHOICES} value={draft.repeat} label={rep => t(repeatKey(rep))} onPick={repeat => patch({ repeat })} style={{ marginBottom: 10 }} />
      <Section label={t('planner.remindLabel')} />
      <ChoicePills choices={REMIND_CHOICES.map(c => c.minutes)} value={draft.remind} label={m => t(REMIND_CHOICES.find(c => c.minutes === m)?.key || 'planner.remindNone')} onPick={remind => patch({ remind })} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 6 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: draft.color || markColor, display: 'inline-block' }} />
        <span style={{ flex: 1, fontSize: 11, color: 'var(--dim)' }}>{t('planner.apptColor')}</span>
        {draft.color && (
          <button type="button" onClick={() => patch({ color: null })}
            style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--dim)' }}>
            {t('planner.apptColorDefault')}
          </button>
        )}
      </div>
      <ColorCarousel value={draft.color || markColor} onChange={color => patch({ color })} size={22} />
    </PlannerForm>
  );
}
