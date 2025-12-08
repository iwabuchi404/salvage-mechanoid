/**
 * エンジン全体で使用される共通の型定義
 */

/**
 * 2D位置を表す型
 */
export type Vector2 = {
  x: number;
  y: number;
};

/**
 * 3D位置を表す型
 */
export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

/**
 * サイズを表す型
 */
export type Size = {
  width: number;
  height: number;
};

/**
 * 矩形を表す型
 */
export type Rectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * 色を表す型
 */
export type Color = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

/**
 * レイヤー名の列挙型
 */
export enum LayerName {
  BACKGROUND = 'background',
  TERRAIN = 'terrain',
  OBJECTS = 'objects',
  CHARACTERS = 'characters',
  EFFECTS = 'effects',
  UI = 'ui',
}

/**
 * イベント名の列挙型
 */
export enum EventName {
  // エンティティ関連イベント
  ENTITY_CREATED = 'entity_created',
  ENTITY_DESTROYED = 'entity_destroyed',
  ENTITY_MOVED = 'entity_moved',
  ENTITY_COLLISION = 'entity_collision',

  // ゲームステート関連イベント
  GAME_START = 'game_start',
  GAME_PAUSE = 'game_pause',
  GAME_RESUME = 'game_resume',
  GAME_OVER = 'game_over',

  // 入力関連イベント
  KEY_PRESSED = 'key_pressed',
  KEY_RELEASED = 'key_released',
  MOUSE_MOVED = 'mouse_moved',
  MOUSE_CLICKED = 'mouse_clicked',

  // UI関連イベント
  UI_BUTTON_CLICKED = 'ui_button_clicked',
  UI_WINDOW_OPENED = 'ui_window_opened',
  UI_WINDOW_CLOSED = 'ui_window_closed',
}

/**
 * タイルの種類を表す列挙型
 */
export enum TileType {
  EMPTY = 0,
  GRASS = 1,
  WATER = 2,
  MOUNTAIN = 3,
  TILE = 4,
  PORTAL = 5,
  DAMAGE = 6,
  HEAL = 7,
  EVENT = 8,
}

/**
 * キャラクターの向きを表す型
 */
export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * ターンフェーズを表す列挙型
 */
export enum TurnPhase {
  PLAYER = 0,
  ENEMY = 1,
  END = 2,
}

/**
 * マップ生成アルゴリズムの種類
 */
export enum MapGenerationAlgorithm {
  BSP = 'bsp',
  CELLULAR_AUTOMATA = 'cellular',
  VORONOI = 'voronoi', // 未実装（将来の拡張用）
  MAZE = 'maze', // 未実装（将来の拡張用）
  RANDOM_WALK = 'random-walk', // 未実装（将来の拡張用）
  MIXED = 'mixed', // 未実装（将来の拡張用）
}

/**
 * ステージタイプの種類
 * 各ステージタイプは異なる戦術的体験を提供
 */
export enum StageType {
  // 既存の基本ステージ
  CLASSIC = 'classic', // 従来の部屋+通路システム

  // 新しい戦術的ステージ
  ENERGY_MANAGEMENT = 'energy_management', // エネルギー管理重視
  TACTICAL_COMBAT = 'tactical_combat', // スキル選択重視
  INFORMATION_WAR = 'information_war', // センサー活用重視
  RESOURCE_CONTROL = 'resource_control', // リソース争奪戦
  STEALTH_MISSION = 'stealth_mission', // 隠密行動重視
  SURVIVAL_CHALLENGE = 'survival_challenge', // 生存戦略重視
}

/**
 * 通路生成方法の種類
 */
export enum CorridorGenerationMethod {
  ASTAR = 'astar',
  L_SHAPE = 'lshape',
  MAZE = 'maze',
}

/**
 * 地形効果の種類
 */
