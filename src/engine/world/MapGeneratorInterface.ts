import {
  MapGenerationAlgorithm,
  CorridorGenerationMethod,
  FeaturePlacementRule,
  Room,
  RoomType,
  GenerationConfig,
  MapGenerationResult,
  RoomGenerationResult,
  RoomGenerationConfig,
  CorridorGenerationConfig,
  FeaturePlacementConfig,
  CorridorGenerationResult,
  FeaturePlacementResult,
} from '../types';

// 再エクスポート（他のモジュールで使用するため）
export {
  MapGenerationAlgorithm,
  CorridorGenerationMethod,
  FeaturePlacementRule,
  Room,
  RoomType,
  GenerationConfig,
  MapGenerationResult,
  RoomGenerationResult,
  RoomGenerationConfig,
  CorridorGenerationConfig,
  FeaturePlacementConfig,
  CorridorGenerationResult,
  FeaturePlacementResult,
} from '../types';

/**
 * 部屋生成アルゴリズムの共通インターフェース
 */
export interface RoomGeneratorInterface {
  /**
   * 部屋を生成する
   * @param config 部屋生成設定
   * @returns 生成された部屋のリストとメタデータ
   */
  generate(config: RoomGenerationConfig): RoomGenerationResult;

  /**
   * このジェネレーターの種類を取得
   * @returns アルゴリズムの種類
   */
  getGeneratorType(): string;

  /**
   * サポートするパラメータを取得
   * @returns サポートするパラメータのリスト
   */
  getSupportedParameters(): string[];

  /**
   * ジェネレーターの説明を取得
   * @returns ジェネレーターの説明
   */
  getDescription(): string;
}

/**
 * 通路生成アルゴリズムの共通インターフェース
 */
export interface CorridorGeneratorInterface {
  /**
   * 通路を生成する
   * @param rooms 部屋のリスト
   * @param config 通路生成設定
   * @returns 生成された通路のリストとメタデータ
   */
  generate(rooms: Room[], config: CorridorGenerationConfig): CorridorGenerationResult;

  /**
   * このジェネレーターの種類を取得
   * @returns アルゴリズムの種類
   */
  getGeneratorType(): string;

  /**
   * サポートするパラメータを取得
   * @returns サポートするパラメータのリスト
   */
  getSupportedParameters(): string[];

  /**
   * ジェネレーターの説明を取得
   * @returns ジェネレーターの説明
   */
  getDescription(): string;

  /**
   * マップサイズを更新（オプション）
   * @param width 新しい幅
   * @param height 新しい高さ
   */
  updateSize?(width: number, height: number): void;

  /**
   * マップに通路を描画（オプション）
   * @param map マップデータ
   * @param corridors 通路のリスト
   */
  drawCorridorsOnMap?(map: number[][], corridors: any[]): void;
}

/**
 * 特徴配置アルゴリズムの共通インターフェース
 */
export interface FeaturePlacerInterface {
  /**
   * 特徴を配置する
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param config 特徴配置設定
   * @returns 配置された特徴のリストとメタデータ
   */
  place(map: number[][], rooms: Room[], config: FeaturePlacementConfig): FeaturePlacementResult;

  /**
   * この配置システムの種類を取得
   * @returns 配置システムの種類
   */
  getPlacerType(): string;

  /**
   * サポートするルールを取得
   * @returns サポートするルールのリスト
   */
  getSupportedRules(): string[];

  /**
   * 配置システムの説明を取得
   * @returns 配置システムの説明
   */
  getDescription(): string;

  /**
   * マップサイズを更新（オプション）
   * @param width 新しい幅
   * @param height 新しい高さ
   */
  updateSize?(width: number, height: number): void;
}

/**
 * マップ生成アルゴリズムの共通インターフェース
 */
export interface MapGeneratorInterface {
  /**
   * マップを生成する
   * @param config 生成設定
   * @returns 生成されたマップデータと部屋情報
   */
  generate(config: GenerationConfig): MapGenerationResult;

  /**
   * このジェネレーターの種類を取得
   * @returns アルゴリズムの種類
   */
  getGeneratorType(): string;

  /**
   * サポートするパラメータを取得
   * @returns サポートするパラメータのリスト
   */
  getSupportedParameters(): string[];

  /**
   * ジェネレーターの説明を取得
   * @returns ジェネレーターの説明
   */
  getDescription(): string;
}

/**
 * マップ生成ファクトリー
 * アルゴリズムの登録・取得を管理
 */
export class MapGeneratorFactory {
  private roomGenerators: Map<string, RoomGeneratorInterface> = new Map();
  private corridorGenerators: Map<string, CorridorGeneratorInterface> = new Map();
  private featurePlacers: Map<string, FeaturePlacerInterface> = new Map();
  private mapGenerators: Map<string, MapGeneratorInterface> = new Map();

  /**
   * 部屋生成アルゴリズムを登録
   * @param type アルゴリズムの種類
   * @param generator ジェネレーターインスタンス
   */
  registerRoomGenerator(type: string, generator: RoomGeneratorInterface): void {
    this.roomGenerators.set(type, generator);
    console.log(`Registered room generator: ${type}`);
  }

  /**
   * 通路生成アルゴリズムを登録
   * @param type アルゴリズムの種類
   * @param generator ジェネレーターインスタンス
   */
  registerCorridorGenerator(type: string, generator: CorridorGeneratorInterface): void {
    this.corridorGenerators.set(type, generator);
    console.log(`Registered corridor generator: ${type}`);
  }

