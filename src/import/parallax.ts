import { Member, pushTo, uid } from '../utils';
import { asArray } from './formats';
import { normHex, pxTime, convertParallaxFronts } from './convert';
import type { PxExport, PxMember, PxFront, PxMessage } from './formats';
import { ConvertedImport, unnamed } from './converted';

export const convertParallax = (d: PxExport): ConvertedImport => {
  const mem = asArray<PxMember>(d?.members);
  const idMap = new Map<string, string>();
  const members: Member[] = [...mem]
    .sort((a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
    .filter(m => m && m.id)
    .map(m => {
      const id = uid();
      idMap.set(String(m.id), id);
      const spId = String(m.sp_id || '');
      return {
        id,
        sourceId: /^[0-9a-f]{24}$/i.test(spId) ? spId : `px:${String(m.id)}`,
        name: unnamed(m.name),
        pronouns: String(m.pronouns || ''),
        role: String(m.role || ''),
        color: normHex(m.color_theme),
        description: String(m.description || ''),
        archived: m.is_active === false,
        tags: [],
        groupIds: [],
        customFields: [],
      };
    });
  const history = convertParallaxFronts(asArray<PxFront>(d?.fronting_log), idMap);
  const byChat = new Map<string, { authorId: string; content: string; timestamp: number }[]>();
  asArray<PxMessage>(d?.messages).forEach(m => {
    const chatId = String(m?.chat_id || '');
    const authorId = idMap.get(String(m?.from_part_id));
    const content = String(m?.body || '');
    const timestamp = pxTime(m?.created_at);
    if (!chatId || !authorId || !content || !timestamp) return;
    pushTo(byChat, chatId, { authorId, content, timestamp });
  });
  const chat = [...byChat.values()]
    .map(messages => messages.sort((a, b) => a.timestamp - b.timestamp))
    .sort((a, b) => a[0].timestamp - b[0].timestamp)
    .map((messages, i) => ({ name: `Parallax ${i + 1}`, createdAt: messages[0].timestamp, messages }));
  return { sourceLabel: 'Parallax', members, history, groups: [], chat: chat.length > 0 ? chat : undefined };
};
