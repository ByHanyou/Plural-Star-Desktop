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

export const startFriendAlerts = (): (() => void) => {
  const seen = new Map<string, string>();
  let primed = false;
  let enabled = true;

  store
    .get<AppSettings>(KEYS.settings, null)
    .then(s => {
      if (s && s.notificationsEnabled === false) enabled = false;
    })
    .catch(e => logError('friendAlerts', e));

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
      if (!enabled || !state.enabled) continue;
      if (friendNotifyLevel(f) === 'off') continue;
      if (!f.lastStatus || !f.lastStatus.fronters) continue;
      const body = statusBody(f);
      if (body) notify(f.displayName, body);
    }

    for (const peerId of [...seen.keys()]) {
      if (!friends.some(f => f.peerId === peerId)) seen.delete(peerId);
    }
  });
};
