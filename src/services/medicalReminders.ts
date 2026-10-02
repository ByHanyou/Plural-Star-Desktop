import i18n from '../i18n/i18n';
import { store, KEYS } from '../storage';
import { MedicalData, AppSettings } from '../utils';
import { logError } from '../log';

const fired = new Set<string>();

const notify = (title: string, body: string) => {
  try { window.electronAPI?.notify(title, body); } catch (e) { logError('medical', e); }
};

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Catch-up window: a machine that slept or a renderer throttled across the
// reminder minute used to skip that reminder for the day.
const CATCH_UP_MS = 3 * 60 * 60 * 1000;
let lastTickAt = 0;

const tick = async () => {
  const settings = await store.get<AppSettings>(KEYS.settings, null);
  if (settings && settings.notificationsEnabled === false) return;

  const data = await store.get<MedicalData>(KEYS.medical, null);
  if (!data) return;

  const now = new Date();
  const nowMs = now.getTime();
  const since = lastTickAt ? Math.max(lastTickAt, nowMs - CATCH_UP_MS) : nowMs - 60000;
  lastTickAt = nowMs;
  const today = dayKey(now);

  for (const med of data.medications || []) {
    if (!med.enabled) continue;
    for (const time of med.times || []) {
      const [hh, mm] = String(time).split(':').map(Number);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
      const at = new Date(now);
      at.setHours(hh, mm, 0, 0);
      if (at.getTime() <= since || at.getTime() > nowMs) continue;
      const key = `med:${med.id}:${time}:${today}`;
      if (fired.has(key)) continue;
      fired.add(key);
      notify(i18n.t('medical.medReminderTitle'), med.dosage ? `${med.name} · ${med.dosage}` : med.name);
    }
  }

  for (const appt of data.appointments || []) {
    const trigger = appt.time - (appt.reminderMinutesBefore || 0) * 60000;
    const key = `appt:${appt.id}`;
    if (fired.has(key)) continue;
    if (now.getTime() >= trigger && now.getTime() < appt.time + 60000) {
      fired.add(key);
      notify(i18n.t('medical.apptReminderTitle'), appt.title);
    }
  }
};

let timer: ReturnType<typeof setInterval> | null = null;

export const startMedicalReminders = (): (() => void) => {
  if (timer) return () => { if (timer) { clearInterval(timer); timer = null; } };
  const kick = setTimeout(() => { void tick(); }, 4000);
  timer = setInterval(() => { void tick(); }, 30000);
  return () => {
    clearTimeout(kick);
    if (timer) { clearInterval(timer); timer = null; }
  };
};
