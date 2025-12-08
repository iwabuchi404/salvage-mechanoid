import {
  PlacedObstacle,
  PlacedItem,
  PlacedEnemy,
  PlacedPortal,
  PlacedCharger,
  ObstaclePlacementConfig,
  ItemPlacementConfig,
  EnemyPlacementConfig,
  ObstacleType,
  ItemType,
  ItemRarity,
  EnemyType,
  EnemyBehavior,
  Room,
  Corridor,
  TacticalElement,
  EnergyPoint,
} from '../types';
import { ObstaclePlacer } from './placement/ObstaclePlacer';
import { ItemPlacer } from './placement/ItemPlacer';
import { EnemyPlacer } from './placement/EnemyPlacer';
import { SpecialObjectPlacer } from './placement/SpecialObjectPlacer';

/**
 * リソース生成システム
 * マップ生成後に障害物・アイテム・敵を配置
 */
export class ResourceGenerationSystem {
  private width: number;
  private height: number;
  private obstaclePlacer: ObstaclePlacer;
  private itemPlacer: ItemPlacer;
  private enemyPlacer: EnemyPlacer;
  private specialObjectPlacer: SpecialObjectPlacer;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.obstaclePlacer = new ObstaclePlacer(width, height);
    this.itemPlacer = new ItemPlacer(width, height);
    this.enemyPlacer = new EnemyPlacer(width, height);
    this.specialObjectPlacer = new SpecialObjectPlacer(width, height);
  }

  /**
   * 全リソースを生成
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param corridors 通路のリスト
   * @param tacticalElements 戦術要素のリスト（オプション）
   * @param options 生成オプション
   * @returns 生成されたリソース
   */
  generateResources(
    map: number[][],
    rooms: Room[],
    corridors: Corridor[],
    tacticalElements: TacticalElement[] = [],
    options: {
      playerLevel?: number;
      difficulty?: number;
      skipObstacles?: boolean;
      skipItems?: boolean;
      skipEnemies?: boolean;
      skipPortals?: boolean;
      skipChargers?: boolean;
      energyPoints?: EnergyPoint[];
      playerStartPos?: { x: number; y: number };
    } = {}
  ): {
    obstacles: PlacedObstacle[];
    items: PlacedItem[];
    enemies: PlacedEnemy[];
    portals: PlacedPortal[];
    chargers: PlacedCharger[];
  } {
    console.log('ResourceGenerationSystem: Starting resource generation...');
    const startTime = performance.now();

    const playerLevel = options.playerLevel || 1;
    const difficulty = options.difficulty || 1;

    // 占有済み位置セット（プレイヤー位置を含む）
    const occupiedPositions = new Set<string>();
    if (options.playerStartPos) {
      // プレイヤー位置とその周囲1マスを配置禁止に
      const px = options.playerStartPos.x;
      const py = options.playerStartPos.y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          occupiedPositions.add(`${px + dx},${py + dy}`);
        }
      }
    }

    // 1. 障害物配置
    let obstacles: PlacedObstacle[] = [];
    if (!options.skipObstacles) {
      const obstacleConfig = this.createObstacleConfig(rooms.length, difficulty);
      obstacles = this.obstaclePlacer.placeObstacles(
        map,
        rooms,
        corridors,
        tacticalElements,
        obstacleConfig,
        occupiedPositions
      );
      // 障害物位置を占有済みに追加
      for (const obs of obstacles) {
        occupiedPositions.add(`${obs.x},${obs.y}`);
      }
    }

    // 2. アイテム配置
    let items: PlacedItem[] = [];
    if (!options.skipItems) {
      const itemConfig = this.createItemConfig(rooms.length, playerLevel);
      items = this.itemPlacer.placeItems(
        map,
        rooms,
        obstacles,
        tacticalElements,
        itemConfig,
        occupiedPositions
      );
      // アイテム位置を占有済みに追加
      for (const item of items) {
        occupiedPositions.add(`${item.x},${item.y}`);
      }
    }

    // 3. 敵配置
    let enemies: PlacedEnemy[] = [];
    if (!options.skipEnemies) {
      const enemyConfig = this.createEnemyConfig(rooms.length, difficulty);
      enemies = this.enemyPlacer.placeEnemies(
        map,
        rooms,
        corridors,
        obstacles,
        items,
        tacticalElements,
        enemyConfig,
        occupiedPositions
      );
    }

    // 4. ポータル配置
    let portals: PlacedPortal[] = [];
    if (!options.skipPortals) {
      portals = this.specialObjectPlacer.placePortals(
        map,
        rooms,
        2, // デフォルト2個
        options.playerStartPos
      );
    }

    // 5. エネルギーチャージャー配置
    let chargers: PlacedCharger[] = [];
    if (!options.skipChargers) {
      chargers = this.specialObjectPlacer.placeEnergyChargers(
        map,
        rooms,
        options.energyPoints || [],
        playerLevel,
        difficulty
      );
    }

    const endTime = performance.now();
    console.log(
      `ResourceGenerationSystem: Generated ${obstacles.length} obstacles, ${items.length} items, ${
        enemies.length
      } enemies, ${portals.length} portals, ${chargers.length} chargers in ${(
        endTime - startTime
      ).toFixed(2)}ms`
    );

    return { obstacles, items, enemies, portals, chargers };
  }

  /**
   * 障害物配置設定を作成
   */
  private createObstacleConfig(roomCount: number, difficulty: number): ObstaclePlacementConfig {
    const baseObstacleCount = Math.floor(roomCount * 2);

    return {
      minObstacles: Math.floor(baseObstacleCount * 0.7),
      maxObstacles: Math.floor(baseObstacleCount * 1.3),
      obstacleTypes: [
        ObstacleType.CRATE,
        ObstacleType.BARREL,
        ObstacleType.DEBRIS,
        ObstacleType.CONSOLE,
      ],
      coverDensity: 0.3 + difficulty * 0.1, // 難易度が高いほど遮蔽物が多い
      placementRules: [
        {
          nearEnemies: true, // 敵の近くに遮蔽物を配置
          createChoke: true, // チョークポイントを作成
        },
      ],
    };
  }

  /**
   * アイテム配置設定を作成
   */
  private createItemConfig(roomCount: number, playerLevel: number): ItemPlacementConfig {
    const baseItemCount = Math.floor(roomCount * 1.5);

    return {
      minItems: Math.floor(baseItemCount * 0.8),
      maxItems: Math.floor(baseItemCount * 1.2),
      rarityDistribution: {
        common: 0.5,
        uncommon: 0.3,
        rare: 0.15,
        legendary: 0.05,
      },
      itemTypes: [
        ItemType.ENERGY,
        ItemType.HEALTH,
        ItemType.WEAPON,
        ItemType.ARMOR,
        ItemType.UPGRADE,
        ItemType.CONSUMABLE,
      ],
      placementRules: [
        {
          avoidEnemies: true, // 敵から離して配置
          minDistanceFromPlayer: 5, // プレイヤー開始位置から最小5マス離す
        },
      ],
    };
  }

  /**
   * 敵配置設定を作成
   */
  private createEnemyConfig(roomCount: number, difficulty: number): EnemyPlacementConfig {
    const baseEnemyCount = Math.floor(roomCount * 1.5);
    const adjustedCount = Math.floor(baseEnemyCount * (1 + difficulty * 0.2));

    return {
      minEnemies: Math.floor(adjustedCount * 0.8),
      maxEnemies: Math.floor(adjustedCount * 1.2),
      difficultyLevel: Math.ceil(difficulty * 3), // 1-10のスケール
      allowBoss: roomCount >= 5, // 5部屋以上ならボスを配置
      enemyTypes: [
        EnemyType.SCOUT,
        EnemyType.SOLDIER,
        EnemyType.HEAVY,
        EnemyType.TURRET,
        ...(roomCount >= 5 ? [EnemyType.BOSS] : []),
      ],
      placementRules: [
        {
          minDistanceFromEntrance: 8, // 入口から8マス以上離す
          behavior: EnemyBehavior.PATROL,
          density: 0.6,
        },
      ],
    };
  }

  /**
   * 障害物のみを配置
   */
  placeObstacles(
    map: number[][],
    rooms: Room[],
    corridors: Corridor[],
    tacticalElements: TacticalElement[],
    config?: ObstaclePlacementConfig
  ): PlacedObstacle[] {
    const obstacleConfig = config || this.createObstacleConfig(rooms.length, 1);
    return this.obstaclePlacer.placeObstacles(
      map,
      rooms,
      corridors,
      tacticalElements,
      obstacleConfig
    );
  }

  /**
   * アイテムのみを配置
   */
  placeItems(
    map: number[][],
    rooms: Room[],
    obstacles: PlacedObstacle[],
    tacticalElements: TacticalElement[],
    config?: ItemPlacementConfig
  ): PlacedItem[] {
    const itemConfig = config || this.createItemConfig(rooms.length, 1);
    return this.itemPlacer.placeItems(map, rooms, obstacles, tacticalElements, itemConfig);
  }

  /**
   * 敵のみを配置
   */
  placeEnemies(
    map: number[][],
    rooms: Room[],
    corridors: Corridor[],
    obstacles: PlacedObstacle[],
    items: PlacedItem[],
    tacticalElements: TacticalElement[],
    config?: EnemyPlacementConfig
  ): PlacedEnemy[] {
    const enemyConfig = config || this.createEnemyConfig(rooms.length, 1);
    return this.enemyPlacer.placeEnemies(
      map,
      rooms,
      corridors,
      obstacles,
      items,
      tacticalElements,
      enemyConfig
    );
  }
}
