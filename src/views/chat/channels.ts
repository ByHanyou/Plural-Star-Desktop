import { arrayMove } from '@dnd-kit/sortable';
import {
  CHAT_CHANNEL_LIMIT, ChatChannel, ChatCategory,
  uid, sortChatCategories, chatChannelsIn, applySortOrder, moveChannelToCategory, releaseCategoryChannels,
} from '../../utils';
import { store, chatMsgKey } from '../../storage';
import { saveData } from '../../store/actions';
import { useAppStore } from '../../store/appStore';

const lists = () => {
  const { channels, chatCategories } = useAppStore.getState();
  return { channels, categories: chatCategories };
};

const openChannelsIn = (channels: ChatChannel[], categoryId: string | null | undefined, categories: ChatCategory[]) =>
  chatChannelsIn(channels.filter(c => !c.archived), categoryId, categories);

const saveChannels = (channels: ChatChannel[]): Promise<void> => saveData('channels', channels);

const saveCategories = (categories: ChatCategory[]): Promise<void> => saveData('chatCategories', categories);

export const knownCategoryId = (categories: ChatCategory[], id: string | undefined): string | null =>
  id && categories.some(c => c.id === id) ? id : null;

export const createChannel = async (name: string): Promise<ChatChannel | null> => {
  const { channels, categories } = lists();
  if (channels.filter(c => !c.archived).length >= CHAT_CHANNEL_LIMIT) return null;
  const channel: ChatChannel = { id: uid(), name, sortOrder: openChannelsIn(channels, null, categories).length, createdAt: Date.now() };
  await saveChannels([...channels, channel]);
  return channel;
};

export const updateChannel = async (id: string, name: string, categoryId: string | null): Promise<void> => {
  const { channels, categories } = lists();
  const channel = channels.find(c => c.id === id);
  if (!channel) return;
  const placed = knownCategoryId(categories, channel.categoryId) === categoryId ? channels : moveChannelToCategory(channels, categories, id, categoryId);
  await saveChannels(placed.map(c => (c.id === id ? { ...c, name } : c)));
};

export const deleteChannel = async (id: string): Promise<void> => {
  await store.remove(chatMsgKey(id));
  await saveChannels(lists().channels.filter(c => c.id !== id));
};

export const setChannelArchived = (id: string, archived: boolean): Promise<void> =>
  saveChannels(lists().channels.map(c => (c.id === id ? { ...c, archived, archivedAt: archived ? Date.now() : undefined } : c)));

export const createCategory = (name: string): Promise<void> => {
  const { categories } = lists();
  return saveCategories([...categories, { id: uid(), name, sortOrder: categories.length, createdAt: Date.now() }]);
};

export const updateCategory = (id: string, patch: Partial<Pick<ChatCategory, 'name' | 'collapsed'>>): Promise<void> =>
  saveCategories(lists().categories.map(c => (c.id === id ? { ...c, ...patch } : c)));

export const deleteCategory = async (id: string): Promise<void> => {
  const { channels, categories } = lists();
  if (channels.some(c => c.categoryId === id)) await saveChannels(releaseCategoryChannels(channels, categories, id));
  await saveCategories(categories.filter(c => c.id !== id));
};

export const reorderChat = async (draggedId: string, overId: string): Promise<void> => {
  const { channels, categories } = lists();
  const sorted = sortChatCategories(categories);
  const catFrom = sorted.findIndex(c => c.id === draggedId);
  if (catFrom >= 0) {
    const catTo = sorted.findIndex(c => c.id === overId);
    if (catTo >= 0) await saveCategories(applySortOrder(categories, arrayMove(sorted, catFrom, catTo).map(c => c.id)));
    return;
  }
  const channel = channels.find(c => c.id === draggedId);
  if (!channel) return;
  const list = openChannelsIn(channels, channel.categoryId, categories);
  const from = list.findIndex(c => c.id === draggedId);
  const to = list.findIndex(c => c.id === overId);
  if (from >= 0 && to >= 0) await saveChannels(applySortOrder(channels, arrayMove(list, from, to).map(c => c.id)));
};
