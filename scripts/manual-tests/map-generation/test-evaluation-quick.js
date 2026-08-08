// 簡易テストスクリプト - 評価システムの動作確認用
const { execSync } = require('child_process');

console.log('=== マップ評価システム 動作確認 ===\n');

try {
  console.log('1. TypeScript型チェック中...');
  execSync('npx tsc --noEmit src/tools/map-evaluation/evaluate-maps.ts', {
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('✓ 型チェック成功\n');

  console.log('2. 評価ツール実行中（3回生成、可視化あり）...');
  execSync('npx ts-node src/tools/map-evaluation/evaluate-maps.ts --count 3 --visualize true', {
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('\n✓ 実行成功');
} catch (error) {
  console.error('エラーが発生しました:', error.message);
  process.exit(1);
}
