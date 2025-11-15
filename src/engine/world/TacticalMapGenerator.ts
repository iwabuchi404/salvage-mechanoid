import {
  GenerationConfig,
  TacticalGenerationConfig,
  TacticalMapGenerationResult,
  StageType,
  EnergyPoint,
  EnergyPointType,
  TacticalElement,
  TacticalElementType,
  TileEffect,
  Room,
} from '../types';
import { FlexibleMapGenerator } from './FlexibleMapGenerator';
import { EnergyPointPlacer } from './tactical/EnergyPointPlacer';
import { TerrainEffectPlacer } from './tactical/TerrainEffectPlacer';
import { TacticalElementPlacer } from './tactical/TacticalElementPlacer';

/**
 * 戦術的マップジェネレーター
 * ステージタイプに応じて戦術的要素を付加したマップを生成
 *
 * FlexibleMapGeneratorをコンポジションで使用し、
 * 基本マップに戦術的要素を追加する責務を持つ
 */
export class TacticalMapGenerator {
  private baseGenerator: FlexibleMapGenerator;
  private energyPointPlacer: EnergyPointPlacer;
  private terrainEffectPlacer: TerrainEffectPlacer;
  private tacticalElementPlacer: TacticalElementPlacer;

  constructor(width: number, height: number) {
    this.baseGenerator = new FlexibleMapGenerator(width, height);
    this.energyPointPlacer = new EnergyPointPlacer(width, height);
    this.terrainEffectPlacer = new TerrainEffectPlacer(width, height);
    this.tacticalElementPlacer = new TacticalElementPlacer(width, height);
  }

  /**
   * 戦術的マップを生成（メインメソッド）
   * @param config 生成設定
   * @returns 戦術的マップ生成結果
   */
  async generate(config: GenerationConfig): Promise<TacticalMapGenerationResult> {
    console.log(`Generating tactical map for stage type: ${config.stageType || 'classic'}`);

    // 1. 基本マップを生成（コンポジションで使用）
    const baseMap = await this.baseGenerator.generate(config);

    // 2. ステージタイプが指定されていない場合はクラシックモード
    if (!config.stageType || config.stageType === StageType.CLASSIC) {
      return this.convertToTacticalResult(baseMap);
    }

    // 3. 戦術的要素を追加
    const tacticalElements = await this.addTacticalElements(baseMap, config);

    return tacticalElements;
  }

  /**
   * ステージタイプに基づいて戦術的マップを生成（互換性メソッド）
   * @param config 生成設定
   * @returns 戦術的マップ生成結果
   * @deprecated generate()を使用してください
   */
  async generateTacticalMapWithConfig(
    config: GenerationConfig
  ): Promise<TacticalMapGenerationResult> {
    return this.generate(config);
  }

  /**
   * 基本マップ結果を戦術的マップ結果に変換
   */
  private convertToTacticalResult(baseMap: any): TacticalMapGenerationResult {
    return {
      map: baseMap.map,
      rooms: baseMap.rooms,
      corridors: baseMap.corridors,
      features: baseMap.features,
      obstacles: baseMap.obstacles,
      items: baseMap.items,
      enemies: baseMap.enemies,
      energyPoints: [],
      tacticalElements: [],
      terrainEffects: new Map<string, TileEffect>(),
      tacticalMetadata: {
        estimatedEnergyConsumption: 100,
        availableEnergyRecovery: 100,
        tacticalChoicePoints: 0,
        recommendedSkills: [],
        difficultyRating: 1.0,
      },
      metadata: baseMap.metadata,
    };
  }

