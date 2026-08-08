# 統合配置システム実装プラン

## 現状分析

### 現在の配置システム（分離型）

**1. マップ生成フェーズ（MapGenerator）**
- 部屋生成（BSP/Cellular）
- 通路生成（A*/L-Shape）
- 地形特徴配置（BasicFeaturePlacer/RuleBasedFeaturePlacer）
  - 水、山、回復タイル、ポータル
  - 現在：ランダム配置のみ

**2. 戦術要素配置フェーズ（TacticalMapGenerator）**
- エネルギーポイント配置（EnergyPointPlacer）
- 戦術要素配置（TacticalElementPlacer）
  - 高台、チョークポイント、観測所、補給キャッシュなど
  - 部屋の位置関係を考慮した配置

**3. ゲーム初期化フェーズ（Game.initialize）**
- 敵の配置（spawnEnemies）
  - WorldSystemを使ってランダム配置
  - 5-15体の敵を生成
- アイテムの配置（spawnItems）
  - ランダムな歩行可能位置に配置
  - エネルギー、体力、鍵、武器

### 問題点

1. **分離による一貫性の欠如**
   - 敵の配置がマップ構造を考慮していない
   - アイテムが戦術要素と無関係に配置される
   - 障害物が後から配置され、通路を塞ぐ可能性

2. **ゲームデザインの制限**
   - 「宝物部屋には必ず敵がいる」などのルールが実装できない
   - 「ボス部屋は入口近くに体力回復アイテム」などの配置が不可能
   - 難易度調整が困難

3. **エンティティデータの分離**
   - マップ生成結果に敵・アイテム情報が含まれない
   - 評価システムで配置バランスをチェックできない

---

## 統合配置システム設計

### アーキテクチャ

```
FlexibleMapGenerator/TacticalMapGenerator
  ↓
1. 部屋・通路生成
  ↓
2. 地形配置（水、山など）
  ↓
3. 戦術要素配置（高台、チョークポイントなど）
  ↓
4. 【新】敵配置システム
  ↓
5. 【新】アイテム配置システム
  ↓
6. 【新】障害物配置システム
  ↓
MapGenerationResult {
  map: number[][]
  rooms: Room[]
  corridors: Corridor[]
  features: PlacedFeature[]
  enemies: PlacedEnemy[]      // 新規
  items: PlacedItem[]         // 新規
  obstacles: PlacedObstacle[] // 新規
}
```

### 新しい型定義

