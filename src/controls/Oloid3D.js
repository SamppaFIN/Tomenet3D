import { BaseControl3D } from '../core/BaseControl3D.js';
import * as THREE from 'three';

/**
 * Oloid3D - A 3D geometric sculpture component
 * 
 * The oloid is a geometric object discovered by Paul Schatz in 1929.
 * It is the convex hull of two congruent circles in perpendicular planes,
 * where each circle's center lies on the circumference of the other.
 * 
 * @extends BaseControl3D
 */
export class Oloid3D extends BaseControl3D {
    constructor(scene, camera, position = [0, 0, 0], config = {}) {
        super(scene, camera, position, {
            ...config,
            radius: config.radius || 1.0,
            segments: config.segments || 64,
            color: config.color || 0x4ecdc4,
            materialType: config.materialType || 'metal',
            autoRotate: config.autoRotate !== false,
            rotationSpeed: config.rotationSpeed || 0.005,
            wireframe: config.wireframe || false,
            onClick: config.onClick || null
        });

        // Oloid-specific properties
        this.radius = this.get('radius');
        this.segments = this.get('segments');
        this.autoRotate = this.get('autoRotate');
        this.rotationSpeed = this.get('rotationSpeed');
        this.wireframe = this.get('wireframe');

        // Animation state
        this.rotationAngle = 0;
        this.currentScale = 1.0;
        this.scaleVelocity = 0;
    }

    create() {
        // Clear existing group children
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

        // Create the oloid geometry
        const geometry = this.createOloidGeometry();

        // Create material based on type
        const material = this.createMaterial();

        // Create mesh
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData.isInteractive = true;
        this.mesh.userData.control = this;

        this.group.add(this.mesh);

        // Create wireframe if enabled
        if (this.wireframe) {
            this.createWireframe(geometry);
        }

        // Create glow effect
        this.createGlow();
    }

    /**
     * Creates the oloid geometry using procedural generation
     * 
     * Algorithm:
     * 1. Define two circles of equal radius in perpendicular planes
     * 2. Circle 1 in XY plane, Circle 2 in YZ plane
     * 3. Position circles so each center is on the other's circumference
     * 4. Generate surface connecting the two circles
     * 
     * @returns {THREE.BufferGeometry}
     */
    createOloidGeometry() {
        const radius = this.radius;
        const segments = this.segments;

        const vertices = [];
        const indices = [];
        const normals = [];
        const uvs = [];

        // Circle 1: in XY plane, centered at (radius, 0, 0)
        // Circle 2: in YZ plane, centered at (0, radius, 0)

        // Generate vertices for both circles
        const circle1Vertices = [];
        const circle2Vertices = [];

        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;

            // Circle 1: XY plane, center at (radius, 0, 0)
            const x1 = radius + radius * Math.cos(theta);
            const y1 = radius * Math.sin(theta);
            const z1 = 0;
            circle1Vertices.push(new THREE.Vector3(x1, y1, z1));

            // Circle 2: YZ plane, center at (0, radius, 0)
            const x2 = 0;
            const y2 = radius + radius * Math.cos(theta);
            const z2 = radius * Math.sin(theta);
            circle2Vertices.push(new THREE.Vector3(x2, y2, z2));
        }

        // Create the oloid surface by connecting the two circles
        // We'll create a ruled surface between corresponding points
        for (let i = 0; i < segments; i++) {
            // Get four corners of the current quad
            const v1 = circle1Vertices[i];
            const v2 = circle1Vertices[i + 1];
            const v3 = circle2Vertices[i];
            const v4 = circle2Vertices[i + 1];

            // Add vertices
            const baseIndex = vertices.length / 3;

            vertices.push(v1.x, v1.y, v1.z);
            vertices.push(v2.x, v2.y, v2.z);
            vertices.push(v3.x, v3.y, v3.z);
            vertices.push(v4.x, v4.y, v4.z);

            // Create two triangles for this quad
            // Triangle 1: v1, v2, v3
            indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
            // Triangle 2: v2, v4, v3
            indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);

            // Calculate normals for smooth shading
            const normal1 = new THREE.Vector3();
            const normal2 = new THREE.Vector3();

            // Triangle 1 normal
            const edge1_1 = new THREE.Vector3().subVectors(v2, v1);
            const edge2_1 = new THREE.Vector3().subVectors(v3, v1);
            normal1.crossVectors(edge1_1, edge2_1).normalize();

            // Triangle 2 normal
            const edge1_2 = new THREE.Vector3().subVectors(v4, v2);
            const edge2_2 = new THREE.Vector3().subVectors(v3, v2);
            normal2.crossVectors(edge1_2, edge2_2).normalize();

            // Average normal for smooth appearance
            const avgNormal = new THREE.Vector3()
                .addVectors(normal1, normal2)
                .normalize();