  /**
   * 戦術的要素を追加
   */
  private async addTacticalElements(
    baseMap: any,
    config: GenerationConfig
  ): Promise<TacticalMapGenerationResult> {
    const tacticalConfig =
      config.tacticalConfig || this.getDefaultTacticalConfig(config.stageType!);

    // 戦術的要素の初期化
    const energyPoints: EnergyPoint[] = [];
    const tacticalElements: TacticalElement[] = [];
    const terrainEffects = new Map<string, TileEffect>();

    // ステージタイプ別の戦術的要素生成
    switch (config.stageType) {
      case StageType.ENERGY_MANAGEMENT:
        await this.generateEnergyManagementStage(
          baseMap,
          tacticalConfig,
          energyPoints,
          tacticalElements,
          terrainEffects
        );
        break;

      case StageType.TACTICAL_COMBAT:
        await this.generateTacticalCombatStage(
          baseMap,
          tacticalConfig,
          energyPoints,
          tacticalElements,
          terrainEffects
        );
        break;

      case StageType.INFORMATION_WAR:
        await this.generateInformationWarStage(
          baseMap,
          tacticalConfig,
          energyPoints,
          tacticalElements,
          terrainEffects
        );
        break;

      default:
        console.warn(`Unknown stage type: ${config.stageType}, using default tactical elements`);
        await this.generateDefaultTacticalStage(
          baseMap,
          tacticalConfig,
          energyPoints,
          tacticalElements,
          terrainEffects
        );
        break;
    }

    // 戦術的メタデータを計算
    const tacticalMetadata = this.calculateTacticalMetadata(
      baseMap,
      energyPoints,
      tacticalElements,
      terrainEffects,
      tacticalConfig
    );

    return {
      map: baseMap.map,
      rooms: baseMap.rooms,
      corridors: baseMap.corridors,
      features: baseMap.features,
      obstacles: baseMap.obstacles,
      items: baseMap.items,
      enemies: baseMap.enemies,
      energyPoints,
      tacticalElements,
      terrainEffects,
      tacticalMetadata,
      metadata: baseMap.metadata,
    };
  }

  /**
   * エネルギー管理ステージの生成
   */
  private async generateEnergyManagementStage(
    baseMap: any,
    config: TacticalGenerationConfig,
    energyPoints: EnergyPoint[],
    tacticalElements: TacticalElement[],
    terrainEffects: Map<string, TileEffect>
  ): Promise<void> {
    console.log('Generating Energy Management stage');

    // エネルギーポイントの戦略的配置
    const strategicEnergyPoints = this.energyPointPlacer.placeStrategicEnergyPoints(
      baseMap.rooms,
      config
    );
    energyPoints.push(...strategicEnergyPoints);

    // エネルギー消費地帯の配置
    const drainZones = this.energyPointPlacer.placeEnergyDrainZones(
      baseMap.map,
      baseMap.rooms,
      config
    );
    for (const zone of drainZones) {
      terrainEffects.set(`${zone.x},${zone.y}`, TileEffect.ENERGY_DRAIN);
    }

    // エネルギー効率を試すチョークポイント
    const chokePoints = this.energyPointPlacer.placeEnergyChokePoints(baseMap.rooms);
    for (const point of chokePoints) {
      tacticalElements.push({
        x: point.x,
        y: point.y,
        type: TacticalElementType.CHOKEPOINT,
        effect: {
          description: `${point.type}: ${point.energyCost} energy cost`,
        },
        accessibility: {
          energyCost: point.energyCost,
          requiresSkill: point.bypass?.skillRequired,
        },
      });
    }

    // エネルギー収支の検証
    const energyBalance = this.energyPointPlacer.validateEnergyBalance(
      energyPoints,
      this.calculateEstimatedEnergyConsumption(baseMap.rooms)
    );

    console.log(
      `Energy balance: ${energyBalance.balanceRatio.toFixed(2)} (${energyBalance.recommendation})`
    );
  }

  /**
   * 戦術的戦闘ステージの生成
   */
  private async generateTacticalCombatStage(
    baseMap: any,
    config: TacticalGenerationConfig,
    energyPoints: EnergyPoint[],
    tacticalElements: TacticalElement[],
    terrainEffects: Map<string, TileEffect>
  ): Promise<void> {
    console.log('Generating Tactical Combat stage');

    // スキル活用地形の配置
    const skillTerrain = this.terrainEffectPlacer.placeSkillEnhancingTerrain(
      baseMap.map,
      baseMap.rooms,
      config
    );
    for (const [key, effect] of skillTerrain) {
      terrainEffects.set(key, effect);
    }

    // 高台と遮蔽物の配置
    const tacticalPositions = this.tacticalElementPlacer.placeTacticalPositions(
      baseMap.rooms,
      config
    );
    tacticalElements.push(...tacticalPositions);

    // 特殊戦術要素の配置
    const specialElements = this.tacticalElementPlacer.placeSpecialTacticalElements(
      baseMap.rooms,
      config
    );
    tacticalElements.push(...specialElements);

    // 適度なエネルギー補給（戦闘重視なのでバランス調整）
    const combatConfig = { ...config, energyTightness: 'balanced' as const };
    const balancedEnergyPoints = this.energyPointPlacer.placeStrategicEnergyPoints(
      baseMap.rooms,
      combatConfig
    );
    energyPoints.push(...balancedEnergyPoints);

    // 戦術的価値の評価
    const tacticalValue = this.tacticalElementPlacer.evaluateTacticalValue(tacticalElements);
    console.log(`Tactical value: ${tacticalValue.totalValue} (${tacticalValue.recommendation})`);
  }

