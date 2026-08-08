import { test, expect, Page } from '@playwright/test';

test.describe('Game application smoke tests', () => {
  test('start screen loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-container')).toBeVisible();
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });

  test('start screen has the game title and start button', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'サルベージ・メカノイド' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ダンジョン潜入' })).toBeVisible();
  });
});

test.describe('Engine test view (?test)', () => {
  test('engine test view loads and initializes PIXI canvas', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/?test');
    await page.waitForTimeout(3000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeGreaterThan(0);
    expect(canvasBox!.height).toBeGreaterThan(0);

    const criticalErrors = errors.filter(
      (e) => !e.includes('Failed to load resource') && !e.includes('404')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('engine test view renders without fatal errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await page.goto('/?test');
    await page.waitForTimeout(5000);

    const criticalErrors = errors.filter(
      (e) => !e.includes('Failed to load resource') && !e.includes('404')
    );
    expect(criticalErrors).toEqual([]);
  });
});

test.describe('Game screen initialization', () => {
  test('game starts and renders canvas when start button is clicked', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'ダンジョン潜入' }).click();

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);

    const criticalErrors = errors.filter(
      (e) => !e.includes('Failed to load resource') && !e.includes('404')
    );
    expect(criticalErrors).toEqual([]);
  });
});
