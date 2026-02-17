/**
 * DungeonGenerator.js
 * BSP-based dungeon generator with rooms, corridors, doors, traps, and secret rooms.
 */
import { TILE, TRAP_TYPES } from './GameData.js';

export class DungeonGenerator {
    /**
     * Generate a dungeon using BSP tree + room/corridor placement.
     * @param {number} width - Map width
     * @param {number} height - Map height
     * @param {number} levelNum - Dungeon depth (affects complexity)
     * @returns {{ map: number[][], rooms: {x,y,w,h}[], traps: {x,y,type,revealed}[], secretDoors: {x,y}[] }}
     */
    static generate(width, height, levelNum) {
        const map = DungeonGenerator._createSolidMap(width, height);
        const rooms = [];
        const traps = [];
        const secretDoors = [];

        // BSP split to create room areas
        const minRoomSize = 4;
        const maxRoomSize = Math.min(12, Math.floor(Math.min(width, height) / 3));
        const roomCount = Math.min(12, 4 + Math.floor(levelNum * 0.8));

        // Generate rooms
        DungeonGenerator._generateRooms(map, rooms, width, height, roomCount, minRoomSize, maxRoomSize);

        // Connect rooms with corridors
        DungeonGenerator._connectRooms(map, rooms);

        // Place doors at room entrances
        DungeonGenerator._placeDoors(map, rooms);

        // Place traps (more on deeper levels)
        const trapCount = Math.floor(1 + levelNum * 0.6);
        DungeonGenerator._placeTraps(map, rooms, traps, trapCount, levelNum);

        // Place secret rooms (chance increases with depth)
        if (levelNum >= 2 && Math.random() < 0.3 + levelNum * 0.04) {
            DungeonGenerator._placeSecretRoom(map, rooms, secretDoors, width, height);
        }

        // Place portals (rare, chance increases with depth)
        if (levelNum >= 3 && Math.random() < 0.2) {
            DungeonGenerator._placePortals(map, rooms, 1 + Math.floor(levelNum / 5));
        }

        return { map, rooms, traps, secretDoors };
    }

    static _createSolidMap(width, height) {
        return Array.from({ length: height }, () => Array(width).fill(TILE.WALL));
    }

    static _generateRooms(map, rooms, mapW, mapH, count, minSize, maxSize) {
        let attempts = 0;
        while (rooms.length < count && attempts < 200) {
            attempts++;
            const w = minSize + Math.floor(Math.random() * (maxSize - minSize + 1));
            const h = minSize + Math.floor(Math.random() * (maxSize - minSize + 1));
            const x = 1 + Math.floor(Math.random() * (mapW - w - 2));
            const y = 1 + Math.floor(Math.random() * (mapH - h - 2));

            // Check overlap with existing rooms (with 1-tile buffer)
            const overlaps = rooms.some(r =>
                x - 1 < r.x + r.w && x + w + 1 > r.x &&
                y - 1 < r.y + r.h && y + h + 1 > r.y
            );
            if (overlaps) continue;

            // Carve room
            for (let ry = y; ry < y + h && ry < mapH - 1; ry++) {
                for (let rx = x; rx < x + w && rx < mapW - 1; rx++) {
                    map[ry][rx] = TILE.FLOOR;
                }
            }
            rooms.push({ x, y, w, h });
        }
    }

    static _connectRooms(map, rooms) {
        // Connect each room to the next with an L-shaped corridor
        for (let i = 0; i < rooms.length - 1; i++) {
            const a = rooms[i];
            const b = rooms[i + 1];
            const ax = Math.floor(a.x + a.w / 2);
            const ay = Math.floor(a.y + a.h / 2);
            const bx = Math.floor(b.x + b.w / 2);
            const by = Math.floor(b.y + b.h / 2);

            // Randomly choose horizontal-first or vertical-first
            if (Math.random() < 0.5) {
                DungeonGenerator._carveHCorridor(map, ax, bx, ay);
                DungeonGenerator._carveVCorridor(map, ay, by, bx);
            } else {
                DungeonGenerator._carveVCorridor(map, ay, by, ax);
                DungeonGenerator._carveHCorridor(map, ax, bx, by);
            }
        }

        // Extra corridors for connectivity (connect some random room pairs)
        const extraCorridors = Math.floor(rooms.length * 0.3);
        for (let i = 0; i < extraCorridors; i++) {
            const a = rooms[Math.floor(Math.random() * rooms.length)];
            const b = rooms[Math.floor(Math.random() * rooms.length)];
            if (a === b) continue;
            const ax = Math.floor(a.x + a.w / 2);
            const ay = Math.floor(a.y + a.h / 2);
            const bx = Math.floor(b.x + b.w / 2);
            const by = Math.floor(b.y + b.h / 2);
            DungeonGenerator._carveHCorridor(map, ax, bx, ay);
            DungeonGenerator._carveVCorridor(map, ay, by, bx);
        }
    }

