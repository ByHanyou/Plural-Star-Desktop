import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../utils';
import { store, chatMsgKey } from '../../storage';
import { NetworkManager } from '../../network/NetworkManager';
import { logError } from '../../utils/log';

const readMessages = async (channelId: string): Promise<ChatMessage[]> =>
  (await store.get<ChatMessage[]>(chatMsgKey(channelId), [])) || [];

export function useChannelMessages(channelId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadedChannelId, setLoadedChannelId] = useState<string | null>(null);
  const messagesRef = useRef(messages);
  const loadedRef = useRef(loadedChannelId);
  const channelRef = useRef(channelId);
  channelRef.current = channelId;

  const show = useCallback((id: string, list: ChatMessage[]) => {
    messagesRef.current = list;
    loadedRef.current = id;
    setMessages(list);
    setLoadedChannelId(id);
  }, []);

  const load = useCallback(async (id: string) => {
    try {
      const list = await readMessages(id);
      if (channelRef.current === id) show(id, list);
    } catch (e) { logError('chat', e); }
  }, [show]);

  useEffect(() => {
    if (channelId) void load(channelId);
  }, [channelId, load]);

  useEffect(() => NetworkManager.onSyncApplied(() => {
    if (channelId) void load(channelId);
  }), [channelId, load]);

  const update = useCallback(async (change: (current: ChatMessage[]) => ChatMessage[]) => {
    if (!channelId) return;
    const base = loadedRef.current === channelId ? messagesRef.current : await readMessages(channelId);
    const next = change(base);
    if (channelRef.current === channelId) show(channelId, next);
    try {
      await store.set(chatMsgKey(channelId), next);
    } catch (e) {
      if (channelRef.current === channelId && messagesRef.current === next) show(channelId, base);
      throw e;
    }
  }, [channelId, show]);

  return { messages, loadedChannelId, update };
}
