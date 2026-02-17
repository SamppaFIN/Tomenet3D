import * as THREE from 'three';
import { BaseControl3D } from '../core/BaseControl3D.js';

/**
 * Gomboc3D - Self-righting mono-monostatic body
 * 
 * The Gömböc is a convex 3D body with only one stable and one unstable 
 * equilibrium point. Discovered by Gábor Domokos and Péter Várkonyi in 2006.
 * 
 * Uses Sloan's (2023) analytic equation in spherical coordinates:
 * r⁴ = 1 + 4β·sin(φ)·cos(θ - 5φ)
 * 
 * @extends BaseControl3D
 */
export class Gomboc3D extends BaseControl3D {
    constructor(scene, camera, position = [0, 0, 0], config = {}) {
        super(scene, camera, position, {
            ...config,
            radius: config.radius || 1.0,
            beta: config.beta || 0.12, // Shape parameter (0 to 0.15)
            segments: config.segments || 64,
            color: config.color || 0xffd700,
            materialType: config.materialType || 'metal',
            autoRotate: config.autoRotate !== false,
            rotationSpeed: config.rotationSpeed || 0.003,
            wireframe: config.wireframe || false,
            showEquilibrium: config.showEquilibrium || false,
            selfRighting: config.selfRighting || false,
            onClick: config.onClick || null
        });

        this.radius = this.get('radius');
        this.beta = this.get('beta');
        this.segments = this.get('segments');
        this.autoRotate = this.get('autoRotate');
        this.rotationSpeed = this.get('rotationSpeed');
        this.wireframe = this.get('wireframe');
        this.showEquilibrium = this.get('showEquilibrium');
        this.selfRighting = this.get('selfRighting');

        this.rotationAngle = 0;
        this.currentScale = 1.0;
        this.scaleVelocity = 0;

        // Self-righting animation
        this.rightingAngle = 0;
        this.rightingVelocity = 0;
        this.isRighting = false;

        this.create();
    }

    create() {
        // Clear existing geometry
        while (this.group.children.length > 0) {
            const child = this.group.children[0];
            this.group.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }

        const geometry = this.createGombocGeometry();
        const material = this.createMaterial();

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData.isInteractive = true;
        this.mesh.userData.control = this;

        this.group.add(this.mesh);

        if (this.wireframe) {
            this.createWireframe(geometry);
        }

        if (this.showEquilibrium) {
            this.createEquilibriumMarkers();
        }

        this.createGlow();
    }

    createGombocGeometry() {
        /**
         * Sloan's analytic Gömböc equation in spherical coordinates:
         * r⁴ = 1 + 4β·sin(φ)·cos(θ - 5φ)
         * 
         * where:
         * - φ (phi): polar angle (0 to π)
         * - θ (theta): azimuthal angle (0 to 2π)
         * - β (beta): shape parameter (≤ 0.15)
         * - r: radius at given angles
         */

        const vertices = [];
        const indices = [];
        const normals = [];
        const uvs = [];

        const beta = this.beta;
        const baseRadius = this.radius;
        const segments = this.segments;

        for (let i = 0; i <= segments; i++) {
            const phi = (i / segments) * Math.PI; // Polar angle
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            for (let j = 0; j <= segments; j++) {
                const theta = (j / segments) * Math.PI * 2; // Azimuthal angle

                // Sloan's Gömböc equation
                const rPow4 = 1 + 4 * beta * Math.sin(phi) * Math.cos(theta - 5 * phi);
                const r = baseRadius * Math.pow(Math.max(0.1, rPow4), 0.25); // Fourth root

                // Spherical to Cartesian conversion
                const x = r * sinPhi * Math.cos(theta);
                const y = r * cosPhi;
                const z = r * sinPhi * Math.sin(theta);

                vertices.push(x, y, z);

                // Compute normal (approximate as normalized position for smooth shading)
                const length = Math.sqrt(x * x + y * y + z * z);
                normals.push(x / length, y / length, z / length);

                // UV coordinates
                uvs.push(j / segments, i / segments);
            }
        }

        // Create faces
        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < segments; j++) {
                const a = i * (segments + 1) + j;
                const b = a + segments + 1;

                indices.push(a, b, a + 1);
                indices.push(b, b + 1, a + 1);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }

    createMaterial() {
        const color = this.get('color');
        const materialType = this.get('materialType');

        switch (materialType) {
            case 'glass':
                return new THREE.MeshPhysicalMaterial({
                    color: color,
                    metalness: 0.0,
                    roughness: 0.1,
                    transparent: true,
                    opacity: 0.7,
                    transmission: 0.9,
                    thickness: 0.5,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1
                });
            case 'metal':
                return new THREE.MeshStandardMaterial({
                    color: color,
                    metalness: 0.95,
                    roughness: 0.15,
                    emissive: color,
                    emissiveIntensity: 0.15
                });
            case 'neon':
                return new THREE.MeshStandardMaterial({
                    color: color,
                    metalness: 0.3,
                    roughness: 0.4,
                    emissive: color,
                    emissiveIntensity: 0.8,
                    transparent: true,
                    opacity: 0.9
                });
            default:
                return new THREE.MeshStandardMaterial({
                    color: color,
                    metalness: 0.5,
                    roughness: 0.5
                });
        }
    }