export enum TileEffect {
  NORMAL = 'normal',
  ENERGY_DRAIN = 'energy_drain', // エネルギー消費+1
  ENERGY_BOOST = 'energy_boost', // エネルギー回復+1
  SENSOR_BOOST = 'sensor_boost', // センサー範囲+1
  SENSOR_JAMMING = 'sensor_jamming', // センサー無効化
  MOVEMENT_SLOW = 'movement_slow', // 移動コスト+1
  MOVEMENT_FAST = 'movement_fast', // 移動コスト-1
  COVER = 'cover', // 被ダメージ-50%
  EXPOSED = 'exposed', // 被ダメージ+50%
  SKILL_BOOST = 'skill_boost', // スキル効果+25%
  SKILL_DRAIN = 'skill_drain', // スキル効果-25%
}

/**
 * エネルギーポイントの種類
 */
export enum EnergyPointType {
  CHARGING_STATION = 'charging_station', // 充電ステーション（3ターンで30回復）
  ENERGY_TANK = 'energy_tank', // エネルギータンク（即座に50回復）
  BATTERY_PACK = 'battery_pack', // バッテリーパック（即座に20回復）
  POWER_NODE = 'power_node', // パワーノード（1ターンで10回復）
}

/**
 * 戦術的要素の種類
 */
export enum TacticalElementType {
  CHOKEPOINT = 'chokepoint', // 戦術的要所
  HIGH_GROUND = 'high_ground', // 高台（射程+1）
  AMBUSH_POINT = 'ambush_point', // 待ち伏せポイント
  ESCAPE_ROUTE = 'escape_route', // 脱出ルート
  OBSERVATION_POST = 'observation_post', // 観測所
  SUPPLY_CACHE = 'supply_cache', // 補給キャッシュ
}

/**
 * 特徴配置ルールの種類
 */
export enum FeaturePlacementRule {
  RANDOM = 'random',
  RULE_BASED = 'rule-based',
  DENSITY_CONTROLLED = 'density-controlled',
}

/**
 * 部屋の種類
 */
export enum RoomType {
  NORMAL = 'normal',
  BOSS = 'boss',
  TREASURE = 'treasure',
  EVENT = 'event',
  SHOP = 'shop',
  ENTRANCE = 'entrance',
  EXIT = 'exit',
}

/**
 * 特徴の種類
 */
export enum FeatureType {
  WATER = 'water',
  MOUNTAIN = 'mountain',
  TREE = 'tree',
  BUSH = 'bush',
  PORTAL = 'portal',
  HEAL = 'heal',
  DAMAGE = 'damage',
}

/**
 * 部屋の生成結果
 */
export interface RoomGenerationResult {
  rooms: Room[];
  metadata: {
    algorithm: string;
    parameters: Record<string, any>;
    generationTime: number;
    seed?: number;
  };
}

/**
 * 通路の生成結果
 */
export interface CorridorGenerationResult {
  corridors: Corridor[];
  metadata: {
    method: string;
    roomCount: number;
    totalLength: number;
    generationTime: number;
  };
}

/**
 * 特徴配置の結果
 */
export interface FeaturePlacementResult {
  features: PlacedFeature[];
  metadata: {
    placementMethod?: string;
    rule?: string;
    totalFeatures: number;
    placementTime: number;
    rulesApplied?: number;
    themeFeatures?: number;
    specialFeatures?: number;
    randomFeatures?: number;
  };
}

/**
 * 最終的なマップ生成結果
 */
export interface MapGenerationResult {
  map: number[][]; // 生成されたマップデータ
  rooms: Room[]; // 生成された部屋のリスト
  corridors: Corridor[]; // 生成された通路のリスト
  features: PlacedFeature[]; // 配置された特徴のリスト

  // 統合配置システム（新規追加）
  obstacles?: PlacedObstacle[]; // 配置された障害物
  items?: PlacedItem[]; // 配置されたアイテム
  enemies?: PlacedEnemy[]; // 配置された敵

  metadata: {
    // メタデータ
    totalGenerationTime: number; // 総生成時間
    algorithmsUsed: string[]; // 使用されたアルゴリズム
    config: GenerationConfig; // 設定情報
    seed: number; // 乱数シード
  };
}

/**
 * 部屋の定義
 */
export interface Room {
  x: number; // 部屋の左上X座標
  y: number; // 部屋の左上Y座標
  width: number; // 部屋の幅
  height: number; // 部屋の高さ
  type: RoomType; // 部屋の種類
  connections?: ConnectionPoint[]; // 接続ポイント
  features?: PlacedFeature[]; // 部屋内の特徴
  customData?: Record<string, any>; // カスタムデータ
}