  /**
   * 情報戦ステージの生成
   */
  private async generateInformationWarStage(
    baseMap: any,
    config: TacticalGenerationConfig,
    energyPoints: EnergyPoint[],
    tacticalElements: TacticalElement[],
    terrainEffects: Map<string, TileEffect>
  ): Promise<void> {
    console.log('Generating Information War stage');

    // センサー重視の地形効果配置
    const sensorConfig = { ...config, primaryTacticalFocus: 'sensor_usage' as const };
    const sensorTerrain = this.terrainEffectPlacer.placeSkillEnhancingTerrain(
      baseMap.map,
      baseMap.rooms,
      sensorConfig
    );
    for (const [key, effect] of sensorTerrain) {
      terrainEffects.set(key, effect);
    }

    // 観測ポイントと戦術的要素の配置
    const tacticalPositions = this.tacticalElementPlacer.placeTacticalPositions(
      baseMap.rooms,
      sensorConfig
    );
    tacticalElements.push(...tacticalPositions);

    // センサー特化の特殊要素
    const sensorSpecialElements = this.tacticalElementPlacer.placeSpecialTacticalElements(
      baseMap.rooms,
      sensorConfig
    );
    tacticalElements.push(...sensorSpecialElements);

    // 情報価値のあるエネルギーポイント（隠し要素として）
    const infoEnergyPoints = this.energyPointPlacer.placeStrategicEnergyPoints(baseMap.rooms, {
      ...config,
      energyTightness: 'tight',
    });

    // 一部のエネルギーポイントを「隠し」として設定
    for (const point of infoEnergyPoints) {
      if (Math.random() < 0.3) {
        // 30%の確率で隠し要素
        (point as any).hiddenUntilScanned = true;
      }
    }

    energyPoints.push(...infoEnergyPoints);

    console.log(
      `Information War stage: ${terrainEffects.size} sensor effects, ${tacticalElements.length} tactical elements`
    );
  }

  /**
   * デフォルト戦術ステージの生成
   */
  private async generateDefaultTacticalStage(
    baseMap: any,
    config: TacticalGenerationConfig,
    energyPoints: EnergyPoint[],
    tacticalElements: TacticalElement[],
    terrainEffects: Map<string, TileEffect>
  ): Promise<void> {
    console.log('Generating Default Tactical stage');

    // バランスの取れた戦術的要素
    const mixedConfig = { ...config, primaryTacticalFocus: 'mixed' as const };

    // 基本的なエネルギーポイント
    const basicEnergyPoints = this.energyPointPlacer.placeStrategicEnergyPoints(
      baseMap.rooms,
      mixedConfig
    );
    energyPoints.push(...basicEnergyPoints);

    // 基本的な戦術要素
    const basicTacticalElements = this.tacticalElementPlacer.placeTacticalPositions(
      baseMap.rooms,
      mixedConfig
    );
    tacticalElements.push(...basicTacticalElements);

    // 基本的な地形効果
    const basicTerrain = this.terrainEffectPlacer.placeSkillEnhancingTerrain(
      baseMap.map,
      baseMap.rooms,
      mixedConfig
    );
    for (const [key, effect] of basicTerrain) {
      terrainEffects.set(key, effect);
    }

    console.log(
      `Default Tactical stage: ${energyPoints.length} energy points, ${tacticalElements.length} tactical elements, ${terrainEffects.size} terrain effects`
    );
  }

