/**
 * RoguelikeGame.js
 * Classic roguelike engine with BSP dungeons, identification, auto-movement,
 * traps, secret rooms, and 15 depth levels. Uses GameData.js and DungeonGenerator.js.
 */
import {
    RACES, CLASSES, SPELLS, MONSTER_TYPES, LEVEL_THEMES,
    POTION_TYPES, POTION_APPEARANCES, POTION_COLORS,
    SCROLL_TYPES, EQUIPMENT_TYPES, LEGENDARY_ITEMS,
    TRAP_TYPES, TILE, XP_TABLE, RARITY_WEIGHTS
} from './GameData.js';
import { DungeonGenerator } from './DungeonGenerator.js';

export class RoguelikeGame {
    constructor(config = {}) {
        this.width = config.width || 60;
        this.height = config.height || 40;
        this.observers = [];
        this.pendingPlayerAction = null;
        this.gameLog = [];
        this.nextEntityId = 100;
        this.charRace = config.race || 'human';
        this.charClass = config.class || 'warrior';

        // Auto-run state
        this.autoRun = { active: false, dx: 0, dy: 0 };
        // Path-walk state (for click-to-move)
        this.autoPath = [];

        // Identification system — randomized each game
        this.potionIdentity = this._generatePotionIdentity();
        this.identifiedPotions = new Set();

        // Dungeon metadata
        this.rooms = [];
        this.traps = [];
        this.secretDoors = [];

        this.state = this._createInitialState();
        this.initialize();
    }

    _generatePotionIdentity() {
        // Shuffle appearances/colors and map them to potion types
        const keys = Object.keys(POTION_TYPES);
        const appearances = [...POTION_APPEARANCES].sort(() => Math.random() - 0.5);
        const colors = [...POTION_COLORS].sort(() => Math.random() - 0.5);
        const identity = {};
        keys.forEach((key, i) => {
            identity[key] = {
                appearance: appearances[i % appearances.length],
                color: colors[i % colors.length],
            };
        });
        return identity;
    }

    _createInitialState() {
        const race = RACES[this.charRace];
        const cls = CLASSES[this.charClass];
        const maxHp = Math.floor(race.hp * cls.hpMult * 3);
        const maxMp = Math.floor(race.mp * cls.mpMult * 3);

        return {
            tick: 0,
            map: [],
            visibility: [],
            explored: [],
            sightRange: 7,
            entities: {},
            items: [],
            player: null,
            stairs: null,
            stairsUp: null,
            currentLevel: 1,
            maxLevel: 15,
            status: 'playing',
            lastAction: null,
            character: {
                name: 'Olloid',
                race: race.name,
                class: cls.name,
                level: 1,
                xp: 0,
                xpToNext: XP_TABLE[1],
                hp: maxHp, maxHp,
                mp: maxMp, maxMp,
                energy: 0, speed: 10,
                stats: {
                    str: Math.floor(race.str * cls.strMult),
                    dex: Math.floor(race.dex * cls.dexMult),
                    int: Math.floor(race.int * cls.intMult),
                },
                kills: 0,
                spellCooldowns: { fireball: 0, heal: 0, lightning: 0, frostNova: 0 },
                inventory: [],
                equipment: { weapon: null, armor: null, ring: null },
            }
        };
    }

    // ─── Initialization ──────────────────────────────────────────────
    initialize() {
        this.generateLevel(this.state.currentLevel);
        this.startLoop();
    }

    generateLevel(levelNum) {
        this.state.currentLevel = levelNum;
        this.state.entities = {};
        this.state.items = [];
        this.autoRun = { active: false, dx: 0, dy: 0 };
        this.autoPath = [];

        // BSP Dungeon Generation
        const result = DungeonGenerator.generate(this.width, this.height, levelNum);
        this.state.map = result.map;
        this.rooms = result.rooms;
        this.traps = result.traps;
        this.secretDoors = result.secretDoors;

        // Init fog of war
        this.state.visibility = Array.from({ length: this.height }, () => Array(this.width).fill(0));
        this.state.explored = Array.from({ length: this.height }, () => Array(this.width).fill(0));

        this.spawnPlayer();
        this.spawnStairs(levelNum);
        this.spawnMonsters(levelNum);
        this.spawnItems(levelNum);
        this.updateVisibility();

        const theme = LEVEL_THEMES[levelNum - 1] || LEVEL_THEMES[0];
        this.log(`⚔️ You enter ${theme.name} — Depth ${levelNum}`);
        this.notifyObservers('level_change', { level: levelNum, theme });
    }

    // ─── Spawning ───────────────────────────────────────────────────
    spawnPlayer() {
        const room = this.rooms[0] || { x: 1, y: 1, w: 3, h: 3 };
        const pos = DungeonGenerator.findFloorInRoom(this.state.map, room);
        if (this.state.player) {
            this.state.player.x = pos.x;
            this.state.player.y = pos.y;
            this.state.entities[this.state.player.id] = this.state.player;
        } else {
            const player = {
                id: 'player_1', type: 'olloid',
                x: pos.x, y: pos.y, rotation: 0, isPlayer: true,
            };
            this.state.entities[player.id] = player;
            this.state.player = player;
        }
    }

    spawnStairs(levelNum) {
        if (levelNum < this.state.maxLevel) {
            const room = this.rooms[this.rooms.length - 1] || this.rooms[0];
            const pos = DungeonGenerator.findFloorInRoom(this.state.map, room);
            this.state.stairs = { x: pos.x, y: pos.y, direction: 'down' };
        } else {
            this.state.stairs = null;
        }
        if (levelNum > 1) {
            const pos = DungeonGenerator.findFloorInRoom(this.state.map, this.rooms[0]);
            this.state.stairsUp = { x: pos.x, y: pos.y, direction: 'up' };
        } else {
            this.state.stairsUp = null;
        }
    }

