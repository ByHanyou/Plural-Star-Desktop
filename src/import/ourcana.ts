import { Member, MemberGroup, CustomFieldDef, CustomFieldType, CustomFieldValue, asRecord, pushTo, uid } from '../utils';
import i18n from '../i18n/i18n';
import { bytesToDataUri } from './importMedia';
import { strFromU8 } from 'fflate';
import { asArray } from './formats';
import { normHex, convertOurcanaFronts, localIds } from './convert';
import type { OuExport, OuNode, OuEdge, OuMember, OuFront, OuTag, OuAssetIndexEntry } from './formats';
import { ConvertedImport, optString, optNumber, httpUrl, unnamed, fieldName } from './converted';

type ZipEntry = { name: string; bytes: Uint8Array };

const OURCANA_FIELD_TYPE = new Map<string, CustomFieldType>([['number', 'number'], ['boolean', 'toggle'], ['toggle', 'toggle'], ['date', 'date']]);

const zipEntryUri = (f: ZipEntry | null): string | undefined => {
  if (!f) return undefined;
  try { return bytesToDataUri(f.bytes, f.name.split('/').pop() || 'a.png'); } catch { return undefined; }
};

const ourZipAvatarFor = (zipFiles: Record<string, Uint8Array>, ownerId: string): ZipEntry | null => {
  if (!ownerId) return null;
  const name = Object.keys(zipFiles).find(n => {
    const parts = n.split('/');
    const file = parts[parts.length - 1];
    return parts[parts.length - 2] === 'avatars' && file.startsWith(`${ownerId}.`);
  });
  return name ? { name, bytes: zipFiles[name] } : null;
};

const ourAssetFor = (zipFiles: Record<string, Uint8Array>, ownerId: string, role: string): ZipEntry | null => {
  if (!ownerId) return null;
  const idxName = Object.keys(zipFiles).find(n => n.endsWith('image_assets/index.json'));
  if (!idxName) return null;
  try {
    const idx: unknown = JSON.parse(strFromU8(zipFiles[idxName]));
    const assets = asArray<OuAssetIndexEntry>(asRecord(idx)?.assets);
    const hit = assets
      .filter(a => a && a.role === role && String(a.ownerId) === ownerId && typeof a.localPath === 'string')
      .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))[0];
    if (!hit) return null;
    const entry = Object.keys(zipFiles).find(n => n === hit.localPath || n.endsWith(`/${hit.localPath}`));
    return entry ? { name: entry, bytes: zipFiles[entry] } : null;
  } catch { return null; }
};