/**
 * 通路の定義
 */
export interface Corridor {
  startX: number; // 開始X座標
  startY: number; // 開始Y座標
  endX: number; // 終了X座標
  endY: number; // 終了Y座標
  width: number; // 通路の幅
  method: CorridorGenerationMethod; // 生成方法
  connectedRooms: string[]; // 接続されている部屋のID
}

/**
 * 特徴の配置情報
 */
export interface PlacedFeature {
  x: number; // 配置X座標
  y: number; // 配置Y座標
  type: FeatureType; // 特徴の種類
  data?: Record<string, any>; // 追加データ
}

/**
 * 接続ポイントの定義
 */
export interface ConnectionPoint {
  x: number; // 接続ポイントのX座標
  y: number; // 接続ポイントのY座標
  connectedTo: string; // 接続先の部屋ID
  direction: Direction; // 接続方向
}

/**
 * 部屋生成設定
 */
export interface RoomGenerationConfig {
  minSize: number; // 最小部屋サイズ
  maxSize: number; // 最大部屋サイズ
  density: number; // 部屋の密集度 (0-1)
  connectivity: number; // 接続性 (0-1)
  roomTypes: RoomType[]; // 使用可能な部屋タイプ
  customRooms?: CustomRoomConfig[]; // カスタム部屋設定
}

/**
 * 通路生成設定
 */
export interface CorridorGenerationConfig {
  method: CorridorGenerationMethod; // 通路生成方法
  width: number; // 通路の幅（デフォルト値、minWidth/maxWidthがある場合はランダム化）
  minWidth?: number; // 最小通路幅（オプション、指定時はランダム化）
  maxWidth?: number; // 最大通路幅（オプション、指定時はランダム化）
  redundancy: number; // 冗長接続の度合い (0-1)
  allowDiagonal: boolean; // 対角線通路を許可するか
}

/**
 * 特徴配置設定
 */
export interface FeaturePlacementConfig {
  method?: string; // 配置方法（'basic' | 'rule-based'）
  density: number; // 特徴の密集度 (0-1)
  rules: PlacementRule[]; // 配置ルール
  themeFeatures: FeatureType[]; // テーマ固有の特徴
  globalRules: GlobalPlacementRule[]; // グローバル配置ルール
}

/**
 * 配置ルール
 */
export interface PlacementRule {
  featureType: FeatureType; // 配置する特徴の種類
  placementMethod: 'random' | 'pattern' | 'rule-based';
  density: number; // 配置密度 (0-1)
  constraints: PlacementConstraint[]; // 配置制約
}

/**
 * 特徴配置の詳細ルール（BaseFeaturePlacerで使用）
 */
export interface FeaturePlacementRuleInterface {
  id?: string; // ルールID
  featureType?: FeatureType; // 配置する特徴の種類
  count?: number; // 配置する数
  allowedTiles?: TileType[]; // 配置可能なタイルタイプ
  requiresRoom?: boolean; // 部屋内が必要か
  allowedRoomTypes?: RoomType[]; // 許可される部屋タイプ
  minDistance?: number; // 他の特徴からの最小距離
  minDistanceFromFeature?: Record<string, number>; // 特定特徴からの最小距離
}

/**
 * 配置制約
 */
export interface PlacementConstraint {
  type: 'distance' | 'proximity' | 'room_type' | 'custom';
  parameter: number | string | Record<string, any>;
  operator: 'min' | 'max' | 'equals' | 'not_equals';
}

/**
 * グローバル配置ルール
 */
export interface GlobalPlacementRule {
  name: string;
  condition: (map: number[][], rooms: Room[]) => boolean;
  action: (map: number[][], rooms: Room[]) => void;
}

/**
 * カスタム部屋設定
 */
export interface CustomRoomConfig {
  id: string;
  name: string;
  type: RoomType;
  layout: number[][]; // 部屋のレイアウト
  requiredSpace: { width: number; height: number };
  spawnPoints: { x: number; y: number; type: 'player' | 'enemy' | 'item' }[];
  connections: {
    requiredNeighbors: number;
    preferredDistance: number;
    allowMultiple: boolean;
  };
  events: EventTrigger[];
  probability: number; // 配置確率 (0-1)
}

