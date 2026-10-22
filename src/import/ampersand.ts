import { Member, HistoryEntry, MemberGroup, CustomFieldDef, CustomFieldValue, asRecord, uid } from '../utils';
import { importNameKey } from './importNames';
import i18n from '../i18n/i18n';
import { bytesToDataUri } from './importMedia';
import { asArray } from './formats';
import { normHex, pxTime, convertAmpersandFronts, localIds } from './convert';
import { amparTables } from './ampar';
import type { AmExportJson, AmAppConfig, AmSystem, AmMember, AmFront, AmField, AmTag, AmPost, AmBoardMessage, AmPollEntry, AmPollVote } from './formats';
import { ConvertedImport, unnamed, fieldName } from './converted';

export const amparToDatabaseJson = async (bytes: Uint8Array): Promise<AmExportJson> => {
  const byTable = await amparTables(bytes);
  const fileUri = (v: unknown): unknown => {
    const rec = asRecord(v);
    const raw = rec?.value;
    const meta = asRecord(rec?._meta);
    if (!(raw instanceof Uint8Array) || !meta || meta.type !== 'file') return v;
    try { return bytesToDataUri(raw, String(meta.name || 'x.png')); } catch { return undefined; }
  };
  const members: AmMember[] = asArray<AmMember>(byTable.members).map(m => {
    const out: AmMember = {...m, image: fileUri(m?.image), cover: fileUri(m?.cover)};
    const pairs = asRecord(m?.customFields)?.value;
    if (!Array.isArray(pairs)) return out;
    out.customFields = Object.fromEntries(pairs.flatMap((pair): [string, unknown][] => (Array.isArray(pair) && pair.length >= 2 ? [[String(pair[0]), pair[1]]] : [])));
    return out;
  });
  return {
    database: {
      systems: asArray<AmSystem>(byTable.systems),
      members,
      frontingEntries: asArray<AmFront>(byTable.frontingEntries),
      customFields: asArray<AmField>(byTable.customFields),
      tags: asArray<AmTag>(byTable.tags),
      journalPosts: asArray<AmPost>(byTable.journalPosts),
      boardMessages: asArray<AmBoardMessage>(byTable.boardMessages),
    },
    config: asArray<AmAppConfig>(byTable.__config)[0] || {},
  };
};

const pollBody = (b: AmBoardMessage, memberName: ReadonlyMap<string, string>): string => {
  const body = String(b?.body || '');
  const entries = asArray<AmPollEntry>(b?.poll?.entries);
  if (entries.length === 0) return body;
  const lines = entries.map(e => {
    const votes = asArray<AmPollVote>(e?.votes);
    const who = votes.map(v => {
      const n = memberName.get(String(v?.member)) || '';
      const reason = String(v?.reason || '').trim();
      return reason ? `${n} (${reason})` : n;
    }).filter(Boolean);
    return `- **${String(e?.choice || '')}** - ${votes.length}${who.length ? `: ${who.join(', ')}` : ''}`;
  });
  return `${body}\n\n${lines.join('\n')}`.trim();
};

