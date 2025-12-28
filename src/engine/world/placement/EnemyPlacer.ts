import {
  PlacedEnemy,
  EnemyType,
  EnemyBehavior,
  EnemyPlacementConfig,
  Room,
  RoomType,
  Corridor,
  PlacedObstacle,
  PlacedItem,
  TacticalElement,
  Vector3,
} from '../../types';

/**
 * 敵配置システム
 * 障害物とアイテムの情報を活用して戦術的に敵を配置
 */
export class EnemyPlacer {
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * 敵を配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param corridors 通路のリスト
   * @param obstacles 障害物のリスト（配置済み）
   * @param items アイテムのリスト（配置済み）
   * @param tacticalElements 戦術要素のリスト
   * @param config 敵配置設定
   * @param occupiedPositions 配置禁止位置のセット（プレイヤー位置等）
   * @returns 配置された敵のリスト
   */
  placeEnemies(
    map: number[][],
    rooms: Room[],
    corridors: Corridor[],
    obstacles: PlacedObstacle[],
    items: PlacedItem[],
    tacticalElements: TacticalElement[],
    config: EnemyPlacementConfig,
    occupiedPositions: Set<string> = new Set()
  ): PlacedEnemy[] {
    console.log('EnemyPlacer: Starting enemy placement...');
    const startTime = performance.now();

    const enemies: PlacedEnemy[] = [];

    // 1. 敵の総数を決定
    const enemyCount = this.calculateEnemyCount(config, rooms);

    // 2. ボス部屋の敵配置
    if (config.allowBoss) {
      enemies.push(...this.placeBossEnemies(map, rooms, config));
    }

    // 3. 障害物の後ろに狙撃手を配置
    enemies.push(...this.placeCoverEnemies(map, rooms, obstacles, config));

    // 4. アイテムを守る敵を配置
    enemies.push(...this.placeGuardEnemies(map, items, rooms, config));

    // 5. 戦術要素に基づく敵配置
    enemies.push(...this.placeTacticalEnemies(map, tacticalElements, config));

    // 6. チョークポイントの敵配置
    enemies.push(...this.placeChokeEnemies(map, corridors, rooms, config));

    // 7. 巡回敵の配置
    const remainingCount = Math.max(0, enemyCount - enemies.length);
    enemies.push(
      ...this.placePatrolEnemies(map, rooms, corridors, obstacles, config, remainingCount)
    );

    // 8. 一般敵の配置（残り）
    const finalCount = Math.max(0, enemyCount - enemies.length);
    enemies.push(...this.placeGeneralEnemies(map, rooms, obstacles, items, config, finalCount));

    // 9. 障害物やアイテムと重複する敵をフィルタリング（占有済み位置も考慮）
    const filteredEnemies = this.filterOverlappingEnemies(
      map,
      enemies,
      obstacles,
      items,
      occupiedPositions
    );

    const endTime = performance.now();
    console.log(
      `EnemyPlacer: Placed ${filteredEnemies.length} enemies in ${(endTime - startTime).toFixed(
        2
      )}ms`
    );

    return filteredEnemies;
  }

  /**
   * 障害物やアイテムと重複する敵をフィルタリング
   */
  private filterOverlappingEnemies(
    map: number[][],
    enemies: PlacedEnemy[],
    obstacles: PlacedObstacle[],
    items: PlacedItem[],
    externalOccupied: Set<string> = new Set()
  ): PlacedEnemy[] {
    // 外部の占有位置を引き継ぐ
    const occupiedPositions = new Set<string>(externalOccupied);

    // 障害物の位置を記録
    for (const obstacle of obstacles) {
      occupiedPositions.add(`${obstacle.x},${obstacle.y}`);
    }

    // アイテムの位置を記録
    for (const item of items) {
      occupiedPositions.add(`${item.x},${item.y}`);
    }

    // 重複しない敵のみを返す（敵同士の重複もチェック）
    const result: PlacedEnemy[] = [];
    const enemyPositions = new Set<string>();

    for (const enemy of enemies) {
      const posKey = `${enemy.x},${enemy.y}`;
      if (!this.isWalkableTile(map, enemy.x, enemy.y)) {
        continue;
      }
      if (!occupiedPositions.has(posKey) && !enemyPositions.has(posKey)) {
        result.push(enemy);
        enemyPositions.add(posKey);
      }
    }

    return result;
  }

