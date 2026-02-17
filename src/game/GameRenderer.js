/**
 * GameRenderer.js
 * Full 3D renderer for the roguelike RPG, inspired by TomeNET.
 * Renders: themed dungeons, monsters with unique shapes, spell effects,
 * items, stairs, HP bars, and smooth camera following.
 */
import * as THREE from 'three';
import { TILE, TRAP_TYPES } from './GameData.js';
import { Oloid3D } from '../controls/Oloid3D.js';
import { Gomboc3D } from '../controls/Gomboc3D.js';

export class GameRenderer {
    constructor(scene, camera, game) {
        this.scene = scene;
        this.camera = camera;
        this.game = game;

        // Camera settings
        this.cameraOffset = new THREE.Vector3(0, 18, 16); // Default isometric offset
        this.cameraLookOffset = new THREE.Vector3(0, 0, 0);

        this.cameraLookOffset = new THREE.Vector3(0, 0, 0);

        this.tileSize = 1.5;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.initInteraction();
        this.gridOffset = {
            x: -(game.width * this.tileSize) / 2,
            z: -(game.height * this.tileSize) / 2
        };

        this.entityMeshes = {};   // id -> THREE.Group
        this.entityMeshes = {};   // id -> THREE.Group
        this.wallInstances = null; // THREE.InstancedMesh
        this.wallData = [];       // { gx, gy, matrix, color }
        this.floorMesh = null;
        this.itemMeshes = {};     // id -> THREE.Mesh
        this.doorMeshes = [];     // THREE.Mesh[]
        this.trapMeshes = [];     // THREE.Mesh[]
        this.stairsMeshDown = null;
        this.stairsMeshUp = null;
        this.spellEffects = [];   // temporary visual effects
        this.hpBars = {};         // id -> THREE.Group (floating bars)
        this.ambientLight = null;
        this.pointLight = null;
        this.currentTheme = null;

        // Camera follow settings
        this.cameraTarget = new THREE.Vector3(0, 15, 20);
        this.cameraLookTarget = new THREE.Vector3(0, 0, 0);

        // Scene fog for atmosphere + performance
        this.scene.fog = new THREE.FogExp2(0x060610, 0.035);
        this.scene.background = new THREE.Color(0x060610);

        this.initLights();
        this.renderMap();

        // Subscribe to game events
        this.game.subscribe((event, data) => this.handleGameEvent(event, data));
    }

    // ─── Coordinate Conversion ──────────────────────────────────────
    get3DPos(gx, gy) {
        return new THREE.Vector3(
            this.gridOffset.x + gx * this.tileSize,
            0,
            this.gridOffset.z + gy * this.tileSize
        );
    }

