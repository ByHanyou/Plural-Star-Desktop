import { store, KEYS, chatMsgKey } from '../storage';
import {
  Member, HistoryEntry, JournalEntry, ChatChannel, ChatMessage,
  CustomFieldDef, CustomFieldType, MemberGroup, MemberPoll, NoteboardEntry, uid,
} from '../utils';
import { detectForeignFormat, convertOurcana, convertParallax, convertMultiplicity, convertOctocon, detectAmpersandJson, convertAmpersandJson, detectTupperbox, convertTupperbox, ConvertedImport, detectPluralSpace, convertPluralSpace, isOpenPluralSystem, normalizeOpenPlural, isAmparBytes, amparToDatabaseJson, findOurcanaJsonEntry } from '../importers';
import { isImportStopped } from './progress';
import { unzipSync, strFromU8 } from 'fflate';
import { bytesToDataUri, spAvatarUrl, inlineRemoteAvatars } from '../exportUtils';
import { ImportCtx } from './ctx';

export const handleImportSP = async (ctx: ImportCtx) => {
  const { setImporting, extSel, showStatus, onUpdate, t } = ctx;
    setImporting(true);
    try {
      // Announce a phase so the wait overlay has something to count and Cancel
      // has a boundary to land on; without this the bar and button are inert.
      ctx.control?.begin(t('share.importing'));
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.txt';
      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) return;
          const text = await file.text();
          const data = JSON.parse(text);

          const spMembers = data.members || [];
          const spHistory = data.frontHistory || data.switches || [];

          const importedMembers: Member[] = spMembers.map((entry: any) => {
            const m = entry.content || entry;
            return {
              id: m.id || m._id || uid(),
              name: m.name || 'Unknown',
              pronouns: m.pronouns || '',
              role: m.role || '',
              color: m.color || '#DAA520',
              description: m.desc || m.description || '',
              tags: [],
              groupIds: [],
              avatar: extSel.avatars ? (spAvatarUrl(m) || m.avatar || undefined) : undefined,
            };
          });

          const importedHistory: HistoryEntry[] = spHistory.map((entry: any) => {
            const h = entry.content || entry;
            const memberId = h.member || h.memberId;
            return {
              memberIds: memberId ? [memberId] : [],
              startTime: typeof h.startTime === 'number'
                ? (h.startTime > 1e12 ? h.startTime : h.startTime * 1000)
                : new Date(h.startTime).getTime(),
              endTime: h.endTime
                ? (typeof h.endTime === 'number'
                  ? (h.endTime > 1e12 ? h.endTime : h.endTime * 1000)
                  : new Date(h.endTime).getTime())
                : null,
              note: '',
            };
          });

          const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
          const existingHistory = await store.getStrict<HistoryEntry[]>(KEYS.history, []) || [];

          const existingIds = new Set(existing.map(m => m.id));
          const newMembersRaw = importedMembers.filter(m => !existingIds.has(m.id));
          const newMembers = extSel.avatars ? await inlineRemoteAvatars(newMembersRaw) : newMembersRaw;

          // Overwrite treats the file as the whole roster: locals it doesn't
          // carry are soft-tombstoned (custom fronts and facets exempt).
          const importedIds = new Set(importedMembers.map(m => m.id));
          const keptExisting = ctx.importMode === 'overwrite'
            ? existing.map(m => (importedIds.has(m.id) || m.isCustomFront || m.isFacet || m.deleted) ? m : { ...m, archived: true, deleted: true })
            : existing;

          await store.setBatch({
            [KEYS.members]: [...keptExisting, ...newMembers],
            [KEYS.history]: [...existingHistory, ...importedHistory],
          });

          showStatus(t('share.statusSpImported', {members: newMembers.length, history: importedHistory.length}));
          onUpdate();
        } catch (e: any) {
          showStatus(t('share.statusImportErrorSafe', {msg: e.message}));
        } finally {
          setImporting(false);
        }
      };
      input.click();
    } catch (e: any) {
      showStatus(t('share.statusImportError', {msg: e.message}));
      setImporting(false);
    }
};

