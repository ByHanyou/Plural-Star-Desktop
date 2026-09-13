declare global {
  interface Window {
    electronAPI: {
      store: {
        get: (key: string) => Promise<unknown>;
        getStrict: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
        setBatch: (updates: Record<string, unknown>) => Promise<void>;
        remove: (key: string) => Promise<void>;
        clearAll: () => Promise<void>;
        allKeys: () => Promise<string[]>;
      };
      dialog: {
        openFile: (filters?: any[]) => Promise<string | null>;
        saveFile: (defaultName: string) => Promise<string | null>;
      };
      file: {
        readAsBase64: (filePath: string) => Promise<string | null>;
        write: (filePath: string, content: string) => Promise<void>;
        writeBytes: (filePath: string, base64: string) => Promise<void>;
      };
      net: {
        fetch: (url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) =>
          Promise<{ ok: boolean; status: number; text: string }>;
        fetchImage: (url: string) => Promise<string | null>;
        fetchRaw: (url: string, options?: { method?: string; headers?: Record<string, string>; bodyBase64?: string; timeoutMs?: number }) =>
          Promise<{ status: number; headers: Record<string, string>; bodyBase64: string; error?: string }>;
      };
      notify: (title: string, body: string) => Promise<void>;
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
      platform: string;
    };
  }
}

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

import { FRONT_CLEARED_KEY } from './network/types';

export const chatMsgKey = (channelId: string): string => `ps:chat:${channelId}`;

const frontValueIsEmpty = (v: unknown): boolean => {
  if (v == null) return true;
  const f = v as any;
  if (typeof f !== 'object') return false;
  const n = (t: any) => (t && Array.isArray(t.memberIds) ? t.memberIds.length : 0);
  return n(f.primary) + n(f.coFront) + n(f.coConscious) === 0;
};

// One listener for "something was saved", used by Cloud Services so that every
// Save also saves to the cloud (SPEC 8.1) without each action knowing about
// it. Applying data FROM the cloud writes the electron store directly, not
// through here, so it cannot echo back into another upload. `removed` is true
// for a removal (store.remove, or an undefined value in setBatch): the one
// signal that a key left on purpose, as opposed to one that merely read back
// missing and should be repaired from the vault.
let writeListener: ((key: string, removed?: boolean) => void) | null = null;
export const onStoreWrite = (fn: ((key: string, removed?: boolean) => void) | null): void => {
  writeListener = fn;
};

export const store = {
  async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
    try {
      const raw = await window.electronAPI.store.get(key);
      if (raw === null || raw === undefined) return fallback;
      return raw as T;
    } catch {
      return fallback;
    }
  },

  async getStrict<T>(key: string, fallback: T | null = null): Promise<T | null> {
    const raw = await window.electronAPI.store.getStrict(key);
    if (raw === null || raw === undefined) return fallback;
    return raw as T;
  },

  async set(key: string, value: unknown): Promise<void> {
    try {
      if (key === KEYS.front && frontValueIsEmpty(value)) {
        await window.electronAPI.store.set(FRONT_CLEARED_KEY, Date.now());
      }
      await window.electronAPI.store.set(key, value);
    } catch (e) {
      console.error('Storage write error:', e);
    }
    if (writeListener) {
      try { writeListener(key); } catch {}
    }
  },

  async setBatch(updates: Record<string, unknown>): Promise<void> {
    await window.electronAPI.store.setBatch(updates);
    if (writeListener) {
      for (const key in updates) {
        try { writeListener(key, updates[key] === undefined); } catch {}
      }
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await window.electronAPI.store.remove(key);
    } catch (e) {
      console.error('Storage remove error:', e);
    }
    if (writeListener) {
      try { writeListener(key, true); } catch {}
    }
  },

  async clearAll(): Promise<void> {
    try {
      await window.electronAPI.store.clearAll();
    } catch (e) {
      console.error('Storage clear error:', e);
    }
  },
};

