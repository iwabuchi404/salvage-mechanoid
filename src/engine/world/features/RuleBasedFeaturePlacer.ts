import { BaseFeaturePlacer } from './BaseFeaturePlacer';
import { FeaturePlacementConfig, Room } from '../MapGeneratorInterface';
import {
  FeaturePlacementResult,
  PlacedFeature,
  FeaturePlacementRuleInterface,
  FeatureType,
  TileType,
  RoomType,
} from '../../types';

/**
 * ルールベース特徴配置システム
 * 設定されたルールに基づいて自動的に特徴を配置
 */
export class RuleBasedFeaturePlacer extends BaseFeaturePlacer {
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

    console.log(
      `RuleBasedFeaturePlacer: Starting feature placement with ${config.rules.length} rules...`
    );

    // 全体的なルールによる配置（現在は簡略化してスキップ）
    // TODO: GlobalPlacementRuleをFeaturePlacementRuleInterfaceに適応させる
    // for (const rule of config.globalRules) {
    //   const placedFeatures = this.placeByGlobalRule(map, rooms, features, rule);
    //   features.push(...placedFeatures);
    // }

    // 個別ルールによる配置（現在は簡略化してスキップ）
    // TODO: PlacementRuleをFeaturePlacementRuleInterfaceに適応させる
    // for (const rule of config.rules) {
    //   const placedFeatures = this.placeByRule(map, rooms, features, rule);
    //   features.push(...placedFeatures);
    // }

    // テーマ特徴の配置
    for (const themeFeature of config.themeFeatures) {
      const placedFeatures = this.placeThemeFeatures(map, rooms, features, themeFeature);
      features.push(...placedFeatures);
    }

    // 密度ベースのランダム特徴配置
    if (config.density > 0) {
      const randomFeatures = this.placeRandomFeatures(map, rooms, features, config);
      features.push(...randomFeatures);
    }

    // 特徴をマップに反映
    this.applyFeaturesToMap(map, features);

    const endTime = performance.now();

    console.log(
      `RuleBasedFeaturePlacer: Placed ${features.length} features in ${endTime - startTime}ms`
    );

