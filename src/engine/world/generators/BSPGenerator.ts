import { BaseRoomGenerator } from './BaseGenerator';
import {
  RoomGenerationConfig,
  RoomGenerationResult,
  Room,
  RoomType,
} from '../MapGeneratorInterface';
import { MapGenerationAlgorithm } from '../../types';

/**
 * BSP (Binary Space Partitioning) 部屋生成アルゴリズム
 * 再帰的空間分割により構造化された部屋配置を生成
 */
export class BSPGenerator extends BaseRoomGenerator {
  // 部屋間の最小距離
  private minRoomDistance = 3;

  // 最大再帰深度
  private maxDepth = 10;

  /**
   * コンストラクタ
   * @param width マップの幅
   * @param height マップの高さ
   * @param seed ランダムシード
   */
  constructor(width: number, height: number, seed?: number) {
    super(width, height, seed);
  }

  /**
   * BSPアルゴリズムで部屋を生成
   * @param config 部屋生成設定
   * @returns 生成された部屋のリストとメタデータ
   */
  generate(config: RoomGenerationConfig): RoomGenerationResult {
    const startTime = performance.now();

    console.log('BSPGenerator: Starting room generation...', config);

    // 元のシードを保存（生成中に random() でシードが更新されるため）
    const originalSeed = this.seed;

    // パラメータの設定
    this.minRoomDistance = Math.max(1, Math.floor(config.minSize / 2));

    // 空間分割により部屋を生成
    const rooms = this.splitSpace(0, 0, this.width, this.height, 0, config);

    // 設定に基づいてルームタイプを割り当て
    this.assignRoomTypes(rooms, config);

    const endTime = performance.now();

    console.log(`BSPGenerator: Generated ${rooms.length} rooms in ${endTime - startTime}ms`);

    return {
      rooms: rooms,
      metadata: {
        algorithm: 'bsp',
        parameters: config,
        generationTime: endTime - startTime,
        seed: originalSeed,
      },
    };
  }

  /**
   * このジェネレーターの種類を取得
   * @returns アルゴリズムの種類
   */
  getGeneratorType(): string {
    return MapGenerationAlgorithm.BSP;
  }

  /**
   * サポートするパラメータを取得
   * @returns サポートするパラメータのリスト
   */
  getSupportedParameters(): string[] {
    return ['minSize', 'maxSize', 'density', 'connectivity', 'roomTypes'];
  }

  /**
   * ジェネレーターの説明を取得
   * @returns ジェネレーターの説明
   */
  getDescription(): string {
    return 'Binary Space Partitioning algorithm for structured room layouts';
  }

  /**
   * 空間分割アルゴリズムを使用して部屋を生成
   * @param x 領域のX開始位置
   * @param y 領域のY開始位置
   * @param width 領域の幅
   * @param height 領域の高さ
   * @param depth 再帰の深さ
   * @param config 生成設定
   * @returns 生成された部屋のリスト
   */
  private splitSpace(
    x: number,
    y: number,
    width: number,
    height: number,
    depth: number,
    config: RoomGenerationConfig
  ): Room[] {
    // 再帰の終了条件
    if (
      width < config.maxSize * 2 + this.minRoomDistance ||
      height < config.maxSize * 2 + this.minRoomDistance ||
      depth > this.maxDepth
    ) {
      const room = this.createRoomInArea(x, y, width, height, config);
      return room ? [room] : [];
    }

    // 密度によってさらに分割するかを決定
    if (this.random() > config.density && depth > 2) {
      const room = this.createRoomInArea(x, y, width, height, config);
      return room ? [room] : [];
    }

    // 縦または横に分割（長い方向に分割する傾向）
    const splitVertical = width > height || (width === height && this.random() < 0.5);

    let splitPosition: number;
    if (splitVertical) {
      const minSplit = x + config.maxSize + this.minRoomDistance;
      const maxSplit = x + width - config.maxSize - this.minRoomDistance;
      splitPosition = this.randomInt(minSplit, maxSplit + 1);
    } else {
      const minSplit = y + config.maxSize + this.minRoomDistance;
      const maxSplit = y + height - config.maxSize - this.minRoomDistance;
      splitPosition = this.randomInt(minSplit, maxSplit + 1);
    }

    // 再帰的分割
    let leftRooms: Room[] = [];
    let rightRooms: Room[] = [];

    if (splitVertical) {
      leftRooms = this.splitSpace(x, y, splitPosition - x, height, depth + 1, config);
      rightRooms = this.splitSpace(
        splitPosition,
        y,
        x + width - splitPosition,
        height,
        depth + 1,
        config
      );
    } else {
      leftRooms = this.splitSpace(x, y, width, splitPosition - y, depth + 1, config);
      rightRooms = this.splitSpace(
        x,
        splitPosition,
        width,
        y + height - splitPosition,
        depth + 1,
        config
      );
    }

    return [...leftRooms, ...rightRooms];
  }