  /**
   * 特徴配置システムを登録
   * @param type 配置システムの種類
   * @param placer 配置システムインスタンス
   */
  registerFeaturePlacer(type: string, placer: FeaturePlacerInterface): void {
    this.featurePlacers.set(type, placer);
    console.log(`Registered feature placer: ${type}`);
  }

  /**
   * マップ生成アルゴリズムを登録
   * @param type アルゴリズムの種類
   * @param generator ジェネレーターインスタンス
   */
  registerMapGenerator(type: string, generator: MapGeneratorInterface): void {
    this.mapGenerators.set(type, generator);
    console.log(`Registered map generator: ${type}`);
  }

  /**
   * 部屋生成アルゴリズムを取得
   * @param type アルゴリズムの種類
   * @returns ジェネレーターインスタンス
   */
  getRoomGenerator(type: string): RoomGeneratorInterface {
    const generator = this.roomGenerators.get(type);
    if (!generator) {
      throw new Error(`Room generator '${type}' is not registered`);
    }
    return generator;
  }

  /**
   * 通路生成アルゴリズムを取得
   * @param type アルゴリズムの種類
   * @returns ジェネレーターインスタンス
   */
  getCorridorGenerator(type: string): CorridorGeneratorInterface {
    const generator = this.corridorGenerators.get(type);
    if (!generator) {
      throw new Error(`Corridor generator '${type}' is not registered`);
    }
    return generator;
  }

  /**
   * 特徴配置システムを取得
   * @param type 配置システムの種類
   * @returns 配置システムインスタンス
   */
  getFeaturePlacer(type: string): FeaturePlacerInterface {
    const placer = this.featurePlacers.get(type);
    if (!placer) {
      throw new Error(`Feature placer '${type}' is not registered`);
    }
    return placer;
  }

  /**
   * マップ生成アルゴリズムを取得
   * @param type アルゴリズムの種類
   * @returns ジェネレーターインスタンス
   */
  getMapGenerator(type: string): MapGeneratorInterface {
    const generator = this.mapGenerators.get(type);
    if (!generator) {
      throw new Error(`Map generator '${type}' is not registered`);
    }
    return generator;
  }

  /**
   * 登録済みのアルゴリズムを取得
   * @returns 登録済みアルゴリズムのリスト
   */
  getRegisteredAlgorithms(): {
    roomGenerators: string[];
    corridorGenerators: string[];
    featurePlacers: string[];
    mapGenerators: string[];
  } {
    return {
      roomGenerators: Array.from(this.roomGenerators.keys()),
      corridorGenerators: Array.from(this.corridorGenerators.keys()),
      featurePlacers: Array.from(this.featurePlacers.keys()),
      mapGenerators: Array.from(this.mapGenerators.keys()),
    };
  }

  /**
   * デフォルトのアルゴリズムを登録
   */
  async registerDefaults(): Promise<void> {
    // デフォルトアルゴリズムの動的インポートと登録
    await this.loadDefaultGenerators();
    console.log('MapGeneratorFactory initialized with default algorithms');
  }

  /**
   * デフォルトのジェネレーターを読み込み
   */
  private async loadDefaultGenerators(): Promise<void> {
    try {
      // Room Generators
      const { BSPGenerator } = await import('./generators/BSPGenerator');
      const bspGenerator = new BSPGenerator(50, 50);
      this.registerRoomGenerator('bsp', bspGenerator);

      const { CaveGenerator } = await import('./generators/CaveGenerator');
      const caveGenerator = new CaveGenerator(50, 50);
      this.registerRoomGenerator('cellular', caveGenerator);

      // Corridor Generators
      const { AStarCorridorGenerator } = await import('./corridors/AStarCorridorGenerator');
      const astarGenerator = new AStarCorridorGenerator(50, 50);
      this.registerCorridorGenerator('astar', astarGenerator);

      const { LShapeCorridorGenerator } = await import('./corridors/LShapeCorridorGenerator');
      const lshapeGenerator = new LShapeCorridorGenerator(50, 50);
      this.registerCorridorGenerator('lshape', lshapeGenerator);

      // Feature Placers
      const { BasicFeaturePlacer } = await import('./features/BasicFeaturePlacer');
      const basicPlacer = new BasicFeaturePlacer(50, 50);
      this.registerFeaturePlacer('basic', basicPlacer);

      const { RuleBasedFeaturePlacer } = await import('./features/RuleBasedFeaturePlacer');
      const ruleBasedPlacer = new RuleBasedFeaturePlacer(50, 50);
      this.registerFeaturePlacer('rule-based', ruleBasedPlacer);

      console.log(
        'Default generators loaded: BSP, Cellular Automata, A*, L-Shape, Basic Features, Rule-based Features'
      );
    } catch (error) {
      console.error('Failed to load default generators:', error);
    }
  }
}

/**
 * グローバルなファクトリーインスタンス
 */
export const mapGeneratorFactory = new MapGeneratorFactory();

/**
 * ファクトリーを初期化（デフォルトアルゴリズムを登録）
 * ゲーム開始時に呼び出す
 */
export async function initializeMapGeneratorFactory(): Promise<void> {
  await mapGeneratorFactory.registerDefaults();
}
