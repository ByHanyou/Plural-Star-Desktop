import { Member, HistoryEntry, MemberGroup, CustomFieldDef, CustomFieldType, uid } from './utils';

export interface ConvertedImport {
  sourceLabel: string;
  members: Member[];
  history: HistoryEntry[];
  groups?: MemberGroup[];
  customFieldDefs?: CustomFieldDef[];
  systemName?: string;
  systemDesc?: string;
}

const hex = (c: any): string => { const s = String(c || '').trim(); return s.startsWith('#') ? s : (s ? `#${s}` : '#DAA520'); };
const toMs = (v: any): number => typeof v === 'number' ? (v > 1e12 ? v : v * 1000) : (v ? new Date(v).getTime() : 0);

const buildHistory = (
  switches: { members: any[]; startTime: any; endTime: any; note?: string }[],
  idMap: Record<string, string>,
): HistoryEntry[] =>
  switches
    .map(s => ({
      memberIds: (s.members || []).map((e: any) => idMap[String(e)]).filter(Boolean) as string[],
      startTime: toMs(s.startTime),
      endTime: s.endTime != null ? toMs(s.endTime) : null,
      note: s.note || '',
    }))
    .filter(h => h.memberIds.length > 0 && h.startTime > 0) as HistoryEntry[];

export type ForeignFormat = 'ourcana' | 'multiplicity' | 'octocon';

export const detectForeignFormat = (text: string): ForeignFormat | null => {
  try {
    const d = JSON.parse(text);
    // v3 is a graph with no top-level members array, so match the format tag
    // and the graph shape as well as the old flat layout.
    if (d.format === 'ourcana' || (d.graph && Array.isArray(d.graph.nodes)) || (!d._meta && Array.isArray(d.members) && Array.isArray(d.frontHistory) && d.members[0]?.id !== undefined)) return 'ourcana';
    if (d.app === 'multiplicity' || (Array.isArray(d.alters) && Array.isArray(d.front_entries))) return 'multiplicity';
    if (!d._meta && d.user && typeof d.user === 'object' && Array.isArray(d.alters)) return 'octocon';
  } catch {}
  return null;
};

/**
 * Ourcana v3 replaced the flat members/frontHistory arrays with a graph:
 * `graph.nodes` of type member | customField | system, plus `graph.edges`
 * (hasMember, system -> member). Custom fields are global definitions and each
 * member carries a { fieldId: value } map against them. Unknown node and edge
 * types are ignored on purpose so a future Ourcana release adds data rather
 * than breaking the import.
 */
const convertOurcanaGraph = (d: any): ConvertedImport => {
  const nodes: any[] = Array.isArray(d?.graph?.nodes) ? d.graph.nodes : [];
  const byType = (t: string) => nodes.filter(n => n && n.type === t);
  const sysNode = byType('system')[0];
  const sys = sysNode?.properties || {};

  // Field definitions first: members reference them by node id.
  const cfDefs: CustomFieldDef[] = [];
  const cfIdMap: Record<string, string> = {};
  byType('customField')
    .slice()
    .sort((a, b) => (a.properties?.order ?? 0) - (b.properties?.order ?? 0))
    .forEach((n: any, i: number) => {
      const p = n.properties || {};
      const id = uid();
      cfIdMap[String(n.id)] = id;
      const raw = String(p.type || 'text').toLowerCase();
      // Ours has no plain 'boolean' — the equivalent is 'toggle'.
      const type: CustomFieldType = raw === 'number' ? 'number' : raw === 'boolean' || raw === 'toggle' ? 'toggle' : raw === 'date' ? 'date' : 'text';
      cfDefs.push({ id, name: String(p.label || `Field ${i + 1}`).trim() || `Field ${i + 1}`, type, sortOrder: p.order ?? i });
    });

  const idMap: Record<string, string> = {};
  const members: Member[] = byType('member').map((n: any) => {
    const p = n.properties || {};
    const id = uid();
    idMap[String(n.id)] = id;
    const useDisplay = p.showOnlyDisplayName && p.displayName;
    // localAvatarPath is a path on THEIR device — never portable, so only a
    // real http(s) avatarUrl survives the trip.
    const avatar = /^https?:\/\//.test(String(p.avatarUrl || '')) ? String(p.avatarUrl) : undefined;
    const cfs: any[] = [];
    const vals = p.customFields && typeof p.customFields === 'object' ? p.customFields : {};
    for (const k in vals) {
      const fieldId = cfIdMap[String(k)];
      const v = vals[k];
      if (!fieldId || v === null || v === undefined || v === '') continue;
      cfs.push({ fieldId, value: typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : String(v) });
    }
    return {
      id,
      sourceId: String(p.ourcanaId || n.id),
      name: (useDisplay ? String(p.displayName) : String(p.name || '')).trim() || 'Unnamed member',
      pronouns: String(p.pronouns || ''),
      role: '',
      color: hex(p.color),
      description: String(p.desc || ''),
      archived: !!p.archived,
      avatar,
      tags: [],
      groupIds: [],
      customFields: cfs,
    } as Member;
  });

  // v3 carries no fronting nodes. If a later version adds them, pick them up
  // rather than silently dropping the history.
  const fronts = byType('front').concat(byType('frontEntry'));
  const history = buildHistory(
    fronts.map((n: any) => {
      const p = n.properties || {};
      const ids = Array.isArray(p.memberIds) ? p.memberIds : (p.memberId ? [p.memberId] : []);
      return { members: ids, startTime: p.startTime, endTime: p.isLive ? null : (p.endTime ?? null) };
    }),
    idMap,
  );

  return {
    sourceLabel: 'Ourcana',
    members,
    history,
    groups: [],
    customFieldDefs: cfDefs,
    systemName: sys.username ? String(sys.username) : undefined,
    systemDesc: sys.desc ? String(sys.desc) : undefined,
  };
};

