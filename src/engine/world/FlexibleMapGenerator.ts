import {
  GenerationConfig,
  MapGenerationResult,
  TacticalMapGenerationResult,
  Room,
  RoomType,
  TileType,
  MapGenerationAlgorithm,
  StageType,
  Corridor,
} from '../types';
import { mapGeneratorFactory, initializeMapGeneratorFactory } from './MapGeneratorInterface';

/**
 * 柔軟なマップ生成システム
 * 複数のアルゴリズムを統合し、設定に基づいてマップを生成
 */
export class FlexibleMapGenerator {
  private width: number;
  private height: number;
  private isInitialized = false;

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
   * ファクトリーを初期化
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await initializeMapGeneratorFactory();
      this.isInitialized = true;
    }
  }

  /**
   * マップを生成（基本マップ生成のみ）
   * @param config 生成設定
   * @returns 生成されたマップデータ
   */
  async generate(config: GenerationConfig): Promise<MapGenerationResult> {
    await this.initialize();

    console.log('Generating base map with FlexibleMapGenerator');

    // ルーム生成アルゴリズムを取得
    const roomGenerator = mapGeneratorFactory.getRoomGenerator(config.algorithm);

    // 部屋生成器のサイズを更新（ファクトリーのデフォルトは50x50）
    if ((roomGenerator as any).updateSize) {
      (roomGenerator as any).updateSize(this.width, this.height);
      console.log(`Updated room generator size to ${this.width}x${this.height}`);
    }

    // 部屋を生成
    const roomResult = roomGenerator.generate(config.roomConfig);

    // マップデータを構築
    const map = this.buildMapFromRooms(roomResult.rooms);

    // 通路を生成
    const corridors = await this.connectRooms(map, roomResult.rooms, config.corridorConfig);

    // 特徴を配置
    const features = this.placeFeatures(map, roomResult.rooms, config.featureConfig);

    // 統合配置システムは削除（ResourceGenerationSystemに移行）
    // 障害物・アイテム・敵はマップ生成後に別途配置される

    return {
      map: map,
      rooms: roomResult.rooms,
      corridors: corridors,
      features: features,
      obstacles: undefined, // ResourceGenerationSystemで配置
      items: undefined, // ResourceGenerationSystemで配置
      enemies: undefined, // ResourceGenerationSystemで配置
      metadata: {
        totalGenerationTime: roomResult.metadata.generationTime,
        algorithmsUsed: [config.algorithm],
        config: config,
        seed: roomResult.metadata.seed || Date.now(),
      },
    };
  }

  /**
   * 既存のインターフェース互換の生成メソッド
   * @param minRoomSize 最小部屋サイズ
   * @param maxRoomSize 最大部屋サイズ
   * @param stageType ステージタイプ（オプション）
   * @returns 既存形式のマップデータ
   */
  async generateMap(
    minRoomSize = 4,
    maxRoomSize = 8,
    stageType: StageType = StageType.CLASSIC
  ): Promise<{ map: number[][]; rooms: Room[] }> {
    const config: GenerationConfig = {
      width: this.width,
      height: this.height,
      stageType: stageType, // ステージタイプを追加
      algorithm: MapGenerationAlgorithm.BSP,
      roomConfig: {
        minSize: minRoomSize,
        maxSize: maxRoomSize,
        density: 0.7,
        connectivity: 0.8,
        roomTypes: [
          RoomType.NORMAL,
          RoomType.BOSS,
          RoomType.TREASURE,
          RoomType.ENTRANCE,
          RoomType.EXIT,
        ],
      },
      corridorConfig: {
        method: 'astar' as any,
        width: 1, // デフォルト値
        minWidth: 1, // 最小幅
        maxWidth: 3, // 最大幅（通路ごとにランダム化、1-3マス）
        redundancy: 0.4, // A*では複数経路がより重要
        allowDiagonal: false, // 戦術的ゲームでは直線移動のみ
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

    const result = await this.generate(config);
    return {
      map: result.map,
      rooms: result.rooms,
    };
  }

  /**
   * ステージタイプを指定して戦術的マップを生成
   * @param stageType ステージタイプ
   * @param options 追加オプション
   * @returns 戦術的マップデータ
   */
  async generateTacticalMap(
    stageType: StageType,
    options: {
      minRoomSize?: number;
      maxRoomSize?: number;
      energyTightness?: 'relaxed' | 'balanced' | 'tight' | 'critical';
      playerLevel?: number;
    } = {}
  ): Promise<TacticalMapGenerationResult> {
    const config: GenerationConfig = {
      width: this.width,
      height: this.height,
      stageType: stageType,
      algorithm: MapGenerationAlgorithm.BSP,
      roomConfig: {
        minSize: options.minRoomSize || 4,
        maxSize: options.maxRoomSize || 8,
        density: 0.7,
        connectivity: 0.8,
        roomTypes: [
          RoomType.NORMAL,
          RoomType.BOSS,
          RoomType.TREASURE,
          RoomType.ENTRANCE,
          RoomType.EXIT,
        ],
      },
      corridorConfig: {
        method: 'astar' as any,
        width: 1, // デフォルト値
        minWidth: 1, // 最小幅
        maxWidth: 3, // 最大幅（通路ごとにランダム化、1-3マス）
        redundancy: 0.4, // A*では複数経路がより重要
        allowDiagonal: false, // 戦術的ゲームでは直線移動のみ
      },
      featureConfig: {
        method: 'basic',
        density: 0.05,
        rules: [],
        themeFeatures: [],
        globalRules: [],
      },
      tacticalConfig: {
        energyTightness: options.energyTightness || 'balanced',
        primaryTacticalFocus: 'mixed',
        playerLevel: options.playerLevel || 1,
        tacticalElementDensity: 0.3,
        energyPointConfig: {
          density: 0.2,
          types: [],
          strategicPlacement: true,
        },
        terrainEffectConfig: {
          enabled: true,
          density: 0.15,
          types: [],
        },
        tacticalElementConfig: {
          enabled: true,
          density: 0.1,
          types: [],
        },
      },
      postProcessing: {
        ensureConnectivity: true,
        balanceFeatures: true,
        optimizePerformance: false,
      },
    };

    const result = await this.generate(config);
    return result as TacticalMapGenerationResult;
  }

  /**
   * 部屋からマップデータを構築
   * @param rooms 部屋のリスト
   * @returns マップデータ
   */
  private buildMapFromRooms(rooms: Room[]): number[][] {
    // マップを初期化
    const map: number[][] = [];
    for (let y = 0; y < this.height; y++) {
      map[y] = [];
      for (let x = 0; x < this.width; x++) {
        map[y][x] = TileType.EMPTY;
      }
    }

    // 部屋をマップに描画
    for (const room of rooms) {
      for (let dy = 0; dy < room.height; dy++) {
        for (let dx = 0; dx < room.width; dx++) {
          const x = room.x + dx;
          const y = room.y + dy;
          if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            map[y][x] = TileType.GRASS;
          }
        }
      }
    }

    return map;
  }

  /**
   * 部屋を接続する通路を生成
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param config 通路生成設定
   */
  private async connectRooms(map: number[][], rooms: Room[], config: any): Promise<Corridor[]> {
    if (rooms.length < 2) return [];

    // 通路生成器を取得
    let corridorGenerator;
    try {
      corridorGenerator = mapGeneratorFactory.getCorridorGenerator(config.method);
    } catch (error) {
      console.warn(`Corridor generator '${config.method}' not found, falling back to L-shape`);
      corridorGenerator = mapGeneratorFactory.getCorridorGenerator('lshape');
    }

    // 通路生成器のサイズを更新
    if (corridorGenerator.updateSize) {
      corridorGenerator.updateSize(this.width, this.height);
    }

    // 通路を生成
    const result = corridorGenerator.generate(rooms, config);

    // マップに通路を描画
    if (corridorGenerator.drawCorridorsOnMap) {
      corridorGenerator.drawCorridorsOnMap(map, result.corridors);
    } else {
      // フォールバック: シンプルなL字型通路
      this.drawSimpleCorridors(map, result.corridors);
    }

    console.log(
      `Generated ${result.corridors.length} corridors using ${result.metadata.method} method`
    );

    return result.corridors;
  }

  /**
   * シンプルな通路描画（フォールバック用）
   * @param map マップデータ
   * @param corridors 通路のリスト
   */
  private drawSimpleCorridors(map: number[][], corridors: Corridor[]): void {
    for (const corridor of corridors) {
      // 直線で接続
      this.drawLine(map, corridor.startX, corridor.startY, corridor.endX, corridor.endY);
    }
  }

  /**
   * 2点間に直線を描画
   * @param map マップデータ
   * @param x1 開始X座標
   * @param y1 開始Y座標
   * @param x2 終了X座標
   * @param y2 終了Y座標
   */
  private drawLine(map: number[][], x1: number, y1: number, x2: number, y2: number): void {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    // Bresenhamアルゴリズムによる直線描画（最大反復回数制限付き）
    const maxIterations = Math.abs(x2 - x1) + Math.abs(y2 - y1) + 1;
    for (let i = 0; i < maxIterations; i++) {
      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        map[y][x] = TileType.GRASS;
      }

      if (x === x2 && y === y2) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /**
   * 特徴を配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param config 特徴配置設定
   * @returns 配置された特徴のリスト
   */
  private placeFeatures(map: number[][], rooms: Room[], config: any): any[] {
    try {
      // 特徴配置器を取得
      let featurePlacer;
      const placerType = config.method || 'basic';

      try {
        featurePlacer = mapGeneratorFactory.getFeaturePlacer(placerType);
      } catch (error) {
        console.warn(`Feature placer '${placerType}' not found, falling back to basic`);
        featurePlacer = mapGeneratorFactory.getFeaturePlacer('basic');
      }

      // 特徴配置器のサイズを更新
      if (featurePlacer.updateSize) {
        featurePlacer.updateSize(this.width, this.height);
      }

      // 特徴を配置
      const result = featurePlacer.place(map, rooms, config);

      console.log(
        `Feature placement completed: ${result.features.length} features placed using ${result.metadata.placementMethod} method`
      );

      return result.features;
    } catch (error) {
      console.error('Feature placement failed, falling back to legacy method:', error);
      return this.placeFeaturesLegacy(map, rooms, config);
    }
  }

  /**
   * レガシー特徴配置メソッド（フォールバック用）
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param config 特徴配置設定
   * @returns 配置された特徴のリスト
   */
  private placeFeaturesLegacy(map: number[][], rooms: Room[], config: any): any[] {
    const features: any[] = [];

    // 基本的な特徴配置（水場、山など）
    const featureCount = Math.floor(this.width * this.height * config.density);

    for (let i = 0; i < featureCount; i++) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);

      if (map[y][x] === TileType.GRASS) {
        const tileType = Math.random() < 0.7 ? TileType.WATER : TileType.MOUNTAIN;
        map[y][x] = tileType;

        features.push({
          x: x,
          y: y,
          type: tileType === TileType.WATER ? 'water' : 'mountain',
          data: { generated: true },
        });
      }
    }

    // 特別なタイルを部屋に配置
    for (const room of rooms) {
      if (room.type === RoomType.BOSS || room.type === RoomType.TREASURE) {
        // 特別な部屋には特別なタイルを配置
        const centerX = room.x + Math.floor(room.width / 2);
        const centerY = room.y + Math.floor(room.height / 2);

        if (centerX >= 0 && centerX < this.width && centerY >= 0 && centerY < this.height) {
          const tileType = room.type === RoomType.BOSS ? TileType.PORTAL : TileType.HEAL;
          map[centerY][centerX] = tileType;

          features.push({
            x: centerX,
            y: centerY,
            type: room.type === RoomType.BOSS ? 'portal' : 'heal',
            data: { roomType: room.type },
          });
        }
      }
    }

    return features;
  }

  /**
   * マップのサイズを取得
   * @returns マップのサイズ
   */
  getSize(): { width: number; height: number } {
    return {
      width: this.width,
      height: this.height,
    };
  }
}
