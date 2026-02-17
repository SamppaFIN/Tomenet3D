import * as THREE from 'three';

/**
 * AudioHaptics - Generates procedural audio feedback for spatial interactions.
 * Uses Web Audio API directly via Three.js AudioListener.
 */
export class AudioHaptics {
    constructor(camera) {
        this.camera = camera;
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);

        // Prepare a common audio context
        this.audioContext = this.listener.context;
    }

    /**
     * Plays a harmonic 432Hz chord (A-Major).
     * @param {THREE.Object3D} object 
     */
    playClick(object) {
        if (!object) return;

        // Frequencies for A-Major (Just Intonation relative to A4=432Hz)
        // A4 = 432 Hz
        // C#5 = 544.29 Hz
        // E5 = 648 Hz
        const freqs = [432, 544.29, 648];
        const gainValue = 0.15; // Lower global volume for chord

        const sound = new THREE.PositionalAudio(this.listener);
        const masterGain = this.audioContext.createGain();
        masterGain.gain.setValueAtTime(0, this.audioContext.currentTime);

        // Attack
        masterGain.gain.linearRampToValueAtTime(gainValue, this.audioContext.currentTime + 0.05);
        // Decay
        masterGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);

        // Create oscillators
        freqs.forEach(f => {
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, this.audioContext.currentTime);
            osc.connect(masterGain);
            osc.start();
            osc.stop(this.audioContext.currentTime + 0.5);
        });

        sound.setNodeSource(masterGain);
        object.add(sound);

        // Cleanup
        setTimeout(() => {
            if (object) object.remove(sound);
        }, 600);
    }

    /**
     * Plays a soft breathy tone (A3).
     * @param {THREE.Object3D} object 
     */
    playHover(object) {
        if (!object) return;

        const sound = new THREE.PositionalAudio(this.listener);
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // A3 = 216 Hz (Lower octave of 432)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(216, this.audioContext.currentTime);

        // Very soft envelope
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.05, this.audioContext.currentTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);

        oscillator.connect(gainNode);
        sound.setNodeSource(oscillator);
        object.add(sound);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.33);

        setTimeout(() => {
            if (object) object.remove(sound);
        }, 400);
    }
}
