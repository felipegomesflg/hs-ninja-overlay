const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hsOverlay', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  pickWatchFile: () => ipcRenderer.invoke('settings:pick-watch-file'),
  readZoneNow: () => ipcRenderer.invoke('satanic-zone:read-now'),
  refreshLive: () => ipcRenderer.invoke('satanic-zone:refresh'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  quit: () => ipcRenderer.invoke('window:quit'),
  openPath: (target) => ipcRenderer.invoke('shell:open-path', target),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  checkNpcap: () => ipcRenderer.invoke('npcap:check'),
  promptNpcapInstall: () => ipcRenderer.invoke('npcap:prompt-install'),
  setMouseIgnore: (ignore) => ipcRenderer.invoke('overlay:set-mouse-ignore', Boolean(ignore)),
  setFocusable: (focusable) => ipcRenderer.invoke('overlay:set-focusable', Boolean(focusable)),
  focusWindow: () => ipcRenderer.invoke('overlay:focus-window'),
  /** Síncrono — chamar no mousedown do input */
  stealFocusSync: () => ipcRenderer.sendSync('overlay:steal-focus-sync'),
  onZoneUpdate: (cb) => {
    const handler = (_event, data) => cb(data)
    ipcRenderer.on('satanic-zone:update', handler)
    return () => ipcRenderer.removeListener('satanic-zone:update', handler)
  },
  onSettingsUpdate: (cb) => {
    const handler = (_event, data) => cb(data)
    ipcRenderer.on('settings:update', handler)
    return () => ipcRenderer.removeListener('settings:update', handler)
  },
})