export const convertOurcana = (d: any): ConvertedImport => {
  if (d && d.graph && Array.isArray(d.graph.nodes)) return convertOurcanaGraph(d);
  const sys = d.system || {};
  const mem: any[] = Array.isArray(d.members) ? d.members : [];
  const fronts: any[] = Array.isArray(d.frontHistory) ? d.frontHistory : [];
  const tags: any[] = Array.isArray(d.tags) ? d.tags : [];
  const idMap: Record<string, string> = {};
  const members: Member[] = mem.map((m: any) => {
    const id = uid(); idMap[String(m.id)] = id;
    const useDisplay = m.showOnlyDisplayName && m.displayName;
    return {
      id, sourceId: String(m.id),
      name: (useDisplay ? String(m.displayName) : String(m.name || '')).trim() || 'Unnamed member',
      pronouns: String(m.pronouns || ''), role: '', color: hex(m.color), description: String(m.desc || ''),
      archived: !!m.archived, avatar: /^https?:\/\//.test(String(m.avatarUrl || '')) ? m.avatarUrl : undefined,
      tags: [], groupIds: [], customFields: [],
    };
  });
  const groups: MemberGroup[] = [];
  const gmap: Record<string, string> = {};
  tags.forEach((tg: any) => { const gid = uid(); gmap[String(tg.id)] = gid; groups.push({ id: gid, name: String(tg.label || tg.name || 'Group'), color: tg.color ? hex(tg.color) : undefined }); });
  mem.forEach((m: any) => {
    if (!Array.isArray(m.tagIds)) return;
    const lm = members.find(x => x.id === idMap[String(m.id)]);
    if (lm) lm.groupIds = m.tagIds.map((tid: any) => gmap[String(tid)]).filter(Boolean);
  });
  const history = buildHistory(fronts.map((f: any) => ({ members: Array.isArray(f.memberIds) ? f.memberIds : [], startTime: f.startTime, endTime: f.isLive ? null : (f.endTime ?? null) })), idMap);
  return { sourceLabel: 'Ourcana', members, history, groups, systemName: sys.name, systemDesc: sys.desc };
};