    return {
      features,
      metadata: {
        placementMethod: 'rule-based',
        totalFeatures: features.length,
        rulesApplied: config.rules.length + config.globalRules.length,
        themeFeatures: config.themeFeatures.length,
        placementTime: endTime - startTime,
      },
    };
  }

  /**
   * この配置システムの種類を取得
   * @returns 配置システムの種類
   */
  getPlacerType(): string {
    return 'rule-based';
  }

  /**
   * サポートするルールを取得
   * @returns サポートするルールのリスト
   */
  getSupportedRules(): string[] {
    return [
      'room-type-constraint',
      'tile-type-constraint',
      'distance-constraint',
      'density-constraint',
      'theme-constraint',
      'adjacency-constraint',
    ];
  }

  /**
   * 配置システムの説明を取得
   * @returns 配置システムの説明
   */
  getDescription(): string {
    return 'Rule-based feature placement system for dynamic and intelligent feature distribution';
  }

  /**
   * グローバルルールによる配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param existingFeatures 既存の特徴リスト
   * @param rule グローバルルール
   * @returns 配置された特徴のリスト
   */
  private placeByGlobalRule(
    map: number[][],
    rooms: Room[],
    existingFeatures: PlacedFeature[],
    rule: FeaturePlacementRuleInterface
  ): PlacedFeature[] {
    const features: PlacedFeature[] = [];

    if (!rule.featureType || !rule.count) return features;

    let attempts = 0;
    const maxAttempts = rule.count * 10; // 失敗を考慮して試行回数を増やす

    while (features.length < rule.count && attempts < maxAttempts) {
      attempts++;

      const position = this.getRandomPosition(2);

      if (
        this.canPlaceByRule(
          map,
          rooms,
          [...existingFeatures, ...features],
          position.x,
          position.y,
          rule
        )
      ) {
        const feature = this.createFeature(position.x, position.y, rule.featureType, {
          rule: 'global',
          ruleId: rule.id || 'unnamed',
        });
        features.push(feature);
      }
    }

    console.log(
      `Global rule '${rule.featureType}': placed ${features.length}/${rule.count} features`
    );
    return features;
  }

  /**
   * 個別ルールによる配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param existingFeatures 既存の特徴リスト
   * @param rule 配置ルール
   * @returns 配置された特徴のリスト
   */
  private placeByRule(
    map: number[][],
    rooms: Room[],
    existingFeatures: PlacedFeature[],
    rule: FeaturePlacementRuleInterface
  ): PlacedFeature[] {
    const features: PlacedFeature[] = [];

    if (!rule.featureType || !rule.count) return features;

    // 特定の部屋タイプが指定されている場合
    if (rule.allowedRoomTypes && rule.allowedRoomTypes.length > 0) {
      return this.placeInSpecificRooms(map, rooms, existingFeatures, rule);
    }

    // 一般的な配置
    let attempts = 0;
    const maxAttempts = rule.count * 10;

    while (features.length < rule.count && attempts < maxAttempts) {
      attempts++;

      const position = this.getRandomPosition(1);

      if (
        this.canPlaceByRule(
          map,
          rooms,
          [...existingFeatures, ...features],
          position.x,
          position.y,
          rule
        )
      ) {
        const feature = this.createFeature(position.x, position.y, rule.featureType, {
          rule: 'individual',
          ruleId: rule.id || 'unnamed',
        });
        features.push(feature);
      }
    }

    console.log(
      `Individual rule '${rule.featureType}': placed ${features.length}/${rule.count} features`
    );
    return features;
  }

  /**
   * 特定の部屋タイプに特徴を配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param existingFeatures 既存の特徴リスト
   * @param rule 配置ルール
   * @returns 配置された特徴のリスト
   */
  private placeInSpecificRooms(
    map: number[][],
    rooms: Room[],
    existingFeatures: PlacedFeature[],
    rule: FeaturePlacementRuleInterface
  ): PlacedFeature[] {
    const features: PlacedFeature[] = [];
    const targetRooms = rooms.filter((room) => rule.allowedRoomTypes!.includes(room.type));

    if (targetRooms.length === 0) return features;

    let placedCount = 0;
    const countPerRoom = Math.ceil(rule.count! / targetRooms.length);

    for (const room of targetRooms) {
      if (placedCount >= rule.count!) break;

      let roomFeatures = 0;
      let attempts = 0;
      const maxAttempts = countPerRoom * 5;

      while (roomFeatures < countPerRoom && placedCount < rule.count! && attempts < maxAttempts) {
        attempts++;

        // 部屋内のランダムな位置
        const x = room.x + Math.floor(Math.random() * room.width);
        const y = room.y + Math.floor(Math.random() * room.height);

        if (this.canPlaceByRule(map, rooms, [...existingFeatures, ...features], x, y, rule)) {
          const feature = this.createFeature(x, y, rule.featureType!, {
            rule: 'room-specific',
            ruleId: rule.id || 'unnamed',
            roomType: room.type,
          });
          features.push(feature);
          roomFeatures++;
          placedCount++;
        }
      }
    }

    console.log(
      `Room-specific rule '${rule.featureType}': placed ${placedCount}/${rule.count} features in ${targetRooms.length} rooms`
    );
    return features;
  }

  /**
   * テーマ特徴を配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param existingFeatures 既存の特徴リスト
   * @param themeFeature テーマ特徴設定
   * @returns 配置された特徴のリスト
   */
  private placeThemeFeatures(
    map: number[][],
    rooms: Room[],
    existingFeatures: PlacedFeature[],
    themeFeature: any
  ): PlacedFeature[] {
    const features: PlacedFeature[] = [];

    // テーマ特徴の配置ロジック（例：洞窟には水場、城には宝箱など）
    if (themeFeature.theme === 'dungeon') {
      features.push(...this.placeDungeonFeatures(map, rooms, existingFeatures, themeFeature));
    } else if (themeFeature.theme === 'nature') {
      features.push(...this.placeNatureFeatures(map, rooms, existingFeatures, themeFeature));
    }

    return features;
  }

  /**
   * ダンジョンテーマの特徴を配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param existingFeatures 既存の特徴リスト
   * @param config テーマ設定
   * @returns 配置された特徴のリスト
   */
  private placeDungeonFeatures(
    map: number[][],
    rooms: Room[],
    existingFeatures: PlacedFeature[],
    config: any
  ): PlacedFeature[] {
    const features: PlacedFeature[] = [];

    // ボス部屋にはポータル
    const bossRooms = rooms.filter((room) => room.type === RoomType.BOSS);
    for (const room of bossRooms) {
      const center = this.getRoomCenter(room);
      if (this.canPlaceAt(map, center.x, center.y, [TileType.GRASS])) {
        features.push(
          this.createFeature(center.x, center.y, FeatureType.PORTAL, { theme: 'dungeon' })
        );
      }
    }

    // 宝物部屋には宝箱
    const treasureRooms = rooms.filter((room) => room.type === RoomType.TREASURE);
    for (const room of treasureRooms) {
      const center = this.getRoomCenter(room);
      if (this.canPlaceAt(map, center.x, center.y, [TileType.GRASS])) {
        features.push(
          this.createFeature(center.x, center.y, FeatureType.HEAL, { theme: 'dungeon' })
        );
      }
    }

    return features;
  }

  /**
   * 自然テーマの特徴を配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param existingFeatures 既存の特徴リスト
   * @param config テーマ設定
   * @returns 配置された特徴のリスト
   */
  private placeNatureFeatures(
    map: number[][],
    rooms: Room[],
    existingFeatures: PlacedFeature[],
    config: any
  ): PlacedFeature[] {
    const features: PlacedFeature[] = [];

    // 水場の配置
    const waterCount = Math.floor(this.width * this.height * 0.02); // 2%程度
    let waterPlaced = 0;
    let attempts = 0;

    while (waterPlaced < waterCount && attempts < waterCount * 10) {
      attempts++;
      const position = this.getRandomPosition(2);

      if (
        this.canPlaceAt(map, position.x, position.y, [TileType.GRASS]) &&
        !this.hasFeatureInRange(existingFeatures.concat(features), position.x, position.y, 3)
      ) {
        features.push(
          this.createFeature(position.x, position.y, FeatureType.WATER, { theme: 'nature' })
        );
        waterPlaced++;
      }
    }

    return features;
  }

  /**
   * ランダム特徴を配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param existingFeatures 既存の特徴リスト
   * @param config 配置設定
   * @returns 配置された特徴のリスト
   */
  private placeRandomFeatures(
    map: number[][],
    rooms: Room[],
    existingFeatures: PlacedFeature[],
    config: FeaturePlacementConfig
  ): PlacedFeature[] {
    const features: PlacedFeature[] = [];
    const targetCount = Math.floor(this.width * this.height * config.density);
    const featureTypes = [FeatureType.WATER, FeatureType.MOUNTAIN, FeatureType.HEAL];

    let attempts = 0;
    const maxAttempts = targetCount * 10;

    while (features.length < targetCount && attempts < maxAttempts) {
      attempts++;

      const position = this.getRandomPosition(1);
      const featureType = featureTypes[Math.floor(Math.random() * featureTypes.length)];

      if (
        this.canPlaceAt(map, position.x, position.y, [TileType.GRASS]) &&
        !this.hasFeatureInRange(existingFeatures.concat(features), position.x, position.y, 2)
      ) {
        features.push(
          this.createFeature(position.x, position.y, featureType, {
            placement: 'random',
            density: config.density,
          })
        );
      }
    }

    console.log(`Random features: placed ${features.length}/${targetCount} features`);
    return features;
  }

  /**
   * 特徴をマップに反映
   * @param map マップデータ
   * @param features 特徴のリスト
   */
  private applyFeaturesToMap(map: number[][], features: PlacedFeature[]): void {
    for (const feature of features) {
      if (this.isInBounds(feature.x, feature.y)) {
        let tileType: TileType;

        switch (feature.type) {
          case FeatureType.WATER:
            tileType = TileType.WATER;
            break;
          case FeatureType.MOUNTAIN:
            tileType = TileType.MOUNTAIN;
            break;
          case FeatureType.PORTAL:
            tileType = TileType.PORTAL;
            break;
          case FeatureType.HEAL:
            tileType = TileType.HEAL;
            break;
          default:
            continue; // 不明なタイプは配置しない
        }

        map[feature.y][feature.x] = tileType;
      }
    }
  }
}
