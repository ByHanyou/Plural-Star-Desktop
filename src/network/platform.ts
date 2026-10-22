import i18n from '../i18n/i18n';
import { parseRaw, store } from '../storage';
import { mirrorThumbDataUrl } from '../utils/image';
import { withTimeout } from '../utils/concurrency';
import type { MediaAdapter, NetworkAdapters, PlatformAdapter, StorageAdapter } from './adapters';
import { clearMirrorGifsFor, deleteMirrorGifKeys, getMirrorGif, listMirrorGifKeys, mirrorGifKey, putMirrorGif } from './mirrorGifStore';
import { mirrorGifDataB64, mirrorGifHash } from './mirror/gifHash';

const MIRROR_GIF_URL_CACHE_CHARS = 48 * 1024 * 1024;

const getRaw = async (key: string): Promise<string | null> => {
  const v = await window.electronAPI.store.get(key);
  if (v === null || v === undefined) return null;
  return JSON.stringify(v);
};

const storage: StorageAdapter = {
  getRaw,
  async getMany(keys) {
    const out: Record<string, string | null> = {};
    for (const k of keys) out[k] = await getRaw(k);
    return out;
  },
  setRaw: (key, raw) => store.setRaw(key, raw),
  async setMany(entries) {
    const updates: Record<string, unknown> = {};
    for (const k in entries) updates[k] = parseRaw(entries[k]);
    await window.electronAPI.store.setBatch(updates);
  },
  remove: key => window.electronAPI.store.remove(key),
  async removeMany(keys) {
    for (const k of keys) await window.electronAPI.store.remove(k);
  },
  get: (key, fallback) => store.get(key, fallback),
  set: (key, value) => store.set(key, value),
  async allKeys() {
    const keys = await window.electronAPI.store.allKeys();
    return keys || [];
  },
};

const gifUrls: Map<string, string> = new Map();
let gifUrlChars = 0;

const dropGifUrl = (key: string): void => {
  const url = gifUrls.get(key);
  if (url === undefined) return;
  gifUrls.delete(key);
  gifUrlChars = Math.max(0, gifUrlChars - url.length);
};

const gifUrl = async (key: string): Promise<string | null> => {
  const hit = gifUrls.get(key);
  if (hit) {
    gifUrls.delete(key);
    gifUrls.set(key, hit);
    return hit;
  }
  const b64 = await getMirrorGif(key);
  if (!b64) return null;
  const url = `data:image/gif;base64,${b64}`;
  gifUrls.set(key, url);
  gifUrlChars += url.length;
  while (gifUrlChars > MIRROR_GIF_URL_CACHE_CHARS && gifUrls.size > 1) {
    const first = gifUrls.keys().next().value;
    if (first === undefined) break;
    dropGifUrl(first);
  }
  return url;
};

const media: MediaAdapter = {
  localPrefix: 'data:',
  isSource: (v): v is string => typeof v === 'string' && v.startsWith('data:'),
  signature: src => (src.startsWith('data:') ? mirrorGifHash(src) : src),
  thumb: (src, maxDim) => mirrorThumbDataUrl(src, maxDim),
  gifHash: src => {
    const b64 = mirrorGifDataB64(src);
    return Promise.resolve(b64 ? mirrorGifHash(b64) : null);
  },
  gifBase64: src => Promise.resolve(mirrorGifDataB64(src)),
  async gifsPresent(peerId, feature, wants) {
    const have = new Set(await listMirrorGifKeys(peerId, feature));
    const out = new Set<string>();
    wants.forEach((h, id) => {
      if (have.has(mirrorGifKey(peerId, feature, id, h))) out.add(id);
    });
    return out;
  },
  async gifUris(peerId, feature, wants) {
    const out: Record<string, string> = {};
    for (const [id, h] of wants) {
      const url = await gifUrl(mirrorGifKey(peerId, feature, id, h));
      if (url) out[id] = url;
    }
    return out;
  },
  async pruneGifs(peerId, feature, wants) {
    const keep = new Set<string>();
    wants.forEach((h, id) => keep.add(mirrorGifKey(peerId, feature, id, h)));
    const stale = (await listMirrorGifKeys(peerId, feature)).filter(k => !keep.has(k));
    for (const k of stale) dropGifUrl(k);
    await deleteMirrorGifKeys(stale);
  },
  saveGif: (peerId, feature, id, h, b64) => putMirrorGif(mirrorGifKey(peerId, feature, id, h), b64),
  async clearGifs(peerId) {
    await clearMirrorGifsFor(peerId);
    const prefix = `${peerId}|`;
    for (const k of [...gifUrls.keys()]) if (k.startsWith(prefix)) dropGifUrl(k);
  },
  ref: val => Promise.resolve(val.startsWith('data:') ? val : null),
  materialize: value => Promise.resolve(value),
  readDataUri: () => Promise.resolve(null),
  saveMemberImage: (_kind, _memberId, dataUri) => Promise.resolve(dataUri),
  saveSystemImage: (_kind, dataUri) => Promise.resolve(dataUri),
  saveFieldImage: (_memberId, _fieldId, dataUri) => Promise.resolve(dataUri),
  saveChatMedia: (_msgId, dataUri) => Promise.resolve(dataUri),
  deleteChatMedia: () => Promise.resolve(),
};

const DEVICE_LABEL_KEY: Record<string, string> = {
  darwin: 'network.deviceMac',
  win32: 'network.deviceWindows',
  linux: 'network.deviceLinux',
};

export const deviceLabel = (): string => i18n.t(DEVICE_LABEL_KEY[window.electronAPI.platform] || 'network.deviceDesktop');

const platform: PlatformAdapter = {
  deviceLabel,
  unnamedDevice: () => i18n.t('network.unnamedDevice'),
  unnamedFriend: () => i18n.t('network.unnamedFriend'),
  defaultSystemName: () => i18n.t('network.defaultSystemName'),
  http: (url, req, timeoutMs) => withTimeout(window.electronAPI.net.fetch(url, req), timeoutMs, 'request'),
  onForeground(fn) {
    window.addEventListener('focus', fn);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) fn();
    });
  },
  waitForStorage: () => Promise.resolve(true),
  push: null,
};

export const adapters: NetworkAdapters = {storage, media, platform};
