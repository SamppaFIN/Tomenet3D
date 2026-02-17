import * as THREE from 'three';

/**
 * MaterialFactory
 * Centralized factory for creating standardized materials for Spatial UI 3D controls.
 * Supports: glass, standard, neon, matte, metal.
 */
export class MaterialFactory {

    /**
     * Creates a material based on type and options.
     * @param {string} type - 'glass', 'standard', 'neon', 'matte', 'metal'
     * @param {Object} options - { color, opacity, roughness, metalness, transmission, emissive... }
     * @returns {THREE.Material}
     */
    static create(type, options = {}) {
        const color = options.color !== undefined ? options.color : 0xffffff;

        switch (type.toLowerCase()) {
            case 'glass':
                // Spline-like glass: high transmission, some roughness
                return new THREE.MeshPhysicalMaterial({
                    color: color,
                    metalness: options.metalness || 0.1,
                    roughness: options.roughness || 0.15,
                    transmission: options.transmission || 0.9, // Glass-like
                    thickness: options.thickness || 0.5, // Refraction
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    transparent: true,
                    side: THREE.DoubleSide
                });

            case 'standard':
                // Basic PBR material
                return new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: options.roughness || 0.5,
                    metalness: options.metalness || 0.5,
                    transparent: options.opacity < 1.0,
                    opacity: options.opacity || 1.0
                });

            case 'neon':
            case 'glow':
                // High emissive material
                return new THREE.MeshStandardMaterial({
                    color: color,
                    emissive: color,
                    emissiveIntensity: options.intensity || 2.0,
                    toneMapped: false // Key for bloom
                });

            case 'matte':
                return new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.9,
                    metalness: 0.1
                });

            case 'metal':
                return new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.2,
                    metalness: 0.9
                });

            case 'wireframe':
                return new THREE.MeshBasicMaterial({
                    color: color,
                    wireframe: true,
                    transparent: true,
                    opacity: options.opacity || 0.5
                });

            default:
                console.warn(`MaterialFactory: Unknown type '${type}', defaulting to standard.`);
                return new THREE.MeshStandardMaterial({ color: color });
        }
    }
}
