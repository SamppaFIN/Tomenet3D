/**
 * GameData.js
 * All game data definitions: races, classes, spells, monsters, items, themes, traps.
 * Separated from RoguelikeGame.js for clarity.
 */

// ─── Races ──────────────────────────────────────────────────────────
export const RACES = {
    human: { name: 'Human', hp: 10, mp: 8, str: 5, dex: 5, int: 5, desc: 'Allrounders with no weaknesses', color: 0xddbb88 },
    halfElf: { name: 'Half-Elf', hp: 9, mp: 10, str: 4, dex: 6, int: 6, desc: 'Smarter and faster than humans', color: 0xaaddbb },
    elf: { name: 'Elf', hp: 8, mp: 12, str: 3, dex: 6, int: 7, desc: 'Immortal and magical, resist light', color: 0x88ddaa },
    hobbit: { name: 'Hobbit', hp: 8, mp: 6, str: 3, dex: 8, int: 5, desc: 'Excellent rogues, stealthy', color: 0xccaa77 },
    gnome: { name: 'Gnome', hp: 9, mp: 10, str: 4, dex: 7, int: 7, desc: 'Protected from paralysis', color: 0xbb9977 },
    dwarf: { name: 'Dwarf', hp: 14, mp: 4, str: 7, dex: 3, int: 3, desc: 'Headstrong miners and fighters', color: 0xaa7744 },
    halfOrc: { name: 'Half-Orc', hp: 13, mp: 4, str: 7, dex: 5, int: 4, desc: 'Great constitution', color: 0x668844 },
    halfTroll: { name: 'Half-Troll', hp: 16, mp: 3, str: 9, dex: 2, int: 2, desc: 'Strong, regenerate, but slow', color: 0x556644 },
    dunadan: { name: 'Dunadan', hp: 12, mp: 8, str: 6, dex: 7, int: 7, desc: 'Elder hardy men', color: 0xccbbaa },
    highElf: { name: 'High-Elf', hp: 10, mp: 14, str: 6, dex: 8, int: 8, desc: 'See invisible, master skills', color: 0xeeeedd },
    darkElf: { name: 'Dark-Elf', hp: 10, mp: 10, str: 5, dex: 8, int: 7, desc: 'Resist darkness', color: 0x6644aa },
    draconian: { name: 'Draconian', hp: 14, mp: 10, str: 9, dex: 6, int: 7, desc: 'Breathe elements', color: 0xdd4422 },
};

// ─── Classes ────────────────────────────────────────────────────────
export const CLASSES = {
    warrior: { name: 'Warrior', hpMult: 1.5, mpMult: 0.3, strMult: 1.5, dexMult: 1.0, intMult: 0.4, desc: 'Hack-and-slash fighter', maxBpR: 6 },
    istar: { name: 'Istar', hpMult: 0.6, mpMult: 2.0, strMult: 0.5, dexMult: 0.8, intMult: 1.6, desc: 'Devastating spells', maxBpR: 1 },
    priest: { name: 'Priest', hpMult: 0.9, mpMult: 1.5, strMult: 0.8, dexMult: 0.7, intMult: 1.2, desc: 'Holy devotion', maxBpR: 4 },
    rogue: { name: 'Rogue', hpMult: 0.9, mpMult: 1.0, strMult: 0.9, dexMult: 1.5, intMult: 1.0, desc: 'Master of traps and stealth', maxBpR: 5 },
    paladin: { name: 'Paladin', hpMult: 1.3, mpMult: 0.8, strMult: 1.3, dexMult: 0.9, intMult: 0.8, desc: 'Holy knight', maxBpR: 5 },
    ranger: { name: 'Ranger', hpMult: 1.1, mpMult: 1.2, strMult: 1.0, dexMult: 1.2, intMult: 1.1, desc: 'Bow and magic', maxBpR: 5 },
    archer: { name: 'Archer', hpMult: 0.8, mpMult: 0.6, strMult: 0.8, dexMult: 1.6, intMult: 0.7, desc: 'Ranged damage', maxBpR: 3 },
    druid: { name: 'Druid', hpMult: 0.9, mpMult: 1.4, strMult: 0.9, dexMult: 0.8, intMult: 1.3, desc: 'Nature powers', maxBpR: 4 },
    mindcrafter: { name: 'Mindcrafter', hpMult: 1.1, mpMult: 1.2, strMult: 1.1, dexMult: 1.0, intMult: 1.2, desc: 'Psychic powers', maxBpR: 5 },
    adventurer: { name: 'Adventurer', hpMult: 1.0, mpMult: 1.0, strMult: 1.0, dexMult: 1.0, intMult: 1.0, desc: 'Jack-of-all-trades', maxBpR: 4 },
};

