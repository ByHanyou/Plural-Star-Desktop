import { Member, HistoryEntry, MemberGroup, CustomFieldDef, CustomFieldType, JournalEntry, uid } from './utils';
import { bytesToDataUri } from './exportUtils';
import { strFromU8 } from 'fflate';

export interface ConvertedImport {
  sourceLabel: string;
  members: Member[];
  history: HistoryEntry[];
  groups?: MemberGroup[];
  customFieldDefs?: CustomFieldDef[];
  systemName?: string;
  systemDesc?: string;
  systemAvatar?: string;
  systemBanner?: string;
  journal?: { title: string; body: string; authorIds: string[]; timestamp: number; hashtags?: string[]; pinned?: boolean }[];
  chat?: { name: string; createdAt: number; messages: { authorId: string; content: string; timestamp: number }[] }[];
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

export type ForeignFormat = 'ourcana' | 'multiplicity' | 'octocon' | 'parallax';

export const detectForeignFormat = (text: string): ForeignFormat | null => {
  try {
    const d = JSON.parse(text);
    if (!d._meta && typeof d.user_id === 'string' && Array.isArray(d.members) && Array.isArray(d.fronting_log)) return 'parallax';
    if (d.format === 'ourcana' || (d.graph && Array.isArray(d.graph.nodes)) || (!d._meta && Array.isArray(d.members) && Array.isArray(d.frontHistory) && d.members[0]?.id !== undefined)) return 'ourcana';
    if (d.app === 'multiplicity' || (Array.isArray(d.alters) && Array.isArray(d.front_entries))) return 'multiplicity';
    if (!d._meta && d.user && typeof d.user === 'object' && Array.isArray(d.alters)) return 'octocon';
  } catch {}
  return null;
};

export const findOurcanaJsonEntry = (files: Record<string, Uint8Array>): string | undefined => {
  const names = Object.keys(files);
  return names.find(n => /(^|\/)ourcana[^/]*\.json$/i.test(n))
    || names.find(n => !n.includes('/') && n.toLowerCase().endsWith('.json'))
    || names.find(n => n.toLowerCase().endsWith('.json') && !n.toLowerCase().endsWith('index.json'));
};

const ourZipAvatarFor = (zipFiles: Record<string, Uint8Array>, ownerId: string): { name: string; bytes: Uint8Array } | null => {
  if (!ownerId) return null;
  const name = Object.keys(zipFiles).find(n => {
    const parts = n.split('/');
    const file = parts[parts.length - 1];
    return parts[parts.length - 2] === 'avatars' && file.startsWith(`${ownerId}.`);
  });
  return name ? { name, bytes: zipFiles[name] } : null;
};

const ourAssetFor = (zipFiles: Record<string, Uint8Array>, ownerId: string, role: string): { name: string; bytes: Uint8Array } | null => {
  if (!ownerId) return null;
  const idxName = Object.keys(zipFiles).find(n => n.endsWith('image_assets/index.json'));
  if (!idxName) return null;
  try {
    const idx = JSON.parse(strFromU8(zipFiles[idxName]));
    const assets: any[] = Array.isArray(idx?.assets) ? idx.assets : [];
    const hit = assets
      .filter(a => a && a.role === role && String(a.ownerId) === ownerId && typeof a.localPath === 'string')
      .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))[0];
    if (!hit) return null;
    const entry = Object.keys(zipFiles).find(n => n === hit.localPath || n.endsWith(`/${hit.localPath}`));
    return entry ? { name: entry, bytes: zipFiles[entry] } : null;
  } catch { return null; }
};

