import { store, KEYS } from '../storage';
import { importNameKey } from './importNames';
import { Member, HistoryEntry, JournalEntry, ChatChannel, ChatMessage, MemberGroup, NoteboardEntry, asRecord, pushTo, uid, truncateRunes, findOpenFrontInHistory } from '../utils';
import { mergeForeignMember, mergeHistoryEntries, finalizeMemberReplace, chatSig, localIds } from './convert';
import { unzipSync, strFromU8 } from 'fflate';
import { bytesToDataUri, zipEntry } from './importMedia';
import { ImportCtx, ImportUserError, importErrorText } from './ctx';
import { asArray } from './formats';
import { log } from '../utils/log';
import type { PlExport, PlFolder, PlJournal, PlChannel, PlMessage, PlFrontMessage } from './formats';
import { appendChat, channelByName, readFileBytes } from './applyCommon';

const PL_ARGB_MASK = 0xffffff;
const plArgbToHex = (n: unknown): string => {
  const num = typeof n === 'number' && Number.isFinite(n) ? n : NaN;
  if (Number.isNaN(num)) return '#DAA520';
  return `#${(num & PL_ARGB_MASK).toString(16).padStart(6, '0').toUpperCase()}`;
};
const plCsv = (s: unknown): string[] => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const plBaseName = (p: unknown): string => String(p || '').split('/').pop() || '';
export const isPluralLogDb = (o: unknown): o is PlExport => {
  const r = asRecord(o);
  return !!r && Array.isArray(r.members) && Array.isArray(r.switchEvents) && !!r.config && typeof r.config === 'object';
};

