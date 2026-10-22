/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RELAY_URL?: string;
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_LOG_LEVEL?: string;
  readonly VITE_VERBOSE_NETWORK?: string;
  readonly VITE_SKIP_UPDATE_CHECK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface FileFilter { name: string; extensions: string[] }

interface Window {
  electronAPI: {
    store: {
      get: (key: string) => Promise<unknown>;
      set: (key: string, value: unknown) => Promise<void>;
      setBatch: (updates: Record<string, unknown>) => Promise<void>;
      remove: (key: string) => Promise<void>;
      clearAll: () => Promise<void>;
      allKeys: () => Promise<string[]>;
    };
    dialog: {
      openFile: (filters?: FileFilter[]) => Promise<string | null>;
      saveFile: (defaultName: string, filters?: FileFilter[]) => Promise<string | null>;
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
    app: {
      version: () => Promise<string>;
    };
    window: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
    shell: {
      setLabels: (labels: Record<string, string>) => void;
    };
    platform: string;
  };
}