const convertOurcanaGraph = (d: any, zipFiles?: Record<string, Uint8Array>): ConvertedImport => {
  const nodes: any[] = Array.isArray(d?.graph?.nodes) ? d.graph.nodes : [];
  const edges: any[] = Array.isArray(d?.graph?.edges) ? d.graph.edges : [];
  const byType = (t: string) => nodes.filter(n => n && n.type === t);
  const sysNode = byType('system')[0];
  const sys = sysNode?.properties || {};

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
      const type: CustomFieldType = raw === 'number' ? 'number' : raw === 'boolean' || raw === 'toggle' ? 'toggle' : raw === 'date' ? 'date' : 'text';
      cfDefs.push({ id, name: String(p.label || `Field ${i + 1}`).trim() || `Field ${i + 1}`, type, sortOrder: p.order ?? i });
    });

  const tagNodes = byType('tag').filter((n: any) => !String(n.id).startsWith('tag_default_'));
  const groups: MemberGroup[] = [];
  const gmap: Record<string, string> = {};
  tagNodes.forEach((n: any) => {
    const p = n.properties || {};
    const gid = uid();
    gmap[String(n.id)] = gid;
    groups.push({ id: gid, name: String(p.label || 'Group'), color: p.color ? hex(p.color) : undefined });
  });
  tagNodes.forEach((n: any) => {
    const p = n.properties || {};
    if (p.parentId == null) return;
    const childId = gmap[String(n.id)];
    const parentId = gmap[String(p.parentId)];
    if (!childId || !parentId || childId === parentId) return;
    const g = groups.find(x => x.id === childId);
    if (g) g.parentId = parentId;
  });
  const memberIdSet = new Set(byType('member').map((n: any) => String(n.id)));
  const tagIdsByMember: Record<string, string[]> = {};
  edges.forEach((e: any) => {
    if (!e || e.type !== 'taggedWith') return;
    const from = String(e.from);
    const gid = gmap[String(e.to)];
    if (!memberIdSet.has(from) || !gid) return;
    if (!tagIdsByMember[from]) tagIdsByMember[from] = [];
    tagIdsByMember[from].push(gid);
  });

  const idMap: Record<string, string> = {};
  const members: Member[] = byType('member').map((n: any) => {
    const p = n.properties || {};
    const id = uid();
    idMap[String(n.id)] = id;
    const useDisplay = p.showOnlyDisplayName && p.displayName;
    const zipAv = zipFiles ? ourZipAvatarFor(zipFiles, String(n.id)) : null;
    const avatar = zipAv
      ? (() => { try { return bytesToDataUri(zipAv.bytes, zipAv.name.split('/').pop() || 'a.png'); } catch { return undefined; } })()
      : (/^https?:\/\//.test(String(p.avatarUrl || '')) ? String(p.avatarUrl) : undefined);
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
      groupIds: tagIdsByMember[String(n.id)] || [],
      customFields: cfs,
    } as Member;
  });

  const fronts = byType('frontEvent').concat(byType('front')).concat(byType('frontEntry'));
  const history = buildHistory(
    fronts.map((n: any) => {
      const p = n.properties || {};
      const ids = Array.isArray(p.memberIds) ? p.memberIds : (p.memberId ? [p.memberId] : []);
      return { members: ids, startTime: p.startTime, endTime: p.isLive ? null : (p.endTime ?? null) };
    }),
    idMap,
  );

  const sysId = sysNode ? String(sysNode.id) : '';
  const sysAv = zipFiles && sysId ? (ourZipAvatarFor(zipFiles, sysId) || ourAssetFor(zipFiles, sysId, 'avatar')) : null;
  const sysBn = zipFiles && sysId ? ourAssetFor(zipFiles, sysId, 'banner') : null;
  const toUri = (f: { name: string; bytes: Uint8Array } | null): string | undefined => {
    if (!f) return undefined;
    try { return bytesToDataUri(f.bytes, f.name.split('/').pop() || 'a.png'); } catch { return undefined; }
  };

  return {
    sourceLabel: 'Ourcana',
    members,
    history,
    groups,
    customFieldDefs: cfDefs,
    systemName: sys.username ? String(sys.username) : undefined,
    systemDesc: sys.desc ? String(sys.desc) : undefined,
    systemAvatar: toUri(sysAv),
    systemBanner: toUri(sysBn),
  };
};

