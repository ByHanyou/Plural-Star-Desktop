import {store, onStoreWrite} from '../storage';
import {getDeviceSubId} from '../network/identity';
import {NetworkManager} from '../network/NetworkManager';
import {SYNC_STATE_KEY, MIRROR_CACHE_PREFIX} from '../network/types';
import {CloudService, CloudPlatform} from './cloudVault';
import {CLOUD_LINK_KEY, CloudLinkState, CloudRequest, CloudResponse, CloudTransport} from './cloudTypes';
import {splitDataUri} from './cloudCrypto';

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

const reencodeImage = (dataUri: string): Promise<string> => new Promise(resolve => {
  const parts = splitDataUri(dataUri);
  if (!parts) return resolve(dataUri);
  const mime = parts.mime.toLowerCase();
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

let booted = false;
export const bootCloudServices = (): void => {
  if (booted) return;
  booted = true;
  CloudServices.init().catch(() => {});
  onStoreWrite((key, removed) => {
    if (!key.startsWith('ps:') || key === CLOUD_LINK_KEY || key === SYNC_STATE_KEY || key.startsWith(MIRROR_CACHE_PREFIX)) return;
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
  window.addEventListener('focus', () => CloudServices.wake());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') CloudServices.wake();
  });
};