    static _carveHCorridor(map, x1, x2, y) {
        const start = Math.min(x1, x2);
        const end = Math.max(x1, x2);
        for (let x = start; x <= end; x++) {
            if (y > 0 && y < map.length - 1 && x > 0 && x < map[0].length - 1) {
                if (map[y][x] === TILE.WALL) {
                    map[y][x] = TILE.FLOOR;
                }
            }
        }
    }

    static _carveVCorridor(map, y1, y2, x) {
        const start = Math.min(y1, y2);
        const end = Math.max(y1, y2);
        for (let y = start; y <= end; y++) {
            if (y > 0 && y < map.length - 1 && x > 0 && x < map[0].length - 1) {
                if (map[y][x] === TILE.WALL) {
                    map[y][x] = TILE.FLOOR;
                }
            }
        }
    }

    static _placeDoors(map, rooms) {
        // Place doors where corridors meet room edges
        for (const room of rooms) {
            // Check each edge tile of the room
            for (let x = room.x; x < room.x + room.w; x++) {
                DungeonGenerator._tryPlaceDoor(map, x, room.y - 1, x, room.y);
                DungeonGenerator._tryPlaceDoor(map, x, room.y + room.h, x, room.y + room.h - 1);
            }
            for (let y = room.y; y < room.y + room.h; y++) {
                DungeonGenerator._tryPlaceDoor(map, room.x - 1, y, room.x, y);
                DungeonGenerator._tryPlaceDoor(map, room.x + room.w, y, room.x + room.w - 1, y);
            }
        }
    }

    static _tryPlaceDoor(map, corridorX, corridorY, roomX, roomY) {
        if (corridorY < 0 || corridorY >= map.length || corridorX < 0 || corridorX >= map[0].length) return;
        if (roomY < 0 || roomY >= map.length || roomX < 0 || roomX >= map[0].length) return;

        // If the corridor tile is floor and room tile is floor, the tile between might be a good door spot
        if (map[corridorY][corridorX] === TILE.FLOOR && map[roomY][roomX] === TILE.FLOOR) {
            // Only place door where there's a narrow passage (walls on both sides perpendicular)
            const dx = corridorX - roomX;
            const dy = corridorY - roomY;
            if (dx !== 0) {
                // Horizontal passage — check walls above and below
                const cy = corridorY;
                const cx = corridorX;
                if (cy > 0 && cy < map.length - 1) {
                    const above = map[cy - 1][cx];
                    const below = map[cy + 1][cx];
                    if (above === TILE.WALL && below === TILE.WALL && Math.random() < 0.5) {
                        map[cy][cx] = TILE.DOOR_CLOSED;
                    }
                }
            } else if (dy !== 0) {
                const cy = corridorY;
                const cx = corridorX;
                if (cx > 0 && cx < map[0].length - 1) {
                    const left = map[cy][cx - 1];
                    const right = map[cy][cx + 1];
                    if (left === TILE.WALL && right === TILE.WALL && Math.random() < 0.5) {
                        map[cy][cx] = TILE.DOOR_CLOSED;
                    }
                }
            }
        }
    }

    static _placeTraps(map, rooms, traps, count, levelNum) {
        const trapKeys = Object.keys(TRAP_TYPES);
        let placed = 0;
        let attempts = 0;

        while (placed < count && attempts < 100) {
            attempts++;
            // Place traps in corridors or rooms
            const room = rooms[Math.floor(Math.random() * rooms.length)];
            const x = room.x + Math.floor(Math.random() * room.w);
            const y = room.y + Math.floor(Math.random() * room.h);

            if (map[y][x] === TILE.FLOOR) {
                const trapKey = trapKeys[Math.floor(Math.random() * trapKeys.length)];
                map[y][x] = TILE.TRAP_HIDDEN;
                traps.push({ x, y, type: trapKey, revealed: false });
                placed++;
            }
        }
    }

