import i18n from '../i18n/i18n';
import { frontShareLines } from '../network/frontShare';
import { NetworkManager } from '../network/NetworkManager';
import { Friend } from '../network/types';
import { friendNotifyLevel, isAcceptedFriend } from '../network/friendState';
import { notify, notificationsEnabled } from './alerts';
import { logError } from '../utils/log';

const signature = (f: Friend): string => JSON.stringify(f.lastStatus ?? null);

export const startFriendAlerts = (): (() => void) => {
  const seen = new Map<string, string>();
  let primed = false;

  return NetworkManager.subscribe(state => {
    const friends = state.friends.filter(isAcceptedFriend);

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
      const s = f.lastStatus;
      if (!s || !s.fronters) continue;
      const body = frontShareLines(s, i18n.t).join('\n');
      const name = f.displayName;
      notificationsEnabled().then(ok => { if (ok) notify('friendAlerts', name, body); }).catch(e => logError('friendAlerts', e));
    }

    for (const peerId of [...seen.keys()]) {
      if (!friends.some(f => f.peerId === peerId)) seen.delete(peerId);
    }
  });
};
