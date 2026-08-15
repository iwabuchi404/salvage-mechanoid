import {
  RoomGeneratorInterface,
  RoomGenerationConfig,
  RoomGenerationResult,
  Room,
  RoomType,
} from '../MapGeneratorInterface';
import { RoomIdGenerator } from '../RoomId';

/**
 * 部屋生成アルゴリズムの基底クラス
 * すべての部屋生成アルゴリズムが継承する共通機能を提供
 */
export abstract class BaseRoomGenerator implements RoomGeneratorInterface {
  // マップの幅
  protected width: number;

  // マップの高さ
  protected height: number;

  // ランダムシード（生成中に更新される）
  protected seed: number;

  // 元のシード値（生成開始時の値、customData に記録するために使用）
  protected originalSeed: number;

  // RoomId 採番器（生成ごとに1インスタンス）
  protected roomIdGenerator: RoomIdGenerator = new RoomIdGenerator();

  /**
   * コンストラクタ
   * @param width マップの幅
   * @param height マップの高さ
   * @param seed ランダムシード（オプション）
   */
  constructor(width: number, height: number, seed?: number) {
    this.width = width;
    this.height = height;
    this.seed = seed || Date.now();
    this.originalSeed = this.seed;

    console.log(`BaseRoomGenerator initialized: ${width}x${height}, seed: ${this.seed}`);
  }

  /**
   * 部屋を生成する（抽象メソッド）
   * 各アルゴリズムで実装する必要がある
   * @param config 部屋生成設定
   * @returns 生成された部屋のリストとメタデータ
   */
  abstract generate(config: RoomGenerationConfig): RoomGenerationResult;

  /**
   * このジェネレーターの種類を取得（抽象メソッド）
   * @returns アルゴリズムの種類
   */
  abstract getGeneratorType(): string;

  /**
   * サポートするパラメータを取得（抽象メソッド）
   * @returns サポートするパラメータのリスト
   */
  abstract getSupportedParameters(): string[];

  /**
   * ジェネレーターの説明を取得（抽象メソッド）
   * @returns ジェネレーターの説明
   */
  abstract getDescription(): string;

  /**
   * マップサイズを更新
   * @param width 新しい幅
   * @param height 新しい高さ
   */
  updateSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    console.log(`${this.getGeneratorType()} size updated to ${width}x${height}`);
  }

  /**
   * シード可能なランダム数生成
   * Linear Congruential Generatorを使用
   * @returns 0-1の範囲のランダム値
   */
  protected random(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  /**
   * 指定範囲のランダム整数を生成
   * @param min 最小値（含む）
   * @param max 最大値（含まない）
   * @returns ランダム整数
   */
  protected randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min;
  }

  /**
   * 座標が境界内にあるかチェック
   * @param x X座標
   * @param y Y座標
   * @returns 境界内の場合true
   */
  protected isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * 2点間の距離を計算
   * @param x1 点1のX座標
   * @param y1 点1のY座標
   * @param x2 点2のX座標
   * @param y2 点2のY座標
   * @returns ユークリッド距離
   */
  protected distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * マンハッタン距離を計算
   * @param x1 点1のX座標
   * @param y1 点1のY座標
   * @param x2 点2のX座標
   * @param y2 点2のY座標
   * @returns マンハッタン距離
   */
  protected manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }

  /**
   * 部屋が重複しているかチェック
   * @param room1 部屋1
   * @param room2 部屋2
   * @param margin 余白（デフォルト: 1）
   * @returns 重複している場合true
   */
  protected roomsOverlap(room1: Room, room2: Room, margin = 1): boolean {
    return !(
      room1.x + room1.width + margin <= room2.x ||
      room2.x + room2.width + margin <= room1.x ||
      room1.y + room1.height + margin <= room2.y ||
      room2.y + room2.height + margin <= room1.y
    );
  }

  /**
   * 部屋がマップ境界内にあるかチェック
   * @param room 部屋
   * @param margin 境界からの余白（デフォルト: 1）
   * @returns 境界内の場合true
   */
  protected isRoomInBounds(room: Room, margin = 1): boolean {
    return (
      room.x >= margin &&
      room.y >= margin &&
      room.x + room.width < this.width - margin &&
      room.y + room.height < this.height - margin
    );
  }

  /**
   * 部屋の中心座標を計算
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
   * 基本的な部屋を作成
   * @param x X座標
   * @param y Y座標
   * @param width 幅
   * @param height 高さ
   * @param type 部屋のタイプ（デフォルト: NORMAL）
   * @returns 部屋オブジェクト
   */
  protected createBasicRoom(
    x: number,
    y: number,
    width: number,
    height: number,
    type: RoomType = RoomType.NORMAL
  ): Room {
    return {
      id: this.roomIdGenerator.next(),
      x: Math.floor(x),
      y: Math.floor(y),
      width: Math.floor(width),
      height: Math.floor(height),
      type,
      connections: [],
      features: [],
      customData: {
        generationMethod: this.getGeneratorType(),
        seed: this.originalSeed,
      },
    };
  }

  /**
   * 現在のシード値を取得
   * @returns 現在のシード値
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * シード値を設定
   * @param seed 新しいシード値
   */
  setSeed(seed: number): void {
    this.seed = seed;
    this.originalSeed = seed;
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