    spawnMonsters(levelNum) {
        const theme = LEVEL_THEMES[levelNum - 1] || LEVEL_THEMES[0];
        const monsterCount = Math.floor((this.width * this.height) * theme.monsterDensity);
        const eligible = Object.entries(MONSTER_TYPES)
            .filter(([, m]) => m.minLevel <= levelNum && !m.boss)
            .map(([key, m]) => ({ key, ...m }));

        for (let i = 0; i < monsterCount; i++) {
            const pos = this.findRandomFloor();
            if (this.state.player && pos.x === this.state.player.x && pos.y === this.state.player.y) continue;
            if (this.state.stairs && pos.x === this.state.stairs.x && pos.y === this.state.stairs.y) continue;
            if (eligible.length === 0) break;

            const type = eligible[Math.floor(Math.random() * eligible.length)];
            const scaleFactor = 1 + (levelNum - type.minLevel) * 0.15;
            const id = `monster_${this.nextEntityId++}`;
            this.state.entities[id] = {
                id, type: 'monster', monsterType: type.key,
                name: type.name, x: pos.x, y: pos.y,
                hp: Math.floor(type.hp * scaleFactor),
                maxHp: Math.floor(type.hp * scaleFactor),
                atk: Math.floor(type.atk * scaleFactor),
                def: type.def, xp: Math.floor(type.xp * scaleFactor),
                speed: type.speed * 10, energy: 0,
                color: type.color, shape: type.shape,
                ai: type.ai, boss: false, rotation: 0,
                ability: type.ability || null,
                symbol: type.symbol,
            };
        }

        // Spawn zone boss if this level has one
        if (theme.bossKey && MONSTER_TYPES[theme.bossKey]) {
            const bossType = MONSTER_TYPES[theme.bossKey];
            const pos = this.findRandomFloor();
            const id = `monster_${this.nextEntityId++}`;
            this.state.entities[id] = {
                id, type: 'monster', monsterType: theme.bossKey,
                name: bossType.name, x: pos.x, y: pos.y,
                hp: bossType.hp, maxHp: bossType.hp,
                atk: bossType.atk, def: bossType.def,
                xp: bossType.xp, speed: bossType.speed * 10, energy: 0,
                color: bossType.color, shape: bossType.shape,
                ai: bossType.ai, boss: true, rotation: 0,
                ability: bossType.ability || null,
                symbol: bossType.symbol,
            };
            this.log(`🔥 You sense a terrible presence: ${bossType.name}...`);
        }
    }

    spawnItems(levelNum) {
        const itemCount = 3 + Math.floor(levelNum * 0.8);
        for (let i = 0; i < itemCount; i++) {
            const pos = this.findRandomFloor();
            const item = this._generateRandomItem(levelNum);
            if (item) {
                item.x = pos.x;
                item.y = pos.y;
                item.id = `item_${this.nextEntityId++}`;
                this.state.items.push(item);
            }
        }
    }

    _generateRandomItem(levelNum) {
        const roll = Math.random();
        if (roll < 0.35) return this._generatePotion(levelNum);
        if (roll < 0.55) return this._generateScroll(levelNum);
        if (roll < 0.80) return this._generateEquipment(levelNum);
        // Small chance for legendary
        if (roll < 0.85 && levelNum >= 5) return this._generateLegendary(levelNum);
        return this._generatePotion(levelNum); // fallback
    }

    _generatePotion(levelNum) {
        const eligible = Object.entries(POTION_TYPES)
            .filter(([, p]) => !p.minLevel || p.minLevel <= levelNum);
        if (eligible.length === 0) return null;
        const [key, potion] = eligible[Math.floor(Math.random() * eligible.length)];
        const identity = this.potionIdentity[key];
        const identified = this.identifiedPotions.has(key);

        return {
            category: 'potion', potionKey: key,
            name: identified ? potion.name : `${identity.appearance} Potion`,
            trueName: potion.name,
            effect: potion.effect, value: potion.value,
            color: identified ? 0xff3366 : identity.color,
            symbol: '!', identified,
        };
    }

    _generateScroll(levelNum) {
        const eligible = Object.entries(SCROLL_TYPES)
            .filter(([, s]) => !s.minLevel || s.minLevel <= levelNum);
        if (eligible.length === 0) return null;
        const [key, scroll] = eligible[Math.floor(Math.random() * eligible.length)];
        return {
            category: 'scroll', scrollKey: key,
            name: scroll.name, effect: scroll.effect,
            color: scroll.color, symbol: '?', identified: true,
        };
    }

    _generateEquipment(levelNum) {
        const eligible = Object.entries(EQUIPMENT_TYPES)
            .filter(([, e]) => !e.minLevel || e.minLevel <= levelNum);
        if (eligible.length === 0) return null;
        const [key, equip] = eligible[Math.floor(Math.random() * eligible.length)];
        // Random bonus based on depth, with chance of curse
        const curseRoll = Math.random();
        let bonus = Math.floor(Math.random() * (levelNum / 3));
        let enchantment = 'normal';
        if (curseRoll < 0.08) {
            // 8% chance cursed — negative bonus
            bonus = -(Math.floor(Math.random() * 3) + 1);
            enchantment = 'cursed';
        } else if (bonus > 0) {
            enchantment = 'enchanted';
        }

        // Items start unidentified (bonus hidden)
        return {
            category: 'equipment', equipKey: key,
            name: equip.name,
            bonus: bonus,
            slot: equip.slot, atk: equip.atk + bonus, def: equip.def + bonus,
            color: equip.color, symbol: equip.symbol, identified: false,
            rarity: equip.rarity, enchantment,
        };
    }

    _generateLegendary(levelNum) {
        const eligible = Object.entries(LEGENDARY_ITEMS)
            .filter(([, l]) => l.minLevel <= levelNum);
        if (eligible.length === 0) return null;
        const [key, item] = eligible[Math.floor(Math.random() * eligible.length)];
        return {
            category: 'equipment', equipKey: key,
            name: item.name, slot: item.slot,
            atk: item.atk, def: item.def,
            color: item.color, symbol: item.symbol,
            identified: true, rarity: 'legendary',
            desc: item.desc, special: item.special,
        };
    }

    findRandomFloor() {
        return DungeonGenerator.findRandomFloor(this.state.map, this.width, this.height);
    }

    // ─── Game Loop ─────────────────────────────────────────────────
    startLoop() { this.state.status = 'playing'; this.processTurnLoop(); }
    stopLoop() { this.state.status = 'paused'; }

