# マップ評価システム実装プラン

## 概要
マップ生成システムの品質を評価・改善するためのスタンドアロン評価環境を構築する。
ゲーム本体とは独立して動作し、マップ生成の品質を定量的・視覚的に評価できるようにする。

## 目標
- ステップ1: マップ生成単体を動作させる評価環境の構築
- 評価指標の定義と計測
- 複数マップの生成とデータ収集
- 結果の可視化とレポート生成

## ディレクトリ構造

```
src/tools/map-evaluation/
├── MapEvaluator.ts          # 評価指標の計測クラス
├── MapTester.ts             # マップ生成とテスト実行
├── evaluate-maps.ts         # CLIエントリーポイント
└── types.ts                 # 評価システム用の型定義
```

## 実装内容

### 1. 評価指標クラス (MapEvaluator.ts)

#### 初期評価指標

**致命的欠陥の検出**
- `connectivity`: 全タイルの到達可能性（flood fill）
- `roomCount`: 部屋数のチェック（最小/最大範囲内か）
- `unreachableAreas`: 到達不可能エリアの検出

**基本バラエティ**
- `roomSizeVariance`: 部屋サイズの分散
- `roomDistribution`: 部屋配置の偏り（中心からの距離分布）
- `corridorEfficiency`: 通路の効率性（総通路タイル / 最短経路タイル）

**視覚的確認**
- `asciiMap`: マップのASCII出力生成
- `statistics`: 基本統計情報（床/壁の比率など）

#### クラス構造
```typescript
interface EvaluationResult {
  isValid: boolean              // 致命的欠陥がないか
  score: number                 // 総合スコア (0-100)
  metrics: {
    connectivity: number        // 到達可能率 (0-1)
    roomCount: number
    roomSizeVariance: number
    corridorEfficiency: number
    // ... その他の指標
  }
  issues: string[]              // 検出された問題点
  statistics: MapStatistics
}

class MapEvaluator {
  evaluate(tileMap: TileMap): EvaluationResult
  private checkConnectivity(tileMap: TileMap): number
  private analyzeRooms(tileMap: TileMap): RoomAnalysis
  private generateAsciiMap(tileMap: TileMap): string
}
```

### 2. マップテスタークラス (MapTester.ts)

#### 機能
- 指定されたパラメータで複数マップを生成
- 各マップを評価
- 結果の集計と統計処理
- レポート生成

#### クラス構造
```typescript
interface TestConfig {
  generatorType: string         // 'tactical' | 'flexible'
  stageType?: string           // TacticalMapGenerator用
  iterations: number           // 生成回数
  seed?: number                // シード値
  mapSize: { width: number, height: number }
}

interface TestReport {
  config: TestConfig
  results: EvaluationResult[]
  aggregated: {
    averageScore: number
    successRate: number         // 有効なマップの割合
    metrics: {
      [key: string]: {
        min: number
        max: number
        avg: number
        stdDev: number
      }
    }
  }
  timestamp: string
}

class MapTester {
  runTest(config: TestConfig): TestReport
  private generateMap(config: TestConfig): TileMap
  private aggregateResults(results: EvaluationResult[]): AggregatedStats
  generateReport(report: TestReport): string
}
```

### 3. CLIエントリーポイント (evaluate-maps.ts)

#### コマンドライン引数
```bash
npm run evaluate-maps -- --type tactical --stage early --count 10
npm run evaluate-maps -- --type flexible --count 50 --output results.json
```

#### オプション
- `--type`: ジェネレータータイプ (tactical/flexible)
- `--stage`: ステージタイプ (early/mid/late/boss) ※tacticalのみ
- `--count`: 生成回数 (デフォルト: 10)
- `--seed`: シード値
- `--width`: マップ幅 (デフォルト: 80)
- `--height`: マップ高さ (デフォルト: 60)
- `--output`: 結果の出力先JSONファイル
- `--visualize`: ASCII可視化を表示 (デフォルト: true)

#### 出力形式
```
=== マップ評価レポート ===
生成日時: 2025-10-08 15:30:00
設定: TacticalMapGenerator (energy)
マップサイズ: 80x60
生成回数: 10

--- 集計結果 ---
成功率: 90% (9/10)
平均スコア: 75.3

--- 指標統計 ---
connectivity:
  平均: 0.98 (min: 0.95, max: 1.00, σ: 0.02)
roomCount:
  平均: 7.2 (min: 5, max: 9, σ: 1.3)
roomSizeVariance:
  平均: 45.8 (min: 32.1, max: 58.3, σ: 8.2)

--- 検出された問題 ---
- Map #3: 到達不可能エリアあり (2%)
- Map #7: 部屋数が少ない (3部屋)

[オプション: 各マップのASCII表示]
```

## 実装ステップ

### ステップ1: 基礎構造の作成 ✅
- [x] ディレクトリ作成
- [x] 型定義ファイル作成 (types.ts)
- [x] MapEvaluatorクラスの基本構造