// ─── Spells ─────────────────────────────────────────────────────────
export const SPELLS = {
    fireball: { name: 'Fireball', key: '1', mpCost: 8, damage: 15, range: 4, radius: 1, type: 'aoe', element: 'fire', desc: 'Explosive ball of fire', cooldown: 3, color: 0xff4400 },
    heal: { name: 'Heal', key: '2', mpCost: 6, healAmount: 20, type: 'self', element: 'holy', desc: 'Restores health', cooldown: 2, color: 0x44ff88 },
    lightning: { name: 'Lightning Bolt', key: '3', mpCost: 10, damage: 22, range: 6, type: 'line', element: 'lightning', desc: 'Crackling bolt of electricity', cooldown: 4, color: 0xffff00 },
    frostNova: { name: 'Frost Nova', key: '4', mpCost: 12, damage: 12, range: 0, radius: 2, type: 'nova', element: 'ice', desc: 'Freezes all nearby enemies', cooldown: 5, color: 0x00ccff },
};

// ─── Monster Types (25+ types across 15 levels) ────────────────────
export const MONSTER_TYPES = {
    // Depth 1-3: Easy
    floatingEye: { name: 'Floating Eye', symbol: 'e', hp: 5, atk: 0, def: 0, xp: 3, speed: 1, color: 0xff8800, shape: 'sphere', minLevel: 1, ai: 'wander', ability: 'paralyze', desc: 'Paralyzing gaze' },
    rat: { name: 'Giant Rat', symbol: 'r', hp: 8, atk: 2, def: 0, xp: 5, speed: 1, color: 0x886644, shape: 'icosahedron', minLevel: 1, ai: 'wander' },
    kobold: { name: 'Kobold', symbol: 'k', hp: 10, atk: 3, def: 0, xp: 8, speed: 1, color: 0x997755, shape: 'dodecahedron', minLevel: 1, ai: 'chase' },
    goblin: { name: 'Goblin', symbol: 'g', hp: 15, atk: 4, def: 1, xp: 12, speed: 1, color: 0x22aa22, shape: 'dodecahedron', minLevel: 1, ai: 'chase' },
    giantSpider: { name: 'Giant Spider', symbol: 'S', hp: 12, atk: 5, def: 0, xp: 14, speed: 2, color: 0x554422, shape: 'icosahedron', minLevel: 2, ai: 'chase', ability: 'poison' },
    skeleton: { name: 'Skeleton', symbol: 's', hp: 20, atk: 6, def: 2, xp: 20, speed: 1, color: 0xcccccc, shape: 'octahedron', minLevel: 2, ai: 'chase' },
    warg: { name: 'Warg', symbol: 'C', hp: 22, atk: 7, def: 1, xp: 25, speed: 2, color: 0x554433, shape: 'icosahedron', minLevel: 2, ai: 'chase' },
    // Depth 3-5: Medium
    hillOrc: { name: 'Hill Orc', symbol: 'o', hp: 30, atk: 8, def: 3, xp: 35, speed: 1, color: 0x447722, shape: 'torusknot', minLevel: 3, ai: 'chase' },
    wight: { name: 'Wight', symbol: 'W', hp: 35, atk: 10, def: 3, xp: 45, speed: 1, color: 0x8888aa, shape: 'octahedron', minLevel: 3, ai: 'chase', ability: 'drain', desc: 'Drains life' },
    naga: { name: 'Naga', symbol: 'n', hp: 40, atk: 9, def: 4, xp: 50, speed: 1, color: 0x44aaaa, shape: 'cone', minLevel: 3, ai: 'chase' },
    darkElf: { name: 'Dark Elf', symbol: 'h', hp: 32, atk: 11, def: 3, xp: 55, speed: 1, color: 0x6644aa, shape: 'gomboc', minLevel: 4, ai: 'chase', ability: 'teleport' },
    caveTroll: { name: 'Cave Troll', symbol: 'T', hp: 55, atk: 14, def: 5, xp: 70, speed: 1, color: 0x556644, shape: 'oloid', minLevel: 4, ai: 'chase' },
    // Depth 5-8: Hard
    shade: { name: 'Shade', symbol: 'G', hp: 45, atk: 11, def: 2, xp: 55, speed: 2, color: 0x443366, shape: 'tetrahedron', minLevel: 5, ai: 'chase', desc: 'Nether damage' },
    vampire: { name: 'Vampire', symbol: 'V', hp: 50, atk: 13, def: 4, xp: 80, speed: 1, color: 0xaa2233, shape: 'octahedron', minLevel: 5, ai: 'chase', ability: 'drain', desc: 'Drains life force' },
    golem: { name: 'Stone Golem', symbol: 'g', hp: 80, atk: 16, def: 8, xp: 100, speed: 1, color: 0x888877, shape: 'gomboc', minLevel: 6, ai: 'chase' },
    wraith: { name: 'Wraith', symbol: 'W', hp: 55, atk: 14, def: 3, xp: 90, speed: 2, color: 0x334455, shape: 'oloid', minLevel: 6, ai: 'chase', ability: 'paralyze' },
    hydra: { name: 'Multi-Headed Hydra', symbol: 'M', hp: 90, atk: 18, def: 5, xp: 120, speed: 1, color: 0x228844, shape: 'torusknot', minLevel: 7, ai: 'chase' },
    // Depth 8-11: Very Hard
    demonImp: { name: 'Demon Imp', symbol: 'u', hp: 40, atk: 15, def: 3, xp: 85, speed: 2, color: 0xcc3322, shape: 'tetrahedron', minLevel: 8, ai: 'chase', ability: 'summon' },
    ancientDragon: { name: 'Ancient Dragon', symbol: 'D', hp: 120, atk: 22, def: 8, xp: 200, speed: 1, color: 0xff4400, shape: 'dragon', minLevel: 9, ai: 'chase' },
    lich: { name: 'Lich', symbol: 'L', hp: 80, atk: 20, def: 6, xp: 180, speed: 1, color: 0x886688, shape: 'octahedron', minLevel: 9, ai: 'chase', ability: 'summon', desc: 'Summons undead' },
    deathKnight: { name: 'Death Knight', symbol: 'p', hp: 100, atk: 24, def: 9, xp: 220, speed: 1, color: 0x334444, shape: 'torusknot', minLevel: 10, ai: 'chase', ability: 'drain' },
    // Depth 11-15: Extreme
    greatWyrm: { name: 'Great Wyrm', symbol: 'D', hp: 160, atk: 28, def: 10, xp: 350, speed: 1, color: 0xddaa00, shape: 'dragon', minLevel: 11, ai: 'chase' },
    pitFiend: { name: 'Pit Fiend', symbol: 'U', hp: 140, atk: 26, def: 9, xp: 300, speed: 1, color: 0xbb2200, shape: 'dragon', minLevel: 12, ai: 'chase', ability: 'summon' },
    archLich: { name: 'Arch-Lich', symbol: 'L', hp: 120, atk: 24, def: 7, xp: 280, speed: 1, color: 0xaa88cc, shape: 'octahedron', minLevel: 13, ai: 'chase', ability: 'teleport' },
    // ─── Zone Bosses (every 3 levels) ───
    orc_king: { name: 'Azog the Orc King', symbol: 'O', hp: 100, atk: 16, def: 6, xp: 150, speed: 1, color: 0x448822, shape: 'torusknot', minLevel: 3, ai: 'chase', boss: true, desc: 'King of the Orcs' },
    witch_king: { name: 'The Witch-King', symbol: 'W', hp: 160, atk: 22, def: 8, xp: 250, speed: 1, color: 0x333366, shape: 'octahedron', minLevel: 6, ai: 'chase', boss: true, ability: 'paralyze', desc: 'Lord of the Nazgûl' },
    smaug: { name: 'Smaug the Golden', symbol: 'D', hp: 250, atk: 30, def: 12, xp: 500, speed: 1, color: 0xffaa00, shape: 'gomboc', minLevel: 9, ai: 'chase', boss: true, desc: 'The last great dragon' },
    sauron: { name: 'Sauron', symbol: 'P', hp: 400, atk: 35, def: 14, xp: 800, speed: 1, color: 0xff4400, shape: 'oloid', minLevel: 12, ai: 'chase', boss: true, ability: 'summon', desc: 'The Dark Lord' },
    morgoth: { name: 'Morgoth, Lord of Darkness', symbol: 'P', hp: 600, atk: 45, def: 18, xp: 1500, speed: 1, color: 0xff2200, shape: 'dragon', minLevel: 15, ai: 'chase', boss: true, desc: 'He who arises in might' },
};

