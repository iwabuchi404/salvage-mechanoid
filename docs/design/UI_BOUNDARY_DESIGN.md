# BU-4: Game ↔ UI 境界の再設計 — 設計ドキュメント

最終更新: 2026-08-16

親プラン: `docs/BRUSHUP_PLAN.md`

## 1. 目的

UI をひとつ増やすたびに `Game.ts` / `uiStore.ts` / `GameScreen.vue` の3ファイルを編集する構造になっている。パネルの重なり順・排他制御・入力ブロックの概念が無く、UI が増えるほど衝突する。

本フェーズでは、**Game の公開面を「コールバック setter の束」から「状態の購読」へ変え**、UI 側にパネル管理の共通機構を1つ用意する。

## 2. 現状の構造と問題

### 2.1 UI へ情報を出すたびに Game のメソッドが増える

`Game` が UI へ露出しているのは5本のコールバック setter である。

| メソッド | 用途 |
| --- | --- |
| `setOnGameOver(cb)` | ゲームオーバー通知 |
| `setOnTileSelect(cb)` | タイル選択通知 |
| `setOnEnemySelect(cb)` | 敵選択通知 |
| `setOnCharacterSelect(cb)` | キャラクター選択通知 |
| `setOnTurnChange(cb)` | ターン切替通知 |

新しい情報を UI へ出すには `Game` にフィールドとメソッドを1組ずつ足すことになる。この形はスケールしない。

さらに `Game.getEventSystem()` が UI へ `EventSystem` そのものを渡しており（`GameScreen.vue` が `direction_changed` を直接購読している）、境界としては「すべて筒抜け」と「5本の細い口」が同居している状態になっている。

### 2.2 UI 状態が2箇所に分裂している

| 保持場所 | 内容 |
| --- | --- |
| `GameScreen.vue` のローカル ref | `showActionMenu` / `showItemList` / `showStatusWindow` / `showSkillMenu` / `selectedTile` / `message` |
| `uiStore` | `itemPickupDialog` / `inventoryPanelVisible` / `isMenuOpen` / `selectedMenuItem` |

パネルごとに専用フィールドを手で足す設計であり、追加のたびに両方が膨らむ。パネル間の関係（どちらが手前か、同時に開けるか）はどこにも表現されていない。

### 2.3 重なり順・排他制御・入力ブロックが無い

- モーダル表示中に移動キーを無効化する仕組みが無い
- パネルを開いた状態で別のパネルを開いたときの挙動が未定義
- `closeItemList()` が `showActionMenu.value = true` を直接設定するなど、パネル同士が互いの状態を書き換えている

UI が増えると必ず衝突する。

### 2.4 UI がエンジンをポーリングしている

```ts
// GameScreen.vue
const directionUpdateInterval = setInterval(updatePlayerDirection, 100);
```

`direction_changed` イベントを購読しているにもかかわらず、「フォールバック」として 100ms ごとに `game.getPlayerDirection()` を呼んでいる。信頼できる状態通知の経路が無いことの現れである。

### 2.5 ビューモデルが定義されていない

`selectedTile` という1つの ref に、タイル・敵・キャラクターの情報を `any` で詰め込んで使い回している。

```ts
const selectedTile = ref<{ name: string; effect: string; statModifier: Record<string, number> } | null>(null);
```

`Game.setupEventListeners()` 側でも、タイル・敵・その他の Entity をすべて `{ name, effect, statModifier, position }` の形へ手で詰め替えている。表示用の型が無いため、情報を増やすたびに両側の詰め替えが必要になる。

また `entity_selected` は `Entity` の実体を UI へ渡しており、ドメインオブジェクトが UI 層に露出している。

### 2.6 UI 層にドメイン判定が漏れている

```ts
// GameScreen.vue
if (data.entityId === 'player') { ... }
```

C3 で ID プレフィックス判定をタグベースへ統一したが、Vue 側には残っている。UI がドメインの命名規約に依存している。

### 2.7 ゲーム進行状態の置き場所が定まっていない

`GameStateManager`（`src/common/GameStateManager.ts`）は `START` / `PLAYING` / `CLEAR` / `GAME_OVER` を持つが、実質的に BGM 切替のためだけに使われている。UI のパネル制御や入力可否とは連動していない。

## 3. 設計方針

1. **Game の公開面を「読み取り可能な状態 + 変更通知」にする**。コールバック setter を段階的に廃止する
2. **UI 向けのビューモデル型を定義する**。ドメインオブジェクトを UI へ渡さない
3. **パネル管理を1つの機構に集約する**。スタック・排他・入力ブロックを表現できる形にする
4. **UI からエンジンへの操作は、意図の単位で公開する**。`EventSystem` の直接露出をやめる
5. **ポーリングを廃止する**
6. **既存の画面挙動を変えない**。表示内容・操作方法・見た目は現行のまま

