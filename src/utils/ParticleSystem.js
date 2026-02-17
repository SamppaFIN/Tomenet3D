import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene, position, config = {}) {
        this.scene = scene;
        this.position = position;
        this.config = {
            count: config.count || 20,
            color: config.color || 0xffffff,
            size: config.size || 0.1,
            speed: config.speed || 0.05,
            lifetime: config.lifetime || 1000,
            ...config
        };
        
        this.particles = [];
        this.group = new THREE.Group();
        this.group.position.set(...position);
        this.scene.add(this.group);
        
        this.create();
    }
    
    create() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.count * 3);
        const colors = new Float32Array(this.config.count * 3);
        const sizes = new Float32Array(this.config.count);
        
        const color = new THREE.Color(this.config.color);
        
        for (let i = 0; i < this.config.count; i++) {
            const i3 = i * 3;
            
            // Random positions around origin
            positions[i3] = (Math.random() - 0.5) * 0.5;
            positions[i3 + 1] = (Math.random() - 0.5) * 0.5;
            positions[i3 + 2] = (Math.random() - 0.5) * 0.5;
            
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
            
            sizes[i] = Math.random() * this.config.size + 0.05;
            
            this.particles.push({
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * this.config.speed,
                    (Math.random() - 0.5) * this.config.speed,
                    (Math.random() - 0.5) * this.config.speed
                ),
                life: 1.0,
                decay: Math.random() * 0.02 + 0.01
            });
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            size: this.config.size,
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        this.points = new THREE.Points(geometry, material);
        this.group.add(this.points);
        
        this.startTime = Date.now();
    }
    
    update() {
        const positions = this.points.geometry.attributes.position.array;
        const colors = this.points.geometry.attributes.color.array;
        const sizes = this.points.geometry.attributes.size.array;
        
        let allDead = true;
        
        for (let i = 0; i < this.config.count; i++) {
            const i3 = i * 3;
            const particle = this.particles[i];
            
            if (particle.life > 0) {
                allDead = false;
                
                // Update position
                positions[i3] += particle.velocity.x;
                positions[i3 + 1] += particle.velocity.y;
                positions[i3 + 2] += particle.velocity.z;
                
                // Update life
                particle.life -= particle.decay;
                
                // Fade out
                colors[i3] *= 0.95;
                colors[i3 + 1] *= 0.95;
                colors[i3 + 2] *= 0.95;
                
                sizes[i] *= 0.98;
            }
        }
        
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;
        this.points.geometry.attributes.size.needsUpdate = true;
        
        if (allDead) {
            this.dispose();
            return false;
        }
        
        return true;
    }
    
    dispose() {
        if (this.group.parent) {
            this.scene.remove(this.group);
        }
        this.points.geometry.dispose();
        this.points.material.dispose();
    }
}
