import { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import Store from 'electron-store';

const __dirname = import.meta.dirname;

app.setName('Plural Star');

const userDataPath = app.getPath('userData');
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

const store = new Store({ name: 'plural-space-data', cwd: userDataPath });
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = !app.isPackaged;

const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.png');
const TRAY_ICON_PATH = path.join(__dirname, '..', 'build', 'tray.png');

const STORE_FILE = (store as any).path as string;

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
    } catch (e: any) {
      if (e?.code === 'EXDEV') {
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

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    title: 'Plural Star',
    icon: ICON_PATH,
    backgroundColor: '#0A1F2E',
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin' ? false : true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('store:get', (_e, key: string) => {
  try {
    return store.get(key, null);
  } catch (e) {
    console.error('[store:get] error:', e);
    throw e;
  }
});

ipcMain.handle('store:getStrict', (_e, key: string) => {
  return store.get(key, null);
});

ipcMain.handle('store:set', (_e, key: string, value: unknown) => {
  try {
    store.set(key, value);
  } catch (e) {
    console.error('[store:set] error:', e);
    throw e;
  }
});

ipcMain.handle('store:setBatch', (_e, updates: Record<string, unknown>) => {
  if (!updates || typeof updates !== 'object') {
    throw new TypeError('setBatch expects an object of {key: value} updates');
  }
  let current: Record<string, unknown>;
  try {
    current = readJsonOrThrow(STORE_FILE);
  } catch (e: any) {
    console.error('[store:setBatch] read failed, refusing to write:', e);
    throw new Error(`Cannot batch-update: store file unreadable (${e.message}). Refusing to overwrite to prevent data loss.`);
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

ipcMain.handle('store:remove', (_e, key: string) => {
  try {
    store.delete(key);
  } catch (e) {
    console.error('[store:remove] error:', e);
    throw e;
  }
});

ipcMain.handle('store:clearAll', () => {
  try {
    const all = store.store;
    for (const key of Object.keys(all)) {
      if (key.startsWith('ps:')) store.delete(key);
    }
  } catch (e) {
    console.error('[store:clearAll] error:', e);
    throw e;
  }
});

ipcMain.handle('store:allKeys', () => {
  try {
    return Object.keys(store.store);
  } catch (e) {
    console.error('[store:allKeys] error:', e);
    return [];
  }
});

ipcMain.handle('dialog:openFile', async (_e, filters?: Electron.FileFilter[]) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: filters || [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_e, defaultName: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [
      { name: 'Backup', extensions: ['zip'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('file:readAsBase64', async (_e, filePath: string) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    };
    const mime = mimeMap[ext] || 'application/octet-stream';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.error('[file:readAsBase64] error:', e);
    return null;
  }
});

ipcMain.handle('file:write', async (_e, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (e) {
    console.error('[file:write] error:', e);
    throw e;
  }
});

ipcMain.handle('file:writeBytes', async (_e, filePath: string, base64: string) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  } catch (e) {
    console.error('[file:writeBytes] error:', e);
    throw e;
  }
});

ipcMain.handle('net:fetch', async (_e, url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) => {
  try {
    const res = await fetch(url, {
      method: options?.method || 'GET',
      headers: options?.headers || {},
      body: options?.body,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e: any) {
    return { ok: false, status: 0, text: e.message };
  }
});

// Fetch a remote image in the main process (no renderer CSP restriction) and return it
// as a self-contained base64 data URI, so imported avatars work like the mobile app
// (downloaded + inlined) instead of depending on a live remote URL.
ipcMain.handle('net:fetchImage', async (_e, url: string) => {
  try {
    if (!/^https?:\/\//i.test(String(url || ''))) return null;
    const res = await fetch(url, { headers: { 'User-Agent': 'PluralStar-Desktop' } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 12 * 1024 * 1024) return null;
    const extMime: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    };
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    let mime = ct.startsWith('image/') ? ct : '';
    if (!mime) {
      const ext = path.extname(String(url).split('?')[0]).toLowerCase().replace('.', '');
      mime = extMime[ext] || 'image/png';
    }
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (e: any) {
    console.error('[net:fetchImage] error:', e?.message || e);
    return null;
  }
});

ipcMain.handle('notify', (_e, title: string, body: string) => {
  new Notification({ title, body }).show();
});

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

function createTray(): void {
  let trayImage = nativeImage.createFromPath(TRAY_ICON_PATH);
  if (trayImage.isEmpty()) {
    trayImage = nativeImage.createEmpty();
  } else {
    trayImage = trayImage.resize({ width: 22, height: 22 });
    if (process.platform === 'darwin') {
      trayImage.setTemplateImage(true);
    }
  }
  tray = new Tray(trayImage);
  tray.setToolTip('Plural Star');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Plural Star', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

function createAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  createAppMenu();
  createWindow();
  createTray();

  if (mainWindow) {
    mainWindow.webContents.on('context-menu', (_e, params) => {
      const menu = Menu.buildFromTemplate([
        { role: 'cut', visible: params.isEditable },
        { role: 'copy' },
        { role: 'paste', visible: params.isEditable },
        { role: 'selectAll', visible: params.isEditable },
      ]);
      menu.popup();
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