```typescript
// src/engine/types.ts に追加

/**
 * 配置された敵の情報
 */
export interface PlacedEnemy {
  id: string;                    // 敵のID
  type: EnemyType;              // 敵のタイプ
  x: number;                    // X座標
  y: number;                    // Y座標
  level: number;                // レベル
  behavior: EnemyBehavior;      // 行動パターン
  patrolRoute?: Vector3[];      // 巡回ルート（オプション）
  triggerCondition?: string;    // 出現条件（オプション）
}

/**
 * 敵のタイプ
 */
export enum EnemyType {
  SCOUT = 'scout',           // 偵察型（弱い、素早い）
  SOLDIER = 'soldier',       // 兵士型（標準）
  HEAVY = 'heavy',           // 重装型（強い、遅い）
  TURRET = 'turret',         // タレット（固定、射程長い）
  BOSS = 'boss',             // ボス
}

/**
 * 敵の行動パターン
 */
export enum EnemyBehavior {
  STATIC = 'static',         // 静止
  PATROL = 'patrol',         // 巡回
  GUARD = 'guard',           // 警戒（プレイヤーを感知すると追跡）
  AGGRESSIVE = 'aggressive', // 積極的（常に追跡）
}

/**
 * 配置されたアイテムの情報
 */
export interface PlacedItem {
  id: string;                    // アイテムのID
  type: ItemType;               // アイテムのタイプ
  x: number;                    // X座標
  y: number;                    // Y座標
  rarity: ItemRarity;           // レアリティ
  properties?: Record<string, any>; // アイテム固有のプロパティ
}

/**
 * アイテムのタイプ
 */
export enum ItemType {
  ENERGY = 'energy',         // エネルギー回復
  HEALTH = 'health',         // 体力回復
  KEY = 'key',               // 鍵
  WEAPON = 'weapon',         // 武器
  ARMOR = 'armor',           // 防具
  UPGRADE = 'upgrade',       // アップグレード
  CONSUMABLE = 'consumable', // 消耗品
}

/**
 * アイテムのレアリティ
 */
export enum ItemRarity {
  COMMON = 'common',         // 一般
  UNCOMMON = 'uncommon',     // レア
  RARE = 'rare',             // 激レア
  LEGENDARY = 'legendary',   // 伝説
}

/**
 * 配置された障害物の情報
 */
export interface PlacedObstacle {
  id: string;                    // 障害物のID
  type: ObstacleType;           // 障害物のタイプ
  x: number;                    // X座標
  y: number;                    // Y座標
  destructible: boolean;        // 破壊可能か
  health?: number;              // 体力（破壊可能な場合）
}

/**
 * 障害物のタイプ
 */
export enum ObstacleType {
  CRATE = 'crate',           // 木箱（破壊可能、遮蔽物）
  BARREL = 'barrel',         // バレル（破壊可能、爆発）
  WALL = 'wall',             // 壁（破壊不可）
  DEBRIS = 'debris',         // 瓦礫（破壊可能）
  CONSOLE = 'console',       // コンソール（インタラクト可能）
}

/**
 * 敵配置設定
 */
export interface EnemyPlacementConfig {
  minEnemies: number;           // 最小敵数
  maxEnemies: number;           // 最大敵数
  difficultyLevel: number;      // 難易度レベル (1-10)
  allowBoss: boolean;           // ボスを配置するか
  enemyTypes: EnemyType[];      // 使用可能な敵タイプ
  placementRules: EnemyPlacementRule[]; // 配置ルール
}

/**
 * 敵配置ルール
 */
export interface EnemyPlacementRule {
  roomType?: RoomType;          // 特定の部屋タイプに配置
  minDistanceFromEntrance?: number; // 入口からの最小距離
  behavior?: EnemyBehavior;     // 行動パターン
  density?: number;             // 配置密度 (0-1)
}

/**
 * アイテム配置設定
 */
export interface ItemPlacementConfig {
  minItems: number;             // 最小アイテム数
  maxItems: number;             // 最大アイテム数
  rarityDistribution: {         // レアリティ分布
    common: number;
    uncommon: number;
    rare: number;
    legendary: number;
  };
  itemTypes: ItemType[];        // 使用可能なアイテムタイプ
  placementRules: ItemPlacementRule[]; // 配置ルール
}

/**
 * アイテム配置ルール
 */
export interface ItemPlacementRule {
  roomType?: RoomType;          // 特定の部屋タイプに配置
  nearTacticalElement?: TacticalElementType; // 戦術要素の近くに配置
  avoidEnemies?: boolean;       // 敵から離して配置
  minDistanceFromPlayer?: number; // プレイヤー開始位置からの最小距離
}

/**
 * 障害物配置設定
 */
export interface ObstaclePlacementConfig {
  minObstacles: number;         // 最小障害物数
  maxObstacles: number;         // 最大障害物数
  obstacleTypes: ObstacleType[]; // 使用可能な障害物タイプ
  coverDensity: number;         // 遮蔽物密度 (0-1)
  placementRules: ObstaclePlacementRule[]; // 配置ルール
}

/**
 * 障害物配置ルール
 */
export interface ObstaclePlacementRule {
  roomType?: RoomType;          // 特定の部屋タイプに配置
  nearEnemies?: boolean;        // 敵の近くに配置（遮蔽物として）
  avoidCorridors?: boolean;     // 通路を避ける
  createChoke?: boolean;        // チョークポイントを作る
}
```

### GenerationConfigの拡張

```typescript
// src/engine/types.ts の GenerationConfig に追加

export interface GenerationConfig {
  // 既存のフィールド...
  width: number;
  height: number;
  algorithm: MapGenerationAlgorithm;
  roomConfig: RoomGenerationConfig;
  corridorConfig: CorridorGenerationConfig;
  featureConfig: FeaturePlacementConfig;
  postProcessing: PostProcessingConfig;
  stageType?: StageType;

  // 【新規追加】
  enemyPlacementConfig?: EnemyPlacementConfig;     // 敵配置設定
  itemPlacementConfig?: ItemPlacementConfig;       // アイテム配置設定
  obstaclePlacementConfig?: ObstaclePlacementConfig; // 障害物配置設定
}
```

