import {config} from '../config';
import {store, KEYS} from '../storage';
import {getDeviceSubId} from '../network/identity';
import {NetworkManager} from '../network/NetworkManager';
import {parseMediaKey} from '../network/mediaKey';
import {Member} from '../utils';
import {CloudService, CloudPlatform} from './cloudVault';
import {CLOUD_LINK_KEY, CloudLinkState, CloudRequest, CloudResponse, CloudTransport} from './cloudTypes';
import {splitDataUri} from './cloudCrypto';
import {watchCloudTriggers} from './cloudBoot';
import {deviceLabel} from '../network/platform';
import {GIF_B64_MAGIC} from '../network/types';
import {log} from '../utils/log';

const transport: CloudTransport = {
  async request(req: CloudRequest): Promise<CloudResponse> {
    const res = await window.electronAPI.net.fetchRaw(req.url, {
      method: req.method,
      headers: req.headers,
      bodyBase64: req.bodyBase64,
      timeoutMs: req.timeoutMs || config().cloud.transportTimeoutMs,
    });
    if (!res || (res.status === 0 && res.error)) throw new Error(res?.error || 'network error');
    return {status: res.status, headers: res.headers || {}, bodyBase64: res.bodyBase64 || ''};
  },
};

const AVATAR_MAX_PX = 256;
const PNG_B64_MAGIC = 'iVBOR';
const JPEG_QUALITY = 0.8;

const isAvatarKey = (key: string): boolean => {
  const mk = parseMediaKey(key);
  return !!mk && (mk.kind === 'av' || mk.kind === 'sysav');
};

const keepsTransparentPng = async (key: string): Promise<boolean> => {
  const mk = parseMediaKey(key);
  if (!mk || mk.kind !== 'av') return false;
  const members = await store.get<Member[]>(KEYS.members, []) || [];
  return members.some(m => m && m.id === mk.memberId && m.avatarTransparent === true);
};

const reencodeImage = async (dataUri: string, key: string): Promise<string> => {
  if (!splitDataUri(dataUri)) return dataUri;
  const b64 = dataUri.slice(dataUri.indexOf(',') + 1);
  if (b64.startsWith(GIF_B64_MAGIC)) return `data:image/gif;base64,${b64}`;
  const png = b64.startsWith(PNG_B64_MAGIC) && (await keepsTransparentPng(key));
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
        resolve(png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      } catch (e) {
        log.debug('cloud', e);
        resolve(dataUri);
      }
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
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
  limits: () => config().cloud,
};

export const CloudServices = new CloudService(platform);

let booted = false;
export const bootCloudServices = (): void => {
  if (booted) return;
  booted = true;
  watchCloudTriggers(CloudServices);
  window.addEventListener('focus', () => CloudServices.wake());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') CloudServices.wake();
  });
};
