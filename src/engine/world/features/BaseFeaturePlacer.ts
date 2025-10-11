import { FeaturePlacerInterface, FeaturePlacementConfig, Room } from '../MapGeneratorInterface';
import {
  FeaturePlacementResult,
  PlacedFeature,
  FeaturePlacementRuleInterface,
  FeatureType,
  TileType,
} from '../../types';

/**
 * 特徴配置システムのベースクラス
 * 共通機能と基本的な特徴配置ロジックを提供
 */
export abstract class BaseFeaturePlacer implements FeaturePlacerInterface {
  protected width: number;
  protected height: number;
  protected seed: number;

  /**
   * コンストラクタ
   * @param width マップの幅
   * @param height マップの高さ
   * @param seed ランダムシード
   */
  constructor(width: number, height: number, seed?: number) {
    this.width = width;
    this.height = height;
    this.seed = seed || Date.now();
  }

  /**
   * 特徴を配置する（抽象メソッド）
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param config 特徴配置設定
   * @returns 配置された特徴のリストとメタデータ
   */
  abstract place(
    map: number[][],
    rooms: Room[],
    config: FeaturePlacementConfig
  ): FeaturePlacementResult;

  /**
   * この配置システムの種類を取得（抽象メソッド）
   * @returns 配置システムの種類
   */
  abstract getPlacerType(): string;

  /**
   * サポートするルールを取得（抽象メソッド）
   * @returns サポートするルールのリスト
   */
  abstract getSupportedRules(): string[];

  /**
   * 配置システムの説明を取得（抽象メソッド）
   * @returns 配置システムの説明
   */
  abstract getDescription(): string;

  /**
   * 座標が範囲内かチェック
   * @param x X座標
   * @param y Y座標
   * @returns 範囲内の場合true
   */
  protected isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * タイルが配置可能かチェック
   * @param map マップデータ
   * @param x X座標
   * @param y Y座標
   * @param allowedTiles 配置可能なタイルタイプのリスト
   * @returns 配置可能な場合true
   */
  protected canPlaceAt(map: number[][], x: number, y: number, allowedTiles: TileType[]): boolean {
    if (!this.isInBounds(x, y)) return false;
    return allowedTiles.includes(map[y][x]);
  }

  /**
   * 部屋内の座標かチェック
   * @param rooms 部屋のリスト
   * @param x X座標
   * @param y Y座標
   * @returns 部屋内の場合true
   */
  protected isInRoom(rooms: Room[], x: number, y: number): boolean {
    return rooms.some(
      (room) => x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height
    );
  }

  /**
   * 指定した座標の部屋を取得
   * @param rooms 部屋のリスト
   * @param x X座標
   * @param y Y座標
   * @returns 部屋（見つからない場合はnull）
   */
  protected getRoomAt(rooms: Room[], x: number, y: number): Room | null {
    return (
      rooms.find(
        (room) => x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height
      ) || null
    );
  }

  /**
   * 部屋の中心座標を取得
   * @param room 部屋
   * @returns 中心座標
   */
  protected getRoomCenter(room: Room): { x: number; y: number } {
    return {
      x: room.x + Math.floor(room.width / 2),
      y: room.y + Math.floor(room.height / 2),
    };
  }

  /**
   * 座標周辺の指定範囲内に指定タイプの特徴があるかチェック
   * @param features 既存の特徴リスト
   * @param x X座標
   * @param y Y座標
   * @param range 範囲
   * @param featureType チェックする特徴タイプ
   * @returns 指定特徴が範囲内にある場合true
   */
  protected hasFeatureInRange(
    features: PlacedFeature[],
    x: number,
    y: number,
    range: number,
    featureType?: FeatureType
  ): boolean {
    return features.some((feature) => {
      const distance = Math.sqrt(Math.pow(feature.x - x, 2) + Math.pow(feature.y - y, 2));
      return distance <= range && (featureType === undefined || feature.type === featureType);
    });
  }

  /**
   * ランダムな座標を生成
   * @param margin 境界からのマージン
   * @returns ランダムな座標
   */
  protected getRandomPosition(margin = 1): { x: number; y: number } {
    return {
      x: margin + Math.floor(Math.random() * (this.width - 2 * margin)),
      y: margin + Math.floor(Math.random() * (this.height - 2 * margin)),
    };
  }

  /**
   * ルールに基づいて配置可能かチェック
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param features 既存の特徴リスト
   * @param x X座標
   * @param y Y座標
   * @param rule 配置ルール
   * @returns 配置可能な場合true
   */
  protected canPlaceByRule(
    map: number[][],
    rooms: Room[],
    features: PlacedFeature[],
    x: number,
    y: number,
    rule: FeaturePlacementRuleInterface
  ): boolean {
    // 基本的な範囲チェック
    if (!this.isInBounds(x, y)) return false;

    // 許可されたタイルタイプチェック
    if (rule.allowedTiles && !this.canPlaceAt(map, x, y, rule.allowedTiles)) {
      return false;
    }

    // 部屋の条件チェック
    if (rule.requiresRoom !== undefined) {
      const inRoom = this.isInRoom(rooms, x, y);
      if (rule.requiresRoom && !inRoom) return false;
      if (!rule.requiresRoom && inRoom) return false;
    }

    // 部屋タイプの条件チェック
    if (rule.allowedRoomTypes && rule.allowedRoomTypes.length > 0) {
      const room = this.getRoomAt(rooms, x, y);
      if (!room || !rule.allowedRoomTypes.includes(room.type)) {
        return false;
      }
    }

    // 最小距離チェック
    if (rule.minDistance !== undefined && rule.minDistance > 0) {
      if (this.hasFeatureInRange(features, x, y, rule.minDistance)) {
        return false;
      }
    }

    // 特定特徴からの最小距離チェック
    if (rule.minDistanceFromFeature && Object.keys(rule.minDistanceFromFeature).length > 0) {
      for (const [featureType, minDist] of Object.entries(rule.minDistanceFromFeature)) {
        if (this.hasFeatureInRange(features, x, y, minDist as number, featureType as FeatureType)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 特徴オブジェクトを作成
   * @param x X座標
   * @param y Y座標
   * @param type 特徴タイプ
   * @param data 追加データ
   * @returns 特徴オブジェクト
   */
  protected createFeature(x: number, y: number, type: FeatureType, data: any = {}): PlacedFeature {
    return {
      x,
      y,
      type,
      data: {
        ...data,
        placedBy: this.getPlacerType(),
        timestamp: Date.now(),
      },
    };
  }

  /**
   * マップサイズを更新
   * @param width 新しい幅
   * @param height 新しい高さ
   */
  updateSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * シードを更新
   * @param seed 新しいシード
   */
  updateSeed(seed: number): void {
    this.seed = seed;
  }
}
