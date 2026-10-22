import { store, chatMsgKey } from '../storage';
import { importNameKey } from './importNames';
import { Member, HistoryEntry, ChatChannel, ChatMessage, SystemInfo, MemberGroup, uid } from '../utils';
import { findClaimableByName, chatSig } from './convert';
import { decodeBase64 } from '../network/bytes';
import { ImportUserError } from './ctx';
import type { ConvertedImport } from './converted';

export const channelByName = (channels: ChatChannel[], name: string, createdAt: number): ChatChannel => {
  let local = channels.find(c => importNameKey(c.name) === importNameKey(name));
  if (!local) {
    local = { id: uid(), name, createdAt };
    channels.push(local);
  }
  return local;
};

export const appendChat = async (batch: Record<string, unknown>, channelId: string, msgs: ChatMessage[]): Promise<void> => {
  const cur = await store.getStrict<ChatMessage[]>(chatMsgKey(channelId), []) || [];
  const seen = new Set(cur.map(chatSig));
  const fresh = msgs.filter(m => !seen.has(chatSig(m)));
  if (fresh.length > 0) batch[chatMsgKey(channelId)] = [...cur, ...fresh].sort((a, b) => a.timestamp - b.timestamp);
};

export const mergeTarget = (merged: Member[], idRemap: ReadonlyMap<string, string>, sourceId: string | undefined, name: string | undefined): number => {
  const bySource = sourceId ? merged.findIndex(e => e.sourceId === sourceId) : -1;
  return bySource >= 0 ? bySource : findClaimableByName(merged, new Set(idRemap.values()), String(name || ''));
};

export const mergeImportedGroups = (existing: MemberGroup[], incoming: MemberGroup[], srcIdOf: (g: MemberGroup) => string): { groups: MemberGroup[]; remap: Map<string, string> } => {
  const groups = [...existing];
  const remap = new Map<string, string>();
  incoming.forEach(g => {
    const srcId = srcIdOf(g);
    const bySource = groups.findIndex(e => e.sourceId === srcId);
    const at = bySource >= 0 ? bySource : groups.findIndex(e => !e.sourceId && importNameKey(e.name) === importNameKey(g.name));
    if (at >= 0) {
      remap.set(g.id, groups[at].id);
      groups[at] = { ...groups[at], name: g.name, sourceId: srcId };
    } else {
      groups.push({ ...g, sourceId: srcId });
    }
  });
  return { groups, remap };
};

export const remapHistory = (entries: HistoryEntry[], idRemap: ReadonlyMap<string, string>): HistoryEntry[] => {
  const local = (id: string): string => idRemap.get(id) || id;
  return entries.map(h => ({ ...h, memberIds: h.memberIds.map(local), coFrontIds: h.coFrontIds?.map(local), coConsciousIds: h.coConsciousIds?.map(local) }));
};

export const importedSystem = (system: SystemInfo, conv: Pick<ConvertedImport, 'systemName' | 'systemDesc' | 'systemAvatar' | 'systemBanner'>): SystemInfo | null =>
  conv.systemName || conv.systemAvatar || conv.systemBanner
    ? {
      ...system,
      name: conv.systemName || system.name,
      description: conv.systemDesc || system.description,
      ...(conv.systemAvatar ? { avatar: conv.systemAvatar } : {}),
      ...(conv.systemBanner ? { banner: conv.systemBanner } : {}),
    }
    : null;

export const readFileBytes = async (filePath: string, notFound: string): Promise<Uint8Array> => {
  const dataUri = await window.electronAPI.file.readAsBase64(filePath);
  if (!dataUri) throw new ImportUserError(notFound);
  return decodeBase64(dataUri.split(',')[1] || '');
};