export const convertAmpersandJson = (d: AmExportJson): ConvertedImport => {
  const db = d.database || {};
  const mem = asArray<AmMember>(db.members);
  const systems = asArray<AmSystem>(db.systems);
  const tags = asArray<AmTag>(db.tags);
  const fieldDefs = asArray<AmField>(db.customFields);

  const defaultId = String(d?.config?.appConfig?.defaultSystem || '');
  const sys: AmSystem = systems.find(s => String(s?.uuid) === defaultId) || systems[0] || {};

  const cfDefs: CustomFieldDef[] = fieldDefs.map((f, i) => ({
    id: uid(),
    name: fieldName(f?.name, i),
    type: 'text',
    sortOrder: f?.priority ?? i,
  }));
  const cfIdMap = new Map(fieldDefs.map((f, i) => [String(f?.uuid), cfDefs[i].id]));

  let ageFieldId = '';
  const ageFieldName = i18n.t('share.ageField');
  if (mem.some(a => a?.age != null && String(a.age).trim() !== '')
      && !cfDefs.some(f => importNameKey(f.name) === importNameKey(ageFieldName))) {
    ageFieldId = uid();
    cfDefs.push({ id: ageFieldId, name: ageFieldName, type: 'text', sortOrder: cfDefs.length });
  }

  const usedTags = new Set<string>();
  mem.forEach(a => asArray(a?.tags).forEach(t => usedTags.add(String(t))));
  const groups: MemberGroup[] = [];
  const tagIdMap = new Map<string, string>();
  tags.filter(tg => tg && (tg.type === 'member' || tg.type === undefined)).forEach(tg => {
    const name = String(tg.name || '').trim();
    if (!name || tg.isArchived || !usedTags.has(String(tg.uuid))) return;
    const gid = uid();
    tagIdMap.set(String(tg.uuid), gid);
    groups.push({ id: gid, name, color: tg.color ? normHex(tg.color) : undefined, sourceId: 'amp:' + String(tg.uuid) });
  });

  const sysGroupMap = new Map<string, string>();
  if (systems.length > 1) {
    systems.forEach((sy, i) => {
      const gid = uid();
      if (sy?.uuid != null) sysGroupMap.set(String(sy.uuid), gid);
      groups.push({ id: gid, name: (sy?.name && String(sy.name).trim()) || i18n.t('share.systemN', {n: i + 1}), sourceId: 'amp:sys:' + String(sy?.uuid || i) });
    });
  }

  const idMap = new Map<string, string>();
  const dataUri = (v: unknown): string | undefined => {
    const s = String(v || '');
    return s.startsWith('data:') ? s : undefined;
  };
  const members: Member[] = mem
    .filter(a => !!a)
    .map(a => {
      const id = uid();
      idMap.set(String(a.uuid), id);
      const cfs: CustomFieldValue[] = [];
      const vals = asRecord(a.customFields) || {};
      for (const k in vals) {
        const fid = cfIdMap.get(String(k));
        const v = vals[k];
        if (!fid || v === null || v === undefined || v === '') continue;
        cfs.push({ fieldId: fid, value: typeof v === 'object' ? JSON.stringify(v) : String(v) });
      }
      if (ageFieldId && a?.age != null && String(a.age).trim() !== '') {
        cfs.push({ fieldId: ageFieldId, value: String(a.age) });
      }
      return {
        id,
        sourceId: 'amp:' + String(a.uuid),
        name: unnamed(a.name),
        pronouns: String(a.pronouns || ''),
        role: String(a.role || ''),
        color: normHex(a.color),
        description: String(a.description || ''),
        archived: !!a.isArchived,
        isCustomFront: !!(a.isCustomFront || a.isDissociativeState),
        avatar: dataUri(a.image),
        banner: dataUri(a.cover),
        createdAt: pxTime(a.dateCreated) || undefined,
        tags: [],
        groupIds: [
          ...localIds(tagIdMap, asArray(a.tags)),
          ...(a.system != null ? localIds(sysGroupMap, [a.system]) : []),
        ],
        customFields: cfs,
      };
    });

  const history: HistoryEntry[] = convertAmpersandFronts(asArray<AmFront>(db.frontingEntries), idMap);

  const tagName = new Map<string, string>();
  tags.forEach(tg => { if (tg?.uuid != null) tagName.set(String(tg.uuid), String(tg.name || '')); });
  const memberName = new Map(mem.map(a => [String(a?.uuid), String(a?.name || '').trim()]));
  const authorOf = (u: unknown): string[] => localIds(idMap, [u]);
  const journal: NonNullable<ConvertedImport['journal']> = [
    ...asArray<AmPost>(db.journalPosts).map(p => ({
      title: String(p?.title || '').trim(),
      body: String(p?.body || ''),
      authorIds: authorOf(p?.member),
      hashtags: asArray(p?.tags).flatMap(t => tagName.get(String(t)) || []),
      timestamp: pxTime(p?.date),
      pinned: !!p?.isPinned,
    })),
    ...asArray<AmBoardMessage>(db.boardMessages).map(b => ({
      title: String(b?.title || '').trim(),
      body: pollBody(b, memberName),
      authorIds: authorOf(b?.member),
      hashtags: [],
      timestamp: pxTime(b?.date),
      pinned: !!b?.isPinned,
    })),
  ];

  return {
    sourceLabel: 'Ampersand',
    members,
    history,
    groups,
    customFieldDefs: cfDefs,
    systemName: sys?.name ? String(sys.name) : undefined,
    systemDesc: sys?.description ? String(sys.description) : undefined,
    journal: journal.filter(e => e.title || e.body).sort((a, b) => b.timestamp - a.timestamp),
  };
};