export const handleImportPluralLog = async (ctx: ImportCtx) => {
  const { t, setImporting, showStatus, history, system, onUpdate } = ctx;
  const filePath = await window.electronAPI.dialog.openFile([
    { name: t('share.plurallogFilterName'), extensions: ['zip'] },
    { name: t('fileDialog.allFiles'), extensions: ['*'] },
  ]);
  if (!filePath) return;
  setImporting(true);
  try {
    const files = unzipSync(await readFileBytes(filePath, t('share.plurallogNeedsZip')));
    let manifestJson: string | undefined;
    if (files['manifest.json']) {
      try {
        const manifest = asRecord(JSON.parse(strFromU8(files['manifest.json'])));
        if (typeof manifest?.exportJson === 'string') manifestJson = manifest.exportJson;
      } catch (e) { log.debug('import', e); }
    }
    const dbName = (manifestJson && zipEntry(files, manifestJson))
      ? manifestJson
      : Object.keys(files).find(n => /(^|\/)plurallog_export.*\.json$/i.test(n));
    const dbBytes = dbName ? zipEntry(files, dbName) : undefined;
    let db: unknown = null;
    if (dbBytes) { try { db = JSON.parse(strFromU8(dbBytes)); } catch (e) { log.debug('import', e); } }
    if (!isPluralLogDb(db)) throw new ImportUserError(t('share.plurallogNeedsZip'));

    const batch: Record<string, unknown> = {};
    const plMembers = db.members;
    const idMap = new Map<string, string>();

    if (db.config?.systemName) {
      batch[KEYS.system] = { ...system, name: String(db.config.systemName) || system.name };
    }

    const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
    const merged = [...existing];
    plMembers.forEach(m => {
      if (!m || !m.id) return;
      mergeForeignMember(merged, idMap, 'pl:' + String(m.id), {
        name: (m.name && String(m.name).trim()) || t('share.unnamedMember'),
        pronouns: String(m.pronouns || ''),
        role: String(m.role || ''),
        color: plArgbToHex(m.color),
        description: String(m.description || m.profileMarkdown || ''),
        archived: !!m.archived,
        ...(m.parentMemberId ? { isFacet: true } : {}),
      });
    });
    let allMembers: Member[] = finalizeMemberReplace(merged, idMap, ctx.importMode);

    let avatarsLoaded = 0;
    plMembers.forEach(m => {
      const localId = idMap.get(String(m?.id));
      const entryName = m?.profileImagePath ? `stored_media/${plBaseName(m.profileImagePath)}` : '';
      const entry = entryName ? zipEntry(files, entryName) : undefined;
      if (!localId || !entry) return;
      allMembers = allMembers.map(x => x.id === localId ? { ...x, avatar: bytesToDataUri(entry, entryName) } : x);
      avatarsLoaded++;
    });

    const folders = asArray<PlFolder>(db.folders);
    if (folders.length > 0) {
      const existingGroups = await store.getStrict<MemberGroup[]>(KEYS.groups, []) || [];
      const groups = [...existingGroups];
      const folderIdMap = new Map<string, string>();
      folders.forEach((f, i) => {
        const name = (f?.name && String(f.name).trim()) || t('share.groupN', {n: i + 1});
        const found = groups.find(g => importNameKey(g.name) === importNameKey(name));
        const localId = found ? found.id : uid();
        if (!found) groups.push({ id: localId, name, color: plArgbToHex(f.colorValue), sortOrder: f.sortOrder ?? i });
        folderIdMap.set(String(f.id), localId);
      });
      folders.forEach(f => {
        const localId = folderIdMap.get(String(f.id));
        const parent = f.parentFolderId ? folderIdMap.get(String(f.parentFolderId)) : null;
        if (!localId || !parent) return;
        const idx = groups.findIndex(g => g.id === localId);
        if (idx >= 0) groups[idx] = { ...groups[idx], parentId: parent };
      });
      batch[KEYS.groups] = groups;
      const membership = new Map<string, string[]>();
      folders.forEach(f => {
        const gid = folderIdMap.get(String(f.id));
        if (!gid) return;
        plCsv(f.memberIds).forEach(mid => {
          const local = idMap.get(mid);
          if (local) pushTo(membership, local, gid);
        });
      });
      allMembers = allMembers.map(m => {
        const add = (membership.get(m.id) || []).filter(g => !(m.groupIds || []).includes(g));
        return add.length ? { ...m, groupIds: [...(m.groupIds || []), ...add] } : m;
      });
    }
    batch[KEYS.members] = allMembers;

    let historyAdded = 0;
    if (db.switchEvents.length > 0) {
      const entries: HistoryEntry[] = [];
      [...db.switchEvents]
        .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))
        .forEach(s => {
          const primary = idMap.get(String(s.memberId));
          if (!primary || !s.startTime) return;
          const co = localIds(idMap, plCsv(s.cofronterIds));
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
      if (fresh.length > 0) {
        const mergedHistory = mergeHistoryEntries(entries, history);
        batch[KEYS.history] = mergedHistory;
        const open = findOpenFrontInHistory(mergedHistory);
        if (open) batch[KEYS.front] = open;
      }
    }

    const journal = asArray<PlJournal>(db.journal);
    if (journal.length > 0) {
      const existingJ = await store.getStrict<JournalEntry[]>(KEYS.journal, []) || [];
      const jSig = (e: JournalEntry) => `${e.timestamp}|${e.body}`;
      const seenJ = new Set(existingJ.map(jSig));
      const added: JournalEntry[] = [];
      journal.forEach(j => {
        const body = String(j?.text || '').trim();
        if (!body || !j.timestamp) return;
        const author = idMap.get(String(j.authorId));
        const tags = plCsv(j.tags).map(x => (x.startsWith('#') ? x : `#${x}`));
        if (j.emotion) tags.push(`#${String(j.emotion)}`);
        const entry: JournalEntry = {
          id: uid(),
          title: truncateRunes(body.split('\n')[0], 60),
          body,
          authorIds: author ? [author] : [],
          hashtags: [...new Set(tags)],
          timestamp: Number(j.timestamp),
        };
        if (!seenJ.has(jSig(entry))) { seenJ.add(jSig(entry)); added.push(entry); }
      });
      if (added.length) batch[KEYS.journal] = [...added, ...existingJ].sort((a, b) => b.timestamp - a.timestamp);
    }

    const plChannels = asArray<PlChannel>(db.channels);
    const plMessages = asArray<PlMessage>(db.messages);
    if (Array.isArray(db.channels) && plMessages.length > 0) {
      const channels: ChatChannel[] = [...(await store.getStrict<ChatChannel[]>(KEYS.chatChannels, []) || [])];
      const chMap = new Map<string, string>();
      plChannels.forEach((c, i) => {
        const name = (c?.name && String(c.name).trim()) || t('share.channelN', {n: i + 1});
        chMap.set(String(c.id), channelByName(channels, name, Date.now()).id);
      });
      batch[KEYS.chatChannels] = channels;
      const byChannel = new Map<string, ChatMessage[]>();
      plMessages.forEach(m => {
        const channelId = chMap.get(String(m.channelId));
        const authorId = idMap.get(String(m.authorId));
        const content = String(m?.text || '');
        if (!channelId || !authorId || !content || !m.timestamp) return;
        pushTo(byChannel, channelId, { id: uid(), channelId, authorId, type: 'text', content, timestamp: Number(m.timestamp) });
      });
      for (const [channelId, msgs] of byChannel) await appendChat(batch, channelId, msgs);
    }

    const frontMessages = asArray<PlFrontMessage>(db.frontMessages);
    if (frontMessages.length > 0) {
      const existingN = await store.getStrict<NoteboardEntry[]>(KEYS.noteboards, []) || [];
      const seenN = new Set(existingN.map(chatSig));
      const added: NoteboardEntry[] = [];
      frontMessages.forEach(fm => {
        const memberId = idMap.get(String(fm.toMemberId));
        const authorId = idMap.get(String(fm.fromMemberId));
        const content = String(fm?.text || '');
        if (!memberId || !authorId || !content || !fm.createdAt) return;
        const entry: NoteboardEntry = { id: uid(), memberId, authorId, content, timestamp: Number(fm.createdAt), read: !!fm.read };
        if (!seenN.has(chatSig(entry))) { seenN.add(chatSig(entry)); added.push(entry); }
      });
      if (added.length) batch[KEYS.noteboards] = [...existingN, ...added];
    }

    await store.setBatch(batch);
    showStatus(t('share.statusImportedCounts', { members: plMembers.length, switches: historyAdded }));
    onUpdate();
  } catch (e) {
    showStatus(t('share.statusError', { msg: importErrorText(e, t) }), true);
  } finally {
    setImporting(false);
  }
};
