import { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';

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
      preload: path.join(__dirname, 'preload.js'),
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
    return null;
  }
});

ipcMain.handle('store:set', (_e, key: string, value: unknown) => {
  try {
    store.set(key, value);
  } catch (e: any) {
    if (e?.code === 'EXDEV') {
      try {
        const filePath = (store as any).path;
        const current = fs.existsSync(filePath)
          ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
          : {};
        current[key] = value;
        fs.writeFileSync(filePath, JSON.stringify(current, null, '\t'));
      } catch (fallbackErr) {
        console.error('[store:set] fallback write failed:', fallbackErr);
        throw fallbackErr;
      }
    } else {
      console.error('[store:set] error:', e);
      throw e;
    }
  }
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
      { name: 'JSON Files', extensions: ['json'] },
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
