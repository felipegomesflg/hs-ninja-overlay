# HS Ninja Overlay

Overlay Electron + React para **Hero Siege** (marca [HeroS.ninja](https://heros.ninja)): Satanic Zone, target drops, busca e histórico de loot via captura Npcap.

## Requisitos (usuário final)

- Windows 10/11 x64
- [Npcap](https://npcap.com/) instalado (modo WinPcap API compatível)

## Download

Veja a [página de Releases](https://github.com/felipegomesflg/hs-ninja-overlay/releases):

- **`HS-Ninja-Overlay-*-portable.exe`** — roda sem instalar
- **`HS-Ninja-Overlay-Setup-*.exe`** — instalador (atalho + bandeja)

## Desenvolvimento

```bash
npm install
npm run build:data   # opcional se hs-map / hs-tracker estiverem ao lado
npm run build:capture
npm run dev
```

Pack local (gera `.exe` em `release/`):

```bash
npm run dist
```

## Release no GitHub

```bash
git tag v0.1.0
git push origin v0.1.0
```

O workflow `.github/workflows/release.yml` builda no Windows e publica os artefatos na Release.

## Estrutura irmã (dev)

```
hero-siege/
  hs-map/
  hs-tracker/
  hs-ninja-overlay/
```
