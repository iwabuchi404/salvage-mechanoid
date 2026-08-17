# テスト層戦略

最終更新: 2026-08-17

対象コミット: BU-4 完了時点（作業ツリー）

関連文書:

- `docs/TESTING_ROADMAP.md`（機能別カバレッジのチェックリスト。本文書とは役割が異なる。§11 参照）
- `docs/BRUSHUP_PLAN.md`（BU-1〜BU-4 の統合ブラッシュアッププラン）

## 1. 目的

本文書は「**どのテストを、どの層に置くか**」の判断基準を定める。

これまで、テストの追加は機能単位（`docs/TESTING_ROADMAP.md`）で管理してきた。しかし R0〜BU-4 のリファクタリングを通じて、**ユニットテストが緑のまま実ゲームが壊れている**という事象が繰り返し発生した。原因はカバレッジ不足ではなく、次の2つだった。

1. 単体で足りるはずの検証が、**実ゲームと乖離したフィクスチャ**で書かれていた
2. System 間の結線を検証する層が**存在しなかった**

本文書はこれを是正し、層の責務と配置ルールを固定する。

## 2. 現在の基準線

- TypeScript 型検査: 成功
- Jest（単体＋結合）: **77 スイート、784 件**成功
- Playwright E2E: 6 件
- 本番ビルド: 成功
- 全テスト出力に `Error in event listener` が現れない

## 3. 原則

**担保できる最も下の層でテストする。**

上の層は下の層で担保できないものだけを扱う。上の層は遅く、壊れやすく、原因の特定が難しいため、意図的に薄く保つ。

```text
        E2E（薄い）          起動・描画・DOM・ブラウザ入力
      ─────────────
      結合（厚い）           System 間の結線・イベント契約・状態の往復
    ─────────────────
    単体（最も厚い）          純粋関数・単一クラスの契約
```

## 4. 三層の定義

### 4.1 単体テスト（`tests/unit/`）

**対象**: 純粋関数、単一クラスの公開 API とその契約。

**依存の扱い**: 依存は与えない、またはモックする。`Engine.instance` をモックする程度は許容する。

**例**（既存）:

- `resolveStats.spec.ts` — 修飾子の適用順序
- `EnemyStatProfile.spec.ts` — EnemyType → ステータスの写像
- `FOVCalculator.spec.ts` — 視界計算アルゴリズム
- `Doorway.spec.ts` の前半 — `detectDirection` / `validateDoorways` などの純粋関数
- `ActionCostTable.spec.ts` — 行動コストの定義

**この層で守るべきもの**: 計算式、境界値、フォールバック、不正入力の扱い。

### 4.2 結合テスト（`tests/integration/`）

**対象**: 複数の System / Component を**実物のまま結線**したときの挙動。

**依存の扱い**: `EventSystem` / `EntitySystem` / `WorldSystem` などを実インスタンスで組む。マップは**固定 `TileMap` を直接注入**し、生成器は通さない。

**この層で守るべきもの**:

- イベントの発行者と購読者が噛み合うこと（ペイロード契約の実地検証）
- 同じイベントに複数の System が反応したときの重複・競合
- 状態がドメイン → 投影 → ストアへ往復して壊れないこと
- 破棄・再初期化でリスナーや状態が残らないこと
- ターン進行・入力・行動実行の連鎖

**判断基準**: 「2つ以上の実物を結線しないと再現しない不具合」はこの層に属する。

### 4.3 E2E テスト（`tests/e2e/`）

**対象**: ブラウザ上で実際に起動し、描画され、DOM 経由で操作できること。

**この層でしか守れないもの**:

- アプリが起動し、致命的な console error / pageerror が出ない
- PIXI canvas が生成され、サイズを持つ
- Vue コンポーネントとストアの結線が生きている
- キーボード/クリック入力が `InputSystem` まで届く

**この層に置かないもの**: ゲームロジック、ターン計算、ステータス計算、AI の判断。これらはすべて結合層以下で担保する。

### 4.4 アーキテクチャ制約テスト（`tests/unit/` に配置）

ソースコードを読み取り、依存方向や契約の網羅性を検証する特殊なテスト。層としては単体に置く。

**既存**:

- `DomainRenderingIndependence.spec.ts` — `Player.ts` / `Item.ts` が `pixi.js` / `RendererSystem` を import しない
- `PlayerImportGuard.spec.ts` — `Player.ts` が `stores/` を import しない
- `EventMapCoverage.spec.ts` — `emit` される全イベントが `EventMap` に宣言されている / 孤児リスナーが無い

このカテゴリは、リファクタリングで得た構造を**退行から守る**ために有効である。今後も境界を作るたびに追加する。

## 5. 層の判断: 過去の不具合による検証

R0〜BU-4 で発見された不具合を、捕まえられる最下層へ割り当てる。

| # | 不具合 | 最下層 | すり抜けた理由 |
| --- | --- | --- | --- |
| 1 | `'floor'` 比較が常に false（ポータル未生成） | 単体 + 生成不変条件 | テストが存在しなかった |
| 2 | `ENTITY_MOVED` の二重ペイロード契約 | **結合** | System を個別にしかテストしていなかった |
| 3 | `applyStatBoost` の二重計上 | 単体 | フィクスチャが実構成と乖離（base 100・修飾子なし） |
| 4 | `strength` → `attackPower` の不伝播 | 単体 | 同上 |
| 5 | gameStore 往復で攻撃力が累積 | **結合** | 層が存在しなかった |
| 6 | `TurnSystem` と `TurnScheduler` の二重動作 | **結合** | 両方を同時に登録するテストが無かった |
| 7 | 移動失敗で入力デッドロック | **結合** | Scheduler と InputSystem を結線していなかった |
| 8 | 行動速度の単位系不一致（2〜6 vs 100） | 単体 | テストが 100/200/300 を手で指定していた |

**E2E でしか捕まえられないものは 1 件も無い。**

不具合は2種に分かれる。

- **フィクスチャの問題**（#3 #4 #8）— 層は正しかったが、実ゲームと違う値でテストしていた
- **層の欠落**（#2 #5 #6 #7）— 結合層が存在しなかった

## 6. ランダム性の扱い

### 6.1 現状

- `Math.random()` の直接呼び出しが **89 箇所 / 20 ファイル**に散在する（通路生成、特徴配置、Enemy/Item/Obstacle 配置、戦術要素、ポータル配置など）
- シード付き擬似乱数は `BaseGenerator.random()` にのみ存在する
- **シードは呼び出し元から一度も渡されていない**（`new BSPGenerator(w, h)` の形。`seed || Date.now()` にフォールバック）

したがって「シードを固定すれば決定論になる」は成立しない。全面的な seeded RNG 化は独立した課題である（§10）。

### 6.2 層ごとの方針

| 層 | ランダム性の扱い |
| --- | --- |
| 単体 | そもそも無関係。値を直接渡す |
| 結合 | **固定 `TileMap` を注入して排除する**。生成器を通さない |
| 生成不変条件 | 排除せず、N 回生成して**不変条件**を検証する |
| E2E | 排除できない。決定論を要求しない検証だけを行う |

**重要**: E2E で「マップがランダムだから固定入力のシナリオが書けない」という問題は、**UI 経由でテストしようとしたことの副作用**である。結合層では次のように固定マップを直接構築でき、シード基盤を必要としない。

```ts
const map = new TileMap(10, 10);
for (let y = 0; y < 10; y++)
  for (let x = 0; x < 10; x++)
    map.setTileAt(x, y, 0, TileType.TILE, true);
const worldSystem = new WorldSystem(map);
```

この形式は既に `FloorManager.spec.ts` / `EntityMovedContract.spec.ts` などで使われている。

### 6.3 生成器の不変条件テスト

生成器はランダム性が本質のため固定できない。代わりに N 回生成して次を検証する。

- 全 Room が Doorway 経由で連結している
- Doorway が Room 境界かつ通行可能タイル上にある
- **床タイルが1枚以上存在する**（不具合 #1 の回帰防止）
- 各 StageType で生成が成功する

既存の `Doorway.spec.ts` の「generated map Doorway consistency」がこの形式である。

失敗時の再現用にシードがあると望ましいが、**必須ではない**。不変条件が破れていれば N 回のうちいずれかで失敗する。

## 7. 現状の課題

### 7.1 結合テストが `tests/unit/` に混在している

