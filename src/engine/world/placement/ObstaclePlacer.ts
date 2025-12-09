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
   * @param occupiedPositions 配置禁止位置のセット
   * @returns 配置された障害物のリスト
   */
  placeObstacles(
    map: number[][],
    rooms: Room[],
    corridors: Corridor[],
    tacticalElements: TacticalElement[],
    config: ObstaclePlacementConfig,
    occupiedPositions: Set<string> = new Set()
  ): PlacedObstacle[] {
    console.log('ObstaclePlacer: Starting obstacle placement...');
    console.log('ObstaclePlacer: Config:', {
      minObstacles: config.minObstacles,
      maxObstacles: config.maxObstacles,
      coverDensity: config.coverDensity,
      roomCount: rooms.length,
    });
    const startTime = performance.now();

    const obstacles: PlacedObstacle[] = [];

    // 1. 戦術要素に基づく障害物配置（高台周辺など）
    const tactical = this.placeTacticalObstacles(tacticalElements, config);
    console.log(`ObstaclePlacer: Tactical obstacles: ${tactical.length}`);
    obstacles.push(...tactical);

    // 2. チョークポイントの強化
    const choke = this.placeChokeObstacles(map, corridors, rooms, config);
    console.log(`ObstaclePlacer: Choke obstacles: ${choke.length}`);
    obstacles.push(...choke);

    // 3. 部屋内の遮蔽物配置（後で敵が使える）
    if (config.coverDensity > 0) {
      const cover = this.placeCoverObjects(rooms, config, map, corridors, obstacles);
      console.log(`ObstaclePlacer: Cover obstacles: ${cover.length}`);
      obstacles.push(...cover);
    }

    // 4. 破壊可能オブジェクトの配置
    const destructibles = this.placeDestructibles(rooms, config, map, corridors, obstacles);
    console.log(`ObstaclePlacer: Destructible obstacles: ${destructibles.length}`);
    obstacles.push(...destructibles);

    // 5. インタラクティブオブジェクトの配置
    const interactives = this.placeInteractives(rooms, config, map, corridors, obstacles);
    console.log(`ObstaclePlacer: Interactive obstacles: ${interactives.length}`);
    obstacles.push(...interactives);

    // 占有済み位置と重複する障害物を除外
    const filteredObstacles = obstacles.filter((obs) => {
      const key = `${obs.x},${obs.y}`;
      if (occupiedPositions.has(key)) {
        return false;
      }
      return true;
    });

    const endTime = performance.now();
    const filteredCount = obstacles.length - filteredObstacles.length;
    console.log(
      `ObstaclePlacer: Placed ${
        filteredObstacles.length
      } obstacles (${filteredCount} filtered) in ${(endTime - startTime).toFixed(2)}ms`
    );

    return filteredObstacles;
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

        const candidates = this.getChokePointCandidates(map, corridor, midX, midY);

        for (const { x, y } of candidates) {
          if (this.canPlaceObstacle(map, x, y, obstacles)) {
            const obstacleType = Math.random() < 0.5 ? ObstacleType.BARREL : ObstacleType.CRATE;
            obstacles.push({
              id: `obstacle_choke_${Date.now()}_${obstacles.length}`,
              type: obstacleType,
              x,
              y,
              destructible: true,
              health: 75,
              blocksVision: this.getBlocksVision(obstacleType),
            });
            break; // 1つ配置したら次の通路へ
          }
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
    map: number[][] | undefined,
    corridors: Corridor[] | undefined,
    existingObstacles: PlacedObstacle[]
  ): PlacedObstacle[] {
    const obstacles: PlacedObstacle[] = [];
    const combinedObstacles = [...existingObstacles];

    console.log(`placeCoverObjects: Processing ${rooms.length} rooms`);

    for (const room of rooms) {
      // 部屋サイズに応じて遮蔽物の数を決定
      // 小さい部屋でも最低限の障害物を配置
      const roomArea = room.width * room.height;
      const baseCount = (roomArea / 30) * config.coverDensity; // 30マスあたりで計算（より多く配置）
      const coverCount = Math.max(
        Math.floor(roomArea / 20), // 最低でも面積÷20個（例: 6x6=36マス → 最低1個）
        Math.floor(baseCount)
      );

      console.log(
        `  Room ${room.x},${room.y} (${room.width}x${room.height}, area=${roomArea}): target=${coverCount} obstacles`
      );

      let attempts = 0;
      const maxAttempts = coverCount * 5; // 試行回数制限
      let placed = 0;
      let rejected = 0;

      for (let i = 0; i < coverCount && attempts < maxAttempts; ) {
        attempts++;
        const widthRange = Math.max(1, room.width);
        const heightRange = Math.max(1, room.height);
        const x = room.x + Math.floor(Math.random() * widthRange);
        const y = room.y + Math.floor(Math.random() * heightRange);

        // mapが提供されていない場合は基本チェックのみ
        if (!map) {
          if (!obstacles.find((obs) => obs.x === x && obs.y === y)) {
            const obstacleType = this.selectObstacleType(config.obstacleTypes);
            obstacles.push({
              id: `obstacle_cover_${Date.now()}_${obstacles.length}`,
              type: obstacleType,
              x,
              y,
              destructible: obstacleType !== ObstacleType.WALL,
              health: this.getObstacleHealth(obstacleType),
              blocksVision: this.getBlocksVision(obstacleType),
            });
            i++;
          }
          continue;
        }

        // 通路上には配置しない
        if (corridors && this.isOnCorridor(x, y, corridors, rooms)) {
          continue;
        }

        // 通路を塞がないかチェック
        if (!map) {
          if (combinedObstacles.find((obs) => obs.x === x && obs.y === y)) {
            continue;
          }
          const obstacleType = this.selectObstacleType(config.obstacleTypes);
          const obstacle = {
            id: `obstacle_cover_${Date.now()}_${obstacles.length}`,
            type: obstacleType,
            x,
            y,
            destructible: obstacleType !== ObstacleType.WALL,
            health: this.getObstacleHealth(obstacleType),
            blocksVision: this.getBlocksVision(obstacleType),
          };
          obstacles.push(obstacle);
          combinedObstacles.push(obstacle);
          i++;
          placed++;
          continue;
        }

        if (this.canPlaceObstacle(map, x, y, combinedObstacles)) {
          const obstacleType = this.selectObstacleType(config.obstacleTypes);
          const obstacle = {
            id: `obstacle_cover_${Date.now()}_${obstacles.length}`,
            type: obstacleType,
            x,
            y,
            destructible: obstacleType !== ObstacleType.WALL,
            health: this.getObstacleHealth(obstacleType),
            blocksVision: this.getBlocksVision(obstacleType),
          };
          obstacles.push(obstacle);
          combinedObstacles.push(obstacle);

          i++;
          placed++;
        } else {
          rejected++;
        }
      }

      console.log(`    Placed: ${placed}, Rejected: ${rejected}, Attempts: ${attempts}`);
    }

    return obstacles;
  }

  /**
   * 破壊可能オブジェクトの配置
   */
  private placeDestructibles(
    rooms: Room[],
    config: ObstaclePlacementConfig,
    map: number[][] | undefined,
    corridors: Corridor[] | undefined,
    existingObstacles: PlacedObstacle[]
  ): PlacedObstacle[] {
    const obstacles: PlacedObstacle[] = [];
    const combinedObstacles = [...existingObstacles];

    // 総障害物数を決定
    const totalCount = Math.floor(
      Math.random() * (config.maxObstacles - config.minObstacles) + config.minObstacles
    );

    const targetCount = Math.min(totalCount, config.maxObstacles);
    let attempts = 0;
    const maxAttempts = targetCount * 5; // 試行回数制限

    console.log(`placeDestructibles: Processing ${rooms.length} rooms, target=${targetCount}`);

    // 各部屋にランダムに配置
    for (const room of rooms) {
      if (obstacles.length >= targetCount || attempts >= maxAttempts) break;

      // 小さい部屋はスキップ
      if (room.width < 4 || room.height < 4) continue;

      const roomStart = obstacles.length;

      for (let i = 0; i < 3 && obstacles.length < targetCount && attempts < maxAttempts; i++) {
        attempts++;

        const widthRange = Math.max(1, room.width);
        const heightRange = Math.max(1, room.height);
        const x = room.x + Math.floor(Math.random() * widthRange);
        const y = room.y + Math.floor(Math.random() * heightRange);

        // mapが提供されていない場合は基本チェックのみ
        if (!map) {
          if (!obstacles.find((obs) => obs.x === x && obs.y === y)) {
            obstacles.push({
              id: `obstacle_dest_${Date.now()}_${obstacles.length}`,
              type: ObstacleType.DEBRIS,
              x,
              y,
              destructible: true,
              health: 30,
              blocksVision: this.getBlocksVision(ObstacleType.DEBRIS),
            });
          }
          continue;
        }

        // 通路上には配置しない
        if (corridors && this.isOnCorridor(x, y, corridors, rooms)) {
          continue;
        }

        // 通路を塞がないかチェック
        if (!map) {
          if (combinedObstacles.find((obs) => obs.x === x && obs.y === y)) {
            continue;
          }
          const obstacle = {
            id: `obstacle_dest_${Date.now()}_${obstacles.length}`,
            type: ObstacleType.DEBRIS,
            x,
            y,
            destructible: true,
            health: 30,
            blocksVision: this.getBlocksVision(ObstacleType.DEBRIS),
          };
          obstacles.push(obstacle);
          combinedObstacles.push(obstacle);
          continue;
        }

        if (this.canPlaceObstacle(map, x, y, combinedObstacles)) {
          const obstacle = {
            id: `obstacle_dest_${Date.now()}_${obstacles.length}`,
            type: ObstacleType.DEBRIS,
            x,
            y,
            destructible: true,
            health: 30,
            blocksVision: this.getBlocksVision(ObstacleType.DEBRIS),
          };
          obstacles.push(obstacle);
          combinedObstacles.push(obstacle);
        }
      }

      const placed = obstacles.length - roomStart;
      if (placed > 0) {
        console.log(`    Room placed: ${placed} destructibles`);
      }
    }

    console.log(`placeDestructibles: Total placed ${obstacles.length}/${targetCount}`);

    return obstacles;
  }

  /**
   * インタラクティブオブジェクトの配置
   */
  private placeInteractives(
    rooms: Room[],
    config: ObstaclePlacementConfig,
    map: number[][] | undefined,
    corridors: Corridor[] | undefined,
    existingObstacles: PlacedObstacle[]
  ): PlacedObstacle[] {
    const obstacles: PlacedObstacle[] = [];
    const combinedObstacles = [...existingObstacles];

    // コンソールタイプが利用可能な場合のみ配置
    if (!config.obstacleTypes?.includes(ObstacleType.CONSOLE)) {
      return obstacles;
    }

    // 大きな部屋にコンソールを配置
    for (const room of rooms) {
      if (room.width >= 8 && room.height >= 8 && Math.random() < 0.3) {
        const widthRange = Math.max(1, room.width);
        const heightRange = Math.max(1, room.height);
        const x = room.x + Math.floor(Math.random() * widthRange);
        const y = room.y + Math.floor(Math.random() * heightRange);

        // mapが提供されていない場合は基本チェックのみ
        if (!map) {
          if (combinedObstacles.find((obs) => obs.x === x && obs.y === y)) {
            continue;
          }
          const obstacle = {
            id: `obstacle_console_${Date.now()}_${obstacles.length}`,
            type: ObstacleType.CONSOLE,
            x,
            y,
            destructible: false,
            blocksVision: this.getBlocksVision(ObstacleType.CONSOLE),
          };
          obstacles.push(obstacle);
          combinedObstacles.push(obstacle);
          continue;
        }

        // 通路上には配置しない
        if (corridors && this.isOnCorridor(x, y, corridors, rooms)) {
          continue;
        }

        // 通路を塞がないかチェック（コンソールは部屋の角なので通常は問題ないが念のため）
        if (this.canPlaceObstacle(map, x, y, combinedObstacles)) {
          const obstacle = {
            id: `obstacle_console_${Date.now()}_${obstacles.length}`,
            type: ObstacleType.CONSOLE,
            x,
            y,
            destructible: false,
            blocksVision: this.getBlocksVision(ObstacleType.CONSOLE),
          };
          obstacles.push(obstacle);
          combinedObstacles.push(obstacle);
        }
      }
    }

    return obstacles;
  }

  /**
   * 部屋の壁際の位置を取得
   * @param room 部屋
   * @returns 壁際の座標リスト
   */
  private getWallAdjacentPositions(room: Room): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];

    // 部屋の外周セル（壁上）を含める
    // 上壁
    for (let x = room.x; x < room.x + room.width; x++) {
      positions.push({ x, y: room.y });
    }

    // 下壁
    for (let x = room.x; x < room.x + room.width; x++) {
      positions.push({ x, y: room.y + room.height - 1 });
    }

    // 左壁（角は重複するので1を足して開始）
    for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
      positions.push({ x: room.x, y });
    }

    // 右壁
    for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
      positions.push({ x: room.x + room.width - 1, y });
    }

    return positions;
  }

  /**
   * 部屋内で使用可能な壁際候補を取得
   */
  private getRoomWallCandidates(
    room: Room,
    rooms: Room[],
    map?: number[][],
    corridors?: Corridor[]
  ): Array<{ x: number; y: number }> {
    const positions = this.getWallAdjacentPositions(room);
    return positions.filter(({ x, y }) => {
      if (map && !this.isWalkable(map, x, y)) {
        return false;
      }
      return true;
    });
  }

  /**
   * 通路の壁際に配置するための候補座標を取得
   * 壁側を優先し、最後に中央をフォールバック候補として追加
   */
  private getChokePointCandidates(
    map: number[][],
    corridor: Corridor,
    midX: number,
    midY: number
  ): Array<{ x: number; y: number }> {
    const candidates: Array<{ x: number; y: number }> = [];
    const deltaX = Math.abs(corridor.endX - corridor.startX);
    const deltaY = Math.abs(corridor.endY - corridor.startY);

    const addCandidate = (x: number, y: number) => {
      if (!this.isWalkable(map, x, y)) {
        return;
      }
      const key = `${x},${y}`;
      if (!candidates.find((pos) => `${pos.x},${pos.y}` === key)) {
        candidates.push({ x, y });
      }
    };

    if (deltaX > deltaY) {
      // 横方向の通路 → 上下の壁際を優先
      addCandidate(midX, midY - 1);
      addCandidate(midX, midY + 1);
    } else if (deltaY > deltaX) {
      // 縦方向の通路 → 左右の壁際を優先
      addCandidate(midX - 1, midY);
      addCandidate(midX + 1, midY);
    } else {
      // 斜めや短い通路 → 周囲4方向を試す
      addCandidate(midX - 1, midY);
      addCandidate(midX + 1, midY);
      addCandidate(midX, midY - 1);
      addCandidate(midX, midY + 1);
    }

    // フォールバックとして中央も候補に含める
    addCandidate(midX, midY);

    return candidates;
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
   * 障害物を配置しても通路が塞がれないかチェック
   * @param map マップデータ
   * @param x X座標
   * @param y Y座標
   * @param existingObstacles 既に配置された障害物リスト
   * @returns 配置可能ならtrue
   */
  private canPlaceObstacle(
    map: number[][],
    x: number,
    y: number,
    existingObstacles: PlacedObstacle[]
  ): boolean {
    // 基本チェック: 歩行可能タイルか
    if (!this.isWalkable(map, x, y)) {
      return false;
    }

    // 既に障害物がある場合は配置不可
    if (existingObstacles.find((obs) => obs.x === x && obs.y === y)) {
      return false;
    }

    // 周囲8マスの歩行可能マス数をカウント
    const directions = [
      { dx: -1, dy: 0 }, // 左
      { dx: 1, dy: 0 }, // 右
      { dx: 0, dy: -1 }, // 上
      { dx: 0, dy: 1 }, // 下
      { dx: -1, dy: -1 }, // 左上
      { dx: 1, dy: -1 }, // 右上
      { dx: -1, dy: 1 }, // 左下
      { dx: 1, dy: 1 }, // 右下
    ];

    let walkableCount = 0;
    const adjacentWalkable: boolean[] = [];

    // 4方向（上下左右）の歩行可能マスをチェック
    for (let i = 0; i < 4; i++) {
      const dir = directions[i];
      const nx = x + dir.dx;
      const ny = y + dir.dy;

      const isWalkableAndFree =
        this.isWalkable(map, nx, ny) &&
        !existingObstacles.find((obs) => obs.x === nx && obs.y === ny);

      adjacentWalkable.push(isWalkableAndFree);
      if (isWalkableAndFree) {
        walkableCount++;
      }
    }

    // ケース1: 周囲に歩行可能マスが0個 → 既に孤立しているので配置不可
    if (walkableCount === 0) {
      return false;
    }

    // ケース2: 周囲に歩行可能マスが1個 → 壁際や角なので配置OK
    // これにより壁際に障害物を配置できる
    if (walkableCount === 1) {
      return true;
    }

    // ケース3: 1マス幅の通路（縦）をチェック
    // 左右が壁で、上下が両方通路の場合 → 通路を塞ぐので配置不可
    const leftRight = adjacentWalkable[0] && adjacentWalkable[1]; // 左と右
    const upDown = adjacentWalkable[2] && adjacentWalkable[3]; // 上と下

    if (!adjacentWalkable[0] && !adjacentWalkable[1] && upDown) {
      return false; // 1マス幅の縦通路を塞ぐ
    }

    // ケース4: 1マス幅の通路（横）をチェック
    // 上下が壁で、左右が両方通路の場合 → 通路を塞ぐので配置不可
    if (!adjacentWalkable[2] && !adjacentWalkable[3] && leftRight) {
      return false; // 1マス幅の横通路を塞ぐ
    }

    // ケース5: 3方向以上が通路の場合は配置OK（迂回路がある）
    if (walkableCount >= 3) {
      return true;
    }

    // ケース6: 2方向が通路の場合
    // 対向する2方向（左右 or 上下）の場合は既にチェック済み
    // 隣接する2方向（L字）の場合は配置OK
    return true;
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

  /**
   * 障害物が視線を遮るかどうかを取得
   */
  private getBlocksVision(type: ObstacleType): boolean {
    switch (type) {
      case ObstacleType.CRATE:
        return true; // 木箱は視線を遮る
      case ObstacleType.BARREL:
        return false; // バレルは低いので視線を遮らない
      case ObstacleType.WALL:
        return true; // 壁は視線を遮る
      case ObstacleType.DEBRIS:
        return false; // 瓦礫は低いので視線を遮らない
      case ObstacleType.CONSOLE:
        return false; // コンソールは低いので視線を遮らない
      default:
        return false;
    }
  }
}
