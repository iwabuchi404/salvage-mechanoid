import * as fs from 'fs';
import * as path from 'path';

/**
 * BU-1 段階1: EventMap の網羅テスト
 *
 * 1. EventMap のキー集合が、src/ 配下で emit されている名前集合を包含すること
 * 2. src/ 配下で on されている名前が、emit されている名前集合に含まれること（孤児検出）
 *
 * これにより、新しいイベントを emit したのに EventMap へ宣言し忘れる事故と、
 * 発行元が存在しないリスナー（孤児）の発生をテスト時点で検出できる。
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

/**
 * EventMap.ts のソースからトップレベルのキーのみを抽出する。
 * ネストしたフィールド名を誤って拾わないよう、
 * 2スペースインデントの行のみを対象とする。
 */
function extractEventMapKeys(eventMapSource: string): Set<string> {
  const keys = new Set<string>();
  // トップレベルのキーは行頭が2スペースで始まり、
  // その後に識別子とコロンが続く
  const keyPattern = /^  ([a-z_]+)\s*:/gm;
  let match: RegExpExecArray | null;
  while ((match = keyPattern.exec(eventMapSource)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

/** ソースコードから emit されているイベント名を抽出する */
function extractEmittedEventNames(srcDir: string): Set<string> {
  const files = collectSourceFiles(srcDir);
  const emittedNames = new Set<string>();
  const emitStringPattern = /\.emit\(\s*['"`]([^'"`]+)['"`]/g;

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
      const resolved = enumName.toLowerCase();
      emittedNames.add(resolved);
    }
  }

  return emittedNames;
}

/** ソースコードから on されているイベント名を抽出する */
function extractSubscribedEventNames(srcDir: string): Set<string> {
  const files = collectSourceFiles(srcDir);
  const subscribedNames = new Set<string>();
  const onStringPattern = /\.on\(\s*['"`]([^'"`]+)['"`]/g;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    let match: RegExpExecArray | null;
    while ((match = onStringPattern.exec(content)) !== null) {
      subscribedNames.add(match[1]);
    }
    // EventName.ENUM_VALUE の on を検出
    const enumOnPattern = /\.on\(\s*EventName\.([A-Z_]+)/g;
    while ((match = enumOnPattern.exec(content)) !== null) {
      const enumName = match[1];
      const resolved = enumName.toLowerCase();
      subscribedNames.add(resolved);
    }
  }

  return subscribedNames;
}

describe('BU-1 段階1: EventMap の網羅性', () => {
  const srcDir = path.resolve(__dirname, '../../../src');
  const eventMapPath = path.join(srcDir, 'engine/events/EventMap.ts');
  const eventMapSource = fs.readFileSync(eventMapPath, 'utf-8');
  const declaredKeys = extractEventMapKeys(eventMapSource);

  it('EventMap は空でない（少なくとも1つのイベントが宣言されている）', () => {
    expect(declaredKeys.size).toBeGreaterThan(0);
  });

  it('EventMap は src/ 配下で emit されている全イベント名を包含する', () => {
    const emitted = extractEmittedEventNames(srcDir);
    const undeclared: string[] = [];
    for (const name of emitted) {
      if (!declaredKeys.has(name)) {
        undeclared.push(name);
      }
    }

    if (undeclared.length > 0) {
      console.log('Declared EventMap keys:', [...declaredKeys].sort());
      console.log('Undeclared emitted events:', undeclared.sort());
    }

    expect(undeclared.sort()).toEqual([]);
  });

  it('src/ 配下で on されている全イベント名に対応する emit が存在する（孤児検出）', () => {
    const emitted = extractEmittedEventNames(srcDir);
    const subscribed = extractSubscribedEventNames(srcDir);

    const orphans: string[] = [];
    for (const name of subscribed) {
      if (!emitted.has(name)) {
        orphans.push(name);
      }
    }

    if (orphans.length > 0) {
      console.log('Emitted events:', [...emitted].sort());
      console.log('Orphan listeners (subscribed but never emitted):', orphans.sort());
    }

    expect(orphans.sort()).toEqual([]);
  });
});