実インスタンスを結線しているテストが既に多数存在する。

| ファイル | 結線している実物 |
| --- | --- |
| `world/RoomData.spec.ts` | WorldSystem / EntitySystem / EventSystem |
| `world/FloorManager.spec.ts` | FloorManager / WorldSystem / EntitySystem / Player |
| `world/WorldSystem.spec.ts` | WorldSystem / EntitySystem |
| `world/Doorway.spec.ts`（後半） | WorldSystem + 実生成器 |
| `world/TileEffectTurnBased.spec.ts` | WorldSystem / EventSystem |
| `entity/EntityMovedContract.spec.ts` | EventSystem / EntitySystem / WorldSystem / Movement |
| `entity/EnemyAI.spec.ts` | Enemy / Strategy / ActionContext |
| `entity/stats/StatsPropagation.spec.ts` | StatsComponent / Health / Energy |
| `items/HealItemIntegration.spec.ts` | StatsComponent / HealthComponent / gameStore |
| `combat/CombatStatsIntegration.spec.ts` | CombatSystem / EntitySystem / StatsComponent |
| `game/GameInitialization.spec.ts` | Game 全体 |
| `game/RetryAttackPowerAccumulation.spec.ts` | gameStore ↔ config 往復 |
| `turn/TurnScheduler.spec.ts` ほか | TurnScheduler / EntitySystem / EventSystem |
| `factory/EntityFactory.spec.ts` | 各 Factory / EntitySystem |

**結合テストは既に書かれているが、単体と混在しているため「何が結合層で守られているか」が把握できない。** その結果、BU-3 で `TurnSystem` と `TurnScheduler` を両方登録する結合テストが欠けていることに気づけなかった（不具合 #6）。

### 7.2 フィクスチャが実構成と乖離している

不具合 #3 #4 #8 の原因。次を原則とする（§9）。

### 7.3 E2E の操作カバレッジ

現在の6件のうち5件は「画面が出るか / エラーが出ないか」の起動確認のみ。E-1（1件）はキーボード入力でプレイヤーが移動し、HUD の位置表示と Energy 表示が変化することを検証している。残り5件はブラウザ入力から描画までの結線を確認していないため、今後拡充が必要。

## 8. 移行計画

### 段階 1: ディレクトリ分離

```text
tests/
  unit/         純粋関数・単一クラス・アーキテクチャ制約
  integration/  System 結線・固定マップ注入
  e2e/          起動・描画・DOM
```

`jest.config.js` の `testMatch` が両方を拾うことを確認する。§7.1 の表のファイルを `tests/integration/` へ移動する。**移動のみで中身は変更しない。**

`Doorway.spec.ts` は純粋関数部分と生成器統合部分が同居しているため、分割する。

**完了条件**: 全 752 件が移動後も成功する。

### 段階 2: 結合テストの追加

E2E で計画していた検証を結合層へ降ろす。

| ID | 内容 | 防ぐ不具合 |
| --- | --- | --- |
| I-1 | 固定マップ + TurnScheduler + InputSystem。1入力でターンが 1 だけ進む | #6（二重進行） |
| I-2 | 30 手連続入力してもループが停止せず、エラーが出ない | 無限ループ・停止漏れ |
| I-3 | 移動失敗の直後でも次の入力が受け付けられる | #7（デッドロック） |
| I-4 | 固定マップ 2 フロアを登録し、遷移で HP 保持・エネルギー +20 | R0 の契約 |
| I-5 | `uiPanelStore.inputBlocked` → `InputSystem` の入力遮断 | BU-4 の結線 |
| I-6 | ドメイン変化 → `StatsProjection` → `gameViewStateStore` の往復 | #5 の層 |
| I-7 | `Game.reset()` → 再初期化で状態が初期値へ戻り、リスナーが残らない | #5、パネル残存 |

**I-1 は特に重要**である。「1入力でターンがちょうど 1 進む」という不変条件は、ターン進行に関わる System が二重に反応した場合に必ず破れる。

### 段階 3: 生成不変条件テストの追加

