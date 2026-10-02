# HS Ninja Overlay

Overlay Electron + React para **Hero Siege** (marca [HeroS.ninja](https://heros.ninja)): Satanic Zone, target drops, busca e histórico de loot via captura Npcap.

## Download (.exe)

Última release: **https://github.com/felipegomesflg/hs-ninja-overlay/releases/latest**

Arquivos típicos:

| Arquivo | Uso |
| --- | --- |
| [`HS-Ninja-Overlay-*-portable.exe`](https://github.com/felipegomesflg/hs-ninja-overlay/releases/latest) | Roda sem instalar |
| [`HS-Ninja-Overlay-Setup-*.exe`](https://github.com/felipegomesflg/hs-ninja-overlay/releases/latest) | Instalador (atalho + bandeja) |

## Requisitos

- **Windows 10/11 x64**
- **[Npcap](https://npcap.com/)** instalado — obrigatório para captura ao vivo (sala, MF, drops)

Sem o Npcap, a overlay abre, mas a captura de rede não funciona. Na barra da Satanic Zone aparece um **⚠**; ao clicar, pergunta se deseja abrir https://npcap.com/ para baixar.

Na instalação do Npcap, marque a opção de compatibilidade com a API WinPcap se disponível.

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
git tag v0.1.1
git push origin v0.1.1
```

O workflow `.github/workflows/release.yml` builda no Windows e publica os artefatos na Release.

## Estrutura irmã (dev)

```
hero-siege/
  hs-map/
  hs-tracker/
  hs-ninja-overlay/
```
