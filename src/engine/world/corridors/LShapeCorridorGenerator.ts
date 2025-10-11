import {
  CorridorGeneratorInterface,
  CorridorGenerationConfig,
  Room,
} from '../MapGeneratorInterface';
import {
  CorridorGenerationResult,
  Corridor,
  CorridorGenerationMethod,
  TileType,
} from '../../types';

/**
 * L字型通路生成器
 * シンプルで効率的な2段階（水平→垂直または垂直→水平）通路生成
 */
export class LShapeCorridorGenerator implements CorridorGeneratorInterface {
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
   * 通路を生成する
   * @param rooms 部屋のリスト
   * @param config 通路生成設定
   * @returns 生成された通路のリストとメタデータ
   */
  generate(rooms: Room[], config: CorridorGenerationConfig): CorridorGenerationResult {
    const startTime = performance.now();

    if (rooms.length < 2) {
      return {
        corridors: [],
        metadata: {
          method: 'lshape',
          roomCount: rooms.length,
          totalLength: 0,
          generationTime: performance.now() - startTime,
        },
      };
    }

    console.log(`LShapeCorridorGenerator: Connecting ${rooms.length} rooms...`);

    // 通路を生成
    const corridors = this.generateLShapeCorridors(rooms, config);

    const endTime = performance.now();
    const totalLength = corridors.reduce(
      (sum, corridor) => sum + this.calculateCorridorLength(corridor),
      0
    );

    console.log(
      `LShapeCorridorGenerator: Generated ${
        corridors.length
      } corridors (total length: ${totalLength}) in ${endTime - startTime}ms`
    );

    return {
      corridors: corridors,
      metadata: {
        method: 'lshape',
        roomCount: rooms.length,
        totalLength: totalLength,
        generationTime: endTime - startTime,
      },
    };
  }

  /**
   * このジェネレーターの種類を取得
   * @returns アルゴリズムの種類
   */
  getGeneratorType(): string {
    return CorridorGenerationMethod.L_SHAPE;
  }

  /**
   * サポートするパラメータを取得
   * @returns サポートするパラメータのリスト
   */
  getSupportedParameters(): string[] {
    return ['width', 'redundancy'];
  }

  /**
   * ジェネレーターの説明を取得
   * @returns ジェネレーターの説明
   */
  getDescription(): string {
    return 'L-shape corridor generation for simple and efficient room connections';
  }

  /**
   * L字型通路を生成
   * @param rooms 部屋のリスト
   * @param config 通路生成設定
   * @returns 生成された通路のリスト
   */
  private generateLShapeCorridors(rooms: Room[], config: CorridorGenerationConfig): Corridor[] {
    const corridors: Corridor[] = [];

    // 順次接続（隣接する部屋同士を接続）
    for (let i = 0; i < rooms.length - 1; i++) {
      const roomA = rooms[i];
      const roomB = rooms[i + 1];

      const corridor = this.createLShapeCorridor(roomA, roomB, config);
      if (corridor) {
        corridors.push(corridor);
      }
    }

    // 冗長接続
    if (config.redundancy > 0) {
      const additionalCount = Math.floor(rooms.length * config.redundancy);

      for (let i = 0; i < additionalCount; i++) {
        const roomA = rooms[Math.floor(Math.random() * rooms.length)];
        const roomB = rooms[Math.floor(Math.random() * rooms.length)];

        if (roomA !== roomB) {
          const corridor = this.createLShapeCorridor(roomA, roomB, config);
          if (corridor) {
            corridors.push(corridor);
          }
        }
      }
    }

    return corridors;
  }

  /**
   * 2つの部屋間にL字型通路を作成
   * @param roomA 部屋A
   * @param roomB 部屋B
   * @param config 通路生成設定
   * @returns 作成された通路（失敗時はnull）
   */
  private createLShapeCorridor(
    roomA: Room,
    roomB: Room,
    config: CorridorGenerationConfig
  ): Corridor | null {
    // 部屋の中心座標を計算
    const centerA = {
      x: roomA.x + Math.floor(roomA.width / 2),
      y: roomA.y + Math.floor(roomA.height / 2),
    };
    const centerB = {
      x: roomB.x + Math.floor(roomB.width / 2),
      y: roomB.y + Math.floor(roomB.height / 2),
    };

    // 接続ポイントを決定
    const connectionA = this.findConnectionPoint(roomA, centerB);
    const connectionB = this.findConnectionPoint(roomB, centerA);

    // L字型通路の中間ポイントを決定
    // 50%の確率でどちら向きのLにするかを決める
    const useHorizontalFirst = Math.random() < 0.5;

    let cornerPoint: { x: number; y: number };
    if (useHorizontalFirst) {
      // 水平→垂直 (A→corner→B)
      cornerPoint = { x: connectionB.x, y: connectionA.y };
    } else {
      // 垂直→水平 (A→corner→B)
      cornerPoint = { x: connectionA.x, y: connectionB.y };
    }

    // 通路オブジェクトを作成
    const corridor: Corridor = {
      startX: connectionA.x,
      startY: connectionA.y,
      endX: connectionB.x,
      endY: connectionB.y,
      width: config.width,
      method: CorridorGenerationMethod.L_SHAPE,
      connectedRooms: [`${roomA.x},${roomA.y}`, `${roomB.x},${roomB.y}`],
    };

    return corridor;
  }