export const convertMultiplicity = (d: any): ConvertedImport => {
  const sys = d.system || {};
  const alters: any[] = Array.isArray(d.alters) ? d.alters : [];
  const fronts: any[] = Array.isArray(d.front_entries) ? d.front_entries : [];
  const idMap: Record<string, string> = {};
  const members: Member[] = alters.map((a: any) => {
    const id = uid(); idMap[String(a.alter_id)] = id;
    return {
      id, sourceId: 'mx:' + String(a.alter_id),
      name: (a.name && String(a.name).trim()) || (a.display_name && String(a.display_name).trim()) || 'Unnamed member',
      pronouns: String(a.pronouns || ''), role: '', color: hex(a.colour), description: String(a.description || ''),
      archived: !!a.is_archived,
      avatar: a.avatar_data ? `data:image/png;base64,${a.avatar_data}` : (/^https?:\/\//.test(String(a.avatar_url || '')) ? a.avatar_url : undefined),
      tags: [], groupIds: [], customFields: [],
    };
  });
  const history = buildHistory(fronts.map((f: any) => ({ members: [String(f.alter_id)], startTime: f.start_time, endTime: f.end_time ?? null, note: f.notes || '' })), idMap);
  return { sourceLabel: 'HiveMind', members, history, systemName: sys.name, systemDesc: sys.description };
};

export const convertOctocon = (d: any): ConvertedImport => {
  const u = d.user || {};
  const alters: any[] = Array.isArray(d.alters) ? d.alters : [];
  const fronts: any[] = Array.isArray(d.fronts) ? d.fronts : [];
  const idMap: Record<string, string> = {};
  const members: Member[] = alters.map((a: any) => {
    const id = uid(); idMap[String(a.id)] = id;
    return {
      id, sourceId: String(a.id),
      name: (a.name && String(a.name).trim()) || 'Unnamed member',
      pronouns: String(a.pronouns || ''), role: '', color: hex(a.color), description: String(a.description || ''),
      avatar: /^https?:\/\//.test(String(a.avatar_url || '')) ? a.avatar_url : undefined,
      tags: [], groupIds: [], customFields: [],
    };
  });
  const history = buildHistory(fronts.map((f: any) => ({ members: [String(f.alter_id)], startTime: f.time_start, endTime: f.time_end ?? null, note: f.comment || '' })), idMap);
  return { sourceLabel: 'Octocon', members, history, systemName: u.username, systemDesc: u.description };
};

export interface PluralSpaceImport extends ConvertedImport {
  journal: { title: string; body: string; authorIds: string[]; timestamp: number }[];
  chatChannels: { name: string; createdAt: number; messages: { authorId: string; content: string; timestamp: number }[] }[];
  polls: { question: string; createdBy: string; createdAt: number; closedAt?: number; options: { text: string; votes: string[] }[] }[];
  avatarMediaPaths: Record<string, string>;
}

export const detectPluralSpace = (d: any): boolean =>
  !!d && !d._meta && d.system && typeof d.system === 'object' && Array.isArray(d.members) && Array.isArray(d.fronts);

const psTime = (v: any): number => { if (!v) return 0; const ms = new Date(String(v)).getTime(); return isNaN(ms) ? 0 : ms; };

export const convertPluralSpace = (d: any): PluralSpaceImport => {
  const sys = d.system || {};
  const mem: any[] = Array.isArray(d.members) ? d.members : [];
  const fronts: any[] = Array.isArray(d.fronts) ? d.fronts : [];
  const fieldDefsSrc: any[] = Array.isArray(d.custom_fields) ? d.custom_fields : [];
  const groupsSrc: any[] = Array.isArray(d.member_groups) ? d.member_groups : [];

  const PS_TYPE: Record<string, CustomFieldType> = { text: 'text', number: 'number', boolean: 'toggle', toggle: 'toggle', date: 'date', color: 'color', markdown: 'markdown' };
  const cfDefs: CustomFieldDef[] = [];
  const cfIdByName: Record<string, string> = {};
  const ensureDef = (name: string, type?: any): string => {
    const key = name.toLowerCase();
    if (cfIdByName[key]) return cfIdByName[key];
    const id = uid();
    cfDefs.push({ id, name, type: PS_TYPE[String(type)] || 'text', sortOrder: cfDefs.length });
    cfIdByName[key] = id;
    return id;
  };
  fieldDefsSrc.forEach((f: any, i: number) => ensureDef(String(f?.name || `Field ${i + 1}`).trim() || `Field ${i + 1}`, f?.field_type));

  const idMap: Record<string, string> = {};
  const avatarMediaPaths: Record<string, string> = {};
  const members: Member[] = mem.map((m: any) => {
    const id = uid(); idMap[String(m.id)] = id;
    const grouped: Record<string, string[]> = {};
    (Array.isArray(m.custom_field_values) ? m.custom_field_values : []).forEach((cv: any) => {
      const name = String(cv?.field_name || '').trim();
      if (!name || cv?.value == null) return;
      const fid = ensureDef(name);
      (grouped[fid] = grouped[fid] || []).push(String(cv.value));
    });
    const cfs = Object.entries(grouped).map(([fieldId, vals]) => ({ fieldId, value: vals.join('\n') }));
    const mediaPath = String(m.avatar_media_path || '');
    if (mediaPath) avatarMediaPaths[id] = mediaPath;
    return {
      id, sourceId: 'ps:' + String(m.id),
      name: (m.name && String(m.name).trim()) || (m.display_name && String(m.display_name).trim()) || 'Unnamed member',
      pronouns: String(m.pronouns || ''),
      role: Array.isArray(m.role) ? m.role.join(', ') : String(m.role || ''),
      color: hex(m.color), description: String(m.description || ''),
      archived: !!m.is_archived, isCustomFront: !!m.is_custom_front,
      createdAt: psTime(m.created_at) || undefined,
      avatar: /^https?:\/\//.test(String(m.avatar_path || '')) ? String(m.avatar_path) : undefined,
      tags: [], groupIds: [], customFields: cfs,
    };
  });

  const groups: MemberGroup[] = [];
  const gmap: Record<string, string> = {};
  groupsSrc.forEach((g: any) => {
    const gid = uid(); const name = String(g?.name || 'Group');
    gmap[String(g?.id)] = gid; gmap[name.toLowerCase()] = gid;
    groups.push({ id: gid, name, color: g?.color ? hex(g.color) : undefined });
  });
  mem.forEach((m: any) => {
    if (!Array.isArray(m.groups) || m.groups.length === 0) return;
    const lm = members.find(x => x.id === idMap[String(m.id)]);
    if (!lm) return;
    lm.groupIds = m.groups.map((g: any) => {
      const k = typeof g === 'object' && g !== null ? String(g.id ?? g.name ?? '') : String(g);
      return gmap[k] || gmap[k.toLowerCase()];
    }).filter(Boolean);
  });

  type PsEntry = { mid: string; tier: 'front' | 'co_front' | 'co_con'; startTime: number; endTime: number | null; note: string };
  const parsed: PsEntry[] = fronts.map((f: any) => {
    const mid = idMap[String(f?.member_id)] || '';
    const startTime = psTime(f?.started_at);
    const rawEnd = f?.is_live ? null : (f?.ended_at ? psTime(f.ended_at) : null);
    const tier: PsEntry['tier'] = f?.type === 'co_front' ? 'co_front' : f?.type === 'co_con' ? 'co_con' : 'front';
    return { mid, tier, startTime, endTime: rawEnd === 0 ? null : rawEnd, note: String(f?.comment || '') };
  }).filter(e => e.mid && e.startTime > 0);
  parsed.sort((a, b) => a.startTime - b.startTime);
  const OVERLAP_TOLERANCE = 60 * 1000;
  const sessionGroups: PsEntry[][] = [];
  const used = new Set<number>();
  for (let i = 0; i < parsed.length; i++) {
    if (used.has(i)) continue;
    const group = [parsed[i]]; used.add(i);
    for (let j = i + 1; j < parsed.length; j++) {
      if (used.has(j)) continue;
      const a = parsed[i]; const b = parsed[j];
      const aEnd = a.endTime ?? Date.now(); const bEnd = b.endTime ?? Date.now();
      if (Math.abs(a.startTime - b.startTime) <= OVERLAP_TOLERANCE || (b.startTime < aEnd && a.startTime < bEnd)) { group.push(b); used.add(j); }
    }
    sessionGroups.push(group);
  }
  const history: HistoryEntry[] = sessionGroups.map(group => {
    let main = [...new Set(group.filter(e => e.tier === 'front').map(e => e.mid))];
    let coF = [...new Set(group.filter(e => e.tier === 'co_front').map(e => e.mid))].filter(id => !main.includes(id));
    const coC = [...new Set(group.filter(e => e.tier === 'co_con').map(e => e.mid))].filter(id => !main.includes(id) && !coF.includes(id));
    if (main.length === 0 && coF.length > 0) { main = coF; coF = []; }
    const startTime = Math.min(...group.map(e => e.startTime));
    const endTimes = group.map(e => e.endTime);
    const endTime = endTimes.includes(null) ? null : Math.max(...(endTimes as number[]));
    const notes = [...new Set(group.map(e => e.note).filter(Boolean))];
    return {
      memberIds: main, startTime, endTime, note: notes.join(' | '),
      coFrontIds: coF.length > 0 ? coF : undefined,
      coConsciousIds: coC.length > 0 ? coC : undefined,
    } as HistoryEntry;
  }).filter(h => h.memberIds.length > 0);

  const nameToLocal: Record<string, string> = {};
  mem.forEach((m: any) => {
    const lid = idMap[String(m.id)];
    if (!lid) return;
    const n = String(m.name || '').trim().toLowerCase();
    if (n) nameToLocal[n] = lid;
    const dn = String(m.display_name || '').trim().toLowerCase();
    if (dn && !nameToLocal[dn]) nameToLocal[dn] = lid;
  });

  const journal = (Array.isArray(d.journal_entries) ? d.journal_entries : []).map((j: any) => ({
    title: String(j?.title || '').trim(),
    body: String(j?.content || ''),
    authorIds: (Array.isArray(j?.members) ? j.members : []).map((mm: any) => idMap[String(mm?.id)] || nameToLocal[String(mm?.name || '').trim().toLowerCase()]).filter(Boolean) as string[],
    timestamp: psTime(j?.date) || psTime(j?.created_at) || Date.now(),
  }));

  const chatChannels = (Array.isArray(d.chat_channels) ? d.chat_channels : []).map((ch: any) => ({
    name: String(ch?.name || '').trim() || 'Imported',
    createdAt: psTime(ch?.created_at) || Date.now(),
    messages: (Array.isArray(ch?.messages) ? ch.messages : []).map((msg: any) => ({
      authorId: nameToLocal[String(msg?.member_name || '').trim().toLowerCase()] || '',
      content: String(msg?.content || ''),
      timestamp: psTime(msg?.created_at) || Date.now(),
    })),
  }));

  const polls = (Array.isArray(d.polls) ? d.polls : []).map((p: any) => {
    const creator = idMap[String(p?.created_by_member?.id)] || nameToLocal[String(p?.created_by_member?.name || '').trim().toLowerCase()] || '';
    const desc = String(p?.description || '').trim();
    return {
      question: [String(p?.title || '').trim(), desc].filter(Boolean).join(' — ') || '?',
      createdBy: creator,
      createdAt: psTime(p?.created_at) || Date.now(),
      closedAt: p?.status && p.status !== 'open' ? (psTime(p?.closes_at) || Date.now()) : undefined,
      options: (Array.isArray(p?.options) ? p.options : []).map((o: any) => ({
        text: String(o?.text || ''),
        votes: [...new Set((Array.isArray(o?.votes) ? o.votes : []).map((v: any) => nameToLocal[String(v?.member_name || '').trim().toLowerCase()]).filter(Boolean))] as string[],
      })),
    };
  });

  return {
    sourceLabel: 'PluralSpace', members, history, groups, customFieldDefs: cfDefs,
    systemName: sys.name, systemDesc: sys.description || undefined,
    journal, chatChannels, polls, avatarMediaPaths,
  };
};

/**
 * Ampersand's JSON export (DatabaseJSON). Their dev considers the binary .ampdb
 * unstable — it changes shape every few releases — and points at this instead,
 * so this is the path we want people on.
 *
 * Same entity model as the old .ampar tables, but as plain JSON, which lets us
 * carry things the binary path never did: avatars, covers, roles and tags.
 */
export const detectAmpersandJson = (d: any): boolean =>
  !!d && typeof d === 'object' && !!d.database && typeof d.database === 'object'
  && Array.isArray(d.database.members) && Array.isArray(d.database.frontingEntries);

export const convertAmpersandJson = (d: any): ConvertedImport => {
  const db = d.database || {};
  const mem: any[] = Array.isArray(db.members) ? db.members : [];
  const fronting: any[] = Array.isArray(db.frontingEntries) ? db.frontingEntries : [];
  const systems: any[] = Array.isArray(db.systems) ? db.systems : [];
  const tags: any[] = Array.isArray(db.tags) ? db.tags : [];
  const fieldDefs: any[] = Array.isArray(db.customFields) ? db.customFields : [];

  // They support several systems; appConfig.defaultSystem names the active one.
  const defaultId = String(d?.config?.appConfig?.defaultSystem || '');
  const sys = systems.find((s: any) => String(s?.uuid) === defaultId) || systems[0] || {};

  const cfDefs: CustomFieldDef[] = fieldDefs.map((f: any, i: number) => ({
    id: uid(),
    name: String(f?.name || `Field ${i + 1}`).trim() || `Field ${i + 1}`,
    type: 'text' as CustomFieldType,
    sortOrder: f?.priority ?? i,
  }));
  const cfIdMap: Record<string, string> = {};
  fieldDefs.forEach((f: any, i: number) => { cfIdMap[String(f?.uuid)] = cfDefs[i].id; });

  // Only member-type tags become groups; journal and asset tags are theirs alone.
  const groups: MemberGroup[] = [];
  const tagIdMap: Record<string, string> = {};
  tags.filter((tg: any) => tg && (tg.type === 'member' || tg.type === undefined)).forEach((tg: any) => {
    const gid = uid();
    tagIdMap[String(tg.uuid)] = gid;
    groups.push({ id: gid, name: String(tg.name || 'Group'), color: tg.color ? hex(tg.color) : undefined, sourceId: 'amp:' + String(tg.uuid) });
  });

  const idMap: Record<string, string> = {};
  const dataUri = (v: any): string | undefined => {
    const s = String(v || '');
    return s.startsWith('data:') ? s : undefined;
  };
  const members: Member[] = mem
    // A multi-system export would otherwise merge everyone into one roster.
    .filter((a: any) => a && (!defaultId || !a.system || String(a.system) === defaultId))
    .map((a: any) => {
      const id = uid();
      idMap[String(a.uuid)] = id;
      const cfs: { fieldId: string; value: any }[] = [];
      const vals = a.customFields && typeof a.customFields === 'object' ? a.customFields : {};
      for (const k in vals) {
        const fid = cfIdMap[String(k)];
        const v = vals[k];
        if (!fid || v === null || v === undefined || v === '') continue;
        cfs.push({ fieldId: fid, value: typeof v === 'object' ? JSON.stringify(v) : String(v) });
      }
      return {
        id,
        sourceId: 'amp:' + String(a.uuid),
        name: (a.name && String(a.name).trim()) || 'Unnamed member',
        pronouns: String(a.pronouns || ''),
        role: String(a.role || ''),
        color: hex(a.color),
        description: String(a.description || ''),
        archived: !!a.isArchived,
        isCustomFront: !!a.isCustomFront,
        avatar: dataUri(a.image),
        banner: dataUri(a.cover),
        createdAt: a.dateCreated ? toMs(a.dateCreated) : undefined,
        tags: [],
        groupIds: (Array.isArray(a.tags) ? a.tags : []).map((t: any) => tagIdMap[String(t)]).filter(Boolean) as string[],
        customFields: cfs,
      } as Member;
    });

  // Their fronting entries are ONE ROW PER MEMBER, so members sharing a span are
  // one switch to us. isMainFronter picks the primary tier; everyone else on that
  // span is a co-fronter.
  const spans = new Map<string, { start: any; end: any; main: string[]; co: string[]; notes: string[] }>();
  fronting.forEach((f: any) => {
    if (!f || !f.member) return;
    const key = `${String(f.startTime || '')}|${String(f.endTime || '')}`;
    let s = spans.get(key);
    if (!s) { s = { start: f.startTime, end: f.endTime ?? null, main: [], co: [], notes: [] }; spans.set(key, s); }
    (f.isMainFronter ? s.main : s.co).push(String(f.member));
    const note = String(f.comment || f.customStatus || '').trim();
    if (note) s.notes.push(note);
  });
  const history: HistoryEntry[] = [];
  spans.forEach(s => {
    const main = s.main.map(u => idMap[u]).filter(Boolean) as string[];
    const co = s.co.map(u => idMap[u]).filter(Boolean) as string[];
    const startTime = toMs(s.start);
    if (startTime <= 0 || (main.length === 0 && co.length === 0)) return;
    // With no main fronter flagged, the co-fronters ARE the front.
    const primary = main.length > 0 ? main : co;
    const others = main.length > 0 ? co : [];
    history.push({
      memberIds: primary,
      startTime,
      endTime: s.end != null ? toMs(s.end) : null,
      note: s.notes.join('  ·  '),
      ...(others.length > 0 ? { coFrontIds: others } : {}),
    } as HistoryEntry);
  });
  history.sort((a, b) => a.startTime - b.startTime);

  return {
    sourceLabel: 'Ampersand',
    members,
    history,
    groups,
    customFieldDefs: cfDefs,
    systemName: sys?.name ? String(sys.name) : undefined,
    systemDesc: sys?.description ? String(sys.description) : undefined,
  };
};

// convertAmpar and its msgpack decoder (src/ampar.ts) were REMOVED 2026-07-26.
// Ampersand's binary backup changes shape every few releases — their developer
// says so and recommends the JSON export instead — so maintaining a hand-rolled
// decoder for it was a standing liability. convertAmpersandJson above is the
// only Ampersand path now.
