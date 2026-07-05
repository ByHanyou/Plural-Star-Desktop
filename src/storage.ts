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
  journalTemplates: 'ps:journalTemplates',
  relationships: 'ps:relationships',
  relationshipTypes: 'ps:relationshipTypes',
  systemMapMembers: 'ps:systemMapMembers',
  systemMapPositions: 'ps:systemMapPositions',
  whiteboard:   'ps:whiteboard',
  medical:      'ps:medical',
};

export const chatMsgKey = (channelId: string): string => `ps:chat:${channelId}`;

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
      await window.electronAPI.store.set(key, value);
    } catch (e) {
      console.error('Storage write error:', e);
    }
  },

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
