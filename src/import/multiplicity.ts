import { Member, uid } from '../utils';
import { asArray } from './formats';
import { normHex, convertSPSwitches } from './convert';
import type { MxExport, MxAlter, MxFront, SpSwitchDoc } from './formats';
import { ConvertedImport, httpUrl, unnamed } from './converted';

export const convertMultiplicity = (d: MxExport): ConvertedImport => {
  const sys = d.system || {};
  const idMap = new Map<string, string>();
  const members: Member[] = asArray<MxAlter>(d.alters).map(a => {
    const id = uid();
    idMap.set(String(a.alter_id), id);
    return {
      id, sourceId: 'mx:' + String(a.alter_id),
      name: unnamed(String(a.name || '').trim() || a.display_name),
      pronouns: String(a.pronouns || ''), role: '', color: normHex(a.colour), description: String(a.description || ''),
      archived: !!a.is_archived,
      avatar: a.avatar_data ? `data:image/png;base64,${a.avatar_data}` : httpUrl(a.avatar_url),
      tags: [], groupIds: [], customFields: [],
    };
  });
  const switches: SpSwitchDoc[] = asArray<MxFront>(d.front_entries).map(f => ({content: {member: String(f.alter_id), startTime: f.start_time, endTime: f.end_time ?? null, comment: f.notes || ''}}));
  return { sourceLabel: 'HiveMind', members, history: convertSPSwitches(switches, idMap), systemName: sys.name, systemDesc: sys.description };
};