  /**
   * デフォルト戦術設定を取得
   */
  private getDefaultTacticalConfig(stageType: StageType): TacticalGenerationConfig {
    const baseConfig: TacticalGenerationConfig = {
      energyTightness: 'balanced',
      primaryTacticalFocus: 'mixed',
      playerLevel: 1,
      tacticalElementDensity: 0.3,
      energyPointConfig: {
        density: 0.2,
        types: [EnergyPointType.CHARGING_STATION, EnergyPointType.ENERGY_TANK],
        strategicPlacement: true,
      },
      terrainEffectConfig: {
        enabled: true,
        density: 0.15,
        types: [TileEffect.COVER, TileEffect.ENERGY_DRAIN, TileEffect.SENSOR_BOOST],
      },
      tacticalElementConfig: {
        enabled: true,
        density: 0.1,
        types: [TacticalElementType.HIGH_GROUND, TacticalElementType.CHOKEPOINT],
      },
    };

    // ステージタイプ別の調整
    switch (stageType) {
      case StageType.ENERGY_MANAGEMENT:
        baseConfig.energyTightness = 'tight';
        baseConfig.primaryTacticalFocus = 'energy_management';
        baseConfig.energyPointConfig.density = 0.15;
        break;

      case StageType.TACTICAL_COMBAT:
        baseConfig.primaryTacticalFocus = 'skill_selection';
        baseConfig.terrainEffectConfig.density = 0.25;
        baseConfig.tacticalElementConfig.density = 0.2;
        break;

      case StageType.INFORMATION_WAR:
        baseConfig.primaryTacticalFocus = 'sensor_usage';
        baseConfig.terrainEffectConfig.types = [
          TileEffect.SENSOR_BOOST,
          TileEffect.SENSOR_JAMMING,
          TileEffect.COVER,
        ];
        break;
    }

    return baseConfig;
  }

  /**
   * 戦術的メタデータの計算
   */
  private calculateTacticalMetadata(
    baseMap: any,
    energyPoints: EnergyPoint[],
    tacticalElements: TacticalElement[],
    terrainEffects: Map<string, TileEffect>,
    config: TacticalGenerationConfig
  ): any {
    // 推定エネルギー消費量を計算
    const estimatedEnergyConsumption = this.calculateEstimatedEnergyConsumption(baseMap.rooms);

    // 利用可能エネルギー回復量を計算
    const availableEnergyRecovery = energyPoints.reduce(
      (total, point) => total + point.recoveryAmount,
      0
    );

    // 戦術的選択ポイント数
    const tacticalChoicePoints =
      tacticalElements.length + Array.from(terrainEffects.values()).length;

    return {
      estimatedEnergyConsumption,
      availableEnergyRecovery,
      tacticalChoicePoints,
      recommendedSkills: this.getRecommendedSkills(config),
      difficultyRating: this.calculateDifficultyRating(
        estimatedEnergyConsumption,
        availableEnergyRecovery,
        tacticalChoicePoints
      ),
    };
  }

  private calculateEstimatedEnergyConsumption(rooms: Room[]): number {
    // 簡単な推定：部屋数 × 移動コスト + 戦闘コスト
    return rooms.length * 10 + rooms.length * 5; // 移動10 + 戦闘5 per room
  }

  private getRecommendedSkills(config: TacticalGenerationConfig): string[] {
    const skills: string[] = [];

    switch (config.primaryTacticalFocus) {
      case 'energy_management':
        skills.push('energy_efficiency', 'power_conservation');
        break;
      case 'skill_selection':
        skills.push('tactical_analysis', 'adaptive_combat');
        break;
      case 'sensor_usage':
        skills.push('advanced_sensors', 'information_warfare');
        break;
      default:
        skills.push('balanced_approach');
        break;
    }

    return skills;
  }

  private calculateDifficultyRating(
    energyConsumption: number,
    energyRecovery: number,
    tacticalChoices: number
  ): number {
    const energyRatio = energyConsumption / Math.max(energyRecovery, 1);
    const tacticalComplexity = tacticalChoices / 10;

    return Math.min(5.0, energyRatio + tacticalComplexity);
  }
}
