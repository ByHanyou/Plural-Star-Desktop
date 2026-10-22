import { Member } from '../utils';
import { encodeBase64 } from '../network/bytes';
import { parallelMap } from '../utils/concurrency';
import { log } from '../utils/log';

export const zipEntry = (files: Record<string, Uint8Array>, name: string): Uint8Array | undefined =>
  Object.prototype.hasOwnProperty.call(files, name) ? files[name] : undefined;

const MIME_BY_EXT = new Map([['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['gif', 'image/gif'], ['webp', 'image/webp'], ['svg', 'image/svg+xml']]);
export const bytesToDataUri = (bytes: Uint8Array, pathOrExt: string): string => {
  const ext = (pathOrExt.split('.').pop() || 'png').toLowerCase();
  return `data:${MIME_BY_EXT.get(ext) ?? 'image/png'};base64,${encodeBase64(bytes)}`;
};

export const spAvatarUrl = (m: { avatarUrl?: unknown; avatarUuid?: unknown; uid?: unknown } | null | undefined, fallbackUid?: string): string | undefined => {
  const url = String(m?.avatarUrl || '').trim();
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/avatars/')) return 'https://spaces.apparyllis.com' + url;
  const uuid = String(m?.avatarUuid || '').trim();
  const uid = String(m?.uid || fallbackUid || '').trim();
  if (uuid && uid) return `https://spaces.apparyllis.com/avatars/${uid}/${uuid}`;
  return undefined;
};
export const inlineRemoteAvatars = async (mem: Member[]): Promise<Member[]> => {
  const out = [...mem];
  const targets = out.map((m, i) => ({ i, url: String(m.avatar || '') })).filter(t => /^https?:\/\//i.test(t.url));
  await parallelMap(targets, async t => {
    const data = await window.electronAPI.net.fetchImage(t.url).catch(e => { log.debug('export', e); return null; });
    if (data) out[t.i] = { ...out[t.i], avatar: data };
  }, 6);
  return out;
};
