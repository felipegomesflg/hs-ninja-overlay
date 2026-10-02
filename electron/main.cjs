const { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen, Tray, nativeImage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { startLiveCapture, stopLiveCapture, captureStatus, onCaptureLive } = require('./capture-bridge.cjs')
const { watchSatanicFile, parseSatanicText } = require('./watcher.cjs')

app.setName('hs-ninja-overlay')
// Sem isso o Windows agrupa/mostra o ícone do processo pai (ex.: Cursor).
if (process.platform === 'win32') {
  app.setAppUserModelId('ninja.heros.overlay')
}

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {{ close: () => void } | null} */
let watcher = null
/** @type {Tray | null} */
let tray = null
/** Só true quando o usuário escolhe Sair na bandeja */
let isQuitting = false

function readZonePayload() {
  const { watchPath } = loadSettings()
  try {
    if (!fs.existsSync(watchPath)) {
      return {
        ok: false,
        error: 'Arquivo não encontrado',
        path: watchPath,
        zone: null,
        area: null,
        buffs: [],
        debuffs: [],
        mf: null,
        drops: [],
      }
    }
    const text = fs.readFileSync(watchPath, 'utf8')
    return { ok: true, path: watchPath, ...parseSatanicText(text) }
  } catch (err) {
    return {
      ok: false,
      error: String(err?.message || err),
      path: watchPath,
      zone: null,
      area: null,
      buffs: [],
      debuffs: [],
      mf: null,
      drops: [],
    }
  }
}

function defaultSettings() {
  const livePath = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'hs-live', 'satanic-zone.json')
  return {
    watchPath: livePath,
    clickThrough: true,
    alwaysOnTop: true,
  }
}

function loadSettings() {
  const defaults = defaultSettings()
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const saved = { ...defaults, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) }
      if (String(saved.watchPath || '').includes(`${path.sep}sample${path.sep}satanic-zone`)) {
        saved.watchPath = defaults.watchPath
        saveSettings(saved)
      }
      return saved
    }
  } catch {
    // ignore corrupt settings
  }
  return defaults
}

function saveSettings(next) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2))
}

/** @type {number} */
let lastLiveMs = 0

function liveStamp(payload) {
  const raw = payload?.updatedAt
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function sendZone(payload, { force = false } = {}) {
  const stamp = liveStamp(payload)
  if (!force && stamp > 0 && stamp < lastLiveMs) {
    return
  }
  if (stamp > lastLiveMs) lastLiveMs = stamp
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('satanic-zone:update', payload)
  }
}

function pushLiveFromCapture(raw) {
  const parsed = parseSatanicText(JSON.stringify(raw))
  const { watchPath } = loadSettings()
  sendZone(
    {
      ok: true,
      path: watchPath,
      source: 'capture-stdout',
      ...parsed,
      updatedAt: raw?.updatedAt ?? parsed.updatedAt ?? Date.now(),
    },
    { force: true },
  )
}

function startWatcher(filePath) {
  if (watcher) {
    watcher.close()
    watcher = null
  }

  watcher = watchSatanicFile(filePath, {
    // Fallback: disco. Se o stdout já empurrar algo mais novo, sendZone ignora.
    onUpdate: (data) => sendZone({ ok: true, path: filePath, source: 'file', ...data }),
    onMissing: () =>
      sendZone(
        {
          ok: false,
          error: 'Arquivo não encontrado',
          path: filePath,
          zone: null,
          area: null,
          buffs: [],
          debuffs: [],
          mf: null,
          drops: [],
        },
        { force: true },
      ),
    onError: (err) =>
      sendZone(
        {
          ok: false,
          error: String(err?.message || err),
          path: filePath,
          zone: null,
          area: null,
          buffs: [],
          debuffs: [],
          mf: null,
          drops: [],
        },
        { force: true },
      ),
  })
}

function showOverlay() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  const display = screen.getPrimaryDisplay()
  mainWindow.setBounds(display.bounds)
  mainWindow.show()
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
}

function hideOverlay() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide()
  }
}

function quitApp() {
  isQuitting = true
  if (watcher) {
    watcher.close()
    watcher = null
  }
  stopLiveCapture()
  if (tray) {
    tray.destroy()
    tray = null
  }
  app.quit()
}

function resolveAsset(...parts) {
  const inAsar = path.join(__dirname, 'assets', ...parts)
  const unpacked = inAsar.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
  if (unpacked !== inAsar && fs.existsSync(unpacked)) return unpacked
  return inAsar
}

