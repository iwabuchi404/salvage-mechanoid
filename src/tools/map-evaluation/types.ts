// マップ評価システム用の型定義

/**
 * マップの基本統計情報
 */
export interface MapStatistics {
  totalTiles: number;
  floorTiles: number;
  wallTiles: number;
  floorRatio: number;
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * 部屋の分析結果
 */
export interface RoomAnalysis {
  roomCount: number;
  averageRoomSize: number;
  roomSizeVariance: number;
  roomSizes: number[];
  roomPositions: Array<{ x: number; y: number }>;
}

/**
 * 評価指標の計測値
 */
export interface EvaluationMetrics {
  connectivity: number; // 到達可能率 (0-1)
  roomCount: number; // 部屋数
  roomSizeVariance: number; // 部屋サイズの分散
  roomDistribution: number; // 部屋配置の偏り度 (0-1, 低いほど良い)
  corridorEfficiency: number; // 通路効率 (0-1, 高いほど良い)
}

/**
 * 配置情報の統計
 */
export interface PlacementStatistics {
  obstacleCount: number;
  itemCount: number;
  enemyCount: number;
  itemsByRarity?: {
    common: number;
    uncommon: number;
    rare: number;
    legendary: number;
  };
  enemiesByType?: {
    scout: number;
    soldier: number;
    heavy: number;
    turret: number;
    boss: number;
  };
}

/**
 * マップ評価の結果
 */
export interface EvaluationResult {
  isValid: boolean; // 致命的欠陥がないか
  score: number; // 総合スコア (0-100)
  metrics: EvaluationMetrics;
  issues: string[]; // 検出された問題点
  statistics: MapStatistics;
  placement?: PlacementStatistics; // 配置情報
  asciiMap?: string; // ASCII形式のマップ
}

/**
 * テスト設定
 */
export interface TestConfig {
  generatorType: 'tactical' | 'flexible';
  stageType?: 'energy' | 'combat' | 'stealth' | 'resource'; // tactical用（簡略化された名前）
  iterations: number; // 生成回数
  seed?: number; // シード値
  mapSize: {
    width: number;
    height: number;
  };
  visualize?: boolean; // ASCII可視化を出力するか
}

/**
 * 指標の統計情報
 */
export interface MetricStats {
  min: number;
  max: number;
  avg: number;
  stdDev: number;
}

/**
 * 集計された評価結果
 */
export interface AggregatedStats {
  averageScore: number;
  successRate: number; // 有効なマップの割合 (0-1)
  metrics: {
    [K in keyof EvaluationMetrics]: MetricStats;
  };
}

/**
 * テストレポート
 */
export interface TestReport {
  config: TestConfig;
  results: EvaluationResult[];
  aggregated: AggregatedStats;
  timestamp: string;
}