  /**
   * 敵の総数を計算
   */
  private calculateEnemyCount(config: EnemyPlacementConfig, rooms: Room[]): number {
    // 部屋数と難易度に基づいて敵数を計算
    const baseCount = Math.floor(rooms.length * 1.5);
    const difficultyMultiplier = 1 + config.difficultyLevel / 10;
    const count = Math.floor(baseCount * difficultyMultiplier);
    return Math.max(config.minEnemies, Math.min(config.maxEnemies, count));
  }

  /**
   * ボス部屋への敵配置（ボスは削除されたため空実装）
   */
  private placeBossEnemies(
    _map: number[][],
    _rooms: Room[],
    _config: EnemyPlacementConfig
  ): PlacedEnemy[] {
    // ボスタイプは削除されたため、何も配置しない
    return [];
  }

  /**
   * 障害物の後ろに狙撃手を配置
   */
  private placeCoverEnemies(
    map: number[][],
    rooms: Room[],
    obstacles: PlacedObstacle[],
    config: EnemyPlacementConfig
  ): PlacedEnemy[] {
    const enemies: PlacedEnemy[] = [];

    // 狙撃手タイプが利用可能かチェック
    if (!config.enemyTypes?.includes(EnemyType.SCOUT)) {
      return enemies;
    }

    // 各部屋で障害物の近くに狙撃手を配置
    for (const room of rooms) {
      // ボス部屋と入口は除外
      if (room.type === RoomType.BOSS || room.type === RoomType.ENTRANCE) {
        continue;
      }

      // この部屋内の障害物を検索
      const roomObstacles = obstacles.filter(
        (obs) =>
          obs.x >= room.x &&
          obs.x < room.x + room.width &&
          obs.y >= room.y &&
          obs.y < room.y + room.height
      );

      // 障害物の後ろ（遠い側）に敵を配置
      for (const obstacle of roomObstacles) {
        if (Math.random() < 0.3) {
          // 30%の確率で遮蔽物に敵配置
          const behindPos = this.findPositionBehindObstacle(obstacle, room);
          if (behindPos && this.isWalkableTile(map, behindPos.x, behindPos.y)) {
            enemies.push({
              id: `enemy_sniper_${Date.now()}_${enemies.length}`,
              type: EnemyType.SCOUT,
              x: behindPos.x,
              y: behindPos.y,
              level: Math.floor(config.difficultyLevel * 0.8),
              behavior: EnemyBehavior.STATIC,
            });
          }
        }
      }
    }

    return enemies;
  }

  /**
   * アイテムを守る敵を配置
   */
  private placeGuardEnemies(
    map: number[][],
    items: PlacedItem[],
    rooms: Room[],
    config: EnemyPlacementConfig
  ): PlacedEnemy[] {
    const enemies: PlacedEnemy[] = [];

    // 高レアアイテムの近くに敵を配置
    for (const item of items) {
      // レアリティが高いアイテムのみ
      if (item.rarity === 'rare' || item.rarity === 'legendary') {
        // アイテムから2-3タイル離れた位置に敵配置
        const guardPos = this.findNearbyPosition(item.x, item.y, 2, 3);
        if (guardPos && this.isWalkableTile(map, guardPos.x, guardPos.y)) {
          const enemyType = this.selectEnemyType(config.enemyTypes, config.difficultyLevel);

          enemies.push({
            id: `enemy_item_guard_${Date.now()}_${enemies.length}`,
            type: enemyType,
            x: guardPos.x,
            y: guardPos.y,
            level: config.difficultyLevel,
            behavior: EnemyBehavior.GUARD,
          });
        }
      }
    }

    return enemies;
  }

  /**
   * 戦術要素に基づく敵配置
   */
  private placeTacticalEnemies(
    map: number[][],
    tacticalElements: TacticalElement[],
    config: EnemyPlacementConfig
  ): PlacedEnemy[] {
    const enemies: PlacedEnemy[] = [];

    for (const element of tacticalElements) {
      // 高台に敵を配置
      if (
        element.type === 'high_ground' &&
        Math.random() < 0.5 &&
        this.isWalkableTile(map, element.x, element.y)
      ) {
        enemies.push({
          id: `enemy_highground_${Date.now()}_${enemies.length}`,
          type: EnemyType.SCOUT,
          x: element.x,
          y: element.y,
          level: config.difficultyLevel,
          behavior: EnemyBehavior.STATIC,
        });
      }

      // 待ち伏せポイントに敵を配置
      if (
        element.type === 'ambush_point' &&
        Math.random() < 0.7 &&
        this.isWalkableTile(map, element.x, element.y)
      ) {
        enemies.push({
          id: `enemy_ambush_${Date.now()}_${enemies.length}`,
          type: EnemyType.SOLDIER,
          x: element.x,
          y: element.y,
          level: config.difficultyLevel,
          behavior: EnemyBehavior.GUARD,
        });
      }
    }

    return enemies;
  }