// ─── Level Themes (15 levels) ───────────────────────────────────────
export const LEVEL_THEMES = [
    { name: 'Barrow-Downs', wallColor: 0x334455, floorColor: 0x0a0a14, ambientColor: 0x1a1a2a, monsterDensity: 0.015, desc: 'Ancient burial mounds', bossKey: null },
    { name: 'Goblin Tunnels', wallColor: 0x443322, floorColor: 0x0e0a08, ambientColor: 0x1e1a18, monsterDensity: 0.02, desc: 'Twisting goblin warrens' },
    { name: 'Orc Stronghold', wallColor: 0x336633, floorColor: 0x0a140a, ambientColor: 0x1a2a1a, monsterDensity: 0.05, desc: 'Stronghold of the orcs', bossKey: 'orc_king' },
    { name: 'Trollshaws', wallColor: 0x445533, floorColor: 0x0c0e08, ambientColor: 0x1c1e18, monsterDensity: 0.04, desc: 'Troll-infested forest caves' },
    { name: 'Paths of the Dead', wallColor: 0x555566, floorColor: 0x0e0e12, ambientColor: 0x1e1e22, monsterDensity: 0.06, desc: 'Haunted by spirits' },
    { name: 'Minas Morgul', wallColor: 0x334455, floorColor: 0x080a10, ambientColor: 0x181a20, monsterDensity: 0.06, desc: 'Tower of dark sorcery', bossKey: 'witch_king' },
    { name: 'Shelob\'s Lair', wallColor: 0x332222, floorColor: 0x0a0808, ambientColor: 0x1a1818, monsterDensity: 0.05, desc: 'Webs and darkness' },
    { name: 'Cirith Ungol', wallColor: 0x443333, floorColor: 0x0e0a0a, ambientColor: 0x1e1a1a, monsterDensity: 0.06, desc: 'Stairs of shadow' },
    { name: 'Angband – Upper', wallColor: 0x662211, floorColor: 0x140a08, ambientColor: 0x2a1a18, monsterDensity: 0.07, desc: 'The Iron Fortress', bossKey: 'smaug' },
    { name: 'Angband – Deep', wallColor: 0x551100, floorColor: 0x100806, ambientColor: 0x201816, monsterDensity: 0.07, desc: 'Deeper into darkness' },
    { name: 'Angband – Abyss', wallColor: 0x440000, floorColor: 0x0c0604, ambientColor: 0x1c1614, monsterDensity: 0.08, desc: 'Where the fires burn' },
    { name: 'Morgoth\'s Domain', wallColor: 0x552200, floorColor: 0x0e0800, ambientColor: 0x1e1810, monsterDensity: 0.08, desc: 'Domain of the enemy', bossKey: 'sauron' },
    { name: 'The Void Gate', wallColor: 0x660033, floorColor: 0x100008, ambientColor: 0x201018, monsterDensity: 0.07, desc: 'Between worlds' },
    { name: 'Throne of Iron', wallColor: 0x773300, floorColor: 0x120a00, ambientColor: 0x221a10, monsterDensity: 0.06, desc: 'The Iron Crown awaits' },
    { name: 'Morgoth\'s Fortress', wallColor: 0x885500, floorColor: 0x1a1200, ambientColor: 0x2a2210, monsterDensity: 0.05, desc: 'Seat of the Dark Lord', bossKey: 'morgoth' },
];

