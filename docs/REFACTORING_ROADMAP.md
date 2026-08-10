# リファクタリング実装ロードマップ

最終更新: 2026-08-11  
基準コミット: `40263ef`（フロア遷移とイベント破棄の境界を修正）

## 1. 目的

今後の Room、スキャン、部屋ロック、敵タイプ拡張を安全に追加できるよう、現在の大きなクラスと暗黙の依存を段階的に分離する。

この計画では、各段階を独立したコミットとして完了できること、途中で止めてもゲームが動作すること、既存の挙動をテストで維持することを優先する。

## 2. 現在の基準線

2026-08-11 時点で次を確認済み。

- TypeScript 型検査成功
- ユニットテスト: 28 スイート、295 件成功
- 本番ビルド成功
- Playwright E2E: 5 件成功
- `WorldSystem` は単一インスタンスでフロア別データを保持
- `floor_changed` は新フロアの生成・登録完了後に発行
- `EventSystem.destroy()` で旧リスナーと未配送イベントを破棄
- Enemy 描画境界、Enemy AI、FloorManager、Room 接続の基礎テストが存在
- `TURRET` は EnemyType から削除済みだが、`Enemy.ts` に未使用の Graphics・FOV 購読コードが残っている

現在の主な責務集中箇所は次のとおり。

| 対象             | 現在の規模 | 集中している責務                                              |
| ---------------- | ---------: | ------------------------------------------------------------- |
| `Game.ts`        | 約 1120 行 | システム構築、Entity 生成、マップ生成、イベント、画面向け API |
| `Enemy.ts`       |  約 830 行 | データ、ステータス、AI、移動、攻撃要求、PIXI 描画、FOV、破棄  |
| `WorldSystem.ts` |  約 830 行 | フロア、マップ、経路探索、衝突、Room/Corridor                 |
| `FOVSystem.ts`   |  約 500 行 | 視界計算、遮蔽、探索状態、Entity 可視性イベント               |
| `Sprite.ts`      |  約 340 行 | テクスチャ、PIXI Sprite、位置同期、FOV、Renderer 登録         |

## 3. 確定している制約

AI Cortex の現行仕様と現在の実装から、次を維持する。

- `Engine` が全システムのライフサイクルを管理する
- `EntitySystem` が Entity と Component を管理する
- PixiJS 固有処理は描画側へ集約する
- `WorldSystem` はタイルマップ、ナビゲーション、経路探索を担当する
- システム間通信は `EventSystem` を利用する
- 論理座標はタイル単位、描画座標は `CoordinateSystem` で変換する
- 階層移動時のエネルギー回復は +20、最大値を超えない
- 雑魚敵、中ボス、ボスで将来的にデータ構造を拡張できること

## 4. 計画上の提案

以下はまだ仕様ではなく、実装を進めるための提案である。

### 4.1 目標とする依存方向

```text
Game（起動・ユースケースの調整）
  ↓
Factory / Application Service（生成・組み立て）
  ↓
Entity / Component / Domain Model（ゲーム状態と規則）
  ↓
System Port（World照会、イベント通知などの小さな境界）

Presentation / Renderer（PixiJS）
  ↑ 状態を読む、または表示用イベントを受け取る
Domain Model
```

ドメイン側から PixiJS のクラスや `RendererSystem` を直接参照しない状態を目標とする。

### 4.2 実装単位の原則

- 1 コミットでは 1 つの責務境界だけを変更する
- 公開 API やイベントを変える場合は、先に契約テストを追加する
- 新旧経路を一時的に併存させ、移行完了後に旧経路を削除する
- `Engine.instance` の一括排除は行わず、変更対象ごとに依存を注入する
- ファイル分割そのものを完了条件にせず、依存方向と所有権で判定する

## 5. 実装フェーズ

### R0: フロア遷移の失敗契約を固定する

**目的**: 大きなリファクタリング前に、現在残っている P0 の失敗経路を閉じる。

**対象**:

- `FloorManager`
- `Game.regenerateFloor`
- `WorldSystem` のフロア切替
- FloorManager / Game 統合テスト

**作業**:

1. フロア生成処理が例外になった場合の期待結果をテストで固定する
2. `floor_generated` と `floor_changed` を失敗時に発行しないことを確認する
3. 現在階、プレイヤー状態、現在表示中の World を不整合にしない
4. 生成処理と現在階を確定する処理の境界を明示する
5. エラーを呼び出し元へ返す方法を統一する

**未決事項**:

- 生成失敗時に旧フロアへ留まるか、専用エラー状態へ遷移するか
- 新フロア生成中に削除した Enemy/Item を復元対象に含めるか

**推奨案**:

旧フロアを維持し、生成結果を一時データとして完成させてから現在階を切り替える。Entity の削除はコミット直前まで行わない。

**完了条件**:

- 生成失敗後も `FloorManager` と `WorldSystem` の現在階が一致する
- 失敗時にプレイヤー、旧マップ、旧 Entity が利用可能
- 成功時の HP 保持とエネルギー +20 が維持される
- 失敗テスト、全ユニット、ビルド、E2E が成功する

**想定コミット数**: 1〜2

---

### R1: Enemy の描画デッドコードを除去し、表示設定を純粋データへ分離する

**目的**: 削除済み EnemyType に由来する処理を除去し、実在する EnemyType と表示資産の対応を副作用のないデータへ分離する。

**追加候補**:

- `src/engine/presentation/enemy/EnemyVisualProfile.ts`
- `tests/unit/presentation/EnemyVisualProfile.spec.ts`

**作業**:

1. `TURRET` が現行 EnemyType に存在せず、`createTurretGraphics()` が到達不能であることをテストと参照検索で確認する
2. 未使用の TURRET Graphics、FOV 購読、位置・可視性更新、破棄処理を削除する
3. EnemyType ごとの方向別テクスチャを `EnemyVisualProfile` へ移す
4. アンカーとレイヤーも同じプロファイルで表現する
5. 未知の EnemyType に対するフォールバックを固定する
6. `Enemy` の `texturePaths`、`setupTexturePathsForType()`、`getTexturePath()` を削除する

**完了条件**:

- 表示設定が PixiJS オブジェクトを含まない
- EnemyType から表示設定を純粋関数で取得できる
- 現在の SCOUT/SOLDIER/HEAVY の表示資産が変わらない
- Enemy ごとの不要な `entity_visibility_changed` 購読が 1 件減る
- Enemy AI テストを PixiJS 初期化なしで実行できる範囲が増える

**想定コミット数**: 1〜2

---

### R2: Enemy から描画ライフサイクルを分離する

**目的**: `Enemy` をゲーム状態と行動に限定し、PixiJS・Renderer・表示イベントの所有権を描画側へ移す。

**追加候補**:

- `EnemyPresentationComponent` または `EnemyPresentation`
- `EnemyPresentationFactory`
- `EnemyVisualProfile`

**描画側へ移す責務**:

- `SpriteComponent` の生成と初期化
- 方向変更時のテクスチャ切替
- Transform から描画座標への同期
- FOV と active 状態による可視性制御
- Renderer レイヤーへの追加・削除
- 描画イベント購読の解除と PixiJS オブジェクトの破棄

**Enemy に残す責務**:

- EnemyType、Behavior、Level
- Health、Movement、Transform などのゲーム状態
- 方向と行動結果
- 攻撃や移動を要求するドメイン上の判断

**移行手順**:

1. 現行 `EnemyRendering.spec.ts` を Presentation の契約テストとして再利用できる形へ整理する
2. 方向変更と FOV 購読を Presentation へ移す
3. Enemy 生成時に Factory が表示コンポーネントを組み立てる
4. `Enemy.ts` から `pixi.js` と `RendererSystem` import を削除する
5. 旧描画フィールドと破棄処理を削除する

**完了条件**:

- `Enemy.ts` が PixiJS と RendererSystem を参照しない
- Enemy を RendererSystem なしで初期化し、AI テストできる
- Presentation 単体で方向、FOV、active、destroy を検証できる
- Enemy 破棄時に Sprite とイベント購読が残らない
- 画面上の見た目と E2E の起動経路が変わらない

