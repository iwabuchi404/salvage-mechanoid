import { TileMap } from '../../engine/world/TileMap';
import { TacticalMapGenerator } from '../../engine/world/TacticalMapGenerator';
import { FlexibleMapGenerator } from '../../engine/world/FlexibleMapGenerator';
import { MapEvaluator } from './MapEvaluator';
import { MapGenerationAlgorithm, StageType } from '../../engine/types';
import {
  TestConfig,
  TestReport,
  EvaluationResult,
  AggregatedStats,
  MetricStats,
  EvaluationMetrics,
  PlacementStatistics,
} from './types';

/**
 * マップテスタークラス
 * 複数のマップを生成して評価する
 */
export class MapTester {
  private evaluator: MapEvaluator;

  constructor() {
    this.evaluator = new MapEvaluator();
  }

  /**
   * 簡略化されたステージタイプ名を実際のStageTypeに変換
   */
  private mapStageType(stageType?: string): StageType | undefined {
    if (!stageType) return undefined;

    const stageTypeMap: { [key: string]: StageType } = {
      energy: StageType.ENERGY_MANAGEMENT,
      combat: StageType.TACTICAL_COMBAT,
      stealth: StageType.STEALTH_MISSION,
      resource: StageType.RESOURCE_CONTROL,
    };

    return stageTypeMap[stageType] || StageType.CLASSIC;
  }

  /**
   * テストを実行
   * @param config テスト設定
   * @returns テストレポート
   */
  async runTest(config: TestConfig): Promise<TestReport> {
    console.log(`\n=== マップ評価テスト開始 ===`);
    console.log(`生成タイプ: ${config.generatorType}`);
    if (config.stageType) {
      console.log(`ステージタイプ: ${config.stageType}`);
    }
    console.log(`マップサイズ: ${config.mapSize.width}x${config.mapSize.height}`);
    console.log(`生成回数: ${config.iterations}`);
    if (config.seed !== undefined) {
      console.log(`シード値: ${config.seed}`);
    }
    console.log();

    const results: EvaluationResult[] = [];

    for (let i = 0; i < config.iterations; i++) {
      console.log(`[${i + 1}/${config.iterations}] マップ生成中...`);

      try {
        // タイムアウト付きでマップ生成（部屋情報と配置情報も取得）
        const mapData = await Promise.race([
          this.generateMap(config, i),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('マップ生成がタイムアウトしました (30秒)')), 30000)
          ),
        ]);

        const result = this.evaluator.evaluate(
          mapData.tileMap,
          config.visualize,
          mapData.rooms,
          mapData.obstacles,
          mapData.items,
          mapData.enemies
        );

        // 配置情報を追加
        if (mapData.obstacles || mapData.items || mapData.enemies) {
          result.placement = this.calculatePlacementStatistics(
            mapData.obstacles,
            mapData.items,
            mapData.enemies
          );
        }

        results.push(result);

        console.log(
          `  スコア: ${result.score}, 有効: ${result.isValid ? 'はい' : 'いいえ'}, 問題: ${
            result.issues.length
          }件`
        );