/**
 * イベントトリガー
 */
export interface EventTrigger {
  type: string; // イベントの種類
  condition: string; // 発動条件
  data: Record<string, any>; // イベントデータ
}

/**
 * マップ生成全体設定
 */
export interface GenerationConfig {
  // 基本設定
  width: number;
  height: number;
  seed?: number;

  // ステージタイプ設定（新規追加）
  stageType?: StageType;

  // アルゴリズム設定
  algorithm: MapGenerationAlgorithm;

  // 各コンポーネントの設定
  roomConfig: RoomGenerationConfig;
  corridorConfig: CorridorGenerationConfig;
  featureConfig: FeaturePlacementConfig;

  // 戦術的設定（新規追加）
  tacticalConfig?: TacticalGenerationConfig;

  // 統合配置システム設定（新規追加）
  obstaclePlacementConfig?: ObstaclePlacementConfig; // 障害物配置設定
  itemPlacementConfig?: ItemPlacementConfig; // アイテム配置設定
  enemyPlacementConfig?: EnemyPlacementConfig; // 敵配置設定

  // 後処理設定
  postProcessing: {
    ensureConnectivity: boolean;
    balanceFeatures: boolean;
    optimizePerformance: boolean;
  };

  // テーマ設定
  theme?: MapTheme;

  // カスタム設定
  customSettings?: Record<string, any>;
}

/**
 * 戦術的マップ生成設定
 */
export interface TacticalGenerationConfig {
  // エネルギー管理の厳しさ
  energyTightness: 'relaxed' | 'balanced' | 'tight' | 'critical';

  // 主要な戦術的焦点
  primaryTacticalFocus: 'energy_management' | 'skill_selection' | 'sensor_usage' | 'mixed';

  // 難易度調整
  playerLevel: number;

  // 特定のスキルを試させたい場合
  targetSkills?: string[];

  // 戦術的要素の密度
  tacticalElementDensity: number; // 0.0-1.0

  // エネルギーポイント配置設定
  energyPointConfig: {
    density: number; // エネルギーポイントの密度
    types: EnergyPointType[]; // 使用するエネルギーポイントの種類
    strategicPlacement: boolean; // 戦略的配置を使用するか
  };

  // 地形効果設定
  terrainEffectConfig: {
    enabled: boolean;
    density: number; // 地形効果の密度
    types: TileEffect[]; // 使用する地形効果の種類
  };

  // 戦術的要素設定
  tacticalElementConfig: {
    enabled: boolean;
    density: number; // 戦術的要素の密度
    types: TacticalElementType[]; // 使用する戦術的要素の種類
  };
}

/**
 * エネルギーポイント
 */
export interface EnergyPoint {
  x: number;
  y: number;
  type: EnergyPointType;
  recoveryAmount: number; // 回復量
  usageLimit?: number; // 使用回数制限（undefined = 無制限）
  turnsRequired?: number; // 必要ターン数（充電ステーション用）
}

/**
 * 戦術的要素
 */
export interface TacticalElement {
  x: number;
  y: number;
  type: TacticalElementType;
  effect: {
    range?: number; // 効果範囲
    bonus?: number; // ボーナス値
    description: string; // 効果の説明
  };
  accessibility: {
    requiresSkill?: string; // 必要スキル
    energyCost?: number; // エネルギーコスト
  };
}

/**
 * 戦術的マップ生成結果
 */
export interface TacticalMapGenerationResult {
  // 基本マップデータ
  map: number[][];
  rooms: Room[];
  corridors: Corridor[];
  features: any[]; // Feature型が未定義のため一時的にanyを使用

  // 戦術的要素
  energyPoints: EnergyPoint[];
  tacticalElements: TacticalElement[];
  terrainEffects: Map<string, TileEffect>; // "x,y" -> TileEffect

  // 統合配置システム（オプション）
  obstacles?: PlacedObstacle[];
  items?: PlacedItem[];
  enemies?: PlacedEnemy[];