**想定コミット数**: 2〜3

**第 1 レビューゲート**:

R0〜R2 完了時点で設計レビューを行う。ここで Presentation を Component として維持するか、専用 System へ昇格させるか判断する。

---

### R3: Enemy AI を Strategy へ分離する

**目的**: EnemyType や描画変更から AI ロジックを独立させ、敵行動の追加を局所化する。

**追加候補**:

- `EnemyBehaviorStrategy`
- `StaticBehavior`
- `PatrolBehavior`
- `GuardBehavior`
- `AggressiveBehavior`
- `EnemyActionContext`

**作業**:

1. 現在の AI 分岐と状態を振る舞いごとに分類する
2. `EnemyBehaviorStrategy` の最小インターフェースを定義する
3. STATIC と PATROL を先に移し、次に GUARD と AGGRESSIVE を移す
4. World 照会、Entity 照会、攻撃要求を `EnemyActionContext` 経由にする
5. AI から `Engine.instance` の直接参照を除去する
6. 移動・攻撃待ちのタイムアウトを共通処理へ集約する

**完了条件**:

- 新しい Behavior を `Enemy.ts` の switch 変更なしで追加できる
- Strategy 単体テストで World、Player、攻撃要求を差し替えられる
- PATROL の index・折返し・待機状態の所有者が明確になる
- 既存 Enemy AI テストの振る舞いを維持する

**想定コミット数**: 3〜5

---

### R4: Entity 生成とライフサイクルを Game から分離する

**目的**: `Game` を起動とユースケース調整に限定し、Entity の具体的な組み立てを Factory へ移す。

**追加候補**:

- `EnemyFactory`
- `ItemFactory`
- `ObstacleFactory`
- `ResourceEntityRegistrar`

**作業**:

1. `Game.registerResourceEntities()` の生成規則を種類ごとに分離する
2. Enemy 本体と Presentation の組み立てを `EnemyFactory` に集約する
3. ItemType から InventoryItemType への変換を Item 生成側へ移す
4. 初期化失敗時に部分登録された Entity を残さない
5. Entity 登録・破棄・再初期化の所有者を明文化する
6. `Game` は生成結果を受け取り `EntitySystem` へ登録するだけにする

**完了条件**:

- Game が Enemy/Item/Obstacle の内部構成を知らない
- Factory 単体テストで Entity 構成を検証できる
- 初期化失敗時に Sprite やイベント購読が残らない
- Game 再初期化テストが維持される

**想定コミット数**: 2〜3

**第 2 レビューゲート**:

R3〜R4 完了時点で、Enemy・Game の責務と Factory 粒度を確認する。Factory の共通化は重複が実測できた場合だけ行う。

---

### R5: フロアと Room を一つのデータ境界へまとめる

**目的**: Room ロック、スキャン、フロア再訪に必要なデータを、複数 Map へ分散させず一単位で扱えるようにする。

**追加候補**:

- `FloorSnapshot` または `FloorState`
- `RoomId`
- `Doorway`
- `RoomConnection`

**作業**:

1. TileMap、Room、Corridor、TacticalElement をフロア単位の値にまとめる
2. `WorldSystem.registerFloor()` をフロアデータ 1 個を受け取る API へ寄せる
3. Room ID の生成・保持規則を固定する
4. Doorway を座標、向き、接続元 Room、接続先 Room で表現する
5. Room 接続グラフとタイル上の Corridor の整合性を検証する
6. WorldSystem 内の経路探索と Room 管理を内部モジュールへ分ける

**完了条件**:

- フロア登録時に Room/Corridor/TacticalElement が常に同じ世代になる
- フロア切替後も各階の Room と Doorway が独立して保持される
- 必須 Room が孤立せず、Doorway が境界と通行可能タイル上にある
- Room ロック状態を追加できる安定した ID が存在する

**想定コミット数**: 3〜5

---

### R6: FOV と Interaction を Room・Presentation へ接続する

**目的**: スキャン拡張と部屋ロックの前提となる、可視性と操作対象の共通ルールを作る。

**作業**:

1. 視界計算を副作用のない計算部分とイベント反映部分へ分ける
2. 可視性が変化した Tile/Entity だけイベントを発行する
3. Enemy、Item、EventObject へ同じ可視性規則を適用する
4. Presentation は FOV の結果だけを受け取り、視界計算を知らないようにする
5. Interaction の候補抽出と、ポータル・チャージャーなどの効果実行を分離する
6. Room ID を可視性・スキャン情報へ関連付けられるようにする

**完了条件**:

- 壁、マップ外、別階層を不可視として扱う
- 変化のない Entity へ可視性イベントを再送しない
- 隣接・射程・active 状態に基づいて操作候補を取得できる
- Enemy 表示の変更が FOV アルゴリズムへ影響しない
- スキャンで Room・Enemy 情報を追加できる境界がある

**想定コミット数**: 3〜4

**第 3 レビューゲート**:

R5〜R6 完了時点で、Room ロックとスキャン機能の仕様化へ進むか確認する。ここから先はリファクタリングではなく機能追加を含む。

---

### R7: 拡張フェーズ

R0〜R6 完了後、次の機能を独立して追加できる状態を目標とする。

1. Room ロックと解除条件
2. HEAD パーツによるスキャン範囲・敵情報表示
3. 雑魚敵、中ボス、ボスのデータ差
4. 中ボス・ボスへの Parts 構成適用
5. Room 種別に応じた Enemy・Item 配置規則
6. フロア再訪と探索状態の保持

これらの詳細は機能仕様の確認後に別計画へ分ける。

## 6. 推奨実行順

```text
第1バッチ: R0 → R1 → R2
  フロア失敗境界とEnemy描画分離

第2バッチ: R3 → R4
  Enemy AIとEntity生成の分離

第3バッチ: R5 → R6
  Roomデータ境界とFOV/Interaction接続

拡張判断: R7
  Roomロック、スキャン、敵タイプ拡張
```

最初の実装対象は R0 とし、R0 完了後に R1〜R2 を連続して進める。

## 7. 各コミットの検証ゲート

各コミットで最低限、変更対象の型検査と対象ユニットテストを実行する。

### 通常コミット

- `npx tsc --noEmit`
- 変更対象のユニットテスト
- `git diff --check`

### 各フェーズ完了

- ユニットテスト全件
- 本番ビルド
- 関連する lint エラーがないこと

### R0、R2、R4、R6 のレビューゲート

- Playwright E2E 5 件
- ゲーム開始、Enemy 表示、移動、フロア遷移の手動確認
- destroy 後のイベント購読、PixiJS オブジェクト、Entity 参照の確認

## 8. 中断・ロールバック方針

- 各フェーズの途中では旧 API を残し、移行先がテストを通ってから削除する
- 旧 API 削除は移行コミットと分離する
- 1 つのコミットで Enemy 描画と Enemy AI を同時に変更しない
- World/Room 変更中は既存 Floor API の互換アダプタを維持する
- E2E 失敗時は次フェーズへ進まず、最後に成功したフェーズを基準線とする

## 9. スコープ外

この計画では次を同時に行わない。

- 新しい画像・音声資産の制作
- ゲームバランス調整
- 武器耐久度やセットボーナスの仕様決定
- 全 System からの `Engine.instance` 一括排除
- EventSystem の全面的な型付きイベントバス化
- RendererSystem や WorldSystem の全面再実装

必要になった時点で、対象フェーズに限定した別計画を作る。

## 10. 未決事項

実装前または各レビューゲートで確認が必要。

1. フロア生成失敗時のユーザー向け挙動
2. Enemy Presentation を Component とするか専用 System とするか
3. Room ID を生成時固定とするか、フロア番号を含む永続 ID とするか
4. フロア再訪時に Enemy・Item 状態まで保存するか
5. Room ロックとスキャンの優先順位

`decisions` や `spec` へ反映するのは、ユーザー確認後とする。

## 11. 関連文書

- `docs/TESTING_ROADMAP.md`
- `docs/RENDERING_ENGINE_DESIGN.md`
- AI Cortex: `projects/salvage-mechanoid/context`
- AI Cortex: `projects/salvage-mechanoid/spec`