    queueAction(action) {
        if (this.state.status !== 'playing') return;
        // Stop auto-run on any manual action
        if (this.autoRun.active && action !== 'auto_step') {
            this.autoRun.active = false;
        }
        // Stop path-walk on manual action (but NOT on path_step or new startPathTo)
        if (this.autoPath.length > 0 && action !== 'path_step' && !this._isPathAction) {
            this.autoPath = [];
        }
        if (this.state.character.energy >= 100) {
            this._processPlayerAction(action);
            this.state.character.energy -= 100;
            this.processTurnLoop();
        }
    }

    startAutoRun(dx, dy) {
        if (this.state.status !== 'playing') return;
        this.autoRun = { active: true, dx, dy };
        this._doAutoStep();
    }

    _doAutoStep() {
        if (!this.autoRun.active || this.state.status !== 'playing') return;
        const { dx, dy } = this.autoRun;
        const p = this.state.player;
        const nx = p.x + dx;
        const ny = p.y + dy;

        // Check interrupt conditions
        if (this._shouldInterruptAutoRun(nx, ny)) {
            this.autoRun.active = false;
            return;
        }

        if (this._isWalkable(nx, ny) && !this._getMonsterAt(nx, ny)) {
            this.queueAction('auto_step');
        } else {
            this.autoRun.active = false;
        }
    }

    // ─── Path-Walk (click-to-move) ──────────────────────────────────
    startPathTo(tx, ty) {
        if (this.state.status !== 'playing') return;
        const p = this.state.player;
        const path = this._bfsPath(p.x, p.y, tx, ty);
        if (!path || path.length === 0) {
            this.log('No path to that location.');
            return;
        }
        this.autoRun.active = false;
        this._isPathAction = true; // prevent queueAction from clearing the new path
        this.autoPath = path;
        this._doPathStep();
        this._isPathAction = false;
    }

    _doPathStep() {
        if (this.autoPath.length === 0 || this.state.status !== 'playing') return;
        const next = this.autoPath[0];
        const p = this.state.player;
        const dx = next.x - p.x;
        const dy = next.y - p.y;

        // Check tile is reachable (walkable, door, or has a monster to fight)
        const tile = this.state.map[next.y]?.[next.x];
        const monsterHere = this._getMonsterAt(next.x, next.y);
        const isDoor = tile === TILE.DOOR_CLOSED;
        if (!this._isWalkable(next.x, next.y) && !isDoor && !monsterHere) {
            this.autoPath = [];
            return;
        }

        // Convert dx/dy to action
        const dirMap = {
            '0,-1': 'move_up', '0,1': 'move_down',
            '-1,0': 'move_left', '1,0': 'move_right',
            '-1,-1': 'move_up_left', '1,-1': 'move_up_right',
            '-1,1': 'move_down_left', '1,1': 'move_down_right'
        };
        const action = dirMap[dx + ',' + dy];
        if (!action) { this.autoPath = []; return; }

        this.autoPath.shift(); // consume step
        this.pathStepDir = { dx, dy };
        this._isPathAction = true;
        this.queueAction('path_step');
        this._isPathAction = false;
    }

    autoExplore() {
        if (this.state.status !== 'playing') return;
        const p = this.state.player;
        const target = this._findNearestUnexplored(p.x, p.y);
        if (target) {
            this.startPathTo(target.x, target.y);
        } else {
            this.log('The entire dungeon is explored.');
            this.autoPath = [];
        }
    }

