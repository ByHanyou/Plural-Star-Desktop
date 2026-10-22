import { store, KEYS } from '../storage';
import { importNameKey } from './importNames';
import { Member, JournalEntry, ChatChannel, CustomFieldDef, CustomFieldType, MemberGroup, MemberPoll, withFieldValue, pushTo, uid, findOpenFrontInHistory } from '../utils';
import i18n from '../i18n/i18n';
import { asArray } from './formats';
import { msOf, normHex, convertPluralSpaceFronts, finalizeMemberReplace, mergeHistoryEntries, isOpenPluralSystem, isPluralSpaceExport, normalizeOpenPlural, journalSig } from './convert';
import type { PsExport, PsMember, PsFront, PsFieldDef, PsFieldValue, PsGroup, PsJournalEntry, PsChannel, PsMessage, PsPoll, PsPollOption, PsRef } from './formats';
import { ConvertedImport, httpUrl, unnamed, fieldName } from './converted';
import { unzipSync, strFromU8 } from 'fflate';
import { bytesToDataUri, inlineRemoteAvatars, zipEntry } from './importMedia';
import { ImportCtx, ImportUserError, importErrorText } from './ctx';
import { log } from '../utils/log';
import { appendChat, channelByName, importedSystem, mergeImportedGroups, mergeTarget, readFileBytes, remapHistory } from './applyCommon';

interface PluralSpaceImport extends ConvertedImport {
  journal: { title: string; body: string; authorIds: string[]; timestamp: number }[];
  chatChannels: { name: string; createdAt: number; messages: { authorId: string; content: string; timestamp: number }[] }[];
  polls: { question: string; createdBy: string; createdAt: number; closedAt?: number; options: { text: string; votes: string[] }[] }[];
  avatarMediaPaths: Record<string, string>;
}

const PS_TYPE = new Map<string, CustomFieldType>([['text', 'text'], ['number', 'number'], ['boolean', 'toggle'], ['toggle', 'toggle'], ['date', 'date'], ['color', 'color'], ['markdown', 'markdown']]);

const nameKey = (v: unknown): string => String(v || '').trim().toLowerCase();

