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
import { AStar } from '../pathfinding/AStar';

/**
 * A*アルゴリズムを使用した通路生成器
 */
export class AStarCorridorGenerator implements CorridorGeneratorInterface {
  private width: number;
  private height: number;
  private astar: AStar;

  /**
   * コンストラクタ
   * @param width マップの幅
   * @param height マップの高さ
   */
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.astar = new AStar(width, height, false);
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
          method: 'astar',
          roomCount: rooms.length,
          totalLength: 0,
          generationTime: performance.now() - startTime,
        },
      };
    }

    console.log(`AStarCorridorGenerator: Connecting ${rooms.length} rooms...`);

    // マップ上の障害物を設定（部屋以外のエリア）
    this.setupObstacles(rooms);

    // 通路を生成
    const corridors = this.generateCorridors(rooms, config);

    const endTime = performance.now();
    const totalLength = corridors.reduce(
      (sum, corridor) => sum + this.calculateCorridorLength(corridor),
      0
    );

    console.log(
      `AStarCorridorGenerator: Generated ${
        corridors.length
      } corridors (total length: ${totalLength}) in ${endTime - startTime}ms`
    );

    return {
      corridors: corridors,
      metadata: {
        method: 'astar',
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
    return CorridorGenerationMethod.ASTAR;
  }

  /**
   * サポートするパラメータを取得
   * @returns サポートするパラメータのリスト
   */
  getSupportedParameters(): string[] {
    return ['width', 'redundancy', 'allowDiagonal'];
  }

  /**
   * ジェネレーターの説明を取得
   * @returns ジェネレーターの説明
   */
  getDescription(): string {
    return 'A* pathfinding algorithm for optimal corridor generation';
  }

  /**
   * 障害物を設定
   * @param rooms 部屋のリスト
   */
  private setupObstacles(rooms: Room[]): void {
    // マップの外周のみを障害物として設定
    // 部屋の外側のエリアも通路として使えるようにする
    const obstacles: { x: number; y: number }[] = [];

    // マップの境界（外周2マス）を障害物に設定
    // 外周1マスだけだと通路が境界ギリギリになる可能性があるため2マスに
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // 外周2マスを障害物に
        if (x < 2 || x >= this.width - 2 || y < 2 || y >= this.height - 2) {
          obstacles.push({ x, y });
        }
      }
    }

    this.astar.setObstacles(obstacles);

    // デバッグ用: 障害物の数を出力
    console.log(`AStarCorridorGenerator: Set ${obstacles.length} obstacles (map edges)`);
  }

  /**
   * 通路を生成
   * @param rooms 部屋のリスト
   * @param config 通路生成設定
   * @returns 生成された通路のリスト
   */
  private generateCorridors(rooms: Room[], config: CorridorGenerationConfig): Corridor[] {
    const corridors: Corridor[] = [];
    const paths: Array<Array<{ x: number; y: number }>> = []; // パスを保存

    // 最小スパニングツリーによる基本接続
    const connections = this.generateMinimumSpanningTree(rooms);

    // 基本通路を作成
    for (const connection of connections) {
      const roomA = rooms[connection.roomAIndex];
      const roomB = rooms[connection.roomBIndex];

      const result = this.createCorridorWithPath(roomA, roomB, config);
      if (result) {
        corridors.push(result.corridor);
        paths.push(result.path);
      }
    }

    // 冗長性による追加接続
    if (config.redundancy > 0) {
      const additionalConnections = this.generateRedundantConnections(
        rooms,
        connections,
        config.redundancy
      );

      for (const connection of additionalConnections) {
        const roomA = rooms[connection.roomAIndex];
        const roomB = rooms[connection.roomBIndex];

        const result = this.createCorridorWithPath(roomA, roomB, config);
        if (result) {
          corridors.push(result.corridor);
          paths.push(result.path);
        }
      }
    }

    // パス情報をCorridorに保存
    for (let i = 0; i < corridors.length; i++) {
      (corridors[i] as any).path = paths[i];
    }

    return corridors;
  }

  /**
   * 最小スパニングツリーを生成（Prim's algorithm）
   * @param rooms 部屋のリスト
   * @returns 接続情報のリスト
   */
  private generateMinimumSpanningTree(
    rooms: Room[]
  ): Array<{ roomAIndex: number; roomBIndex: number; distance: number }> {
    if (rooms.length < 2) return [];

    const connections: Array<{ roomAIndex: number; roomBIndex: number; distance: number }> = [];
    const visited = new Set<number>();

    // 最初の部屋から開始
    visited.add(0);

    while (visited.size < rooms.length) {
      let minDistance = Infinity;
      let bestConnection: { roomAIndex: number; roomBIndex: number; distance: number } | null =
        null;

      // 訪問済み部屋から未訪問部屋への最短距離を探す
      for (const visitedIndex of visited) {
        for (let i = 0; i < rooms.length; i++) {
          if (!visited.has(i)) {
            const distance = this.calculateRoomDistance(rooms[visitedIndex], rooms[i]);
            if (distance < minDistance) {
              minDistance = distance;
              bestConnection = {
                roomAIndex: visitedIndex,
                roomBIndex: i,
                distance: distance,
              };
            }
          }
        }
      }

      if (bestConnection) {
        connections.push(bestConnection);
        visited.add(bestConnection.roomBIndex);
      } else {
        break; // 接続できない部屋がある場合
      }
    }

    return connections;
  }

  /**
   * 冗長接続を生成
   * @param rooms 部屋のリスト
   * @param existingConnections 既存の接続
   * @param redundancy 冗長度
   * @returns 追加接続のリスト
   */
  private generateRedundantConnections(
    rooms: Room[],
    existingConnections: Array<{ roomAIndex: number; roomBIndex: number; distance: number }>,
    redundancy: number
  ): Array<{ roomAIndex: number; roomBIndex: number; distance: number }> {
    const additionalConnections: Array<{
      roomAIndex: number;
      roomBIndex: number;
      distance: number;
    }> = [];
    const maxAdditional = Math.floor(rooms.length * redundancy);

    // 既存の接続をセットに変換（高速検索用）
    const existingSet = new Set(
      existingConnections.map(
        (conn) =>
          `${Math.min(conn.roomAIndex, conn.roomBIndex)}-${Math.max(
            conn.roomAIndex,
            conn.roomBIndex
          )}`
      )
    );

    // 全ての可能な接続を距離順にソート
    const allPossibleConnections: Array<{
      roomAIndex: number;
      roomBIndex: number;
      distance: number;
    }> = [];

    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const key = `${i}-${j}`;
        if (!existingSet.has(key)) {
          allPossibleConnections.push({
            roomAIndex: i,
            roomBIndex: j,
            distance: this.calculateRoomDistance(rooms[i], rooms[j]),
          });
        }
      }
    }

    // 距離の短い順にソート
    allPossibleConnections.sort((a, b) => a.distance - b.distance);

    // 指定された数まで追加
    for (let i = 0; i < Math.min(maxAdditional, allPossibleConnections.length); i++) {
      additionalConnections.push(allPossibleConnections[i]);
    }

    return additionalConnections;
  }

  /**
   * 2つの部屋間の距離を計算
   * @param roomA 部屋A
   * @param roomB 部屋B
   * @returns 距離
   */
  private calculateRoomDistance(roomA: Room, roomB: Room): number {
    const centerA = {
      x: roomA.x + Math.floor(roomA.width / 2),
      y: roomA.y + Math.floor(roomA.height / 2),
    };
    const centerB = {
      x: roomB.x + Math.floor(roomB.width / 2),
      y: roomB.y + Math.floor(roomB.height / 2),
    };

    const dx = centerB.x - centerA.x;
    const dy = centerB.y - centerA.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 2つの部屋間に通路を作成（パス情報付き）
   * @param roomA 部屋A
   * @param roomB 部屋B
   * @param config 通路生成設定
   * @returns 作成された通路とパス（失敗時はnull）
   */
  private createCorridorWithPath(
    roomA: Room,
    roomB: Room,
    config: CorridorGenerationConfig
  ): { corridor: Corridor; path: Array<{ x: number; y: number }> } | null {
    // 部屋の接続ポイントを決定
    const connectionA = this.findBestConnectionPoint(roomA, roomB);
    const connectionB = this.findBestConnectionPoint(roomB, roomA);

    // デバッグ情報
    console.log(
      `Attempting path: (${connectionA.x},${connectionA.y}) -> (${connectionB.x},${connectionB.y})`
    );

    // A*で経路を探索
    const path = this.astar.findPath(connectionA, connectionB);

    if (path.length === 0) {
      console.warn(
        `Failed to find path between rooms at (${roomA.x},${roomA.y}) and (${roomB.x},${roomB.y})`
      );
      console.warn(
        `  Connection points: (${connectionA.x},${connectionA.y}) -> (${connectionB.x},${connectionB.y})`
      );
      return null;
    }

    console.log(`Found path with ${path.length} points`);

    // 通路の幅を決定（minWidth/maxWidthが設定されていれば確率的にランダム化）
    // 1-2マス: 80%, 3マス: 20%
    let corridorWidth = config.width;
    if (config.minWidth !== undefined && config.maxWidth !== undefined) {
      const rand = Math.random();
      if (rand < 0.8) {
        // 80%の確率で1-2マス
        corridorWidth = Math.floor(Math.random() * 2) + 1; // 1 or 2
      } else {
        // 20%の確率で3マス
        corridorWidth = 3;
      }
    }

    // 通路オブジェクトを作成
    const corridor: Corridor = {
      startX: connectionA.x,
      startY: connectionA.y,
      endX: connectionB.x,
      endY: connectionB.y,
      width: corridorWidth,
      method: CorridorGenerationMethod.ASTAR,
      connectedRooms: [roomA.id!, roomB.id!],
    };

    return { corridor, path };
  }

  /**
   * 部屋の最適な接続ポイントを見つける
   * @param fromRoom 接続元の部屋
   * @param toRoom 接続先の部屋
   * @returns 最適な接続ポイント
   */
  private findBestConnectionPoint(fromRoom: Room, toRoom: Room): { x: number; y: number } {
    const toCenter = {
      x: toRoom.x + Math.floor(toRoom.width / 2),
      y: toRoom.y + Math.floor(toRoom.height / 2),
    };

    let bestPoint = {
      x: fromRoom.x + Math.floor(fromRoom.width / 2),
      y: fromRoom.y + Math.floor(fromRoom.height / 2),
    };
    let minDistance = Infinity;

    // 部屋の境界上の全てのポイントを確認
    const boundaryPoints: { x: number; y: number }[] = [];

    // 上下の境界
    for (let x = fromRoom.x; x < fromRoom.x + fromRoom.width; x++) {
      boundaryPoints.push({ x, y: fromRoom.y });
      boundaryPoints.push({ x, y: fromRoom.y + fromRoom.height - 1 });
    }

    // 左右の境界
    for (let y = fromRoom.y; y < fromRoom.y + fromRoom.height; y++) {
      boundaryPoints.push({ x: fromRoom.x, y });
      boundaryPoints.push({ x: fromRoom.x + fromRoom.width - 1, y });
    }

    // 最短距離のポイントを選択
    for (const point of boundaryPoints) {
      const dx = toCenter.x - point.x;
      const dy = toCenter.y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        bestPoint = point;
      }
    }

    return bestPoint;
  }

  /**
   * 通路の長さを計算
   * @param corridor 通路
   * @returns 長さ
   */
  private calculateCorridorLength(corridor: Corridor): number {
    const dx = corridor.endX - corridor.startX;
    const dy = corridor.endY - corridor.startY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * マップにA*で生成した通路を描画
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
      // 保存されたパスを使用（あれば）
      let path: Array<{ x: number; y: number }> = (corridor as any).path;

      // パスが保存されていない場合は再計算
      if (!path || path.length === 0) {
        console.warn('Corridor path not found, recalculating...');
        path = this.astar.findPath(
          { x: corridor.startX, y: corridor.startY },
          { x: corridor.endX, y: corridor.endY }
        );
      }

      console.log(`Drawing corridor with ${path.length} points, width: ${corridor.width}`);

      for (const point of path) {
        if (point.x >= 0 && point.x < this.width && point.y >= 0 && point.y < this.height) {
          map[point.y][point.x] = tileType;

          // 通路の幅を適用
          if (corridor.width > 1) {
            const halfWidth = Math.floor(corridor.width / 2);
            for (let dx = -halfWidth; dx <= halfWidth; dx++) {
              for (let dy = -halfWidth; dy <= halfWidth; dy++) {
                const nx = point.x + dx;
                const ny = point.y + dy;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                  map[ny][nx] = tileType;
                }
              }
            }
          }
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
    this.astar.updateSize(width, height);
  }
}