const convertOurcanaGraph = (nodes: OuNode[], edges: OuEdge[], zipFiles?: Record<string, Uint8Array>): ConvertedImport => {
  const byType = (t: string) => nodes.filter(n => n && n.type === t);
  const sysNode = byType('system')[0];
  const sys = sysNode?.properties || {};

  const cfDefs: CustomFieldDef[] = [];
  const cfIdMap = new Map<string, string>();
  byType('customField')
    .slice()
    .sort((a, b) => (optNumber(a.properties?.order) ?? 0) - (optNumber(b.properties?.order) ?? 0))
    .forEach((n, i) => {
      const p = n.properties || {};
      const id = uid();
      cfIdMap.set(String(n.id), id);
      const type = OURCANA_FIELD_TYPE.get(String(p.type || 'text').toLowerCase()) ?? 'text';
      cfDefs.push({ id, name: fieldName(p.label, i), type, sortOrder: optNumber(p.order) ?? i });
    });

  const tagNodes = byType('tag').filter(n => !String(n.id).startsWith('tag_default_'));
  const groups: MemberGroup[] = [];
  const gmap = new Map<string, string>();
  tagNodes.forEach(n => {
    const p = n.properties || {};
    const gid = uid();
    gmap.set(String(n.id), gid);
    groups.push({ id: gid, name: String(p.label || i18n.t('memberGroups.group')), color: p.color ? normHex(p.color) : undefined });
  });
  tagNodes.forEach(n => {
    const p = n.properties || {};
    if (p.parentId == null) return;
    const childId = gmap.get(String(n.id));
    const parentId = gmap.get(String(p.parentId));
    if (!childId || !parentId || childId === parentId) return;
    const g = groups.find(x => x.id === childId);
    if (g) g.parentId = parentId;
  });
  const memberIdSet = new Set(byType('member').map(n => String(n.id)));
  const tagIdsByMember = new Map<string, string[]>();
  edges.forEach(e => {
    if (!e || e.type !== 'taggedWith') return;
    const from = String(e.from);
    const gid = gmap.get(String(e.to));
    if (!memberIdSet.has(from) || !gid) return;
    pushTo(tagIdsByMember, from, gid);
  });

  const idMap = new Map<string, string>();
  const members: Member[] = byType('member').map(n => {
    const p = n.properties || {};
    const id = uid();
    idMap.set(String(n.id), id);
    const useDisplay = p.showOnlyDisplayName && p.displayName;
    const zipAv = zipFiles ? ourZipAvatarFor(zipFiles, String(n.id)) : null;
    const cfs: CustomFieldValue[] = [];
    const vals = asRecord(p.customFields) || {};
    for (const k in vals) {
      const fieldId = cfIdMap.get(String(k));
      const v = vals[k];
      if (!fieldId || v === null || v === undefined || v === '') continue;
      cfs.push({ fieldId, value: typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : String(v) });
    }
    return {
      id,
      sourceId: String(p.ourcanaId || n.id),
      name: unnamed(useDisplay ? p.displayName : p.name),
      pronouns: String(p.pronouns || ''),
      role: '',
      color: normHex(p.color),
      description: String(p.desc || ''),
      archived: !!p.archived,
      avatar: zipAv ? zipEntryUri(zipAv) : httpUrl(p.avatarUrl),
      tags: [],
      groupIds: tagIdsByMember.get(String(n.id)) || [],
      customFields: cfs,
    };
  });

  const fronts = byType('frontEvent').concat(byType('front')).concat(byType('frontEntry'));
  const history = convertOurcanaFronts(
    fronts.map(n => {
      const p = n.properties || {};
      return {
        memberIds: Array.isArray(p.memberIds) ? p.memberIds : (p.memberId ? [p.memberId] : []),
        startTime: p.startTime,
        endTime: p.endTime,
        isLive: p.isLive,
      };
    }),
    idMap,
  );

  const sysId = sysNode ? String(sysNode.id) : '';
  const sysAv = zipFiles && sysId ? (ourZipAvatarFor(zipFiles, sysId) || ourAssetFor(zipFiles, sysId, 'avatar')) : null;
  const sysBn = zipFiles && sysId ? ourAssetFor(zipFiles, sysId, 'banner') : null;

  return {
    sourceLabel: 'Ourcana',
    members,
    history,
    groups,
    customFieldDefs: cfDefs,
    systemName: sys.username ? String(sys.username) : undefined,
    systemDesc: sys.desc ? String(sys.desc) : undefined,
    systemAvatar: zipEntryUri(sysAv),
    systemBanner: zipEntryUri(sysBn),
  };
};

export const convertOurcana = (d: OuExport, zipFiles?: Record<string, Uint8Array>): ConvertedImport => {
  if (d.graph && Array.isArray(d.graph.nodes)) return convertOurcanaGraph(d.graph.nodes, asArray<OuEdge>(d.graph.edges), zipFiles);
  const sys = d.system || {};
  const mem = asArray<OuMember>(d.members);
  const fronts = asArray<OuFront>(d.frontHistory);
  const tags = asArray<OuTag>(d.tags);
  const idMap = new Map<string, string>();
  const groups: MemberGroup[] = [];
  const gmap = new Map<string, string>();
  tags.forEach(tg => {
    const gid = uid();
    gmap.set(String(tg.id), gid);
    groups.push({ id: gid, name: String(tg.label || tg.name || i18n.t('memberGroups.group')), color: tg.color ? normHex(tg.color) : undefined });
  });
  const members: Member[] = mem.map(m => {
    const id = uid();
    idMap.set(String(m.id), id);
    const useDisplay = m.showOnlyDisplayName && m.displayName;
    return {
      id, sourceId: String(m.id),
      name: unnamed(useDisplay ? m.displayName : m.name),
      pronouns: String(m.pronouns || ''), role: '', color: normHex(m.color), description: String(m.desc || ''),
      archived: !!m.archived, avatar: httpUrl(m.avatarUrl),
      tags: [], groupIds: Array.isArray(m.tagIds) ? localIds(gmap, m.tagIds) : [], customFields: [],
    };
  });
  const history = convertOurcanaFronts(fronts, idMap);
  return { sourceLabel: 'Ourcana', members, history, groups, systemName: optString(sys.name), systemDesc: optString(sys.desc) };
};
