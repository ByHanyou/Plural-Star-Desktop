import { FRONT_CLEARED_KEY } from './network/types';
import { asRecord } from './utils';
import { log } from './utils/log';
import { Emitter } from './utils/emitter';
import { clearAllMirrorGifs } from './network/mirrorGifStore';

export const KEYS = {
  system:       'ps:system',
  members:      'ps:members',
  front:        'ps:front',
  history:      'ps:history',
  journal:      'ps:journal',
  share:        'ps:share',
  settings:     'ps:settings',
  lightMode:    'ps:lightMode',
  language:     'ps:language',
  groups:       'ps:groups',
  palettes:     'ps:palettes',
  chatChannels: 'ps:chatChannels',
  chatCategories: 'ps:chatCategories',
  customFieldDefs: 'ps:customFieldDefs',
  noteboards:   'ps:noteboards',
  polls:        'ps:polls',
  journalTemplates: 'ps:journalTemplates',
  relationships: 'ps:relationships',
  relationshipTypes: 'ps:relationshipTypes',
  systemMapMembers: 'ps:systemMapMembers',
  systemMapPositions: 'ps:systemMapPositions',
  whiteboard:   'ps:whiteboard',
  customColors: 'ps:customColors',
  medical:      'ps:medical',
  planner:      'ps:planner',
};

export const CHAT_KEY_PREFIX = 'ps:chat:';
export const chatMsgKey = (channelId: string): string => `${CHAT_KEY_PREFIX}${channelId}`;

const tierSize = (t: unknown): number => (t && typeof t === 'object' && 'memberIds' in t && Array.isArray(t.memberIds) ? t.memberIds.length : 0);

const frontValueIsEmpty = (v: unknown): boolean => {
  if (v == null) return true;
  if (typeof v !== 'object') return false;
  const f = asRecord(v) ?? {};
  return tierSize(f.primary) + tierSize(f.coFront) + tierSize(f.coConscious) === 0;
};

const stampFrontCleared = async (key: string, value: unknown): Promise<void> => {
  if (key === KEYS.front && frontValueIsEmpty(value)) await window.electronAPI.store.set(FRONT_CLEARED_KEY, Date.now());
};

export const parseRaw = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const writes = new Emitter<[key: string, removed?: boolean]>('storage');
export const onStoreWrite = (fn: (key: string, removed?: boolean) => void): (() => void) => writes.on(fn);

export const store = {
  async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
    try {
      return await store.getStrict<T>(key, fallback);
    } catch (e) {
      log.warn('storage', 'read error:', e);
      return fallback;
    }
  },

  async getStrict<T>(key: string, fallback: T | null = null): Promise<T | null> {
    const raw = await window.electronAPI.store.get(key);
    if (raw === null || raw === undefined) return fallback;
    return raw as T;
  },

  async set(key: string, value: unknown): Promise<void> {
    try {
      await stampFrontCleared(key, value);
      await window.electronAPI.store.set(key, value);
    } catch (e) {
      log.error('storage', 'write error:', e);
      throw e;
    }
    writes.emit(key);
  },

  async setRaw(key: string, json: string): Promise<void> {
    const value = parseRaw(json);
    await stampFrontCleared(key, value);
    await window.electronAPI.store.set(key, value);
  },

  async setBatch(updates: Record<string, unknown>): Promise<void> {
    if (KEYS.front in updates) await stampFrontCleared(KEYS.front, updates[KEYS.front]);
    await window.electronAPI.store.setBatch(updates);
    for (const key in updates) writes.emit(key, updates[key] === undefined);
  },

  async remove(key: string): Promise<void> {
    try {
      await window.electronAPI.store.remove(key);
    } catch (e) {
      log.error('storage', 'remove error:', e);
      throw e;
    }
    writes.emit(key, true);
  },

  async clearAll(): Promise<void> {
    try {
      await window.electronAPI.store.clearAll();
    } catch (e) {
      log.error('storage', 'clear error:', e);
    }
    await clearAllMirrorGifs();
  },
};

