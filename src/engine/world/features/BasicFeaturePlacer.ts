import { BaseFeaturePlacer } from './BaseFeaturePlacer';
import { FeaturePlacementConfig, Room } from '../MapGeneratorInterface';
import {
  FeaturePlacementResult,
  PlacedFeature,
  FeatureType,
  TileType,
  RoomType,
} from '../../types';

/**
 * 基本的な特徴配置システム
 * シンプルなランダム配置とデフォルト特徴配置
 */
export class BasicFeaturePlacer extends BaseFeaturePlacer {
  /**
   * 特徴を配置する
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param config 特徴配置設定
   * @returns 配置された特徴のリストとメタデータ
   */
  place(map: number[][], rooms: Room[], config: FeaturePlacementConfig): FeaturePlacementResult {
    const startTime = performance.now();
    const features: PlacedFeature[] = [];

    console.log(`BasicFeaturePlacer: Starting basic feature placement...`);

    // 特別な部屋に固定特徴を配置
    const specialFeatures = this.placeSpecialRoomFeatures(map, rooms);
    features.push(...specialFeatures);

    // 密度ベースのランダム特徴配置
    if (config.density > 0) {
      const randomFeatures = this.placeRandomFeatures(map, rooms, features, config.density);
      features.push(...randomFeatures);
    }

    // 特徴をマップに反映
    this.applyFeaturesToMap(map, features);

    const endTime = performance.now();

    console.log(
      `BasicFeaturePlacer: Placed ${features.length} features in ${endTime - startTime}ms`
    );

    return {
      features,
      metadata: {
        placementMethod: 'basic',
        totalFeatures: features.length,
        specialFeatures: specialFeatures.length,
        randomFeatures: features.length - specialFeatures.length,
        placementTime: endTime - startTime,
      },
    };
  }

  /**
   * この配置システムの種類を取得
   * @returns 配置システムの種類
   */
  getPlacerType(): string {
    return 'basic';
  }

  /**
   * サポートするルールを取得
   * @returns サポートするルールのリスト
   */
  getSupportedRules(): string[] {
    return ['density', 'room-type'];
  }

  /**
   * 配置システムの説明を取得
   * @returns 配置システムの説明
   */
  getDescription(): string {
    return 'Basic feature placement system for simple random distribution and special room features';
  }

  /**
   * 特別な部屋に固定特徴を配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @returns 配置された特徴のリスト
   */
  private placeSpecialRoomFeatures(map: number[][], rooms: Room[]): PlacedFeature[] {
    const features: PlacedFeature[] = [];

    for (const room of rooms) {
      const center = this.getRoomCenter(room);

      // 範囲内かつ配置可能な場所かチェック
      if (
        !this.isInBounds(center.x, center.y) ||
        !this.canPlaceAt(map, center.x, center.y, [TileType.GRASS])
      ) {
        continue;
      }

      let featureType: FeatureType | null = null;
      let tileType: TileType | null = null;

      switch (room.type) {
        case RoomType.BOSS:
          featureType = FeatureType.PORTAL;
          tileType = TileType.PORTAL;
          break;
        case RoomType.TREASURE:
          featureType = FeatureType.HEAL;
          tileType = TileType.HEAL;
          break;
        case RoomType.ENTRANCE:
          featureType = FeatureType.HEAL; // エントランス用の特徴タイプ
          // エントランスは特別なタイルを配置しない
          break;
        case RoomType.EXIT:
          featureType = FeatureType.HEAL; // エグジット用の特徴タイプ
          // エグジットは特別なタイルを配置しない
          break;
        default:
          // 通常の部屋には特別な特徴を配置しない
          continue;
      }

      if (featureType) {
        const feature = this.createFeature(center.x, center.y, featureType, {
          roomType: room.type,
          special: true,
        });
        features.push(feature);

        // マップにタイルを配置（必要な場合のみ）
        if (tileType !== null) {
          map[center.y][center.x] = tileType;
        }
      }
    }

    console.log(`Special room features: placed ${features.length} features`);
    return features;
  }

  /**
   * ランダム特徴を配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param existingFeatures 既存の特徴リスト
   * @param density 配置密度
   * @returns 配置された特徴のリスト
   */
  private placeRandomFeatures(
    map: number[][],
    rooms: Room[],
    existingFeatures: PlacedFeature[],
    density: number
  ): PlacedFeature[] {
    const features: PlacedFeature[] = [];
    const targetCount = Math.floor(this.width * this.height * density);

    // 配置可能な特徴タイプとその重み（通行可能なタイプのみ）
    const featureOptions = [
      { type: FeatureType.HEAL, weight: 0.6, tileType: TileType.HEAL },
      { type: FeatureType.DAMAGE, weight: 0.4, tileType: TileType.DAMAGE },
      // WATERとMOUNTAINは通行不可のため無効化
      // { type: FeatureType.WATER, weight: 0.4, tileType: TileType.WATER },
      // { type: FeatureType.MOUNTAIN, weight: 0.3, tileType: TileType.MOUNTAIN },
    ];

    let attempts = 0;
    const maxAttempts = targetCount * 15; // 失敗を考慮して多めに試行

    while (features.length < targetCount && attempts < maxAttempts) {
      attempts++;

      const position = this.getRandomPosition(1);

      // 既に特徴が配置されている場所は避ける
      if (this.hasFeatureInRange(existingFeatures.concat(features), position.x, position.y, 1)) {
        continue;
      }

      // 草地のみに配置
      if (!this.canPlaceAt(map, position.x, position.y, [TileType.GRASS])) {
        continue;
      }

      // 重み付きランダムで特徴タイプを選択
      const selectedFeature = this.selectWeightedFeature(featureOptions);

      const feature = this.createFeature(position.x, position.y, selectedFeature.type, {
        placement: 'random',
        density,
      });

      features.push(feature);
    }

    console.log(
      `Random features: placed ${features.length}/${targetCount} features in ${attempts} attempts`
    );
    return features;
  }

  /**
   * 重み付きランダムで特徴を選択
   * @param options 特徴オプションのリスト
   * @returns 選択された特徴オプション
   */
  private selectWeightedFeature(
    options: Array<{ type: FeatureType; weight: number; tileType: TileType }>
  ): { type: FeatureType; weight: number; tileType: TileType } {
    const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
    let random = Math.random() * totalWeight;

    for (const option of options) {
      random -= option.weight;
      if (random <= 0) {
        return option;
      }
    }

    // フォールバック（本来は到達しない）
    return options[0];
  }

  /**
   * 特徴をマップに反映
   * @param map マップデータ
   * @param features 特徴のリスト
   */
  private applyFeaturesToMap(map: number[][], features: PlacedFeature[]): void {
    for (const feature of features) {
      if (!this.isInBounds(feature.x, feature.y)) continue;

      // 特別な部屋の特徴は既にマップに反映済みなのでスキップ
      if (feature.data?.special) continue;

      let tileType: TileType;

      switch (feature.type) {
        case FeatureType.WATER:
          tileType = TileType.WATER;
          break;
        case FeatureType.MOUNTAIN:
          tileType = TileType.MOUNTAIN;
          break;
        case FeatureType.HEAL:
          tileType = TileType.HEAL;
          break;
        case FeatureType.PORTAL:
          tileType = TileType.PORTAL;
          break;
        default:
          continue; // 不明なタイプは配置しない
      }

      map[feature.y][feature.x] = tileType;
    }
  }
}