        // 配置情報があれば表示
        if (result.placement) {
          console.log(
            `  配置: 障害物=${result.placement.obstacleCount}, アイテム=${result.placement.itemCount}, 敵=${result.placement.enemyCount}`
          );
        }
      } catch (error) {
        console.error(`  エラー: ${error instanceof Error ? error.message : String(error)}`);
        // エラーが発生しても次の生成を続行
      }
    }

    const aggregated = this.aggregateResults(results);
    const timestamp = new Date().toISOString();

    return {
      config,
      results,
      aggregated,
      timestamp,
    };
  }

  /**
   * マップを生成
   */
  private async generateMap(
    config: TestConfig,
    iteration: number
  ): Promise<{
    tileMap: TileMap;
    rooms: any[];
    obstacles?: any[];
    items?: any[];
    enemies?: any[];
  }> {
    const { width, height } = config.mapSize;
    const tileMap = new TileMap(width, height);
    let rooms: any[] = [];
    let obstacles: any[] | undefined;
    let items: any[] | undefined;
    let enemies: any[] | undefined;

    // シード値は現時点では未対応（将来的にはランダムシード対応）
    // const seed = config.seed !== undefined ? config.seed + iteration : Date.now() + iteration

    if (config.generatorType === 'tactical') {
      const generator = new TacticalMapGenerator(width, height);
      const stageType = this.mapStageType(config.stageType) || StageType.ENERGY_MANAGEMENT;

      // 完全なGenerationConfigを作成（stageTypeを含む）
      const generationConfig = this.createDefaultGenerationConfig(width, height, stageType);

      // 生成結果を取得してTileMapに反映
      const result = await generator.generateTacticalMapWithConfig(generationConfig);

      // 結果をTileMapに書き込む
      this.applyResultToTileMap(tileMap, result.map);
      rooms = result.rooms || [];
      obstacles = result.obstacles;
      items = result.items;
      enemies = result.enemies;
    } else if (config.generatorType === 'flexible') {
      const generator = new FlexibleMapGenerator(width, height);

      // flexibleの場合はstageTypeを指定しない（無限ループ回避）
      const generationConfig = this.createDefaultGenerationConfig(width, height, undefined);
      const result = await generator.generate(generationConfig);

      this.applyResultToTileMap(tileMap, result.map);
      rooms = result.rooms || [];
      obstacles = result.obstacles;
      items = result.items;
      enemies = result.enemies;
    } else {
      throw new Error(`未知のジェネレータータイプ: ${config.generatorType}`);
    }

    return { tileMap, rooms, obstacles, items, enemies };
  }

  /**
   * デフォルトのGenerationConfigを作成
   */
  private createDefaultGenerationConfig(width: number, height: number, stageType?: StageType): any {
    const config: any = {
      width,
      height,
      algorithm: MapGenerationAlgorithm.BSP,
      roomConfig: {
        minSize: 6,
        maxSize: 12,
        density: 0.7,
        connectivity: 0.8,
        roomTypes: ['normal', 'boss', 'treasure', 'entrance', 'exit'],
      },
      corridorConfig: {
        method: 'astar',
        width: 2, // デフォルト値
        minWidth: 1, // 最小幅
        maxWidth: 3, // 最大幅（通路ごとにランダム化）
        redundancy: 0.4,
        allowDiagonal: false,
      },
      featureConfig: {
        method: 'basic',
        density: 0.0, // フィーチャー配置を無効化（評価専用）
        rules: [],
        themeFeatures: [],
        globalRules: [],
      },
      postProcessing: {
        ensureConnectivity: true,
        balanceFeatures: true,
        optimizePerformance: false,
      },
      // 統合配置システム設定
      obstaclePlacementConfig: {
        minObstacles: 5,
        maxObstacles: 20,
        obstacleTypes: ['crate', 'barrel', 'wall', 'debris', 'console'],
        coverDensity: 0.4, // 40%の遮蔽物密度
        placementRules: [],
      },
      itemPlacementConfig: {
        minItems: 5,
        maxItems: 15,
        rarityDistribution: {
          common: 0.6, // 60%
          uncommon: 0.25, // 25%
          rare: 0.12, // 12%
          legendary: 0.03, // 3%
        },
        itemTypes: ['energy', 'health', 'key', 'weapon', 'armor', 'upgrade', 'consumable'],
        placementRules: [],
      },
      enemyPlacementConfig: {
        minEnemies: 3,
        maxEnemies: 12,
        difficultyLevel: 5, // 中難易度
        allowBoss: true,
        enemyTypes: ['scout', 'soldier', 'heavy', 'turret', 'boss'],
        placementRules: [],
      },
    };

    // tacticalの場合のみstageTypeを追加
    if (stageType !== undefined) {
      config.stageType = stageType;
    }

    return config;
  }

  /**
   * 生成結果の2次元配列をTileMapに適用
   */
  private applyResultToTileMap(tileMap: TileMap, mapData: number[][]): void {
    tileMap.importMapData(mapData);
  }

  /**
   * 配置情報の統計を計算
   */
  private calculatePlacementStatistics(obstacles?: any[], items?: any[], enemies?: any[]): any {
    const stats: any = {
      obstacleCount: obstacles?.length || 0,
      itemCount: items?.length || 0,
      enemyCount: enemies?.length || 0,
    };

    // アイテムのレアリティ別集計
    if (items && items.length > 0) {
      stats.itemsByRarity = {
        common: items.filter((i) => i.rarity === 'common').length,
        uncommon: items.filter((i) => i.rarity === 'uncommon').length,
        rare: items.filter((i) => i.rarity === 'rare').length,
        legendary: items.filter((i) => i.rarity === 'legendary').length,
      };
    }

    // 敵のタイプ別集計
    if (enemies && enemies.length > 0) {
      stats.enemiesByType = {
        scout: enemies.filter((e) => e.type === 'scout').length,
        soldier: enemies.filter((e) => e.type === 'soldier').length,
        heavy: enemies.filter((e) => e.type === 'heavy').length,
        turret: enemies.filter((e) => e.type === 'turret').length,
        boss: enemies.filter((e) => e.type === 'boss').length,
      };
    }

    return stats;
  }

  /**
   * 結果を集計
   */
  private aggregateResults(results: EvaluationResult[]): AggregatedStats {
    if (results.length === 0) {
      return {
        averageScore: 0,
        successRate: 0,
        metrics: this.createEmptyMetricStats(),
      };
    }

    const validResults = results.filter((r) => r.isValid);
    const successRate = validResults.length / results.length;

    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const averageScore = totalScore / results.length;

    // 各メトリクスの統計を計算
    const metricKeys: Array<keyof EvaluationMetrics> = [
      'connectivity',
      'roomCount',
      'roomSizeVariance',
      'roomDistribution',
      'corridorEfficiency',
    ];

    const metrics: { [K in keyof EvaluationMetrics]: MetricStats } = {} as any;

    for (const key of metricKeys) {
      const values = results.map((r) => r.metrics[key]);
      metrics[key] = this.calculateMetricStats(values);
    }

    return {
      averageScore,
      successRate,
      metrics,
    };
  }

  /**
   * メトリクスの統計を計算
   */
  private calculateMetricStats(values: number[]): MetricStats {
    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, stdDev: 0 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    // 標準偏差
    const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, avg, stdDev };
  }

  /**
   * 空のメトリクス統計を作成
   */
  private createEmptyMetricStats(): { [K in keyof EvaluationMetrics]: MetricStats } {
    const empty: MetricStats = { min: 0, max: 0, avg: 0, stdDev: 0 };
    return {
      connectivity: { ...empty },
      roomCount: { ...empty },
      roomSizeVariance: { ...empty },
      roomDistribution: { ...empty },
      corridorEfficiency: { ...empty },
    };
  }

  /**
   * レポートを生成（テキスト形式）
   */
  generateReport(report: TestReport): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('マップ評価レポート');
    lines.push('='.repeat(60));
    lines.push(`生成日時: ${new Date(report.timestamp).toLocaleString('ja-JP')}`);
    lines.push(`設定: ${report.config.generatorType}`);
    if (report.config.stageType) {
      lines.push(`  ステージタイプ: ${report.config.stageType}`);
    }
    lines.push(`マップサイズ: ${report.config.mapSize.width}x${report.config.mapSize.height}`);
    lines.push(`生成回数: ${report.config.iterations}`);
    lines.push();

    // 集計結果
    lines.push('--- 集計結果 ---');
    lines.push(
      `成功率: ${(report.aggregated.successRate * 100).toFixed(1)}% (${
        report.results.filter((r) => r.isValid).length
      }/${report.results.length})`
    );
    lines.push(`平均スコア: ${report.aggregated.averageScore.toFixed(1)}`);
    lines.push();

    // 指標統計
    lines.push('--- 指標統計 ---');
    const metricLabels: { [K in keyof EvaluationMetrics]: string } = {
      connectivity: '接続性',
      roomCount: '部屋数',
      roomSizeVariance: '部屋サイズ分散',
      roomDistribution: '部屋配置偏り',
      corridorEfficiency: '通路効率',
    };

    for (const [key, label] of Object.entries(metricLabels)) {
      const stats = report.aggregated.metrics[key as keyof EvaluationMetrics];
      lines.push(`${label}:`);
      lines.push(
        `  平均: ${stats.avg.toFixed(2)} (min: ${stats.min.toFixed(2)}, max: ${stats.max.toFixed(
          2
        )}, σ: ${stats.stdDev.toFixed(2)})`
      );
    }
    lines.push();

    // 検出された問題
    const allIssues = report.results.flatMap((r, i) =>
      r.issues.map((issue) => ({ index: i, issue }))
    );
    if (allIssues.length > 0) {
      lines.push('--- 検出された問題 ---');
      for (const { index, issue } of allIssues) {
        lines.push(`- Map #${index + 1}: ${issue}`);
      }
      lines.push();
    }

    // 各マップの詳細（オプション）
    if (report.config.visualize) {
      lines.push('--- 各マップの詳細 ---');
      for (let i = 0; i < report.results.length; i++) {
        const result = report.results[i];
        lines.push(`\nMap #${i + 1}:`);
        lines.push(`  スコア: ${result.score}`);
        lines.push(`  有効: ${result.isValid ? 'はい' : 'いいえ'}`);
        lines.push(
          `  床タイル: ${result.statistics.floorTiles} (${(
            result.statistics.floorRatio * 100
          ).toFixed(1)}%)`
        );
        lines.push(`  部屋数: ${result.metrics.roomCount}`);
        lines.push(`  接続性: ${(result.metrics.connectivity * 100).toFixed(1)}%`);

        // 配置情報を表示
        if (result.placement) {
          lines.push(`  配置:`);
          lines.push(`    障害物: ${result.placement.obstacleCount}`);
          lines.push(`    アイテム: ${result.placement.itemCount}`);
          lines.push(`    敵: ${result.placement.enemyCount}`);

          if (result.placement.itemsByRarity) {
            lines.push(`    アイテム内訳:`);
            lines.push(
              `      Common: ${result.placement.itemsByRarity.common}, Uncommon: ${result.placement.itemsByRarity.uncommon}, Rare: ${result.placement.itemsByRarity.rare}, Legendary: ${result.placement.itemsByRarity.legendary}`
            );
          }

          if (result.placement.enemiesByType) {
            lines.push(`    敵内訳:`);
            lines.push(
              `      Scout: ${result.placement.enemiesByType.scout}, Soldier: ${result.placement.enemiesByType.soldier}, Heavy: ${result.placement.enemiesByType.heavy}, Turret: ${result.placement.enemiesByType.turret}, Boss: ${result.placement.enemiesByType.boss}`
            );
          }
        }

        if (result.issues.length > 0) {
          lines.push(`  問題: ${result.issues.join(', ')}`);
        }

        if (result.asciiMap) {
          lines.push('\n  ASCII表示:');
          lines.push(
            result.asciiMap
              .split('\n')
              .map((line) => '    ' + line)
              .join('\n')
          );
        }
      }
    }

    return lines.join('\n');
  }
}
