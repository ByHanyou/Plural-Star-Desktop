import { ipcMain } from 'electron';
import { fromMainWindow } from './window.js';

export const handle = <A extends unknown[]>(channel: string, fn: (e: Electron.IpcMainInvokeEvent, ...args: A) => unknown): void => {
  ipcMain.handle(channel, (e, ...args) => {
    if (!fromMainWindow(e)) throw new Error(`ipc ${channel}: unauthorized sender`);
    return fn(e, ...(args as A));
  });
};

export const handleLogged = <A extends unknown[]>(channel: string, fn: (...args: A) => unknown): void => {
  handle<A>(channel, (_e, ...args) => {
    try {
      return fn(...args);
    } catch (e) {
      console.error(`[${channel}] error:`, e);
      throw e;
    }
  });
};
