import { dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { handle, handleLogged } from './ipc.js';
import { shellLabels } from './shell.js';

export const IMAGE_MIME_BY_EXT = new Map([
  ['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'],
  ['gif', 'image/gif'], ['webp', 'image/webp'], ['svg', 'image/svg+xml'],
]);

const sanitizeFilters = (raw: unknown): Electron.FileFilter[] | null => {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .filter(f => f && typeof f.name === 'string' && Array.isArray(f.extensions))
    .map(f => ({ name: String(f.name).slice(0, 200), extensions: f.extensions.filter((x: unknown) => typeof x === 'string').map((x: string) => x.slice(0, 20)) }));
  return out.length ? out : null;
};

export const registerFileIpc = (): void => {
  handle('dialog:openFile', async (_e, filters?: Electron.FileFilter[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: sanitizeFilters(filters) || [
        { name: shellLabels.jsonFiles, extensions: ['json'] },
        { name: shellLabels.textFiles, extensions: ['txt'] },
        { name: shellLabels.allFiles, extensions: ['*'] },
      ],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  handle('dialog:saveFile', async (_e, defaultName: string, filters?: Electron.FileFilter[]) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: sanitizeFilters(filters) || [
        { name: shellLabels.backup, extensions: ['zip'] },
        { name: shellLabels.jsonFiles, extensions: ['json'] },
        { name: shellLabels.allFiles, extensions: ['*'] },
      ],
    });
    return result.canceled ? null : result.filePath;
  });

  handle('file:readAsBase64', async (_e, filePath: string) => {
    try {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      const mime = IMAGE_MIME_BY_EXT.get(ext) ?? 'application/octet-stream';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (e) {
      console.error('[file:readAsBase64] error:', e);
      return null;
    }
  });

  handleLogged('file:write', (filePath: string, content: string) => {
    fs.writeFileSync(filePath, content, 'utf8');
  });

  handleLogged('file:writeBytes', (filePath: string, base64: string) => {
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  });
};
