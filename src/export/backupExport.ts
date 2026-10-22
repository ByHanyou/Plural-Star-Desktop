import { store, KEYS, chatMsgKey } from '../storage';
import { Member, ChatMessage, ExportPayload, fileSlug } from '../utils';
import { parallelMap } from '../utils/concurrency';
import { zipSync, strToU8 } from 'fflate';
import { encodeBase64, decodeBase64 } from '../network/bytes';
import { buildPluralKitExport } from './pluralKitExport';
import type { ExportCategories } from './categories';
import type { ImportCtx } from '../import/ctx';
import { log } from '../utils/log';
import { allCategories, BundleMember } from './backupCategories';

const extFromDataUri = (u: string): string => {
  const e = (/^data:image\/([\w+]+)/.exec(u)?.[1] || 'png').toLowerCase();
  return e === 'jpeg' ? 'jpg' : e === 'svg+xml' ? 'svg' : e;
};

const dataUriToBytes = (u: string): Uint8Array => decodeBase64(u.slice(u.indexOf(',') + 1));

const saveFilters = (t: ImportCtx['t']) => [
  { name: t('fileDialog.backup'), extensions: ['zip'] },
  { name: t('fileDialog.allFiles'), extensions: ['*'] },
];

const jsonSaveFilters = (t: ImportCtx['t']) => [
  { name: t('fileDialog.jsonFiles'), extensions: ['json'] },
  { name: t('fileDialog.allFiles'), extensions: ['*'] },
];

const today = (): string => new Date().toISOString().slice(0, 10);

const collectImages = async (members: Member[], field: 'avatar' | 'banner'): Promise<Record<string, string>> => {
  const out: Record<string, string> = {};
  const sources = members.flatMap(m => {
    const src = m[field];
    return src ? [{ id: m.id, src }] : [];
  });
  const results = await parallelMap(sources, async ({ id, src }) => {
    const data = src.startsWith('data:') ? src : await window.electronAPI.file.readAsBase64(src).catch(e => { log.debug('import', e); return null; });
    return data ? { id, data } : null;
  }, 6);
  for (const r of results) if (r) out[r.id] = r.data;
  return out;
};

export const handleExport = async (ctx: ImportCtx) => {
  const { showExportOptions, exportSel, channels, members, system, history, journal, settings, palettes, showStatus, t } = ctx;
  const cat: ExportCategories = showExportOptions ? exportSel : allCategories(false);

  const chatMessages: Record<string, ChatMessage[]> = {};
  if (cat.chat) {
    const fetched = await parallelMap(channels, async (ch) => ({id: ch.id, msgs: await store.get<ChatMessage[]>(chatMsgKey(ch.id))}), 6);
    for (const f of fetched) if (f && f.msgs && f.msgs.length > 0) chatMessages[f.id] = f.msgs;
  }

  const avatars = cat.avatars ? await collectImages(members, 'avatar') : {};
  const banners = cat.banners ? await collectImages(members, 'banner') : {};
  const membersForExport: Member[] = members.map(({ avatar: _a, banner: _b, ...rest }) => rest);

  const payload: ExportPayload = {
    _meta: { version: '1.2', app: 'Plural Star', exportedAt: new Date().toISOString() },
    system: cat.system ? system : undefined,
    members: cat.members ? membersForExport : [],
    frontHistory: cat.frontHistory ? history : [],
    journal: cat.journal ? journal : [],
    groups: cat.groups ? (await store.get(KEYS.groups) || []) : [],
    chatChannels: cat.chat ? channels : [],
    chatCategories: cat.chat ? (await store.get(KEYS.chatCategories) || []) : [],
    chatMessages: cat.chat ? chatMessages : {},
    settings: cat.settings ? settings : undefined,
    front: cat.frontHistory ? (await store.get(KEYS.front) || null) : undefined,
    palettes: cat.palettes ? palettes : [],
    avatars: {},
    banners: {},
    customMoods: cat.moods ? (settings?.customMoods || []) : [],
    customFieldDefs: cat.customFields ? (await store.get(KEYS.customFieldDefs) || []) : [],
    noteboards: cat.noteboards ? (await store.get(KEYS.noteboards) || []) : [],
    polls: cat.polls ? (await store.get(KEYS.polls) || []) : [],
    journalTemplates: cat.journalTemplates ? (await store.get(KEYS.journalTemplates) || []) : [],
    relationships: cat.groups ? (await store.get(KEYS.relationships) || []) : [],
    relationshipTypes: cat.groups ? (await store.get(KEYS.relationshipTypes) || []) : [],
    systemMapMembers: cat.groups ? (await store.get(KEYS.systemMapMembers) || []) : [],
    medical: cat.medical ? ((await store.get(KEYS.medical)) || undefined) : undefined,
    planner: cat.planner !== false ? ((await store.get(KEYS.planner)) || undefined) : undefined,
    systemMapPositions: cat.groups ? ((await store.get(KEYS.systemMapPositions)) || undefined) : undefined,
    whiteboard: cat.settings ? ((await store.get(KEYS.whiteboard)) || undefined) : undefined,
    customColors: cat.settings ? ((await store.get(KEYS.customColors)) || undefined) : undefined,
    shareSettings: cat.settings ? ((await store.get(KEYS.share)) || undefined) : undefined,
  };
  const mediaFiles: Record<string, Uint8Array> = {};
  const bundle = (kind: 'avatar' | 'banner', id: string, uri: string | undefined): string | undefined => {
    if (!uri || !uri.startsWith('data:')) return undefined;
    const name = `media/${kind}-${id}.${extFromDataUri(uri)}`;
    mediaFiles[name] = dataUriToBytes(uri);
    return name;
  };
  payload.members = payload.members.map(m => {
    const out: BundleMember = { ...m };
    const av = bundle('avatar', m.id, avatars[m.id]);
    if (av) out.avatar_media_path = av;
    const bn = bundle('banner', m.id, banners[m.id]);
    if (bn) out.banner_media_path = bn;
    return out;
  });

  const manifest = { app: 'Plural Star', format_version: '2.0', system_name: system?.name || '', export_date: new Date().toISOString() };
  const zipBytes = zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest)),
    'data.json': strToU8(JSON.stringify(payload)),
    ...mediaFiles,
  });
  const slug = fileSlug(system?.name || '');
  const defaultName = `${slug}-${fileSlug(t('share.backupFileSuffix'), 'backup')}-${today()}.zip`;
  const filePath = await window.electronAPI.dialog.saveFile(defaultName, saveFilters(t));
  if (!filePath) return;

  await window.electronAPI.file.writeBytes(filePath, encodeBase64(zipBytes));
  showStatus(t('share.statusBackupExported'));
};

export const handlePluralKitExport = async (ctx: ImportCtx) => {
  const { system, members, history, showStatus, t } = ctx;
  const json = JSON.stringify(buildPluralKitExport(system, members, history), null, 2);
  const slug = fileSlug(system?.name || '');
  const defaultName = `${slug}-pluralkit-${today()}.json`;
  const filePath = await window.electronAPI.dialog.saveFile(defaultName, jsonSaveFilters(t));
  if (!filePath) return;
  await window.electronAPI.file.writeBytes(filePath, encodeBase64(strToU8(json)));
  showStatus(t('share.pkExportDone'));
};