export const convertPluralSpace = (d: PsExport): PluralSpaceImport => {
  const sys = d.system || {};
  const mem = asArray<PsMember>(d.members);

  const cfDefs: CustomFieldDef[] = [];
  const cfIdByName = new Map<string, string>();
  const ensureDef = (name: string, type?: unknown): string => {
    const key = name.toLowerCase();
    const known = cfIdByName.get(key);
    if (known) return known;
    const id = uid();
    cfDefs.push({ id, name, type: PS_TYPE.get(String(type)) ?? 'text', sortOrder: cfDefs.length });
    cfIdByName.set(key, id);
    return id;
  };
  asArray<PsFieldDef>(d.custom_fields).forEach((f, i) => ensureDef(fieldName(f?.name, i), f?.field_type));

  const groups: MemberGroup[] = [];
  const gmap = new Map<string, string>();
  asArray<PsGroup>(d.member_groups).forEach(g => {
    const gid = uid();
    const name = String(g?.name || i18n.t('memberGroups.group'));
    gmap.set(String(g?.id), gid);
    gmap.set(name.toLowerCase(), gid);
    groups.push({ id: gid, name, color: g?.color ? normHex(g.color) : undefined });
  });
  const groupIdsOf = (m: PsMember): string[] => (Array.isArray(m.groups) ? m.groups : []).map(g => {
    const k = typeof g === 'object' && g !== null ? String(g.id ?? g.name ?? '') : String(g);
    return gmap.get(k) || gmap.get(k.toLowerCase());
  }).filter((x): x is string => !!x);

  const idMap = new Map<string, string>();
  const nameToLocal = new Map<string, string>();
  const avatarMediaPaths: Record<string, string> = {};
  const members: Member[] = mem.map(m => {
    const id = uid();
    idMap.set(String(m.id), id);
    const n = nameKey(m.name);
    if (n) nameToLocal.set(n, id);
    const dn = nameKey(m.display_name);
    if (dn && !nameToLocal.has(dn)) nameToLocal.set(dn, id);
    const grouped = new Map<string, string[]>();
    asArray<PsFieldValue>(m.custom_field_values).forEach(cv => {
      const name = String(cv?.field_name || '').trim();
      if (!name || cv?.value == null) return;
      const fid = ensureDef(name);
      pushTo(grouped, fid, String(cv.value));
    });
    const mediaPath = String(m.avatar_media_path || '');
    if (mediaPath) avatarMediaPaths[id] = mediaPath;
    return {
      id, sourceId: 'ps:' + String(m.id),
      name: unnamed(String(m.name || '').trim() || m.display_name),
      pronouns: String(m.pronouns || ''),
      role: Array.isArray(m.role) ? m.role.join(', ') : String(m.role || ''),
      color: normHex(m.color), description: String(m.description || ''),
      archived: !!m.is_archived, isCustomFront: !!m.is_custom_front,
      createdAt: msOf(m.created_at) || undefined,
      avatar: httpUrl(m.avatar_path),
      tags: [], groupIds: groupIdsOf(m),
      customFields: [...grouped].map(([fieldId, vals]) => ({ fieldId, value: vals.join('\n') })),
    };
  });

  const history = convertPluralSpaceFronts(asArray<PsFront>(d.fronts), idMap);
  const byName = (name: unknown): string => nameToLocal.get(nameKey(name)) || '';
  const localOf = (ref: { id?: unknown; name?: unknown } | undefined): string =>
    idMap.get(String(ref?.id)) || byName(ref?.name);

  const journal = asArray<PsJournalEntry>(d.journal_entries).map(j => ({
    title: String(j?.title || '').trim(),
    body: String(j?.content || ''),
    authorIds: asArray<PsRef>(j?.members).map(localOf).filter(Boolean),
    timestamp: msOf(j?.date) || msOf(j?.created_at) || Date.now(),
  }));

  const chatChannels = asArray<PsChannel>(d.chat_channels).map(ch => ({
    name: String(ch?.name || '').trim() || i18n.t('chat.importedChannel'),
    createdAt: msOf(ch?.created_at) || Date.now(),
    messages: asArray<PsMessage>(ch?.messages).map(msg => ({
      authorId: byName(msg?.member_name),
      content: String(msg?.content || ''),
      timestamp: msOf(msg?.created_at) || Date.now(),
    })),
  }));

  const polls = asArray<PsPoll>(d.polls).map(p => {
    const desc = String(p?.description || '').trim();
    return {
      question: [String(p?.title || '').trim(), desc].filter(Boolean).join(' - ') || '?',
      createdBy: localOf(p?.created_by_member),
      createdAt: msOf(p?.created_at) || Date.now(),
      closedAt: p?.status && p.status !== 'open' ? (msOf(p?.closes_at) || Date.now()) : undefined,
      options: asArray<PsPollOption>(p?.options).map(o => ({
        text: String(o?.text || ''),
        votes: [...new Set(asArray<{member_name?: string}>(o?.votes).map(v => byName(v?.member_name)).filter(Boolean))],
      })),
    };
  });

  return {
    sourceLabel: 'PluralSpace', members, history, groups, customFieldDefs: cfDefs,
    systemName: sys.name, systemDesc: sys.description || undefined,
    journal, chatChannels, polls, avatarMediaPaths,
  };
};

