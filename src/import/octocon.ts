import { Member, uid } from '../utils';
import { asArray } from './formats';
import { normHex, ocTime, convertSPSwitches } from './convert';
import type { OcExport, OcAlter, OcFront, SpSwitchDoc } from './formats';
import { ConvertedImport, httpUrl, unnamed } from './converted';

export const convertOctocon = (d: OcExport): ConvertedImport => {
  const u = d.user || {};
  const idMap = new Map<string, string>();
  const members: Member[] = asArray<OcAlter>(d.alters).map(a => {
    const id = uid();
    idMap.set(String(a.id), id);
    return {
      id, sourceId: String(a.id),
      name: unnamed(a.name),
      pronouns: String(a.pronouns || ''), role: '', color: normHex(a.color), description: String(a.description || ''),
      avatar: httpUrl(a.avatar_url),
      tags: [], groupIds: [], customFields: [],
    };
  });
  const switches: SpSwitchDoc[] = asArray<OcFront>(d.fronts).map(f => ({content: {member: String(f.alter_id), startTime: ocTime(f.time_start), endTime: ocTime(f.time_end), comment: f.comment || ''}}));
  return { sourceLabel: 'Octocon', members, history: convertSPSwitches(switches, idMap), systemName: u.username, systemDesc: u.description };
};
