import * as fs from 'fs';
import * as path from 'path';

/**
 * BU-4 段階5: UI ↔ エンジン境界の契約テスト
 *
 * 設計 docs/design/UI_BOUNDARY_DESIGN.md §7.5
 *
 * Vue コンポーネントが engine/ 配下を直接 import しないことを検証する。
 * UI は GameCommands / GameViewState / Pinia ストア経由でのみエンジンと通信する。
 *
 * 例外: type-only import（Direction など）は許可する。
 */
describe('BU-4 段階5: UI ↔ エンジン境界', () => {
  const componentsDir = path.resolve(__dirname, '../../../src/components');

  /** 指定ディレクトリ以下の .vue / .ts ファイルを再帰的に取得 */
  function collectFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectFiles(fullPath));
      } else if (entry.name.endsWith('.vue') || entry.name.endsWith('.ts')) {
        // テスト用コンポーネントは除外
        if (entry.name === 'EngineTestComponent.vue') continue;
        results.push(fullPath);
      }
    }
    return results;
  }

  it('Vue コンポーネントが engine/ を value import しない', () => {
    const files = collectFiles(componentsDir);
    const violations: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf-8');
      // value import（import { Foo } from 'engine/...'）を検出
      // type-only import（import type { Foo }）は許可
      const lines = source.split('\n');
      for (const line of lines) {
        // import type { ... } from '...engine/...' は OK
        if (/^\s*import\s+type\s+/.test(line)) continue;
        // import { ... } from '...engine/...' は NG（value import）
        if (/from\s+['"][^'"]*\/engine\//.test(line) || /from\s+['"]@\/engine\//.test(line)) {
          violations.push(`${path.relative(componentsDir, file)}: ${line.trim()}`);
        }
      }
    }

    if (violations.length > 0) {
      expect(violations).toEqual([]);
    }
  });

  it('GameScreen.vue が getEventSystem を呼ばない', () => {
    const source = fs.readFileSync(path.join(componentsDir, 'scene/GameScreen.vue'), 'utf-8');
    expect(source).not.toMatch(/getEventSystem/);
  });

  it('GameScreen.vue が setOnTileSelect / setOnEnemySelect / setOnCharacterSelect / setOnTurnChange を呼ばない', () => {
    const source = fs.readFileSync(path.join(componentsDir, 'scene/GameScreen.vue'), 'utf-8');
    expect(source).not.toMatch(/setOnTileSelect/);
    expect(source).not.toMatch(/setOnEnemySelect/);
    expect(source).not.toMatch(/setOnCharacterSelect/);
    expect(source).not.toMatch(/setOnTurnChange/);
  });

  it('GameScreen.vue が data.entityId === "player" のドメイン判定を持たない', () => {
    const source = fs.readFileSync(path.join(componentsDir, 'scene/GameScreen.vue'), 'utf-8');
    expect(source).not.toMatch(/entityId\s*===\s*['"]player['"]/);
  });

  it('GameScreen.vue が setInterval でポーリングしない', () => {
    const source = fs.readFileSync(path.join(componentsDir, 'scene/GameScreen.vue'), 'utf-8');
    expect(source).not.toMatch(/setInterval/);
  });
});
