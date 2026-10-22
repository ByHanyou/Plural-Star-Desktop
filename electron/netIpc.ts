import path from 'node:path';
import { handle } from './ipc.js';
import { IMAGE_MIME_BY_EXT } from './fileIpc.js';

const NET_FETCH_TIMEOUT_MS = 60000;
const NET_FETCH_RAW_DEFAULT_TIMEOUT_MS = 30000;
const NET_FETCH_IMAGE_TIMEOUT_MS = 20000;
const NET_FETCH_IMAGE_MAX_BYTES = 12 * 1024 * 1024;

const deadline = (ms: number) => {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('request timed out'));
      controller.abort();
    }, ms);
  });
  return {
    signal: controller.signal,
    race: <T>(p: Promise<T>): Promise<T> => Promise.race([p, expired]),
    clear: () => clearTimeout(timer),
  };
};

export const registerNetIpc = (): void => {
  handle('net:fetch', async (_e, url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    const limit = deadline(NET_FETCH_TIMEOUT_MS);
    try {
      if (!/^https?:\/\//i.test(String(url || ''))) return { ok: false, status: 0, text: 'unsupported url' };
      const res = await limit.race(fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers || {},
        body: options?.body,
        signal: limit.signal,
      }));
      const text = await limit.race(res.text());
      return { ok: res.ok, status: res.status, text };
    } catch (e) {
      return { ok: false, status: 0, text: e instanceof Error ? e.message : String(e) };
    } finally {
      limit.clear();
    }
  });

  handle('net:fetchRaw', async (_e, url: string, options?: { method?: string; headers?: Record<string, string>; bodyBase64?: string; timeoutMs?: number }) => {
    const timeoutMs = Math.max(1000, Number(options?.timeoutMs) || NET_FETCH_RAW_DEFAULT_TIMEOUT_MS);
    const limit = deadline(timeoutMs);
    try {
      if (!/^https?:\/\//i.test(String(url || ''))) return { status: 0, headers: {}, bodyBase64: '', error: 'unsupported url' };
      const init: RequestInit = {
        method: options?.method || 'GET',
        headers: options?.headers || {},
        signal: limit.signal,
      };
      if (typeof options?.bodyBase64 === 'string') init.body = Buffer.from(options.bodyBase64, 'base64');
      const res = await limit.race(fetch(url, init));
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      const bodyBase64 = init.method === 'HEAD' ? '' : Buffer.from(await limit.race(res.arrayBuffer())).toString('base64');
      return { status: res.status, headers, bodyBase64 };
    } catch (e) {
      return { status: 0, headers: {}, bodyBase64: '', error: (e instanceof Error && e.message) || String(e) };
    } finally {
      limit.clear();
    }
  });

  handle('net:fetchImage', async (_e, url: string) => {
    const limit = deadline(NET_FETCH_IMAGE_TIMEOUT_MS);
    try {
      if (!/^https?:\/\//i.test(String(url || ''))) return null;
      const res = await limit.race(fetch(url, { headers: { 'User-Agent': 'PluralStar-Desktop' }, signal: limit.signal }));
      if (!res.ok) return null;
      const buf = Buffer.from(await limit.race(res.arrayBuffer()));
      if (buf.length === 0 || buf.length > NET_FETCH_IMAGE_MAX_BYTES) return null;
      const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      let mime = ct.startsWith('image/') ? ct : '';
      if (!mime) {
        const ext = path.extname(String(url).split('?')[0]).toLowerCase().replace('.', '');
        mime = IMAGE_MIME_BY_EXT.get(ext) ?? 'image/png';
      }
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch (e) {
      console.error('[net:fetchImage] error:', (e instanceof Error && e.message) || e);
      return null;
    } finally {
      limit.clear();
    }
  });
};
