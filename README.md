# HS Ninja Overlay

Overlay React + Electron para **Hero Siege**: acompanha a Satanic Zone lendo um `.txt` de atualização, mostra buffs/debuffs com tooltip e abre os drops target da área.

## Estrutura irmã

```
hero-siege/
  hs-map/              # drops por área (fonte)
  hs-tracker/          # ícones e tabela de mods (fonte)
  hs-ninja-overlay/    # este app
```

## Desenvolvimento

```bash
npm install
npm run build:data   # regenera src/data a partir de hs-map / tabelas
npm run dev          # Vite + Electron
```

## Arquivo observado

Por padrão usa `public/sample/satanic-zone.txt`. No app, clique em **.txt** para escolher outro caminho.

Formatos aceitos:

```json
{ "zone": "SZ_5_5", "buffs": [3, 14, 10], "debuffs": [2, 17, 15] }
```

ou

```
SZ_5_5
buffs: 3,14,10
debuffs: 2|17|15
```

## UI atual

- Barra superior com ícones de mods (hover = nome + descrição)
- Seta à direita abre drops target da área atual
- Botão **Buscar** pesquisa itens com/sem área (dados do `hs-map`)
