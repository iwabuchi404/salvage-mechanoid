import {
  GenerationConfig,
  MapGenerationResult,
  TacticalMapGenerationResult,
  StageType,
  MapGenerationAlgorithm,
  CorridorGenerationMethod,
  RoomType,
} from '../types';
import { FlexibleMapGenerator } from './FlexibleMapGenerator';
import { TacticalMapGenerator } from './TacticalMapGenerator';

/**
 * マップジェネレーターのファサード
 *
 * 設定に基づいて適切なジェネレーターを選択し、マップを生成する。
 * FlexibleMapGeneratorとTacticalMapGeneratorの使い分けを担当。
 */
export class MapGeneratorFacade {
  private width: number;
  private height: number;

  /**
   * コンストラクタ
   * @param width マップの幅
   * @param height マップの高さ
   */
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * 設定に基づいてマップを生成
   * @param config 生成設定
   * @returns 生成されたマップデータ
   */
  async generate(
    config: GenerationConfig
  ): Promise<MapGenerationResult | TacticalMapGenerationResult> {
    // ステージタイプに基づいてジェネレーターを選択
    if (config.stageType && config.stageType !== StageType.CLASSIC) {
      // 戦術的モード
      console.log(`Using TacticalMapGenerator for stage type: ${config.stageType}`);
      const tacticalGenerator = new TacticalMapGenerator(this.width, this.height);
      return await tacticalGenerator.generate(config);
    } else {
      // クラシックモード
      console.log('Using FlexibleMapGenerator for classic mode');
      const flexibleGenerator = new FlexibleMapGenerator(this.width, this.height);
      return await flexibleGenerator.generate(config);
    }
  }

  /**
   * 戦術的マップを生成（簡易メソッド）
   * @param stageType ステージタイプ
   * @param options 追加オプション
   * @returns 戦術的マップ生成結果
   */
  async generateTacticalMap(
    stageType: StageType,
    options: {
      minRoomSize?: number;
      maxRoomSize?: number;
      energyTightness?: 'relaxed' | 'balanced' | 'tight';
      playerLevel?: number;
    } = {}
  ): Promise<TacticalMapGenerationResult> {
    const config: GenerationConfig = {
      width: this.width,
      height: this.height,
      algorithm: MapGenerationAlgorithm.BSP,
      stageType: stageType,
      roomConfig: {
        minSize: options.minRoomSize || 4,
        maxSize: options.maxRoomSize || 8,
        density: 0.7,
        connectivity: 0.8,
        roomTypes: [RoomType.NORMAL, RoomType.BOSS, RoomType.TREASURE],
      },
      corridorConfig: {
        method: CorridorGenerationMethod.ASTAR,
        width: 1,
        redundancy: 0.3,
        allowDiagonal: false,
      },
      featureConfig: {
        method: 'basic',
        density: 0.5,
        rules: [],
        themeFeatures: [],
        globalRules: [],
      },
      tacticalConfig: {
        energyTightness: options.energyTightness || 'balanced',
        primaryTacticalFocus: 'mixed',
        playerLevel: options.playerLevel || 1,
        tacticalElementDensity: 0.5,
        energyPointConfig: {
          density: 0.3,
          types: [],
          strategicPlacement: true,
        },
        terrainEffectConfig: {
          enabled: true,
          density: 0.2,
          types: [],
        },
        tacticalElementConfig: {
          enabled: true,
          density: 0.3,
          types: [],
        },
      },
      postProcessing: {
        ensureConnectivity: true,
        balanceFeatures: true,
        optimizePerformance: false,
      },
    };

    const tacticalGenerator = new TacticalMapGenerator(this.width, this.height);
    return await tacticalGenerator.generate(config);
  }

  /**
   * 基本マップを生成（簡易メソッド）
   * @param minRoomSize 最小部屋サイズ
   * @param maxRoomSize 最大部屋サイズ
   * @param stageType ステージタイプ（オプション）
   * @returns マップ生成結果
   */
  async generateMap(
    minRoomSize = 4,
    maxRoomSize = 8,
    stageType?: StageType
  ): Promise<MapGenerationResult | TacticalMapGenerationResult> {
    const config: GenerationConfig = {
      width: this.width,
      height: this.height,
      algorithm: MapGenerationAlgorithm.BSP,
      stageType: stageType,
      roomConfig: {
        minSize: minRoomSize,
        maxSize: maxRoomSize,
        density: 0.7,
        connectivity: 0.8,
        roomTypes: [RoomType.NORMAL, RoomType.BOSS, RoomType.TREASURE],
      },
      corridorConfig: {
        method: CorridorGenerationMethod.ASTAR,
        width: 1,
        redundancy: 0.3,
        allowDiagonal: false,
      },
      featureConfig: {
        method: 'basic',
        density: 0.5,
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

    return await this.generate(config);
  }
}
