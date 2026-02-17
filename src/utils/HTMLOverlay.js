import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import * as THREE from 'three';

/**
 * HTMLOverlay - Manages HTML elements in 3D space using CSS3DRenderer
 * Singleton pattern for coordinating all HTML overlays
 */
export class HTMLOverlay {
    constructor() {
        this.renderer = null;
        this.scene = new THREE.Scene();
        this.objects = new Map(); // Map of control ID to CSS3DObject
        this.container = null;
    }

    /**
     * Initialize the HTML overlay system
     * @param {HTMLElement} container - Container element for CSS3DRenderer
     */
    init(container) {
        this.container = container;

        // Create CSS3DRenderer
        this.renderer = new CSS3DRenderer();

        // Match container size if possible
        const width = container ? container.clientWidth : window.innerWidth;
        const height = container ? container.clientHeight : window.innerHeight;

        this.renderer.setSize(width, height);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.pointerEvents = 'none'; // Allow clicks to pass through
        this.renderer.domElement.style.zIndex = '1000';

        // Append to container
        if (container) {
            // Ensure container is relative for absolute child
            if (getComputedStyle(container).position === 'static') {
                container.style.position = 'relative';
            }
            container.appendChild(this.renderer.domElement);
        } else {
            document.body.appendChild(this.renderer.domElement);
        }

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    /**
     * Create an HTML overlay element at a 3D position
     * @param {string} id - Unique identifier for this overlay
     * @param {HTMLElement|string} htmlContent - HTML element or HTML string
     * @param {THREE.Vector3} position - 3D position
     * @param {Object} options - Additional options
     * @returns {CSS3DObject} The created CSS3DObject
     */
    createOverlay(id, htmlContent, position, options = {}) {
        // Remove existing overlay with same ID
        this.removeOverlay(id);

        // Create HTML element if string provided
        let element;
        if (typeof htmlContent === 'string') {
            element = document.createElement('div');
            element.innerHTML = htmlContent;
            element.className = options.className || 'html-overlay';
        } else {
            element = htmlContent;
        }

        // Apply styles
        if (options.styles) {
            Object.assign(element.style, options.styles);
        }

        // Create CSS3DObject
        const css3dObject = new CSS3DObject(element);
        css3dObject.position.copy(position);

        // Apply rotation if specified
        if (options.rotation) {
            css3dObject.rotation.set(...options.rotation);
        }

        // Scale if specified (default scale for visibility)
        if (options.scale) {
            css3dObject.scale.set(...options.scale);
        } else {
            // Default scale to make elements visible
            css3dObject.scale.set(1, 1, 1);
        }

        // Store reference
        this.objects.set(id, css3dObject);
        this.scene.add(css3dObject);

        // Debug log
        console.log('Created HTML overlay:', id, 'at position:', position, 'element:', element);

        return css3dObject;
    }

    updatePosition(id, position) {
        const obj = this.objects.get(id);
        if (obj) {
            obj.position.copy(position);
        }
    }

    /**
     * Update overlay rotation
     * @param {string} id - Overlay identifier
     * @param {THREE.Euler} rotation - New rotation
     */
    updateRotation(id, rotation) {
        const obj = this.objects.get(id);
        if (obj) {
            obj.rotation.copy(rotation);
        }
    }

    /**
     * Update complete transform (position, rotation, scale)
     * @param {string} id - Overlay identifier
     * @param {THREE.Vector3} position - New position
     * @param {THREE.Euler} rotation - New rotation
     * @param {THREE.Vector3} scale - New scale
     */
    updateTransform(id, position, rotation, scale) {
        const obj = this.objects.get(id);
        if (obj) {
            if (position) obj.position.copy(position);
            if (rotation) obj.rotation.copy(rotation);
            if (scale) obj.scale.copy(scale);
        }
    }

    /**
     * Update overlay class name
     * @param {string} id - Overlay identifier
     * @param {string} className - New class name
     */
    updateClass(id, className) {
        const obj = this.objects.get(id);
        if (obj && obj.element) {
            obj.element.className = className;
        }
    }

    /**
     * Update overlay visibility
     * @param {string} id - Overlay identifier
     * @param {boolean} visible - Visibility state
     */
    setVisible(id, visible) {
        const obj = this.objects.get(id);
        if (obj) {
            obj.visible = visible;
        }
    }

    /**
     * Update overlay content
     * @param {string} id - Overlay identifier
     * @param {string} htmlContent - New HTML content
     */
    updateContent(id, htmlContent) {
        const obj = this.objects.get(id);
        if (obj && obj.element) {
            obj.element.innerHTML = htmlContent;
        }
    }

    /**
     * Remove an overlay
     * @param {string} id - Overlay identifier
     */
    removeOverlay(id) {
        const obj = this.objects.get(id);
        if (obj) {
            this.scene.remove(obj);
            this.objects.delete(id);

            // CSS3DObject manages DOM element lifecycle, but we can clean up if needed
            // The element is automatically removed when CSS3DObject is disposed
            if (obj.element && obj.element.parentNode) {
                try {
                    obj.element.parentNode.removeChild(obj.element);
                } catch (e) {
                    // Element may already be removed by CSS3DRenderer
                }
            }
        }
    }

    /**
     * Render the overlay scene
     * @param {THREE.Camera} camera - Camera to render from
     */
    render(camera) {
        if (this.renderer && this.scene) {
            try {
                this.renderer.render(this.scene, camera);
            } catch (error) {
                console.warn('Error rendering HTML overlay:', error);
            }
        }
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        if (this.renderer) {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    /**
     * Manually set size of the renderer
     * @param {number} width 
     * @param {number} height 
     */
    setSize(width, height) {
        if (this.renderer) {
            this.renderer.setSize(width, height);
        }
    }

    /**
     * Dispose of the overlay system
     */
    dispose() {
        // Remove all overlays
        const ids = Array.from(this.objects.keys());
        ids.forEach(id => this.removeOverlay(id));

        // Remove renderer DOM element
        if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }

        // Clean up
        this.renderer = null;
        this.scene = null;
        this.objects.clear();
        this.container = null;
    }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton HTMLOverlay instance
 * @returns {HTMLOverlay} The singleton instance
 */
export function getHTMLOverlay() {
    if (!instance) {
        instance = new HTMLOverlay();
    }
    return instance;
}