### MapGenerationResultの拡張

```typescript
export interface MapGenerationResult {
  map: number[][];
  rooms: Room[];
  corridors: Corridor[];
  features: PlacedFeature[];

  // 【新規追加】
  enemies?: PlacedEnemy[];      // 配置された敵
  items?: PlacedItem[];         // 配置されたアイテム
  obstacles?: PlacedObstacle[]; // 配置された障害物

  metadata: {
    totalGenerationTime: number;
    algorithmsUsed: string[];
    config: GenerationConfig;
    seed: number;
  };
}
```

---

## 実装ステップ

### 実装順序の理由

**障害物 → アイテム → 敵** の順序で実装します。

**理由:**
1. **戦術的配置が可能**: 遮蔽物の後ろに敵を配置、障害物で視線を遮って伏兵を配置
2. **自然な配置フロー**: 地形 → 環境詳細化 → 報酬配置 → 脅威配置
3. **ゲームデザイン的に合理的**: 「遮蔽物の後ろから狙撃する敵」「アイテムを守る敵」
4. **デバッグしやすい**: 各レイヤーを段階的に視覚確認できる

---

### Phase 1: 型定義と基盤整備

**ファイル:**
- `src/engine/types.ts`

**タスク:**
1. ✅ 新しい型定義を追加
   - `PlacedObstacle`, `ObstacleType` ← 先に定義
   - `PlacedItem`, `ItemType`, `ItemRarity`
   - `PlacedEnemy`, `EnemyType`, `EnemyBehavior`
   - 各種配置設定とルール
2. ✅ `GenerationConfig` を拡張
3. ✅ `MapGenerationResult` を拡張

**所要時間:** 1時間

---

### Phase 2: 障害物配置システム実装（環境の詳細化）

**新規ファイル:**
- `src/engine/world/placement/ObstaclePlacer.ts`

**クラス設計:**
```typescript
export class ObstaclePlacer {
  placeObstacles(
    map: number[][],
    rooms: Room[],
    corridors: Corridor[],
    tacticalElements: TacticalElement[],
    config: ObstaclePlacementConfig
  ): PlacedObstacle[] {
    // 1. 戦術要素に基づく障害物配置（高台周辺など）
    // 2. チョークポイントの強化
    // 3. 部屋内の遮蔽物配置（後で敵が使える）
    // 4. 破壊可能オブジェクトの配置
    // 5. インタラクティブオブジェクトの配置
  }
}
```

**タスク:**
1. ✅ ObstaclePlacerクラス実装
2. ✅ 遮蔽物配置ロジック
3. ✅ チョークポイント強化ロジック
4. ✅ 破壊可能オブジェクト配置
5. ✅ 通路妨害チェック機能

**所要時間:** 2-3時間

---

### Phase 3: アイテム配置システム実装（報酬の配置）

**新規ファイル:**
- `src/engine/world/placement/ItemPlacer.ts`

**クラス設計:**
```typescript
export class ItemPlacer {
  placeItems(
    map: number[][],
    rooms: Room[],
    obstacles: PlacedObstacle[],  // 障害物情報を受け取る
    tacticalElements: TacticalElement[],
    config: ItemPlacementConfig
  ): PlacedItem[] {
    // 1. 宝物部屋へのアイテム配置
    // 2. 危険エリア（後で敵が配置される予定）を避けた配置
    // 3. 戦術要素近くにアイテム配置
    // 4. 障害物の影になる位置にアイテム配置（取得に工夫が必要）
  }
}
```

**タスク:**
1. ✅ ItemPlacerクラス実装
2. ✅ 宝物部屋への高レアアイテム配置
3. ✅ 戦闘前補給アイテム配置
4. ✅ レアリティ分布ロジック
5. ✅ 障害物を活用した配置

**所要時間:** 3時間

---

### Phase 4: 敵配置システム実装（脅威の配置）

**新規ファイル:**
- `src/engine/world/placement/EnemyPlacer.ts`

