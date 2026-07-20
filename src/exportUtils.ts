import { Member } from './utils';

export const MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
export const extFromDataUri = (u: string): string => { const m = /^data:image\/([\w+]+)/.exec(u); const e = (m?.[1] || 'png').toLowerCase(); return e === 'jpeg' ? 'jpg' : e; };
export const dataUriToBytes = (u: string): Uint8Array => { const bin = atob(u.slice(u.indexOf(',') + 1)); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
export const u8ToBase64 = (bytes: Uint8Array): string => { let bin = ''; const chunk = 0x8000; for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]); return btoa(bin); };
export const bytesToDataUri = (bytes: Uint8Array, pathOrExt: string): string => { const ext = (pathOrExt.split('.').pop() || 'png').toLowerCase(); return `data:${MIME_BY_EXT[ext] || 'image/png'};base64,${u8ToBase64(bytes)}`; };
export const pkHexColor = (c?: string): string | null => {
  const h = String(c || '').replace(/^#/, '').trim().toLowerCase();
  return /^[0-9a-f]{6}$/.test(h) ? h : null;
};
export const pkPublicUrl = (u?: string): string | null =>
  (u && /^https?:\/\//i.test(u) && u.length <= 256) ? u : null;
export const pkShortId = (i: number): string => {
  let s = ''; let n = i;
  for (let k = 0; k < 5; k++) { s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
};
export const pkUuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
export const buildPluralKitExport = (system: any, members: Member[], history: any[]): Record<string, any> => {
  const realMembers = members.filter(m => !(m as any).isCustomFront && !(m as any).deleted);
  const idMap: Record<string, string> = {};
  realMembers.forEach((m, i) => { idMap[m.id] = pkShortId(i); });
  const pkMembers = realMembers.map(m => ({
    id: idMap[m.id],
    uuid: pkUuid(),
    name: (m.name || 'Member').slice(0, 100),
    display_name: null,
    color: pkHexColor(m.color),
    birthday: null,
    pronouns: m.pronouns ? m.pronouns.slice(0, 100) : null,
    avatar_url: pkPublicUrl(m.avatar) || m.pkAvatarUrl || null,
    webhook_avatar_url: null,
    banner: pkPublicUrl(m.banner) || m.pkBannerUrl || null,
    description: m.description ? m.description.slice(0, 1000) : null,
    created: new Date((m as any).createdAt || Date.now()).toISOString(),
    keep_proxy: m.pkKeepProxy ?? false,
    tts: false,
    autoproxy_enabled: false,
    message_count: 0,
    last_message_timestamp: null,
    proxy_tags: Array.isArray(m.pkProxyTags) ? m.pkProxyTags : [],
    privacy: null,
  }));
  const pkSwitches = (history || [])
    .map((h: any) => ({
      t: new Date(h.startTime).getTime(),
      members: (h.memberIds || []).map((id: string) => idMap[id]).filter(Boolean),
    }))
    .filter((sw: any) => sw.members.length > 0 && !isNaN(sw.t))
    .sort((a: any, b: any) => b.t - a.t)
    .map((sw: any) => ({ timestamp: new Date(sw.t).toISOString(), members: sw.members }));
  return {
    version: 1,
    name: system?.name ? system.name.slice(0, 100) : null,
    description: system?.description ? system.description.slice(0, 1000) : null,
    tag: null,
    pronouns: null,
    color: null,
    avatar_url: null,
    banner: null,
    members: pkMembers,
    switches: pkSwitches,
  };
};

export const spAvatarUrl = (m: any, fallbackUid?: string): string | undefined => {
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
  const CONC = 6;
  for (let k = 0; k < targets.length; k += CONC) {
    await Promise.all(targets.slice(k, k + CONC).map(async t => {
      const data = await (window as any).electronAPI.net.fetchImage(t.url).catch(() => null);
      if (data) out[t.i] = { ...out[t.i], avatar: data };
    }));
  }
  return out;
};
