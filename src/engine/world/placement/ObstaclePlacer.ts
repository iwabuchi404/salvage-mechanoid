import {
  PlacedObstacle,
  ObstacleType,
  ObstaclePlacementConfig,
  Room,
  Corridor,
  TacticalElement,
} from '../../types';

/**
 * 障害物配置システム
 * 遮蔽物、破壊可能オブジェクト、インタラクティブオブジェクトを配置
 */
export class ObstaclePlacer {
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * 障害物を配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param corridors 通路のリスト
   * @param tacticalElements 戦術要素のリスト
   * @param config 障害物配置設定
   * @returns 配置された障害物のリスト
   */
  placeObstacles(
    map: number[][],
    rooms: Room[],
    corridors: Corridor[],
    tacticalElements: TacticalElement[],
    config: ObstaclePlacementConfig
  ): PlacedObstacle[] {
    console.log('ObstaclePlacer: Starting obstacle placement...');
    const startTime = performance.now();

    const obstacles: PlacedObstacle[] = [];

    // 1. 戦術要素に基づく障害物配置（高台周辺など）
    obstacles.push(...this.placeTacticalObstacles(tacticalElements, config));

    // 2. チョークポイントの強化
    obstacles.push(...this.placeChokeObstacles(map, corridors, rooms, config));

    // 3. 部屋内の遮蔽物配置（後で敵が使える）
    if (config.coverDensity > 0) {
      obstacles.push(...this.placeCoverObjects(rooms, config, map, corridors));
    }

    // 4. 破壊可能オブジェクトの配置
    obstacles.push(...this.placeDestructibles(rooms, config, map, corridors));

    // 5. インタラクティブオブジェクトの配置
    obstacles.push(...this.placeInteractives(rooms, config, map, corridors));

    const endTime = performance.now();
    console.log(
      `ObstaclePlacer: Placed ${obstacles.length} obstacles in ${(endTime - startTime).toFixed(
        2
      )}ms`
    );

    return obstacles;
  }

  /**
   * 戦術要素に基づく障害物配置
   */
  private placeTacticalObstacles(
    tacticalElements: TacticalElement[],
    config: ObstaclePlacementConfig
  ): PlacedObstacle[] {
    const obstacles: PlacedObstacle[] = [];

    // 注意: mapが渡されていないため、このメソッドでは配置をスキップ
    // 将来的にはmapを引数に追加する必要がある
    console.warn(
      'ObstaclePlacer: placeTacticalObstacles skipped - map not available for validation'
    );

    return obstacles;
  }

  /**
   * チョークポイントの強化
   */
  private placeChokeObstacles(
    map: number[][],
    corridors: Corridor[],
    rooms: Room[],
    config: ObstaclePlacementConfig
  ): PlacedObstacle[] {
    const obstacles: PlacedObstacle[] = [];

    // チョークポイントを作るルールがある場合
    const createChokeRule = config.placementRules?.find((rule) => rule.createChoke);
    if (!createChokeRule) {
      return obstacles;
    }

    // 幅の狭い通路にバレルや木箱を配置して遮蔽物にする
    for (const corridor of corridors) {
      if (Math.random() < 0.3) {
        // 30%の確率でチョークポイント強化
        const midX = Math.floor((corridor.startX + corridor.endX) / 2);
        const midY = Math.floor((corridor.startY + corridor.endY) / 2);

        // 通路の中間地点付近に障害物配置
        if (this.isWalkable(map, midX, midY)) {
          obstacles.push({
            id: `obstacle_choke_${Date.now()}_${obstacles.length}`,
            type: Math.random() < 0.5 ? ObstacleType.BARREL : ObstacleType.CRATE,
            x: midX,
            y: midY,
            destructible: true,
            health: 75,
          });
        }
      }
    }

    return obstacles;
  }

  /**
   * 部屋内の遮蔽物配置
   */
  private placeCoverObjects(
    rooms: Room[],
    config: ObstaclePlacementConfig,
    map?: number[][],
    corridors?: Corridor[]
  ): PlacedObstacle[] {
    const obstacles: PlacedObstacle[] = [];

    for (const room of rooms) {
      // 部屋サイズに応じて遮蔽物の数を決定
      const coverCount = Math.floor(((room.width * room.height) / 50) * config.coverDensity);

      for (let i = 0; i < coverCount; i++) {
        // ランダムな位置を選択（部屋の端を避ける）
        const x = room.x + 2 + Math.floor(Math.random() * (room.width - 4));
        const y = room.y + 2 + Math.floor(Math.random() * (room.height - 4));

        // mapが提供されている場合は歩行可能タイルかチェック
        if (map && !this.isWalkable(map, x, y)) {
          continue;
        }

        // 通路上には配置しない
        if (corridors && this.isOnCorridor(x, y, corridors, rooms)) {
          continue;
        }

        // 既に障害物がないか確認
        if (!obstacles.find((obs) => obs.x === x && obs.y === y)) {
          const obstacleType = this.selectObstacleType(config.obstacleTypes);

          obstacles.push({
            id: `obstacle_cover_${Date.now()}_${obstacles.length}`,
            type: obstacleType,
            x,
            y,
            destructible: obstacleType !== ObstacleType.WALL,
            health: this.getObstacleHealth(obstacleType),
          });
        }
      }
    }

    return obstacles;
  }

