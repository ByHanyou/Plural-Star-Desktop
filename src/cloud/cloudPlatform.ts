import {store, onStoreWrite, KEYS} from '../storage';
import {getDeviceSubId} from '../network/identity';
import {NetworkManager} from '../network/NetworkManager';
import {SYNC_STATE_KEY, MIRROR_CACHE_PREFIX} from '../network/types';
import {CloudService, CloudPlatform} from './cloudVault';
import {CLOUD_LINK_KEY, CloudLinkState, CloudRequest, CloudResponse, CloudTransport} from './cloudTypes';
import {splitDataUri} from './cloudCrypto';
import i18n from '../i18n/i18n';

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

const AVATAR_MAX_PX = 256;

const isAvatarKey = (key: string): boolean => key.startsWith('ps:media:av:') || key === 'ps:media:sysav';

const keepsTransparentPng = async (key: string): Promise<boolean> => {
  if (!key.startsWith('ps:media:av:')) return false;
  const id = key.slice('ps:media:av:'.length);
  const members = await store.get<{id: string; avatarTransparent?: boolean}[]>(KEYS.members, []) || [];
  return members.some(m => m && m.id === id && m.avatarTransparent === true);
};

const reencodeImage = async (dataUri: string, key: string): Promise<string> => {
  const parts = splitDataUri(dataUri);
  if (!parts) return dataUri;
  const b64 = dataUri.slice(dataUri.indexOf(',') + 1);
  if (b64.startsWith('R0lGO')) return `data:image/gif;base64,${b64}`;
  let png = false;
  try {
    png = b64.startsWith('iVBOR') && (await keepsTransparentPng(key));
  } catch {
    return dataUri;
  }
  const max = isAvatarKey(key) ? AVATAR_MAX_PX : Infinity;
  return new Promise<string>(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        if (!canvas.width || !canvas.height) return resolve(dataUri);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUri);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.8));
      } catch {
        resolve(dataUri);
      }
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
};

const deviceLabel = (): string => {
  try {
    const p = window.electronAPI.platform;
    if (p === 'darwin') return i18n.t('network.deviceMac');
    if (p === 'win32') return i18n.t('network.deviceWindows');
    if (p === 'linux') return i18n.t('network.deviceLinux');
    return i18n.t('network.deviceDesktop');
  } catch {
    return i18n.t('network.deviceDesktop');
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
  let wasOnline = false;
  NetworkManager.subscribe(s => {
    const online = s.status === 'online';
    const rising = online && !wasOnline;
    wasOnline = online;
    if (!rising) return;
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
