import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const mapPath = path.resolve(root, '../hs-map/public/data/map.json')
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'))

const ZONES = {
  1: ['Outskirts of Inoya', 'Fields of Battle', 'The Pumpkin Patch', 'Woodhill Plains', "King's Garden", 'Witching River'],
  2: ['Crystal Village', 'Chilling Lake', 'Arctic Tundra', 'Snowy Mountains', 'The Glacial Trail'],
  3: ['Corrupted Oasis', 'Dry Hills', "Mos'Arathim Desert", 'Pyramid Level 1', 'Pyramid Level 2', 'Curacan Hollow'],
  4: ['Old Mining Village', 'The Highland Mines', 'Corrupted Cave', 'The Nightmare', "The Devil's Breach"],
  5: ['Mt. Fuji', 'Misty Swamp', 'Fuji Coast', 'Sea of Karponia', 'Temple of Zamjo'],
  6: ['Highland Graveyard', 'The Cathedral', 'Prison Dungeon', 'Steam Train', 'The Depths of Hell'],
  7: ['Deep Space', 'Event Horizon', 'The Black Hole', 'Parallel Dimension', 'Subconscious Mind', 'Shattered Realm'],
  8: ['Forest of the Slain', 'Flooded Plains', 'Forgotten Caves', 'Camp of Souls', 'Helheim'],
  9: ['Abyss Jungle', 'Shipwreck Cove', 'Tormented Reef', 'Boreal Island', 'Volcanic Island', 'Abyss Realm'],
}

const BUFFS = {
  1: ['Loot Goblin I', '+1 Maximum Loot from Enemy Killed'],
  2: ['Loot Goblin II', '+2 Maximum Loot from Enemy Killed'],
  3: ['Rune Master', '15% + (2.5% per sub difficulty level) Increased Rune Drop Chance'],
  4: ['Gold Hunger', 'Gold from monster kills increased by 40% + (8.75% per sub difficulty level)'],
  5: ['Heroic Windfall', 'Heroic Item drop chances increased by 3% + (3% per sub difficulty level)'],
  6: ['Angelic Fortune', 'Angelic Item drop chances increased by 25% + (7.5% per sub difficulty level)'],
  7: ["Zephy's Grace", 'Movement Speed increased by 50%'],
  8: ['Fury of Tempest', 'Attack Speed increased by 60%'],
  9: ['Rapid Casting', 'Faster Cast Rate increased by 60%'],
  10: ['Onslaught', 'Attack Damage increased by 100%'],
  11: ['Nether Surge', 'Magic Skill Damage increased by 40%'],
  12: ['Relic Keepers', 'Ancient monsters have a 2% chance to drop a relic on death'],
  13: ["Goblin's Greed", 'Champion+ monsters have a 0.5% chance to summon a Treasure Goblin on death'],
  14: ['Artifact Digger', '+55% Magic Find + (5% per sub difficulty level)'],
  15: ['Artifact Seeker', '+110% Magic Find + (10% per sub difficulty level)'],
  16: ['Artifact Excavator', '+170% Magic Find + (20% per sub difficulty level)'],
  17: ['Recruit', '+10% Experience Gain + (2.5% per sub difficulty level)'],
  18: ['Combat Training', '+15% Experience Gain + (3.75% per sub difficulty level)'],
  19: ['Battle Scarred', '+20% Experience Gain + (5% per sub difficulty level)'],
  20: ['Clairvoyance', 'All recovery increased by 100% (Includes: Mana per hit, Life per hit, Mana and Life Replenish etc)'],
  21: ['Aftermath', 'Monsters have a 3% chance to summon a Legion version of them on death'],
  22: ['Deep Cuts', 'Critical Strike damage increased by 200%'],
  23: ['Old Town', '+15% chance for Ancient Packs'],
  24: ['Terror Zone', '+25% chance for Ancient Packs'],
  25: ['Fields of Carnage', '+30% chance for Ancient Packs'],
}

const DEBUFFS = [
  ["Dusk's Shroud", 'Light Radius decreased by 20%'],
  ['Elemental Erosion', 'All Resistances decreased by 75%'],
  ['Sundered Armor', 'Damage Taken increased by 25%'],
  ['Vitality Drain', 'Life decreased by 25%'],
  ['Essence Drain', 'Mana decreased by 25%'],
  ['Abyssal Gloom', 'Darkness increased by 100%'],
  ['Skill Debilitation', 'All Skills decreased by 10%'],
  ['Weakening Essence', 'All Attributes decreased by 20%'],
  ['Lifeflow Starvation', 'Regeneration reduced'],
  ['Sanguine Impairment', 'Life Steal decreased by 75%'],
  ['Arcane Impairment', 'Mana Steal decreased by 75%'],
  ['Consumed Time', 'Cooldown Recovery decreased by 25%'],
  ['Absolute Limbo', 'Cooldown Recovery decreased by 50%'],
  ['Boulder Fall', 'Monsters have a 3% chance to drop a boulder from the sky on death'],
  ['Lingering Evil', 'Movement Speed reduced by 25%'],
  ['Fatal Wounds', 'Monsters gain a 10% chance to inflict 2x damage'],
  ['Bloated Veins', 'Monsters have 70% increased Life'],
  ['Abnormal Dwelling', 'Monsters have 130% increased Life'],
  ['Colossal Bloating', 'Monsters have 200% increased Life'],
  ['Necrosis', 'Your life is drained by 1% every second'],
  ['Venomous Presence', 'Poison Duration is increased by 200%'],
  ['Flaming Agony', 'Monsters unleash a Fire Nova on death dealing 50% of their damage'],
  ['Unholy Agility', 'Monsters gain increased movement and attack speed'],
  ['Broken Armor', 'You are unable to block attacks and projectiles'],
  ['Hemorrhage', 'Monster attacks inflict a 4 second stacking bleed for 10% of their damage'],
  ['Crippling Slow', 'Monster attacks inflict a 50% slow that lasts 2 seconds'],
]