export const convertOurcana = (d: any, zipFiles?: Record<string, Uint8Array>): ConvertedImport => {
  if (d && d.graph && Array.isArray(d.graph.nodes)) return convertOurcanaGraph(d, zipFiles);
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

export const convertParallax = (d: any): ConvertedImport => {
  const mem: any[] = Array.isArray(d?.members) ? d.members : [];
  const idMap: Record<string, string> = {};
  const members: Member[] = [...mem]
    .sort((a: any, b: any) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
    .filter((m: any) => m && m.id)
    .map((m: any) => {
      const id = uid();
      idMap[String(m.id)] = id;
      const spId = String(m.sp_id || '');
      return {
        id,
        sourceId: /^[0-9a-f]{24}$/i.test(spId) ? spId : `px:${String(m.id)}`,
        name: String(m.name || '').trim() || 'Unnamed member',
        pronouns: String(m.pronouns || ''),
        role: String(m.role || ''),
        color: hex(m.color_theme),
        description: String(m.description || ''),
        archived: m.is_active === false,
        tags: [],
        groupIds: [],
        customFields: [],
      } as Member;
    });
  const fronts: any[] = Array.isArray(d?.fronting_log) ? d.fronting_log : [];
  const history = buildHistory(
    fronts.map((f: any) => ({
      members: f?.part_id ? [String(f.part_id)] : [],
      startTime: f?.started_at,
      endTime: f?.ended_at ?? null,
    })),
    idMap,
  );
  const msgs: any[] = Array.isArray(d?.messages) ? d.messages : [];
  const byChat: Record<string, { authorId: string; content: string; timestamp: number }[]> = {};
  msgs.forEach((m: any) => {
    const chatId = String(m?.chat_id || '');
    const authorId = idMap[String(m?.from_part_id)];
    const content = String(m?.body || '');
    const timestamp = toMs(m?.created_at);
    if (!chatId || !authorId || !content || !timestamp) return;
    if (!byChat[chatId]) byChat[chatId] = [];
    byChat[chatId].push({ authorId, content, timestamp });
  });
  const chat = Object.values(byChat)
    .map(messages => messages.sort((a, b) => a.timestamp - b.timestamp))
    .sort((a, b) => a[0].timestamp - b[0].timestamp)
    .map((messages, i) => ({ name: `Parallax ${i + 1}`, createdAt: messages[0].timestamp, messages }));
  return { sourceLabel: 'Parallax', members, history, groups: [], chat: chat.length > 0 ? chat : undefined };
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

export const isOpenPluralSystem = (o: any): boolean =>
  !!o && typeof o === 'object' && typeof o.openplural_version === 'string'
  && Array.isArray(o.members) && Array.isArray(o.front_periods);

export const normalizeOpenPlural = (root: any, mediaPrefix = ''): any | null => {
  if (!isOpenPluralSystem(root)) return null;
  const sys = (Array.isArray(root.systems) ? root.systems : [])[0] || {};
  const assets = new Map<string, any>();
  for (const a of Array.isArray(root.assets) ? root.assets : []) if (a && a.id) assets.set(String(a.id), a);
  const assetPath = (id: any): string => {
    const a = id ? assets.get(String(id)) : null;
    const uri = a && a.uri ? String(a.uri) : '';
    return uri ? `${mediaPrefix}${uri}` : '';
  };

  const terms = new Map<string, any>();
  for (const t of Array.isArray(root.taxonomy_terms) ? root.taxonomy_terms : []) if (t && t.id) terms.set(String(t.id), t);
  const rolesByMember = new Map<string, string[]>();
  for (const a of Array.isArray(root.taxonomy_assignments) ? root.taxonomy_assignments : []) {
    if (!a || a.subject_type !== 'member') continue;
    const term = terms.get(String(a.term_id));
    if (!term || term.kind !== 'role' || !term.name) continue;
    const key = String(a.subject_id);
    rolesByMember.set(key, [...(rolesByMember.get(key) || []), String(term.name)]);
  }

  const fieldNames = new Map<string, string>();
  for (const f of Array.isArray(root.custom_fields) ? root.custom_fields : []) if (f && f.id) fieldNames.set(String(f.id), String(f.name || ''));
  const valuesByMember = new Map<string, {field_name: string; value: any}[]>();
  for (const v of Array.isArray(root.custom_field_values) ? root.custom_field_values : []) {
    if (!v) continue;
    const owner = String(v.member_id || v.subject_id || '');
    const name = fieldNames.get(String(v.custom_field_id || v.field_id)) || String(v.field_name || '');
    if (!owner || !name) continue;
    valuesByMember.set(owner, [...(valuesByMember.get(owner) || []), {field_name: name, value: v.value}]);
  }

  const groupsByMember = new Map<string, string[]>();
  for (const gm of Array.isArray(root.group_memberships) ? root.group_memberships : []) {
    if (!gm) continue;
    const key = String(gm.member_id || '');
    if (!key) continue;
    groupsByMember.set(key, [...(groupsByMember.get(key) || []), String(gm.group_id || '')]);
  }

  const members = (Array.isArray(root.members) ? root.members : []).map((m: any) => ({
    id: m?.id,
    name: m?.name,
    display_name: m?.display_name,
    pronouns: m?.pronouns,
    description: m?.description,
    color: m?.color,
    role: (rolesByMember.get(String(m?.id)) || []).join(', '),
    is_archived: !!m?.archived,
    is_custom_front: !!m?.is_custom_front,
    avatar_media_path: assetPath(m?.avatar_asset_id),
    banner_media_path: assetPath(m?.banner_asset_id),
    groups: groupsByMember.get(String(m?.id)) || [],
    custom_field_values: valuesByMember.get(String(m?.id)) || [],
    created_at: m?.created_at,
  }));

  const periods = Array.isArray(root.front_periods) ? root.front_periods : [];
  const at = (v: any): number => { if (!v) return 0; const ms = new Date(String(v)).getTime(); return isNaN(ms) ? 0 : ms; };

  const LIVE_AT_EXPORT_MS = 5 * 60 * 1000;
  const exportedAt = at(root.exported_at);
  let liveEnd = 0;
  if (exportedAt > 0) {
    for (const p of periods) { const e = at(p?.ended_at); if (e > liveEnd) liveEnd = e; }
    const gap = exportedAt - liveEnd;
    if (!(liveEnd > 0 && gap >= 0 && gap <= LIVE_AT_EXPORT_MS)) liveEnd = 0;
  }

  const fronts: any[] = [];
  for (const p of periods) {
    if (!p) continue;
    const live = !p.ended_at || (liveEnd > 0 && at(p.ended_at) === liveEnd);
    const assignments = Array.isArray(p.assignments) && p.assignments.length ? p.assignments : [{member_id: p.member_id, front_role: 'primary'}];
    for (const a of assignments) {
      if (!a || !a.member_id) continue;
      const role = String(a.front_role || 'primary');
      fronts.push({
        id: p.id,
        member_id: a.member_id,
        type: role === 'co_front' ? 'co_front' : role === 'co_conscious' || role === 'co_con' ? 'co_con' : 'front',
        started_at: p.started_at,
        ended_at: live ? null : p.ended_at,
        comment: a.note || p.note || '',
        is_live: live,
      });
    }
  }

  const messagesByConv = new Map<string, any[]>();
  const chat = root.chat && typeof root.chat === 'object' ? root.chat : {};
  for (const msg of Array.isArray(chat.messages) ? chat.messages : []) {
    if (!msg) continue;
    const key = String(msg.conversation_id || '');
    messagesByConv.set(key, [...(messagesByConv.get(key) || []), msg]);
  }

  return {
    system: {
      id: sys.id,
      name: sys.name,
      description: sys.description,
      color: sys.color,
      avatar_media_path: assetPath(sys.avatar_asset_id),
      banner_media_path: assetPath(sys.banner_asset_id),
    },
    members,
    fronts,
    custom_fields: (Array.isArray(root.custom_fields) ? root.custom_fields : []).map((f: any) => ({
      id: f?.id, name: f?.name, field_type: f?.field_type, is_multiple: false, values: [],
    })),
    member_groups: (Array.isArray(root.groups) ? root.groups : []).map((g: any) => ({
      id: g?.id, name: g?.name, color: g?.color, description: g?.description,
    })),
    journal_entries: (Array.isArray(root.notes) ? root.notes : []).map((n: any) => ({
      id: n?.id,
      title: n?.title,
      body: n?.body,
      created_at: n?.created_at || n?.entry_date,
      member_id: n?.member_id,
      author_member_ids: Array.isArray(n?.author_member_ids) ? n.author_member_ids : [],
    })),
    chat_channels: (Array.isArray(chat.conversations) ? chat.conversations : []).map((c: any) => ({
      id: c?.id,
      name: c?.name || c?.title,
      messages: (messagesByConv.get(String(c?.id)) || []).map((m: any) => ({
        id: m?.id, member_id: m?.member_id || m?.author_member_id, content: m?.body ?? m?.content, created_at: m?.created_at,
      })),
    })),
    polls: Array.isArray(root.polls?.polls) ? root.polls.polls : [],
  };
};

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

export const detectTupperbox = (d: any): boolean =>
  !!d && typeof d === 'object' && Array.isArray(d.tuppers);

export const convertTupperbox = (d: any): ConvertedImport => {
  const tuppers: any[] = Array.isArray(d.tuppers) ? d.tuppers : [];
  const tbGroups: any[] = Array.isArray(d.groups) ? d.groups : [];

  const groups: MemberGroup[] = [];
  const groupIdMap: Record<string, string> = {};
  tbGroups.forEach((g: any) => {
    const name = (g?.name && String(g.name).trim()) || '';
    if (!name || g?.id == null) return;
    const gid = uid();
    groupIdMap[String(g.id)] = gid;
    groups.push({ id: gid, name, description: g.description ? String(g.description) : undefined, sourceId: 'tb:g:' + String(g.id) });
  });

  const members: Member[] = tuppers.map((tp: any) => {
    const rawBr: any[] = Array.isArray(tp?.brackets) ? tp.brackets : [];
    const proxyTags: { prefix?: string | null; suffix?: string | null }[] = [];
    if (rawBr.length % 2 === 0) {
      for (let i = 0; i + 1 < rawBr.length; i += 2) {
        proxyTags.push({ prefix: rawBr[i] == null ? null : String(rawBr[i]), suffix: rawBr[i + 1] == null ? null : String(rawBr[i + 1]) });
      }
    }
    return {
      id: uid(),
      sourceId: 'tb:' + String(tp?.id ?? uid()),
      name: (tp?.name && String(tp.name).trim()) || 'Unnamed member',
      pronouns: '', role: '', color: hex(undefined),
      description: String(tp?.description || ''),
      tags: [], customFields: [],
      groupIds: tp?.group_id != null && groupIdMap[String(tp.group_id)] ? [groupIdMap[String(tp.group_id)]] : [],
      avatar: tp?.avatar_url ? String(tp.avatar_url) : undefined,
      createdAt: tp?.created_at ? toMs(tp.created_at) : undefined,
      ...(proxyTags.length > 0 ? { pkProxyTags: proxyTags } : {}),
      ...(tp?.avatar_url ? { pkAvatarUrl: String(tp.avatar_url) } : {}),
    } as Member;
  });

  return { sourceLabel: 'Tupperbox', members, history: [], groups };
};

const AMPAR_MAGIC = [0x41, 0x4d, 0x50, 0x41, 0x52, 0x00];

export const isAmparBytes = (b: Uint8Array): boolean =>
  !!b && b.length > 10 && AMPAR_MAGIC.every((c, i) => b[i] === c);

const utf8 = (b: Uint8Array, start: number, len: number): string => {
  let out = '';
  let i = start;
  const end = start + len;
  while (i < end) {
    const c = b[i++];
    if (c < 0x80) { out += String.fromCharCode(c); continue; }
    let cp: number;
    if (c < 0xe0) cp = ((c & 0x1f) << 6) | (b[i++] & 0x3f);
    else if (c < 0xf0) { cp = ((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6); cp |= b[i++] & 0x3f; }
    else {
      cp = ((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6);
      cp |= b[i++] & 0x3f;
    }
    if (cp > 0xffff) {
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else out += String.fromCharCode(cp);
  }
  return out;
};

export const decodeAmpar = (bytes: Uint8Array): {table: string; data: any}[] => {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 10;

  const timestamp = (len: number): number => {
    if (len === 4) { const s = dv.getUint32(p); p += 4; return s * 1000; }
    if (len === 8) {
      const hi = dv.getUint32(p); const lo = dv.getUint32(p + 4); p += 8;
      const ns = hi >>> 2;
      const sec = (hi & 0x3) * 4294967296 + lo;
      return sec * 1000 + Math.floor(ns / 1e6);
    }
    if (len === 12) {
      const ns = dv.getUint32(p); const sec = Number(dv.getBigInt64(p + 4)); p += 12;
      return sec * 1000 + Math.floor(ns / 1e6);
    }
    p += len;
    return 0;
  };

  const read = (): any => {
    const c = bytes[p++];
    if (c <= 0x7f) return c;
    if (c >= 0xe0) return c - 256;
    if (c >= 0x80 && c <= 0x8f) return map(c & 0x0f);
    if (c >= 0x90 && c <= 0x9f) return arr(c & 0x0f);
    if (c >= 0xa0 && c <= 0xbf) return str(c & 0x1f);
    switch (c) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xc4: return bin(dv.getUint8(p), 1);
      case 0xc5: return bin(dv.getUint16(p), 2);
      case 0xc6: return bin(dv.getUint32(p), 4);
      case 0xc7: { const l = dv.getUint8(p); const t = dv.getInt8(p + 1); p += 2; return ext(t, l); }
      case 0xc8: { const l = dv.getUint16(p); const t = dv.getInt8(p + 2); p += 3; return ext(t, l); }
      case 0xc9: { const l = dv.getUint32(p); const t = dv.getInt8(p + 4); p += 5; return ext(t, l); }
      case 0xca: { const v = dv.getFloat32(p); p += 4; return v; }
      case 0xcb: { const v = dv.getFloat64(p); p += 8; return v; }
      case 0xcc: return dv.getUint8(p++);
      case 0xcd: { const v = dv.getUint16(p); p += 2; return v; }
      case 0xce: { const v = dv.getUint32(p); p += 4; return v; }
      case 0xcf: { const v = Number(dv.getBigUint64(p)); p += 8; return v; }
      case 0xd0: return dv.getInt8(p++);
      case 0xd1: { const v = dv.getInt16(p); p += 2; return v; }
      case 0xd2: { const v = dv.getInt32(p); p += 4; return v; }
      case 0xd3: { const v = Number(dv.getBigInt64(p)); p += 8; return v; }
      case 0xd4: { const t = dv.getInt8(p++); return ext(t, 1); }
      case 0xd5: { const t = dv.getInt8(p++); return ext(t, 2); }
      case 0xd6: { const t = dv.getInt8(p++); return ext(t, 4); }
      case 0xd7: { const t = dv.getInt8(p++); return ext(t, 8); }
      case 0xd8: { const t = dv.getInt8(p++); return ext(t, 16); }
      case 0xd9: { const l = dv.getUint8(p); p += 1; return str(l); }
      case 0xda: { const l = dv.getUint16(p); p += 2; return str(l); }
      case 0xdb: { const l = dv.getUint32(p); p += 4; return str(l); }
      case 0xdc: { const l = dv.getUint16(p); p += 2; return arr(l); }
      case 0xdd: { const l = dv.getUint32(p); p += 4; return arr(l); }
      case 0xde: { const l = dv.getUint16(p); p += 2; return map(l); }
      case 0xdf: { const l = dv.getUint32(p); p += 4; return map(l); }
      default: throw new Error(`ampar: unsupported byte 0x${c.toString(16)} at ${p - 1}`);
    }
  };
  const ext = (type: number, len: number): any => {
    if (type === -1) return timestamp(len);
    const raw = bytes.subarray(p, p + len); p += len;
    return raw;
  };
  const str = (len: number): string => { const s = utf8(bytes, p, len); p += len; return s; };
  const bin = (len: number, skip: number): Uint8Array => { p += skip; const s = bytes.subarray(p, p + len); p += len; return s; };
  const arr = (len: number): any[] => { const o: any[] = []; for (let i = 0; i < len; i++) o.push(read()); return o; };
  const map = (len: number): any => {
    const o: any = {};
    for (let i = 0; i < len; i++) { const k = read(); o[typeof k === 'string' ? k : String(k)] = read(); }
    return o;
  };

  const out: {table: string; data: any}[] = [];
  while (p < bytes.length) {
    const rec = read();
    if (rec && typeof rec === 'object' && typeof rec.table === 'string') out.push(rec);
  }
  return out;
};

export const amparToDatabaseJson = (bytes: Uint8Array): any => {
  const byTable: Record<string, any[]> = {};
  for (const r of decodeAmpar(bytes)) (byTable[r.table] = byTable[r.table] || []).push(r.data);
  const fileUri = (v: any): any => {
    const raw = v?.value;
    if (!raw || typeof raw.length !== 'number' || !v?._meta || v._meta.type !== 'file') return v;
    try { return bytesToDataUri(raw as Uint8Array, String(v._meta.name || 'x.png')); } catch { return undefined; }
  };
  const members = (byTable.members || []).map((m: any) => {
    const out: any = {...m, image: fileUri(m?.image), cover: fileUri(m?.cover)};
    const pairs = m?.customFields?.value;
    if (!Array.isArray(pairs)) return out;
    const flat: Record<string, any> = {};
    for (const pair of pairs) if (Array.isArray(pair) && pair.length >= 2) flat[String(pair[0])] = pair[1];
    out.customFields = flat;
    return out;
  });
  return {
    database: {
      systems: byTable.systems || [],
      members,
      frontingEntries: byTable.frontingEntries || [],
      customFields: byTable.customFields || [],
      tags: byTable.tags || [],
      journalPosts: byTable.journalPosts || [],
      boardMessages: byTable.boardMessages || [],
    },
    config: byTable.__config?.[0] || {},
  };
};

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

  let ageFieldId = '';
  if (mem.some((a: any) => a?.age != null && String(a.age).trim() !== '')
      && !cfDefs.some(f => f.name.toLowerCase() === 'age')) {
    ageFieldId = uid();
    cfDefs.push({ id: ageFieldId, name: 'Age', type: 'text' as CustomFieldType, sortOrder: cfDefs.length });
  }

  const usedTags = new Set<string>();
  mem.forEach((a: any) => (Array.isArray(a?.tags) ? a.tags : []).forEach((t: any) => usedTags.add(String(t))));
  const groups: MemberGroup[] = [];
  const tagIdMap: Record<string, string> = {};
  tags.filter((tg: any) => tg && (tg.type === 'member' || tg.type === undefined)).forEach((tg: any) => {
    const name = String(tg.name || '').trim();
    if (!name || tg.isArchived || !usedTags.has(String(tg.uuid))) return;
    const gid = uid();
    tagIdMap[String(tg.uuid)] = gid;
    groups.push({ id: gid, name, color: tg.color ? hex(tg.color) : undefined, sourceId: 'amp:' + String(tg.uuid) });
  });

  const sysGroupMap: Record<string, string> = {};
  if (systems.length > 1) {
    systems.forEach((sy: any, i: number) => {
      const gid = uid();
      if (sy?.uuid != null) sysGroupMap[String(sy.uuid)] = gid;
      groups.push({ id: gid, name: (sy?.name && String(sy.name).trim()) || `System ${i + 1}`, sourceId: 'amp:sys:' + String(sy?.uuid || i) });
    });
  }

  const idMap: Record<string, string> = {};
  const dataUri = (v: any): string | undefined => {
    const s = String(v || '');
    return s.startsWith('data:') ? s : undefined;
  };
  const members: Member[] = mem
    .filter((a: any) => !!a)
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
      if (ageFieldId && a?.age != null && String(a.age).trim() !== '') {
        cfs.push({ fieldId: ageFieldId, value: String(a.age) });
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
        isCustomFront: !!(a.isCustomFront || a.isDissociativeState),
        avatar: dataUri(a.image),
        banner: dataUri(a.cover),
        createdAt: a.dateCreated ? toMs(a.dateCreated) : undefined,
        tags: [],
        groupIds: [
          ...(Array.isArray(a.tags) ? a.tags : []).map((t: any) => tagIdMap[String(t)]).filter(Boolean) as string[],
          ...(a.system != null && sysGroupMap[String(a.system)] ? [sysGroupMap[String(a.system)]] : []),
        ],
        customFields: cfs,
      } as Member;
    });

  const spans = new Map<string, { start: any; end: any; main: string[]; co: string[]; notes: string[] }>();
  fronting.forEach((f: any) => {
    if (!f || !f.member) return;
    const key = `${String(f.startTime || '')}|${String(f.endTime || '')}`;
    let s = spans.get(key);
    if (!s) { s = { start: f.startTime, end: f.endTime ?? null, main: [], co: [], notes: [] }; spans.set(key, s); }
    (f.isMainFronter ? s.main : s.co).push(String(f.member));
    const note = String(f.comment || f.summary || f.customStatus || '').trim();
    if (note) s.notes.push(note);
  });
  const history: HistoryEntry[] = [];
  spans.forEach(s => {
    const main = s.main.map(u => idMap[u]).filter(Boolean) as string[];
    const co = s.co.map(u => idMap[u]).filter(Boolean) as string[];
    const startTime = toMs(s.start);
    if (startTime <= 0 || (main.length === 0 && co.length === 0)) return;
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

  const tagName: Record<string, string> = {};
  tags.forEach((tg: any) => { if (tg?.uuid != null) tagName[String(tg.uuid)] = String(tg.name || ''); });
  const memberName: Record<string, string> = {};
  mem.forEach((a: any) => { memberName[String(a?.uuid)] = String(a?.name || '').trim(); });
  const authorOf = (u: any): string[] => (idMap[String(u)] ? [idMap[String(u)]] : []);
  const journal: NonNullable<ConvertedImport['journal']> = (Array.isArray(db.journalPosts) ? db.journalPosts : []).map((p: any) => ({
    title: String(p?.title || '').trim(),
    body: String(p?.body || ''),
    authorIds: authorOf(p?.member),
    hashtags: (Array.isArray(p?.tags) ? p.tags : []).map((t: any) => tagName[String(t)]).filter(Boolean),
    timestamp: toMs(p?.date),
    pinned: !!p?.isPinned,
  }));
  (Array.isArray(db.boardMessages) ? db.boardMessages : []).forEach((b: any) => {
    let body = String(b?.body || '');
    const entries = Array.isArray(b?.poll?.entries) ? b.poll.entries : [];
    if (entries.length > 0) {
      const lines = entries.map((e: any) => {
        const votes = Array.isArray(e?.votes) ? e.votes : [];
        const who = votes.map((v: any) => {
          const n = memberName[String(v?.member)] || '';
          const reason = String(v?.reason || '').trim();
          return reason ? `${n} (${reason})` : n;
        }).filter(Boolean);
        return `- **${String(e?.choice || '')}** — ${votes.length}${who.length ? `: ${who.join(', ')}` : ''}`;
      });
      body = `${body}\n\n${lines.join('\n')}`.trim();
    }
    journal.push({
      title: String(b?.title || '').trim(),
      body,
      authorIds: authorOf(b?.member),
      hashtags: [],
      timestamp: toMs(b?.date),
      pinned: !!b?.isPinned,
    });
  });

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
