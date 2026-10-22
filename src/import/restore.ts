import { store, KEYS, chatMsgKey } from '../storage';
import { Member, HistoryEntry, MedicalData, PlannerData, AppSettings, ExportPayload, asRecord } from '../utils';
import { isPluralSpaceExport, mergeHistoryEntries } from './convert';
import { isNativeBackup } from './detect';
import { importNameKey } from './importNames';
import { unzipSync, strFromU8 } from 'fflate';
import { bytesToDataUri } from './importMedia';
import { ImportCtx, importErrorText } from './ctx';
import { isImportStopped } from './progress';
import { asArray } from './formats';
import { pickBrowserFile } from '../utils/filePick';
import type { BackupCategory, BundleMember } from '../export/backupCategories';

const sizeOf = (v: object | undefined): number => (v ? Object.keys(v).length : 0);

export const restoreAvailability = (d: ExportPayload, k: BackupCategory): { avail: boolean; count: number | null } => {
  const planned = (d.planner?.appointments?.length || 0) + (d.planner?.reminders?.length || 0);
  switch (k) {
    case 'system': return { avail: !!d.system, count: null };
    case 'members': return { avail: !!d.members, count: d.members?.length ?? null };
    case 'avatars': return { avail: sizeOf(d.avatars) > 0 || !!d.members?.some(m => m.avatar), count: d.avatars ? sizeOf(d.avatars) : d.members?.filter(m => m.avatar).length || 0 };
    case 'banners': return { avail: sizeOf(d.banners) > 0 || !!d.members?.some(m => m.banner), count: d.banners ? sizeOf(d.banners) : d.members?.filter(m => m.banner).length || 0 };
    case 'frontHistory': return { avail: !!d.frontHistory, count: d.frontHistory?.length ?? null };
    case 'journal': return { avail: !!d.journal, count: d.journal?.length ?? null };
    case 'groups': return { avail: !!d.groups?.length, count: d.groups?.length ?? null };
    case 'chat': return { avail: !!d.chatChannels?.length, count: d.chatChannels?.length ?? null };
    case 'moods': {
      const n = d.customMoods?.length || d.settings?.customMoods?.length || 0;
      return { avail: n > 0, count: n };
    }
    case 'palettes': return { avail: !!d.palettes?.length, count: d.palettes?.length ?? null };
    case 'settings': return { avail: !!d.settings, count: null };
    case 'customFields': return { avail: !!d.customFieldDefs?.length, count: d.customFieldDefs?.length || 0 };
    case 'noteboards': return { avail: !!d.noteboards?.length, count: d.noteboards?.length || 0 };
    case 'planner': return { avail: planned > 0, count: planned };
    case 'medical': return { avail: !!d.medical, count: null };
    case 'polls': return { avail: !!d.polls?.length, count: d.polls?.length || 0 };
    case 'journalTemplates': return { avail: !!d.journalTemplates?.length, count: d.journalTemplates?.length || 0 };
  }
};

const stringMap = (v: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(asRecord(v) || {})) if (typeof val === 'string') out[k] = val;
  return out;
};

export const handlePickBackup = async (ctx: ImportCtx) => {
  const { showStatus, t, setRestoreData, setRestoreFile } = ctx;
  try {
    pickBrowserFile('.zip,.json,.txt', async file => {
      try {
        let parsed: unknown;
        let zipMedia: { avatars: Record<string, string>; banners: Record<string, string> } | null = null;
        if (file.name.toLowerCase().endsWith('.zip')) {
          const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
          const dj = files['data.json'];
          if (!dj) { showStatus(t('share.statusBackupMissingData'), true); return; }
          parsed = JSON.parse(strFromU8(dj));
          const rec = asRecord(parsed);
          const avatars = stringMap(rec?.avatars);
          const banners = stringMap(rec?.banners);
          for (const m of asArray<BundleMember>(rec?.members)) {
            if (m.avatar_media_path && files[m.avatar_media_path]) avatars[m.id] = bytesToDataUri(files[m.avatar_media_path], m.avatar_media_path);
            if (m.banner_media_path && files[m.banner_media_path]) banners[m.id] = bytesToDataUri(files[m.banner_media_path], m.banner_media_path);
          }
          zipMedia = { avatars, banners };
        } else {
          const text = await file.text();
          parsed = JSON.parse(text);
        }
        if (!asRecord(parsed)) {
          showStatus(t('share.statusNotBackup'), true);
          return;
        }

        if (isPluralSpaceExport(parsed)) {
          showStatus(t('share.statusError', {msg: t('share.psUseSection')}), true);
          return;
        }
        if (!isNativeBackup(parsed)) {
          showStatus(t('share.statusNotBackup'), true);
          return;
        }
        const data: ExportPayload = parsed;
        if (zipMedia) {
          data.avatars = zipMedia.avatars;
          data.banners = zipMedia.banners;
        }

        setRestoreData(data);
        setRestoreFile(file.name);
      } catch (e) {
        showStatus(t('share.statusImportError', {msg: importErrorText(e, t)}), true);
      }
    });
  } catch (e) {
    showStatus(t('share.statusImportError', {msg: importErrorText(e, t)}), true);
  }
};