export const handleImportForeign = async (ctx: ImportCtx) => {
  const { setImporting, showStatus, history, system, onUpdate, t } = ctx;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.our';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        ctx.control?.begin(t('share.importing'));
        let conv: ConvertedImport | null = null;
        {
          // An Ourcana .our is a plain zip holding a single ourcana.json. Sniff
          // the PK zip magic instead of trusting the extension, since users
          // rename these.
          const buf = new Uint8Array(await file.arrayBuffer());
          // Ampersand's binary archive is not text at all, so it has to be
          // caught by its magic before anything tries to decode it as a string.
          if (isAmparBytes(buf)) {
            conv = convertAmpersandJson(amparToDatabaseJson(buf));
          }
          // Everything below decodes the file as TEXT, which would mangle a
          // binary archive, so it only runs when the magic check did not
          // already produce a conversion.
          if (!conv) {
            const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 3 || buf[2] === 5 || buf[2] === 7);
            let text: string;
            let ourZipFiles: Record<string, Uint8Array> | undefined;
            if (isZip) {
              const files = unzipSync(buf);
              const name = findOurcanaJsonEntry(files);
              if (!name) { showStatus(t('share.statusArchiveNoJson')); setImporting(false); return; }
              text = strFromU8(files[name]);
              ourZipFiles = files;
            } else {
              text = strFromU8(buf);
            }
            const fmt = detectForeignFormat(text);
            const parsedJson = (() => { try { return JSON.parse(text); } catch { return null; } })();
            // Ampersand's JSON export is the format their dev recommends over the
            // binary one, so check it before the generic sniffers.
            if (parsedJson && detectAmpersandJson(parsedJson)) {
              conv = convertAmpersandJson(parsedJson);
            } else if (parsedJson && detectTupperbox(parsedJson)) {
              // Tupperbox `tul!export` — PluralKit's own sniffer for these files
              // is simply "has a tuppers array".
              conv = convertTupperbox(parsedJson);
            } else {
              if (!fmt) { showStatus(t('share.statusUnrecognized')); setImporting(false); return; }
              const d = parsedJson ?? JSON.parse(text);
              conv = fmt === 'ourcana' ? convertOurcana(d, ourZipFiles) : fmt === 'parallax' ? convertParallax(d) : fmt === 'multiplicity' ? convertMultiplicity(d) : convertOctocon(d);
            }
          }
        }
        if (!conv || (conv.members.length === 0 && conv.history.length === 0)) { showStatus(t('share.statusNothingInFile')); setImporting(false); return; }

        const batch: Record<string, unknown> = {};
        const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
        const merged = [...existing];
        const idRemap: Record<string, string> = {};
        const toAdd: Member[] = [];
        conv.members.forEach(nm => {
          const claimed = new Set(Object.values(idRemap));
          const nameMatch = (e: Member) => !claimed.has(e.id) && !e.isCustomFront && !e.isFacet && e.name.toLowerCase() === nm.name.toLowerCase();
          let di = nm.sourceId ? merged.findIndex(e => e.sourceId === nm.sourceId) : -1;
          if (di < 0) di = merged.findIndex(e => !e.sourceId && nameMatch(e));
          if (di < 0) di = merged.findIndex(nameMatch);
          if (di >= 0) {
            const dup = merged[di];
            idRemap[nm.id] = dup.id;
            if (dup.deleted) merged[di] = { ...dup, deleted: false, archived: nm.archived ?? false };
          } else { idRemap[nm.id] = nm.id; toAdd.push(nm); }
        });
        const toAddInlined = await inlineRemoteAvatars(toAdd);
        // Overwrite treats the file as the whole roster: unmatched locals are
        // soft-tombstoned (custom fronts and facets exempt). Update keeps them.
        const claimedIds = new Set(Object.values(idRemap));
        const mergedFinal = ctx.importMode === 'overwrite'
          ? merged.map(m => (claimedIds.has(m.id) || m.isCustomFront || m.isFacet || m.deleted) ? m : { ...m, archived: true, deleted: true })
          : merged;
        batch[KEYS.members] = [...mergedFinal, ...toAddInlined];

        if (conv.history.length > 0) {
          const remapped = conv.history.map(h => ({ ...h, memberIds: h.memberIds.map(id => idRemap[id] || id) }));
          batch[KEYS.history] = [...remapped, ...history].sort((a, b) => b.startTime - a.startTime);
        }
        if (conv.journal && conv.journal.length > 0) {
          const existingJournal = await store.getStrict<any[]>(KEYS.journal, []) || [];
          // Dedupe on title+timestamp so re-importing the same archive does not
          // stack duplicates.
          const sig = (e: any) => `${e?.timestamp}|${e?.title}`;
          const seen = new Set(existingJournal.map(sig));
          const addJournal = conv.journal
            .filter(e => !seen.has(sig(e)))
            .map(e => ({
              ...e,
              id: uid(),
              hashtags: e.hashtags || [],
              authorIds: e.authorIds.map(id => idRemap[id] || id),
            }));
          if (addJournal.length > 0) {
            batch[KEYS.journal] = [...addJournal, ...existingJournal].sort((a: any, b: any) => b.timestamp - a.timestamp);
          }
        }
        if (conv.groups && conv.groups.length > 0) {
          const existingGroups = await store.getStrict<any[]>(KEYS.groups, []) || [];
          const mergedGroupList = [...existingGroups];
          // When a converter group dedupes into an EXISTING group, imported
          // members still carry the converter's group id — remap those to the
          // surviving local id, or their groupIds dangle at nothing.
          const groupIdRemap: Record<string, string> = {};
          conv.groups.forEach(g => {
            const srcId = g.sourceId || `ext:${String(g.id)}`;
            const idx = mergedGroupList.findIndex((e: any) => e.sourceId === srcId);
            const nameIdx = idx < 0 ? mergedGroupList.findIndex((e: any) => !e.sourceId && String(e.name || '').toLowerCase() === g.name.toLowerCase()) : -1;
            const at = idx >= 0 ? idx : nameIdx;
            if (at >= 0) {
              mergedGroupList[at] = { ...mergedGroupList[at], name: g.name, sourceId: srcId };
              groupIdRemap[g.id] = mergedGroupList[at].id;
            } else {
              mergedGroupList.push({ ...g, sourceId: srcId });
            }
          });
          // A deduped group changes id, so children pointing at the converter's
          // id must follow it or their nesting dangles.
          if (Object.keys(groupIdRemap).length > 0) {
            for (let i = 0; i < mergedGroupList.length; i++) {
              const p = (mergedGroupList[i] as any).parentId;
              if (p && groupIdRemap[p]) mergedGroupList[i] = { ...mergedGroupList[i], parentId: groupIdRemap[p] };
            }
          }
          batch[KEYS.groups] = mergedGroupList;
          if (Object.keys(groupIdRemap).length > 0) {
            batch[KEYS.members] = (batch[KEYS.members] as Member[]).map(m =>
              m.groupIds && m.groupIds.some(gid => groupIdRemap[gid])
                ? { ...m, groupIds: m.groupIds.map(gid => groupIdRemap[gid] || gid) }
                : m);
          }
        }
        if (conv.customFieldDefs && conv.customFieldDefs.length > 0) {
          const existingDefs = await store.getStrict<any[]>(KEYS.customFieldDefs, []) || [];
          const names = new Set(existingDefs.map((d: any) => String(d.name || '').toLowerCase()));
          batch[KEYS.customFieldDefs] = [...existingDefs, ...conv.customFieldDefs.filter(d => !names.has(d.name.toLowerCase()))];
        }
        if (conv.chat && conv.chat.length > 0) {
          const existingCh = await store.getStrict<ChatChannel[]>(KEYS.chatChannels, []) || [];
          const mergedCh: ChatChannel[] = [...existingCh];
          for (const ch of conv.chat) {
            let local = mergedCh.find(c => c.name.toLowerCase() === ch.name.toLowerCase());
            if (!local) { local = { id: uid(), name: ch.name, createdAt: ch.createdAt }; mergedCh.push(local); }
            if (ch.messages.length === 0) continue;
            const cur = await store.getStrict<ChatMessage[]>(chatMsgKey(local.id), []) || [];
            const seen = new Set(cur.map(m => `${m.timestamp}|${m.authorId}|${m.content}`));
            const mapped: ChatMessage[] = ch.messages.map(msg => ({ id: uid(), channelId: local!.id, authorId: idRemap[msg.authorId] || msg.authorId, type: 'text', content: msg.content, timestamp: msg.timestamp }));
            const fresh = mapped.filter(m => !seen.has(`${m.timestamp}|${m.authorId}|${m.content}`));
            if (fresh.length > 0) batch[chatMsgKey(local.id)] = [...cur, ...fresh].sort((a, b) => a.timestamp - b.timestamp);
          }
          batch[KEYS.chatChannels] = mergedCh;
        }
        if (conv.systemName || conv.systemAvatar || conv.systemBanner) {
          batch[KEYS.system] = {
            ...system,
            name: conv.systemName || system.name,
            description: conv.systemDesc || system.description,
            ...(conv.systemAvatar ? { avatar: conv.systemAvatar } : {}),
            ...(conv.systemBanner ? { banner: conv.systemBanner } : {}),
          };
        }

        await store.setBatch(batch);
        showStatus(t('share.statusForeignImported', {label: conv.sourceLabel, members: toAdd.length, history: conv.history.length}));
        onUpdate();
      } catch (e: any) {
        showStatus(t('share.statusImportErrorSafe', {msg: e.message}));
      } finally {
        setImporting(false);
      }
    };
    input.click();
};