    static _placeSecretRoom(map, rooms, secretDoors, mapW, mapH) {
        // Try to attach a secret room to an existing room
        for (let attempt = 0; attempt < 20; attempt++) {
            const room = rooms[Math.floor(Math.random() * rooms.length)];

            // Pick a wall side
            const side = Math.floor(Math.random() * 4); // 0=north, 1=south, 2=west, 3=east
            const secretW = 3 + Math.floor(Math.random() * 3);
            const secretH = 3 + Math.floor(Math.random() * 3);
            let sx, sy, doorX, doorY;

            switch (side) {
                case 0: // north
                    sx = room.x + Math.floor(Math.random() * Math.max(1, room.w - secretW));
                    sy = room.y - secretH - 1;
                    doorX = sx + Math.floor(secretW / 2);
                    doorY = room.y - 1;
                    break;
                case 1: // south
                    sx = room.x + Math.floor(Math.random() * Math.max(1, room.w - secretW));
                    sy = room.y + room.h + 1;
                    doorX = sx + Math.floor(secretW / 2);
                    doorY = room.y + room.h;
                    break;
                case 2: // west
                    sx = room.x - secretW - 1;
                    sy = room.y + Math.floor(Math.random() * Math.max(1, room.h - secretH));
                    doorX = room.x - 1;
                    doorY = sy + Math.floor(secretH / 2);
                    break;
                case 3: // east
                    sx = room.x + room.w + 1;
                    sy = room.y + Math.floor(Math.random() * Math.max(1, room.h - secretH));
                    doorX = room.x + room.w;
                    doorY = sy + Math.floor(secretH / 2);
                    break;
            }

            // Bounds check
            if (sx < 1 || sy < 1 || sx + secretW >= mapW - 1 || sy + secretH >= mapH - 1) continue;
            if (doorX < 1 || doorY < 1 || doorX >= mapW - 1 || doorY >= mapH - 1) continue;

            // Check that secret room area is all walls (available space)
            let canPlace = true;
            for (let y = sy; y < sy + secretH; y++) {
                for (let x = sx; x < sx + secretW; x++) {
                    if (map[y][x] !== TILE.WALL) { canPlace = false; break; }
                }
                if (!canPlace) break;
            }
            if (!canPlace) continue;

            // Carve secret room
            for (let y = sy; y < sy + secretH; y++) {
                for (let x = sx; x < sx + secretW; x++) {
                    map[y][x] = TILE.FLOOR;
                }
            }

            // Place secret door
            map[doorY][doorX] = TILE.SECRET_WALL;
            secretDoors.push({ x: doorX, y: doorY });
            rooms.push({ x: sx, y: sy, w: secretW, h: secretH, secret: true });
            break;
        }
    }

    /**
     * Find a random floor tile in the map.
     */
    static findRandomFloor(map, width, height) {
        let attempts = 0;
        while (attempts < 1000) {
            const x = 1 + Math.floor(Math.random() * (width - 2));
            const y = 1 + Math.floor(Math.random() * (height - 2));
            if (map[y][x] === TILE.FLOOR) return { x, y };
            attempts++;
        }
        // Fallback: find first floor
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                if (map[y][x] === TILE.FLOOR) return { x, y };
            }
        }
        return { x: 1, y: 1 };
    }

    /**
     * Find a random floor tile inside a specific room.
     */
    static findFloorInRoom(map, room) {
        for (let attempt = 0; attempt < 50; attempt++) {
            const x = room.x + Math.floor(Math.random() * room.w);
            const y = room.y + Math.floor(Math.random() * room.h);
            if (map[y][x] === TILE.FLOOR) return { x, y };
        }
        return { x: room.x, y: room.y };
    }

    static _placePortals(map, rooms, count) {
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < 50) {
            attempts++;
            const room = rooms[Math.floor(Math.random() * rooms.length)];
            const x = room.x + Math.floor(Math.random() * room.w);
            const y = room.y + Math.floor(Math.random() * room.h);
            if (map[y][x] === TILE.FLOOR) {
                map[y][x] = TILE.PORTAL;
                placed++;
            }
        }
    }
}
