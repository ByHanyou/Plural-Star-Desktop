import i18n from '../i18n/i18n';
import { store, KEYS } from '../storage';
import { PlannerData, AppSettings, plannerOccursOnDay, plannerNextOccurrence } from '../utils';
import { logError } from '../log';

const fired = new Set<string>();

const notify = (title: string, body: string) => {
  try { window.electronAPI?.notify(title, body); } catch (e) { logError('planner', e); }
};

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const CATCH_UP_MS = 3 * 60 * 60 * 1000;
let lastTickAt = 0;

const tick = async () => {
  const settings = await store.get<AppSettings>(KEYS.settings, null);
  if (settings && settings.notificationsEnabled === false) return;

  const data = await store.get<PlannerData>(KEYS.planner, null);
  if (!data) return;

  const now = new Date();
  const nowMs = now.getTime();
  const since = lastTickAt ? Math.max(lastTickAt, nowMs - CATCH_UP_MS) : nowMs - 60000;
  lastTickAt = nowMs;
  const today = dayKey(now);

  for (const rem of data.reminders || []) {
    if (!rem.enabled) continue;
    const repeat = rem.repeat || 'daily';
    for (const time of rem.times || []) {
      const [hh, mm] = String(time).split(':').map(Number);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
      const at = new Date(now);
      at.setHours(hh, mm, 0, 0);
      if (at.getTime() <= since || at.getTime() > nowMs) continue;
      const anchor = new Date(rem.startDate ?? rem.createdAt);
      anchor.setHours(hh, mm, 0, 0);
      if (!plannerOccursOnDay(anchor.getTime(), repeat, now)) continue;
      const key = `plan-rem:${rem.id}:${time}:${today}`;
      if (fired.has(key)) continue;
      fired.add(key);
      notify(`⏰ ${rem.title}`, rem.notes || i18n.t('planner.notifReminder'));
    }
  }

  for (const appt of data.appointments || []) {
    if (appt.reminderMinutesBefore == null) continue;
    const offsetMs = appt.reminderMinutesBefore * 60000;
    const occ = plannerNextOccurrence(appt.time, appt.repeat, since - offsetMs);
    if (occ == null) continue;
    const trigger = occ - offsetMs;
    if (trigger <= since || trigger > nowMs) continue;
    const key = `plan-appt:${appt.id}:${dayKey(new Date(occ))}`;
    if (fired.has(key)) continue;
    fired.add(key);
    notify(`🗓 ${appt.title}`, appt.location
      ? i18n.t('planner.notifApptAt', { time: hhmm(new Date(occ)), location: appt.location })
      : i18n.t('planner.notifAppt', { time: hhmm(new Date(occ)) }));
  }
};

let timer: ReturnType<typeof setInterval> | null = null;

export const startPlannerReminders = (): (() => void) => {
  if (timer) return () => { if (timer) { clearInterval(timer); timer = null; } };
  const kick = setTimeout(() => { void tick(); }, 4000);
  timer = setInterval(() => { void tick(); }, 30000);
  return () => {
    clearTimeout(kick);
    if (timer) { clearInterval(timer); timer = null; }
  };
};