### 3.1 目標とする構造

```text
Game（ユースケース調整）
   │ GameViewModel を更新し、変更を通知
   ↓
GameViewState（読み取り専用の投影）
   │
   ├→ Vue コンポーネント（読み取りのみ）
   │
UIPanelManager（パネルのスタック・排他・入力ブロック）
   │
   └→ Vue コンポーネント

Vue → Game への操作は GameCommands（意図の単位）経由
```

## 4. 型定義

### 4.1 ビューモデル

新規ファイル `src/game/view/GameViewState.ts`

ドメインオブジェクトを含まない、表示専用の型を定義する。

```ts
/** プレイヤーの表示用ステータス */
export interface PlayerViewState {
  readonly hp: number;
  readonly maxHp: number;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly level: number;
  readonly direction: Direction;
  readonly position: { x: number; y: number };
}

/** 選択対象の表示用情報 */
export type SelectionViewState =
  | { readonly kind: 'tile'; readonly name: string; readonly position: { x: number; y: number }; readonly effect: string }
  | { readonly kind: 'enemy'; readonly name: string; readonly position: { x: number; y: number }; readonly hp: number; readonly maxHp: number }
  | { readonly kind: 'player'; readonly name: string; readonly position: { x: number; y: number } }
  | { readonly kind: 'object'; readonly name: string; readonly position: { x: number; y: number } };

/** 進行状況の表示用情報 */
export interface ProgressViewState {
  readonly floor: number;
  readonly maxFloors: number;
  readonly turn: number;
  readonly isPlayerTurn: boolean;
}

/** UI が読む全体状態 */
export interface GameViewState {
  readonly player: PlayerViewState;
  readonly progress: ProgressViewState;
  readonly selection: SelectionViewState | null;
}
```

`SelectionViewState` を判別可能ユニオンにすることで、`selectedTile` に `any` を詰める必要がなくなり、表示側で `kind` による分岐ができる。

### 4.2 コマンド

UI からエンジンへの操作を、意図の単位で公開する。

```ts
/** UI が呼べる操作の一覧 */
export interface GameCommands {
  movePlayer(direction: Direction): void;
  turnPlayer(direction: Direction): void;
  attack(): void;
  useItem(itemId: string): boolean;
  useSkill(skillId: string): boolean;
  endTurn(): void;
  clearSelection(): void;
}
```

`Game` がこのインターフェースを実装する。UI は `EventSystem` を直接触らない。

### 4.3 パネル管理

新規ファイル `src/stores/uiPanelStore.ts`（または composable）

```ts
/** パネルの識別子 */
export type PanelId =
  | 'action_menu'
  | 'item_list'
  | 'status_window'
  | 'skill_menu'
  | 'inventory'
  | 'item_pickup';

/** パネルの性質 */
export interface PanelDefinition {
  readonly id: PanelId;
  /** モーダルなら、下位パネルとゲーム入力をブロックする */
  readonly modal: boolean;
  /** 同時に開けるパネルの制限（'stack' は重ねる、'exclusive' は他を閉じる） */
  readonly stacking: 'stack' | 'exclusive';
}

/** パネル管理の公開 API */
export interface PanelManager {
  open(id: PanelId, payload?: unknown): void;
  close(id: PanelId): void;
  closeTop(): void;
  isOpen(id: PanelId): boolean;
  /** 最前面のパネル */
  readonly top: PanelId | null;
  /** ゲーム入力をブロックすべきか（モーダルが開いているか） */
  readonly inputBlocked: boolean;
}
```

パネルをスタックで管理することで、重なり順・Esc での閉じる順・入力ブロックが自然に決まる。

`inputBlocked` は `InputSystem` と `GameScreen` の操作ボタンの両方が参照する。

## 5. 移行手順

各段階は独立してコミットでき、途中で止めても画面は動作する。

### 段階 1: ビューモデル型の追加（1 コミット）

1. `GameViewState.ts` を追加する
2. この時点では誰も参照しない
3. 型のみの追加

### 段階 2: Game に状態投影を追加（1〜2 コミット）

1. `Game` が `GameViewState` を保持し、変更時に更新する
2. 変更通知の手段を決める（未決事項 1）
3. 既存のコールバック setter は残す（併存）
4. BU-2 の `StatsProjection` と重複しないよう、プレイヤーステータスの投影経路を統一する

### 段階 3: UI をビューモデル参照へ移行（1〜2 コミット）