    /** Convert screen pixel (clientX, clientY) → grid {x, y} or null */
    getGridFromScreen(clientX, clientY) {
        const canvas = document.getElementById('canvas');
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(ndc, this.camera);
        // Intersect Y=0 ground plane
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(plane, hit)) return null;
        const gx = Math.round((hit.x - this.gridOffset.x) / this.tileSize);
        const gy = Math.round((hit.z - this.gridOffset.z) / this.tileSize);
        if (gx < 0 || gx >= this.game.width || gy < 0 || gy >= this.game.height) return null;
        return { x: gx, y: gy };
    }

    // ─── Lighting ───────────────────────────────────────────────────
    initLights() {
        this.ambientLight = new THREE.AmbientLight(0x1a1a3a, 0.6);
        this.scene.add(this.ambientLight);

        const dirLight = new THREE.DirectionalLight(0xaabbcc, 0.4);
        dirLight.position.set(10, 25, 10);
        this.scene.add(dirLight);

        // Player torch light
        this.pointLight = new THREE.PointLight(0xffaa44, 1.2, 12);
        this.pointLight.position.set(0, 3, 0);
        this.pointLight.castShadow = false; // Disable for performance
        this.scene.add(this.pointLight);
    }

    setTheme(theme) {
        if (!theme) return;
        this.currentTheme = theme;
        if (this.ambientLight) {
            this.ambientLight.color.setHex(theme.ambientColor);
        }
    }

    // ─── Map Rendering ──────────────────────────────────────────────
    clearScene() {
        // Remove walls
        if (this.wallInstances) {
            this.scene.remove(this.wallInstances);
            this.wallInstances.dispose();
            this.wallInstances = null;
        }
        this.wallData = [];

        // Remove floor
        if (this.floorMesh) {
            this.scene.remove(this.floorMesh);
            this.floorMesh = null;
        }

        // Remove entities
        Object.values(this.entityMeshes).forEach(g => this.scene.remove(g));
        this.entityMeshes = {};

        // Remove items
        Object.values(this.itemMeshes).forEach(m => this.scene.remove(m));
        this.itemMeshes = {};

        // Remove doors
        this.doorMeshes.forEach(m => this.scene.remove(m));
        this.doorMeshes = [];

        // Remove traps
        this.trapMeshes.forEach(m => this.scene.remove(m));
        this.trapMeshes = [];

        // Remove portals
        if (this.portalMeshes) {
            this.portalMeshes.forEach(m => this.scene.remove(m));
            this.portalMeshes = [];
        }

        // Remove stairs
        if (this.stairsMeshDown) { this.scene.remove(this.stairsMeshDown); this.stairsMeshDown = null; }
        if (this.stairsMeshUp) { this.scene.remove(this.stairsMeshUp); this.stairsMeshUp = null; }

        // Remove HP bars
        Object.values(this.hpBars).forEach(g => this.scene.remove(g));
        this.hpBars = {};

        // Remove spell effects
        this.spellEffects.forEach(e => this.scene.remove(e.mesh));
        this.spellEffects = [];
    }

    renderMap() {
        this.clearScene();

        const map = this.game.state.map;
        const levelNum = this.game.state.currentLevel;
        const themes = this.game.constructor.getLevelThemes();
        const theme = themes[levelNum - 1] || themes[0];
        this.setTheme(theme);

        // Walls - Instanced Rendering (walls + secret walls)
        const wallAppears = [];
        const doorPositions = [];
        const trapPositions = [];
        const portalPositions = [];
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                const tile = map[y][x];
                if (tile === TILE.WALL || tile === TILE.SECRET_WALL) {
                    wallAppears.push({ x, y });
                } else if (tile === TILE.DOOR_CLOSED || tile === TILE.DOOR_OPEN) {
                    doorPositions.push({ x, y, open: tile === TILE.DOOR_OPEN });
                } else if (tile === TILE.TRAP_REVEALED) {
                    trapPositions.push({ x, y });
                } else if (tile === TILE.PORTAL) {
                    portalPositions.push({ x, y });
                }
            }
        }

        if (wallAppears.length > 0) {
            const wallGeo = new THREE.BoxGeometry(this.tileSize, this.tileSize * 1.2, this.tileSize);
            const wallMat = new THREE.MeshStandardMaterial({
                color: theme.wallColor,
                roughness: 0.7,
                metalness: 0.3,
            });

            this.wallInstances = new THREE.InstancedMesh(wallGeo, wallMat, wallAppears.length);
            this.wallInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

            const dummy = new THREE.Object3D();
            const color = new THREE.Color();

            wallAppears.forEach((w, i) => {
                const pos = this.get3DPos(w.x, w.y);
                dummy.position.set(pos.x, this.tileSize * 0.6, pos.z);
                dummy.updateMatrix();

                this.wallInstances.setMatrixAt(i, dummy.matrix);

                // Variation
                const brightness = 0.85 + Math.random() * 0.3;
                color.setHex(theme.wallColor).multiplyScalar(brightness);
                this.wallInstances.setColorAt(i, color);

                this.wallData[i] = {
                    gx: w.x,
                    gy: w.y,
                    matrix: dummy.matrix.clone(),
                    baseColor: color.clone()
                };
            });

            this.scene.add(this.wallInstances);
        }

        // Floor
        const floorGeo = new THREE.PlaneGeometry(
            this.game.width * this.tileSize,
            this.game.height * this.tileSize
        );
        const floorMat = new THREE.MeshStandardMaterial({
            color: theme.floorColor,
            side: THREE.DoubleSide,
            roughness: 0.9,
            metalness: 0.1,
        });
        this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
        this.floorMesh.rotation.x = -Math.PI / 2;
        this.floorMesh.position.set(0, -0.05, 0);
        this.scene.add(this.floorMesh);

        // Render doors
        this.renderDoors(doorPositions, theme);

        // Render revealed traps
        this.renderTraps(trapPositions);

        // Render portals
        this.renderPortals(portalPositions);

        // Render stairs
        this.renderStairs();

        // Render items
        this.renderItems();

        // Render entities (player + monsters)
        this.updateEntities();
    }

    // ─── Doors ──────────────────────────────────────────────────────
    renderDoors(doorPositions, theme) {
        const doorGeo = new THREE.BoxGeometry(this.tileSize * 0.15, this.tileSize * 1.0, this.tileSize * 0.8);
        const doorMat = new THREE.MeshStandardMaterial({
            color: 0x8B6914,
            roughness: 0.6,
            metalness: 0.3,
            emissive: 0x331100,
            emissiveIntensity: 0.2,
        });

        for (const d of doorPositions) {
            const pos = this.get3DPos(d.x, d.y);
            const mesh = new THREE.Mesh(doorGeo, doorMat.clone());
            mesh.position.set(pos.x, this.tileSize * 0.5, pos.z);
            // Determine door orientation by checking neighboring walls
            const map = this.game.state.map;
            const wallAbove = d.y > 0 && (map[d.y - 1][d.x] === TILE.WALL || map[d.y - 1][d.x] === TILE.SECRET_WALL);
            const wallBelow = d.y < this.game.height - 1 && (map[d.y + 1][d.x] === TILE.WALL || map[d.y + 1][d.x] === TILE.SECRET_WALL);
            if (wallAbove || wallBelow) {
                mesh.rotation.y = Math.PI / 2; // Rotate for N-S walls
            }
            if (d.open) {
                mesh.rotation.y += Math.PI / 4; // Swing open
                mesh.material.opacity = 0.6;
                mesh.material.transparent = true;
            }
            mesh.userData = { type: 'door', gx: d.x, gy: d.y };
            this.scene.add(mesh);
            this.doorMeshes.push(mesh);
        }
    }

    // ─── Traps ──────────────────────────────────────────────────────
    renderTraps(trapPositions) {
        for (const t of trapPositions) {
            const pos = this.get3DPos(t.x, t.y);
            // Find trap info
            const trapInfo = this.game.traps ? this.game.traps.find(tr => tr.x === t.x && tr.y === t.y) : null;
            const trapColor = trapInfo && TRAP_TYPES[trapInfo.type] ? TRAP_TYPES[trapInfo.type].color : 0xff4444;
            const geo = new THREE.RingGeometry(0.15, 0.35, 6);
            const mat = new THREE.MeshBasicMaterial({
                color: trapColor,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.7,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(pos.x, 0.05, pos.z);
            mesh.userData = { type: 'trap', gx: t.x, gy: t.y };
            this.scene.add(mesh);
            this.trapMeshes.push(mesh);
        }
    }

    // ─── Portals ────────────────────────────────────────────────────
    renderPortals(portalPositions) {
        if (!this.portalMeshes) this.portalMeshes = [];
        for (const p of portalPositions) {
            const pos = this.get3DPos(p.x, p.y);
            // Use Oloid3D for portals
            const oloid = new Oloid3D(this.scene, this.camera, [pos.x, 0.5, pos.z], {
                radius: 0.5,
                color: 0xcc44ff,
                materialType: 'neon',
                autoRotate: true,
                rotationSpeed: 0.02
            });
            oloid.group.userData = { type: 'portal', gx: p.x, gy: p.y };
            this.portalMeshes.push(oloid.group);
            // Oloid3D constructor adds it to the scene via super()
        }
    }

    // ─── Stairs ─────────────────────────────────────────────────────
    renderStairs() {
        const state = this.game.state;

        // Stairs down
        if (state.stairs) {
            const pos = this.get3DPos(state.stairs.x, state.stairs.y);
            const group = new THREE.Group();

            const baseGeo = new THREE.CylinderGeometry(0.5, 0.7, 0.3, 6);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x886644, emissive: 0x221100, emissiveIntensity: 0.5 });
            const base = new THREE.Mesh(baseGeo, baseMat);
            base.position.y = 0.15;
            group.add(base);

            // Arrow pointing down
            const arrowGeo = new THREE.ConeGeometry(0.25, 0.4, 4);
            const arrowMat = new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 0.8 });
            const arrow = new THREE.Mesh(arrowGeo, arrowMat);
            arrow.position.y = 0.5;
            arrow.rotation.x = Math.PI; // point down
            group.add(arrow);

            group.position.set(pos.x, 0, pos.z);
            group.userData = { type: 'stairs', direction: 'down', desc: 'Stairs leading deeper into the dungeon.' };
            this.scene.add(group);
            this.stairsMeshDown = group;
        }

        // Stairs up
        if (state.stairsUp) {
            const pos = this.get3DPos(state.stairsUp.x, state.stairsUp.y);
            const group = new THREE.Group();

            const baseGeo = new THREE.CylinderGeometry(0.5, 0.7, 0.3, 6);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x4488aa, emissive: 0x113344, emissiveIntensity: 0.5 });
            const base = new THREE.Mesh(baseGeo, baseMat);
            base.position.y = 0.15;
            group.add(base);

            const arrowGeo = new THREE.ConeGeometry(0.25, 0.4, 4);
            const arrowMat = new THREE.MeshStandardMaterial({ color: 0x44ccff, emissive: 0x0088cc, emissiveIntensity: 0.8 });
            const arrow = new THREE.Mesh(arrowGeo, arrowMat);
            arrow.position.y = 0.5;
            group.add(arrow);

            group.position.set(pos.x, 0, pos.z);
            group.userData = { type: 'stairs', direction: 'up', desc: 'Stairs leading back to surface.' };
            this.scene.add(group);
            this.stairsMeshUp = group;
        }
    }

    // ─── Items ──────────────────────────────────────────────────────
    renderItems() {
        // Clear old item meshes
        Object.values(this.itemMeshes).forEach(m => this.scene.remove(m));
        this.itemMeshes = {};

        for (const item of this.game.state.items) {
            this.createItemMesh(item);
        }
    }

    createItemMesh(item) {
        const pos = this.get3DPos(item.x, item.y);
        const geo = new THREE.OctahedronGeometry(0.2);
        const mat = new THREE.MeshStandardMaterial({
            color: item.color,
            emissive: item.color,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.9,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, 0.4, pos.z);
        mesh.userData = { itemId: item.id, bobOffset: Math.random() * Math.PI * 2 };
        this.scene.add(mesh);
        this.itemMeshes[item.id] = mesh;
    }

    // ─── Entity Rendering ───────────────────────────────────────────
    updateEntities() {
        const state = this.game.state;

        // Track which entities still exist
        const existingIds = new Set();

        // Render player
        if (state.player) {
            existingIds.add(state.player.id);
            this.updatePlayerMesh(state.player);
        }

        // Render monsters
        for (const entity of Object.values(state.entities)) {
            if (entity.type === 'monster') {
                existingIds.add(entity.id);
                this.updateMonsterMesh(entity);
            }
        }

        // Remove meshes for dead entities
        for (const id of Object.keys(this.entityMeshes)) {
            if (!existingIds.has(id)) {
                this.scene.remove(this.entityMeshes[id]);
                delete this.entityMeshes[id];
                if (this.hpBars[id]) {
                    this.scene.remove(this.hpBars[id]);
                    delete this.hpBars[id];
                }
            }
        }

        // Update items (remove picked up items)
        const gameItemIds = new Set(state.items.map(i => i.id));
        for (const id of Object.keys(this.itemMeshes)) {
            if (!gameItemIds.has(id)) {
                this.scene.remove(this.itemMeshes[id]);
                delete this.itemMeshes[id];
            }
        }
        // Add new items
        for (const item of state.items) {
            if (!this.itemMeshes[item.id]) {
                this.createItemMesh(item);
            }
        }
    }

    updatePlayerMesh(player) {
        let group = this.entityMeshes[player.id];
        const targetPos = this.get3DPos(player.x, player.y);

        if (!group) {
            group = new THREE.Group();

            // Player body — glowing Olloid-inspired shape
            const bodyGeo = new THREE.SphereGeometry(0.45, 16, 12);
            // Deform to make it Olloid-like
            const positions = bodyGeo.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);
                const z = positions.getZ(i);
                positions.setX(i, x * (1 + 0.3 * Math.sin(y * 3)));
                positions.setZ(i, z * (1 + 0.2 * Math.cos(y * 2)));
            }
            bodyGeo.computeVertexNormals();

            const race = this.game.constructor.getRaces()[this.game.charRace];
            const playerColor = race ? race.color : 0x00ffcc;

            const bodyMat = new THREE.MeshStandardMaterial({
                color: 0xffd700, // Gold/Heroic
                emissive: 0xffaa00,
                emissiveIntensity: 0.8, // Brighter
                metalness: 0.8,
                roughness: 0.2,
            });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.5;
            group.add(body);

            // UserData
            group.userData = { type: 'player', id: player.id };

            // Wireframe overlay
            const wireGeo = new THREE.SphereGeometry(0.5, 8, 6);
            const wireMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                wireframe: true,
                transparent: true,
                opacity: 0.15,
            });
            const wire = new THREE.Mesh(wireGeo, wireMat);
            wire.position.y = 0.5;
            group.add(wire);

            group.position.copy(targetPos);
            this.scene.add(group);
            this.entityMeshes[player.id] = group;

            // Hero Light
            const heroLight = new THREE.PointLight(0xffaa00, 2, 8);
            heroLight.position.y = 1;
            group.add(heroLight);
            this.heroLight = heroLight;
        } else {
            // Smooth lerp to target
            group.position.lerp(targetPos, 0.3);
        }

        // Update camera & torch to follow player
        this.updateCamera(targetPos);
    }

    updateCamera(playerPos) {
        // Isometric-style camera following with offset
        this.cameraTarget.copy(playerPos).add(this.cameraOffset);
        this.cameraLookTarget.copy(playerPos).add(this.cameraLookOffset);

        this.camera.position.lerp(this.cameraTarget, 0.08);
        this.camera.lookAt(this.cameraLookTarget);

        // Update torch light
        if (this.pointLight) {
            this.pointLight.position.set(playerPos.x, 3, playerPos.z);
        }
    }

    updateMonsterMesh(monster) {
        let group = this.entityMeshes[monster.id];
        const targetPos = this.get3DPos(monster.x, monster.y);

        if (!group) {
            group = this.createMonsterGeometry(monster);
            group.position.copy(targetPos);
            group.userData = { type: 'monster', id: monster.id, entity: monster }; // Add entity data for raycasting
            this.scene.add(group);
            this.entityMeshes[monster.id] = group;
        } else {
            // Smooth movement
            group.position.lerp(targetPos, 0.25);
        }

        // Update HP bar
        this.updateHPBar(monster, group.position);
    }

    createMonsterGeometry(monster) {
        const group = new THREE.Group();
        let geo;
        const size = monster.boss ? 0.7 : 0.4;

        switch (monster.shape) {
            case 'sphere':
                geo = new THREE.SphereGeometry(size, 12, 8);
                break;
            case 'icosahedron':
                geo = new THREE.IcosahedronGeometry(size);
                break;
            case 'dodecahedron':
                geo = new THREE.DodecahedronGeometry(size);
                break;
            case 'octahedron':
                geo = new THREE.OctahedronGeometry(size);
                break;
            case 'tetrahedron':
                geo = new THREE.TetrahedronGeometry(size);
                break;
            case 'torusknot':
                geo = new THREE.TorusKnotGeometry(size * 0.6, size * 0.2, 32, 8);
                break;
            case 'cone':
                geo = new THREE.ConeGeometry(size, size * 2, 8);
                break;
            case 'dragon':
                // Use larger, more complex geometry for bosses/dragons
                geo = new THREE.IcosahedronGeometry(size * 1.5, 1);
                // Deform it to look more menacing
                const positions = geo.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const y = positions.getY(i);
                    const scale = 1 + 0.4 * Math.sin(y * 2);
                    positions.setX(i, positions.getX(i) * scale);
                    positions.setZ(i, positions.getZ(i) * scale);
                }
                geo.computeVertexNormals();
                break;
            case 'oloid': {
                const oloid = new Oloid3D(null, null, [0, 0, 0], { radius: size });
                const mesh = oloid.group.children[0];
                geo = mesh.geometry.clone();
                break;
            }
            case 'gomboc': {
                const gomboc = new Gomboc3D(null, null, [0, 0, 0], { radius: size });
                const mesh = gomboc.group.children[0];
                geo = mesh.geometry.clone();
                break;
            }
            default:
                geo = new THREE.BoxGeometry(size, size, size);
        }

        const mat = new THREE.MeshStandardMaterial({
            color: monster.color,
            emissive: monster.color,
            emissiveIntensity: monster.boss ? 0.6 : 0.3,
            metalness: 0.4,
            roughness: 0.5,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = size + 0.1;
        group.add(mesh);

        // Boss glow ring
        if (monster.boss) {
            const ringGeo = new THREE.TorusGeometry(0.8, 0.05, 8, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xff4400,
                transparent: true,
                opacity: 0.6,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.1;
            group.add(ring);
        }

        group.userData = { monsterType: monster.monsterType, rotSpeed: 0.5 + Math.random() * 1.5 };
        return group;
    }

    // ─── HP Bars ────────────────────────────────────────────────────
    updateHPBar(monster, worldPos) {
        let bar = this.hpBars[monster.id];
        const hpRatio = Math.max(0, monster.hp / monster.maxHp);

        if (!bar) {
            bar = new THREE.Group();

            // Background
            const bgGeo = new THREE.PlaneGeometry(1.0, 0.1);
            const bgMat = new THREE.MeshBasicMaterial({ color: 0x330000, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
            const bg = new THREE.Mesh(bgGeo, bgMat);
            bar.add(bg);

            // Fill
            const fillGeo = new THREE.PlaneGeometry(1.0, 0.08);
            const fillMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
            const fill = new THREE.Mesh(fillGeo, fillMat);
            fill.name = 'hpFill';
            bar.add(fill);

            this.scene.add(bar);
            this.hpBars[monster.id] = bar;
        }

        // Update position (float above monster)
        bar.position.set(worldPos.x, 1.8, worldPos.z);
        // Always face camera
        bar.lookAt(this.camera.position);

        // Update fill width
        const fill = bar.getObjectByName('hpFill');
        if (fill) {
            fill.scale.x = hpRatio;
            fill.position.x = -(1 - hpRatio) * 0.5;

            // Color gradient: green -> yellow -> red
            if (hpRatio > 0.6) fill.material.color.setHex(0x44ff44);
            else if (hpRatio > 0.3) fill.material.color.setHex(0xffcc00);
            else fill.material.color.setHex(0xff3333);
        }
    }

    // ─── Spell Effects ──────────────────────────────────────────────
    createSpellEffect(data) {
        if (data.spell === 'fireball') {
            this.createFireballEffect(data);
        } else if (data.spell === 'heal') {
            this.createHealEffect(data);
        } else if (data.spell === 'lightning') {
            this.createLightningEffect(data);
        } else if (data.spell === 'frostNova') {
            this.createFrostNovaEffect(data);
        }
    }

    createFireballEffect(data) {
        const pos = this.get3DPos(data.x, data.y);
        const geo = new THREE.SphereGeometry(0.5, 12, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.9,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, 1, pos.z);
        this.scene.add(mesh);

        // Point light for dramatic effect
        const light = new THREE.PointLight(0xff4400, 3, 8);
        light.position.copy(mesh.position);
        this.scene.add(light);

        this.spellEffects.push({
            mesh, light, startTime: Date.now(), duration: 600,
            animate: (t) => {
                const scale = 1 + t * 2;
                mesh.scale.setScalar(scale);
                mesh.material.opacity = 1 - t;
                light.intensity = 3 * (1 - t);
            }
        });
    }

    createHealEffect(data) {
        const pos = this.get3DPos(data.x, data.y);
        const particles = new THREE.Group();

        for (let i = 0; i < 12; i++) {
            const geo = new THREE.SphereGeometry(0.08);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x44ff88,
                transparent: true,
                opacity: 0.9,
            });
            const p = new THREE.Mesh(geo, mat);
            p.userData = {
                angle: (i / 12) * Math.PI * 2,
                speed: 1 + Math.random(),
                radius: 0.3 + Math.random() * 0.3,
            };
            p.position.set(pos.x, 0.5, pos.z);
            particles.add(p);
        }

        this.scene.add(particles);
        this.spellEffects.push({
            mesh: particles, startTime: Date.now(), duration: 800,
            animate: (t) => {
                particles.children.forEach(p => {
                    const d = p.userData;
                    p.position.y = 0.5 + t * 2;
                    p.position.x = pos.x + Math.cos(d.angle + t * d.speed * 5) * d.radius;
                    p.position.z = pos.z + Math.sin(d.angle + t * d.speed * 5) * d.radius;
                    p.material.opacity = 1 - t;
                });
            }
        });
    }

    createLightningEffect(data) {
        if (!data.tiles || data.tiles.length === 0) return;

        const points = [this.get3DPos(data.startX, data.startY)];
        for (const tile of data.tiles) {
            const p = this.get3DPos(tile.x, tile.y);
            p.y = 0.8;
            points.push(p);
        }
        points[0].y = 0.8;

        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({
            color: 0xffff44,
            transparent: true,
            opacity: 1,
            linewidth: 3,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        this.scene.add(line);

        const light = new THREE.PointLight(0xffff00, 4, 10);
        const midTile = data.tiles[Math.floor(data.tiles.length / 2)];
        const midPos = this.get3DPos(midTile.x, midTile.y);
        light.position.set(midPos.x, 2, midPos.z);
        this.scene.add(light);

        this.spellEffects.push({
            mesh: line, light, startTime: Date.now(), duration: 400,
            animate: (t) => {
                line.material.opacity = 1 - t;
                light.intensity = 4 * (1 - t);
            }
        });
    }

    createFrostNovaEffect(data) {
        const pos = this.get3DPos(data.x, data.y);
        const geo = new THREE.RingGeometry(0.2, data.radius * this.tileSize, 32);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x00ccff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(pos.x, 0.1, pos.z);
        this.scene.add(ring);

        this.spellEffects.push({
            mesh: ring, startTime: Date.now(), duration: 700,
            animate: (t) => {
                ring.scale.setScalar(1 + t * 1.5);
                ring.material.opacity = 0.8 * (1 - t);
            }
        });
    }

    // ─── Death Effect ───────────────────────────────────────────────
    createDeathEffect(monsterId) {
        const group = this.entityMeshes[monsterId];
        if (!group) return;

        const worldPos = group.position.clone();
        const particles = new THREE.Group();

        for (let i = 0; i < 8; i++) {
            const geo = new THREE.TetrahedronGeometry(0.1);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffaa00,
                transparent: true,
                opacity: 1,
            });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(worldPos);
            p.position.y = 0.5;
            p.userData = {
                vx: (Math.random() - 0.5) * 3,
                vy: 1 + Math.random() * 2,
                vz: (Math.random() - 0.5) * 3,
            };
            particles.add(p);
        }
        this.scene.add(particles);

        this.spellEffects.push({
            mesh: particles, startTime: Date.now(), duration: 600,
            animate: (t) => {
                particles.children.forEach(p => {
                    p.position.x += p.userData.vx * 0.02;
                    p.position.y += (p.userData.vy - t * 5) * 0.02;
                    p.position.z += p.userData.vz * 0.02;
                    p.material.opacity = 1 - t;
                    p.scale.setScalar(1 - t * 0.5);
                });
            }
        });
    }

    // ─── Event Handler ──────────────────────────────────────────────
    handleGameEvent(event, data) {
        switch (event) {
            case 'tick':
                this.updateEntities();
                break;
            case 'level_change':
                this.renderMap();
                if (data.theme) this.setTheme(data.theme);
                break;
            case 'spell_cast':
                this.createSpellEffect(data);
                break;
            case 'monster_killed':
                this.createDeathEffect(data.monster);
                break;
            case 'combat':
                if (data.type === 'melee') {
                    this.flashEntity(data.defender);
                } else if (data.type === 'monster_attack') {
                    this.flashPlayer();
                }
                break;
            case 'door_open':
            case 'secret_found':
            case 'trap_triggered':
            case 'magic_map':
            case 'teleport':
                this.renderMap(); // Re-render to reflect changed tiles
                break;
            case 'game_over':
                // Optional: dramatic camera effect
                break;
        }
    }

    flashEntity(entityId) {
        const group = this.entityMeshes[entityId];
        if (!group) return;
        group.traverse(child => {
            if (child.isMesh && child.material) {
                const origEmissive = child.material.emissiveIntensity;
                child.material.emissiveIntensity = 2;
                setTimeout(() => { child.material.emissiveIntensity = origEmissive; }, 150);
            }
        });
    }

    flashPlayer() {
        const player = this.game.state.player;
        if (!player) return;
        this.flashEntity(player.id);
    }

    resetCamera() {
        this.cameraOffset.set(0, 18, 16); // Reset to default isometric
        this.cameraLookOffset.set(0, 0, 0);

        // Snap immediately? Or lerp?
        // If we want instant reset:
        if (this.game.state.player) {
            const p = this.game.state.player;
            const targetPos = this.get3DPos(p.x, p.y);
            this.camera.position.copy(targetPos).add(this.cameraOffset);
            this.camera.lookAt(targetPos);
        }
    }

    // ─── Interaction ────────────────────────────────────────────────
    initInteraction() {
        window.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            this.updateTooltip(event.clientX, event.clientY);
        });
    }

    updateTooltip(clientX, clientY) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        const tooltip = document.getElementById('tooltip');
        let hoverObj = null;

        for (const hit of intersects) {
            // Traverse up to find object with userData
            let obj = hit.object;
            while (obj && !obj.userData.type) {
                obj = obj.parent;
            }
            if (obj && obj.userData.type) {
                hoverObj = obj;
                break;
            }
        }

        if (hoverObj) {
            const data = hoverObj.userData;
            let html = '';

            if (data.type === 'monster') {
                const monster = this.game.state.entities[data.id];
                if (monster) {
                    html = `<h3>${monster.name}</h3>
                            <div class="stat"><span>HP</span><span>${monster.hp}/${monster.maxHp}</span></div>
                            <div class="stat"><span>Level</span><span>${Math.floor(monster.maxHp / 10)}</span></div>
                            <div class="desc">${monster.ai === 'chase' ? 'Aggressive' : 'Wandering'}</div>`;
                }
            } else if (data.type === 'player') {
                const p = this.game.state.character;
                html = `<h3>${p.name || 'Hero'}</h3>
                        <div class="stat"><span>HP</span><span>${p.hp}/${p.maxHp}</span></div>
                        <div class="stat"><span>MP</span><span>${p.mp}/${p.maxMp}</span></div>
                        <div class="stat"><span>XP</span><span>${p.xp}</span></div>`;
            } else if (data.type === 'item') {
                const item = data.item;
                html = `<h3>${item.name}</h3>
                        <div class="desc">${item.effect === 'heal' ? 'Restores HP' : 'Restores MP'}</div>`;
            } else if (data.type === 'stairs') {
                html = `<h3>Stairs ${data.direction === 'down' ? 'Down' : 'Up'}</h3>
                        <div class="desc">${data.desc}</div>`;
            }

            if (html) {
                tooltip.innerHTML = html;
                tooltip.style.display = 'block';
                tooltip.style.left = (clientX + 15) + 'px';
                tooltip.style.top = (clientY + 15) + 'px';
            } else {
                tooltip.style.display = 'none';
            }
        } else {
            tooltip.style.display = 'none';
        }
    }

    // ─── Animation Loop ─────────────────────────────────────────────
    update() {
        const now = Date.now();

        // Animate spell effects
        for (let i = this.spellEffects.length - 1; i >= 0; i--) {
            const effect = this.spellEffects[i];
            const elapsed = now - effect.startTime;
            const t = Math.min(1, elapsed / effect.duration);

            if (effect.animate) effect.animate(t);

            if (t >= 1) {
                this.scene.remove(effect.mesh);
                if (effect.light) this.scene.remove(effect.light);
                this.spellEffects.splice(i, 1);
            }
        }

        // Animate monsters (rotation)
        for (const [id, group] of Object.entries(this.entityMeshes)) {
            if (id.startsWith('monster_') && group.userData.rotSpeed) {
                group.children[0].rotation.y += group.userData.rotSpeed * 0.01;
            }
        }

        // Animate items (bobbing)
        for (const mesh of Object.values(this.itemMeshes)) {
            const offset = mesh.userData.bobOffset || 0;
            mesh.position.y = 0.4 + Math.sin(now * 0.003 + offset) * 0.1;
            mesh.rotation.y += 0.02;
        }

        // Animate stairs
        if (this.stairsMeshDown) {
            this.stairsMeshDown.children.forEach(c => { c.rotation.y += 0.02; });
        }
        if (this.stairsMeshUp) {
            this.stairsMeshUp.children.forEach(c => { c.rotation.y += 0.02; });
        }

        // ── Fog of War visibility ────────────────────────────────────
        this.updateFogOfWar();
    }

    // ─── Fog of War Rendering ────────────────────────────────────────
    updateFogOfWar() {
        const vis = this.game.state.visibility;
        const expl = this.game.state.explored;
        if (!vis || !vis.length) return;

        // Walls: InstancedMesh processing
        if (this.wallInstances) {
            const dummy = new THREE.Object3D();
            const hiddenScale = new THREE.Vector3(0, 0, 0);
            const normalScale = new THREE.Vector3(1, 1, 1);
            let needsUpdate = false;

            this.wallData.forEach((d, i) => {
                const isVis = vis[d.gy] && vis[d.gy][d.gx];
                const isExpl = expl[d.gy] && expl[d.gy][d.gx];

                if (isVis) {
                    // Visible: full brightness
                    this.wallInstances.setColorAt(i, d.baseColor);
                    // Ensure visible (reset matrix from hidden state if needed)
                    // We can just rely on matrix being correct or reset it.
                    // For performance, we check strict state changes ideally, but here just setting it is fine.
                    this.wallInstances.setMatrixAt(i, d.matrix);
                } else if (isExpl) {
                    // Explored: dimmed
                    const dimColor = d.baseColor.clone().multiplyScalar(0.4);
                    this.wallInstances.setColorAt(i, dimColor);
                    this.wallInstances.setMatrixAt(i, d.matrix);
                } else {
                    // Hidden: scale to 0
                    dummy.position.set(0, -100, 0); // Move away
                    dummy.scale.set(0, 0, 0);
                    dummy.updateMatrix();
                    this.wallInstances.setMatrixAt(i, dummy.matrix);
                }
            });

            this.wallInstances.instanceMatrix.needsUpdate = true;
            if (this.wallInstances.instanceColor) this.wallInstances.instanceColor.needsUpdate = true;
        }

        // Monsters: only visible when in LOS
        for (const [id, group] of Object.entries(this.entityMeshes)) {
            if (id.startsWith('monster_')) {
                const entity = this.game.state.entities[id];
                if (entity) {
                    const isVis = vis[entity.y] && vis[entity.y][entity.x];
                    group.visible = !!isVis;
                    // HP bars
                    if (this.hpBars[id]) {
                        this.hpBars[id].visible = !!isVis;
                    }
                }
            }
        }

        // Items: only visible when in LOS or explored
        for (const item of this.game.state.items) {
            const mesh = this.itemMeshes[item.id];
            if (mesh) {
                const isVis = vis[item.y] && vis[item.y][item.x];
                const isExpl = expl[item.y] && expl[item.y][item.x];
                if (isVis) {
                    mesh.visible = true;
                    mesh.material.opacity = 0.9;
                } else if (isExpl) {
                    mesh.visible = true;
                    mesh.material.opacity = 0.3;
                } else {
                    mesh.visible = false;
                }
            }
        }

        // Stairs: only visible when explored
        if (this.stairsMeshDown && this.game.state.stairs) {
            const s = this.game.state.stairs;
            const isVis = vis[s.y] && vis[s.y][s.x];
            const isExpl = expl[s.y] && expl[s.y][s.x];
            this.stairsMeshDown.visible = !!(isVis || isExpl);
        }
        if (this.stairsMeshUp && this.game.state.stairsUp) {
            const s = this.game.state.stairsUp;
            const isVis = vis[s.y] && vis[s.y][s.x];
            const isExpl = expl[s.y] && expl[s.y][s.x];
            this.stairsMeshUp.visible = !!(isVis || isExpl);
        }

        // Doors: visible when explored
        for (const mesh of this.doorMeshes) {
            const gx = mesh.userData.gx;
            const gy = mesh.userData.gy;
            const isVis = vis[gy] && vis[gy][gx];
            const isExpl = expl[gy] && expl[gy][gx];
            mesh.visible = !!(isVis || isExpl);
            if (mesh.material) {
                mesh.material.opacity = isVis ? 1.0 : 0.4;
                mesh.material.transparent = !isVis;
            }
        }

        // Traps: only visible when explored or in LOS
        for (const mesh of this.trapMeshes) {
            const gx = mesh.userData.gx;
            const gy = mesh.userData.gy;
            const isVis = vis[gy] && vis[gy][gx];
            const isExpl = expl[gy] && expl[gy][gx];
            mesh.visible = !!(isVis || isExpl);
        }
    }
}
