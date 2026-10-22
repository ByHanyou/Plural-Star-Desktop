import { store, KEYS } from '../storage';
import { importNameKey } from './importNames';
import { Member, JournalEntry, ChatChannel, CustomFieldDef, MemberGroup, uid, findOpenFrontInHistory } from '../utils';
import type { ConvertedImport } from './converted';
import { convertOurcana } from './ourcana';
import { convertParallax } from './parallax';
import { convertMultiplicity } from './multiplicity';
import { convertOctocon } from './octocon';
import { convertTupperbox } from './tupperbox';
import { amparToDatabaseJson, convertAmpersandJson } from './ampersand';
import { mergeHistoryEntries, finalizeMemberReplace, journalSig } from './convert';
import { looksLikeOurcana, looksLikeMultiplicity, looksLikeOctocon, isParallaxDb, isAmpersandJson, isTupperboxExport, findOurcanaJsonEntry } from './detect';
import { isAmparBytes } from './ampar';
import { unzipSync, strFromU8 } from 'fflate';
import { inlineRemoteAvatars } from './importMedia';
import { ImportCtx, importErrorText } from './ctx';
import { log } from '../utils/log';
import { pickBrowserFile } from '../utils/filePick';
import { appendChat, channelByName, importedSystem, mergeImportedGroups, mergeTarget, remapHistory } from './applyCommon';

export const handleImportForeign = async (ctx: ImportCtx) => {
  const { setImporting, showStatus, history, system, onUpdate, t } = ctx;
  pickBrowserFile('.json,.our,.ampar', async file => {
    setImporting(true);
    try {
      ctx.control?.beginFromLabel(t('share.importing'));
      let conv: ConvertedImport | null = null;
      const buf = new Uint8Array(await file.arrayBuffer());
      if (isAmparBytes(buf)) {
        try { conv = convertAmpersandJson(await amparToDatabaseJson(buf)); } catch (e) { log.debug('import', e); showStatus(t('share.statusUnrecognized'), true); return; }
      }
      if (!conv) {
        const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 3 || buf[2] === 5 || buf[2] === 7);
        let text: string;
        let ourZipFiles: Record<string, Uint8Array> | undefined;
        if (isZip) {
          const files = unzipSync(buf);
          const name = findOurcanaJsonEntry(files);
          if (!name) { showStatus(t('share.statusArchiveNoJson'), true); return; }
          text = strFromU8(files[name]);
          ourZipFiles = files;
        } else {
          text = strFromU8(buf);
        }
        const parsedJson: unknown = (() => { try { return JSON.parse(text); } catch { return null; } })();
        if (isAmpersandJson(parsedJson)) {
          conv = convertAmpersandJson(parsedJson);
        } else if (isTupperboxExport(parsedJson)) {
          conv = convertTupperbox(parsedJson);
        } else if (isParallaxDb(parsedJson)) {
          conv = convertParallax(parsedJson);
        } else if (looksLikeOurcana(parsedJson)) {
          conv = convertOurcana(parsedJson, ourZipFiles);
        } else if (looksLikeMultiplicity(parsedJson)) {
          conv = convertMultiplicity(parsedJson);
        } else if (looksLikeOctocon(parsedJson)) {
          conv = convertOctocon(parsedJson);
        } else {
          showStatus(t('share.statusUnrecognized'), true);
          return;
        }
      }
      if (!conv || (conv.members.length === 0 && conv.history.length === 0)) { showStatus(t('share.statusNothingInFile'), true); return; }

      const batch: Record<string, unknown> = {};
      const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
      const merged = [...existing];
      const idRemap = new Map<string, string>();
      const toAdd: Member[] = [];
      conv.members.forEach(nm => {
        const di = mergeTarget(merged, idRemap, nm.sourceId, nm.name);
        if (di >= 0) {
          const dup = merged[di];
          idRemap.set(nm.id, dup.id);
          if (dup.deleted) merged[di] = { ...dup, deleted: false, archived: nm.archived ?? false };
        } else { idRemap.set(nm.id, nm.id); toAdd.push(nm); }
      });
      let membersOut = [...finalizeMemberReplace(merged, idRemap, ctx.importMode), ...await inlineRemoteAvatars(toAdd)];

      if (conv.history.length > 0) {
        const mergedHistory = mergeHistoryEntries(remapHistory(conv.history, idRemap), history);
        batch[KEYS.history] = mergedHistory;
        const open = findOpenFrontInHistory(mergedHistory);
        if (open) batch[KEYS.front] = open;
      }
      if (conv.journal && conv.journal.length > 0) {
        const existingJournal = await store.getStrict<JournalEntry[]>(KEYS.journal, []) || [];
        const seen = new Set(existingJournal.map(journalSig));
        const addJournal = conv.journal
          .filter(e => !seen.has(journalSig(e)))
          .map(e => ({
            ...e,
            id: uid(),
            hashtags: e.hashtags || [],
            authorIds: e.authorIds.map(id => idRemap.get(id) || id),
          }));
        if (addJournal.length > 0) {
          batch[KEYS.journal] = [...addJournal, ...existingJournal].sort((a, b) => b.timestamp - a.timestamp);
        }
      }
      if (conv.groups && conv.groups.length > 0) {
        const { groups, remap } = mergeImportedGroups(await store.getStrict<MemberGroup[]>(KEYS.groups, []) || [], conv.groups, g => g.sourceId || `ext:${String(g.id)}`);
        batch[KEYS.groups] = groups.map(g => {
          const parentId = g.parentId && remap.get(g.parentId);
          return parentId ? { ...g, parentId } : g;
        });
        membersOut = membersOut.map(m =>
          m.groupIds && m.groupIds.some(gid => remap.has(gid))
            ? { ...m, groupIds: m.groupIds.map(gid => remap.get(gid) || gid) }
            : m);
      }
      batch[KEYS.members] = membersOut;
      if (conv.customFieldDefs && conv.customFieldDefs.length > 0) {
        const existingDefs = await store.getStrict<CustomFieldDef[]>(KEYS.customFieldDefs, []) || [];
        const names = new Set(existingDefs.map(d => importNameKey(d.name)));
        batch[KEYS.customFieldDefs] = [...existingDefs, ...conv.customFieldDefs.filter(d => !names.has(importNameKey(d.name)))];
      }
      if (conv.chat && conv.chat.length > 0) {
        const mergedCh: ChatChannel[] = [...(await store.getStrict<ChatChannel[]>(KEYS.chatChannels, []) || [])];
        for (const ch of conv.chat) {
          const channelId = channelByName(mergedCh, ch.name, ch.createdAt).id;
          if (ch.messages.length === 0) continue;
          await appendChat(batch, channelId, ch.messages.map(msg => ({ id: uid(), channelId, authorId: idRemap.get(msg.authorId) || msg.authorId, type: 'text', content: msg.content, timestamp: msg.timestamp })));
        }
        batch[KEYS.chatChannels] = mergedCh;
      }
      const sys = importedSystem(system, conv);
      if (sys) batch[KEYS.system] = sys;

      await store.setBatch(batch);
      showStatus(t('share.statusForeignImported', {label: conv.sourceLabel, members: toAdd.length, history: conv.history.length}));
      onUpdate();
    } catch (e) {
      showStatus(t('share.statusImportErrorSafe', {msg: importErrorText(e, t)}), true);
    } finally {
      setImporting(false);
    }
  });
};