export const handleImportPluralSpace = async (ctx: ImportCtx) => {
  const { t, setImporting, showStatus, history, system, onUpdate } = ctx;
    const filePath = await window.electronAPI.dialog.openFile([
      { name: 'PluralSpace export (.zip or data.json)', extensions: ['zip', 'json'] },
      { name: 'All Files', extensions: ['*'] },
    ]);
    if (!filePath) return;
    setImporting(true);
    try {
      const dataUri = await window.electronAPI.file.readAsBase64(filePath);
      if (!dataUri) throw new Error(t('share.psNotExport'));
      const b64 = dataUri.split(',')[1] || '';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      let zipFiles: Record<string, Uint8Array> | null = null;
      let text: string;
      let openPluralPrefix = '';
      if (/\.zip$/i.test(filePath)) {
        zipFiles = unzipSync(bytes);
        // Newer PluralSpace exports are OpenPlural bundles with no data.json at
        // the root — the system lives at systems/<slug>/openplural.json. Look
        // for that BEFORE the "any .json" fallback, which would otherwise grab
        // manifest.json or account.json and report a valid export as garbage.
        const openPlural = Object.keys(zipFiles).find(k => /(^|\/)openplural\.json$/i.test(k));
        const jsonEntry = zipFiles['data.json']
          ? 'data.json'
          : Object.keys(zipFiles).find(k => /(^|\/)data\.json$/i.test(k)) || openPlural || Object.keys(zipFiles).find(k => /\.json$/i.test(k));
        if (!jsonEntry) throw new Error(t('share.psNotExport'));
        if (jsonEntry === openPlural) openPluralPrefix = jsonEntry.replace(/openplural\.json$/i, '');
        text = strFromU8(zipFiles[jsonEntry]);
      } else {
        text = new TextDecoder('utf-8').decode(bytes);
      }
      let d: any;
      try { d = JSON.parse(text); } catch { throw new Error(t('share.psNotExport')); }
      if (isOpenPluralSystem(d)) d = normalizeOpenPlural(d, openPluralPrefix);
      if (!detectPluralSpace(d)) throw new Error(t('share.psNotExport'));
      const conv = convertPluralSpace(d);

      const batch: Record<string, unknown> = {};

      const existingDefs = await store.getStrict<CustomFieldDef[]>(KEYS.customFieldDefs, []) || [];
      const defRemap: Record<string, string> = {};
      const defsToAdd: CustomFieldDef[] = [];
      (conv.customFieldDefs || []).forEach(dd => {
        const ex = existingDefs.find(e => e.name.toLowerCase() === dd.name.toLowerCase());
        if (ex) { defRemap[dd.id] = ex.id; } else { defRemap[dd.id] = dd.id; defsToAdd.push(dd); }
      });
      if (defsToAdd.length > 0) batch[KEYS.customFieldDefs] = [...existingDefs, ...defsToAdd];

      const existingGroups = await store.getStrict<MemberGroup[]>(KEYS.groups, []) || [];
      const groupRemap: Record<string, string> = {};
      const groupsToAdd: MemberGroup[] = [];
      const mergedGroupList = [...existingGroups];
      let groupsChanged = false;
      (conv.groups || []).forEach(g => {
        const srcId = `ps:${String(g.id)}`;
        const idx = mergedGroupList.findIndex(e => e.sourceId === srcId);
        const nameIdx = idx < 0 ? mergedGroupList.findIndex(e => !e.sourceId && String(e.name).toLowerCase() === g.name.toLowerCase()) : -1;
        const at = idx >= 0 ? idx : nameIdx;
        if (at >= 0) {
          groupRemap[g.id] = mergedGroupList[at].id;
          mergedGroupList[at] = { ...mergedGroupList[at], name: g.name, sourceId: srcId };
          groupsChanged = true;
        } else {
          groupRemap[g.id] = g.id;
          mergedGroupList.push({ ...g, sourceId: srcId });
          groupsChanged = true;
        }
      });
      if (groupsChanged) batch[KEYS.groups] = mergedGroupList;

      const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
      const merged = [...existing];
      const idRemap: Record<string, string> = {};
      const toAdd: Member[] = [];
      conv.members.forEach(nm => {
        const fixed: Member = {
          ...nm,
          customFields: (nm.customFields || []).map(cv => ({ ...cv, fieldId: defRemap[cv.fieldId] || cv.fieldId })),
          groupIds: (nm.groupIds || []).map(g => groupRemap[g] || g),
        };
        const claimed = new Set(Object.values(idRemap));
        const nameMatch = (e: Member) => !claimed.has(e.id) && !e.isCustomFront && !e.isFacet && e.name.toLowerCase() === nm.name.toLowerCase();
        let di = nm.sourceId ? merged.findIndex(e => e.sourceId === nm.sourceId) : -1;
        if (di < 0) di = merged.findIndex(e => !e.sourceId && nameMatch(e));
        if (di < 0) di = merged.findIndex(nameMatch);
        if (di >= 0) {
          const dup = merged[di];
          idRemap[nm.id] = dup.id;
          const mergedCF = [...(dup.customFields || [])];
          (fixed.customFields || []).forEach(cv => {
            const ci = mergedCF.findIndex(c => c.fieldId === cv.fieldId);
            if (ci >= 0) mergedCF[ci] = cv; else mergedCF.push(cv);
          });
          merged[di] = {
            ...dup, name: fixed.name, pronouns: fixed.pronouns, role: fixed.role, color: fixed.color,
            description: fixed.description, archived: fixed.archived,
            // Category stays local on a name match. An outside app has no idea
            // this record is a facet or a custom front here, and letting it
            // decide would quietly turn one into a counted member.
            isCustomFront: dup.isCustomFront, isFacet: dup.isFacet,
            sourceId: nm.sourceId, customFields: mergedCF,
            groupIds: [...new Set([...(dup.groupIds || []), ...(fixed.groupIds || [])])],
            ...(dup.deleted ? { deleted: false } : {}),
          };
        } else {
          idRemap[nm.id] = nm.id;
          toAdd.push(fixed);
        }
      });
      // Overwrite treats the export as the whole roster: unmatched locals are
      // soft-tombstoned (custom fronts and facets exempt). Update keeps them.
      const psClaimed = new Set(Object.values(idRemap));
      const psMerged = ctx.importMode === 'overwrite'
        ? merged.map(m => (psClaimed.has(m.id) || m.isCustomFront || m.isFacet || m.deleted) ? m : { ...m, archived: true, deleted: true })
        : merged;
      let allMembers: Member[] = [...psMerged, ...toAdd];

      let avatarsLoaded = 0;
      const sep = filePath.includes('\\') ? '\\' : '/';
      const baseDir = filePath.slice(0, filePath.lastIndexOf(sep));
      for (const [origId, rel] of Object.entries(conv.avatarMediaPaths)) {
        const localId = idRemap[origId] || origId;
        const relNorm = String(rel).replace(/^[/\\]+/, '');
        if (relNorm.includes('..')) continue;
        if (zipFiles) {
          const zipKey = relNorm.replace(/\\/g, '/');
          const entry = zipFiles[zipKey] || zipFiles[String(rel)];
          if (entry) {
            allMembers = allMembers.map(m => m.id === localId ? { ...m, avatar: bytesToDataUri(entry, zipKey) } : m);
            avatarsLoaded++;
          }
          continue;
        }
        const abs = baseDir + sep + relNorm.replace(/[/\\]+/g, sep);
        const dataUrl = await window.electronAPI.file.readAsBase64(abs).catch(() => null);
        if (dataUrl) { allMembers = allMembers.map(m => m.id === localId ? { ...m, avatar: dataUrl } : m); avatarsLoaded++; }
      }
      allMembers = await inlineRemoteAvatars(allMembers);
      batch[KEYS.members] = allMembers;

      if (conv.history.length > 0) {
        const remapped = conv.history.map(h => ({
          ...h,
          memberIds: h.memberIds.map(id => idRemap[id] || id),
          coFrontIds: h.coFrontIds?.map(id => idRemap[id] || id),
          coConsciousIds: h.coConsciousIds?.map(id => idRemap[id] || id),
        }));
        batch[KEYS.history] = [...remapped, ...history].sort((a, b) => b.startTime - a.startTime);
      }

      if (conv.journal.length > 0) {
        const existingJ = await store.getStrict<JournalEntry[]>(KEYS.journal, []) || [];
        const newJ: JournalEntry[] = conv.journal.map(j => ({
          id: uid(), title: j.title, body: j.body,
          authorIds: j.authorIds.map(id => idRemap[id] || id),
          hashtags: [], timestamp: j.timestamp,
        }));
        batch[KEYS.journal] = [...newJ, ...existingJ].sort((a, b) => b.timestamp - a.timestamp);
      }

      if (conv.chatChannels.length > 0) {
        const existingCh = await store.getStrict<ChatChannel[]>(KEYS.chatChannels, []) || [];
        const mergedCh: ChatChannel[] = [...existingCh];
        for (const ch of conv.chatChannels) {
          let local = mergedCh.find(c => c.name.toLowerCase() === ch.name.toLowerCase());
          if (!local) { local = { id: uid(), name: ch.name, createdAt: ch.createdAt }; mergedCh.push(local); }
          if (ch.messages.length > 0) {
            const existingMsgs = await store.getStrict<ChatMessage[]>(chatMsgKey(local.id), []) || [];
            const newMsgs: ChatMessage[] = ch.messages.map(msg => ({
              id: uid(), channelId: local!.id,
              authorId: idRemap[msg.authorId] || msg.authorId || '',
              type: 'text', content: msg.content, timestamp: msg.timestamp,
            }));
            batch[chatMsgKey(local.id)] = [...existingMsgs, ...newMsgs].sort((a, b) => a.timestamp - b.timestamp);
          }
        }
        batch[KEYS.chatChannels] = mergedCh;
      }

      if (conv.polls.length > 0) {
        const existingPolls = await store.getStrict<MemberPoll[]>(KEYS.polls, []) || [];
        const newPolls: MemberPoll[] = conv.polls.map(p => {
          const creator = idRemap[p.createdBy] || p.createdBy || '';
          return {
            id: uid(), targetMemberId: creator, question: p.question,
            createdBy: creator, createdAt: p.createdAt, closedAt: p.closedAt,
            options: p.options.map(o => ({ id: uid(), label: o.text, votes: o.votes.map(v => idRemap[v] || v) })),
          };
        });
        batch[KEYS.polls] = [...existingPolls, ...newPolls];
      }

      if (conv.systemName || conv.systemAvatar || conv.systemBanner) {
        batch[KEYS.system] = {
          ...system,
          name: conv.systemName || system.name,
          description: conv.systemDesc || system.description,
          ...(conv.systemAvatar ? { avatar: conv.systemAvatar } : {}),
          ...(conv.systemBanner ? { banner: conv.systemBanner } : {}),
        };
      }

      await store.setBatch(batch);
      showStatus(t('share.psImportDone', { members: toAdd.length, history: conv.history.length, avatars: avatarsLoaded }));
      onUpdate();
    } catch (e: any) {
      showStatus(t('share.statusError', {msg: e.message}));
    } finally {
      setImporting(false);
    }
};

