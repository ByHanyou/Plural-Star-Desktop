import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import path from 'node:path';

const __dirname = import.meta.dirname;

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:5173';

const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.png');

export const fromMainWindow = (e: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (e.sender !== mainWindow.webContents) return false;
  const frame = (e as Electron.IpcMainInvokeEvent).senderFrame;
  return !frame || frame === mainWindow.webContents.mainFrame;
};

export const showMainWindow = (): void => {
  if (!app.isReady()) return;
  if (!mainWindow || mainWindow.isDestroyed()) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

export function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    title: 'Plural Star',
    icon: ICON_PATH,
    backgroundColor: '#0A1F2E',
    titleBarStyle: 'hiddenInset',
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const externalOk = (url: string): boolean => /^(https?:|mailto:)/i.test(url);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (externalOk(url)) shell.openExternal(url).catch(e => console.error('[openExternal] error:', e));
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const own = isDev ? url.startsWith(DEV_URL) : url.startsWith('file:');
    if (own) return;
    event.preventDefault();
    if (externalOk(url)) shell.openExternal(url).catch(e => console.error('[openExternal] error:', e));
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('page-title-updated', e => e.preventDefault());

  mainWindow.webContents.on('context-menu', (_e, params) => {
    Menu.buildFromTemplate([
      { role: 'cut', visible: params.isEditable },
      { role: 'copy' },
      { role: 'paste', visible: params.isEditable },
      { role: 'selectAll', visible: params.isEditable },
    ]).popup();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

export const registerWindowIpc = (): void => {
  ipcMain.on('window:minimize', e => { if (fromMainWindow(e)) mainWindow?.minimize(); });
  ipcMain.on('window:maximize', e => {
    if (!fromMainWindow(e)) return;
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', e => { if (fromMainWindow(e)) mainWindow?.close(); });
};
