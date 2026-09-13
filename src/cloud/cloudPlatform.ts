// Cloud Services: the Desktop side of CloudPlatform. This file is the one part
// of src/cloud that differs between the repos; everything it hands to the
// shared engine is bytes, strings and store keys.

import {store, onStoreWrite} from '../storage';
import {getDeviceSubId} from '../network/identity';
import {NetworkManager} from '../network/NetworkManager';
import {SYNC_STATE_KEY, MIRROR_CACHE_PREFIX} from '../network/types';
import {CloudService, CloudPlatform} from './cloudVault';
import {CLOUD_LINK_KEY, CloudLinkState, CloudRequest, CloudResponse, CloudTransport} from './cloudTypes';
import {splitDataUri} from './cloudCrypto';

// The renderer's IPC fetch is text-only and ciphertext is not text, so the
// main process does the request and bytes cross the IPC as base64 (main.ts,
// net:fetchRaw).
const transport: CloudTransport = {
  async request(req: CloudRequest): Promise<CloudResponse> {
    const res = await window.electronAPI.net.fetchRaw(req.url, {
      method: req.method,
      headers: req.headers,
      bodyBase64: req.bodyBase64,
      timeoutMs: req.timeoutMs,
    });
    if (!res || (res.status === 0 && res.error)) throw new Error(res?.error || 'network error');
    return {status: res.status, headers: res.headers || {}, bodyBase64: res.bodyBase64 || ''};
  },
};

// Spec 7.3: JPEG quality 80, longest side unchanged, GIF passed through. PNG is
// passed through as well: a member's transparent avatar is a feature the app
// exposes (avatarTransparent), and a JPEG has no alpha channel to keep it.
const reencodeImage = (dataUri: string): Promise<string> => new Promise(resolve => {
  const parts = splitDataUri(dataUri);
  if (!parts) return resolve(dataUri);
  const mime = parts.mime.toLowerCase();
  // A JPEG is re-encoded like everything else (7.3 says quality 80, not "as
  // is"); only GIF, and PNG per deviation 2, pass through.
  if (mime === 'image/gif' || mime === 'image/png') return resolve(dataUri);
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUri);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    } catch {
      resolve(dataUri);
    }
  };
  img.onerror = () => resolve(dataUri);
  img.src = dataUri;
});

const deviceLabel = (): string => {
  try {
    const p = window.electronAPI.platform;
    if (p === 'darwin') return 'Mac Desktop';
    if (p === 'win32') return 'Windows Desktop';
    if (p === 'linux') return 'Linux Desktop';
    return 'Desktop';
  } catch {
    return 'Desktop';
  }
};

const platform: CloudPlatform = {
  transport,
  relay: () => NetworkManager.cloudRelay(),
  snapshot: () => NetworkManager.cloudSnapshot(),
  apply: keys => NetworkManager.applyCloudSnapshot(keys),
  remove: key => NetworkManager.removeCloudKey(key),
  adoptIdentity: (identityRaw, friendsRaw) => NetworkManager.adoptCloudIdentity(identityRaw, friendsRaw),
  mergeFriends: (friendsRaw, tombstonesRaw) => NetworkManager.mergeCloudFriends(friendsRaw, tombstonesRaw),
  reencodeImage,
  localHash: raw => NetworkManager.cloudLocalHash(raw),
  loadLink: () => store.get<CloudLinkState>(CLOUD_LINK_KEY, null),
  saveLink: async state => {
    if (state) await store.set(CLOUD_LINK_KEY, state);
    else await store.remove(CLOUD_LINK_KEY);
  },
  deviceSubId: () => getDeviceSubId(),
  deviceLabel,
  now: () => Date.now(),
};

export const CloudServices = new CloudService(platform);

// Called once from App.tsx after NetworkManager.init(). Feature detection and
// the wake check ride the relay's own connection state, so nothing about the
// cloud is polled while the app is offline.
let booted = false;
export const bootCloudServices = (): void => {
  if (booted) return;
  booted = true;
  CloudServices.init().catch(() => {});
  // Every Save also saves to the cloud (spec 8.1). The engine's own state
  // writes and the device-sync bookkeeping are not saves.
  onStoreWrite((key, removed) => {
    if (!key.startsWith('ps:') || key === CLOUD_LINK_KEY || key === SYNC_STATE_KEY || key.startsWith(MIRROR_CACHE_PREFIX)) return;
    // A store.remove is the one deliberate removal; anything else that turns
    // up missing is repaired from the vault on the next check (spec 8.2).
    if (removed) CloudServices.noteRemoved(key);
    CloudServices.schedulePush();
  });
  NetworkManager.subscribe(s => {
    if (s.status !== 'online') return;
    CloudServices.refreshAvailability()
      .then(ok => {
        if (ok) CloudServices.wake();
      })
      .catch(() => {});
  });
  // Desktop has no AppState; a window coming back to the front is the wake.
  window.addEventListener('focus', () => CloudServices.wake());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') CloudServices.wake();
  });
};