/**
 * PluralLog export bundle (com.arcadearmor.plurallog), reversed from a real
 * export — the Tupperbox rule: match the file the app actually writes, not a
 * doc. Zip layout: manifest.json {generatedAt, exportJson, mediaCount, files[]},
 * plurallog_export_<stamp>.json (the database), stored_media/(pfp_|headspace_)*.png.
 * Same field notes as the mobile importer (src/import/plurallog.ts there);
 * their polls are system-wide questions with no target member and headspaces
 * have no home here, so both are dropped like every importer drops what does
 * not fit.
 */
const PL_ARGB_MASK = 0xffffff;
const plArgbToHex = (n: unknown): string => {
  const num = typeof n === 'number' && Number.isFinite(n) ? n : NaN;
  if (Number.isNaN(num)) return '#DAA520';
  return `#${(num & PL_ARGB_MASK).toString(16).padStart(6, '0').toUpperCase()}`;
};
const plCsv = (s: unknown): string[] => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const plBaseName = (p: unknown): string => String(p || '').split('/').pop() || '';
const isPluralLogDb = (o: any): boolean =>
  !!o && typeof o === 'object' && Array.isArray(o.members) && Array.isArray(o.switchEvents) && o.config && typeof o.config === 'object';

export const handleImportPluralLog = async (ctx: ImportCtx) => {
  const { t, setImporting, showStatus, history, system, onUpdate } = ctx;
  const filePath = await window.electronAPI.dialog.openFile([
    { name: 'PluralLog export (.zip)', extensions: ['zip'] },
    { name: 'All Files', extensions: ['*'] },
  ]);
  if (!filePath) return;
  setImporting(true);
  try {
    const dataUri = await window.electronAPI.file.readAsBase64(filePath);
    if (!dataUri) throw new Error(t('share.plurallogNeedsZip'));
    const b64 = dataUri.split(',')[1] || '';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const files = unzipSync(bytes);
    // The database file name carries an export timestamp; find it rather than
    // hardcode it. manifest.exportJson names it too when present.
    let manifest: any = null;
    if (files['manifest.json']) { try { manifest = JSON.parse(strFromU8(files['manifest.json'])); } catch {} }
    const dbName = (manifest && typeof manifest.exportJson === 'string' && files[manifest.exportJson])
      ? manifest.exportJson
      : Object.keys(files).find(n => /(^|\/)plurallog_export.*\.json$/i.test(n));
    let db: any = null;
    if (dbName && files[dbName]) { try { db = JSON.parse(strFromU8(files[dbName])); } catch {} }
    if (!isPluralLogDb(db)) throw new Error(t('share.plurallogNeedsZip'));

    const batch: Record<string, unknown> = {};
    const plMembers: any[] = db.members;
    const idMap: Record<string, string> = {};

    if (db.config?.systemName) {
      batch[KEYS.system] = { ...system, name: String(db.config.systemName) || system.name };
    }

    // Members — same replace semantics as the mobile importer: match by
    // sourceId, then by claimable name; anything of ours left unmatched is
    // soft-tombstoned, because a member import replaces the roster.
    const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
    const merged = [...existing];
    plMembers.forEach((m: any) => {
      if (!m || !m.id) return;
      const srcId = 'pl:' + String(m.id);
      const incoming: Partial<Member> = {
        name: (m.name && String(m.name).trim()) || 'Unnamed member',
        pronouns: String(m.pronouns || ''),
        role: String(m.role || ''),
        color: plArgbToHex(m.color),
        description: String(m.description || m.profileMarkdown || ''),
        archived: !!m.archived,
        // PluralLog sub-members (parentMemberId) are the closest thing to our
        // facets: profiles that belong to another member.
        ...(m.parentMemberId ? { isFacet: true } : {}),
      };
      const claimed = new Set(Object.values(idMap));
      const nameMatch = (e: Member) => !claimed.has(e.id) && !e.isCustomFront && !e.isFacet && e.name.toLowerCase() === String(incoming.name).toLowerCase();
      let di = merged.findIndex(e => e.sourceId === srcId);
      if (di < 0) di = merged.findIndex(e => !e.sourceId && nameMatch(e));
      if (di < 0) di = merged.findIndex(nameMatch);
      if (di >= 0) {
        const dup = merged[di];
        merged[di] = { ...dup, ...incoming, sourceId: srcId, ...(dup.deleted ? { deleted: false } : {}) };
        idMap[String(m.id)] = dup.id;
      } else {
        const nid = uid();
        merged.push({ id: nid, sourceId: srcId, tags: [], groupIds: [], customFields: [], ...incoming } as Member);
        idMap[String(m.id)] = nid;
      }
    });
    const keptIds = new Set(Object.values(idMap));
    let allMembers: Member[] = ctx.importMode === 'overwrite'
      ? merged.map(m =>
          (m.isCustomFront || m.isFacet || m.deleted || keptIds.has(m.id)) ? m : { ...m, archived: true, deleted: true })
      : merged;

    // Avatars ship in the bundle under stored_media/; profileImagePath is an
    // absolute app path, so only its basename matches the zip entries.
    let avatarsLoaded = 0;
    plMembers.forEach((m: any) => {
      const localId = idMap[String(m?.id)];
      const entryName = m?.profileImagePath ? `stored_media/${plBaseName(m.profileImagePath)}` : '';
      const entry = entryName ? files[entryName] : undefined;
      if (!localId || !entry) return;
      allMembers = allMembers.map(x => x.id === localId ? { ...x, avatar: bytesToDataUri(entry, entryName) } : x);
      avatarsLoaded++;
    });

    // Folders are their groups; parentFolderId nests, memberIds is CSV.
    if (Array.isArray(db.folders) && db.folders.length > 0) {
      const existingGroups = await store.getStrict<MemberGroup[]>(KEYS.groups, []) || [];
      const groups = [...existingGroups];
      const folderIdMap: Record<string, string> = {};
      db.folders.forEach((f: any, i: number) => {
        const name = (f?.name && String(f.name).trim()) || `Group ${i + 1}`;
        const found = groups.find(g => g.name.toLowerCase() === name.toLowerCase());
        const localId = found ? found.id : uid();
        if (!found) groups.push({ id: localId, name, color: plArgbToHex(f.colorValue), sortOrder: f.sortOrder ?? i });
        folderIdMap[String(f.id)] = localId;
      });
      // Second pass for nesting: parents may appear after children.
      db.folders.forEach((f: any) => {
        const localId = folderIdMap[String(f.id)];
        const parent = f.parentFolderId ? folderIdMap[String(f.parentFolderId)] : null;
        if (!localId || !parent) return;
        const idx = groups.findIndex(g => g.id === localId);
        if (idx >= 0) groups[idx] = { ...groups[idx], parentId: parent };
      });
      batch[KEYS.groups] = groups;
      const membership: Record<string, string[]> = {};
      db.folders.forEach((f: any) => {
        const gid = folderIdMap[String(f.id)];
        if (!gid) return;
        plCsv(f.memberIds).forEach(mid => {
          const local = idMap[mid];
          if (!local) return;
          if (!membership[local]) membership[local] = [];
          membership[local].push(gid);
        });
      });
      allMembers = allMembers.map(m => {
        const add = (membership[m.id] || []).filter(g => !(m.groupIds || []).includes(g));
        return add.length ? { ...m, groupIds: [...(m.groupIds || []), ...add] } : m;
      });
    }
    batch[KEYS.members] = allMembers;

    // Switch events: memberId + cofronterIds CSV; endTime null = still open.
    // Dedupe-merge by signature so a re-import cannot stack duplicates.
    let historyAdded = 0;
    if (Array.isArray(db.switchEvents) && db.switchEvents.length > 0) {
      const entries: HistoryEntry[] = [];
      [...db.switchEvents]
        .sort((a: any, b: any) => (a.startTime || 0) - (b.startTime || 0))
        .forEach((s: any) => {
          const primary = idMap[String(s.memberId)];
          if (!primary || !s.startTime) return;
          const co = plCsv(s.cofronterIds).map(x => idMap[x]).filter(Boolean) as string[];
          entries.push({
            memberIds: [primary],
            ...(co.length ? { coFrontIds: co } : {}),
            startTime: Number(s.startTime),
            endTime: s.endTime == null ? null : Number(s.endTime),
            note: String(s.notes || ''),
          });
        });
      const sig = (e: HistoryEntry) => `${e.startTime}|${[...(e.memberIds || [])].sort().join(',')}|${[...(e.coFrontIds || [])].sort().join(',')}`;
      const seen = new Set(history.map(sig));
      const fresh = entries.filter(e => !seen.has(sig(e)));
      historyAdded = fresh.length;
      if (fresh.length > 0) batch[KEYS.history] = [...fresh, ...history].sort((a, b) => b.startTime - a.startTime);
    }

    // Journal: text-only entries; the first line becomes the title, the tags
    // CSV plus the emotion land as hashtags.
    if (Array.isArray(db.journal) && db.journal.length > 0) {
      const existingJ = await store.getStrict<JournalEntry[]>(KEYS.journal, []) || [];
      const jSig = (e: JournalEntry) => `${e.timestamp}|${e.body}`;
      const seenJ = new Set(existingJ.map(jSig));
      const added: JournalEntry[] = [];
      db.journal.forEach((j: any) => {
        const body = String(j?.text || '').trim();
        if (!body || !j.timestamp) return;
        const author = idMap[String(j.authorId)];
        const tags = plCsv(j.tags).map(x => (x.startsWith('#') ? x : `#${x}`));
        if (j.emotion) tags.push(`#${String(j.emotion)}`);
        const entry: JournalEntry = {
          id: uid(),
          title: body.split('\n')[0].slice(0, 60),
          body,
          authorIds: author ? [author] : [],
          hashtags: [...new Set(tags)],
          timestamp: Number(j.timestamp),
        };
        if (!seenJ.has(jSig(entry))) { seenJ.add(jSig(entry)); added.push(entry); }
      });
      if (added.length) batch[KEYS.journal] = [...added, ...existingJ].sort((a, b) => b.timestamp - a.timestamp);
    }

    // Chat: channels matched by name, messages deduped on
    // timestamp|author|content.
    if (Array.isArray(db.channels) && Array.isArray(db.messages) && db.messages.length > 0) {
      const existingCh = await store.getStrict<ChatChannel[]>(KEYS.chatChannels, []) || [];
      const channels = [...existingCh];
      const chMap: Record<string, string> = {};
      db.channels.forEach((c: any, i: number) => {
        const name = (c?.name && String(c.name).trim()) || `Channel ${i + 1}`;
        const found = channels.find(x => x.name.toLowerCase() === name.toLowerCase());
        const localId = found ? found.id : uid();
        if (!found) channels.push({ id: localId, name, createdAt: Date.now() });
        chMap[String(c.id)] = localId;
      });
      batch[KEYS.chatChannels] = channels;
      const byChannel: Record<string, ChatMessage[]> = {};
      db.messages.forEach((m: any) => {
        const channelId = chMap[String(m.channelId)];
        const authorId = idMap[String(m.authorId)];
        const content = String(m?.text || '');
        if (!channelId || !authorId || !content || !m.timestamp) return;
        if (!byChannel[channelId]) byChannel[channelId] = [];
        byChannel[channelId].push({ id: uid(), channelId, authorId, type: 'text', content, timestamp: Number(m.timestamp) });
      });
      for (const [channelId, msgs] of Object.entries(byChannel)) {
        const cur = await store.getStrict<ChatMessage[]>(chatMsgKey(channelId), []) || [];
        const seenM = new Set(cur.map(m => `${m.timestamp}|${m.authorId}|${m.content}`));
        const fresh = msgs.filter(m => !seenM.has(`${m.timestamp}|${m.authorId}|${m.content}`));
        if (fresh.length) batch[chatMsgKey(channelId)] = [...cur, ...fresh].sort((a, b) => a.timestamp - b.timestamp);
      }
    }

    // frontMessages are their member-to-member mail — our Mailbox.
    if (Array.isArray(db.frontMessages) && db.frontMessages.length > 0) {
      const existingN = await store.getStrict<NoteboardEntry[]>(KEYS.noteboards, []) || [];
      const seenN = new Set(existingN.map(n => `${n.timestamp}|${n.authorId}|${n.content}`));
      const added: NoteboardEntry[] = [];
      db.frontMessages.forEach((fm: any) => {
        const memberId = idMap[String(fm.toMemberId)];
        const authorId = idMap[String(fm.fromMemberId)];
        const content = String(fm?.text || '');
        if (!memberId || !authorId || !content || !fm.createdAt) return;
        const entry: NoteboardEntry = { id: uid(), memberId, authorId, content, timestamp: Number(fm.createdAt), read: !!fm.read };
        const k = `${entry.timestamp}|${entry.authorId}|${entry.content}`;
        if (!seenN.has(k)) { seenN.add(k); added.push(entry); }
      });
      if (added.length) batch[KEYS.noteboards] = [...existingN, ...added];
    }

    await store.setBatch(batch);
    showStatus(t('share.statusImportedCounts', { members: plMembers.length, switches: historyAdded }));
    onUpdate();
  } catch (e: any) {
    showStatus(t('share.statusError', { msg: e.message }));
  } finally {
    setImporting(false);
  }
};