| ID | 内容 | 防ぐ不具合 |
| --- | --- | --- |
| G-1 | 全 StageType で生成し、床タイルが 1 枚以上ある | #1 |
| G-2 | 生成マップから資源を配置し、`event_object`（ポータル）が 1 体以上 | #1 の本丸 |
| G-3 | 全 Room が Doorway 経由で連結している（既存を拡張） | 生成器の退行 |
| G-4 | Doorway が通行可能タイル上にある（既存を拡張） | 同上 |

各テストは N 回（例: 10 回）繰り返して不変条件を検証する。

### 段階 4: E2E の最小追加

段階 2〜3 で下層を固めた後、E2E に残すのは**ブラウザ固有の結線**のみ。

| ID | 内容 |
| --- | --- |
| E-1 | 開始後、キーボード入力でプレイヤーが動き、HUD の表示が変化する |

これに必要な `data-testid` は HUD の HP / エネルギー表示程度で済む。方向ボタン多数への付与や大規模なデバッグフックは**不要**。

既存の 5 件は起動時エラー検出として維持する。

## 9. フィクスチャの原則

不具合 #3 #4 #8 の再発を防ぐため、次を守る。

1. **実ゲームと同じ構成でテストする。** `StatsComponent` のテストは実際と同じ「基礎値 0 + PartsSystem の add 修飾子」で書く。基礎値に実効値を直接置かない
2. **実データを参照する。** 速度差テストは `resolveEnemyStats(EnemyType.SCOUT, 1).actionSpeed` を使い、`100` / `200` を手で書かない
3. **プロファイル値そのものを固定するテストを別に持つ。** 変換式を再計算するテストだけでは、元データの変更を検出できない
4. **テスト側にロジックをコピーしない。** 実装コードを直接呼ぶ。`RetryAttackPowerAccumulation.spec.ts` は Game のロジックをテスト側で再現しているため、段階 2 で実コード経由へ差し替える

## 10. スコープ外・別課題

### seeded RNG 化

`Math.random()` の 89 箇所を seeded RNG へ置き換え、シードを生成器へ配線する作業。

**本テスト戦略の前提ではない**（§6.2 のとおり結合層は固定マップで足りる）。ただし次の機能を実装する際には必要になる。

- セーブ / ロード（同じフロアの再現）
- リプレイ
- マップ評価ツールの再現性
- 生成不変条件テストの失敗再現

着手する場合は独立したプランとして計画する。

### その他

- カバレッジ率の目標設定（本文書では扱わない）
- ビジュアルリグレッションテスト
- パフォーマンステスト

## 11. `docs/TESTING_ROADMAP.md` との関係

| 文書 | 役割 |
| --- | --- |
| `TESTING_STRATEGY.md`（本文書） | **どの層に置くか**の判断基準と移行計画 |
| `TESTING_ROADMAP.md` | **何をテストするか**の機能別チェックリスト |

`TESTING_ROADMAP.md` は 2026-08-11 時点（R0 着手前）のもので、基準線が「28 スイート / 295 件」のまま更新されていない。項目の多くは R0〜BU-4 で完了しているが、チェックが更新されていない。

段階 1 完了後に、`TESTING_ROADMAP.md` を次のとおり更新する。

- 基準線を現在値へ更新する
- 完了済み項目にチェックを入れる
- 各項目へ想定する層（単体 / 結合 / 生成 / E2E）を付記する
- BU-1〜BU-4 で追加された対象（EventMap、StatsComponent、TurnScheduler、UI 境界）の項目を追加する

## 12. 検証ゲート

### 通常コミット

- `npx tsc --noEmit`
- 変更対象の層のテスト
- `git diff --check`

### 各段階完了

- 全層のテスト（単体 + 結合）
- 本番ビルド
- 全テスト出力に `Error in event listener` が現れないこと

### リリース前 / 大きなリファクタリング完了時

- 全層 + E2E
- 手動確認（ゲーム開始、移動、攻撃、アイテム取得、フロア遷移）

## 13. 未決事項

1. 結合テストの実行時間が伸びた場合、CI で層を分けて実行するか
2. 生成不変条件テストの繰り返し回数（10 回で十分か、CI では増やすか）
3. `Doorway.spec.ts` の分割単位（純粋関数 / WorldSystem 統合 / 生成器統合の 3 分割とするか）
4. seeded RNG 化に着手する時期（セーブ機能の実装と同時か、先行するか）
