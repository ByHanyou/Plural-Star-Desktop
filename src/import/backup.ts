import { store, KEYS, chatMsgKey } from '../storage';
import { Member, ExportPayload, parallelMap } from '../utils';
import { detectPluralSpace } from '../importers';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { extFromDataUri, dataUriToBytes, u8ToBase64, bytesToDataUri, buildPluralKitExport } from '../exportUtils';
import { ImportCtx } from './ctx';

export const handleExport = async (ctx: ImportCtx) => {
  const { showExportOptions, exportSel, channels, members, system, history, journal, settings, palettes, showStatus } = ctx;
    const cat = showExportOptions ? exportSel : {
      system: true, members: true, avatars: true, banners: true, frontHistory: true, journal: true,
      groups: true, chat: true, moods: true, palettes: true, settings: true,
      customFields: true, noteboards: true, polls: true, journalTemplates: true,
    };

    const chatMessages: Record<string, any[]> = {};
    if (cat.chat) {
      const fetched = await parallelMap(channels, async (ch) => ({id: ch.id, msgs: await store.get<any[]>(chatMsgKey(ch.id))}), 6);
      for (const f of fetched) if (f && f.msgs && f.msgs.length > 0) chatMessages[f.id] = f.msgs;
    }

    const avatars: Record<string, string> = {};
    if (cat.avatars) {
      const withAvatars = members.filter(m => !!m.avatar);
      const results = await parallelMap(withAvatars, async (m) => {
        if (m.avatar!.startsWith('data:')) return {id: m.id, data: m.avatar!};
        const dataUri = await window.electronAPI.file.readAsBase64(m.avatar!).catch(() => null);
        return dataUri ? {id: m.id, data: dataUri} : null;
      }, 6);
      for (const r of results) if (r) avatars[r.id] = r.data;
    }
    const banners: Record<string, string> = {};
    if (cat.banners) {
      const withBanners = members.filter(m => !!m.banner);
      const results = await parallelMap(withBanners, async (m) => {
        if (m.banner!.startsWith('data:')) return {id: m.id, data: m.banner!};
        const dataUri = await window.electronAPI.file.readAsBase64(m.banner!).catch(() => null);
        return dataUri ? {id: m.id, data: dataUri} : null;
      }, 6);
      for (const r of results) if (r) banners[r.id] = r.data;
    }
    const membersForExport = members.map(({ avatar: _a, banner: _b, ...rest }) => rest as Member);

    const payload: ExportPayload = {
      _meta: { version: '1.2', app: 'Plural Star', exportedAt: new Date().toISOString() },
      system: cat.system ? system : undefined as any,
      members: cat.members ? membersForExport : [],
      frontHistory: cat.frontHistory ? history : [],
      journal: cat.journal ? journal : [],
      groups: cat.groups ? (await store.get(KEYS.groups) || []) : [],
      chatChannels: cat.chat ? channels : [],
      chatMessages: cat.chat ? chatMessages : {},
      settings: cat.settings ? settings : undefined,
      front: cat.frontHistory ? (await store.get(KEYS.front) || null) : undefined,
      palettes: cat.palettes ? palettes : [],
      avatars: cat.avatars ? avatars : {},
      banners: cat.banners ? banners : {},
      customMoods: cat.moods ? (settings?.customMoods || []) : [],
      customFieldDefs: cat.customFields ? (await store.get(KEYS.customFieldDefs) || []) : [],
      noteboards: cat.noteboards ? (await store.get(KEYS.noteboards) || []) : [],
      polls: cat.polls ? (await store.get(KEYS.polls) || []) : [],
      journalTemplates: cat.journalTemplates ? (await store.get(KEYS.journalTemplates) || []) : [],
      relationships: cat.groups ? (await store.get(KEYS.relationships) || []) : [],
      relationshipTypes: cat.groups ? (await store.get(KEYS.relationshipTypes) || []) : [],
      systemMapMembers: cat.groups ? (await store.get(KEYS.systemMapMembers) || []) : [],
      medical: (await store.get(KEYS.medical)) || undefined,
    };
    const mediaFiles: Record<string, Uint8Array> = {};
    payload.members = (payload.members as any[]).map((m: any) => {
      const out: any = { ...m };
      const av = avatars[m.id];
      if (av && av.startsWith('data:')) {
        const name = `media/avatar-${m.id}.${extFromDataUri(av)}`;
        mediaFiles[name] = dataUriToBytes(av);
        out.avatar_media_path = name;
      }
      const bn = banners[m.id];
      if (bn && bn.startsWith('data:')) {
        const name = `media/banner-${m.id}.${extFromDataUri(bn)}`;
        mediaFiles[name] = dataUriToBytes(bn);
        out.banner_media_path = name;
      }
      return out;
    });
    payload.avatars = {};
    payload.banners = {};

    const manifest = { app: 'Plural Star', format_version: '2.0', system_name: system?.name || '', export_date: new Date().toISOString() };
    const zipBytes = zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest)),
      'data.json': strToU8(JSON.stringify(payload)),
      ...mediaFiles,
    });
    const slug = (system?.name || 'plural-star').replace(/\s+/g, '-').toLowerCase();
    const defaultName = `${slug}-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    const filePath = await window.electronAPI.dialog.saveFile(defaultName);
    if (!filePath) return;

    await window.electronAPI.file.writeBytes(filePath, u8ToBase64(zipBytes));
    showStatus('Backup exported successfully');
};

export const handlePluralKitExport = async (ctx: ImportCtx) => {
  const { system, members, history, showStatus, t } = ctx;
    const json = JSON.stringify(buildPluralKitExport(system, members, history), null, 2);
    const slug = (system?.name || 'plural-star').replace(/\s+/g, '-').toLowerCase();
    const defaultName = `${slug}-pluralkit-${new Date().toISOString().slice(0, 10)}.json`;
    const filePath = await window.electronAPI.dialog.saveFile(defaultName);
    if (!filePath) return;
    await window.electronAPI.file.writeBytes(filePath, u8ToBase64(strToU8(json)));
    showStatus(t('share.pkExportDone', { defaultValue: 'PluralKit export saved' }));
};

export const handlePickBackup = async (ctx: ImportCtx) => {
  const { showStatus, t, setRestoreData, setRestoreFile } = ctx;
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,.json,.txt';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        let data: ExportPayload;
        if (file.name.toLowerCase().endsWith('.zip')) {
          const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
          const dj = files['data.json'];
          if (!dj) { showStatus('Error: backup bundle is missing data.json'); return; }
          data = JSON.parse(strFromU8(dj)) as ExportPayload;
          const avatars: Record<string, string> = { ...(data.avatars || {}) };
          const banners: Record<string, string> = { ...(data.banners || {}) };
          for (const m of (data.members || []) as any[]) {
            if (m.avatar_media_path && files[m.avatar_media_path]) avatars[m.id] = bytesToDataUri(files[m.avatar_media_path], m.avatar_media_path);
            if (m.banner_media_path && files[m.banner_media_path]) banners[m.id] = bytesToDataUri(files[m.banner_media_path], m.banner_media_path);
          }
          data.avatars = avatars;
          data.banners = banners;
        } else {
          const text = await file.text();
          data = JSON.parse(text) as ExportPayload;
        }

        if (detectPluralSpace(data)) {
          showStatus(`Error: ${t('share.psUseSection')}`);
          return;
        }
        if (!data._meta?.app?.includes('PluralSpace') && !data._meta?.app?.includes('Plural Space') && !data._meta?.app?.includes('PluralStar') && !data._meta?.app?.includes('Plural Star')) {
          showStatus('Error: Not a Plural Star backup file');
          return;
        }

        setRestoreData(data);
        setRestoreFile(file.name);
      };
      input.click();
    } catch (e: any) {
      showStatus(`Import error: ${e.message}`);
    }
};

export const handleRestore = async (ctx: ImportCtx) => {
  const { restoreData, setImporting, restoreSel, mergeLogs, showStatus, setRestoreData, setRestoreFile, onUpdate } = ctx;
    if (!restoreData) return;
    setImporting(true);
    try {
      const batch: Record<string, unknown> = {};

      if (restoreSel.system && restoreData.system) batch[KEYS.system] = restoreData.system;

      if (restoreSel.members && restoreData.members) {
        const avatarMap: Record<string, string> = { ...(restoreData.avatars || {}) };
        const bannerMap: Record<string, string> = { ...(restoreData.banners || {}) };
        const importedMembers = restoreData.members.map((m: any) => {
          let result: any = m;
          if (!restoreSel.avatars) { const { avatar, ...rest } = result; result = rest; }
          else {
            const resolvedAvatar = avatarMap[m.id] ?? m.avatar;
            if (resolvedAvatar) result = { ...result, avatar: resolvedAvatar };
          }
          if (!restoreSel.banners) { const { banner, ...rest } = result; result = rest; }
          else {
            const resolvedBanner = bannerMap[m.id] ?? m.banner;
            if (resolvedBanner) result = { ...result, banner: resolvedBanner };
          }
          return result;
        });
        batch[KEYS.members] = importedMembers;
      } else if ((restoreSel.avatars || restoreSel.banners) && !restoreSel.members) {
        const avatarMap: Record<string, string> = restoreSel.avatars ? { ...(restoreData.avatars || {}) } : {};
        const bannerMap: Record<string, string> = restoreSel.banners ? { ...(restoreData.banners || {}) } : {};
        if (restoreSel.avatars) {
          for (const m of (restoreData.members || [])) { if ((m as any).avatar && !avatarMap[m.id]) avatarMap[m.id] = (m as any).avatar; }
        }
        if (restoreSel.banners) {
          for (const m of (restoreData.members || [])) { if ((m as any).banner && !bannerMap[m.id]) bannerMap[m.id] = (m as any).banner; }
        }
        if (Object.keys(avatarMap).length > 0 || Object.keys(bannerMap).length > 0) {
          const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
          const updated = existing.map(m => {
            let result: any = m;
            if (avatarMap[m.id]) result = { ...result, avatar: avatarMap[m.id] };
            if (bannerMap[m.id]) result = { ...result, banner: bannerMap[m.id] };
            return result;
          });
          batch[KEYS.members] = updated;
        }
      }

      if (restoreSel.journal && restoreData.journal) {
        if (mergeLogs) {
          const existing = await store.getStrict<any[]>(KEYS.journal, []) || [];
          const seen = new Set(existing.map((j: any) => j.id));
          batch[KEYS.journal] = [...existing, ...restoreData.journal.filter((j: any) => !seen.has(j.id))];
        } else batch[KEYS.journal] = restoreData.journal;
      }

      if (restoreSel.frontHistory && restoreData.frontHistory) {
        if (mergeLogs) {
          const existing = await store.getStrict<any[]>(KEYS.history, []) || [];
          const sig = (e: any) => `${e.startTime}|${(e.memberIds || []).join(',')}`;
          const seen = new Set(existing.map(sig));
          batch[KEYS.history] = [...existing, ...restoreData.frontHistory.filter((e: any) => !seen.has(sig(e)))];
        } else {
          batch[KEYS.history] = restoreData.frontHistory;
          if (restoreData.front !== undefined) batch[KEYS.front] = restoreData.front;
        }
      }

      if (restoreSel.groups && restoreData.groups) batch[KEYS.groups] = restoreData.groups;
      if (restoreSel.groups && restoreData.relationships) batch[KEYS.relationships] = restoreData.relationships;
      if (restoreSel.groups && restoreData.relationshipTypes) batch[KEYS.relationshipTypes] = restoreData.relationshipTypes;
      if (restoreSel.groups && restoreData.systemMapMembers) batch[KEYS.systemMapMembers] = restoreData.systemMapMembers;
      if (restoreData.medical) batch[KEYS.medical] = restoreData.medical;

      if (restoreSel.chat) {
        if (restoreData.chatChannels) batch[KEYS.chatChannels] = restoreData.chatChannels;
        if (restoreData.chatMessages) {
          for (const [chId, msgs] of Object.entries(restoreData.chatMessages)) {
            if (mergeLogs) {
              const existing = await store.getStrict<any[]>(chatMsgKey(chId), []) || [];
              const seen = new Set(existing.map((m: any) => m.id));
              batch[chatMsgKey(chId)] = [...existing, ...(msgs as any[]).filter((m: any) => !seen.has(m.id))];
            } else batch[chatMsgKey(chId)] = msgs;
          }
        }
      }

      if (restoreSel.settings || restoreSel.moods) {
        const currentSettings = await store.getStrict<any>(KEYS.settings, {}) || {};
        let newSettings = { ...currentSettings };
        if (restoreSel.settings && restoreData.settings) {
          newSettings = { ...restoreData.settings };
          if (!restoreSel.moods) newSettings.customMoods = currentSettings.customMoods || [];
        }
        if (restoreSel.moods) {
          newSettings.customMoods = restoreData.customMoods || restoreData.settings?.customMoods || [];
        }
        batch[KEYS.settings] = newSettings;
      }

      if (restoreSel.palettes && restoreData.palettes) batch[KEYS.palettes] = restoreData.palettes;
      if (restoreSel.customFields && restoreData.customFieldDefs) batch[KEYS.customFieldDefs] = restoreData.customFieldDefs;
      if (restoreSel.noteboards && restoreData.noteboards) batch[KEYS.noteboards] = restoreData.noteboards;
      if (restoreSel.polls && restoreData.polls) {
        if (mergeLogs) {
          const existing = await store.getStrict<any[]>(KEYS.polls, []) || [];
          const seen = new Set(existing.map((p: any) => p.id));
          batch[KEYS.polls] = [...existing, ...restoreData.polls.filter((p: any) => !seen.has(p.id))];
        } else batch[KEYS.polls] = restoreData.polls;
      }
      if (restoreSel.journalTemplates && restoreData.journalTemplates) batch[KEYS.journalTemplates] = restoreData.journalTemplates;

      if (Object.keys(batch).length === 0) {
        showStatus('Nothing selected to restore');
        return;
      }

      await store.setBatch(batch);

      showStatus('Restore complete');
      setRestoreData(null);
      setRestoreFile(null);
      onUpdate();
    } catch (e: any) {
      showStatus(`Restore error (no changes saved): ${e.message}`);
    } finally {
      setImporting(false);
    }
};