  /**
   * 破壊可能オブジェクトの配置
   */
  private placeDestructibles(
    rooms: Room[],
    config: ObstaclePlacementConfig,
    map?: number[][],
    corridors?: Corridor[]
  ): PlacedObstacle[] {
    const obstacles: PlacedObstacle[] = [];

    // 総障害物数を決定
    const totalCount = Math.floor(
      Math.random() * (config.maxObstacles - config.minObstacles) + config.minObstacles
    );

    const currentCount = 0;
    const targetCount = Math.min(totalCount, config.maxObstacles);

    // 各部屋にランダムに配置
    for (const room of rooms) {
      if (obstacles.length >= targetCount) break;

      // 小さい部屋はスキップ
      if (room.width < 4 || room.height < 4) continue;

      const x = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
      const y = room.y + 1 + Math.floor(Math.random() * (room.height - 2));

      // mapが提供されている場合は歩行可能タイルかチェック
      if (map && !this.isWalkable(map, x, y)) {
        continue;
      }

      // 通路上には配置しない
      if (corridors && this.isOnCorridor(x, y, corridors, rooms)) {
        continue;
      }

      // 既に障害物がないか確認
      if (!obstacles.find((obs) => obs.x === x && obs.y === y)) {
        obstacles.push({
          id: `obstacle_dest_${Date.now()}_${obstacles.length}`,
          type: ObstacleType.DEBRIS,
          x,
          y,
          destructible: true,
          health: 30,
        });
      }
    }

    return obstacles;
  }

  /**
   * インタラクティブオブジェクトの配置
   */
  private placeInteractives(
    rooms: Room[],
    config: ObstaclePlacementConfig,
    map?: number[][],
    corridors?: Corridor[]
  ): PlacedObstacle[] {
    const obstacles: PlacedObstacle[] = [];

    // コンソールタイプが利用可能な場合のみ配置
    if (!config.obstacleTypes?.includes(ObstacleType.CONSOLE)) {
      return obstacles;
    }

    // 大きな部屋にコンソールを配置
    for (const room of rooms) {
      if (room.width >= 8 && room.height >= 8 && Math.random() < 0.3) {
        // 部屋の角にコンソール配置
        const x = room.x + 1;
        const y = room.y + 1;

        // mapが提供されている場合は歩行可能タイルかチェック
        if (map && !this.isWalkable(map, x, y)) {
          continue;
        }

        // 通路上には配置しない
        if (corridors && this.isOnCorridor(x, y, corridors, rooms)) {
          continue;
        }

        obstacles.push({
          id: `obstacle_console_${Date.now()}_${obstacles.length}`,
          type: ObstacleType.CONSOLE,
          x,
          y,
          destructible: false,
        });
      }
    }

    return obstacles;
  }

  /**
   * 近くの位置を取得
   */
  private getNearbyPositions(
    centerX: number,
    centerY: number,
    minDist: number,
    maxDist: number
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];

    for (let dx = -maxDist; dx <= maxDist; dx++) {
      for (let dy = -maxDist; dy <= maxDist; dy++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= minDist && dist <= maxDist) {
          const x = centerX + dx;
          const y = centerY + dy;
          if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            positions.push({ x, y });
          }
        }
      }
    }

    return positions;
  }

  /**
   * 歩行可能か確認
   */
  private isWalkable(map: number[][], x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    // TileType.GRASS (1) などの歩行可能タイルかチェック
    return map[y][x] > 0;
  }

  /**
   * 指定位置が通路上かチェック
   * @param x X座標
   * @param y Y座標
   * @param corridors 通路リスト
   * @param rooms 部屋リスト
   * @returns 通路上ならtrue
   */
  private isOnCorridor(x: number, y: number, corridors: Corridor[], rooms: Room[]): boolean {
    // まず部屋内かチェック（部屋内なら通路ではない）
    for (const room of rooms) {
      if (x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height) {
        return false; // 部屋内
      }
    }

    // 部屋外で歩行可能タイル = 通路
    return true;
  }

  /**
   * 障害物タイプを選択
   */
  private selectObstacleType(availableTypes?: ObstacleType[]): ObstacleType {
    const types =
      availableTypes && availableTypes.length > 0
        ? availableTypes
        : [ObstacleType.CRATE, ObstacleType.BARREL, ObstacleType.WALL];
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * 障害物の体力を取得
   */
  private getObstacleHealth(type: ObstacleType): number | undefined {
    switch (type) {
      case ObstacleType.CRATE:
        return 50;
      case ObstacleType.BARREL:
        return 40;
      case ObstacleType.DEBRIS:
        return 30;
      case ObstacleType.WALL:
        return undefined; // 破壊不可
      case ObstacleType.CONSOLE:
        return undefined; // 破壊不可
      default:
        return 50;
    }
  }
}
