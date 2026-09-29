import { useSyncExternalStore } from 'react';

export const RELEASES_URL = 'https://github.com/ByHanyou/Plural-Star-Desktop/releases/latest';
const LATEST_API = 'https://api.github.com/repos/ByHanyou/Plural-Star-Desktop/releases/latest';

export const parseVersion = (v: string): [number, number, number] | null => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

export const isNewerVersion = (latest: string, current: string): boolean => {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
};

export const latestTagFrom = (text: string): string | null => {
  try {
    const data = JSON.parse(text);
    const parsed = typeof data?.tag_name === 'string' ? parseVersion(data.tag_name) : null;
    return parsed ? parsed.join('.') : null;
  } catch {
    return null;
  }
};

export type UpdateCheckResult =
  | { status: 'update'; current: string; latest: string }
  | { status: 'current'; current: string }
  | { status: 'error'; current: string };

export interface AvailableUpdate {
  current: string;
  latest: string;
}

let available: AvailableUpdate | null = null;
const listeners = new Set<() => void>();

const publish = (next: AvailableUpdate | null): void => {
  if (available?.latest === next?.latest && available?.current === next?.current) return;
  available = next;
  listeners.forEach(fn => fn());
};

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const useAvailableUpdate = (): AvailableUpdate | null => useSyncExternalStore(subscribe, () => available);

export const appVersion = async (): Promise<string> => {
  try {
    return String((await window.electronAPI.app.version()) || '');
  } catch {
    return '';
  }
};

let inflight: Promise<UpdateCheckResult> | null = null;

const runCheck = async (): Promise<UpdateCheckResult> => {
  const current = await appVersion();
  try {
    const res = await window.electronAPI.net.fetch(LATEST_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'PluralStar-Desktop' },
    });
    if (!res.ok) return { status: 'error', current };
    const latest = latestTagFrom(res.text);
    if (!latest || !parseVersion(current)) return { status: 'error', current };
    if (isNewerVersion(latest, current)) {
      publish({ current, latest });
      return { status: 'update', current, latest };
    }
    publish(null);
    return { status: 'current', current };
  } catch {
    return { status: 'error', current };
  }
};

export const checkForUpdate = (): Promise<UpdateCheckResult> => {
  if (inflight) return inflight;
  const p = runCheck();
  inflight = p;
  p.then(() => { if (inflight === p) inflight = null; }, () => { if (inflight === p) inflight = null; });
  return p;
};
