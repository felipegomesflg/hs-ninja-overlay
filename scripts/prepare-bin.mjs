import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const exeSrc = path.join(root, 'native', 'hs-capture', 'target', 'release', 'hs-capture.exe')
const binDir = path.join(root, 'bin')
const exeDst = path.join(binDir, 'hs-capture.exe')

const build = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-capture.mjs'), '--force'], {
  stdio: 'inherit',
  env: { ...process.env, HS_FORCE_CAPTURE_BUILD: '1' },
})
if (build.status !== 0) process.exit(build.status || 1)

if (!fs.existsSync(exeSrc)) {
  console.error(`hs-capture.exe não encontrado em ${exeSrc}`)
  process.exit(1)
}

fs.mkdirSync(binDir, { recursive: true })
fs.copyFileSync(exeSrc, exeDst)
console.log(`bin ready: ${exeDst}`)
