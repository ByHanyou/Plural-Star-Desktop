import i18n from '../i18n/i18n';
import { store, KEYS } from '../storage';
import { AppSettings } from '../utils';
import { NetworkManager } from '../network/NetworkManager';
import { Friend, friendNotifyLevel } from '../network/types';
import { logError } from '../log';

const notify = (title: string, body: string) => {
  try {
    window.electronAPI?.notify(title, body);
  } catch (e) {
    logError('friendAlerts', e);
  }
};

const statusBody = (f: Friend): string => {
  const s = f.lastStatus;
  if (!s) return '';
  const lines: string[] = [];
  if (s.primary) lines.push(i18n.t('notification.primary', { names: s.primary, defaultValue: `Primary: ${s.primary}` }));
  if (s.coFront) lines.push(i18n.t('notification.coFront', { names: s.coFront, defaultValue: `Co-Front: ${s.coFront}` }));
  if (s.coConscious) lines.push(i18n.t('notification.coConscious', { names: s.coConscious, defaultValue: `Co-Conscious: ${s.coConscious}` }));
  if (lines.length === 0 && s.fronters) lines.push(s.fronters);
  if (s.mood) lines.push(i18n.t('notification.mood', { mood: s.mood, defaultValue: `Mood: ${s.mood}` }));
  return lines.join('\n');
};

const signature = (f: Friend): string => JSON.stringify(f.lastStatus ?? null);

/**
 * Read the toggle at alert time, not once at startup. It used to be captured in a
 * closure, so turning notifications off in Settings did nothing until the app was
 * restarted — alerts kept arriving for something the user had switched off.
 */
const notificationsAllowed = async (): Promise<boolean> => {
  try {
    const s = await store.get<AppSettings>(KEYS.settings, null);
    return !(s && s.notificationsEnabled === false);
  } catch (e) {
    logError('friendAlerts', e);
    return true;
  }
};

export const startFriendAlerts = (): (() => void) => {
  const seen = new Map<string, string>();
  let primed = false;

  return NetworkManager.subscribe(state => {
    const friends = state.friends.filter(f => f.kind !== 'device' && f.status === 'accepted');

    if (!primed) {
      for (const f of friends) seen.set(f.peerId, signature(f));
      primed = true;
      return;
    }

    for (const f of friends) {
      const sig = signature(f);
      const prev = seen.get(f.peerId);
      seen.set(f.peerId, sig);
      if (prev === undefined || prev === sig) continue;
      if (!state.enabled) continue;
      if (friendNotifyLevel(f) === 'off') continue;
      if (!f.lastStatus || !f.lastStatus.fronters) continue;
      const body = statusBody(f);
      if (!body) continue;
      const name = f.displayName;
      void notificationsAllowed().then(ok => {
        if (ok) notify(name, body);
      });
    }

    for (const peerId of [...seen.keys()]) {
      if (!friends.some(f => f.peerId === peerId)) seen.delete(peerId);
    }
  });
};
