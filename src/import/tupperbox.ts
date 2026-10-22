import { Member, MemberGroup, uid } from '../utils';
import { asArray } from './formats';
import { normHex, pxTime } from './convert';
import type { TbExport, TbTupper, TbGroup } from './formats';
import { ConvertedImport, unnamed } from './converted';

export const convertTupperbox = (d: TbExport): ConvertedImport => {
  const groups: MemberGroup[] = [];
  const groupIdMap = new Map<string, string>();
  asArray<TbGroup>(d.groups).forEach(g => {
    const name = (g?.name && String(g.name).trim()) || '';
    if (!name || g?.id == null) return;
    const gid = uid();
    groupIdMap.set(String(g.id), gid);
    groups.push({ id: gid, name, description: g.description ? String(g.description) : undefined, sourceId: 'tb:g:' + String(g.id) });
  });

  const members: Member[] = asArray<TbTupper>(d.tuppers).map(tp => {
    const rawBr = asArray(tp?.brackets);
    const proxyTags: { prefix?: string | null; suffix?: string | null }[] = [];
    if (rawBr.length % 2 === 0) {
      for (let i = 0; i + 1 < rawBr.length; i += 2) {
        proxyTags.push({ prefix: rawBr[i] == null ? null : String(rawBr[i]), suffix: rawBr[i + 1] == null ? null : String(rawBr[i + 1]) });
      }
    }
    const groupId = tp?.group_id != null ? groupIdMap.get(String(tp.group_id)) : undefined;
    return {
      id: uid(),
      sourceId: 'tb:' + String(tp?.id ?? uid()),
      name: unnamed(tp?.name),
      pronouns: '', role: '', color: normHex(undefined),
      description: String(tp?.description || ''),
      tags: [], customFields: [],
      groupIds: groupId ? [groupId] : [],
      avatar: tp?.avatar_url ? String(tp.avatar_url) : undefined,
      createdAt: pxTime(tp?.created_at) || undefined,
      ...(proxyTags.length > 0 ? { pkProxyTags: proxyTags } : {}),
      ...(tp?.avatar_url ? { pkAvatarUrl: String(tp.avatar_url) } : {}),
    };
  });

  return { sourceLabel: 'Tupperbox', members, history: [], groups };
};