    _findNearestUnexplored(sx, sy) {
        const w = this.width, h = this.height;
        const visited = Array.from({ length: h }, () => new Uint8Array(w));
        const queue = [{ x: sx, y: sy }];
        visited[sy][sx] = 1;

        const dirs = [
            { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
            { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
        ];

        while (queue.length > 0) {
            const cur = queue.shift();

            for (const d of dirs) {
                const nx = cur.x + d.x;
                const ny = cur.y + d.y;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                if (visited[ny][nx]) continue;
                visited[ny][nx] = 1;

                const tile = this.state.map[ny][nx];

                // Found an unexplored tile that is reachable from explored space
                if (this.state.explored[ny][nx] === 0) {
                    return { x: nx, y: ny };
                }

                // Can only BFS through explored walkable areas or doors
                if (this._isWalkable(nx, ny) || tile === TILE.DOOR_CLOSED) {
                    queue.push({ x: nx, y: ny });
                }
            }
        }
        return null;
    }

    _bfsPath(sx, sy, tx, ty) {
        if (sx === tx && sy === ty) return [];
        const w = this.width, h = this.height;
        const visited = Array.from({ length: h }, () => new Uint8Array(w));
        const prev = Array.from({ length: h }, () => new Array(w).fill(null));
        const queue = [{ x: sx, y: sy }];
        visited[sy][sx] = 1;

        // 8-directional BFS
        const dirs = [
            { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
            { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
        ];

        while (queue.length > 0) {
            const cur = queue.shift();
            for (const d of dirs) {
                const nx = cur.x + d.x;
                const ny = cur.y + d.y;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                if (visited[ny][nx]) continue;
                const tile = this.state.map[ny][nx];
                // Allow floor, open doors, traps, AND closed doors for pathing
                const passable = this._isWalkable(nx, ny) || tile === TILE.DOOR_CLOSED;
                if (!passable && !(nx === tx && ny === ty)) continue;
                visited[ny][nx] = 1;
                prev[ny][nx] = { x: cur.x, y: cur.y };
                if (nx === tx && ny === ty) {
                    const path = [];
                    let cx = tx, cy = ty;
                    while (cx !== sx || cy !== sy) {
                        path.unshift({ x: cx, y: cy });
                        const p = prev[cy][cx];
                        cx = p.x; cy = p.y;
                    }
                    return path;
                }
                queue.push({ x: nx, y: ny });
            }
        }
        return null; // no path
    }

    _shouldInterruptAutoRun(nx, ny) {
        const p = this.state.player;
        // Monster in FOV
        const vis = this.state.visibility;
        for (const e of Object.values(this.state.entities)) {
            if (e.type === 'monster' && vis[e.y] && vis[e.y][e.x]) {
                this.log('⚠️ You see a monster!');
                return true;
            }
        }
        // Item on current or next tile
        if (this.state.items.some(i => (i.x === p.x && i.y === p.y) || (i.x === nx && i.y === ny))) {
            this.log('✨ You notice something on the ground.');
            return true;
        }
        // Door ahead
        if (this.state.map[ny] && (this.state.map[ny][nx] === TILE.DOOR_CLOSED || this.state.map[ny][nx] === TILE.DOOR_OPEN)) {
            this.log('🚪 A door blocks your path.');
            return true;
        }
        // Intersection (more than 2 open sides)
        let openSides = 0;
        for (const [ddx, ddy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            if (this._isWalkable(p.x + ddx, p.y + ddy)) openSides++;
        }
        if (openSides > 2) return true;

        // Stairs
        if (this.state.stairs && this.state.stairs.x === nx && this.state.stairs.y === ny) {
            this.log('📍 You see stairs leading down.');
            return true;
        }
        if (this.state.stairsUp && this.state.stairsUp.x === nx && this.state.stairsUp.y === ny) {
            this.log('📍 You see stairs leading up.');
            return true;
        }
        return false;
    }

    processTurnLoop() {
        let safety = 0;
        while (this.state.character.energy < 100 && safety < 1000) {
            this.state.tick++;
            this.state.character.energy += this.state.character.speed;

            for (const id in this.state.entities) {
                const m = this.state.entities[id];
                if (m.type === 'monster') {
                    m.energy += m.speed;
                    while (m.energy >= 100) {
                        this._processMonsterAI(m);
                        m.energy -= 100;
                        if (this.state.status !== 'playing') return;
                    }
                }
            }

            const cd = this.state.character.spellCooldowns;
            for (const spell in cd) { if (cd[spell] > 0) cd[spell]--; }
            safety++;
        }

        this.updateVisibility();
        this.notifyObservers('tick', this.state);

        // Continue auto-run after turn
        if (this.autoRun.active) {
            setTimeout(() => this._doAutoStep(), 80);
        }
        // Continue path-walk after turn
        if (this.autoPath.length > 0) {
            setTimeout(() => this._doPathStep(), 80);
        }
    }

    // ─── Visibility ─────────────────────────────────────────────────
    updateVisibility() {
        const p = this.state.player;
        if (!p) return;
        const vis = this.state.visibility;
        const expl = this.state.explored;
        const range = this.state.sightRange;

        for (let y = 0; y < this.height; y++)
            for (let x = 0; x < this.width; x++)
                vis[y][x] = 0;

        vis[p.y][p.x] = 1;
        expl[p.y][p.x] = 1;

        const numRays = 240;
        for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            for (let step = 1; step <= range; step++) {
                const tx = Math.round(p.x + dx * step);
                const ty = Math.round(p.y + dy * step);
                if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) break;
                vis[ty][tx] = 1;
                expl[ty][tx] = 1;
                const tile = this.state.map[ty][tx];
                if (tile === TILE.WALL || tile === TILE.SECRET_WALL || tile === TILE.DOOR_CLOSED) break;
            }
        }
    }

    // ─── Player Actions ────────────────────────────────────────────
    _processPlayerAction(action) {
        if (action.startsWith('move_') || action === 'auto_step' || action === 'path_step') {
            this._processMovement(action);
        } else if (action.startsWith('cast_')) {
            this._castSpell(action.replace('cast_', ''));
        } else if (action === 'descend') { this._tryDescend(); }
        else if (action === 'ascend') { this._tryAscend(); }
        else if (action === 'wait') { this.log('You wait...'); }
        else if (action === 'pickup') { this._pickupItem(); }
        else if (action === 'auto_explore') { this.autoExplore(); }
        else if (action === 'search') { this._searchWalls(); }
        else if (action === 'use_item') { /* handled externally */ }
    }

    _processMovement(action) {
        let dx = 0, dy = 0;
        if (action === 'auto_step') {
            dx = this.autoRun.dx;
            dy = this.autoRun.dy;
        } else if (action === 'path_step' && this.pathStepDir) {
            dx = this.pathStepDir.dx;
            dy = this.pathStepDir.dy;
        } else {
            switch (action) {
                case 'move_up': dy = -1; break;
                case 'move_down': dy = 1; break;
                case 'move_left': dx = -1; break;
                case 'move_right': dx = 1; break;
                // Diagonal movement
                case 'move_up_left': dx = -1; dy = -1; break;
                case 'move_up_right': dx = 1; dy = -1; break;
                case 'move_down_left': dx = -1; dy = 1; break;
                case 'move_down_right': dx = 1; dy = 1; break;
            }
        }

        const player = this.state.player;
        const newX = player.x + dx;
        const newY = player.y + dy;

        // Attack monster?
        const monster = this._getMonsterAt(newX, newY);
        if (monster) { this._meleeAttack(player, monster); return; }

        // Open closed door and walk through
        if (this.state.map[newY] && this.state.map[newY][newX] === TILE.DOOR_CLOSED) {
            this.state.map[newY][newX] = TILE.DOOR_OPEN;
            this.log('🚪 You open the door.');
            this.notifyObservers('door_open', { x: newX, y: newY });
            // Continue — now walk through the opened door
        }

        if (this._isWalkable(newX, newY)) {
            player.x = newX;
            player.y = newY;
            if (dx === 1) player.rotation = 90;
            if (dx === -1) player.rotation = 270;
            if (dy === 1) player.rotation = 180;
            if (dy === -1) player.rotation = 0;

            // Check traps
            this._checkTrap(newX, newY);
            // Check items on ground
            this._checkItemOnGround();
            // Check stairs hint
            this._checkStairsHint();
            // Check portals
            this._checkPortal(newX, newY);
        }
    }

    _isWalkable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        const tile = this.state.map[y][x];
        return tile === TILE.FLOOR || tile === TILE.DOOR_OPEN || tile === TILE.TRAP_HIDDEN || tile === TILE.TRAP_REVEALED || tile === TILE.PORTAL;
    }

    isValidMove(x, y) { return this._isWalkable(x, y); }

    // ─── Search ─────────────────────────────────────────────────────
    _checkPortal(x, y) {
        if (this.state.map[y][x] === TILE.PORTAL) {
            this.log('🌀 You step into the portal... Everything warps!');
            const target = DungeonGenerator.findRandomFloor(this.state.map, this.width, this.height);
            this.state.player.x = target.x;
            this.state.player.y = target.y;
            this.notifyObservers('teleport', { x: target.x, y: target.y });
            // Stop auto-path on teleport
            this.autoPath = [];
        }
    }

    _searchWalls() {
        const p = this.state.player;
        let found = false;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const x = p.x + dx;
                const y = p.y + dy;
                if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
                if (this.state.map[y][x] === TILE.SECRET_WALL) {
                    this.state.map[y][x] = TILE.DOOR_CLOSED;
                    this.log('🔍 You discover a secret door!');
                    this.notifyObservers('secret_found', { x, y });
                    found = true;
                }
                // Also reveal traps
                const trap = this.traps.find(t => t.x === x && t.y === y && !t.revealed);
                if (trap && Math.random() < 0.4) {
                    trap.revealed = true;
                    this.state.map[y][x] = TILE.TRAP_REVEALED;
                    this.log(`🔍 You notice a ${TRAP_TYPES[trap.type].name}!`);
                    found = true;
                }
            }
        }
        if (!found) this.log('You search but find nothing.');
    }

