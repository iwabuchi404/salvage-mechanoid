import { TileMap } from '../../engine/world/TileMap';
import { TileType, Room } from '../../engine/types';
import { EvaluationResult, EvaluationMetrics, MapStatistics, RoomAnalysis } from './types';

/**
 * マップ評価クラス
 * マップの品質を定量的に評価する
 */
export class MapEvaluator {
  /**
   * マップを評価
   * @param tileMap 評価対象のタイルマップ
   * @param includeAscii ASCII表示を含めるか
   * @param rooms 生成時の部屋情報（オプション）
   * @param obstacles 障害物情報（オプション）
   * @param items アイテム情報（オプション）
   * @param enemies 敵情報（オプション）
   * @returns 評価結果
   */
  evaluate(
    tileMap: TileMap,
    includeAscii = false,
    rooms?: Room[],
    obstacles?: any[],
    items?: any[],
    enemies?: any[]
  ): EvaluationResult {
    const statistics = this.calculateStatistics(tileMap);
    const connectivity = this.checkConnectivity(tileMap);
    const roomAnalysis = this.analyzeRooms(tileMap, rooms);
    const roomDistribution = this.calculateRoomDistribution(tileMap, roomAnalysis);
    const corridorEfficiency = this.calculateCorridorEfficiency(tileMap);

    const metrics: EvaluationMetrics = {
      connectivity,
      roomCount: roomAnalysis.roomCount,
      roomSizeVariance: roomAnalysis.roomSizeVariance,
      roomDistribution,
      corridorEfficiency,
    };

    const { isValid, issues } = this.validateMap(metrics, statistics);
    const score = this.calculateScore(metrics, isValid);

    const result: EvaluationResult = {
      isValid,
      score,
      metrics,
      issues,
      statistics,
    };

    if (includeAscii) {
      result.asciiMap = this.generateAsciiMap(tileMap, obstacles, items, enemies);
    }

    return result;
  }

  /**
   * 基本統計情報を計算
   */
  private calculateStatistics(tileMap: TileMap): MapStatistics {
    const size = tileMap.getSize();
    const totalTiles = size.width * size.height;
    let floorTiles = 0;
    let wallTiles = 0;

    for (let y = 0; y < size.height; y++) {
      for (let x = 0; x < size.width; x++) {
        const tile = tileMap.getTile(x, y, 0);
        if (tile) {
          if (tile.walkable) {
            floorTiles++;
          } else if (tile.type !== TileType.EMPTY) {
            wallTiles++;
          }
        }
      }
    }

    return {
      totalTiles,
      floorTiles,
      wallTiles,
      floorRatio: floorTiles / totalTiles,
      dimensions: {
        width: size.width,
        height: size.height,
      },
    };
  }

  /**
   * 接続性チェック（flood fill）
   * すべての通行可能タイルが接続されているかを確認
   * @returns 到達可能なタイルの割合 (0-1)
   */
  private checkConnectivity(tileMap: TileMap): number {
    const size = tileMap.getSize();
    const visited = new Set<string>();

    // デバッグ: タイルのサンプルを確認
    let walkableCount = 0;
    let nonWalkableButGrassCount = 0;
    for (let y = 0; y < Math.min(10, size.height); y++) {
      for (let x = 0; x < Math.min(10, size.width); x++) {
        const tile = tileMap.getTile(x, y, 0);
        if (tile) {
          if (tile.walkable) walkableCount++;
          if (!tile.walkable && tile.type !== 0) nonWalkableButGrassCount++;
        }
      }
    }
    console.log(
      `Tile sample (10x10): walkable=${walkableCount}, non-walkable-but-has-type=${nonWalkableButGrassCount}`
    );

    // 最初の通行可能タイルを見つける
    let startX = -1;
    let startY = -1;
    for (let y = 0; y < size.height && startX === -1; y++) {
      for (let x = 0; x < size.width; x++) {
        if (tileMap.isWalkable(x, y, 0)) {
          startX = x;
          startY = y;
          break;
        }
      }
    }

    if (startX === -1) {
      return 0; // 通行可能タイルがない
    }

    // Flood fill
    const queue: Array<[number, number]> = [[startX, startY]];
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;

      // 4方向をチェック
      const directions = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ];

      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;