  /**
   * チョークポイントの敵配置（TURRETは削除されたため空実装）
   */
  private placeChokeEnemies(
    map: number[][],
    corridors: Corridor[],
    rooms: Room[],
    config: EnemyPlacementConfig
  ): PlacedEnemy[] {
    // TURRETタイプは削除されたため、何も配置しない
    return [];
  }

  /**
   * 巡回敵の配置
   */
  private placePatrolEnemies(
    map: number[][],
    rooms: Room[],
    corridors: Corridor[],
    obstacles: PlacedObstacle[],
    config: EnemyPlacementConfig,
    count: number
  ): PlacedEnemy[] {
    const enemies: PlacedEnemy[] = [];

    // 巡回敵の数（残りの30%程度）
    const patrolCount = Math.floor(count * 0.3);

    for (let i = 0; i < patrolCount; i++) {
      // ランダムな部屋を選択
      const room = rooms[Math.floor(Math.random() * rooms.length)];

      // ボス部屋と入口は除外
      if (room.type === RoomType.BOSS || room.type === RoomType.ENTRANCE) {
        continue;
      }

      // 部屋内の開始位置
      let startX = 0;
      let startY = 0;
      let attempts = 0;
      const maxAttempts = 20;

      do {
        startX = room.x + 2 + Math.floor(Math.random() * Math.max(1, room.width - 4));
        startY = room.y + 2 + Math.floor(Math.random() * Math.max(1, room.height - 4));
        attempts++;
      } while (attempts < maxAttempts && !this.isWalkableTile(map, startX, startY));

      if (attempts >= maxAttempts) {
        continue;
      }

      // 巡回ルートを生成
      const patrolRoute = this.generatePatrolRoute(startX, startY, room, obstacles);

      const enemyType = this.selectEnemyType(config.enemyTypes, config.difficultyLevel);

      enemies.push({
        id: `enemy_patrol_${Date.now()}_${enemies.length}`,
        type: enemyType,
        x: startX,
        y: startY,
        level: Math.floor(config.difficultyLevel * 0.9),
        behavior: EnemyBehavior.PATROL,
        patrolRoute,
      });
    }

    return enemies;
  }

  /**
   * 一般敵の配置
   */
  private placeGeneralEnemies(
    map: number[][],
    rooms: Room[],
    obstacles: PlacedObstacle[],
    items: PlacedItem[],
    config: EnemyPlacementConfig,
    count: number
  ): PlacedEnemy[] {
    const enemies: PlacedEnemy[] = [];

    for (let i = 0; i < count; i++) {
      // ランダムな部屋を選択
      const room = rooms[Math.floor(Math.random() * rooms.length)];

      // ボス部屋と入口は除外
      if (room.type === RoomType.BOSS || room.type === RoomType.ENTRANCE) {
        continue;
      }

      // ランダムな位置を選択
      let x, y;
      let attempts = 0;
      const maxAttempts = 20;

      do {
        x = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
        y = room.y + 1 + Math.floor(Math.random() * (room.height - 2));
        attempts++;
      } while (
        attempts < maxAttempts &&
        (!this.isWalkableTile(map, x, y) ||
          this.isPositionOccupied(x, y, obstacles, items, enemies))
      );

      if (attempts >= maxAttempts) {
        continue;
      }

      const enemyType = this.selectEnemyType(config.enemyTypes, config.difficultyLevel);
      const behavior = Math.random() < 0.3 ? EnemyBehavior.GUARD : EnemyBehavior.AGGRESSIVE;

      enemies.push({
        id: `enemy_general_${Date.now()}_${enemies.length}`,
        type: enemyType,
        x,
        y,
        level: config.difficultyLevel,
        behavior,
      });
    }

    return enemies;
  }