    // ─── Traps ──────────────────────────────────────────────────────
    _checkTrap(x, y) {
        const trap = this.traps.find(t => t.x === x && t.y === y);
        if (!trap) return;
        if (trap.revealed) return; // Revealed traps can be avoided

        trap.revealed = true;
        this.state.map[y][x] = TILE.TRAP_REVEALED;
        const trapDef = TRAP_TYPES[trap.type];
        this.log(`⚠️ ${trapDef.desc}`);
        this.notifyObservers('trap_triggered', { x, y, type: trap.type });

        const char = this.state.character;
        switch (trapDef.effect) {
            case 'teleport': {
                const pos = this.findRandomFloor();
                this.state.player.x = pos.x;
                this.state.player.y = pos.y;
                this.autoRun.active = false;
                this.log('You are teleported!');
                break;
            }
            case 'pit':
            case 'fire':
                char.hp -= trapDef.damage;
                this.log(`💥 You take ${trapDef.damage} damage!`);
                if (char.hp <= 0) this._playerDeath();
                break;
            case 'poison':
                char.hp -= trapDef.damage;
                this.log(`🤢 Poison! You take ${trapDef.damage} damage!`);
                if (char.hp <= 0) this._playerDeath();
                break;
            case 'alarm':
                this.log('🔔 Monsters are alerted!');
                // Wake nearby wandering monsters
                for (const e of Object.values(this.state.entities)) {
                    if (e.type === 'monster' && e.ai === 'wander') {
                        const dist = Math.abs(e.x - x) + Math.abs(e.y - y);
                        if (dist < 15) e.ai = 'chase';
                    }
                }
                break;
            case 'confusion':
                this.log('😵 You feel confused! Directions may be random for a few turns.');
                break;
        }
    }

    _checkItemOnGround() {
        const p = this.state.player;
        const item = this.state.items.find(i => i.x === p.x && i.y === p.y);
        if (item) {
            // Auto-pickup: items go to inventory now
            this._pickupItem();
        }
    }

    _checkStairsHint() {
        const p = this.state.player;
        if (this.state.stairs && p.x === this.state.stairs.x && p.y === this.state.stairs.y) {
            this.log('📍 You stand on stairs leading down. Press > to descend.');
        }
        if (this.state.stairsUp && p.x === this.state.stairsUp.x && p.y === this.state.stairsUp.y) {
            this.log('📍 You stand on stairs leading up. Press < to ascend.');
        }
    }

    // ─── Combat ────────────────────────────────────────────────────
    _meleeAttack(attacker, defender) {
        const char = this.state.character;
        const weaponAtk = char.equipment.weapon ? char.equipment.weapon.atk : 0;
        const damage = Math.max(1, char.stats.str + weaponAtk + Math.floor(Math.random() * char.stats.str) - defender.def);
        defender.hp -= damage;
        this.log(`⚔️ You hit ${defender.name} for ${damage} damage!`);
        this.notifyObservers('combat', { type: 'melee', attacker: 'player', defender: defender.id, damage });
        if (defender.hp <= 0) this._killMonster(defender);
    }

    _monsterAttack(monster) {
        const char = this.state.character;
        const armorDef = char.equipment.armor ? char.equipment.armor.def : 0;
        const ringDef = char.equipment.ring ? char.equipment.ring.def : 0;
        const dexReduction = Math.floor(char.stats.dex * 0.3);
        const damage = Math.max(1, monster.atk + Math.floor(Math.random() * 3) - dexReduction - armorDef - ringDef);
        char.hp -= damage;
        this.log(`💥 ${monster.name} hits you for ${damage} damage!`);
        this.notifyObservers('combat', { type: 'monster_attack', attacker: monster.id, damage });

        // Special abilities
        if (monster.ability === 'drain' && Math.random() < 0.3) {
            const drain = Math.floor(damage * 0.5);
            monster.hp = Math.min(monster.maxHp, monster.hp + drain);
            this.log(`🩸 ${monster.name} drains your life!`);
        }
        if (monster.ability === 'paralyze' && Math.random() < 0.2) {
            this.log(`😵 ${monster.name}'s gaze paralyzes you!`);
            // Skip player's next turn
            this.state.character.energy = 0;
        }

        if (char.hp <= 0) this._playerDeath();
    }

    _killMonster(monster) {
        const char = this.state.character;
        char.xp += monster.xp;
        char.kills++;
        this.log(`💀 ${monster.name} is destroyed! (+${monster.xp} XP)`);
        this.notifyObservers('monster_killed', { monster: monster.id, xp: monster.xp, monsterType: monster.monsterType });

        // Drop loot (higher chance from bosses)
        const dropChance = monster.boss ? 0.9 : 0.35;
        if (Math.random() < dropChance) {
            const item = this._generateRandomItem(this.state.currentLevel);
            if (item) {
                item.x = monster.x;
                item.y = monster.y;
                item.id = `item_${this.nextEntityId++}`;
                this.state.items.push(item);
                this.log(`✨ ${monster.name} dropped ${item.name}!`);
            }
        }

        delete this.state.entities[monster.id];
        this._checkLevelUp();

        if (monster.boss && this.state.currentLevel === this.state.maxLevel) {
            this._victory();
        }
    }