// ─── Items ──────────────────────────────────────────────────────────
// Potion appearance names — randomized each game session
export const POTION_APPEARANCES = [
    'Bubbly', 'Shimmering', 'Murky', 'Glowing', 'Smoky',
    'Sparkling', 'Thick', 'Fizzing', 'Oily', 'Crystalline',
    'Swirling', 'Luminous', 'Dark', 'Golden', 'Silver',
];

export const POTION_COLORS = [
    0xff3366, 0x3366ff, 0x33ff66, 0xffcc00, 0xff6600,
    0xcc33ff, 0x33cccc, 0xff3333, 0x66ff66, 0x6633ff,
    0xcccc33, 0xff66cc, 0x33ffcc, 0xcc6633, 0x9999ff,
];

export const POTION_TYPES = {
    healPotion: { name: 'Potion of Healing', effect: 'heal', value: 30, symbol: '!', rarity: 'common' },
    bigHealPotion: { name: 'Potion of *Healing*', effect: 'heal', value: 80, symbol: '!', rarity: 'uncommon', minLevel: 4 },
    manaPotion: { name: 'Potion of Restore Mana', effect: 'mana', value: 25, symbol: '!', rarity: 'common' },
    strengthPotion: { name: 'Potion of Strength', effect: 'str_boost', value: 1, symbol: '!', rarity: 'rare', minLevel: 5 },
    dexterityPotion: { name: 'Potion of Dexterity', effect: 'dex_boost', value: 1, symbol: '!', rarity: 'rare', minLevel: 5 },
    poisonPotion: { name: 'Potion of Poison', effect: 'poison', value: -15, symbol: '!', rarity: 'common' },
    speedPotion: { name: 'Potion of Speed', effect: 'speed', value: 5, symbol: '!', rarity: 'uncommon', minLevel: 3 },
    resistPotion: { name: 'Potion of Resistance', effect: 'resist', value: 10, symbol: '!', rarity: 'uncommon', minLevel: 6 },
};