export const handleImportPluralSpace = async (ctx: ImportCtx) => {
  const { t, setImporting, showStatus, history, system, onUpdate } = ctx;
  const filePath = await window.electronAPI.dialog.openFile([
    { name: t('share.psFilterName'), extensions: ['zip', 'json'] },
    { name: t('fileDialog.allFiles'), extensions: ['*'] },
  ]);
  if (!filePath) return;
  setImporting(true);
  try {
    const bytes = await readFileBytes(filePath, t('share.psNotExport'));
    let zipFiles: Record<string, Uint8Array> | null = null;
    let text: string;
    let openPluralPrefix = '';
    if (/\.zip$/i.test(filePath)) {
      zipFiles = unzipSync(bytes);
      const openPlural = Object.keys(zipFiles).find(k => /(^|\/)openplural\.json$/i.test(k));
      const jsonEntry = zipFiles['data.json']
        ? 'data.json'
        : Object.keys(zipFiles).find(k => /(^|\/)data\.json$/i.test(k)) || openPlural || Object.keys(zipFiles).find(k => /\.json$/i.test(k));
      if (!jsonEntry) throw new ImportUserError(t('share.psNotExport'));
      if (jsonEntry === openPlural) openPluralPrefix = jsonEntry.replace(/openplural\.json$/i, '');
      text = strFromU8(zipFiles[jsonEntry]);
    } else {
      text = new TextDecoder('utf-8').decode(bytes);
    }
    let d: unknown;
    try { d = JSON.parse(text); } catch { throw new ImportUserError(t('share.psNotExport')); }
    let ps: PsExport | null = null;
    if (isOpenPluralSystem(d)) ps = normalizeOpenPlural(d, openPluralPrefix);
    else if (isPluralSpaceExport(d)) ps = d;
    if (!ps) throw new ImportUserError(t('share.psNotExport'));
    const conv = convertPluralSpace(ps);

    const batch: Record<string, unknown> = {};

    const existingDefs = await store.getStrict<CustomFieldDef[]>(KEYS.customFieldDefs, []) || [];
    const defRemap = new Map<string, string>();
    const defsToAdd: CustomFieldDef[] = [];
    (conv.customFieldDefs || []).forEach(dd => {
      const ex = existingDefs.find(e => importNameKey(e.name) === importNameKey(dd.name));
      defRemap.set(dd.id, ex ? ex.id : dd.id);
      if (!ex) defsToAdd.push(dd);
    });
    if (defsToAdd.length > 0) batch[KEYS.customFieldDefs] = [...existingDefs, ...defsToAdd];

    const psGroups = conv.groups || [];
    const { groups: mergedGroupList, remap: groupRemap } = mergeImportedGroups(await store.getStrict<MemberGroup[]>(KEYS.groups, []) || [], psGroups, g => `ps:${String(g.id)}`);
    if (psGroups.length > 0) batch[KEYS.groups] = mergedGroupList;

    const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
    const merged = [...existing];
    const idRemap = new Map<string, string>();
    const toAdd: Member[] = [];
    conv.members.forEach(nm => {
      const fixed: Member = {
        ...nm,
        customFields: (nm.customFields || []).map(cv => ({ ...cv, fieldId: defRemap.get(cv.fieldId) || cv.fieldId })),
        groupIds: (nm.groupIds || []).map(g => groupRemap.get(g) || g),
      };
      const di = mergeTarget(merged, idRemap, nm.sourceId, nm.name);
      if (di >= 0) {
        const dup = merged[di];
        idRemap.set(nm.id, dup.id);
        const mergedCF = (fixed.customFields || []).reduce((acc, cv) => withFieldValue(acc, cv.fieldId, cv.value), dup.customFields || []);
        merged[di] = {
          ...dup, name: fixed.name, pronouns: fixed.pronouns, role: fixed.role, color: fixed.color,
          description: fixed.description, archived: fixed.archived,
          isCustomFront: dup.isCustomFront, isFacet: dup.isFacet,
          sourceId: nm.sourceId, customFields: mergedCF,
          groupIds: [...new Set([...(dup.groupIds || []), ...(fixed.groupIds || [])])],
          ...(dup.deleted ? { deleted: false } : {}),
        };
      } else {
        idRemap.set(nm.id, nm.id);
        toAdd.push(fixed);
      }
    });
    let allMembers: Member[] = [...finalizeMemberReplace(merged, idRemap, ctx.importMode), ...toAdd];

    let avatarsLoaded = 0;
    const sep = filePath.includes('\\') ? '\\' : '/';
    const baseDir = filePath.slice(0, filePath.lastIndexOf(sep));
    for (const [origId, rel] of Object.entries(conv.avatarMediaPaths)) {
      const localId = idRemap.get(origId) || origId;
      const relNorm = String(rel).replace(/^[/\\]+/, '');
      if (relNorm.includes('..')) continue;
      if (zipFiles) {
        const zipKey = relNorm.replace(/\\/g, '/');
        const entry = zipEntry(zipFiles, zipKey) || zipEntry(zipFiles, String(rel));
        if (entry) {
          allMembers = allMembers.map(m => m.id === localId ? { ...m, avatar: bytesToDataUri(entry, zipKey) } : m);
          avatarsLoaded++;
        }
        continue;
      }
      const abs = baseDir + sep + relNorm.replace(/[/\\]+/g, sep);
      const dataUrl = await window.electronAPI.file.readAsBase64(abs).catch(e => { log.debug('import', e); return null; });
      if (dataUrl) { allMembers = allMembers.map(m => m.id === localId ? { ...m, avatar: dataUrl } : m); avatarsLoaded++; }
    }
    allMembers = await inlineRemoteAvatars(allMembers);
    batch[KEYS.members] = allMembers;

    if (conv.history.length > 0) {
      const mergedHistory = mergeHistoryEntries(remapHistory(conv.history, idRemap), history);
      batch[KEYS.history] = mergedHistory;
      const open = findOpenFrontInHistory(mergedHistory);
      if (open) batch[KEYS.front] = open;
    }

    if (conv.journal.length > 0) {
      const existingJ = await store.getStrict<JournalEntry[]>(KEYS.journal, []) || [];
      const seenJ = new Set(existingJ.map(journalSig));
      const newJ: JournalEntry[] = conv.journal.map(j => ({
        id: uid(), title: j.title, body: j.body,
        authorIds: j.authorIds.map(id => idRemap.get(id) || id),
        hashtags: [], timestamp: j.timestamp,
      }));
      batch[KEYS.journal] = [...newJ.filter(j => !seenJ.has(journalSig(j))), ...existingJ].sort((a, b) => b.timestamp - a.timestamp);
    }

    if (conv.chatChannels.length > 0) {
      const mergedCh: ChatChannel[] = [...(await store.getStrict<ChatChannel[]>(KEYS.chatChannels, []) || [])];
      for (const ch of conv.chatChannels) {
        const channelId = channelByName(mergedCh, ch.name, ch.createdAt).id;
        if (ch.messages.length === 0) continue;
        await appendChat(batch, channelId, ch.messages.map(msg => ({
          id: uid(), channelId,
          authorId: idRemap.get(msg.authorId) || msg.authorId || '',
          type: 'text', content: msg.content, timestamp: msg.timestamp,
        })));
      }
      batch[KEYS.chatChannels] = mergedCh;
    }

    if (conv.polls.length > 0) {
      const existingPolls = await store.getStrict<MemberPoll[]>(KEYS.polls, []) || [];
      const pollSig = (p: MemberPoll) => `${p.createdAt}|${p.question}`;
      const seenP = new Set(existingPolls.map(pollSig));
      const newPolls: MemberPoll[] = conv.polls.map(p => {
        const creator = idRemap.get(p.createdBy) || p.createdBy || '';
        return {
          id: uid(), targetMemberId: creator, question: p.question,
          createdBy: creator, createdAt: p.createdAt, closedAt: p.closedAt,
          options: p.options.map(o => ({ id: uid(), label: o.text, votes: o.votes.map(v => idRemap.get(v) || v) })),
        };
      });
      batch[KEYS.polls] = [...existingPolls, ...newPolls.filter(p => !seenP.has(pollSig(p)))];
    }

    const sys = importedSystem(system, conv);
    if (sys) batch[KEYS.system] = sys;

    await store.setBatch(batch);
    showStatus(t('share.psImportDone', { members: toAdd.length, history: conv.history.length, avatars: avatarsLoaded }));
    onUpdate();
  } catch (e) {
    showStatus(t('share.statusError', {msg: importErrorText(e, t)}), true);
  } finally {
    setImporting(false);
  }
};
