import i18n from '../i18n/i18n';
import { store, KEYS } from '../storage';
import { MedicalData, localDateKey } from '../utils';
import { notify, notificationsEnabled, catchUpWindow, clockDueAt, reminderLoop } from './alerts';

const fired = new Set<string>();
const sinceLastTick = catchUpWindow();

const tick = async () => {
  if (!(await notificationsEnabled())) return;
  const data = await store.get<MedicalData>(KEYS.medical, null);
  if (!data) return;

  const now = new Date();
  const nowMs = now.getTime();
  const since = sinceLastTick(nowMs);
  const today = localDateKey(now);

  for (const med of data.medications || []) {
    if (!med.enabled) continue;
    for (const time of med.times || []) {
      if (!clockDueAt(time, now, since)) continue;
      const key = `med:${med.id}:${time}:${today}`;
      if (fired.has(key)) continue;
      fired.add(key);
      notify('medical', i18n.t('medical.medReminderTitle'), med.dosage ? `${med.name} · ${med.dosage}` : med.name);
    }
  }

  for (const appt of data.appointments || []) {
    const trigger = appt.time - (appt.reminderMinutesBefore || 0) * 60000;
    const key = `appt:${appt.id}`;
    if (fired.has(key)) continue;
    if (nowMs >= trigger && nowMs < appt.time + 60000) {
      fired.add(key);
      notify('medical', i18n.t('medical.apptReminderTitle'), appt.title);
    }
  }
};

export const startMedicalReminders = reminderLoop('medical', tick);