export const SCROLL_TYPES = {
    identify: { name: 'Scroll of Identify', effect: 'identify', symbol: '?', rarity: 'common', color: 0xeeddaa },
    teleport: { name: 'Scroll of Teleportation', effect: 'teleport', symbol: '?', rarity: 'uncommon', color: 0x88ccff, minLevel: 2 },
    magicMapping: { name: 'Scroll of Magic Mapping', effect: 'magic_map', symbol: '?', rarity: 'rare', color: 0xaaffaa, minLevel: 3 },
    enchant: { name: 'Scroll of Enchant Weapon', effect: 'enchant_wep', symbol: '?', rarity: 'rare', color: 0xffaa44, minLevel: 5 },
    summon: { name: 'Scroll of Summon Monster', effect: 'summon_bad', symbol: '?', rarity: 'common', color: 0xff6644 },
};

export const EQUIPMENT_TYPES = {
    // Weapons
    dagger: { name: 'Dagger', slot: 'weapon', atk: 2, def: 0, symbol: '|', color: 0xaaaaaa, rarity: 'common', minLevel: 1 },
    shortSword: { name: 'Short Sword', slot: 'weapon', atk: 4, def: 0, symbol: '|', color: 0xbbbbbb, rarity: 'common', minLevel: 2 },
    longSword: { name: 'Long Sword', slot: 'weapon', atk: 7, def: 0, symbol: '|', color: 0xcccccc, rarity: 'uncommon', minLevel: 4 },
    battleAxe: { name: 'Battle Axe', slot: 'weapon', atk: 10, def: 0, symbol: '/', color: 0xdd8833, rarity: 'uncommon', minLevel: 6 },
    mace: { name: 'Mace', slot: 'weapon', atk: 8, def: 1, symbol: '\\', color: 0x999988, rarity: 'uncommon', minLevel: 5 },
    warhammer: { name: 'War Hammer', slot: 'weapon', atk: 12, def: 0, symbol: '|', color: 0x776655, rarity: 'rare', minLevel: 8 },
    // Armor
    leatherArmor: { name: 'Leather Armor', slot: 'armor', atk: 0, def: 2, symbol: '[', color: 0x886633, rarity: 'common', minLevel: 1 },
    chainMail: { name: 'Chain Mail', slot: 'armor', atk: 0, def: 4, symbol: '[', color: 0xaaaaaa, rarity: 'uncommon', minLevel: 3 },
    plateMail: { name: 'Plate Mail', slot: 'armor', atk: 0, def: 7, symbol: '[', color: 0xbbbbcc, rarity: 'rare', minLevel: 6 },
    dragonArmor: { name: 'Dragon Scale Mail', slot: 'armor', atk: 0, def: 10, symbol: '[', color: 0xff6644, rarity: 'epic', minLevel: 10 },
    // Rings
    ringProtect: { name: 'Ring of Protection', slot: 'ring', atk: 0, def: 2, symbol: '=', color: 0xcccc44, rarity: 'uncommon', minLevel: 3 },
    ringPower: { name: 'Ring of Power', slot: 'ring', atk: 3, def: 0, symbol: '=', color: 0xff4444, rarity: 'rare', minLevel: 7 },
    ringRegen: { name: 'Ring of Regeneration', slot: 'ring', atk: 0, def: 0, symbol: '=', color: 0x44ff44, rarity: 'rare', minLevel: 5, special: 'regen' },
};