### ステップ2: 評価指標の実装 ✅
- [x] 到達可能性チェック (flood fill)
- [x] 部屋分析 (サイズ、分散、配置)
- [x] ASCII可視化
- [x] 基本統計情報

### ステップ3: テスト実行システム ✅
- [x] MapTesterクラス実装
- [x] マップ生成ループ
- [x] 結果集計機能

### ステップ4: CLI実装 ✅
- [x] コマンドライン引数パース
- [x] レポート生成
- [x] JSONエクスポート

### ステップ5: npm scriptの追加 ✅
- [x] package.jsonにevaluate-mapsコマンド追加
- [x] ts-nodeとTypeScript型定義を追加

---

## 🎉 実装完了（2025-10-08更新）

すべての機能が実装され、型の不整合も修正されました！

### 作成されたファイル
- `src/tools/map-evaluation/types.ts` - 型定義
- `src/tools/map-evaluation/MapEvaluator.ts` - 評価ロジック
- `src/tools/map-evaluation/MapTester.ts` - テスト実行
- `src/tools/map-evaluation/evaluate-maps.ts` - CLIエントリーポイント

### 更新されたファイル
- `package.json` - ts-node, @types/nodeの追加、evaluate-mapsスクリプトの追加
- `src/engine/world/TileMap.ts` - Engine.instanceの安全なチェック追加（評価ツール対応）

### 修正された問題

1. **ステージタイプの型不整合**
   - TestConfigのstageTypeを実際のStageTypeに対応（energy/combat/stealth/resourceに変更）
   - StageType列挙型へのマッピング機能を追加

2. **Engine未初期化時のエラー**
   - TileMap.tsでEngine.instanceの存在チェックを追加
   - 評価ツールがエンジンなしで動作可能に

3. **無限ループの問題** ⚠️ 重要
   - FlexibleMapGeneratorとTacticalMapGeneratorの循環呼び出しを修正
   - `generate()`メソッドに`skipTactical`パラメータを追加
   - TacticalMapGeneratorから`super.generate(config, true)`で呼び出し
   - これにより無限再帰を防止

---

## 使用方法

### 1. 依存関係のインストール

まず、追加された依存関係をインストールします：

```bash
npm install
```

### 2. 評価ツールの実行

```bash
# デフォルト設定で実行（tactical, early, 10回生成）
npm run evaluate-maps

# ヘルプ表示
npm run evaluate-maps -- --help

# tacticalジェネレーター、energyステージ、10回生成
npm run evaluate-maps -- --type tactical --stage energy --count 10

# flexibleジェネレーター、50回生成、結果をJSONに保存
npm run evaluate-maps -- --type flexible --count 50 --output results.json

# ASCII可視化を有効にして5回生成
npm run evaluate-maps -- --type tactical --stage combat --count 5 --visualize true
```

### 3. 出力例

```
=== マップ評価テスト開始 ===
生成タイプ: tactical
ステージタイプ: energy
マップサイズ: 80x60
生成回数: 10

[1/10] マップ生成中...
  スコア: 75, 有効: はい, 問題: 0件
[2/10] マップ生成中...
  スコア: 68, 有効: はい, 問題: 0件
...

============================================================
マップ評価レポート
============================================================
生成日時: 2025/10/08 15:30:00
設定: tactical
  ステージタイプ: energy
マップサイズ: 80x60
生成回数: 10

--- 集計結果 ---
成功率: 90.0% (9/10)
平均スコア: 75.3

--- 指標統計 ---
接続性:
  平均: 0.98 (min: 0.95, max: 1.00, σ: 0.02)
部屋数:
  平均: 7.20 (min: 5.00, max: 9.00, σ: 1.30)
...
```

---

## 次のステップ

1. **実際に実行してみる**
   ```bash
   npm install
   npm run evaluate-maps -- --count 5 --visualize true
   ```

2. **結果を見ながら評価指標を検討**
   - 現在の指標で単調なマップが高スコアになっていないか確認
   - 面白いマップとつまらないマップの違いを分析
   - 必要に応じて新しい指標を追加

3. **評価指標のチューニング**
   - MapEvaluator.tsの重み付けを調整
   - 新しい指標を追加（以下の「将来の拡張指標案」を参照）

## 将来の拡張指標案（今回は実装しない）

以下は初期実装後、実際のマップを見ながら追加を検討:

**戦術的指標**
- エネミー配置の適切性
- カバーポイント数と配置
- エネルギー収支バランス
- 視線の通り具合

**面白さ指標**
- 探索の報酬（アイテム配置の質）
- サプライズ要素（隠し部屋など）
- リスクリターンバランス

**パフォーマンス指標**
- 生成時間
- メモリ使用量

## 依存関係
- 既存のTileMap、MapGenerator系クラス
- Node.jsのfs（ファイル出力用）
- コマンドライン引数パーサー（minimist等、必要に応じて）

## 注意事項
- ゲーム本体のコードに影響を与えない
- テスト用データは別ディレクトリに保存
- 評価指標は後から追加・調整しやすい設計にする