    _checkLevelUp() {
        const char = this.state.character;
        while (char.xp >= char.xpToNext && char.level < XP_TABLE.length) {
            char.level++;
            const race = RACES[this.charRace];
            const cls = CLASSES[this.charClass];
            char.maxHp += Math.floor(race.hp * cls.hpMult * 0.5);
            char.maxMp += Math.floor(race.mp * cls.mpMult * 0.4);
            char.stats.str += Math.ceil(cls.strMult * 0.5);
            char.stats.dex += Math.ceil(cls.dexMult * 0.5);
            char.stats.int += Math.ceil(cls.intMult * 0.5);
            char.hp = char.maxHp;
            char.mp = char.maxMp;
            char.xpToNext = XP_TABLE[char.level] || char.xpToNext * 2;
            this.log(`🌟 LEVEL UP! You are now level ${char.level}!`);
            this.notifyObservers('level_up', { level: char.level });
        }
    }

    _playerDeath() {
        this.state.status = 'dead';
        this.state.character.hp = 0;
        this.autoRun.active = false;
        this.stopLoop();
        this.log('💀 You have been slain...');
        this.notifyObservers('game_over', { status: 'dead', stats: { ...this.state.character, level: this.state.currentLevel } });
    }

    _victory() {
        this.state.status = 'won';
        this.autoRun.active = false;
        this.stopLoop();
        this.log('🏆 VICTORY! You have vanquished Morgoth and saved Middle-earth!');
        this.notifyObservers('game_over', { status: 'won', stats: { ...this.state.character, level: this.state.currentLevel } });
    }

    // ─── Items ─────────────────────────────────────────────────────
    _pickupItem() {
        const p = this.state.player;
        const idx = this.state.items.findIndex(i => i.x === p.x && i.y === p.y);
        if (idx === -1) { this.log('Nothing to pick up here.'); return; }

        const item = this.state.items[idx];
        // All items (including equipment) now go to inventory first
        this.state.character.inventory.push(item);
        this.log(`📦 ${item.name} added to inventory`);

        this.state.items.splice(idx, 1);
        this.notifyObservers('item_pickup', { item: item.name });
    }

    useInventoryItem(idx) {
        const inv = this.state.character.inventory;
        if (idx < 0 || idx >= inv.length) return;
        const item = inv[idx];

        if (item.category === 'potion') {
            this._usePotion(item);
        } else if (item.category === 'scroll') {
            this._useScroll(item);
        } else if (item.category === 'equipment') {
            // Swap with current equipment
            const slot = item.slot;
            const current = this.state.character.equipment[slot];
            this.state.character.equipment[slot] = item;

            // Reveal bonuses on first equip
            if (!item.identified) {
                item.identified = true;
                if (item.bonus !== 0) {
                    item.name = `${item.name} (${item.bonus > 0 ? '+' : ''}${item.bonus})`;
                }
                if (item.enchantment === 'cursed') {
                    this.log(`🛡️ You equip ${item.name} — ☠️ It feels cursed!`);
                } else if (item.enchantment === 'enchanted') {
                    this.log(`🛡️ You equip ${item.name} — ✨ It glows with power!`);
                } else {
                    this.log(`🛡️ You equip ${item.name}`);
                }
            } else {
                this.log(`🛡️ You equip ${item.name}`);
            }
            if (current) {
                inv[idx] = current;
                this.log(`📦 ${current.name} moved to inventory`);
            } else {
                inv.splice(idx, 1);
            }
        } else {
            this._applyGenericItem(item);
        }

        // Remove consumed items (potions/scrolls)
        if (item.category === 'potion' || item.category === 'scroll') {
            inv.splice(idx, 1);
        }
        this.notifyObservers('inventory_change', {});
    }

    dropItem(idx) {
        const inv = this.state.character.inventory;
        if (idx < 0 || idx >= inv.length) return;
        const item = inv.splice(idx, 1)[0];
        const p = this.state.player;
        item.x = p.x;
        item.y = p.y;
        this.state.items.push(item);
        this.log(`📦 You drop ${item.name}`);
        this.notifyObservers('inventory_change', {});
    }

    _usePotion(item) {
        const char = this.state.character;
        // Identify on use
        if (!item.identified && item.potionKey) {
            this.identifiedPotions.add(item.potionKey);
            const trueName = POTION_TYPES[item.potionKey].name;
            this.log(`🧪 It was a ${trueName}!`);
        }

        switch (item.effect) {
            case 'heal': {
                const healed = Math.min(item.value, char.maxHp - char.hp);
                char.hp += healed;
                this.log(`🧪 Restored ${healed} HP`);
                break;
            }
            case 'mana': {
                const restored = Math.min(item.value, char.maxMp - char.mp);
                char.mp += restored;
                this.log(`🧪 Restored ${restored} MP`);
                break;
            }
            case 'str_boost':
                char.stats.str += item.value;
                this.log(`💪 Your strength increases by ${item.value}!`);
                break;
            case 'dex_boost':
                char.stats.dex += item.value;
                this.log(`💨 Your dexterity increases by ${item.value}!`);
                break;
            case 'poison':
                char.hp += item.value; // negative
                this.log(`🤢 Poison! You lose ${-item.value} HP!`);
                if (char.hp <= 0) this._playerDeath();
                break;
            case 'speed':
                char.speed += item.value;
                this.log(`⚡ You feel faster!`);
                break;
        }
    }

