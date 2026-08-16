import * as fs from 'fs';
import * as path from 'path';
import { EventMap, EventKey } from '@/engine/events/EventMap';

/**
 * BU-1 段階1: EventMap の網羅テスト
 *
 * EventMap のキー集合が、src/ 配下で emit されている
 * 全イベント名を包含していることを検証する。
 *
 * これにより、新しいイベントを emit したのに EventMap へ
 * 宣言し忘れる事故をコンパイル時ではなくテスト時点で検出できる。
 */

/** src 配下の .ts/.vue ファイルを再帰的に収集する */
function collectSourceFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.vue'))) {
      files.push(fullPath);
    }
  }
  return files;
}

/** ソースコードから emit されているイベント名を抽出する */
function extractEmittedEventNames(srcDir: string): Set<string> {
  const files = collectSourceFiles(srcDir);
  const emittedNames = new Set<string>();
  // .emit('event_name', ...) または .emit(EventName.SOMETHING, ...) を抽出
  const emitStringPattern = /\.emit\(\s*['"`]([^'"`]+)['"`]/g;
  // EventName.ENUM_VALUE を列挙型の値へ解決するため、enum 定義を読む
  const enumPattern =
    /ENTITY_CREATED|ENTITY_DESTROYED|ENTITY_MOVED|ENTITY_COLLISION|GAME_START|GAME_PAUSE|GAME_RESUME|GAME_OVER|KEY_PRESSED|KEY_RELEASED|MOUSE_MOVED|MOUSE_CLICKED|UI_BUTTON_CLICKED|UI_WINDOW_OPENED|UI_WINDOW_CLOSED/g;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    let match: RegExpExecArray | null;
    while ((match = emitStringPattern.exec(content)) !== null) {
      emittedNames.add(match[1]);
    }
    // EventName.ENUM_VALUE の emit を検出した場合、対応する文字列へ解決
    const enumEmitPattern = /\.emit\(\s*EventName\.([A-Z_]+)/g;
    while ((match = enumEmitPattern.exec(content)) !== null) {
      const enumName = match[1];
      // EventName enum の値へ解決（小文字へ変換）
      const resolved = enumName.toLowerCase();
      emittedNames.add(resolved);
    }
  }

  // enumPattern は使用しない（上で解決済み）
  void enumPattern;

  return emittedNames;
}

/** EventMap に宣言されていないイベント名を検出する */
function findUndeclaredEmittedEvents(srcDir: string): string[] {
  const emitted = extractEmittedEventNames(srcDir);
  const declared = new Set<string>(Object.keys({} as EventMap) as EventKey[]);
  // EventMap のキーを取得（型レベルではなく実行時で）
  // EventMap は interface なので実行時オブジェクトではない。
  // 代わりに、EventMap.ts のソースからキーを抽出する。
  const eventMapSource = fs.readFileSync(path.join(srcDir, 'engine/events/EventMap.ts'), 'utf-8');
  const keyPattern = /^\s*([a-z_]+)\s*:/gm;
  let match: RegExpExecArray | null;
  while ((match = keyPattern.exec(eventMapSource)) !== null) {
    declared.add(match[1]);
  }

  const undeclared: string[] = [];
  for (const name of emitted) {
    if (!declared.has(name)) {
      undeclared.push(name);
    }
  }
  return undeclared.sort();
}

describe('BU-1 段階1: EventMap の網羅性', () => {
  const srcDir = path.resolve(__dirname, '../../../src');

  it('EventMap は src/ 配下で emit されている全イベント名を包含する', () => {
    const undeclared = findUndeclaredEmittedEvents(srcDir);

    if (undeclared.length > 0) {
      // デバッグのため宣言済みキー一覧も出力
      const eventMapSource = fs.readFileSync(
        path.join(srcDir, 'engine/events/EventMap.ts'),
        'utf-8'
      );
      const declaredKeys: string[] = [];
      const keyPattern = /^\s*([a-z_]+)\s*:/gm;
      let match: RegExpExecArray | null;
      while ((match = keyPattern.exec(eventMapSource)) !== null) {
        declaredKeys.push(match[1]);
      }
      console.log('Declared EventMap keys:', declaredKeys);
      console.log('Undeclared emitted events:', undeclared);
    }

    expect(undeclared).toEqual([]);
  });

  it('EventMap は空でない（少なくとも1つのイベントが宣言されている）', () => {
    const eventMapSource = fs.readFileSync(path.join(srcDir, 'engine/events/EventMap.ts'), 'utf-8');
    const declaredKeys: string[] = [];
    const keyPattern = /^\s*([a-z_]+)\s*:/gm;
    let match: RegExpExecArray | null;
    while ((match = keyPattern.exec(eventMapSource)) !== null) {
      declaredKeys.push(match[1]);
    }
    expect(declaredKeys.length).toBeGreaterThan(0);
  });
});
