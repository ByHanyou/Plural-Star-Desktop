import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import Store from 'electron-store';
import { handle, handleLogged } from './ipc.js';

function atomicWriteJson(filePath: string, data: unknown): void {
  const json = JSON.stringify(data, null, '\t');
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp.${process.pid}.${Date.now()}`);
  let fd: number | null = null;
  try {
    fd = fs.openSync(tmp, 'w', 0o666);
    fs.writeSync(fd, json);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    try {
      fs.renameSync(tmp, filePath);
    } catch (e) {
      if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'EXDEV') {
        fs.copyFileSync(tmp, filePath);
        try { fs.unlinkSync(tmp); } catch {}
      } else {
        throw e;
      }
    }
  } catch (e) {
    if (fd !== null) { try { fs.closeSync(fd); } catch {} }
    try { fs.unlinkSync(tmp); } catch {}
    throw e;
  }
}

function readJsonOrThrow(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, 'utf8');
  if (text.length === 0) return {};
  return JSON.parse(text);
}

export const registerStoreIpc = (): void => {
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const store = new Store({ name: 'plural-space-data', cwd: userDataPath });
  const STORE_FILE = store.path;

  handleLogged('store:get', (key: string) => store.get(key, null));

  handleLogged('store:set', (key: string, value: unknown) => {
    store.set(key, value);
  });

  handle('store:setBatch', (_e, updates: Record<string, unknown>) => {
    if (!updates || typeof updates !== 'object') {
      throw new TypeError('setBatch expects an object of {key: value} updates');
    }
    let current: Record<string, unknown>;
    try {
      current = readJsonOrThrow(STORE_FILE);
    } catch (e) {
      console.error('[store:setBatch] read failed, refusing to write:', e);
      throw new Error(`Cannot batch-update: store file unreadable (${e instanceof Error ? e.message : String(e)}). Refusing to overwrite to prevent data loss.`);
    }
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        delete current[key];
      } else {
        current[key] = value;
      }
    }
    atomicWriteJson(STORE_FILE, current);
  });

  handleLogged('store:remove', (key: string) => {
    store.delete(key);
  });

  handleLogged('store:clearAll', () => {
    for (const key of Object.keys(store.store)) {
      if (key.startsWith('ps:')) store.delete(key);
    }
  });

  handle('store:allKeys', () => {
    try {
      return Object.keys(store.store);
    } catch (e) {
      console.error('[store:allKeys] error:', e);
      return [];
    }
  });
};
