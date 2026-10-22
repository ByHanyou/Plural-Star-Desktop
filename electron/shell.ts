import { app, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { fromMainWindow, showMainWindow } from './window.js';

const __dirname = import.meta.dirname;

const TRAY_ICON_PATH = path.join(__dirname, '..', 'build', 'tray.png');

let tray: Tray | null = null;

export const shellLabels = {
  trayOpen: 'Open Plural Star',
  trayQuit: 'Quit',
  menuEdit: 'Edit',
  jsonFiles: 'JSON Files',
  textFiles: 'Text Files',
  allFiles: 'All Files',
  backup: 'Backup',
};
type ShellLabelKey = keyof typeof shellLabels;

export function createTray(): void {
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
  buildTrayMenu();
  tray.on('click', showMainWindow);
}

function buildTrayMenu(): void {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    { label: shellLabels.trayOpen, click: showMainWindow },
    { type: 'separator' },
    { label: shellLabels.trayQuit, click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);
}

export function createAppMenu(): void {
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
      label: shellLabels.menuEdit,
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

export const registerShellIpc = (): void => {
  ipcMain.on('shell:setLabels', (e, labels: unknown) => {
    if (!fromMainWindow(e) || !labels || typeof labels !== 'object') return;
    for (const key of Object.keys(shellLabels) as ShellLabelKey[]) {
      const v: unknown = Reflect.get(labels, key);
      if (typeof v === 'string' && v.trim() && v.length <= 200) shellLabels[key] = v;
    }
    buildTrayMenu();
    createAppMenu();
  });
};
