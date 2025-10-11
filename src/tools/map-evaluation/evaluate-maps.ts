import * as fs from 'fs';
import * as path from 'path';
import { MapTester } from './MapTester';
import { TestConfig } from './types';

/**
 * コマンドライン引数をパース
 */
function parseArgs(): TestConfig & { output?: string } {
  const args = process.argv.slice(2);

  const config: TestConfig & { output?: string } = {
    generatorType: 'tactical',
    iterations: 10,
    mapSize: { width: 80, height: 60 },
    visualize: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--type':
        if (args[i + 1] === 'tactical' || args[i + 1] === 'flexible') {
          config.generatorType = args[i + 1] as 'tactical' | 'flexible';
        }
        i++;
        break;

      case '--stage':
        if (['energy', 'combat', 'stealth', 'resource'].includes(args[i + 1])) {
          config.stageType = args[i + 1] as 'energy' | 'combat' | 'stealth' | 'resource';
        }
        i++;
        break;

      case '--count':
        config.iterations = parseInt(args[i + 1], 10);
        i++;
        break;

      case '--seed':
        config.seed = parseInt(args[i + 1], 10);
        i++;
        break;

      case '--width':
        config.mapSize.width = parseInt(args[i + 1], 10);
        i++;
        break;

      case '--height':
        config.mapSize.height = parseInt(args[i + 1], 10);
        i++;
        break;

      case '--output':
        config.output = args[i + 1];
        i++;
        break;

      case '--visualize':
        config.visualize = args[i + 1] !== 'false';
        i++;
        break;

      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return config;
}

/**
 * ヘルプメッセージを表示
 */
function printHelp() {
  console.log(`
マップ評価ツール
使用方法: npm run evaluate-maps -- [オプション]

オプション:
  --type <type>        ジェネレータータイプ (tactical | flexible) デフォルト: tactical
  --stage <stage>      ステージタイプ (energy | combat | stealth | resource) ※tacticalのみ
                       energy: エネルギー管理重視
                       combat: 戦術的戦闘重視
                       stealth: 隠密行動重視
                       resource: リソース争奪戦
  --count <number>     生成回数 デフォルト: 10
  --seed <number>      シード値
  --width <number>     マップ幅 デフォルト: 80
  --height <number>    マップ高さ デフォルト: 60
  --output <path>      結果の出力先JSONファイル
  --visualize <bool>   ASCII可視化を表示 (true | false) デフォルト: false
  --help, -h           このヘルプを表示

例:
  npm run evaluate-maps -- --type tactical --stage energy --count 10
  npm run evaluate-maps -- --type flexible --count 50 --output results.json
  npm run evaluate-maps -- --type tactical --stage combat --count 5 --visualize true
  `);
}

/**
 * メイン処理
 */
async function main() {
  console.log('マップ評価ツール起動\n');

  const config = parseArgs();
  const tester = new MapTester();

  try {
    const report = await tester.runTest(config);

    // レポート生成
    const reportText = tester.generateReport(report);
    console.log('\n' + reportText);

    // JSON出力
    if (config.output) {
      const outputPath = path.resolve(config.output);
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`\n結果をJSONファイルに保存しました: ${outputPath}`);
    }

    // 終了コード
    const successRate = report.aggregated.successRate;
    if (successRate < 0.5) {
      console.log('\n警告: 成功率が50%未満です');
      process.exit(1);
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// エントリーポイント
main();
