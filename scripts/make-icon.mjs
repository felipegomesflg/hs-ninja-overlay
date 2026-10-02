import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'electron', 'assets')
const buildDir = path.join(root, 'build')
const sizes = [16, 24, 32, 48, 64, 128, 256]

const pngs = sizes.map((s) => path.join(assets, `icon-${s}.png`)).filter((p) => fs.existsSync(p))
if (pngs.length === 0) {
  console.error('Gere antes os PNG icon-16..256 em electron/assets/')
  process.exit(1)
}

fs.mkdirSync(buildDir, { recursive: true })
const buf = await pngToIco(pngs)
fs.writeFileSync(path.join(assets, 'icon.ico'), buf)
fs.writeFileSync(path.join(buildDir, 'icon.ico'), buf)
console.log(`ok: icon.ico (${buf.length} bytes)`)