        if (!visited.has(key) && tileMap.isWalkable(nx, ny, 0)) {
          visited.add(key);
          queue.push([nx, ny]);
        }
      }
    }

    // 全通行可能タイル数を数える
    let totalWalkable = 0;
    for (let y = 0; y < size.height; y++) {
      for (let x = 0; x < size.width; x++) {
        if (tileMap.isWalkable(x, y, 0)) {
          totalWalkable++;
        }
      }
    }

    return totalWalkable > 0 ? visited.size / totalWalkable : 0;
  }

  /**
   * 部屋分析
   * 部屋のサイズと配置を分析
   * @param tileMap タイルマップ
   * @param rooms 生成時の部屋情報（オプション）
   */
  private analyzeRooms(tileMap: TileMap, rooms?: Room[]): RoomAnalysis {
    // 部屋情報が渡された場合はそれを使用
    if (rooms && rooms.length > 0) {
      const roomSizes = rooms.map((room) => room.width * room.height);
      const roomPositions = rooms.map((room) => ({ x: room.x, y: room.y }));
      const roomCount = rooms.length;
      const averageRoomSize = roomSizes.reduce((a, b) => a + b, 0) / roomCount;
      const roomSizeVariance = this.calculateVariance(roomSizes);

      return {
        roomCount,
        averageRoomSize,
        roomSizeVariance,
        roomSizes,
        roomPositions,
      };
    }

    // 部屋情報がない場合は従来のflood fillロジックを使用
    const size = tileMap.getSize();
    const visited = new Set<string>();
    const roomSizes: number[] = [];
    const roomPositions: Array<{ x: number; y: number }> = [];

    // 各通行可能エリアを部屋として検出（flood fill）
    for (let y = 0; y < size.height; y++) {
      for (let x = 0; x < size.width; x++) {
        const key = `${x},${y}`;
        if (!visited.has(key) && tileMap.isWalkable(x, y, 0)) {
          const roomSize = this.floodFillRoom(tileMap, x, y, visited);

          // 極小の部屋（通路の一部など）は除外
          if (roomSize >= 9) {
            roomSizes.push(roomSize);
            roomPositions.push({ x, y });
          }
        }
      }
    }

    const roomCount = roomSizes.length;
    const averageRoomSize = roomCount > 0 ? roomSizes.reduce((a, b) => a + b, 0) / roomCount : 0;
    const roomSizeVariance = this.calculateVariance(roomSizes);

    return {
      roomCount,
      averageRoomSize,
      roomSizeVariance,
      roomSizes,
      roomPositions,
    };
  }

  /**
   * Flood fillで部屋のサイズを測定
   */
  private floodFillRoom(
    tileMap: TileMap,
    startX: number,
    startY: number,
    visited: Set<string>
  ): number {
    const queue: Array<[number, number]> = [[startX, startY]];
    visited.add(`${startX},${startY}`);
    let size = 0;

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      size++;

      const directions = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ];

      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;

        if (!visited.has(key) && tileMap.isWalkable(nx, ny, 0)) {
          visited.add(key);
          queue.push([nx, ny]);
        }
      }
    }

    return size;
  }

  /**
   * 部屋の配置の偏りを計算
   * マップ中心からの距離の偏差を測定
   * @returns 0-1 の値（低いほど均等に分散）
   */
  private calculateRoomDistribution(tileMap: TileMap, roomAnalysis: RoomAnalysis): number {
    if (roomAnalysis.roomCount === 0) return 1;

    const size = tileMap.getSize();
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

    const distances = roomAnalysis.roomPositions.map((pos) => {
      const dx = pos.x - centerX;
      const dy = pos.y - centerY;
      return Math.sqrt(dx * dx + dy * dy) / maxDistance;
    });

    // 距離の標準偏差（低いほど偏っている）
    const variance = this.calculateVariance(distances);
    return Math.max(0, 1 - variance * 2); // 高い分散 = 良い分布
  }

  /**
   * 通路の効率性を計算
   * 実装が複雑なため、現時点では床タイルの連結度で代用
   */
  private calculateCorridorEfficiency(tileMap: TileMap): number {
    const size = tileMap.getSize();
    let corridorTiles = 0;
    let totalWalkable = 0;

    for (let y = 0; y < size.height; y++) {
      for (let x = 0; x < size.width; x++) {
        if (tileMap.isWalkable(x, y, 0)) {
          totalWalkable++;

          // 通路判定: 両側が壁の細い通路
          const isNarrow = this.isNarrowCorridor(tileMap, x, y);
          if (isNarrow) {
            corridorTiles++;
          }
        }
      }
    }

    // 通路タイルの比率（低いほど効率的）
    if (totalWalkable === 0) return 0;
    const corridorRatio = corridorTiles / totalWalkable;
    return Math.max(0, 1 - corridorRatio * 2);
  }

  /**
   * 細い通路かどうかを判定
   */
  private isNarrowCorridor(tileMap: TileMap, x: number, y: number): boolean {
    const horizontal = tileMap.isWalkable(x - 1, y, 0) || tileMap.isWalkable(x + 1, y, 0);
    const vertical = tileMap.isWalkable(x, y - 1, 0) || tileMap.isWalkable(x, y + 1, 0);
    const horizontalWalls = !tileMap.isWalkable(x - 1, y, 0) && !tileMap.isWalkable(x + 1, y, 0);
    const verticalWalls = !tileMap.isWalkable(x, y - 1, 0) && !tileMap.isWalkable(x, y + 1, 0);

    return (horizontal && verticalWalls) || (vertical && horizontalWalls);
  }

  /**
   * 分散を計算
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * マップの妥当性を検証
   */
  private validateMap(
    metrics: EvaluationMetrics,
    statistics: MapStatistics
  ): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // 接続性チェック
    if (metrics.connectivity < 0.95) {
      issues.push(`到達不可能エリアあり (${((1 - metrics.connectivity) * 100).toFixed(1)}%)`);
    }

    // 部屋数チェック
    if (metrics.roomCount < 3) {
      issues.push(`部屋数が少ない (${metrics.roomCount}部屋)`);
    } else if (metrics.roomCount > 15) {
      issues.push(`部屋数が多すぎる (${metrics.roomCount}部屋)`);
    }

    // 床タイル比率チェック
    // ダンジョン型マップでは10-30%が標準的、洞窟型では30-70%が標準的
    if (statistics.floorRatio < 0.08) {
      issues.push(`床タイルが極端に少ない (${(statistics.floorRatio * 100).toFixed(1)}%)`);
    } else if (statistics.floorRatio > 0.8) {
      issues.push(`床タイルが極端に多い (${(statistics.floorRatio * 100).toFixed(1)}%)`);
    }

    const isValid = issues.length === 0;

    return { isValid, issues };
  }

  /**
   * 総合スコアを計算 (0-100)
   */
  private calculateScore(metrics: EvaluationMetrics, isValid: boolean): number {
    if (!isValid) {
      // 致命的欠陥がある場合は低スコア
      return Math.min(50, metrics.connectivity * 50);
    }

    // 各指標の重み付け
    const weights = {
      connectivity: 0.3,
      roomCount: 0.2,
      roomSizeVariance: 0.2,
      roomDistribution: 0.15,
      corridorEfficiency: 0.15,
    };

    // 部屋数を正規化（理想: 5-10部屋）
    const normalizedRoomCount = this.normalizeRoomCount(metrics.roomCount);

    const score =
      metrics.connectivity * weights.connectivity * 100 +
      normalizedRoomCount * weights.roomCount * 100 +
      Math.min(1, metrics.roomSizeVariance / 50) * weights.roomSizeVariance * 100 +
      (1 - metrics.roomDistribution) * weights.roomDistribution * 100 +
      metrics.corridorEfficiency * weights.corridorEfficiency * 100;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * 部屋数を正規化 (理想: 5-10部屋)
   */
  private normalizeRoomCount(count: number): number {
    if (count < 3) return count / 5;
    if (count >= 5 && count <= 10) return 1;
    if (count > 10) return Math.max(0, 1 - (count - 10) / 10);
    return count / 5;
  }

  /**
   * ASCII形式でマップを生成
   */
  generateAsciiMap(tileMap: TileMap, obstacles?: any[], items?: any[], enemies?: any[]): string {
    const size = tileMap.getSize();
    const lines: string[] = [];

    // 配置情報をマップに変換（高速検索用）
    const obstacleMap = new Map<string, any>();
    const itemMap = new Map<string, any>();
    const enemyMap = new Map<string, any>();

    obstacles?.forEach((obs) => obstacleMap.set(`${obs.x},${obs.y}`, obs));
    items?.forEach((item) => itemMap.set(`${item.x},${item.y}`, item));
    enemies?.forEach((enemy) => enemyMap.set(`${enemy.x},${enemy.y}`, enemy));

    for (let y = 0; y < size.height; y++) {
      let line = '';
      for (let x = 0; x < size.width; x++) {
        const key = `${x},${y}`;
        const tile = tileMap.getTile(x, y, 0);

        // 優先順位: 敵 > アイテム > 障害物 > 地形
        if (enemyMap.has(key)) {
          line += 'E'; // Enemy
        } else if (itemMap.has(key)) {
          const item = itemMap.get(key);
          // レアリティに応じて表示を変える
          switch (item.rarity) {
            case 'legendary':
              line += '*'; // Legendary item
              break;
            case 'rare':
              line += '$'; // Rare item
              break;
            case 'uncommon':
              line += 'i'; // Uncommon item
              break;
            default:
              line += 'I'; // Common item
              break;
          }
        } else if (obstacleMap.has(key)) {
          line += 'O'; // Obstacle
        } else if (!tile || tile.type === TileType.EMPTY) {
          line += '#'; // EMPTY = 壁として表示
        } else if (tile.walkable) {
          line += '.'; // 床
        } else {
          line += '#'; // 通行不可 = 壁
        }
      }
      lines.push(line);
    }

    // 凡例を追加
    lines.push('');
    lines.push('凡例: . = 床, # = 壁, O = 障害物, E = 敵');
    lines.push('      I = アイテム(Common), i = Uncommon, $ = Rare, * = Legendary');

    return lines.join('\n');
  }
}
