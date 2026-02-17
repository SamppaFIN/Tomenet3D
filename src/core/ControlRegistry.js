/**
 * ControlRegistry - Singleton registry for managing all 3D controls
 * Handles edit mode state changes across all registered controls
 */
export class ControlRegistry {
    static controls = [];
    static orbitControls = null;
    static isEditMode = false;

    /**
     * Register a control to be managed by the registry
     * @param {BaseControl3D} control - The control to register
     */
    static register(control) {
        if (!this.controls.includes(control)) {
            this.controls.push(control);
            // If edit mode is already active, enable it for new control
            if (this.isEditMode) {
                control.setEditMode(true);
            }
        }
    }

    /**
     * Unregister a control from the registry
     * @param {BaseControl3D} control - The control to unregister
     */
    static unregister(control) {
        const index = this.controls.indexOf(control);
        if (index > -1) {
            this.controls.splice(index, 1);
        }
    }

    /**
     * Set OrbitControls reference for coordination
     * @param {OrbitControls} controls - OrbitControls instance
     */
    static setOrbitControls(controls) {
        this.orbitControls = controls;
    }

    /**
     * Set edit mode for all registered controls
     * @param {boolean} enabled - Whether edit mode should be enabled
     */
    static setEditMode(enabled) {
        this.isEditMode = enabled;

        // Ensure OrbitControls is enabled when exiting edit mode
        if (!enabled && this.orbitControls) {
            this.orbitControls.enabled = true;
        }

        // Update all controls safely
        this.controls.forEach(control => {
            if (control && control.setEditMode) {
                try {
                    control.setEditMode(enabled);
                } catch (error) {
                    console.warn('Error setting edit mode for control:', error);
                }
            }
        });
    }

    /**
     * Get current edit mode state
     * @returns {boolean} Current edit mode state
     */
    static getEditMode() {
        return this.isEditMode;
    }

    /**
     * Get all registered controls
     * @returns {Array<BaseControl3D>} Array of all registered controls
     */
    static getAll() {
        return this.controls;
    }
}
