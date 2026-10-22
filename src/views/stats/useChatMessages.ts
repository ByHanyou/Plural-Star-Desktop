import { useEffect, useState } from 'react';
import type { ChatChannel, ChatMessage } from '../../utils';
import { store, chatMsgKey } from '../../storage';
import { logError } from '../../utils/log';

export const useChatMessages = (channels: ChatChannel[]): ChatMessage[] => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let all: ChatMessage[] = [];
      for (const ch of channels) {
        if (ch.archived) continue;
        try {
          all = all.concat((await store.get<ChatMessage[]>(chatMsgKey(ch.id), [])) || []);
        } catch (e) { logError('stats', e); }
      }
      if (!cancelled) setMessages(all);
    })();
    return () => { cancelled = true; };
  }, [channels]);
  return messages;
};