**クラス設計:**
```typescript
export class EnemyPlacer {
  placeEnemies(
    map: number[][],
    rooms: Room[],
    corridors: Corridor[],
    obstacles: PlacedObstacle[],  // 障害物情報を活用
    items: PlacedItem[],          // アイテム情報を活用
    tacticalElements: TacticalElement[],
    config: EnemyPlacementConfig
  ): PlacedEnemy[] {
    // 1. 障害物の後ろに狙撃手を配置
    // 2. アイテムを守る敵を配置
    // 3. 遮蔽物を利用した待ち伏せ敵を配置
    // 4. チョークポイントの敵配置
    // 5. 巡回ルートの設定（障害物を避ける）
  }
}
```

**タスク:**
1. ✅ EnemyPlacerクラス実装
2. ✅ ボス部屋への敵配置ロジック
3. ✅ 障害物を活用した敵配置ロジック
4. ✅ アイテムを守る敵配置ロジック
5. ✅ 巡回ルート生成ロジック

**所要時間:** 3-4時間

---

### Phase 5: FlexibleMapGeneratorへの統合

**修正ファイル:**
- `src/engine/world/FlexibleMapGenerator.ts`
- `src/engine/world/TacticalMapGenerator.ts`

**統合ロジック:**
```typescript
// FlexibleMapGenerator.ts に追加

import { EnemyPlacer } from './placement/EnemyPlacer';
import { ItemPlacer } from './placement/ItemPlacer';
import { ObstaclePlacer } from './placement/ObstaclePlacer';

async generate(config: GenerationConfig): Promise<MapGenerationResult> {
  await this.initialize();

  // 既存の生成処理...
  const roomResult = roomGenerator.generate(config.roomConfig);
  const corridorResult = corridorGenerator.generate(roomResult.rooms, config.corridorConfig);
  // ...

  let obstacles: PlacedObstacle[] = [];
  let items: PlacedItem[] = [];
  let enemies: PlacedEnemy[] = [];

  // 【新規】障害物配置（最初に環境を詳細化）
  if (config.obstaclePlacementConfig) {
    const obstaclePlacer = new ObstaclePlacer(this.width, this.height);
    obstacles = obstaclePlacer.placeObstacles(
      map,
      roomResult.rooms,
      corridorResult.corridors,
      tacticalElements || [],
      config.obstaclePlacementConfig
    );
    console.log(`Placed ${obstacles.length} obstacles`);
  }

  // 【新規】アイテム配置（障害物情報を活用）
  if (config.itemPlacementConfig) {
    const itemPlacer = new ItemPlacer(this.width, this.height);
    items = itemPlacer.placeItems(
      map,
      roomResult.rooms,
      obstacles,
      tacticalElements || [],
      config.itemPlacementConfig
    );
    console.log(`Placed ${items.length} items`);
  }

  // 【新規】敵配置（最後に、すべての情報を活用）
  if (config.enemyPlacementConfig) {
    const enemyPlacer = new EnemyPlacer(this.width, this.height);
    enemies = enemyPlacer.placeEnemies(
      map,
      roomResult.rooms,
      corridorResult.corridors,
      obstacles,
      items,
      tacticalElements || [],
      config.enemyPlacementConfig
    );
    console.log(`Placed ${enemies.length} enemies`);
  }

  return {
    map,
    rooms: roomResult.rooms,
    corridors: corridorResult.corridors,
    features: featureResult.features,
    enemies,    // 新規
    items,      // 新規
    obstacles,  // 新規
    metadata: {
      totalGenerationTime,
      algorithmsUsed,
      config,
      seed,
    },
  };
}
```

**タスク:**
1. ✅ 配置システムのインポート
2. ✅ 配置順序の実装
3. ✅ 結果のマージ
4. ✅ デフォルト設定の追加

**所要時間:** 2時間

---

### Phase 6: Game.tsの修正

**修正ファイル:**
- `src/game/Game.ts`

