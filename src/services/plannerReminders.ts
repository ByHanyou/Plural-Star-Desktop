import i18n from '../i18n/i18n';
import { store, KEYS } from '../storage';
import { PlannerData, plannerOccursOnDay, plannerNextOccurrence, fmtClock, localDateKey } from '../utils';
import { notify, notificationsEnabled, catchUpWindow, clockDueAt, reminderLoop } from './alerts';

const fired = new Set<string>();
const sinceLastTick = catchUpWindow();

const clockOf = (d: Date) => fmtClock(d.getHours(), d.getMinutes());

const tick = async () => {
  if (!(await notificationsEnabled())) return;
  const data = await store.get<PlannerData>(KEYS.planner, null);
  if (!data) return;

  const now = new Date();
  const nowMs = now.getTime();
  const since = sinceLastTick(nowMs);
  const today = localDateKey(now);

  for (const rem of data.reminders || []) {
    if (!rem.enabled) continue;
    const repeat = rem.repeat || 'daily';
    for (const time of rem.times || []) {
      const at = clockDueAt(time, now, since);
      if (!at) continue;
      const anchor = new Date(rem.startDate ?? rem.createdAt);
      anchor.setHours(at.getHours(), at.getMinutes(), 0, 0);
      if (!plannerOccursOnDay(anchor.getTime(), repeat, now)) continue;
      const key = `plan-rem:${rem.id}:${time}:${today}`;
      if (fired.has(key)) continue;
      fired.add(key);
      notify('planner', `⏰ ${rem.title}`, rem.notes || i18n.t('planner.notifReminder'));
    }
  }

  for (const appt of data.appointments || []) {
    if (appt.reminderMinutesBefore == null) continue;
    const offsetMs = appt.reminderMinutesBefore * 60000;
    const occ = plannerNextOccurrence(appt.time, appt.repeat, since - offsetMs);
    if (occ == null) continue;
    const trigger = occ - offsetMs;
    if (trigger <= since || trigger > nowMs) continue;
    const key = `plan-appt:${appt.id}:${localDateKey(new Date(occ))}`;
    if (fired.has(key)) continue;
    fired.add(key);
    notify('planner', `🗓 ${appt.title}`, appt.location
      ? i18n.t('planner.notifApptAt', { time: clockOf(new Date(occ)), location: appt.location })
      : i18n.t('planner.notifAppt', { time: clockOf(new Date(occ)) }));
  }
};

export const startPlannerReminders = reminderLoop('planner', tick);
