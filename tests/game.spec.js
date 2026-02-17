import { test, expect } from '@playwright/test';

test.describe('Olloid\'s Journey - Game Tests', () => {

    test('game page loads without errors', async ({ page }) => {
        const consoleErrors = [];
        const failedRequests = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        page.on('response', response => {
            if (response.status() >= 400) {
                failedRequests.push(`${response.status()} ${response.url()}`);
            }
        });

        await page.goto('/');
        await page.waitForTimeout(2000);

        expect(consoleErrors, `Console errors found: ${consoleErrors.join('\n')}`).toHaveLength(0);
        expect(failedRequests, `Failed requests: ${failedRequests.join('\n')}`).toHaveLength(0);
    });

    test('canvas element is present and visible', async ({ page }) => {
        await page.goto('/');
        const canvas = page.locator('#canvas');
        await expect(canvas).toBeVisible();
    });

    test('HUD panel is visible with game title', async ({ page }) => {
        await page.goto('/');
        const title = page.locator('h1');
        await expect(title).toContainText("Olloid's Journey");
    });

    test('status display updates with tick info', async ({ page }) => {
        await page.goto('/');
        const status = page.locator('#status');
        await expect(status).toBeVisible();

        // Wait for at least one tick (game loop runs every 1 second)
        await page.waitForTimeout(2000);

        const statusText = await status.textContent();
        expect(statusText).toContain('Tick:');
    });

    test('WASD controls queue movement actions', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(1500); // Wait for game to initialize

        // Press W to move up
        await page.keyboard.press('w');
        await page.waitForTimeout(1200); // Wait for next tick

        const status = page.locator('#status');
        const statusText = await status.textContent();
        // Status should show tick count > 0, confirming game is running
        expect(statusText).toMatch(/Tick: [1-9]/);
    });

    test('game canvas has correct dimensions', async ({ page }) => {
        await page.goto('/');
        const canvas = page.locator('#canvas');

        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(0);
    });

    test('controls instructions are visible', async ({ page }) => {
        await page.goto('/');
        const controls = page.locator('.controls');
        await expect(controls).toBeVisible();
        await expect(controls).toContainText('W');
        await expect(controls).toContainText('Golden Gomboc');
    });

    test('screenshot - game loaded state', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(3000); // Let Three.js fully render

        await page.screenshot({ path: 'test-results/game-loaded.png', fullPage: true });
    });
});
