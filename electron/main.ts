import { app, BrowserWindow, Notification } from 'electron';
import { handle } from './ipc.js';
import { createWindow, registerWindowIpc, showMainWindow } from './window.js';
import { createAppMenu, createTray, registerShellIpc } from './shell.js';
import { registerStoreIpc } from './storeIpc.js';
import { registerFileIpc } from './fileIpc.js';
import { registerNetIpc } from './netIpc.js';

app.setName('Plural Star');

registerStoreIpc();

const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();

app.on('second-instance', showMainWindow);

handle('app:version', () => app.getVersion());

registerFileIpc();

registerNetIpc();

handle('notify', (_e, title: string, body: string) => {
  new Notification({ title, body }).show();
});

registerWindowIpc();
registerShellIpc();

app.whenReady().then(() => {
  if (!hasInstanceLock) return;
  createAppMenu();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
