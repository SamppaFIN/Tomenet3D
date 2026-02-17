import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { ControlRegistry } from './ControlRegistry.js';
import { getHTMLOverlay } from '../utils/HTMLOverlay.js';
import { MarkdownRenderer } from '../utils/MarkdownRenderer.js';

export class BaseControl3D {
    constructor(scene, camera, position = [0, 0, 0], config = {}) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = config.renderer || null;
        this.position = position;
        this.config = config;

        // Create group for the control
        this.group = new THREE.Group();
        this.group.position.set(...position);

        // State System (New Standard)
        this.state = {
            // Core Identity
            id: this.controlId,
            type: this.constructor.name,

            // Dimensions (Standardized)
            width: config.width || 1.0,
            height: config.height || 1.0,
            depth: config.depth || 0.1,

            // Visuals
            visible: true,
            opacity: 1.0,
            style: config.style || 'default',

            // Custom Data (Merge config)
            ...config
        };

        // Event System
        this.events = {}; // { 'click': [cb1, cb2] }

        // Legacy State (Keep for compat, but sync where possible)
        this.isHovered = false;
        this.isPressed = false;
        this.isEnabled = config.enabled !== false;
        this.isEditMode = false;

        // TransformControls
        this.transformControls = null;

        // Callbacks
        this.onClickCallback = config.onClick || null;
        this.onHoverCallback = config.onHover || null;
        this.onHoverLeaveCallback = config.onHoverLeave || null;

        // Raycasting setup
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Double-click detection
        this.lastClickTime = 0;
        this.doubleClickDelay = 500; // Increased to 500ms for better reliability
        this.onDoubleClickCallback = config.onDoubleClick || null;