  /**
   * 円周上の位置を取得
   */
  private getCircularPositions(
    centerX: number,
    centerY: number,
    radius: number,
    count: number
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const angle = angleStep * i;
      const x = Math.round(centerX + Math.cos(angle) * radius);
      const y = Math.round(centerY + Math.sin(angle) * radius);

      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        positions.push({ x, y });
      }
    }

    return positions;
  }

  /**
   * 障害物の後ろの位置を見つける
   */
  private findPositionBehindObstacle(
    obstacle: PlacedObstacle,
    room: Room
  ): { x: number; y: number } | null {
    // 部屋の中心を基準に、障害物の反対側に位置を配置
    const roomCenterX = room.x + Math.floor(room.width / 2);
    const roomCenterY = room.y + Math.floor(room.height / 2);

    const dx = obstacle.x - roomCenterX;
    const dy = obstacle.y - roomCenterY;

    // 障害物から見て中心の反対方向
    const behindX = obstacle.x + Math.sign(dx);
    const behindY = obstacle.y + Math.sign(dy);

    // 部屋の範囲内かチェック
    if (
      behindX >= room.x &&
      behindX < room.x + room.width &&
      behindY >= room.y &&
      behindY < room.y + room.height
    ) {
      return { x: behindX, y: behindY };
    }

    return null;
  }

  /**
   * 近くの位置を見つける
   */
  private findNearbyPosition(
    x: number,
    y: number,
    minDist: number,
    maxDist: number
  ): { x: number; y: number } | null {
    const positions: Array<{ x: number; y: number }> = [];

    for (let dx = -maxDist; dx <= maxDist; dx++) {
      for (let dy = -maxDist; dy <= maxDist; dy++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= minDist && dist <= maxDist) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            positions.push({ x: nx, y: ny });
          }
        }
      }
    }

    if (positions.length === 0) return null;
    return positions[Math.floor(Math.random() * positions.length)];
  }

  /**
   * 巡回ルートを生成
   */
  private generatePatrolRoute(
    startX: number,
    startY: number,
    room: Room,
    obstacles: PlacedObstacle[]
  ): Vector3[] {
    const route: Vector3[] = [];

    // 部屋の四隅を巡回
    const corners = [
      { x: room.x + 2, y: room.y + 2, z: 0 },
      { x: room.x + room.width - 3, y: room.y + 2, z: 0 },
      { x: room.x + room.width - 3, y: room.y + room.height - 3, z: 0 },
      { x: room.x + 2, y: room.y + room.height - 3, z: 0 },
    ];

    // 開始位置に最も近い角から巡回開始
    let minDist = Infinity;
    let startIndex = 0;

    for (let i = 0; i < corners.length; i++) {
      const dist = Math.abs(corners[i].x - startX) + Math.abs(corners[i].y - startY);
      if (dist < minDist) {
        minDist = dist;
        startIndex = i;
      }
    }

    // 巡回ルートを作成
    for (let i = 0; i < corners.length; i++) {
      const index = (startIndex + i) % corners.length;
      route.push(corners[index]);
    }

    return route;
  }

  /**
   * 敵タイプを選択
   */
  private selectEnemyType(availableTypes: EnemyType[], difficultyLevel: number): EnemyType {
    // デフォルトタイプ
    const defaultTypes = [EnemyType.SCOUT, EnemyType.SOLDIER];
    const types = availableTypes && availableTypes.length > 0 ? availableTypes : defaultTypes;

    // 難易度に応じて敵タイプの重み付け
    if (difficultyLevel >= 7) {
      // 高難易度では重装型が多い
      const weightedTypes = [...types, EnemyType.HEAVY, EnemyType.HEAVY];
      return weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
    } else if (difficultyLevel <= 3) {
      // 低難易度では偵察型が多い
      const weightedTypes = [...types, EnemyType.SCOUT, EnemyType.SCOUT];
      return weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
    }

    // 中難易度はバランス
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * 位置が占有されているか確認
   */
  private isPositionOccupied(
    x: number,
    y: number,
    obstacles: PlacedObstacle[],
    items: PlacedItem[],
    enemies: PlacedEnemy[]
  ): boolean {
    if (obstacles.find((obs) => obs.x === x && obs.y === y)) return true;
    if (items.find((item) => item.x === x && item.y === y)) return true;
    if (enemies.find((enemy) => enemy.x === x && enemy.y === y)) return true;
    return false;
  }

  /**
   * マップ上で通行可能か確認
   */
  private isWalkableTile(map: number[][], x: number, y: number): boolean {
    if (y < 0 || y >= map.length) return false;
    if (x < 0 || x >= map[0].length) return false;
    return map[y][x] > 0;
  }
}