  /**
   * 部屋の最適な接続ポイントを見つける
   * @param room 部屋
   * @param targetCenter 接続先の中心座標
   * @returns 最適な接続ポイント
   */
  private findConnectionPoint(
    room: Room,
    targetCenter: { x: number; y: number }
  ): { x: number; y: number } {
    const roomCenter = {
      x: room.x + Math.floor(room.width / 2),
      y: room.y + Math.floor(room.height / 2),
    };

    // 目標との相対位置に基づいて接続ポイントを決定
    const dx = targetCenter.x - roomCenter.x;
    const dy = targetCenter.y - roomCenter.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      // 水平方向の距離が大きい場合
      if (dx > 0) {
        // 右側に接続
        return { x: room.x + room.width - 1, y: roomCenter.y };
      } else {
        // 左側に接続
        return { x: room.x, y: roomCenter.y };
      }
    } else {
      // 垂直方向の距離が大きい場合
      if (dy > 0) {
        // 下側に接続
        return { x: roomCenter.x, y: room.y + room.height - 1 };
      } else {
        // 上側に接続
        return { x: roomCenter.x, y: room.y };
      }
    }
  }

  /**
   * 通路の長さを計算
   * @param corridor 通路
   * @returns 長さ（マンハッタン距離）
   */
  private calculateCorridorLength(corridor: Corridor): number {
    return Math.abs(corridor.endX - corridor.startX) + Math.abs(corridor.endY - corridor.startY);
  }

  /**
   * マップにL字型通路を描画
   * @param map マップデータ
   * @param corridors 通路のリスト
   * @param tileType 通路のタイルタイプ（デフォルト: GRASS）
   */
  drawCorridorsOnMap(
    map: number[][],
    corridors: Corridor[],
    tileType: TileType = TileType.GRASS
  ): void {
    for (const corridor of corridors) {
      this.drawLShapeCorridor(map, corridor, tileType);
    }
  }

  /**
   * L字型通路を描画
   * @param map マップデータ
   * @param corridor 通路
   * @param tileType タイルタイプ
   */
  private drawLShapeCorridor(map: number[][], corridor: Corridor, tileType: TileType): void {
    const startX = corridor.startX;
    const startY = corridor.startY;
    const endX = corridor.endX;
    const endY = corridor.endY;

    // L字の角を決定（ランダムまたは効率的な方向を選択）
    const useHorizontalFirst = Math.random() < 0.5;

    if (useHorizontalFirst) {
      // 水平→垂直
      // 水平線を描画
      this.drawHorizontalLine(map, startX, endX, startY, corridor.width, tileType);
      // 垂直線を描画
      this.drawVerticalLine(map, endX, startY, endY, corridor.width, tileType);
    } else {
      // 垂直→水平
      // 垂直線を描画
      this.drawVerticalLine(map, startX, startY, endY, corridor.width, tileType);
      // 水平線を描画
      this.drawHorizontalLine(map, startX, endX, endY, corridor.width, tileType);
    }
  }

  /**
   * 水平線を描画
   * @param map マップデータ
   * @param startX 開始X座標
   * @param endX 終了X座標
   * @param y Y座標
   * @param width 線の幅
   * @param tileType タイルタイプ
   */
  private drawHorizontalLine(
    map: number[][],
    startX: number,
    endX: number,
    y: number,
    width: number,
    tileType: TileType
  ): void {
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const halfWidth = Math.floor(width / 2);

    for (let x = minX; x <= maxX; x++) {
      for (let dy = -halfWidth; dy <= halfWidth; dy++) {
        const ny = y + dy;
        if (x >= 0 && x < this.width && ny >= 0 && ny < this.height) {
          map[ny][x] = tileType;
        }
      }
    }
  }

  /**
   * 垂直線を描画
   * @param map マップデータ
   * @param x X座標
   * @param startY 開始Y座標
   * @param endY 終了Y座標
   * @param width 線の幅
   * @param tileType タイルタイプ
   */
  private drawVerticalLine(
    map: number[][],
    x: number,
    startY: number,
    endY: number,
    width: number,
    tileType: TileType
  ): void {
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);
    const halfWidth = Math.floor(width / 2);

    for (let y = minY; y <= maxY; y++) {
      for (let dx = -halfWidth; dx <= halfWidth; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < this.width && y >= 0 && y < this.height) {
          map[y][nx] = tileType;
        }
      }
    }
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
}