    _useScroll(item) {
        switch (item.effect) {
            case 'identify':
                this.log('📜 The scroll reveals knowledge...');
                // Identify all potions in inventory
                for (const inv of this.state.character.inventory) {
                    if (inv.category === 'potion' && !inv.identified && inv.potionKey) {
                        inv.identified = true;
                        inv.name = POTION_TYPES[inv.potionKey].name;
                        this.identifiedPotions.add(inv.potionKey);
                        this.log(`  Identified: ${inv.name}`);
                    }
                }
                // Also identify visible items on ground
                for (const gi of this.state.items) {
                    if (gi.category === 'potion' && !gi.identified && gi.potionKey) {
                        gi.identified = true;
                        gi.name = POTION_TYPES[gi.potionKey].name;
                        this.identifiedPotions.add(gi.potionKey);
                    }
                }
                break;
            case 'teleport': {
                const pos = this.findRandomFloor();
                this.state.player.x = pos.x;
                this.state.player.y = pos.y;
                this.autoRun.active = false;
                this.log('📜 You are teleported!');
                this.notifyObservers('teleport', pos);
                break;
            }
            case 'magic_map':
                this.log('📜 A map materializes in your mind!');
                for (let y = 0; y < this.height; y++) {
                    for (let x = 0; x < this.width; x++) {
                        this.state.explored[y][x] = 1;
                    }
                }
                this.notifyObservers('magic_map', {});
                break;
            case 'enchant_wep': {
                const wep = this.state.character.equipment.weapon;
                if (wep) {
                    wep.atk += 2;
                    this.log(`✨ Your ${wep.name} glows brightly! ATK +2`);
                } else {
                    this.log('📜 The scroll fizzles... you have no weapon equipped.');
                }
                break;
            }
            case 'summon_bad': {
                this.log('📜 Oh no! Monsters appear!');
                for (let i = 0; i < 3; i++) {
                    const eligible = Object.entries(MONSTER_TYPES)
                        .filter(([, m]) => m.minLevel <= this.state.currentLevel && !m.boss)
                        .map(([key, m]) => ({ key, ...m }));
                    if (eligible.length === 0) break;
                    const type = eligible[Math.floor(Math.random() * eligible.length)];
                    const pos = this.findRandomFloor();
                    const id = `monster_${this.nextEntityId++}`;
                    this.state.entities[id] = {
                        id, type: 'monster', monsterType: type.key,
                        name: type.name, x: pos.x, y: pos.y,
                        hp: type.hp, maxHp: type.hp, atk: type.atk, def: type.def,
                        xp: type.xp, speed: type.speed * 10, energy: 0,
                        color: type.color, shape: type.shape,
                        ai: 'chase', boss: false, rotation: 0,
                        ability: type.ability || null, symbol: type.symbol,
                    };
                }
                break;
            }
        }
    }

    _applyGenericItem(item) {
        const char = this.state.character;
        if (item.effect === 'heal') {
            const healed = Math.min(item.value, char.maxHp - char.hp);
            char.hp += healed;
            this.log(`🧪 Used ${item.name} — restored ${healed} HP`);
        } else if (item.effect === 'mana') {
            const restored = Math.min(item.value, char.maxMp - char.mp);
            char.mp += restored;
            this.log(`🧪 Used ${item.name} — restored ${restored} MP`);
        }
    }

    // ─── Stairs ────────────────────────────────────────────────────
    _tryDescend() {
        const p = this.state.player;
        const stairs = this.state.stairs;
        if (stairs && p.x === stairs.x && p.y === stairs.y) {
            if (this.state.currentLevel < this.state.maxLevel) {
                this.log('📍 You descend deeper...');
                this.generateLevel(this.state.currentLevel + 1);
            }
        } else { this.log('There are no stairs here.'); }
    }

    _tryAscend() {
        const p = this.state.player;
        const stairs = this.state.stairsUp;
        if (stairs && p.x === stairs.x && p.y === stairs.y) {
            if (this.state.currentLevel > 1) {
                this.log('📍 You ascend upward...');
                this.generateLevel(this.state.currentLevel - 1);
            }
        } else { this.log('There are no stairs here.'); }
    }

    // ─── Spells ────────────────────────────────────────────────────
    _castSpell(spellKey) {
        const spell = SPELLS[spellKey];
        if (!spell) return;
        const char = this.state.character;
        const cd = char.spellCooldowns;
        if (cd[spellKey] > 0) { this.log(`${spell.name} is on cooldown (${cd[spellKey]} turns)`); return; }
        if (char.mp < spell.mpCost) { this.log(`Not enough mana for ${spell.name}!`); return; }
        char.mp -= spell.mpCost;
        cd[spellKey] = spell.cooldown;
        switch (spell.type) {
            case 'self': this._castHeal(spell); break;
            case 'aoe': this._castAoE(spell); break;
            case 'line': this._castLine(spell); break;
            case 'nova': this._castNova(spell); break;
        }
    }

    _castHeal(spell) {
        const char = this.state.character;
        const healAmount = spell.healAmount + Math.floor(char.stats.int * 1.5);
        char.hp = Math.min(char.maxHp, char.hp + healAmount);
        this.log(`💚 You cast Heal and restore ${healAmount} HP!`);
        this.notifyObservers('spell_cast', { spell: 'heal', x: this.state.player.x, y: this.state.player.y, color: spell.color });
    }

    _castAoE(spell) {
        const player = this.state.player;
        const target = this._findNearestMonster(player.x, player.y, spell.range);
        if (!target) {
            this.log(`No target in range for ${spell.name}!`);
            this.state.character.mp += spell.mpCost;
            this.state.character.spellCooldowns.fireball = 0;
            return;
        }
        const damage = spell.damage + Math.floor(this.state.character.stats.int * 0.8);
        this.log(`🔥 You cast ${spell.name}!`);
        this.notifyObservers('spell_cast', { spell: 'fireball', x: target.x, y: target.y, color: spell.color });
        const monsters = this._getMonstersInRadius(target.x, target.y, spell.radius);
        for (const m of monsters) {
            m.hp -= damage;
            this.log(`🔥 ${m.name} takes ${damage} fire damage!`);
            if (m.hp <= 0) this._killMonster(m);
        }
    }

