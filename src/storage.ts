// Desktop storage adapter — same interface as mobile storage.ts
// Communicates with electron-store via IPC through the preload bridge

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
      };
      net: {
        fetch: (url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) =>
          Promise<{ ok: boolean; status: number; text: string }>;
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
  customFieldDefs: 'ps:customFieldDefs',
  noteboards:   'ps:noteboards',
  polls:        'ps:polls',
};

export const chatMsgKey = (channelId: string): string => `ps:chat:${channelId}`;

export const store = {
  // Permissive get — returns fallback on error, used by view-load paths where empty-on-failure is acceptable.
  async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
    try {
      const raw = await window.electronAPI.store.get(key);
      if (raw === null || raw === undefined) return fallback;
      return raw as T;
    } catch {
      return fallback;
    }
  },

  // Strict get — throws on error. Use this when a silent empty fallback would cause a destructive merge
  // (e.g., reading existing list to merge import into; if the read fails and we get [], we'd overwrite with just imported data).
  async getStrict<T>(key: string, fallback: T | null = null): Promise<T | null> {
    const raw = await window.electronAPI.store.getStrict(key);
    if (raw === null || raw === undefined) return fallback;
    return raw as T;
  },

  async set(key: string, value: unknown): Promise<void> {
    try {
      await window.electronAPI.store.set(key, value);
    } catch (e) {
      console.error('Storage write error:', e);
    }
  },

  // Atomic multi-key write. Use for imports/restores where multiple keys must land together,
  // or be unchanged together if anything fails. Errors are NOT swallowed — caller must catch.
  async setBatch(updates: Record<string, unknown>): Promise<void> {
    await window.electronAPI.store.setBatch(updates);
  },

  async remove(key: string): Promise<void> {
    try {
      await window.electronAPI.store.remove(key);
    } catch (e) {
      console.error('Storage remove error:', e);
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
