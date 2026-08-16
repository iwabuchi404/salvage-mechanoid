import * as fs from 'fs';
import * as path from 'path';

/**
 * BU-2 段階7: Player.ts が gameStore をインポートしていないことを検証する。
 *
 * Player は gameStore への直接依存を廃止し、初期値は PlayerInitialConfig で
 * 受け取る。gameStore への投影は StatsProjection が行う。
 */
describe('BU-2 段階7: Player.ts の gameStore インポートガード', () => {
  const playerPath = path.resolve(__dirname, '../../../src/engine/entity/Player.ts');

  it('Player.ts が gameStore をインポートしていない', () => {
    const content = fs.readFileSync(playerPath, 'utf-8');
    // import 文で gameStore を参照していないか確認
    const importLines = content.split('\n').filter((line) => line.trim().startsWith('import'));

    const hasGameStoreImport = importLines.some((line) => line.includes('gameStore'));

    expect(hasGameStoreImport).toBe(false);
  });

  it('Player.ts が useGameStore を使用していない', () => {
    const content = fs.readFileSync(playerPath, 'utf-8');
    // useGameStore の呼び出しがないか確認
    expect(content).not.toMatch(/useGameStore/);
  });

  it('Player.ts が PlayerInitialConfig をインポートしている', () => {
    const content = fs.readFileSync(playerPath, 'utf-8');
    const importLines = content.split('\n').filter((line) => line.trim().startsWith('import'));

    const hasConfigImport = importLines.some((line) => line.includes('PlayerInitialConfig'));

    expect(hasConfigImport).toBe(true);
  });
});
