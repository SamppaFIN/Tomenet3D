import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * GeometryFactory
 * Centralized factory for creating standardized geometries for Spatial UI 3D controls.
 * Supports: box, rounded, pill, circle, hexagon, cylinder, plane.
 */
export class GeometryFactory {

    /**
     * Creates a geometry based on type and dimensions.
     * @param {string} type - 'box', 'rounded', 'pill', 'circle', 'hexagon', 'cylinder', 'plane'
     * @param {Object} options - { width, height, depth, radius, segments }
     * @returns {THREE.BufferGeometry}
     */
    static create(type, options = {}) {
        const width = options.width || 1;
        const height = options.height || 1;
        const depth = options.depth || 0.1;
        const radius = options.radius || 0.1;
        const segments = options.segments || 32;

        switch (type.toLowerCase()) {
            case 'box':
                return new THREE.BoxGeometry(width, height, depth);

            case 'rounded':
            case 'rounded-box':
                // RoundedBoxGeometry( width, height, depth, segments, radius )
                return new RoundedBoxGeometry(width, height, depth, 4, radius);

            case 'pill':
                return this.createPill(width, height, depth, segments);

            case 'capsule':
                // CapsuleGeometry( radius, length, capSegments, radialSegments )
                // Note: THREE.CapsuleGeometry is vertical by default.
                const capRadius = Math.min(width, height) / 2;
                const length = Math.abs(width - height); // Length of the middle section
                // This is a bit tricky depending on orientation. Let's assume horizontal pill for buttons.
                // Or create a custom shape.
                // Let's stick to a custom Pill shape using ExtrudeGeometry or merging.
                return this.createPill(width, height, depth, segments);

            case 'circle':
            case 'disc':
                return new THREE.CircleGeometry(width / 2, segments); // width = diameter

            case 'cylinder':
                return new THREE.CylinderGeometry(width / 2, width / 2, height, segments);

            case 'hexagon':
                return new THREE.CylinderGeometry(width / 2, width / 2, depth, 6);

            case 'plane':
                return new THREE.PlaneGeometry(width, height);

            case 'ring':
                const innerRadius = options.innerRadius || (width / 2) * 0.5;
                const outerRadius = width / 2;
                return new THREE.RingGeometry(innerRadius, outerRadius, segments);

            case 'sphere':
                // Use minimum dimension for radius to ensure it fits
                const sphereRadius = Math.min(width, height, depth) / 2;
                // Or user might expert width=diameter. 
                // In Toggle3D handle creation: 
                // let geoOptions = { width: size, height: size, depth: size, radius: size / 2 };
                // So width ~= height ~= depth.
                return new THREE.SphereGeometry(width / 2, segments, segments);

            default:
                console.warn(`GeometryFactory: Unknown type '${type}', defaulting to box.`);
                return new THREE.BoxGeometry(width, height, depth);
        }
    }

    /**
     * Creates a Pill geometry (Horizontal).
     * Constructed by defining a 2D shape and extruding it.
     */
    static createPill(width, height, depth, segments) {
        // Create 2D shape with rounded ends
        const shape = new THREE.Shape();
        const r = height / 2; // Radius of the ends
        const w = width - height; // Width of the straight part (total width - 2*r)

        // Starting point (bottom-left of straight part)
        shape.moveTo(-w / 2, -r);

        // Right straight line
        shape.lineTo(w / 2, -r);

        // Right semi-circle
        shape.absarc(w / 2, 0, r, -Math.PI / 2, Math.PI / 2, false);

        // Left straight line
        shape.lineTo(-w / 2, r);

        // Left semi-circle
        shape.absarc(-w / 2, 0, r, Math.PI / 2, -Math.PI / 2, false);

        const extrudeSettings = {
            steps: 1,
            depth: depth,
            bevelEnabled: true,
            bevelThickness: depth * 0.1,
            bevelSize: depth * 0.1,
            bevelSegments: 4,
            curveSegments: segments
        };

        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.center(); // Center the geometry
        return geo;
    }
}