**変更内容:**
```typescript
// Game.ts の修正

private async generateMap(stageType: StageType = StageType.CLASSIC): Promise<void> {
  console.log(`Generating map with stage type: ${stageType}...`);

  const mapGenerator = new FlexibleMapGenerator(50, 50);

  // 【変更】敵・アイテム配置設定を追加
  const config: GenerationConfig = {
    // 既存の設定...

    // 【新規】敵配置設定
    enemyPlacementConfig: {
      minEnemies: 5,
      maxEnemies: 15,
      difficultyLevel: this.calculateDifficulty(),
      allowBoss: true,
      enemyTypes: [EnemyType.SCOUT, EnemyType.SOLDIER, EnemyType.HEAVY, EnemyType.TURRET],
      placementRules: [
        { roomType: RoomType.BOSS, behavior: EnemyBehavior.AGGRESSIVE },
        { roomType: RoomType.TREASURE, density: 0.8 },
        { minDistanceFromEntrance: 10 },
      ],
    },

    // 【新規】アイテム配置設定
    itemPlacementConfig: {
      minItems: 5,
      maxItems: 20,
      rarityDistribution: {
        common: 0.5,
        uncommon: 0.3,
        rare: 0.15,
        legendary: 0.05,
      },
      itemTypes: [ItemType.ENERGY, ItemType.HEALTH, ItemType.WEAPON, ItemType.UPGRADE],
      placementRules: [
        { roomType: RoomType.TREASURE, },
        { avoidEnemies: true },
      ],
    },

    // 【新規】障害物配置設定
    obstaclePlacementConfig: {
      minObstacles: 10,
      maxObstacles: 30,
      obstacleTypes: [ObstacleType.CRATE, ObstacleType.BARREL, ObstacleType.DEBRIS],
      coverDensity: 0.6,
      placementRules: [
        { nearEnemies: true },
        { avoidCorridors: true },
      ],
    },
  };

  const result = await mapGenerator.generate(config);

  // マップをTileMapに変換
  this.tileMap = new TileMap(50, 50);
  this.tileMap.importMapData(result.map);

  // 【新規】生成された敵・アイテム・障害物をエンティティとして登録
  this.spawnGeneratedEnemies(result.enemies || []);
  this.spawnGeneratedItems(result.items || []);
  this.spawnGeneratedObstacles(result.obstacles || []);
}

// 【変更】既存のspawnEnemies/spawnItemsを削除または簡略化

private spawnGeneratedEnemies(enemies: PlacedEnemy[]): void {
  console.log(`Spawning ${enemies.length} pre-placed enemies...`);

  const entitySystem = this.engine.getSystem<EntitySystem>('entity');

  for (const enemyData of enemies) {
    const enemy = this.createEnemyFromData(enemyData);
    if (enemy && entitySystem) {
      entitySystem.registerEntity(enemy);
    }
  }
}

private spawnGeneratedItems(items: PlacedItem[]): void {
  console.log(`Spawning ${items.length} pre-placed items...`);

  const entitySystem = this.engine.getSystem<EntitySystem>('entity');

  for (const itemData of items) {
    const item = this.createItemFromData(itemData);
    if (item && entitySystem) {
      entitySystem.registerEntity(item);
    }
  }
}

private spawnGeneratedObstacles(obstacles: PlacedObstacle[]): void {
  console.log(`Spawning ${obstacles.length} pre-placed obstacles...`);

  const entitySystem = this.engine.getSystem<EntitySystem>('entity');

  for (const obstacleData of obstacles) {
    const obstacle = this.createObstacleFromData(obstacleData);
    if (obstacle && entitySystem) {
      entitySystem.registerEntity(obstacle);
    }
  }
}
```

**タスク:**
1. ✅ generateMapの設定追加
2. ✅ spawnGeneratedXxx メソッド実装
3. ✅ createXxxFromData メソッド実装
4. ✅ 既存のspawnEnemies/spawnItemsを削除

**所要時間:** 2時間

---

### Phase 7: 評価システムへの統合

**修正ファイル:**
- `src/tools/map-evaluation/MapEvaluator.ts`
- `src/tools/map-evaluation/types.ts`

**新しい評価指標:**
```typescript
// types.ts に追加

export interface EvaluationMetrics {
  // 既存の指標
  connectivity: number;
  roomCount: number;
  roomSizeVariance: number;
  roomDistribution: number;
  corridorEfficiency: number;

  // 【新規追加】
  enemyDensity: number;          // 敵の密度 (0-1)
  itemBalance: number;           // アイテムバランス (0-1)
  coverAvailability: number;     // 遮蔽物の利用可能性 (0-1)
  difficultyScore: number;       // 難易度スコア (0-10)
}
```