const restoreMergeById = <T extends { id?: unknown }>(existing: T[] | null | undefined, incoming: T[], sameKey?: (a: T, b: T) => boolean): T[] => {
  const out = [...(existing || [])];
  incoming.forEach(inc => {
    if (!inc) return;
    const at = out.findIndex(e => !!e && ((inc.id != null && e.id === inc.id) || (sameKey ? sameKey(e, inc) : false)));
    if (at >= 0) out[at] = { ...out[at], ...inc, id: out[at].id ?? inc.id };
    else out.push(inc);
  });
  return out;
};

const sameName = (a: { name?: string }, b: { name?: string }): boolean => importNameKey(a.name) === importNameKey(b.name);

const samePost = (a: { timestamp: number; authorId: string; content: string }, b: { timestamp: number; authorId: string; content: string }): boolean =>
  a.timestamp === b.timestamp && a.authorId === b.authorId && a.content === b.content;

const appendNew = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
  const seen = new Set(existing.map(x => x.id));
  return [...existing, ...incoming.filter(x => !seen.has(x.id))];
};

const mergedWithStored = async <T extends { id?: unknown }>(upd: boolean, key: string, incoming: T[], sameKey?: (a: T, b: T) => boolean): Promise<T[]> =>
  upd ? restoreMergeById(await store.getStrict<T[]>(key, []) || [], incoming, sameKey) : incoming;

const appendedToStored = async <T extends { id: string }>(merge: boolean, key: string, incoming: T[]): Promise<T[]> =>
  merge ? appendNew(await store.getStrict<T[]>(key, []) || [], incoming) : incoming;