        // Tooltip and label configuration
        this.controlId = config.controlId || `control_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.tooltipConfig = config.tooltip || null;
        this.labelConfig = config.labelConfig || null;
        this.tooltipOverlayId = `tooltip_${this.controlId}`;
        this.labelOverlayId = `label_${this.controlId}`;

        // Create the control mesh (override in subclasses)
        this.create();

        // Add to scene
        this.scene.add(this.group);

        // Setup TransformControls if renderer is available
        if (this.renderer) {
            this.setupTransformControls();
        }

        // Register with ControlRegistry
        ControlRegistry.register(this);

        // Setup event listeners
        this.setupEventListeners();

        // Setup tooltip and label overlays
        this.setupTooltipAndLabel();
    }

    update() {
        this.updateVisualState();
    }

    // --- 1. Standard Data Interface ---

    /**
     * Set a property and trigger updates.
     * @param {string} key - Property name
     * @param {any} value - New value
     * @param {Object} options - { silent: boolean }
     */
    set(key, value, options = {}) {
        if (this.state[key] === value) return; // No change

        const oldValue = this.state[key];
        this.state[key] = value;

        if (options.silent) return;

        // Notify internal handler
        this.onStateChange(key, value, oldValue);

        // Emit generic change event
        this.emit('change', { key, value, oldValue });

        // Trigger visual update
        this.updateVisualState();
    }

    /**
     * Get a property value.
     * @param {string} key 
     */
    get(key) {
        return this.state[key];
    }

    /**
     * Virtual method: Handle state changes. Override in subclasses.
     */
    onStateChange(key, value, oldValue) {
        if (key === 'label' || key === 'content') {
            if (this.labelConfig) {
                this.labelConfig.content = value;
                const htmlOverlay = getHTMLOverlay();
                htmlOverlay.updateContent(this.labelOverlayId, MarkdownRenderer.render(value));
            }
        }

        if (key === 'labelConfig') {
            this.labelConfig = value;
            const htmlOverlay = getHTMLOverlay();
            htmlOverlay.removeOverlay(this.labelOverlayId);
            this.createLabel();
        }

        if (key === 'tooltipConfig') {
            this.tooltipConfig = value;
            const htmlOverlay = getHTMLOverlay();
            htmlOverlay.removeOverlay(this.tooltipOverlayId);
            this.createTooltip();
        }
    }


    // --- 2. Event System ---

    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    }

    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    emit(event, data = {}) {
        if (this.events[event]) {
            this.events[event].forEach(cb => cb(data, this));
        }

        // Integrity check for Legacy Callbacks
        if (event === 'click' && this.onClickCallback) this.onClickCallback(this);
        if (event === 'hover' && this.onHoverCallback) this.onHoverCallback(this);
        if (event === 'hover-leave' && this.onHoverLeaveCallback) this.onHoverLeaveCallback(this);
        if (event === 'dblclick' && this.onDoubleClickCallback) this.onDoubleClickCallback(this);
    }


    // --- 3. Serialization ---

    toJSON() {
        return {
            id: this.controlId,
            type: this.constructor.name,
            position: this.group.position.toArray(),
            rotation: this.group.rotation.toArray(),
            scale: this.group.scale.toArray(),
            state: { ...this.state } // Copy state
        };
    }

    fromJSON(data) {
        if (data.position) this.group.position.fromArray(data.position);
        if (data.rotation) this.group.rotation.fromArray(data.rotation);
        if (data.scale) this.group.scale.fromArray(data.scale);

        // Merge state
        if (data.state) {
            Object.keys(data.state).forEach(key => {
                this.set(key, data.state[key]);
            });
        }
    }

    create() {
        // Override in subclasses
        // Should create mesh and add to this.group
    }

    setupEventListeners() {
        // Store bound handlers for proper removal
        this._onMouseMove = this.onMouseMove.bind(this);
        this._onMouseClick = this.onMouseClick.bind(this);
        this._onMouseDown = this.onMouseDown.bind(this);
        this._onMouseUp = this.onMouseUp.bind(this);
        this._onTouchStart = this.onTouchStart.bind(this);
        this._onTouchEnd = this.onTouchEnd.bind(this);

        // Mouse move for hover effects
        window.addEventListener('mousemove', this._onMouseMove);

        // Click for selection and interactions
        window.addEventListener('click', this._onMouseClick);

        // Standard mouse events
        window.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mouseup', this._onMouseUp);

        // Touch events
        window.addEventListener('touchstart', this._onTouchStart);
        window.addEventListener('touchend', this._onTouchEnd);
    }

    getMousePosition(event, canvas) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1
        };
    }

    checkIntersection(camera, event) {
        const canvas = event.target?.closest('canvas') || document.querySelector('canvas');
        if (!canvas || !camera) return null;

        const mousePos = this.getMousePosition(event, canvas);
        const mouse = new THREE.Vector2(mousePos.x, mousePos.y);
        this.raycaster.setFromCamera(mouse, camera);

        // Check intersection with control's meshes
        const intersects = this.raycaster.intersectObjects(this.group.children, true);
        if (intersects.length > 0) {
            const intersection = intersects[0];
            // Check if it's a mode button
            if (intersection.object.userData.isModeButton) {
                return { ...intersection, isModeButton: true };
            }
            return intersection;
        }
        return null;
    }

    onMouseMove(event) {
        if (!this.isEnabled || !this.camera) return;

        const intersect = this.checkIntersection(this.camera, event);
        if (intersect) {
            if (!this.isHovered) {
                this.isHovered = true;
                this.onHover();
            }
        } else {
            if (this.isHovered) {
                this.isHovered = false;
                this.onHoverLeave();
            }
        }
    }

    onMouseClick(event) {
        if (!this.isEnabled || !this.camera) return;

        const intersect = this.checkIntersection(this.camera, event);
        if (intersect) {
            // Check for double-click
            const currentTime = Date.now();
            const timeSinceLastClick = currentTime - this.lastClickTime;

            if (timeSinceLastClick < this.doubleClickDelay && this.lastClickTime > 0) {
                // Double-click detected - cancel pending single click
                if (this.clickTimeout) {
                    clearTimeout(this.clickTimeout);
                    this.clickTimeout = null;
                }
                this.handleDoubleClick(intersect);
                this.lastClickTime = 0; // Reset to prevent triple-click
            } else {
                // Schedule single click with delay to allow double-click detection
                this.lastClickTime = currentTime;
                if (this.clickTimeout) {
                    clearTimeout(this.clickTimeout);
                }
                this.clickTimeout = setTimeout(() => {
                    this.handleClick(intersect);
                    this.clickTimeout = null;
                }, this.doubleClickDelay);
            }
        }
    }

    handleDoubleClick(intersect) {
        this.emit('dblclick', { type: 'dblclick', intersect });
        this.onDoubleClick(intersect);
    }

    onDoubleClick(intersect) {
        // Default: Focus camera and open 2D overlay
        if (this.scene && this.camera) {
            this.focusCamera();
            this.open2DOverlay();
        }
    }
    handleClick(intersect) {
        this.emit('click', { type: 'click', intersect });
    }

    /**
     * Open a 2D overlay for this control
     */
    open2DOverlay() {
        if (this.isOverlayOpen) return;

        // Create container
        const container = document.createElement('div');
        container.className = 'spatial-2d-overlay';
        container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(10, 10, 26, 0.98);
            border: 2px solid #00d4ff;
            border-radius: 16px;
            padding: 30px;
            z-index: 1000;
            box-shadow: 0 0 50px rgba(0, 212, 255, 0.2), inset 0 0 20px rgba(0, 212, 255, 0.1);
            width: 90%;
            max-width: 600px;
            max-height: 85vh;
            overflow-y: auto;
            font-family: 'Inter', sans-serif;
            color: white;
            scrollbar-width: thin;
            scrollbar-color: #00d4ff rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
        `;

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '10px';
        closeBtn.style.right = '15px';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.color = 'rgba(255, 255, 255, 0.6)';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = () => this.close2DOverlay();

