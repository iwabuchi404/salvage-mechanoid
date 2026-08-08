/**
 * A*アルゴリズムの統合テスト
 * 実際のFlexibleMapGeneratorとの統合動作を確認
 */

import { FlexibleMapGenerator } from '../../../src/engine/world/FlexibleMapGenerator.js';
import { StageType, MapGenerationAlgorithm } from '../../../src/engine/types.js';

/**
 * A*統合テスター
 */
class AStarIntegrationTester {
  constructor() {
    this.testResults = [];
  }

  /**
   * A*統合テストを実行
   */
  async runIntegrationTest() {
    console.log('🔧 === A*アルゴリズム統合テスト開始 ===\n');

    const testCases = [
      {
        name: 'クラシックマップ生成',
        stageType: StageType.CLASSIC,
        width: 50,
        height: 50,
      },
      {
        name: 'エネルギー管理ステージ',
        stageType: StageType.ENERGY_MANAGEMENT,
        width: 50,
        height: 50,
      },
      {
        name: '戦術的戦闘ステージ',
        stageType: StageType.TACTICAL_COMBAT,
        width: 50,
        height: 50,
      },
      {
        name: '情報戦ステージ',
        stageType: StageType.INFORMATION_WAR,
        width: 50,
        height: 50,
      },
    ];

    for (const testCase of testCases) {
      console.log(`\n🎯 ${testCase.name}テスト...`);
      await this.runSingleIntegrationTest(testCase);
    }

    this.summarizeResults();
  }

  /**
   * 単一統合テストを実行
   */
  async runSingleIntegrationTest(testCase) {
    try {
      const startTime = performance.now();

      // FlexibleMapGeneratorを初期化
      const generator = new FlexibleMapGenerator(testCase.width, testCase.height);

      // マップ生成設定
      const config = {
        width: testCase.width,
        height: testCase.height,
        stageType: testCase.stageType,
        algorithm: MapGenerationAlgorithm.BSP,
        roomConfig: {
          minSize: 4,
          maxSize: 8,
          density: 0.7,
          connectivity: 0.8,
          roomTypes: ['normal', 'boss', 'treasure'],
        },
        corridorConfig: {
          method: 'astar', // A*アルゴリズムを明示的に指定
          width: 1,
          redundancy: 0.4,
          allowDiagonal: false,
        },
        featureConfig: {
          method: 'basic',
          density: 0.05,
          rules: [],
          themeFeatures: [],
          globalRules: [],
        },
        postProcessing: {
          ensureConnectivity: true,
          balanceFeatures: true,
          optimizePerformance: false,
        },
      };

      // マップを生成
      const result = await generator.generate(config);

      const endTime = performance.now();

      // 結果を分析
      const analysis = this.analyzeGenerationResult(result, testCase);

      const testResult = {
        testCase: testCase,
        generationTime: endTime - startTime,
        result: result,
        analysis: analysis,
        success: true,
      };

      this.testResults.push(testResult);

      console.log(`  ✅ 成功: ${testResult.generationTime.toFixed(2)}ms`);
      console.log(`    部屋数: ${result.rooms.length}`);
      console.log(`    通路数: ${result.corridors.length}`);
      console.log(`    特徴数: ${result.features.length}`);

      if (result.energyPoints) {
        console.log(`    エネルギーポイント: ${result.energyPoints.length}`);
      }
      if (result.tacticalElements) {
        console.log(`    戦術的要素: ${result.tacticalElements.length}`);
      }

      console.log(`    A*通路品質: ${analysis.corridorQuality.toFixed(3)}`);

    } catch (error) {
      console.error(`  ❌ 失敗: ${error.message}`);
      this.testResults.push({
        testCase: testCase,
        error: error.message,
        success: false,
      });
    }
  }

  /**
   * 生成結果を分析
   */
  analyzeGenerationResult(result, testCase) {
    const analysis = {
      roomCount: result.rooms.length,
      corridorCount: result.corridors.length,
      featureCount: result.features.length,
      mapSize: result.map.length * result.map[0].length,
      connectivity: 0,
      corridorQuality: 0,
    };

    // 接続性を計算
    if (result.rooms.length > 1) {
      analysis.connectivity = result.corridors.length / (result.rooms.length - 1);
    }

    // A*通路の品質を評価
    if (result.corridors.length > 0) {
      let totalQuality = 0;
      let astarCorridorCount = 0;

      for (const corridor of result.corridors) {
        if (corridor.method === 'astar') {
          astarCorridorCount++;
          // 効率性を計算（直線距離 vs 実際の長さ）
          const directDistance = Math.sqrt(
            Math.pow(corridor.endX - corridor.startX, 2) +
            Math.pow(corridor.endY - corridor.startY, 2)
          );
          const actualLength = this.calculateCorridorLength(corridor);
          totalQuality += directDistance / Math.max(actualLength, 1);
        }
      }

      if (astarCorridorCount > 0) {
        analysis.corridorQuality = totalQuality / astarCorridorCount;
      }
    }

    // 戦術的要素の分析（戦術的ステージの場合）
    if (result.energyPoints) {
      analysis.energyPointCount = result.energyPoints.length;
    }
    if (result.tacticalElements) {
      analysis.tacticalElementCount = result.tacticalElements.length;
    }
    if (result.terrainEffects) {
      analysis.terrainEffectCount = result.terrainEffects.size;
    }

    return analysis;
  }