// Legendary uniques — one-of-a-kind
export const LEGENDARY_ITEMS = {
    glamdring: { name: '★ Glamdring, Foe-hammer', slot: 'weapon', atk: 18, def: 2, symbol: '|', color: 0x88aaff, rarity: 'legendary', minLevel: 8, desc: 'Glows blue near orcs' },
    sting: { name: '★ Sting', slot: 'weapon', atk: 12, def: 0, symbol: '|', color: 0x88ddff, rarity: 'legendary', minLevel: 5, desc: 'Glows blue near orcs', special: 'seeInvisible' },
    mithrilCoat: { name: '★ Mithril Coat', slot: 'armor', atk: 0, def: 14, symbol: '[', color: 0xeeeeff, rarity: 'legendary', minLevel: 10, desc: 'As light as a feather, as hard as dragon scales' },
    oneRing: { name: '★ The One Ring', slot: 'ring', atk: 5, def: 5, symbol: '=', color: 0xffdd00, rarity: 'legendary', minLevel: 14, desc: 'One ring to rule them all', special: 'invisible' },
    anduril: { name: '★ Andúril, Flame of the West', slot: 'weapon', atk: 25, def: 3, symbol: '|', color: 0xffcc44, rarity: 'legendary', minLevel: 12, desc: 'Reforged from the shards of Narsil' },
};

// ─── Trap Types ─────────────────────────────────────────────────────
export const TRAP_TYPES = {
    teleport: { name: 'Teleport Trap', effect: 'teleport', damage: 0, color: 0x8844ff, desc: 'Teleports you randomly!' },
    pit: { name: 'Pit Trap', effect: 'pit', damage: 15, color: 0x553311, desc: 'You fall into a pit!' },
    poison: { name: 'Poison Trap', effect: 'poison', damage: 8, color: 0x44aa22, desc: 'A cloud of poison gas!' },
    alarm: { name: 'Alarm Trap', effect: 'alarm', damage: 0, color: 0xff4444, desc: 'An alarm sounds! Monsters rush toward you!' },
    fire: { name: 'Fire Trap', effect: 'fire', damage: 20, color: 0xff6600, desc: 'Flames erupt beneath you!' },
    confusion: { name: 'Confusion Trap', effect: 'confusion', damage: 0, color: 0xcc44cc, desc: 'You feel disoriented!' },
};

// ─── Tile Types ─────────────────────────────────────────────────────
export const TILE = {
    WALL: 1,
    FLOOR: 0,
    DOOR_CLOSED: 2,
    DOOR_OPEN: 3,
    SECRET_WALL: 4,   // Looks like wall, can be searched
    TRAP_HIDDEN: 5,    // Looks like floor
    TRAP_REVEALED: 6,  // Trap that has been seen
    PORTAL: 7,         // Advanced portal tile
};

// ─── XP Table ───────────────────────────────────────────────────────
export const XP_TABLE = [0, 20, 50, 100, 180, 300, 500, 800, 1200, 1800, 2500, 3500, 5000, 7000, 10000, 15000, 22000, 30000, 40000, 55000];

// ─── Rarity weights ────────────────────────────────────────────────
export const RARITY_WEIGHTS = {
    common: 60,
    uncommon: 25,
    rare: 10,
    epic: 4,
    legendary: 1,
};