        // Content container
        const contentDiv = document.createElement('div');
        const content = this.get2DContent();

        if (content instanceof HTMLElement) {
            contentDiv.appendChild(content);
        } else {
            contentDiv.innerHTML = content;
        }

        container.appendChild(closeBtn);
        container.appendChild(contentDiv);

        document.body.appendChild(container);
        this.overlayElement = container;
        this.isOverlayOpen = true;

        // Add backdrop
        this.backdrop = document.createElement('div');
        this.backdrop.style.position = 'fixed';
        this.backdrop.style.top = '0';
        this.backdrop.style.left = '0';
        this.backdrop.style.width = '100%';
        this.backdrop.style.height = '100%';
        this.backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.backdrop.style.zIndex = '999';
        this.backdrop.style.backdropFilter = 'blur(4px)';
        this.backdrop.onclick = () => this.close2DOverlay();
        document.body.appendChild(this.backdrop);

        this.emit('overlay-open');
    }

    close2DOverlay() {
        if (!this.isOverlayOpen) return;

        if (this.overlayElement) {
            document.body.removeChild(this.overlayElement);
            this.overlayElement = null;
        }

        if (this.backdrop) {
            document.body.removeChild(this.backdrop);
            this.backdrop = null;
        }

        this.isOverlayOpen = false;
        this.emit('overlay-close');
    }

    get2DContent() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 20px;
            font-family: 'Inter', sans-serif;
            color: white;
        `;

        // Title Area
        const header = document.createElement('div');
        header.style.cssText = `
            border-bottom: 2px solid rgba(0, 212, 255, 0.3);
            padding-bottom: 10px;
            margin-bottom: 10px;
        `;
        header.innerHTML = `
            <h2 style="margin:0; color:#00d4ff; font-size: 1.4em; display:flex; align-items:center; gap:10px;">
                <span>🧊</span> ${this.constructor.name}
            </h2>
            <small style="color:rgba(255,255,255,0.5)">ID: ${this.controlId}</small>
        `;
        container.appendChild(header);

        // Properties Grid
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 12px;
            align-items: center;
        `;

        const addRow = (label, element) => {
            const lbl = document.createElement('label');
            lbl.innerText = label;
            lbl.style.cssText = 'font-size: 0.85em; color: rgba(255,255,255,0.7); font-weight: 500;';
            grid.appendChild(lbl);
            grid.appendChild(element);
        };

        const createInput = (value, onChange) => {
            const input = document.createElement('input');
            input.value = value;
            input.style.cssText = `
                background: rgba(0,0,0,0.4);
                border: 1px solid rgba(255,255,255,0.1);
                color: white;
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 0.9em;
                outline: none;
                width: 100%;
                box-sizing: border-box;
            `;
            input.onchange = (e) => onChange(e.target.value);
            input.onfocus = () => input.style.border = '1px solid #00d4ff';
            input.onblur = () => input.style.border = '1px solid rgba(255,255,255,0.1)';
            return input;
        };

        // Basic Info
        addRow('Label/Name', createInput(this.state.label || this.state.title || 'unnamed', (val) => {
            this.set('label', val);
            if (this.setLabel) this.setLabel(val);
        }));

        addRow('Scale', createInput(this.group.scale.x, (val) => {
            const s = parseFloat(val);
            if (!isNaN(s)) this.group.scale.set(s, s, s);
        }));

        // Status Indicators
        const statusRow = document.createElement('div');
        statusRow.style.cssText = 'grid-column: span 2; display: flex; gap: 10px; margin-top: 10px;';

        const createBadge = (text, active) => {
            const badge = document.createElement('span');
            badge.innerText = text;
            badge.style.cssText = `
                font-size: 0.7em;
                padding: 4px 8px;
                border-radius: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                background: ${active ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255,255,255,0.05)'};
                color: ${active ? '#4ecdc4' : '#666'};
                border: 1px solid ${active ? '#4ecdc4' : 'transparent'};
            `;
            return badge;
        };

        statusRow.appendChild(createBadge('Interactive', this.isEnabled));
        statusRow.appendChild(createBadge('Visible', this.state.visible));
        statusRow.appendChild(createBadge('3D Primed', true));

        grid.appendChild(statusRow);
        container.appendChild(grid);

        // Footer Actions
        const footer = document.createElement('div');
        footer.style.cssText = 'margin-top: 20px; display: flex; gap: 10px;';

        const btn = document.createElement('button');
        btn.innerText = 'Reset Transform';
        btn.style.cssText = `
            flex: 1;
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.8em;
        `;
        btn.onclick = () => {
            this.group.position.set(...this.position);
            this.group.rotation.set(0, 0, 0);
            this.group.scale.set(1, 1, 1);
        };
        footer.appendChild(btn);

        container.appendChild(footer);

        return container;
    }

    /**
     * Focus camera on this control, showing its front side centered in view
     */
    focusCamera() {
        if (!this.camera || !this.scene) return;

        // Calculate bounding box of the control
        const box = new THREE.Box3().setFromObject(this.group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Calculate distance needed to fit object in view
        // Use the largest dimension to ensure object fits comfortably
        const maxDim = Math.max(size.x, size.y, size.z);

        // Calculate distance based on camera FOV and object size
        // Formula: distance = (objectSize / 2) / tan(FOV / 2) * padding
        const fov = this.camera.fov * (Math.PI / 180); // Convert to radians
        const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.5; // 1.5x padding for comfortable view

        // Ensure minimum distance
        const minDistance = Math.max(distance, maxDim * 2);

        // Calculate camera position in front of object
        // Front is typically negative Z direction in world space
        // Position camera slightly above center for better viewing angle
        const cameraOffset = new THREE.Vector3(0, size.y * 0.2, minDistance);
        const targetPosition = center.clone().add(cameraOffset);

        // Animate camera to focus position
        this.animateCameraToFocus(targetPosition, center);
    }

    /**
     * Animate camera smoothly to focus position
     */
    animateCameraToFocus(targetPosition, lookAt) {
        if (!this.camera || !this.scene) return;

        const startPosition = this.camera.position.clone();
        const startTarget = ControlRegistry.orbitControls
            ? ControlRegistry.orbitControls.target.clone()
            : lookAt.clone();

        const duration = 1000; // milliseconds
        const startTime = Date.now();

        // Get OrbitControls reference for smooth animation
        const orbitControls = ControlRegistry.orbitControls;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-in-out cubic)
            const eased = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            // Interpolate camera position
            this.camera.position.lerpVectors(startPosition, targetPosition, eased);

            // Update OrbitControls target (where camera looks)
            if (orbitControls) {
                orbitControls.target.lerpVectors(startTarget, lookAt, eased);
                orbitControls.update();
            } else {
                // Fallback: use lookAt directly
                this.camera.lookAt(lookAt);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Ensure final position is exact
                this.camera.position.copy(targetPosition);
                if (orbitControls) {
                    orbitControls.target.copy(lookAt);
                    orbitControls.update();
                } else {
                    this.camera.lookAt(lookAt);
                }
            }
        };

        animate();
    }

    onMouseDown(event) {
        if (!this.isEnabled || !this.camera) return;

        const intersect = this.checkIntersection(this.camera, event);
        if (intersect) {
            this.isPressed = true;
            this.onPress();
        }
    }

    onMouseUp(event) {
        if (this.isPressed) {
            this.isPressed = false;
            this.onRelease();
        }
    }

    onTouchStart(event) {
        if (!this.isEnabled) return;
        event.preventDefault();
        const touch = event.touches[0];
        const syntheticEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            target: event.target
        };
        this.onMouseDown(syntheticEvent);
    }

    onTouchEnd(event) {
        event.preventDefault();
        this.onMouseUp(event);
    }

    handleClick() {
        this.emit('click', { type: 'click' });
        this.onClick();
    }

    onClick() {
        // Override in subclasses
    }

    onPress() {
        // Override in subclasses
    }

    onRelease() {
        // Override in subclasses
    }

    onHover() {
        this.emit('hover', { type: 'hover' });
        // Show tooltip on hover
        if (this.tooltipConfig) {
            this.updateTooltipVisibility(true);
        }
    }

    onHoverLeave() {
        this.emit('hover-leave', { type: 'hover-leave' });
        // Hide tooltip when hover leaves
        if (this.tooltipConfig) {
            this.updateTooltipVisibility(false);
        }
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.updateVisualState();
    }

    updateVisualState() {
        // Override in subclasses to update visual appearance
        // Update tooltip and label positions
        this.updateTooltipAndLabelPositions();
    }

    /**
     * Setup tooltip and label HTML overlays
     */
    setupTooltipAndLabel() {
        // Delay creation to ensure HTMLOverlay is initialized
        setTimeout(() => {
            const htmlOverlay = getHTMLOverlay();

            // Create tooltip if configured
            if (this.tooltipConfig && this.tooltipConfig.content) {
                this.createTooltip();
            }

            // Create label if configured
            if (this.labelConfig && this.labelConfig.content) {
                this.createLabel();
            }
        }, 100);
    }

    /**
     * Create tooltip HTML overlay
     */
    createTooltip() {
        if (!this.tooltipConfig || !this.tooltipConfig.content) return;

        const htmlOverlay = getHTMLOverlay();
        const htmlContent = MarkdownRenderer.render(this.tooltipConfig.content);

        // Create tooltip element
        const tooltipElement = document.createElement('div');
        tooltipElement.className = 'spatial-tooltip';
        tooltipElement.innerHTML = htmlContent;

        // Calculate position offset
        const offset = this.tooltipConfig.offset || this.getDefaultTooltipOffset();
        const position = new THREE.Vector3(
            this.group.position.x + offset[0],
            this.group.position.y + offset[1],
            this.group.position.z + offset[2]
        );

        // Create overlay - hidden by default, shown on hover
        // Use small scale for CSS3DRenderer (HTML elements need tiny scale in 3D space)
        htmlOverlay.createOverlay(this.tooltipOverlayId, tooltipElement, position, {
            className: 'spatial-tooltip',
            scale: [0.01, 0.01, 0.01], // Scale down for CSS3DRenderer
            styles: {
                opacity: '0',
                transition: 'opacity 0.2s ease-in-out'
            }
        });

        // Hidden by default
        htmlOverlay.setVisible(this.tooltipOverlayId, false);
    }

    /**
     * Create label HTML overlay
     */
    createLabel() {
        if (!this.labelConfig || !this.labelConfig.content) return;

        const htmlOverlay = getHTMLOverlay();
        const htmlContent = MarkdownRenderer.render(this.labelConfig.content);

        // Create label element
        const labelElement = document.createElement('div');
        labelElement.className = 'spatial-label';
        labelElement.innerHTML = htmlContent;

        // Calculate position offset
        const offset = this.labelConfig.offset || this.getDefaultLabelOffset();
        const position = new THREE.Vector3(
            this.group.position.x + offset[0],
            this.group.position.y + offset[1],
            this.group.position.z + offset[2]
        );

        // Create overlay
        htmlOverlay.createOverlay(this.labelOverlayId, labelElement, position, {
            className: 'spatial-label',
            scale: [0.01, 0.01, 0.01] // Scale down for CSS3DRenderer
        });
    }

    /**
     * Get default tooltip offset based on position option
     */
    getDefaultTooltipOffset() {
        const position = this.tooltipConfig.position || 'top';
        const defaultOffsets = {
            'top': [0, 1.0, 0],
            'bottom': [0, -1.0, 0],
            'left': [-1.5, 0, 0],
            'right': [1.5, 0, 0]
        };
        return defaultOffsets[position] || defaultOffsets['top'];
    }

    /**
     * Get default label offset based on position option
     */
    getDefaultLabelOffset() {
        const position = this.labelConfig.position || 'bottom';
        const defaultOffsets = {
            'top': [0, 1.2, 0],
            'bottom': [0, -1.2, 0]
        };
        return defaultOffsets[position] || defaultOffsets['bottom'];
    }

    /**
     * Update tooltip visibility
     */
    updateTooltipVisibility(visible) {
        if (!this.tooltipConfig) return;

        const htmlOverlay = getHTMLOverlay();
        htmlOverlay.setVisible(this.tooltipOverlayId, visible);

        // Animate opacity
        const overlay = htmlOverlay.objects.get(this.tooltipOverlayId);
        if (overlay && overlay.element) {
            overlay.element.style.opacity = visible ? '1' : '0';
        }
    }

    /**
     * Update tooltip and label positions based on control position
     */
    updateTooltipAndLabelPositions() {
        const htmlOverlay = getHTMLOverlay();

        // Update tooltip position
        if (this.tooltipConfig) {
            const offset = this.tooltipConfig.offset || this.getDefaultTooltipOffset();
            // Add small Z-offset to ensure tooltip appears in front of control
            const tooltipZOffset = 0.1; // Small offset to bring tooltip forward
            const position = new THREE.Vector3(
                this.group.position.x + offset[0],
                this.group.position.y + offset[1],
                this.group.position.z + offset[2] + tooltipZOffset
            );
            htmlOverlay.updatePosition(this.tooltipOverlayId, position);
        }

        // Update label position
        if (this.labelConfig) {
            const offset = this.labelConfig.offset || this.getDefaultLabelOffset();
            const position = new THREE.Vector3(
                this.group.position.x + offset[0],
                this.group.position.y + offset[1],
                this.group.position.z + offset[2]
            );
            htmlOverlay.updatePosition(this.labelOverlayId, position);
        }
    }

    /**
     * Update label using OpenAI API
     * @param {string} apiKey - OpenAI API key
     * @param {string} prompt - Prompt for label generation
     * @param {Function} onSuccess - Callback when label is generated successfully
     * @param {Function} onError - Callback when error occurs
     * @returns {Promise<string>} - Generated label text
     */
    async updateLabelWithAI(apiKey, prompt, onSuccess, onError) {
        if (!apiKey) {
            const error = new Error('OpenAI API key is required');
            if (onError) onError(error);
            throw error;
        }

        if (!prompt) {
            const error = new Error('Prompt is required');
            if (onError) onError(error);
            throw error;
        }

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    max_tokens: 20,
                    temperature: 0.8
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            const newLabel = data.choices[0].message.content.trim();

            // Update label if this control has one
            if (this.label !== undefined) {
                this.label = newLabel;
            }

            // Update label config if it exists
            if (this.labelConfig) {
                this.labelConfig.content = newLabel;
                // Recreate label overlay with new content
                const htmlOverlay = getHTMLOverlay();
                htmlOverlay.removeOverlay(this.labelOverlayId);
                this.createLabel();
            }

            if (onSuccess) onSuccess(newLabel);
            return newLabel;

        } catch (error) {
            console.error('OpenAI API error:', error);
            if (onError) onError(error);
            throw error;
        }
    }


    getGroup() {
        return this.group;
    }

    getPosition() {
        return this.group.position.clone();
    }

    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
        // Update TransformControls position if it exists
        if (this.transformControls) {
            this.transformControls.update();
        }
        // Update tooltip and label positions
        this.updateTooltipAndLabelPositions();
    }

    setupTransformControls() {
        if (!this.renderer) return;

        // Create TransformControls for translation (XYZ handles)
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.setMode('translate'); // Translation mode (XYZ arrows)
        this.transformControls.setSpace('world'); // World space coordinates
        this.transformControls.attach(this.group);
        this.transformControls.visible = false; // Hidden by default

        // Store event handlers for proper cleanup
        this.onDraggingChanged = (event) => {
            const orbitControls = ControlRegistry.orbitControls;
            if (orbitControls) {
                orbitControls.enabled = !event.value;
            }
        };

        this.onTransformChange = () => {
            // Position is automatically updated via attach()
            // This event fires during dragging
        };

        // Coordinate with OrbitControls: disable OrbitControls when dragging TransformControls
        this.transformControls.addEventListener('dragging-changed', this.onDraggingChanged);

        // Update position when TransformControls changes
        this.transformControls.addEventListener('change', this.onTransformChange);

        // Add to scene
        this.scene.add(this.transformControls);
    }

    showTransformControls() {
        if (this.transformControls) {
            // Re-attach to group if needed
            if (!this.transformControls.object) {
                this.transformControls.attach(this.group);
            }
            this.transformControls.visible = true;
            this.transformControls.update();
        }
    }

    hideTransformControls() {
        if (this.transformControls) {
            this.transformControls.visible = false;
            // Detach from group to prevent any update issues
            this.transformControls.detach();
            // Ensure OrbitControls is re-enabled when hiding TransformControls
            const orbitControls = ControlRegistry.orbitControls;
            if (orbitControls) {
                orbitControls.enabled = true;
            }
        }
    }

    setEditMode(enabled) {
        this.isEditMode = enabled;
        if (enabled) {
            this.showTransformControls();
        } else {
            this.hideTransformControls();
        }
    }

    updateTransformControls() {
        if (this.transformControls && this.transformControls.visible) {
            this.transformControls.update();
        }
    }

    dispose() {
        // Remove tooltip and label overlays
        const htmlOverlay = getHTMLOverlay();
        if (this.tooltipConfig) {
            htmlOverlay.removeOverlay(this.tooltipOverlayId);
        }
        if (this.labelConfig) {
            htmlOverlay.removeOverlay(this.labelOverlayId);
        }

        // Remove TransformControls and clean up event listeners
        if (this.transformControls) {
            // Remove event listeners before disposing
            if (this.onDraggingChanged) {
                this.transformControls.removeEventListener('dragging-changed', this.onDraggingChanged);
            }
            if (this.onTransformChange) {
                this.transformControls.removeEventListener('change', this.onTransformChange);
            }

            // Detach and remove from scene
            this.transformControls.detach();
            this.scene.remove(this.transformControls);
            this.transformControls.dispose();
            this.transformControls = null;

            // Ensure OrbitControls is re-enabled
            const orbitControls = ControlRegistry.orbitControls;
            if (orbitControls) {
                orbitControls.enabled = true;
            }
        }

        // Unregister from ControlRegistry
        ControlRegistry.unregister(this);

        // Remove from scene
        if (this.group.parent) {
            this.scene.remove(this.group);
        }

        // Dispose geometries and materials
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });

        // Clear click timeout
        if (this.clickTimeout) {
            clearTimeout(this.clickTimeout);
            this.clickTimeout = null;
        }

        // Remove event listeners
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('click', this._onMouseClick);
        window.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mouseup', this._onMouseUp);
        window.removeEventListener('touchstart', this._onTouchStart);
        window.removeEventListener('touchend', this._onTouchEnd);
    }
}