export const handleTokenFetch = async (ctx: ImportCtx) => {
  const { extToken, showStatus, t, setExtLoading, setExtPreview, extSource, spGet } = ctx;
    if (!extToken.trim()) { showStatus(t('share.tokenRequired')); return; }
    setExtLoading(true); setExtPreview(null);
    const netFetch = async (url: string, headers: Record<string, string>) => {
      const res = await window.electronAPI.net.fetch(url, { headers });
      if (!res.ok) throw new Error(t('share.authFailed', {status: res.status}));
      try { return JSON.parse(res.text); } catch { return {}; }
    };
    try {
      if (extSource === 'sp') {
        const headers = {Authorization: extToken.trim(), 'Content-Type': 'application/json'};
        const meData = await netFetch('https://v2.apparyllis.com/v1/me', headers);
        const userId = meData.id || meData.uid;
        const mData = await spGet(`https://v2.apparyllis.com/v1/members/${userId}`, headers);
        const sData = await spGet(`https://v2.apparyllis.com/v1/frontHistory/${userId}?startTime=0&endTime=${Date.now()}`, headers);
        const cfData = await spGet(`https://v2.apparyllis.com/v1/customFields/${userId}`, headers);
        const gData = await spGet(`https://v2.apparyllis.com/v1/groups/${userId}`, headers);
        if (mData == null) throw new Error(t('share.spFetchPartial', {categories: t('share.memberProfiles')}));
        const failedCats: string[] = [];
        if (sData == null) failedCats.push(t('share.frontHistory'));
        if (cfData == null) failedCats.push(t('customFields.title'));
        if (gData == null) failedCats.push(t('share.memberGroups'));
        setExtPreview({
          system: meData,
          members: Array.isArray(mData) ? mData : (mData.members || []),
          switches: Array.isArray(sData) ? sData : (sData?.switches || sData?.frontHistory || []),
          customFields: Array.isArray(cfData) ? cfData : (cfData?.customFields || []),
          groups: Array.isArray(gData) ? gData : (gData?.groups || []),
        });
        if (failedCats.length > 0) showStatus(t('share.statusError', {msg: t('share.spFetchPartial', {categories: failedCats.join(', ')})}));
      } else {
        const headers = {Authorization: extToken.trim(), 'Content-Type': 'application/json'};
        const [sData, mData] = await Promise.all([
          netFetch('https://api.pluralkit.me/v2/systems/@me', headers),
          netFetch('https://api.pluralkit.me/v2/systems/@me/members', headers),
        ]);
        // PluralKit caps this endpoint at 100 rows regardless of `limit` and
        // expects you to page backwards with `before`. Asking for 500 once threw
        // away every switch older than the newest 100.
        const PK_PAGE = 100;
        const PK_MAX_PAGES = 200; // 20k switches — stops a broken cursor looping
        const swData: any[] = [];
        const seenSwitch = new Set<string>();
        let before: string | undefined;
        for (let page = 0; page < PK_MAX_PAGES; page++) {
          const url = `https://api.pluralkit.me/v2/systems/@me/switches?limit=${PK_PAGE}${before ? `&before=${encodeURIComponent(before)}` : ''}`;
          const batch = await netFetch(url, headers);
          if (!Array.isArray(batch) || batch.length === 0) break;
          let added = 0;
          for (const sw of batch) {
            const id = String(sw?.id || sw?.timestamp || '');
            if (id && seenSwitch.has(id)) continue;
            if (id) seenSwitch.add(id);
            swData.push(sw);
            added++;
          }
          const oldest = batch[batch.length - 1]?.timestamp;
          if (!oldest || oldest === before || added === 0 || batch.length < PK_PAGE) break;
          before = String(oldest);
        }
        setExtPreview({system: sData, members: Array.isArray(mData) ? mData : [], switches: swData});
      }
    } catch (e: any) {
      if (isImportStopped(e)) showStatus(t('share.importStopped', {defaultValue: 'Import stopped. Nothing was changed.'}));
      else showStatus(`${t('share.importFailed')}: ${e.message}`);
    }
    finally { setExtLoading(false); }
};