const mods = {
  source: 'hs-tracker/src/buffs.js',
  buffs: Object.fromEntries(
    Object.entries(BUFFS).map(([id, [name, desc]]) => [id, { id: Number(id), name, desc, kind: 'buff' }]),
  ),
  debuffs: Object.fromEntries(
    DEBUFFS.map(([name, desc], i) => [String(i + 1), { id: i + 1, name, desc, kind: 'debuff' }]),
  ),
  zones: ZONES,
}

const dataDir = path.join(root, 'src/data')
fs.mkdirSync(dataDir, { recursive: true })
fs.writeFileSync(path.join(dataDir, 'mods.json'), JSON.stringify(mods, null, 2))

const areas = map.nodes.map((n) => ({
  room: n.room,
  code: n.code,
  act: n.act,
  kind: n.kind,
  name: n.name?.en || n.room,
  boss: n.boss || null,
  drops: (n.drops || []).map((key) => {
    const it = map.items[key]
    return {
      key,
      name: it?.names?.en || key,
      rarity: it?.rarity || null,
      tier: it?.tier ?? null,
      rate: it?.rate ?? null,
      chase: it?.chase ?? null,
      icon: it?.icon ?? null,
    }
  }),
}))

const itemsByKey = map.items

function itemDrop(key, extra = {}) {
  const it = itemsByKey[key]
  return {
    key,
    name: it?.names?.en || key,
    rarity: it?.rarity || null,
    tier: it?.tier ?? null,
    rate: it?.rate ?? null,
    chase: it?.chase ?? null,
    icon: it?.icon ?? null,
    ...extra,
  }
}

/** Sala do jogo → chave do boss em map.bosses */
const ROOM_TO_BOSS = {
  // act boss dungeons (já vêm nos nodes, reforçados aqui)
  Act_01_Boss_Dungeon_03: 'Gurag',
  Act_02_Boss_Dungeon_03: 'Grim Reaper',
  Act_03_Boss_Dungeon_03: 'Anubis',
  Act_04_Boss_Dungeon_03: 'Damien',
  Act_05_Boss_Dungeon_03: 'Karp King',
  Act_06_Boss_Dungeon_03: 'Satan',
  Act_07_Boss_Dungeon_03: 'Mevius',
  // ubers / salas especiais
  Shadow_Boss_rm: 'Shade of Death (Uber Reaper)',
  Shadow_Realm_rm: 'Shade of Death (Uber Reaper)',
  Sheep_rm: 'Sheeponia',
  Fields_Boss_rm: 'Eternal Battlefield',
  Tomb_of_Amun_Ra_02_rm: 'Amun Ra',
  Chamber_of_Existence_rm: 'Architect of Ruin',
  Arch_Demons_Plateau_rm: 'Gabriel',
}

// nodes com campo boss
for (const n of map.nodes) {
  if (n.boss) ROOM_TO_BOSS[n.room] = n.boss
}

const bosses = {}
for (const [key, boss] of Object.entries(map.bosses || {})) {
  bosses[key] = {
    key,
    name: boss.names?.en || key,
    kind: boss.kind || null,
    infernoOnly: !!boss.inferno_only,
    icon: boss.icon || null,
    drops: (boss.drops || []).map((d) =>
      itemDrop(d.item, { inferno: !!d.inferno }),
    ),
  }
}

const items = Object.entries(map.items).map(([key, it]) => ({
  key,
  name: it.names?.en || key,
  rarity: it.rarity || null,
  tier: it.tier ?? null,
  rate: it.rate ?? null,
  chase: it.chase ?? null,
  places: it.places || [],
  zones: it.zones || [],
  hasArea: !!(it.zones?.length || it.places?.length),
  icon: it.icon ?? null,
}))

const drops = {
  source: 'hs-map/public/data/map.json',
  generatedAt: new Date().toISOString(),
  sheet: map.sheet || { w: 1024, h: 3506 },
  areas,
  bosses,
  roomToBoss: ROOM_TO_BOSS,
  items,
  itemCount: items.length,
  areaCount: areas.length,
  bossCount: Object.keys(bosses).length,
}

fs.writeFileSync(path.join(dataDir, 'drops.json'), JSON.stringify(drops))

const sample = {
  satanic_zone_name: 'SZ_8_2',
  room: 'Act_08_02',
  zone_buffs: [3, 14, 10],
  zone_debuffs: [2, 17],
  updatedAt: new Date().toISOString(),
}

const sampleDir = path.join(root, 'public/sample')
fs.mkdirSync(sampleDir, { recursive: true })
fs.writeFileSync(path.join(sampleDir, 'satanic-zone.txt'), JSON.stringify(sample, null, 2))

// NÃO sobrescreve o live file — quem escreve é o hs-capture (Npcap) da própria overlay.

console.log(`mods: ${Object.keys(mods.buffs).length} buffs, ${Object.keys(mods.debuffs).length} debuffs`)
console.log(`drops: ${drops.itemCount} items, ${drops.areaCount} areas, ${drops.bossCount} bosses`)
console.log(`room→boss: ${Object.keys(ROOM_TO_BOSS).length}`)
console.log(`drops.json: ${(fs.statSync(path.join(dataDir, 'drops.json')).size / 1024 / 1024).toFixed(2)} MB`)