  // 戦術的メタデータ
  tacticalMetadata: {
    estimatedEnergyConsumption: number;
    availableEnergyRecovery: number;
    tacticalChoicePoints: number;
    recommendedSkills: string[];
    difficultyRating: number;
  };

  // 通常のメタデータ
  metadata: {
    totalGenerationTime: number;
    algorithmsUsed: string[];
    config: GenerationConfig;
    seed: number;
  };
}

/**
 * マップテーマ
 */
export interface MapTheme {
  name: string;
  description: string;
  algorithm: MapGenerationAlgorithm;
  roomGenerator: string;
  corridorGenerator: string;
  featurePlacer: string;
  parameters: {
    roomDensity: number;
    connectivity: number;
    features: FeatureType[];
    difficulty: number;
  };
  tileMapping: {
    [key: number]: TileType;
  };
  customRules?: GlobalPlacementRule[];
}

// ============================================================
// 統合配置システム - 障害物配置
// ============================================================

/**
 * 障害物のタイプ
 */
export enum ObstacleType {
  CRATE = 'crate', // 木箱（破壊可能、遮蔽物）
  BARREL = 'barrel', // バレル（破壊可能、爆発）
  WALL = 'wall', // 壁（破壊不可）
  DEBRIS = 'debris', // 瓦礫（破壊可能）
  CONSOLE = 'console', // コンソール（インタラクト可能）
}

/**
 * 配置された障害物の情報
 */
export interface PlacedObstacle {
  id: string; // 障害物のID
  type: ObstacleType; // 障害物のタイプ
  x: number; // X座標
  y: number; // Y座標
  destructible: boolean; // 破壊可能か
  health?: number; // 体力（破壊可能な場合）
}

/**
 * 障害物配置ルール
 */
export interface ObstaclePlacementRule {
  roomType?: RoomType; // 特定の部屋タイプに配置
  nearEnemies?: boolean; // 敵の近くに配置（遮蔽物として）
  avoidCorridors?: boolean; // 通路を避ける
  createChoke?: boolean; // チョークポイントを作る
}

/**
 * 障害物配置設定
 */
export interface ObstaclePlacementConfig {
  minObstacles: number; // 最小障害物数
  maxObstacles: number; // 最大障害物数
  obstacleTypes: ObstacleType[]; // 使用可能な障害物タイプ
  coverDensity: number; // 遮蔽物密度 (0-1)
  placementRules: ObstaclePlacementRule[]; // 配置ルール
}

// ============================================================
// 統合配置システム - アイテム配置
// ============================================================

/**
 * アイテムのタイプ（マップ生成用）
 */
export enum ItemType {
  ENERGY = 'energy', // エネルギー回復
  HEALTH = 'health', // 体力回復
  KEY = 'key', // 鍵
  WEAPON = 'weapon', // 武器
  ARMOR = 'armor', // 防具
  UPGRADE = 'upgrade', // アップグレード
  CONSUMABLE = 'consumable', // 消耗品
}

/**
 * インベントリ用アイテムタイプ
 */
export enum InventoryItemType {
  HEALTH_PACK = 'health_pack', // HP回復
  ENERGY_CELL = 'energy_cell', // エネルギー回復
  WEAPON_UPGRADE = 'weapon_upgrade', // 攻撃力アップ
  ARMOR_UPGRADE = 'armor_upgrade', // 防御力アップ
  KEY_ITEM = 'key_item', // 特殊アイテム
}

/**
 * アイテムのレアリティ
 */
export enum ItemRarity {
  COMMON = 'common', // 一般
  UNCOMMON = 'uncommon', // レア
  RARE = 'rare', // 激レア
  LEGENDARY = 'legendary', // 伝説
}

/**
 * 配置されたアイテムの情報
 */
export interface PlacedItem {
  id: string; // アイテムのID
  type: ItemType; // アイテムのタイプ
  x: number; // X座標
  y: number; // Y座標
  rarity: ItemRarity; // レアリティ
  properties?: Record<string, any>; // アイテム固有のプロパティ
}

/**
 * アイテム配置ルール
 */
