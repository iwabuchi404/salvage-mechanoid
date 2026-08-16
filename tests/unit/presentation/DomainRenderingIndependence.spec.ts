import * as fs from 'fs';
import * as path from 'path';

/**
 * C1: Player / Item の描画ライフサイクルを Presentation へ移す
 *
 * ドメインエンティティ（Player.ts, Item.ts）が PixiJS や RendererSystem
 * へ依存していないことを検証する契約テスト。
 */
describe('C1: ドメインエンティティの描画依存なし', () => {
  const entityDir = path.resolve(__dirname, '../../../src/engine/entity');

  it('Player.ts が pixi.js を import しない', () => {
    const source = fs.readFileSync(path.join(entityDir, 'Player.ts'), 'utf-8');
    expect(source).not.toMatch(/from\s+['"]pixi\.js['"]/);
    expect(source).not.toMatch(/import\s+\*\s+as\s+PIXI/);
  });

  it('Player.ts が RendererSystem を import しない', () => {
    const source = fs.readFileSync(path.join(entityDir, 'Player.ts'), 'utf-8');
    expect(source).not.toMatch(/from\s+['"][^'"]*RendererSystem['"]/);
  });

  it('Player.ts が Camera を import しない', () => {
    const source = fs.readFileSync(path.join(entityDir, 'Player.ts'), 'utf-8');
    expect(source).not.toMatch(/from\s+['"][^'"]*Camera['"]/);
  });

  it('Item.ts が pixi.js を import しない', () => {
    const source = fs.readFileSync(path.join(entityDir, 'Item.ts'), 'utf-8');
    expect(source).not.toMatch(/from\s+['"]pixi\.js['"]/);
    expect(source).not.toMatch(/import\s+\*\s+as\s+PIXI/);
  });

  it('Item.ts が RendererSystem を import しない', () => {
    const source = fs.readFileSync(path.join(entityDir, 'Item.ts'), 'utf-8');
    expect(source).not.toMatch(/from\s+['"][^'"]*RendererSystem['"]/);
  });
});