function resolveTrayIcon() {
  const candidates = [
    resolveAsset('icon.ico'),
    resolveAsset('tray-32.png'),
    resolveAsset('tray.png'),
    resolveAsset('tray-16.png'),
    resolveAsset('logo.png'),
    resolveAsset('favicon.ico'),
  ]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    let icon = nativeImage.createFromPath(file)
    if (icon.isEmpty()) continue
    // Bandeja Windows: 16px nítido
    if (process.platform === 'win32') {
      const size = icon.getSize()
      if (size.width !== 16 || size.height !== 16) {
        icon = icon.resize({ width: 16, height: 16, quality: 'best' })
      }
    }
    return icon
  }
  // Fallback HeroS mínimo (não ícone do Electron/Cursor)
  return nativeImage.createFromPath(resolveAsset('logo.png'))
}

function resolveAppIconPath() {
  return [
    resolveAsset('icon.ico'),
    resolveAsset('logo.png'),
    resolveAsset('favicon.ico'),
  ].find((p) => fs.existsSync(p))
}

function createTray() {
  if (tray) return

  const icon = resolveTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('HeroS.ninja Overlay')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Mostrar overlay',
        click: () => showOverlay(),
      },
      {
        label: 'Ocultar overlay',
        click: () => hideOverlay(),
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => quitApp(),
      },
    ]),
  )
  tray.on('double-click', () => showOverlay())
  tray.on('click', () => {
    // no Windows o clique esquerdo abre o menu no botão direito;
    // clique simples alterna mostrar/ocultar
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) {
      showOverlay()
    } else {
      hideOverlay()
    }
  })
}

function createWindow() {
  const settings = loadSettings()
  const display = screen.getPrimaryDisplay()
  const { x, y, width, height } = display.bounds

  Menu.setApplicationMenu(null)

  const appIconPath = resolveAppIconPath()

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    title: '',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: settings.alwaysOnTop,
    resizable: false,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    autoHideMenuBar: true,
    // Vive na bandeja; some da barra de tarefas
    skipTaskbar: true,
    hasShadow: false,
    thickFrame: false,
    roundedCorners: false,
    focusable: true,
    show: false,
    icon: appIconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.setMenu(null)
  mainWindow.setMenuBarVisibility(false)
  mainWindow.removeMenu()
  mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.setBounds({ x, y, width, height })
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    mainWindow?.setTitle('')
  })
  mainWindow.on('focus', () => scheduleChromeFix())
  mainWindow.on('show', () => scheduleChromeFix())

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.setBounds({ x, y, width, height })
    mainWindow?.show()
    scheduleChromeFix()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    const current = loadSettings()
    mainWindow?.setTitle('')
    mainWindow?.webContents.send('settings:update', current)
    startWatcher(current.watchPath)
  })

  // Fechar (X / ipc) = ocultar para a bandeja, não encerrar
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      hideOverlay()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  onCaptureLive(pushLiveFromCapture)
  startLiveCapture()
  createTray()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else showOverlay()
  })
})

// Com bandeja, não sair só porque a janela sumiu
app.on('window-all-closed', (event) => {
  if (process.platform === 'darwin') return
  if (!isQuitting) {
    event.preventDefault?.()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  stopLiveCapture()
})

ipcMain.handle('capture:status', () => captureStatus())

ipcMain.handle('satanic-zone:read-now', () => readZonePayload())

ipcMain.handle('satanic-zone:refresh', () => {
  // Soft refresh: NÃO reinicia o capture (isso apagava SZ/sala no seed).
  // Só garante que o sidecar está vivo e relê o live file.
  const running = captureStatus()
  const status = running.running ? running : startLiveCapture()
  const payload = readZonePayload()
  sendZone(payload)
  return { ...payload, capture: status }
})

ipcMain.handle('settings:get', () => loadSettings())

ipcMain.handle('settings:set', (_event, patch) => {
  const next = { ...loadSettings(), ...patch }
  saveSettings(next)

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(Boolean(next.alwaysOnTop), 'screen-saver')
    mainWindow.webContents.send('settings:update', next)
  }

  if (patch.watchPath) startWatcher(next.watchPath)
  return next
})

ipcMain.handle('settings:pick-watch-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar arquivo de atualização da Satanic Zone',
    properties: ['openFile'],
    filters: [
      { name: 'Texto / JSON', extensions: ['txt', 'json'] },
      { name: 'Todos', extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const watchPath = result.filePaths[0]
  const next = { ...loadSettings(), watchPath }
  saveSettings(next)
  startWatcher(watchPath)
  mainWindow?.webContents.send('settings:update', next)
  return next
})

ipcMain.handle('overlay:set-mouse-ignore', (_event, ignore) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (ignore) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
  } else {
    mainWindow.setIgnoreMouseEvents(false)
    // Clique em widget foca a janela — Windows pode redesenhar a title bar
    scheduleChromeFix()
  }
})

let captionStripTimer = null

function enforceFramelessChrome() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    mainWindow.setTitle('')
    mainWindow.setMenuBarVisibility(false)
    mainWindow.setAutoHideMenuBar(true)
    mainWindow.setHasShadow(false)
    mainWindow.setSkipTaskbar(true)
    const settings = loadSettings()
    if (settings.alwaysOnTop) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
    }
  } catch {
    /* ignore */
  }
}