export const handleTokenImport = async (ctx: ImportCtx) => {
  const { extPreview, extSource, setImporting, system, extSel, members, history, showStatus, setExtPreview, setExtToken, onUpdate, t } = ctx;
    if (!extPreview) return;
    ctx.control?.begin(t('share.importing'));
    const isPK = extSource === 'pk';
    setImporting(true);
    try {
      const batch: Record<string, unknown> = {};

      if (extSel.system && extPreview.system) {
        const name = isPK ? extPreview.system.name : (extPreview.system.content?.username || extPreview.system.content?.name || extPreview.system.username || system.name);
        const desc = isPK ? (extPreview.system.description || system.description) : (extPreview.system.content?.desc || extPreview.system.content?.description || system.description);
        batch[KEYS.system] = {...system, name: name || system.name, description: desc};
      }
      const spUid = String(extPreview.system?.id || extPreview.system?.uid || '');
      let newM: Member[] = extSel.members && extPreview.members.length > 0
        ? extPreview.members.map((m: any) => ({
            id: uid(), name: isPK ? ((extSel.displayNames ? (m.display_name || m.name) : (m.name || m.display_name)) || 'Unknown') : (m.content?.name || m.name || 'Unknown'),
            // With the pronouns toggle off, PK members arrive blank here and
            // hand-written pronouns on existing members stay untouched.
            pronouns: isPK ? (extSel.pronouns !== false ? (m.pronouns || '') : '') : (m.content?.pronouns || ''),
            role: isPK ? '' : (m.content?.role || ''),
            color: isPK ? (m.color ? `#${m.color}` : '#DAA520') : (m.content?.color || '#DAA520'),
            description: isPK ? (m.description || '') : (m.content?.desc || ''),
            avatar: extSel.avatars ? (isPK ? (m.avatar_url || undefined) : (spAvatarUrl(m.content, spUid) || undefined)) : undefined,
            pkProxyTags: isPK && Array.isArray(m.proxy_tags) ? m.proxy_tags : undefined,
            pkAvatarUrl: isPK && typeof m.avatar_url === 'string' && m.avatar_url ? m.avatar_url : undefined,
            pkBannerUrl: isPK && typeof m.banner === 'string' && m.banner ? m.banner : undefined,
            pkKeepProxy: isPK && typeof m.keep_proxy === 'boolean' ? m.keep_proxy : undefined,
            tags: [] as string[], groupIds: [] as string[],
          }))
        : [];
      if (extSel.avatars && newM.length > 0) newM = await inlineRemoteAvatars(newM);
      let membersAfter: Member[] = members;
      let membersDirty = false;
      if (newM.length > 0) {
        membersAfter = [...members, ...newM.filter(nm => !members.find(em => em.name.toLowerCase() === nm.name.toLowerCase()))];
        membersDirty = true;
      }
      // Overwrite treats the fetch as the whole roster: locals whose name the
      // import doesn't carry are soft-tombstoned (custom fronts and facets
      // exempt). Update keeps everything local.
      if (ctx.importMode === 'overwrite' && extSel.members && extPreview.members.length > 0) {
        const importNames = new Set(extPreview.members.map((m: any) => String((isPK ? (extSel.displayNames ? (m.display_name || m.name) : (m.name || m.display_name)) : (m.content?.name || m.name)) || 'Unknown').trim().toLowerCase()));
        membersAfter = membersAfter.map(m => (importNames.has(String(m.name || '').trim().toLowerCase()) || m.isCustomFront || m.isFacet || m.deleted) ? m : { ...m, archived: true, deleted: true });
        membersDirty = true;
      }

      const normId = (raw: any): string => {
        if (raw == null) return '';
        if (typeof raw === 'string') return raw;
        if (typeof raw === 'number') return String(raw);
        if (typeof raw === 'object') {
          if (typeof raw.$oid === 'string') return raw.$oid;
          if (typeof raw._id === 'string') return raw._id;
          if (typeof raw.id === 'string') return raw.id;
          if (typeof raw.toString === 'function') { const s = raw.toString(); if (s && s !== '[object Object]') return s; }
        }
        return '';
      };
      const spLocalByName = (spm: any): Member | undefined => {
        const nm = String(spm.content?.name || spm.name || '').trim().toLowerCase();
        return nm ? membersAfter.find(l => l.name.toLowerCase() === nm) : undefined;
      };

      if (!isPK && extSel.customFields && extPreview.customFields && extPreview.customFields.length > 0) {
        const SP_TYPE_MAP: Record<string, CustomFieldType> = {'0': 'text', '1': 'color', '2': 'date', '3': 'month', '4': 'year', '5': 'monthYear', '6': 'timestamp', '7': 'monthDay', text: 'text', number: 'number', checkbox: 'toggle', toggle: 'toggle', date: 'date', markdown: 'markdown'};
        const existingDefs = await store.getStrict<CustomFieldDef[]>(KEYS.customFieldDefs, []) || [];
        const fieldIdMap: Record<string, string> = {};
        const newDefs: CustomFieldDef[] = [];
        extPreview.customFields.forEach((cf: any, i: number) => {
          const candidates = [cf.id, cf.uuid, cf._id, cf.content?._id, cf.content?.id, cf.content?.uuid, cf.content?.order, cf.order, String(i)];
          const spIds = candidates.map(normId).filter(Boolean);
          const spName = String(cf.content?.name || cf.name || `Field ${i + 1}`);
          const ex = existingDefs.find(dd => dd.name.toLowerCase() === spName.toLowerCase());
          let localId: string;
          if (ex) { localId = ex.id; } else {
            localId = uid();
            newDefs.push({id: localId, name: spName, type: SP_TYPE_MAP[String(cf.content?.type ?? cf.type)] || 'text', sortOrder: cf.content?.order ?? i});
          }
          spIds.forEach(k => { fieldIdMap[k] = localId; });
          fieldIdMap['name:' + spName.toLowerCase().trim()] = localId;
        });
        if (newDefs.length > 0) batch[KEYS.customFieldDefs] = [...existingDefs, ...newDefs];
        membersAfter = membersAfter.map(lm => {
          const spm = extPreview.members.find((sm: any) => spLocalByName(sm)?.id === lm.id);
          if (!spm) return lm;
          const info = spm.content?.info || spm.info || spm.content?.fields || spm.fields;
          if (!info || typeof info !== 'object') return lm;
          const cfVals = [...(lm.customFields || [])];
          Object.entries(info).forEach(([spFieldId, rawValue]: [string, any]) => {
            const localFieldId = fieldIdMap[normId(spFieldId)] || fieldIdMap[spFieldId] || fieldIdMap['name:' + String(spFieldId).toLowerCase().trim()];
            if (!localFieldId) return;
            let value: any = rawValue;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              if ('value' in value) value = value.value;
              else if ('content' in value && typeof value.content === 'object' && 'value' in value.content) value = value.content.value;
            }
            if (value == null) return;
            const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            if (valStr === '') return;
            const ci = cfVals.findIndex(cv => cv.fieldId === localFieldId);
            if (ci >= 0) cfVals[ci] = {fieldId: localFieldId, value: valStr};
            else cfVals.push({fieldId: localFieldId, value: valStr});
          });
          return {...lm, customFields: cfVals};
        });
        membersDirty = true;
      }

      if (!isPK && extSel.groups && extPreview.groups && extPreview.groups.length > 0) {
        const existingGroups = await store.getStrict<MemberGroup[]>(KEYS.groups, []) || [];
        const mergedGroups: MemberGroup[] = [...existingGroups];
        const groupMemberSets: {localGroupId: string; extMemberIds: string[]}[] = [];
        extPreview.groups.forEach((g: any) => {
          const gName = String(g.content?.name || g.name || 'Group');
          const gColorRaw = String(g.content?.color || g.color || '').trim();
          const extMembers: string[] = Array.isArray(g.content?.members) ? g.content.members : (Array.isArray(g.members) ? g.members : []);
          let lg = mergedGroups.find(x => String(x.name).toLowerCase() === gName.toLowerCase());
          if (!lg) { lg = {id: uid(), name: gName, color: gColorRaw ? (gColorRaw.startsWith('#') ? gColorRaw : `#${gColorRaw}`) : undefined}; mergedGroups.push(lg); }
          groupMemberSets.push({localGroupId: lg.id, extMemberIds: extMembers.map(normId).filter(Boolean)});
        });
        batch[KEYS.groups] = mergedGroups;
        const extToLocal: Record<string, string> = {};
        extPreview.members.forEach((m: any) => {
          const eid = normId(m._id || m.id);
          const lm = spLocalByName(m);
          if (eid && lm) extToLocal[eid] = lm.id;
        });
        membersAfter = membersAfter.map(lm => {
          const additions = groupMemberSets
            .filter(gs => gs.extMemberIds.some(eid => extToLocal[eid] === lm.id))
            .map(gs => gs.localGroupId)
            .filter(gid => !(lm.groupIds || []).includes(gid));
          if (additions.length === 0) return lm;
          return {...lm, groupIds: [...(lm.groupIds || []), ...additions]};
        });
        membersDirty = true;
      }

      if (membersDirty) batch[KEYS.members] = membersAfter;

      if (extSel.frontHistory && extPreview.switches.length > 0) {
        const allMembers = membersAfter;
        const idMap: Record<string, string> = {};
        extPreview.members.forEach((m: any, i: number) => {
          const eid = isPK ? (m.uuid || m.id) : m.id;
          const name = isPK ? (m.display_name || m.name || '') : (m.content?.name || m.name || '');
          const lm = allMembers.find(l => l.name.toLowerCase() === name.toLowerCase());
          if (eid && lm) idMap[eid] = lm.id;
          if (isPK && m.id && lm) idMap[m.id] = lm.id;
        });
        const newH: HistoryEntry[] = isPK
          ? extPreview.switches.map((sw: any, i: number, arr: any[]) => {
              const next = arr[i - 1];
              const ids = (Array.isArray(sw.members) ? sw.members : []).map((eid: string) => idMap[eid]).filter(Boolean) as string[];
              return {memberIds: ids, startTime: new Date(sw.timestamp).getTime(), endTime: next ? new Date(next.timestamp).getTime() : null, note: ''} as HistoryEntry;
            }).filter((h: HistoryEntry) => h.memberIds.length > 0)
          : extPreview.switches.map((sw: any) => {
              const externalIds: string[] = Array.isArray(sw.members) ? sw.members : (sw.content?.member ? [sw.content.member] : []);
              const ids = externalIds.map((eid: string) => idMap[eid]).filter(Boolean) as string[];
              const rawTs = sw.content?.startTime || sw.content?.timestamp || sw.timestamp;
              const startTime = typeof rawTs === 'number' ? rawTs : new Date(rawTs).getTime();
              const rawEnd = sw.content?.endTime;
              const endTime = rawEnd ? (typeof rawEnd === 'number' ? rawEnd : new Date(rawEnd).getTime()) : null;
              return {memberIds: ids, startTime, endTime, note: ''} as HistoryEntry;
            }).filter((h: HistoryEntry) => h.memberIds.length > 0 && h.startTime > 0);
        if (newH.length > 0) {
          const merged = [...newH, ...history].sort((a, b) => b.startTime - a.startTime);
          batch[KEYS.history] = merged;
        }
      }

      if (Object.keys(batch).length === 0) {
        showStatus(t('share.statusNothingToImport'));
        return;
      }

      await store.setBatch(batch);

      showStatus(t('share.statusImportedCounts', {members: newM.length, switches: extPreview.switches.length}));
      setExtPreview(null); setExtToken('');
      onUpdate();
    } catch (e: any) {
      // A user stop is not a failure. This path buffers into `batch` and writes
      // once at the end, so stopping before that leaves the data untouched.
      if (isImportStopped(e)) showStatus(t('share.importStopped', {defaultValue: 'Import stopped. Nothing was changed.'}));
      else showStatus(t('share.statusImportErrorSafe', {msg: e.message}));
    }
    finally { setImporting(false); }
};
