const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

/** @type {import('node:child_process').ChildProcess | null} */
let child = null
/** @type {ReturnType<typeof setInterval> | null} */
let keepAlive = null
let lastError = null
/** @type {((data: object) => void) | null} */
let liveHandler = null
let stdoutBuf = ''

function captureBinaryCandidates() {
  const root = path.join(__dirname, '..')
  const list = []
  // Empacotado (electron-builder extraResources)
  if (process.resourcesPath) {
    list.push(
      path.join(process.resourcesPath, 'bin', 'hs-capture.exe'),
      path.join(process.resourcesPath, 'hs-capture.exe'),
    )
  }
  // Ao lado do .exe (portable)
  try {
    const exeDir = path.dirname(process.execPath)
    list.push(
      path.join(exeDir, 'resources', 'bin', 'hs-capture.exe'),
      path.join(exeDir, 'hs-capture.exe'),
    )
  } catch {
    /* ignore */
  }
  // Dev
  list.push(
    path.join(root, 'bin', 'hs-capture.exe'),
    path.join(root, 'native', 'hs-capture', 'target', 'release', 'hs-capture.exe'),
    path.join(root, 'native', 'hs-capture', 'target', 'debug', 'hs-capture.exe'),
  )
  return list
}

function resolveCaptureBinary() {
  return captureBinaryCandidates().find((p) => fs.existsSync(p)) || null
}

/**
 * @param {(data: object) => void} handler
 */
function onCaptureLive(handler) {
  liveHandler = typeof handler === 'function' ? handler : null
}

function consumeStdout(chunk) {
  stdoutBuf += String(chunk)
  let nl
  while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
    const line = stdoutBuf.slice(0, nl).replace(/\r$/, '').trim()
    stdoutBuf = stdoutBuf.slice(nl + 1)
    if (!line.startsWith('HSLIVE ')) continue
    try {
      const data = JSON.parse(line.slice(7))
      liveHandler?.(data)
    } catch (err) {
      console.warn('[hs-overlay] bad HSLIVE line:', err?.message || err)
    }
  }
}

function spawnOnce() {
  const bin = resolveCaptureBinary()
  if (!bin) {
    lastError = 'hs-capture.exe missing — npm run build:capture'
    console.warn(`[hs-overlay] ${lastError}`)
    return false
  }
  if (child && !child.killed && child.exitCode == null) return true

  try {
    child = spawn(bin, [], {
      cwd: path.dirname(bin),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        // Garante wpcap.dll (Npcap) no PATH do filho
        PATH: `C:\\Windows\\System32\\Npcap;C:\\Windows\\System32;${process.env.PATH || ''}`,
      },
    })
  } catch (err) {
    lastError = String(err?.message || err)
    console.warn('[hs-overlay] spawn hs-capture failed:', lastError)
    child = null
    return false
  }

  lastError = null
  stdoutBuf = ''
  // stdout = hot path HSLIVE; stderr = logs
  child.stdout?.on('data', (buf) => consumeStdout(buf))
  child.stderr?.on('data', (buf) => process.stderr.write(String(buf)))
  child.on('error', (err) => {
    lastError = String(err?.message || err)
    console.warn('[hs-overlay] hs-capture error:', lastError)
    child = null
  })
  child.on('exit', (code, signal) => {
    console.warn(`[hs-overlay] hs-capture exited code=${code} signal=${signal}`)
    child = null
  })
  console.log(`[hs-overlay] hs-capture started pid=${child.pid}: ${bin}`)
  return true
}

/**
 * Starts the local Npcap capture sidecar and keeps it alive.
 * Live updates: stdout `HSLIVE {json}` + fallback file `%LOCALAPPDATA%\hs-live\satanic-zone.json`.
 */
function startLiveCapture() {
  // Não mata um capture já saudável — só garante keep-alive + spawn se morto
  if (!keepAlive) {
    spawnOnce()
    keepAlive = setInterval(() => {
      if (!child || child.killed || child.exitCode != null) {
        spawnOnce()
      }
    }, 3000)
  } else if (!child || child.killed || child.exitCode != null) {
    spawnOnce()
  }
  return captureStatus()
}

function forceRestartCapture() {
  stopLiveCapture()
  return startLiveCapture()
}

function stopLiveCapture() {
  if (keepAlive) {
    clearInterval(keepAlive)
    keepAlive = null
  }
  if (!child) return
  const proc = child
  child = null
  try {
    proc.kill()
  } catch {
    /* ignore */
  }
  // Windows: garante morte da árvore
  if (proc.pid && process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } catch {
      /* ignore */
    }
  }
}

function captureStatus() {
  return {
    running: Boolean(child && !child.killed && child.exitCode == null),
    pid: child?.pid || null,
    binary: resolveCaptureBinary(),
    error: lastError,
  }
}

module.exports = {
  startLiveCapture,
  stopLiveCapture,
  forceRestartCapture,
  captureStatus,
  resolveCaptureBinary,
  onCaptureLive,
}