**評価ロジック:**
```typescript
// MapEvaluator.ts に追加

private evaluateEnemyPlacement(enemies: PlacedEnemy[], rooms: Room[]): number {
  // 敵の配置が適切かを評価
  // - ボス部屋にボスがいるか
  // - 敵が密集しすぎていないか
  // - 入口近くに強敵がいないか
}

private evaluateItemPlacement(items: PlacedItem[], enemies: PlacedEnemy[]): number {
  // アイテムの配置バランスを評価
  // - レアリティ分布が適切か
  // - 敵の近くにアイテムがないか
  // - 体力回復アイテムが適度にあるか
}

private evaluateCoverPlacement(obstacles: PlacedObstacle[], enemies: PlacedEnemy[]): number {
  // 遮蔽物の配置を評価
  // - 敵の近くに遮蔽物があるか
  // - 通路を塞いでいないか
}
```

**タスク:**
1. ✅ 新しい評価指標の型定義
2. ✅ 敵配置評価ロジック
3. ✅ アイテム配置評価ロジック
4. ✅ 遮蔽物評価ロジック
5. ✅ 総合難易度評価

**所要時間:** 3時間

---

### Phase 8: テストとバランス調整

**新規ファイル:**
- `src/tools/map-evaluation/test-integrated-placement.ts`

**テストシナリオ:**
1. 敵のみ配置テスト
2. アイテムのみ配置テスト
3. 障害物のみ配置テスト
4. 統合配置テスト
5. 異なる難易度レベルでのテスト

**タスク:**
1. ✅ テストスクリプト作成
2. ✅ 各配置システムの単体テスト
3. ✅ 統合テスト
4. ✅ バランス調整
5. ✅ パフォーマンス測定

**所要時間:** 3-4時間

---

## 総所要時間見積もり

| Phase | 内容 | 所要時間 |
|-------|------|----------|
| Phase 1 | 型定義と基盤整備 | 1時間 |
| Phase 2 | **障害物配置システム** | 2-3時間 |
| Phase 3 | **アイテム配置システム** | 3時間 |
| Phase 4 | **敵配置システム** | 3-4時間 |
| Phase 5 | FlexibleMapGenerator統合 | 2時間 |
| Phase 6 | Game.ts修正 | 2時間 |
| Phase 7 | 評価システム統合 | 3時間 |
| Phase 8 | テストとバランス調整 | 3-4時間 |
| **合計** | | **19-22時間** |

**実装順序: 障害物 → アイテム → 敵**

---

## 実装優先順位

### 高優先度（Phase 1-2）
- 型定義の追加
- **障害物配置システムの実装**（環境の詳細化）
- FlexibleMapGeneratorへの基本統合

### 中優先度（Phase 3-5）
- **アイテム配置システム**（報酬の配置）
- **敵配置システム**（戦術的配置）
- Game.tsの修正

### 低優先度（Phase 6-8）
- 評価システムへの統合
- 詳細なバランス調整
- パフォーマンス最適化

---

## リスクと対策

### リスク1: パフォーマンス低下
**対策:**
- 配置アルゴリズムの最適化
- 不要な計算のキャッシュ
- 配置数の上限設定

### リスク2: ゲームバランスの崩壊
**対策:**
- 段階的なテストと調整
- 評価システムでの自動チェック
- デフォルト設定の慎重な設定

### リスク3: 既存コードとの互換性
**対策:**
- 配置設定をオプショナルにする
- 既存のspawnメソッドを残す（非推奨として）
- 段階的な移行パス提供

---

## 次のステップ

このプランを確認いただき、承認されれば以下の順序で実装を進めます：

1. **Phase 1の実装**: 型定義の追加（最も影響範囲が広い）
2. **Phase 2の実装**: 敵配置システム（最も重要度が高い）
3. **簡易テスト**: 敵配置だけで動作確認
4. **Phase 3-4の実装**: アイテムと障害物配置
5. **Phase 5-6の実装**: 統合とGame.ts修正
6. **Phase 7-8の実装**: 評価とバランス調整

各Phaseごとに動作確認とレビューを行いながら進めます。
