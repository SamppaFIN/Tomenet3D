
export class TutorialSystem {
    constructor(game) {
        this.game = game;
        this.active = true;
        this.currentStep = null;
        this.seenSteps = new Set();

        // Define tutorial steps
        this.steps = {
            intro: {
                id: 'intro',
                title: 'Welcome to TomeNet 3D',
                text: 'You are an adventurer exploring the depths of Angband. <br><br>Use <b>WASD</b> or <b>Arrow Keys</b> to move.',
                trigger: 'start',
                action: 'close'
            },
            movement: {
                id: 'movement',
                title: 'Exploration',
                text: 'Great! As you move, you reveal the dungeon. <br><br><b>Fog of War</b> hides unexplored areas. Monsters and items are only visible when in your line of sight.',
                trigger: 'move',
                delay: 2000,
                action: 'close'
            },
            items: {
                id: 'items',
                title: 'Items',
                text: 'You see an item on the ground! <br><br>Move onto it and press <b>G</b> to pick it up. potions will heal you or restore mana.',
                trigger: 'see_item',
                action: 'close'
            },
            combat: {
                id: 'combat',
                title: 'Combat',
                text: 'A monster is nearby! <br><br>Bump into monsters to attack them with your melee weapon. Watch your HP!',
                trigger: 'see_monster',
                action: 'close'
            },
            spells: {
                id: 'spells',
                title: 'Magic',
                text: 'You can cast spells using number keys <b>1-4</b>. <br><br>1: Fireball (Damage)<br>2: Heal (Restore HP)<br>3: Lightning (Line Attack)<br>4: Frost Nova (Area Slow)',
                trigger: 'level_2_or_mana_full', // simplified trigger logic
                action: 'close'
            },
            stairs: {
                id: 'stairs',
                title: 'Stairs',
                text: 'You found the stairs down! <br><br>Press <b>></b> (Shift+.) to descend to the next level. The dungeon gets harder the deeper you go.',
                trigger: 'see_stairs',
                action: 'close'
            }
        };

        this.modalEl = null;
        this.createDOM();

        // Subscribe to game events
        this.game.subscribe((event, data) => this.handleGameEvent(event, data));

        // Start intro immediately
        setTimeout(() => this.showStep('intro'), 1000);
    }

    createDOM() {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.7);
            display: none; align-items: center; justify-content: center;
            z-index: 1000; pointer-events: auto;
        `;

        const modal = document.createElement('div');
        modal.id = 'tutorial-modal';
        modal.className = 'hud-panel'; // Reuse existing glassmorphism style
        modal.style.cssText = `
            width: 400px; padding: 30px; text-align: center;
            border: 1px solid rgba(200,168,78,0.5);
            box-shadow: 0 0 30px rgba(0,0,0,0.8);
            transform: scale(0.9); transition: transform 0.3s ease;
        `;

        const title = document.createElement('h2');
        title.id = 'tutorial-title';
        title.style.cssText = "font-family: 'Cinzel', serif; color: #ffd700; margin-bottom: 15px;";

        const text = document.createElement('p');
        text.id = 'tutorial-text';
        text.style.cssText = "font-family: 'Inter', sans-serif; font-size: 0.9em; line-height: 1.6; color: #ddd; margin-bottom: 25px;";

        const btn = document.createElement('button');
        btn.textContent = 'Got it';
        btn.style.cssText = `
            padding: 10px 30px; font-family: 'Cinzel', serif; font-size: 0.9em;
            color: #e8d8b0; background: linear-gradient(135deg, rgba(120,80,20,0.6), rgba(80,50,10,0.4));
            border: 1px solid rgba(200,168,78,0.5); border-radius: 4px; cursor: pointer;
        `;
        btn.onclick = () => this.close();

        modal.appendChild(title);
        modal.appendChild(text);
        modal.appendChild(btn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        this.modalEl = overlay;
        this.titleEl = title;
        this.textEl = text;
    }

    showStep(stepId) {
        if (this.seenSteps.has(stepId)) return;
        const step = this.steps[stepId];
        if (!step) return;

        this.seenSteps.add(stepId);
        this.currentStep = step;

        this.titleEl.textContent = step.title;
        this.textEl.innerHTML = step.text;

        this.modalEl.style.display = 'flex';
        // Pause game input technically, but standard game loop continues (just idle)
    }

    close() {
        this.modalEl.style.display = 'none';
        this.currentStep = null;
    }

    handleGameEvent(event, data) {
        if (!this.active) return;

        switch (event) {
            case 'tick':
                // Check simple triggers only occasionally or on state change
                const p = this.game.state.player;

                // Movement trigger
                if (!this.seenSteps.has('movement') && (p.x !== p.startX || p.y !== p.startY)) {
                    // Wait a bit before showing movement tip
                    if (!this.moveTimer) {
                        this.moveTimer = setTimeout(() => this.showStep('movement'), 2000);
                    }
                }

                if (this.game.state.currentLevel === 1) {
                    this.checkVisibilityTriggers();
                }
                break;
        }
    }

    checkVisibilityTriggers() {
        const vis = this.game.state.visibility;
        const entities = this.game.state.entities;
        const items = this.game.state.items;
        const stairs = this.game.state.stairs;

        // Check for visible monster
        if (!this.seenSteps.has('combat')) {
            for (const id in entities) {
                const e = entities[id];
                if (e.type === 'monster' && vis[e.y][e.x]) {
                    this.showStep('combat');
                    break;
                }
            }
        }

        // Check for visible item
        if (!this.seenSteps.has('items')) {
            for (const item of items) {
                if (vis[item.y][item.x]) {
                    this.showStep('items');
                    break;
                }
            }
        }

        // Check for visible stairs
        if (!this.seenSteps.has('stairs') && stairs) {
            if (vis[stairs.y][stairs.x]) {
                this.showStep('stairs');
            }
        }
    }
}