    _castLine(spell) {
        const player = this.state.player;
        let dx = 0, dy = 0;
        switch (player.rotation) {
            case 0: dy = -1; break; case 90: dx = 1; break;
            case 180: dy = 1; break; case 270: dx = -1; break;
            default: dy = -1;
        }
        const damage = spell.damage + Math.floor(this.state.character.stats.int);
        this.log(`⚡ You cast ${spell.name}!`);
        const hitTiles = [];
        let cx = player.x, cy = player.y;
        for (let i = 0; i < spell.range; i++) {
            cx += dx; cy += dy;
            if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height) break;
            if (this.state.map[cy][cx] === TILE.WALL) break;
            hitTiles.push({ x: cx, y: cy });
            const monster = this._getMonsterAt(cx, cy);
            if (monster) {
                monster.hp -= damage;
                this.log(`⚡ ${monster.name} takes ${damage} lightning damage!`);
                if (monster.hp <= 0) this._killMonster(monster);
            }
        }
        this.notifyObservers('spell_cast', { spell: 'lightning', tiles: hitTiles, color: spell.color, startX: player.x, startY: player.y, dx, dy });
    }

    _castNova(spell) {
        const player = this.state.player;
        const damage = spell.damage + Math.floor(this.state.character.stats.int * 0.6);
        this.log(`❄️ You cast ${spell.name}!`);
        const monsters = this._getMonstersInRadius(player.x, player.y, spell.radius);
        this.notifyObservers('spell_cast', { spell: 'frostNova', x: player.x, y: player.y, radius: spell.radius, color: spell.color });
        for (const m of monsters) {
            m.hp -= damage;
            this.log(`❄️ ${m.name} takes ${damage} frost damage!`);
            if (m.hp <= 0) this._killMonster(m);
        }
        if (monsters.length === 0) this.log('No enemies nearby...');
    }

    // ─── Monster AI ────────────────────────────────────────────────
    _processMonsterAI(monster) {
        if (!monster) return;
        const p = this.state.player;
        const dx = p.x - monster.x;
        const dy = p.y - monster.y;
        const dist = Math.abs(dx) + Math.abs(dy);

        // Wander AI
        if (monster.ai === 'wander') {
            // Switch to chase if player visible and close
            if (dist <= 6 && this.state.visibility[monster.y] && this.state.visibility[monster.y][monster.x]) {
                monster.ai = 'chase';
            } else {
                this._monsterWander(monster);
                return;
            }
        }

        // Adjacent — attack
        if (dist <= 1) { this._monsterAttack(monster); return; }

        // Special abilities at range
        if (monster.ability === 'teleport' && dist <= 5 && Math.random() < 0.1) {
            const pos = this.findRandomFloor();
            this.state.player.x = pos.x;
            this.state.player.y = pos.y;
            this.autoRun.active = false;
            this.log(`😵 ${monster.name} teleports you away!`);
            return;
        }
        if (monster.ability === 'summon' && Math.random() < 0.05 && dist <= 8) {
            this._monsterSummon(monster);
            return;
        }

        // Chase
        const stepX = monster.x + Math.sign(dx);
        const stepY = monster.y + Math.sign(dy);
        if (this._canMonsterMove(stepX, stepY)) {
            monster.x = stepX; monster.y = stepY;
        } else if (dx !== 0 && this._canMonsterMove(monster.x + Math.sign(dx), monster.y)) {
            monster.x += Math.sign(dx);
        } else if (dy !== 0 && this._canMonsterMove(monster.x, monster.y + Math.sign(dy))) {
            monster.y += Math.sign(dy);
        } else {
            this._monsterWander(monster);
        }
    }

    _monsterSummon(monster) {
        const eligible = Object.entries(MONSTER_TYPES)
            .filter(([, m]) => m.minLevel <= this.state.currentLevel && !m.boss)
            .map(([key, m]) => ({ key, ...m }));
        if (eligible.length === 0) return;
        const type = eligible[Math.floor(Math.random() * eligible.length)];
        // Spawn adjacent to summoner
        for (const [ddx, ddy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const sx = monster.x + ddx;
            const sy = monster.y + ddy;
            if (this._canMonsterMove(sx, sy)) {
                const id = `monster_${this.nextEntityId++}`;
                this.state.entities[id] = {
                    id, type: 'monster', monsterType: type.key,
                    name: type.name, x: sx, y: sy,
                    hp: type.hp, maxHp: type.hp, atk: type.atk, def: type.def,
                    xp: type.xp, speed: type.speed * 10, energy: 0,
                    color: type.color, shape: type.shape,
                    ai: 'chase', boss: false, rotation: 0,
                    ability: type.ability || null, symbol: type.symbol,
                };
                this.log(`😈 ${monster.name} summons a ${type.name}!`);
                return;
            }
        }
    }

    _monsterWander(monster) {
        if (Math.random() < 0.3) {
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            const nx = monster.x + dir[0];
            const ny = monster.y + dir[1];
            if (this._canMonsterMove(nx, ny)) { monster.x = nx; monster.y = ny; }
        }
    }

    _canMonsterMove(x, y) {
        if (!this._isWalkable(x, y)) return false;
        const p = this.state.player;
        if (p && p.x === x && p.y === y) return false;
        return !Object.values(this.state.entities).some(e => e.type === 'monster' && e.x === x && e.y === y);
    }

    // ─── Utility ───────────────────────────────────────────────────
    _getMonsterAt(x, y) {
        return Object.values(this.state.entities).find(e => e.type === 'monster' && e.x === x && e.y === y);
    }

    _findNearestMonster(px, py, range) {
        let nearest = null, nearestDist = Infinity;
        for (const e of Object.values(this.state.entities)) {
            if (e.type !== 'monster') continue;
            const dist = Math.abs(e.x - px) + Math.abs(e.y - py);
            if (dist <= range && dist < nearestDist) { nearest = e; nearestDist = dist; }
        }
        return nearest;
    }

    _getMonstersInRadius(cx, cy, radius) {
        return Object.values(this.state.entities).filter(e => {
            if (e.type !== 'monster') return false;
            return Math.abs(e.x - cx) + Math.abs(e.y - cy) <= radius;
        });
    }

    log(message) {
        this.gameLog.push({ tick: this.state.tick, message, time: Date.now() });
        if (this.gameLog.length > 50) this.gameLog.shift();
        this.notifyObservers('log', { message });
    }

    // ─── Observer Pattern ──────────────────────────────────────────
    subscribe(callback) { this.observers.push(callback); }
    notifyObservers(event, data) { this.observers.forEach(cb => cb(event, data)); }

    // ─── Static Data Access ────────────────────────────────────────
    static getRaces() { return RACES; }
    static getClasses() { return CLASSES; }
    static getSpells() { return SPELLS; }
    static getMonsterTypes() { return MONSTER_TYPES; }
    static getLevelThemes() { return LEVEL_THEMES; }
}