export const handleRestore = async (ctx: ImportCtx) => {
  const { restoreData, setImporting, restoreSel, mergeLogs, importMode, showStatus, setRestoreData, setRestoreFile, onUpdate, t } = ctx;
  if (!restoreData) return;
  setImporting(true);
  try {
    const batch: Record<string, unknown> = {};
    const upd = importMode === 'update';
    const merging = mergeLogs || upd;
    if (restoreSel.system && restoreData.system) batch[KEYS.system] = restoreData.system;

    ctx.control?.beginFromLabel(t('share.progressSavingMembers'));
    if (restoreSel.members && restoreData.members) {
      const avatarMap = new Map(Object.entries(restoreData.avatars || {}));
      const bannerMap = new Map(Object.entries(restoreData.banners || {}));
      const importedMembers: Member[] = restoreData.members.map(m => {
        let result: Member = m;
        if (!restoreSel.avatars) { const { avatar, ...rest } = result; result = rest; }
        else {
          const resolvedAvatar = avatarMap.get(m.id) ?? m.avatar;
          if (resolvedAvatar) result = { ...result, avatar: resolvedAvatar };
        }
        if (!restoreSel.banners) { const { banner, ...rest } = result; result = rest; }
        else {
          const resolvedBanner = bannerMap.get(m.id) ?? m.banner;
          if (resolvedBanner) result = { ...result, banner: resolvedBanner };
        }
        return result;
      });
      if (upd) {
        const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
        const out = [...existing];
        const claimed = new Set<string>();
        importedMembers.forEach(im => {
          if (!im || !im.id) return;
          let at = out.findIndex(m => m.id === im.id);
          if (at < 0) {
            const nm = String(im.name || '').trim().toLowerCase();
            at = nm ? out.findIndex(m => !claimed.has(m.id) && !m.isCustomFront && !m.isFacet && String(m.name || '').trim().toLowerCase() === nm) : -1;
          }
          if (at >= 0) {
            const local = out[at];
            const incDeleted = !!im.deleted;
            const deleted = incDeleted && !!local.deleted;
            const archived = deleted ? true : (incDeleted ? !!local.archived : (im.archived ?? local.archived ?? false));
            out[at] = { ...local, ...im, id: local.id, deleted, archived };
            claimed.add(local.id);
          }
          else { out.push(im); claimed.add(im.id); }
        });
        batch[KEYS.members] = out;
      } else {
        batch[KEYS.members] = importedMembers;
      }
    } else if ((restoreSel.avatars || restoreSel.banners) && !restoreSel.members) {
      const avatarMap = new Map(restoreSel.avatars ? Object.entries(restoreData.avatars || {}) : []);
      const bannerMap = new Map(restoreSel.banners ? Object.entries(restoreData.banners || {}) : []);
      if (restoreSel.avatars) {
        for (const m of (restoreData.members || [])) { if (m.avatar && !avatarMap.get(m.id)) avatarMap.set(m.id, m.avatar); }
      }
      if (restoreSel.banners) {
        for (const m of (restoreData.members || [])) { if (m.banner && !bannerMap.get(m.id)) bannerMap.set(m.id, m.banner); }
      }
      if (avatarMap.size > 0 || bannerMap.size > 0) {
        const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
        const updated = existing.map(m => {
          const avatar = avatarMap.get(m.id);
          const banner = bannerMap.get(m.id);
          return avatar || banner ? { ...m, ...(avatar ? { avatar } : {}), ...(banner ? { banner } : {}) } : m;
        });
        batch[KEYS.members] = updated;
      }
    }

    ctx.control?.beginFromLabel(t('share.progressJournal'));
    if (restoreSel.journal && restoreData.journal) {
      batch[KEYS.journal] = await appendedToStored(merging, KEYS.journal, restoreData.journal);
    }

    ctx.control?.beginFromLabel(t('share.progressHistory'));
    if (restoreSel.frontHistory && restoreData.frontHistory) {
      if (merging) {
        const existing = await store.getStrict<HistoryEntry[]>(KEYS.history, []) || [];
        batch[KEYS.history] = mergeHistoryEntries(restoreData.frontHistory, existing);
      } else {
        batch[KEYS.history] = restoreData.frontHistory;
        if (restoreData.front !== undefined) batch[KEYS.front] = restoreData.front;
      }
    }

    if (restoreSel.groups && restoreData.groups) batch[KEYS.groups] = await mergedWithStored(upd, KEYS.groups, restoreData.groups, sameName);
    if (restoreSel.groups && restoreData.relationships) batch[KEYS.relationships] = await mergedWithStored(upd, KEYS.relationships, restoreData.relationships);
    if (restoreSel.groups && restoreData.relationshipTypes) batch[KEYS.relationshipTypes] = await mergedWithStored(upd, KEYS.relationshipTypes, restoreData.relationshipTypes);
    if (restoreSel.groups && restoreData.systemMapMembers) batch[KEYS.systemMapMembers] = upd ? [...new Set([...(await store.getStrict<string[]>(KEYS.systemMapMembers, []) || []), ...restoreData.systemMapMembers])] : restoreData.systemMapMembers;
    if (restoreSel.groups && restoreData.systemMapPositions) batch[KEYS.systemMapPositions] = upd ? { ...(await store.getStrict<Record<string, {x: number; y: number}>>(KEYS.systemMapPositions) || {}), ...restoreData.systemMapPositions } : restoreData.systemMapPositions;
    if (restoreSel.medical !== false && restoreData.medical) {
      if (upd) {
        const cur: Partial<MedicalData> = (await store.getStrict<MedicalData>(KEYS.medical)) || {};
        const inc = restoreData.medical;
        batch[KEYS.medical] = {
          ...cur,
          ...inc,
          medications: restoreMergeById(cur.medications, Array.isArray(inc.medications) ? inc.medications : []),
          appointments: restoreMergeById(cur.appointments, Array.isArray(inc.appointments) ? inc.appointments : []),
          history: restoreMergeById(cur.history, Array.isArray(inc.history) ? inc.history : []),
        };
      } else {
        batch[KEYS.medical] = restoreData.medical;
      }
    }
    if (restoreSel.settings && restoreData.whiteboard) batch[KEYS.whiteboard] = restoreData.whiteboard;
    if (restoreSel.settings && restoreData.customColors) batch[KEYS.customColors] = restoreData.customColors;
    if (restoreSel.settings && restoreData.shareSettings) batch[KEYS.share] = restoreData.shareSettings;

    if (restoreSel.chat) {
      if (restoreData.chatChannels) batch[KEYS.chatChannels] = await mergedWithStored(upd, KEYS.chatChannels, restoreData.chatChannels, sameName);
      if (restoreData.chatCategories) batch[KEYS.chatCategories] = await mergedWithStored(upd, KEYS.chatCategories, restoreData.chatCategories, sameName);
      if (restoreData.chatMessages) {
        for (const [chId, msgs] of Object.entries(restoreData.chatMessages)) {
          batch[chatMsgKey(chId)] = await appendedToStored(merging, chatMsgKey(chId), msgs);
        }
      }
    }

    if (restoreSel.settings || restoreSel.moods) {
      const currentSettings: Partial<AppSettings> = await store.getStrict<AppSettings>(KEYS.settings) || {};
      let newSettings: Partial<AppSettings> = { ...currentSettings };
      if (restoreSel.settings && restoreData.settings) {
        newSettings = { ...restoreData.settings };
        if (!restoreSel.moods) newSettings.customMoods = currentSettings.customMoods || [];
      }
      if (restoreSel.moods) {
        newSettings.customMoods = restoreData.customMoods || restoreData.settings?.customMoods || [];
      }
      batch[KEYS.settings] = newSettings;
    }

    if (restoreSel.palettes && restoreData.palettes) batch[KEYS.palettes] = await mergedWithStored(upd, KEYS.palettes, restoreData.palettes, sameName);
    if (restoreSel.customFields && restoreData.customFieldDefs) batch[KEYS.customFieldDefs] = await mergedWithStored(upd, KEYS.customFieldDefs, restoreData.customFieldDefs, sameName);
    if (restoreSel.noteboards && restoreData.noteboards) batch[KEYS.noteboards] = await mergedWithStored(upd, KEYS.noteboards, restoreData.noteboards, samePost);
    if (restoreSel.planner !== false && restoreData.planner) {
      if (upd) {
        const cur: Partial<PlannerData> = (await store.getStrict<PlannerData>(KEYS.planner)) || {};
        const inc = restoreData.planner;
        batch[KEYS.planner] = {
          ...cur,
          ...inc,
          appointments: restoreMergeById(cur.appointments, Array.isArray(inc.appointments) ? inc.appointments : []),
          reminders: restoreMergeById(cur.reminders, Array.isArray(inc.reminders) ? inc.reminders : []),
        };
      } else {
        batch[KEYS.planner] = restoreData.planner;
      }
    }
    if (restoreSel.polls && restoreData.polls) {
      batch[KEYS.polls] = await appendedToStored(merging, KEYS.polls, restoreData.polls);
    }
    if (restoreSel.journalTemplates && restoreData.journalTemplates) batch[KEYS.journalTemplates] = await mergedWithStored(upd, KEYS.journalTemplates, restoreData.journalTemplates, sameName);

    if (Object.keys(batch).length === 0) {
      showStatus(t('share.statusNothingSelected'));
      return;
    }

    await store.setBatch(batch);

    showStatus(t('share.statusRestoreComplete'));
    setRestoreData(null);
    setRestoreFile(null);
    onUpdate();
  } catch (e) {
    if (isImportStopped(e)) {
      showStatus(t('share.importStopped', {
        count: ctx.control?.completed.length ?? 0,
      }));
    } else {
      showStatus(t('share.statusRestoreError', {msg: importErrorText(e, t)}), true);
    }
  } finally {
    setImporting(false);
  }
};