/** Remove WS_CAPTION/WS_THICKFRAME via user32 (debounce — foco pode repor a barra). */
function stripWin32Caption() {
  if (process.platform !== 'win32' || !mainWindow || mainWindow.isDestroyed()) return
  if (captionStripTimer) return
  captionStripTimer = setTimeout(() => {
    captionStripTimer = null
    try {
      const hwndBuf = mainWindow.getNativeWindowHandle()
      if (!hwndBuf || hwndBuf.length < 4) return
      const hwnd =
        hwndBuf.length >= 8 ? hwndBuf.readBigUInt64LE(0) : BigInt(hwndBuf.readUInt32LE(0))
      if (hwnd === 0n) return
      const hwndStr = hwnd.toString()

      const ps = `
if (-not ("HsOverlayWin" -as [type])) {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public class HsOverlayWin {
  [DllImport("user32.dll")] public static extern IntPtr GetWindowLongPtr(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern IntPtr SetWindowLongPtr(IntPtr h, int n, IntPtr v);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr i, int x, int y, int cx, int cy, uint f);
}
"@
}
$h = [IntPtr]${hwndStr}
$GWL_STYLE = -16
$WS_CAPTION = 0x00C00000
$WS_THICKFRAME = 0x00040000
$WS_SYSMENU = 0x00080000
$style = [HsOverlayWin]::GetWindowLongPtr($h, $GWL_STYLE).ToInt64()
$style = $style -band (-bnot ($WS_CAPTION -bor $WS_THICKFRAME -bor $WS_SYSMENU))
[void][HsOverlayWin]::SetWindowLongPtr($h, $GWL_STYLE, [IntPtr]$style)
[void][HsOverlayWin]::SetWindowPos($h, [IntPtr]::Zero, 0, 0, 0, 0, 0x0027)
`
      const { execFile } = require('node:child_process')
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', ps],
        { windowsHide: true, timeout: 2500 },
        () => enforceFramelessChrome(),
      )
    } catch {
      /* ignore */
    }
  }, 40)
}

function scheduleChromeFix() {
  enforceFramelessChrome()
  setTimeout(enforceFramelessChrome, 0)
  setTimeout(enforceFramelessChrome, 40)
  stripWin32Caption()
}

function stealFocus() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  // Não chama setFocusable(true) de novo: no Windows isso redesenha a title bar.
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  if (!mainWindow.isFocused()) mainWindow.focus()
  mainWindow.webContents.focus()
  scheduleChromeFix()
}

ipcMain.on('overlay:steal-focus-sync', (event) => {
  stealFocus()
  event.returnValue = true
})

ipcMain.handle('overlay:set-focusable', (_event, focusable) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (focusable) stealFocus()
})

ipcMain.handle('overlay:focus-window', () => {
  stealFocus()
})

ipcMain.handle('window:minimize', () => hideOverlay())
ipcMain.handle('window:close', () => hideOverlay())
ipcMain.handle('window:quit', () => quitApp())
ipcMain.handle('shell:open-path', (_event, target) => shell.showItemInFolder(target))

const NPCAP_URL = 'https://npcap.com/'

function isNpcapInstalled() {
  if (process.platform !== 'win32') return true
  const root = process.env.SystemRoot || 'C:\\Windows'
  const candidates = [
    path.join(root, 'System32', 'Npcap', 'wpcap.dll'),
    path.join(root, 'System32', 'wpcap.dll'),
    path.join(root, 'SysWOW64', 'npcap', 'wpcap.dll'),
    path.join(root, 'SysWOW64', 'wpcap.dll'),
  ]
  return candidates.some((p) => fs.existsSync(p))
}

ipcMain.handle('npcap:check', () => ({
  installed: isNpcapInstalled(),
  url: NPCAP_URL,
}))

ipcMain.handle('shell:open-external', async (_event, url) => {
  const target = String(url || '').trim()
  if (!/^https?:\/\//i.test(target)) return { ok: false, error: 'URL inválida' }
  await shell.openExternal(target)
  return { ok: true }
})

ipcMain.handle('npcap:prompt-install', async () => {
  if (isNpcapInstalled()) {
    return { installed: true, opened: false }
  }
  const result = await dialog.showMessageBox(mainWindow ?? undefined, {
    type: 'warning',
    buttons: ['Abrir npcap.com', 'Agora não'],
    defaultId: 0,
    cancelId: 1,
    title: 'Npcap necessário',
    message: 'Npcap não encontrado',
    detail:
      'A captura ao vivo (sala, MF, drops) precisa do Npcap instalado.\n\nDeseja abrir https://npcap.com/ para baixar?',
    noLink: true,
  })
  if (result.response === 0) {
    await shell.openExternal(NPCAP_URL)
    return { installed: false, opened: true }
  }
  return { installed: false, opened: false }
})