    createWireframe(geometry) {
        if (this.wireframeMesh) {
            this.group.remove(this.wireframeMesh);
            this.wireframeMesh.geometry.dispose();
            this.wireframeMesh.material.dispose();
        }

        const wireframeGeo = new THREE.WireframeGeometry(geometry);
        const wireframeMat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            linewidth: 1
        });

        this.wireframeMesh = new THREE.LineSegments(wireframeGeo, wireframeMat);
        this.group.add(this.wireframeMesh);
    }

    createEquilibriumMarkers() {
        // Remove existing markers
        if (this.equilibriumMarkers) {
            this.equilibriumMarkers.forEach(marker => {
                this.group.remove(marker);
                if (marker.geometry) marker.geometry.dispose();
                if (marker.material) marker.material.dispose();
            });
        }

        this.equilibriumMarkers = [];

        // Stable equilibrium point: φ=π/2, θ=3π/2 (bottom)
        const stableMarker = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 }) // Green
        );
        stableMarker.position.set(0, -this.radius * 1.1, 0);
        this.equilibriumMarkers.push(stableMarker);
        this.group.add(stableMarker);

        // Unstable equilibrium point: φ=π/2, θ=π/2 (top)
        const unstableMarker = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xff0000 }) // Red
        );
        unstableMarker.position.set(0, this.radius * 1.1, 0);
        this.equilibriumMarkers.push(unstableMarker);
        this.group.add(unstableMarker);
    }

    createGlow() {
        const glowGeometry = this.createGombocGeometry();
        glowGeometry.scale(1.05, 1.05, 1.05);

        const glowMaterial = new THREE.MeshBasicMaterial({
            color: this.get('color'),
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        });

        this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.glowMesh.visible = false;
        this.group.add(this.glowMesh);
    }

    toggleWireframe() {
        this.wireframe = !this.wireframe;
        this.set('wireframe', this.wireframe);

        if (this.wireframe && !this.wireframeMesh) {
            this.createWireframe(this.mesh.geometry);
        } else if (this.wireframeMesh) {
            this.wireframeMesh.visible = this.wireframe;
        }
    }

    triggerSelfRighting() {
        if (!this.isRighting) {
            this.isRighting = true;
            this.rightingAngle = Math.random() * Math.PI * 2; // Random starting angle
        }
    }

    handleClick(intersect) {
        super.handleClick(intersect);

        if (this.selfRighting) {
            this.triggerSelfRighting();
        } else {
            this.toggleWireframe();
        }

        const onClick = this.get('onClick');
        if (onClick && typeof onClick === 'function') {
            onClick(this);
        }
    }

    onHoverChange(isHovered) {
        super.onHoverChange(isHovered);
        if (this.glowMesh) {
            this.glowMesh.visible = isHovered;
        }
        this.scaleVelocity = isHovered ? 0.05 : -0.05;
    }

    update() {
        // Auto-rotation
        if (this.autoRotate && !this.isRighting) {
            this.rotationAngle += this.rotationSpeed;
            this.group.rotation.y = this.rotationAngle;
        }

        // Self-righting animation (simulates physics)
        if (this.isRighting) {
            const targetAngle = 0; // Stable position
            const angleDiff = targetAngle - this.rightingAngle;

            // Simple damped spring physics
            const springForce = angleDiff * 0.05;
            const damping = -this.rightingVelocity * 0.1;
            this.rightingVelocity += springForce + damping;
            this.rightingAngle += this.rightingVelocity;

            // Apply rotation (wobble effect)
            this.group.rotation.x = Math.sin(this.rightingAngle) * 0.5;
            this.group.rotation.z = Math.cos(this.rightingAngle) * 0.5;

            // Stop righting when settled
            if (Math.abs(angleDiff) < 0.01 && Math.abs(this.rightingVelocity) < 0.01) {
                this.isRighting = false;
                this.group.rotation.x = 0;
                this.group.rotation.z = 0;
                this.rightingAngle = 0;
                this.rightingVelocity = 0;
            }
        }

        // Scale animation on hover
        const targetScale = this.isHovered ? 1.1 : 1.0;
        const scaleDiff = targetScale - this.currentScale;
        this.scaleVelocity += scaleDiff * 0.1;
        this.scaleVelocity *= 0.8;
        this.currentScale += this.scaleVelocity;
        this.group.scale.setScalar(this.currentScale);

        super.update();
    }

    onStateChange(key, value, oldValue) {
        const criticalKeys = ['radius', 'beta', 'segments', 'color', 'materialType', 'wireframe', 'showEquilibrium'];
        if (criticalKeys.includes(key)) {
            this.create();
        }

        if (key === 'autoRotate') this.autoRotate = value;
        if (key === 'rotationSpeed') this.rotationSpeed = value;
        if (key === 'selfRighting') this.selfRighting = value;
        if (key === 'beta') this.beta = value;

        super.onStateChange(key, value, oldValue);
    }
}