            // Add normals for all 4 vertices
            for (let j = 0; j < 4; j++) {
                normals.push(avgNormal.x, avgNormal.y, avgNormal.z);
            }

            // Add UVs
            const u1 = i / segments;
            const u2 = (i + 1) / segments;
            uvs.push(u1, 0, u2, 0, u1, 1, u2, 1);
        }

        // Create BufferGeometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);

        // Compute better normals for smooth shading
        geometry.computeVertexNormals();

        // Center the geometry
        geometry.center();

        return geometry;
    }

    /**
     * Creates material based on materialType configuration
     * @returns {THREE.Material}
     */
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
                    opacity: 0.6,
                    transmission: 0.9,
                    thickness: 0.5,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1
                });

            case 'metal':
                return new THREE.MeshStandardMaterial({
                    color: color,
                    metalness: 0.9,
                    roughness: 0.2,
                    emissive: color,
                    emissiveIntensity: 0.2
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

            case 'standard':
            default:
                return new THREE.MeshStandardMaterial({
                    color: color,
                    metalness: 0.5,
                    roughness: 0.5
                });
        }
    }

    /**
     * Creates wireframe overlay
     * @param {THREE.BufferGeometry} geometry
     */
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

    /**
     * Creates subtle glow effect
     */
    createGlow() {
        const glowGeometry = this.createOloidGeometry();
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

    /**
     * Toggle wireframe visibility
     */
    toggleWireframe() {
        this.wireframe = !this.wireframe;
        this.set('wireframe', this.wireframe);

        if (this.wireframe && !this.wireframeMesh) {
            this.createWireframe(this.mesh.geometry);
        } else if (this.wireframeMesh) {
            this.wireframeMesh.visible = this.wireframe;
        }
    }

    /**
     * Handle click interaction
     */
    handleClick(intersect) {
        super.handleClick(intersect);

        // Toggle wireframe on click
        this.toggleWireframe();

        // Trigger callback if provided
        const onClick = this.get('onClick');
        if (onClick && typeof onClick === 'function') {
            onClick(this);
        }
    }

    /**
     * Handle hover state changes
     */
    onHoverChange(isHovered) {
        super.onHoverChange(isHovered);

        // Show glow on hover
        if (this.glowMesh) {
            this.glowMesh.visible = isHovered;
        }

        // Scale animation
        this.scaleVelocity = isHovered ? 0.05 : -0.05;
    }

    /**
     * Animation update loop
     */
    update() {
        // Auto-rotation
        if (this.autoRotate) {
            this.rotationAngle += this.rotationSpeed;
            this.group.rotation.x = Math.sin(this.rotationAngle) * 0.3;
            this.group.rotation.y = this.rotationAngle;
            this.group.rotation.z = Math.cos(this.rotationAngle * 0.7) * 0.2;
        }

        // Scale animation (spring physics)
        const targetScale = this.isHovered ? 1.1 : 1.0;
        const scaleDiff = targetScale - this.currentScale;
        this.scaleVelocity += scaleDiff * 0.1;
        this.scaleVelocity *= 0.8;
        this.currentScale += this.scaleVelocity;

        this.group.scale.setScalar(this.currentScale);

        // Call parent update
        super.update();
    }

    /**
     * Handle state changes
     */
    onStateChange(key, value, oldValue) {
        const criticalKeys = ['radius', 'segments', 'color', 'materialType', 'wireframe'];
        if (criticalKeys.includes(key)) {
            this.create();
        }

        if (key === 'autoRotate') {
            this.autoRotate = value;
        }

        if (key === 'rotationSpeed') {
            this.rotationSpeed = value;
        }

        super.onStateChange(key, value, oldValue);
    }

    /**
     * Get 2D UI content for this control
     */
    get2DContent() {
        const container = super.get2DContent();

        const info = document.createElement('div');
        info.style.cssText = `
            margin-top: 20px;
            padding: 20px;
            background: rgba(0,0,0,0.3);
            border-radius: 12px;
            font-size: 0.9em;
            line-height: 1.6;
        `;

        info.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #4ecdc4;">🌀 The Oloid</h3>
            <p style="margin: 5px 0;">A geometric object discovered by Paul Schatz in 1929.</p>
            <p style="margin: 5px 0; font-size: 0.85em; opacity: 0.8;">
                Formed by the convex hull of two perpendicular circles,
                where each circle's center lies on the other's circumference.
            </p>
            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.2); margin: 15px 0;">
            <p style="margin: 5px 0; font-weight: bold;">💡 Click to toggle wireframe</p>
            <p style="margin: 5px 0; font-weight: bold;">🎯 Hover for glow effect</p>
        `;

        container.appendChild(info);

        return container;
    }
}
