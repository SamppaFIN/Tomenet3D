/**
 * ButtonFactory.js
 * Utility to create advanced 3D button geometries and visual effects
 * Extracts logic from the advanced Button3D showcase for use in demos
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export class ButtonFactory {

    static createGeometry(type, width, height, depth, params = {}) {
        let geometry;

        switch (type) {
            case 'box':
            case 0:
                // Rounded Box
                if (RoundedBoxGeometry) {
                    geometry = new RoundedBoxGeometry(width, height, depth, 4, params.bevelRadius || 0.15);
                } else {
                    // Fallback to ExtrudeGeometry if RoundedBoxGeometry not available
                    const shape = new THREE.Shape();
                    const w = width / 2;
                    const h = height / 2;
                    const br = params.bevelRadius || 0.15;
                    shape.moveTo(-w + br, -h);
                    shape.lineTo(w - br, -h);
                    shape.quadraticCurveTo(w, -h, w, -h + br);
                    shape.lineTo(w, h - br);
                    shape.quadraticCurveTo(w, h, w - br, h);
                    shape.lineTo(-w + br, h);
                    shape.quadraticCurveTo(-w, h, -w, h - br);
                    shape.lineTo(-w, -h + br);
                    shape.quadraticCurveTo(-w, -h, -w + br, -h);
                    geometry = new THREE.ExtrudeGeometry(shape, {
                        depth: depth,
                        bevelEnabled: br > 0,
                        bevelThickness: br * 0.3,
                        bevelSize: br * 0.3,
                        bevelSegments: Math.max(1, Math.floor(br * 10))
                    });
                }
                break;

            case 'sphere':
            case 1:
                const radius = Math.min(width, height) / 2;
                const segments = params.sphereSegments || 32;
                geometry = new THREE.SphereGeometry(radius, segments, segments);
                break;

            case 'cylinder':
            case 2:
                const cylSegments = params.cylinderSegments || 32;
                geometry = new THREE.CylinderGeometry(
                    Math.min(width, height) / 2,
                    Math.min(width, height) / 2,
                    depth * 2,
                    cylSegments
                );
                geometry.rotateX(Math.PI / 2);
                break;

            case 'torus':
            case 3:
                const tubeThickness = params.torusTube || 0.3;
                geometry = new THREE.TorusGeometry(
                    Math.min(width, height) / 3,
                    tubeThickness,
                    16,
                    32
                );
                break;

            case 'cone':
            case 4:
                geometry = new THREE.ConeGeometry(
                    Math.min(width, height) / 2,
                    depth * 3,
                    32
                );
                geometry.rotateX(Math.PI / 2);
                break;

            case 'pill':
            case 5:
                const pillShape = new THREE.Shape();
                const pw = width / 2 - height / 2;
                const pr = height / 2;
                pillShape.absarc(pw, 0, pr, -Math.PI / 2, Math.PI / 2, false);
                pillShape.absarc(-pw, 0, pr, Math.PI / 2, Math.PI * 1.5, false);
                geometry = new THREE.ExtrudeGeometry(pillShape, {
                    depth: depth,
                    bevelEnabled: false
                });
                break;

            case 'hexagon':
            case 6:
                const hexShape = new THREE.Shape();
                const hexRadius = Math.min(width, height) / 2;
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const x = hexRadius * Math.cos(angle);
                    const y = hexRadius * Math.sin(angle);
                    if (i === 0) hexShape.moveTo(x, y);
                    else hexShape.lineTo(x, y);
                }
                hexShape.closePath();
                geometry = new THREE.ExtrudeGeometry(hexShape, {
                    depth: depth,
                    bevelEnabled: false
                });
                break;

            case 'diamond':
            case 7:
                geometry = new THREE.OctahedronGeometry(Math.min(width, height) / 2, 0);
                geometry.scale(1, 0.6, 1);
                break;

            case 'octahedron':
            case 8:
                geometry = new THREE.OctahedronGeometry(Math.min(width, height) / 2, 0);
                break;

            default:
                geometry = new THREE.BoxGeometry(width, height, depth);
        }

        return geometry;
    }

    static createMaterial(color, params = {}) {
        return new THREE.MeshStandardMaterial({
            color: color,
            metalness: params.metalness || 0.5,
            roughness: params.roughness || 0.3,
            emissive: color,
            emissiveIntensity: params.emissiveIntensity || 0.2
        });
    }

    // Enhance an existing mesh with interaction button logic
    static enhanceButton(mesh, config, scene) {
        // Effects containers
        let loadingSpinner = null;
        let pulseGlow = null;
        const ripples = [];

        // Initial setup
        if (config.loading) {
            const spinnerGeo = new THREE.TorusGeometry(0.3, 0.05, 16, 32);
            const spinnerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            loadingSpinner = new THREE.Mesh(spinnerGeo, spinnerMat);
            loadingSpinner.position.copy(mesh.position);
            loadingSpinner.position.z += config.depth / 2 + 0.2;
            scene.add(loadingSpinner);
        }

        if (config.pulseAnimation) {
            const glowGeo = new THREE.SphereGeometry(Math.max(config.width, config.height) / 2 + 0.3, 32, 32);
            const glowMat = new THREE.MeshBasicMaterial({
                color: config.color,
                transparent: true,
                opacity: 0.2
            });
            pulseGlow = new THREE.Mesh(glowGeo, glowMat);
            pulseGlow.position.copy(mesh.position);
            scene.add(pulseGlow);
        }

        // Return controller object
        return {
            mesh: mesh,
            config: config,
            pressed: false,
            currentZ: mesh.position.z,
            baseZ: mesh.position.z, // Remember original Z
            loadingSpinner: loadingSpinner,
            pulseGlow: pulseGlow,
            pulseTime: 0,
            ripples: ripples,

            update: function () {
                // Depth animation
                const targetZ = this.baseZ + (this.pressed ? -config.depth * 0.5 : 0);
                this.mesh.position.z += (targetZ - this.mesh.position.z) * 0.15;

                // Loading spinner
                if (this.loadingSpinner) {
                    this.loadingSpinner.rotation.z -= 0.1;
                }

                // Pulse animation
                if (this.pulseGlow) {
                    this.pulseTime += 0.05;
                    const scale = 1 + Math.sin(this.pulseTime) * 0.1;
                    this.pulseGlow.scale.set(scale, scale, scale);
                    this.pulseGlow.material.opacity = 0.1 + Math.sin(this.pulseTime) * 0.1;
                }

                // Ripples
                for (let i = this.ripples.length - 1; i >= 0; i--) {
                    const ripple = this.ripples[i];
                    ripple.scale.x += 0.1;
                    ripple.scale.y += 0.1;
                    ripple.material.opacity -= 0.02;
                    if (ripple.material.opacity <= 0) {
                        scene.remove(ripple);
                        ripple.geometry.dispose();
                        ripple.material.dispose();
                        this.ripples.splice(i, 1);
                    }
                }
            },

            onClick: function () {
                if (this.config.locked) return;

                this.pressed = true;
                setTimeout(() => { this.pressed = false; }, 150);

                // Ripple
                if (this.config.rippleEffect) {
                    const rippleGeo = new THREE.RingGeometry(0.1, 0.2, 32);
                    const rippleMat = new THREE.MeshBasicMaterial({
                        color: this.config.color,
                        transparent: true,
                        opacity: 0.6,
                        side: THREE.DoubleSide
                    });
                    const ripple = new THREE.Mesh(rippleGeo, rippleMat);
                    ripple.position.copy(this.mesh.position);
                    ripple.position.z += this.config.depth / 2 + 0.05;
                    scene.add(ripple);
                    this.ripples.push(ripple);
                }

                if (this.config.onClick) this.config.onClick();
            },

            dispose: function () {
                if (this.loadingSpinner) {
                    scene.remove(this.loadingSpinner);
                    this.loadingSpinner.geometry.dispose();
                    this.loadingSpinner.material.dispose();
                }
                if (this.pulseGlow) {
                    scene.remove(this.pulseGlow);
                    this.pulseGlow.geometry.dispose();
                    this.pulseGlow.material.dispose();
                }
                this.ripples.forEach(r => {
                    scene.remove(r);
                    r.geometry.dispose();
                    r.material.dispose();
                });
            }
        };
    }
}
