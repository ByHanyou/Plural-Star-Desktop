import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    getStrict: (key: string) => ipcRenderer.invoke('store:getStrict', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    setBatch: (updates: Record<string, unknown>) => ipcRenderer.invoke('store:setBatch', updates),
    remove: (key: string) => ipcRenderer.invoke('store:remove', key),
    clearAll: () => ipcRenderer.invoke('store:clearAll'),
    allKeys: () => ipcRenderer.invoke('store:allKeys'),
  },

  dialog: {
    openFile: (filters?: any[]) => ipcRenderer.invoke('dialog:openFile', filters),
    saveFile: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  },

  file: {
    readAsBase64: (filePath: string) => ipcRenderer.invoke('file:readAsBase64', filePath),
    write: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
  },

  net: {
    fetch: (url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) =>
      ipcRenderer.invoke('net:fetch', url, options),
  },

  notify: (title: string, body: string) => ipcRenderer.invoke('notify', title, body),

  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },

  platform: process.platform,
});