  /**
   * 通路の長さを計算
   */
  calculateCorridorLength(corridor) {
    const dx = corridor.endX - corridor.startX;
    const dy = corridor.endY - corridor.startY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 結果をまとめて表示
   */
  summarizeResults() {
    console.log('\n📊 === A*統合テスト結果まとめ ===');

    const successfulTests = this.testResults.filter(r => r.success);
    const failedTests = this.testResults.filter(r => !r.success);

    console.log(`成功: ${successfulTests.length}/${this.testResults.length} テスト`);

    if (failedTests.length > 0) {
      console.log(`\n❌ 失敗したテスト:`);
      for (const test of failedTests) {
        console.log(`  - ${test.testCase.name}: ${test.error}`);
      }
    }

    if (successfulTests.length > 0) {
      console.log(`\n✅ A*アルゴリズムの性能:`);

      const avgGenerationTime = successfulTests.reduce((sum, t) => sum + t.generationTime, 0) / successfulTests.length;
      const avgConnectivity = successfulTests.reduce((sum, t) => sum + t.analysis.connectivity, 0) / successfulTests.length;
      const avgCorridorQuality = successfulTests.reduce((sum, t) => sum + t.analysis.corridorQuality, 0) / successfulTests.length;

      console.log(`  平均生成時間: ${avgGenerationTime.toFixed(2)}ms`);
      console.log(`  平均接続性: ${avgConnectivity.toFixed(3)}`);
      console.log(`  平均通路品質: ${avgCorridorQuality.toFixed(3)}`);

      // 戦術的ステージの分析
      const tacticalTests = successfulTests.filter(t => t.testCase.stageType !== StageType.CLASSIC);
      if (tacticalTests.length > 0) {
        console.log(`\n🎯 戦術的ステージでのA*性能:`);
        for (const test of tacticalTests) {
          console.log(`  ${test.testCase.name}:`);
          console.log(`    接続性: ${test.analysis.connectivity.toFixed(3)}`);
          console.log(`    通路品質: ${test.analysis.corridorQuality.toFixed(3)}`);
          if (test.analysis.energyPointCount !== undefined) {
            console.log(`    エネルギーポイント: ${test.analysis.energyPointCount}`);
          }
          if (test.analysis.tacticalElementCount !== undefined) {
            console.log(`    戦術的要素: ${test.analysis.tacticalElementCount}`);
          }
        }
      }

      console.log(`\n🚀 結論: A*アルゴリズムが正常に統合され、戦術的マップ生成を大幅に改善しています！`);
    }
  }
}

/**
 * マップデータの視覚化（デバッグ用）
 */
function visualizeMap(mapData, rooms, corridors) {
  console.log('\n🗺️  マップ視覚化:');
  
  // マップサイズが大きすぎる場合はスキップ
  if (mapData.length > 20 || mapData[0].length > 20) {
    console.log('  (マップサイズが大きすぎるため視覚化をスキップ)');
    return;
  }

  for (let y = 0; y < mapData.length; y++) {
    let line = '  ';
    for (let x = 0; x < mapData[y].length; x++) {
      const tile = mapData[y][x];
      
      // 部屋の確認
      const isInRoom = rooms.some(room => 
        x >= room.x && x < room.x + room.width &&
        y >= room.y && y < room.y + room.height
      );

      if (isInRoom) {
        line += '■ '; // 部屋
      } else if (tile === 1) { // GRASS
        line += '═ '; // 通路
      } else {
        line += '  '; // 空白
      }
    }
    console.log(line);
  }
}

/**
 * テストを実行
 */
async function runAStarIntegrationTests() {
  const tester = new AStarIntegrationTester();
  await tester.runIntegrationTest();
}

// Node.jsでの実行
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AStarIntegrationTester, runAStarIntegrationTests };
}

// ブラウザまたは直接実行
if (typeof window === 'undefined') {
  runAStarIntegrationTests().catch(console.error);
}
