const DB_NAME = 'ps-mirror-gifs';
const STORE = 'gifs';
const KEY_TOP = String.fromCharCode(0xffff);

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('indexedDB open failed'));
    req.onblocked = () => reject(new Error('indexedDB open blocked'));
  });
  dbPromise = p;
  p.catch(() => {
    if (dbPromise === p) dbPromise = null;
  });
  return p;
};

const withStore = <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | null): Promise<T | undefined> =>
  openDb().then(db => new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error || new Error('indexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('indexedDB transaction aborted'));
  }));

const prefixRange = (prefix: string): IDBKeyRange => IDBKeyRange.bound(prefix, prefix + KEY_TOP);

export const mirrorGifKey = (peerId: string, feature: string, id: string, h: string): string => `${peerId}|${feature}|${id}|${h}`;

export const putMirrorGif = async (key: string, b64: string): Promise<boolean> => {
  try {
    await withStore('readwrite', s => s.put(b64, key));
    return true;
  } catch {
    return false;
  }
};

export const getMirrorGif = async (key: string): Promise<string | null> => {
  try {
    const v = await withStore<unknown>('readonly', s => s.get(key));
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
};

export const listMirrorGifKeys = async (peerId: string, feature: string): Promise<string[]> => {
  try {
    const keys = await withStore<IDBValidKey[]>('readonly', s => s.getAllKeys(prefixRange(`${peerId}|${feature}|`)));
    return (keys || []).filter((k): k is string => typeof k === 'string');
  } catch {
    return [];
  }
};

export const deleteMirrorGifKeys = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  try {
    await withStore('readwrite', s => {
      for (const k of keys) s.delete(k);
      return null;
    });
  } catch {}
};

export const clearMirrorGifsFor = async (peerId: string): Promise<void> => {
  try {
    await withStore('readwrite', s => s.delete(prefixRange(`${peerId}|`)));
  } catch {}
};

export const clearAllMirrorGifs = async (): Promise<void> => {
  try {
    await withStore('readwrite', s => s.clear());
  } catch {}
};
