import { config } from '../config';
import { store, KEYS } from '../storage';
import { AppSettings, parseClock } from '../utils';
import { logError } from '../utils/log';

const CATCH_UP_MS = 3 * 60 * 60 * 1000;

export const notify = (tag: string, title: string, body: string): void => {
  Promise.resolve()
    .then(() => window.electronAPI.notify(title, body))
    .catch(e => logError(tag, e));
};

export const notificationsEnabled = async (): Promise<boolean> => {
  const settings = await store.get<AppSettings>(KEYS.settings, null);
  return !(settings && settings.notificationsEnabled === false);
};

export const catchUpWindow = (): ((nowMs: number) => number) => {
  let lastTickAt = 0;
  return nowMs => {
    const since = lastTickAt ? Math.max(lastTickAt, nowMs - CATCH_UP_MS) : nowMs - 60000;
    lastTickAt = nowMs;
    return since;
  };
};

export const clockDueAt = (time: unknown, now: Date, since: number): Date | null => {
  const clock = parseClock(time);
  if (!clock) return null;
  const at = new Date(now);
  at.setHours(clock[0], clock[1], 0, 0);
  return at.getTime() > since && at.getTime() <= now.getTime() ? at : null;
};

export const reminderLoop = (tag: string, tick: () => Promise<void>): (() => (() => void)) => {
  let timer: ReturnType<typeof setInterval> | null = null;
  const stop = () => {
    if (timer) { clearInterval(timer); timer = null; }
  };
  return () => {
    if (timer) return stop;
    const run = () => { tick().catch(e => logError(tag, e)); };
    const kick = setTimeout(run, config().reminders.kickDelayMs);
    timer = setInterval(run, config().reminders.tickMs);
    return () => {
      clearTimeout(kick);
      stop();
    };
  };
};
