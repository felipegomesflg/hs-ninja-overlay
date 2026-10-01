import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const crate = path.join(root, 'native', 'hs-capture')
const exe = path.join(crate, 'target', 'release', 'hs-capture.exe')

if (fs.existsSync(exe)) {
  console.log(`hs-capture already built: ${exe}`)
  process.exit(0)
}

const isWin = process.platform === 'win32'
const cargo = isWin ? 'cargo.exe' : 'cargo'
const vcvars = String.raw`C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat`

let result
if (isWin && fs.existsSync(vcvars)) {
  result = spawnSync(
    'cmd.exe',
    ['/c', `"${vcvars}" && cd /d "${crate}" && cargo build --release`],
    { stdio: 'inherit', shell: false },
  )
} else {
  result = spawnSync(cargo, ['build', '--release'], { cwd: crate, stdio: 'inherit', shell: isWin })
}

if (result.status !== 0) {
  console.error('Falhou build do hs-capture. Precisa de Rust + VS Build Tools (C++).')
  process.exit(result.status || 1)
}
console.log(`ok: ${exe}`)