  /**
   * 指定された領域内に部屋を作成
   * @param x 領域のX開始位置
   * @param y 領域のY開始位置
   * @param width 領域の幅
   * @param height 領域の高さ
   * @param config 生成設定
   * @returns 作成された部屋（作成できない場合はnull）
   */
  private createRoomInArea(
    x: number,
    y: number,
    width: number,
    height: number,
    config: RoomGenerationConfig
  ): Room | null {
    // 部屋のサイズを決定
    const roomWidth = this.randomInt(
      config.minSize,
      Math.min(width - this.minRoomDistance * 2, config.maxSize) + 1
    );
    const roomHeight = this.randomInt(
      config.minSize,
      Math.min(height - this.minRoomDistance * 2, config.maxSize) + 1
    );

    // サイズが小さすぎる場合は作成しない
    if (roomWidth < config.minSize || roomHeight < config.minSize) {
      return null;
    }

    // 部屋の位置を決定（領域の中央付近にランダム配置）
    const maxX = Math.max(x + this.minRoomDistance, x + width - roomWidth - this.minRoomDistance);
    const maxY = Math.max(y + this.minRoomDistance, y + height - roomHeight - this.minRoomDistance);

    if (maxX < x + this.minRoomDistance || maxY < y + this.minRoomDistance) {
      return null;
    }

    const roomX = this.randomInt(x + this.minRoomDistance, maxX + 1);
    const roomY = this.randomInt(y + this.minRoomDistance, maxY + 1);

    // 境界チェック
    if (
      roomX + roomWidth >= this.width - this.minRoomDistance ||
      roomY + roomHeight >= this.height - this.minRoomDistance
    ) {
      return null;
    }

    return this.createBasicRoom(roomX, roomY, roomWidth, roomHeight, RoomType.NORMAL);
  }

  /**
   * 部屋タイプを割り当て
   * @param rooms 部屋のリスト
   * @param config 生成設定
   */
  private assignRoomTypes(rooms: Room[], config: RoomGenerationConfig): void {
    if (rooms.length === 0) return;

    // 入口と出口を設定
    if (rooms.length > 0) {
      rooms[0].type = RoomType.ENTRANCE;
    }
    if (rooms.length > 1) {
      rooms[rooms.length - 1].type = RoomType.EXIT;
    }

    // 設定に基づいて特別な部屋を配置
    const availableTypes = config.roomTypes.filter(
      (type) => type !== RoomType.ENTRANCE && type !== RoomType.EXIT
    );

    if (availableTypes.length > 0 && rooms.length > 2) {
      // ボス部屋（大きな部屋を優先）
      if (availableTypes.includes(RoomType.BOSS)) {
        const largeRooms = rooms
          .filter((room) => room.type === RoomType.NORMAL)
          .sort((a, b) => b.width * b.height - a.width * a.height);

        if (largeRooms.length > 0) {
          largeRooms[0].type = RoomType.BOSS;
        }
      }

      // 宝物庫（中央付近の部屋を優先）
      if (availableTypes.includes(RoomType.TREASURE)) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        const centralRooms = rooms
          .filter((room) => room.type === RoomType.NORMAL)
          .sort((a, b) => {
            const distA = this.distance(a.x + a.width / 2, a.y + a.height / 2, centerX, centerY);
            const distB = this.distance(b.x + b.width / 2, b.y + b.height / 2, centerX, centerY);
            return distA - distB;
          });

        if (centralRooms.length > 0) {
          centralRooms[0].type = RoomType.TREASURE;
        }
      }

      // その他の特別な部屋をランダムに配置
      const otherTypes = availableTypes.filter(
        (type) => type !== RoomType.BOSS && type !== RoomType.TREASURE
      );

      const normalRooms = rooms.filter((room) => room.type === RoomType.NORMAL);

      for (const roomType of otherTypes) {
        if (normalRooms.length > 0 && this.random() < 0.3) {
          const randomIndex = this.randomInt(0, normalRooms.length);
          normalRooms[randomIndex].type = roomType;
          normalRooms.splice(randomIndex, 1);
        }
      }
    }
  }
}
