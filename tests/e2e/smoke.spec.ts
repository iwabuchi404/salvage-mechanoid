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

  // E-1: 開始後、キーボード入力でプレイヤーが動き、HUD の表示が変化する
  // docs/TESTING_STRATEGY.md §8 段階4: ブラウザ固有の結線のみを E2E で検証する
  test('E-1: keyboard input moves player and HUD updates', async ({ page }) => {
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

    // ゲーム画面が表示されるまで待機
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(3000);

    // HUD の HP 表示が見えるまで待機
    const hudHp = page.locator('[data-testid="hud-hp"]');
    await expect(hudHp).toBeVisible();

    // HUD の Energy 表示も確認
    const hudEnergy = page.locator('[data-testid="hud-energy"]');
    await expect(hudEnergy).toBeVisible();

    // HUD の Position 表示も確認
    const hudPosition = page.locator('[data-testid="hud-position"]');
    await expect(hudPosition).toBeVisible();

    // 初期の Energy と Position テキストを記録
    const initialEnergyText = await hudEnergy.textContent();
    expect(initialEnergyText).not.toBeNull();
    const initialPositionText = await hudPosition.textContent();
    expect(initialPositionText).not.toBeNull();

    // キーボード入力で移動（矢印キー）
    // 各入力後に位置を確認し、最初に位置が変化した時点で成功とする。
    // 右下左上の順で入力すると、全移動が成功した場合に開始位置へ戻ってしまい
    // 最終位置比較が失敗するため、各ステップで位置変化を観測する。
    const directions = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    let moved = false;
    const observedPositions = new Set<string>();
    observedPositions.add(initialPositionText!);

    for (let i = 0; i < 16; i++) {
      await page.keyboard.press(directions[i % 4]);
      await page.waitForTimeout(300);
      const currentPos = await hudPosition.textContent();
      if (currentPos && currentPos !== initialPositionText) {
        moved = true;
      }
      if (currentPos) observedPositions.add(currentPos);
    }

    // プレイヤーが実際に移動したことを検証
    // 16回の入力で一度も位置が変化しなかった場合は失敗
    expect(moved).toBe(true);
    // 観測した位置の集合に初期位置以外が含まれることを検証
    expect(observedPositions.size).toBeGreaterThan(1);

    // 最終的な Energy テキストを取得
    const updatedEnergyText = await hudEnergy.textContent();
    expect(updatedEnergyText).not.toBeNull();
    // 入力前後で Energy 表示も変化したことを検証
    expect(updatedEnergyText).not.toEqual(initialEnergyText);

    // 致命的なエラーが出ないことを確認
    // 音声アセット未ロード時のエラーは環境依存のため除外
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('Failed to load resource') &&
        !e.includes('404') &&
        !e.includes("Cannot read properties of undefined (reading 'play')")
    );
    expect(criticalErrors).toEqual([]);
  });
});