export interface ItemPlacementRule {
  roomType?: RoomType; // 特定の部屋タイプに配置
  nearTacticalElement?: TacticalElementType; // 戦術要素の近くに配置
  avoidEnemies?: boolean; // 敵から離して配置
  minDistanceFromPlayer?: number; // プレイヤー開始位置からの最小距離
}

/**
 * アイテム配置設定
 */
export interface ItemPlacementConfig {
  minItems: number; // 最小アイテム数
  maxItems: number; // 最大アイテム数
  rarityDistribution: {
    // レアリティ分布
    common: number;
    uncommon: number;
    rare: number;
    legendary: number;
  };
  itemTypes: ItemType[]; // 使用可能なアイテムタイプ
  placementRules: ItemPlacementRule[]; // 配置ルール
}

// ============================================================
// 統合配置システム - 敵配置
// ============================================================

/**
 * 敵のタイプ
 */
export enum EnemyType {
  SCOUT = 'scout', // 偵察型（弱い、素早い）
  SOLDIER = 'soldier', // 兵士型（標準）
  HEAVY = 'heavy', // 重装型（強い、遅い）
  TURRET = 'turret', // タレット（固定、射程長い）
  BOSS = 'boss', // ボス
}

/**
 * 敵の行動パターン
 */
export enum EnemyBehavior {
  STATIC = 'static', // 静止
  PATROL = 'patrol', // 巡回
  GUARD = 'guard', // 警戒（プレイヤーを感知すると追跡）
  AGGRESSIVE = 'aggressive', // 積極的（常に追跡）
}

/**
 * 配置された敵の情報
 */
export interface PlacedEnemy {
  id: string; // 敵のID
  type: EnemyType; // 敵のタイプ
  x: number; // X座標
  y: number; // Y座標
  level: number; // レベル
  behavior: EnemyBehavior; // 行動パターン
  patrolRoute?: Vector3[]; // 巡回ルート（オプション）
  triggerCondition?: string; // 出現条件（オプション）
}

/**
 * 敵配置ルール
 */
export interface EnemyPlacementRule {
  roomType?: RoomType; // 特定の部屋タイプに配置
  minDistanceFromEntrance?: number; // 入口からの最小距離
  behavior?: EnemyBehavior; // 行動パターン
  density?: number; // 配置密度 (0-1)
}

/**
 * 敵配置設定
 */
export interface EnemyPlacementConfig {
  minEnemies: number; // 最小敵数
  maxEnemies: number; // 最大敵数
  difficultyLevel: number; // 難易度レベル (1-10)
  allowBoss: boolean; // ボスを配置するか
  enemyTypes: EnemyType[]; // 使用可能な敵タイプ
  placementRules: EnemyPlacementRule[]; // 配置ルール
}

// ========================================
// 特殊オブジェクト関連
// ========================================

/**
 * 配置されたポータル
 */
export interface PlacedPortal {
  id: string;
  x: number;
  y: number;
  destinationFloor?: number; // 行き先フロア（未指定なら次フロア）
  active: boolean; // アクティブかどうか
}

/**
 * 配置されたエネルギーチャージャー
 */
export interface PlacedCharger {
  id: string;
  x: number;
  y: number;
  chargeAmount: number; // 回復量
  maxUses: number; // 最大使用回数（-1で無限）
  remainingUses: number; // 残り使用回数
  rechargeTime?: number; // 再チャージ時間（ターン数）
}

// ============================================================
// インベントリシステム
// ============================================================

/**
 * アイテム効果タイプ
 */
export type ItemEffectType = 'heal' | 'energy' | 'stat_boost' | 'special';

/**
 * アイテム効果定義
 */
export interface ItemEffect {
  type: ItemEffectType;
  value?: number; // 回復量や上昇値
  statType?: 'strength' | 'defense' | 'maxHp' | 'maxEnergy'; // ステータスブースト用
  duration?: number; // 一時効果の持続時間（ターン数）
}

/**
 * インベントリアイテム情報
 */
export interface InventoryItem {
  id: string; // ユニークID
  type: InventoryItemType; // アイテムタイプ
  name: string; // 表示名
  description: string; // 説明文
  effect: ItemEffect; // 効果
  stackable: boolean; // スタック可能か
  quantity: number; // 所持数
}
