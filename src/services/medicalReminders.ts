import i18n from '../i18n/i18n';
import { store, KEYS } from '../storage';
import { MedicalData, AppSettings } from '../utils';

// In-session de-dup so each reminder fires once.
const fired = new Set<string>();

const notify = (title: string, body: string) => {
  try { window.electronAPI?.notify(title, body); } catch { /* notifications unavailable */ }
};

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const tick = async () => {
  const settings = await store.get<AppSettings>(KEYS.settings, null);
  if (settings && settings.notificationsEnabled === false) return;

  const data = await store.get<MedicalData>(KEYS.medical, null);
  if (!data) return;

  const now = new Date();
  const cur = hhmm(now);
  const today = dayKey(now);

  // Medication reminder times (HH:MM, daily)
  for (const med of data.medications || []) {
    if (!med.enabled) continue;
    for (const time of med.times || []) {
      if (time !== cur) continue;
      const key = `med:${med.id}:${time}:${today}`;
      if (fired.has(key)) continue;
      fired.add(key);
      notify(i18n.t('medical.medReminderTitle'), med.dosage ? `${med.name} · ${med.dosage}` : med.name);
    }
  }

  // Appointment reminders (remind N minutes before, fire once)
  for (const appt of data.appointments || []) {
    const trigger = appt.time - (appt.reminderMinutesBefore || 0) * 60000;
    const key = `appt:${appt.id}`;
    if (fired.has(key)) continue;
    // fire within a one-minute window after the trigger so we don't miss it between ticks
    if (now.getTime() >= trigger && now.getTime() < appt.time + 60000) {
      fired.add(key);
      notify(i18n.t('medical.apptReminderTitle'), appt.title);
    }
  }
};

let timer: ReturnType<typeof setInterval> | null = null;

export const startMedicalReminders = (): (() => void) => {
  if (timer) return () => { if (timer) { clearInterval(timer); timer = null; } };
  // run shortly after start, then every 30s
  const kick = setTimeout(() => { void tick(); }, 4000);
  timer = setInterval(() => { void tick(); }, 30000);
  return () => {
    clearTimeout(kick);
    if (timer) { clearInterval(timer); timer = null; }
  };
};