1. `GameScreen.vue` の `selectedTile` を `SelectionViewState` へ置き換える
2. `setInterval(updatePlayerDirection, 100)` を削除し、`GameViewState.player.direction` を参照する
3. `data.entityId === 'player'` の判定を UI から削除する
4. `game.getEventSystem()` の UI からの利用を削除する
5. **この段階でポーリングとドメイン判定の漏れが解消する**

### 段階 4: パネル管理機構の導入（1〜2 コミット）

1. `PanelManager` を追加する
2. `GameScreen.vue` のローカル ref（`showActionMenu` / `showItemList` / `showStatusWindow` / `showSkillMenu`）を `PanelManager` へ移す
3. `uiStore` の `itemPickupDialog.visible` / `inventoryPanelVisible` / `isMenuOpen` も `PanelManager` へ移す
   - ダイアログの中身（`item` / `position` / `itemEntityId`）はパネルの payload として保持する
4. `closeItemList()` が `showActionMenu` を直接書き換えるような相互操作を撤去する
5. `inputBlocked` を `InputSystem` と操作ボタンへ接続する
6. **この段階で「新しいパネルを追加しても既存パネルと衝突しない」が成立する**

### 段階 5: コマンド化とコールバック撤去（1〜2 コミット）

1. `GameCommands` インターフェースを定義し、`Game` に実装する
2. UI からの操作を `GameCommands` 経由へ移行する
3. 5本のコールバック setter を削除する
4. `Game.getEventSystem()` を削除する（または internal 扱いにする）
5. **この段階で「新しい UI を Game.ts の変更なしで追加できる」が成立する**

## 6. 完了条件

- 新しい UI パネルを追加するとき、`Game.ts` を変更しなくてよい
- UI がドメインオブジェクト（`Entity` など）を受け取らない
- UI がエンジンをポーリングしない
- UI に `entityId === 'player'` のようなドメイン判定が無い
- モーダル表示中にゲーム入力がブロックされる
- パネルの重なり順が1箇所で管理されている
- 画面の表示内容・操作方法・見た目が現行と変わらない
- 既存 603 件のテストが維持される

## 7. テスト方針

追加するテスト:

1. **ビューモデル投影テスト** — ドメイン状態の変化が `GameViewState` へ反映されること
2. **パネルスタックテスト** — 開閉順、`closeTop()` の挙動、`exclusive` パネルの排他
3. **入力ブロックテスト** — モーダルパネルが開いているとき `inputBlocked` が true になり、移動コマンドが実行されないこと
4. **新規パネル追加テスト** — テスト内で新しい `PanelId` を追加し、既存パネルへ影響しないことを検証（拡張性の契約テスト）
5. **import ガードテスト** — Vue コンポーネントが `engine/` 配下を直接 import しないこと（`DomainRenderingIndependence.spec.ts` と同じ形式）
6. E2E — ゲーム開始、移動、攻撃、アイテム取得ダイアログ、インベントリ開閉、フロア遷移

## 8. 未決事項

1. **ビューモデルの保持先**。Pinia ストアへ投影するか、composable の reactive state として持つか
   - Pinia 案: 既存の `gameStore` / `uiStore` と一貫する。Vue DevTools で観測できる
   - composable 案: `Game` のライフサイクルと一致させやすい。ストアのグローバル性を持ち込まない
   - **着手前に判断が必要**
2. **`gameStore` との役割分担**。BU-2 で `gameStore.player.status` を「表示専用の投影」にする。`GameViewState.player` と重複するため、どちらかへ寄せる必要がある
   - 案: `gameStore` はインベントリ・倉庫など永続的なゲームデータを持ち、`GameViewState` は実行中の表示状態を持つ
3. **`GameStateManager` の位置づけ**。`START` / `PLAYING` / `CLEAR` / `GAME_OVER` を `GameViewState` に統合するか、BGM 制御専用として残すか
4. **`EventName` enum の UI 系エントリ**。`ui_button_clicked` / `ui_window_opened` / `ui_window_closed` は現在未使用。`PanelManager` の通知に使うか、削除するか（BU-1 の未決事項と連動）
5. **`item_found` / `entity_selected` のペイロード**。現在 `Entity` 実体を渡している。ID のみにして UI 側でビューモデルを引く形にするか（BU-1 の未決事項 2, 3 と同一）

## 9. スコープ外

- 画面デザイン・レイアウトの変更
- 新しい UI 機能の追加
- 既存パネルの表示内容の変更
- Vue コンポーネントの分割・再構成（`GameScreen.vue` は 851 行あるが、本フェーズでは状態管理の移行のみ行う）
- アニメーション・トランジションの追加
- レスポンシブ対応
