import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, ConfirmDialog, Toggle, SaveErrorDialog } from '../components/ui';
import { saveData } from '../store/actions';
import { useAppStore } from '../store/appStore';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { PlannerAppointment, PlannerData, PlannerReminder, getLocale, fmtClockHHMM, fmtList } from '../utils';
import { apptClock, appointmentsOn, remindKey, removeAppointment, removeReminder, repeatKey, sortedReminders, toggleReminder } from '../planner/planner';
import { AppointmentForm } from './planner/AppointmentForm';
import { ReminderForm } from './planner/ReminderForm';
import { MonthCalendar } from './planner/MonthCalendar';

type Editing =
  | { kind: 'appointment'; appointment: PlannerAppointment | null }
  | { kind: 'reminder'; reminder: PlannerReminder | null };

const livePlanner = () => useAppStore.getState().planner;

const ROW_CARD: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8 };
const ROW_BUTTON: CSSProperties = { flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 };
const ROW_TITLE: CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--text)' };

export default function PlannerView() {
  const { t } = useTranslation();
  const locale = getLocale();
  const planner = useAppStore(s => s.planner);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleteAppt, setDeleteAppt] = useState<PlannerAppointment | null>(null);
  const [deleteRem, setDeleteRem] = useState<PlannerReminder | null>(null);
  const [saveError, run, clearSaveError] = useSaveGuard();
  const markColor = planner.markColor || 'var(--accent)';
  const returnFocusKey = useRef<string | null>(null);

  useEffect(() => {
    if (editing) return;
    const key = returnFocusKey.current;
    if (!key) return;
    returnFocusKey.current = null;
    Array.from(document.querySelectorAll<HTMLElement>('[data-focus-key]')).find(el => el.dataset.focusKey === key)?.focus();
  }, [editing]);

  const save = (next: PlannerData) => run(() => saveData('planner', next));
  const open = (next: Editing, focusKey: string) => {
    returnFocusKey.current = focusKey;
    setEditing(next);
  };

  if (editing?.kind === 'appointment') {
    const noon = new Date(selected);
    noon.setHours(12, 0, 0, 0);
    return (
      <>
        <AppointmentForm appointment={editing.appointment} defaultTime={noon.getTime()} markColor={markColor} planner={livePlanner} onClose={() => setEditing(null)}
          onSave={async (next, entry) => {
            if (!(await save(next))) return;
            const when = new Date(entry.time);
            setEditing(null);
            setSelected(when);
            setViewMonth(new Date(when.getFullYear(), when.getMonth(), 1));
          }} />
        <SaveErrorDialog error={saveError} onClose={clearSaveError} />
      </>
    );
  }

  if (editing?.kind === 'reminder') {
    return (
      <>
        <ReminderForm reminder={editing.reminder} defaultStart={selected.getTime()} planner={livePlanner} onClose={() => setEditing(null)}
          onSave={async next => { if (await save(next)) setEditing(null); }} />
        <SaveErrorDialog error={saveError} onClose={clearSaveError} />
      </>
    );
  }

  const selectedLabel = selected.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const dayAppts = appointmentsOn(planner, selected);
  const listHeading = (label: string, live = false) => (
    <h3 aria-live={live ? 'polite' : undefined} style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '16px 0 8px' }}>{label}</h3>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <Btn onClick={() => open({ kind: 'appointment', appointment: null }, 'new-appt')} style={{ flex: 1 }} aria-label={t('planner.addAppt')} data-focus-key="new-appt">+ {t('planner.appt')}</Btn>
        <Btn onClick={() => open({ kind: 'reminder', reminder: null }, 'new-rem')} style={{ flex: 1 }} aria-label={t('planner.addReminder')} data-focus-key="new-rem">+ {t('planner.reminder')}</Btn>
      </div>

      <MonthCalendar planner={planner} viewMonth={viewMonth} onViewMonth={setViewMonth} selected={selected} onSelect={setSelected}
        markColor={markColor} onMarkColor={hex => void save({ ...livePlanner(), markColor: hex })} />

      {listHeading(selectedLabel, true)}
      {dayAppts.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{t('planner.emptyDay')}</div>
      ) : dayAppts.map(a => {
        const repeat = a.repeat ? t(repeatKey(a.repeat)) : null;
        const remindLabelKey = remindKey(a.reminderMinutesBefore);
        const remind = remindLabelKey ? t(remindLabelKey) : null;
        const clock = apptClock(a.time);
        return (
          <div key={a.id} style={{ ...ROW_CARD, borderLeft: `4px solid ${a.color || markColor}` }}>
            <div aria-hidden style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', width: 52 }}>{clock}</div>
            <button type="button" onClick={() => open({ kind: 'appointment', appointment: a }, `appt-${a.id}`)} data-focus-key={`appt-${a.id}`}
              aria-label={fmtList([clock, a.title, a.location, repeat, remind].filter((x): x is string => !!x))}
              style={ROW_BUTTON}>
              <div style={ROW_TITLE}>{a.title}</div>
              {(a.location || a.notes) ? <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{[a.location, a.notes].filter(Boolean).join(' · ')}</div> : null}
              {(repeat || remind) ? (
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  {[repeat ? `↻ ${repeat}` : null, remind ? `🔔 ${remind}` : null].filter(Boolean).join('  ·  ')}
                </div>
              ) : null}
            </button>
            <button type="button" className="icon-btn" aria-label={t('common.deleteNamed', { name: a.title })} onClick={() => setDeleteAppt(a)}>✕</button>
          </div>
        );
      })}

      {listHeading(t('planner.reminders'))}
      {planner.reminders.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('planner.emptyReminders')}</div>
      ) : sortedReminders(planner).map(r => {
        const repeat = t(repeatKey(r.repeat || 'daily'));
        const times = r.times.map(fmtClockHHMM);
        return (
          <div key={r.id} style={{ ...ROW_CARD, opacity: r.enabled ? 1 : 0.55 }}>
            <button type="button" onClick={() => open({ kind: 'reminder', reminder: r }, `rem-${r.id}`)} data-focus-key={`rem-${r.id}`} aria-label={fmtList([r.title, repeat, ...times])}
              style={ROW_BUTTON}>
              <div style={ROW_TITLE}>{r.title}</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{`↻ ${repeat}  ·  ${times.join('  ·  ')}`}</div>
              {r.notes ? <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.notes}</div> : null}
            </button>
            <Toggle value={r.enabled} onChange={() => void save(toggleReminder(livePlanner(), r.id))} label={t('planner.reminderEnabledFor', { title: r.title })} />
            <button type="button" className="icon-btn" aria-label={t('common.deleteNamed', { name: r.title })} onClick={() => setDeleteRem(r)}>✕</button>
          </div>
        );
      })}

      <ConfirmDialog open={!!deleteAppt} title={t('planner.deleteAppt')} message={deleteAppt?.title || ''} danger
        onConfirm={() => { if (deleteAppt) void save(removeAppointment(livePlanner(), deleteAppt.id)); setDeleteAppt(null); }}
        onCancel={() => setDeleteAppt(null)} />
      <ConfirmDialog open={!!deleteRem} title={t('planner.deleteReminder')} message={deleteRem?.title || ''} danger
        onConfirm={() => { if (deleteRem) void save(removeReminder(livePlanner(), deleteRem.id)); setDeleteRem(null); }}
        onCancel={() => setDeleteRem(null)} />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
