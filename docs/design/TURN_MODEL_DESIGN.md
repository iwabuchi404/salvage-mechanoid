# BU-3: ターンモデルの導入 — 設計ドキュメント

最終更新: 2026-08-16

親プラン: `docs/BRUSHUP_PLAN.md`

## 1. 目的

ターン制ゲームでありながら、ターン番号・行動コスト・行動順のいずれも存在しない。このため「N ターン継続する効果」「素早い敵」「新しい行動」といった、ローグライクの基本要素が実装できない。

本フェーズでは、**行動（Action）→ コスト → スケジューラ**という最小のターンモデルを導入し、新しい行動や継続効果を `TurnSystem` の変更なしで追加できる状態にする。

## 2. 現状の構造と問題

### 2.1 ターン番号が存在しない

`turnCount` / `turnNumber` / `currentTurn` に相当する変数がコードベース全体に存在しない。「3ターン継続」「5ターンごとに発生」を表現する土台がない。

`SkillSystem` はクールダウンを `Map<string, number>` で持ち、`player_turn_started` を購読して自前で 1 ずつ減らしている（`SkillSystem.ts:59-73`）。継続時間を扱う機能を追加するたびに、この実装が各システムへ複製される。

### 2.2 ターン進行のトリガーが4つに分散している

`TurnSystem.setupEventListeners()`（`TurnSystem.ts:75-101`）は、次の4つのイベントがそれぞれ独立に `switchToEnemyTurn()` を呼ぶ。

| イベント | 発行元 |
| --- | --- |
| `move_completed` | `MovementComponent` |
| `player_turn_ended` | `Player.turn()`、`InputSystem.requestPlayerSkip()` |
| `player_attacked` | `Player.attack()` |
| `turn_action_completed` | `CombatSystem` |

問題は3つある。

1. **新しい行動を追加するたびに、イベントとリスナーを1組ずつ `TurnSystem` へ足す必要がある**。アイテム使用・投擲・リロード・調べる、いずれも同じ作業が発生する
2. **ターンを消費しない行動を表現できない**。行動とターン終了が1対1に固定されている
3. **同一行動で複数のトリガーが走る可能性がある**。`processingTurn` フラグ（`TurnSystem.ts:119-121`）で二重実行を防いでいるが、これは構造的な問題を実行時フラグで抑えている状態である

### 2.3 行動順・素早さの概念がない

`processAllEnemies()`（`TurnSystem.ts:137-187`）は `getEntitiesByTag('enemy')` の**登録順に全員が必ず1回ずつ**行動する。

`EnemyStatProfile.moveSpeed`（SCOUT 6 / SOLDIER 4 / HEAVY 2）は `MovementComponent` の移動アニメーション速度であり、行動回数には影響しない。「素早い敵が2回動く」「鈍重な敵が2ターンに1回動く」が表現できない。

### 2.4 System が Entity の暗黙契約に依存している

```ts
// TurnSystem.ts:175
if ('act' in enemy && typeof (enemy as any).act === 'function') {
  await (enemy as any).act();
}
```

ダックタイピングで `Enemy.act()` を呼んでいる。C3 で種別判定を Component ベースへ統一したが、行動の呼び出しはこの形のまま残っている。

### 2.5 ターン進行と入力制御が二重管理になっている

`InputSystem` は `waitingForInput` フラグを持ち、`player_turn_started` / `player_turn_ended` / `enemy_turn_started` で切り替えている（`InputSystem.ts:219-231`）。さらに `requestPlayerMove()` が直接 `waitingForInput = false` を設定する（`InputSystem.ts:289`）。

ターンの状態が `TurnSystem.currentPhase` と `InputSystem.waitingForInput` の2箇所にあり、同期はイベント経由の暗黙的なものになっている。

### 2.6 行動のコストがドメインへ散っている

- 移動のエネルギー消費 1 は、`Player` が `move_completed` を購読して実行（`Player.ts:102`）
- 攻撃のエネルギー消費 2 は、`Player.attack()` の冒頭（`Player.ts:205`）
- 方向転換は「1ターン消費、エネルギー消費なし」とコメントされ、`Player.turn()` が直接 `player_turn_ended` を発行（`Player.ts:170-176`）

行動ごとのコストが一覧できず、バランス調整の対象を特定できない。

### 2.7 ターン制に実時間タイマーが混在している

`WorldSystem.applyTileEffect()` が `setTimeout(..., 1000)` / `setTimeout(..., 3000)` で移動速度を戻している（`WorldSystem.ts:208,229`）。ターン制の状態変化が実時間で復帰するため、フロア遷移や `reset()` 後もタイマーが生き残る。

`docs/R6_5_REMEDIATION_PLAN.md` の D4 として計画したが未着手。本フェーズのターンモデル導入で解決する。

## 3. 設計方針

1. **行動を `Action` という値として表現する**。イベント名ではなく型で扱う
2. **行動コストを `Action` が持つ**。ターンを消費するかどうかも `Action` が宣言する
3. **`TurnSystem` はスケジューラに徹する**。行動の中身を知らず、コストの消費と順序だけを管理する
4. **ターン番号を1つ持ち、継続効果はそれを参照する**。各システムが自前で数えるのをやめる
5. **行動の実行は `ActionExecutor` へ委譲する**。`Action` の種別ごとの処理を1箇所に集約する
6. **既存の挙動を変えない**。移動1回でターンが進む、敵は全員1回ずつ行動する、という現行の実効挙動は維持する

### 3.1 目標とする構造

```text
InputSystem / EnemyBehaviorStrategy
        │ Action を生成
        ↓
   TurnSystem（スケジューラ）
        │ コストを検証・消費し、順序を決める
        ↓
   ActionExecutor（行動の実行）
        │ Move / Attack / UseItem / Wait ...
        ↓
   Entity / Component（状態変更）

TurnSystem が turn_started を発行
        ↓
   継続効果（クールダウン、状態異常）が turnNumber を参照
```

## 4. 型定義

### 4.1 Action

新規ファイル `src/engine/turn/Action.ts`

```ts
import { Direction, Vector3 } from '../types';

/** 行動の種別 */
export type ActionKind =
  | 'move'
  | 'turn'      // 方向転換
  | 'attack'
  | 'use_item'
  | 'use_skill'
  | 'interact'
  | 'wait';

/**
 * 行動のコスト。
 *
 * timeCost が 0 の行動はターンを進めない（自由行動）。
 * 現行の挙動を維持する場合、移動・攻撃・方向転換はすべて timeCost 1。
 */
export interface ActionCost {
  /** 行動に要する時間単位。0 ならターンを消費しない */
  readonly timeCost: number;
  /** 消費エネルギー */
  readonly energyCost: number;
}

/** 行動 */
export interface Action {
  readonly kind: ActionKind;
  readonly actorId: string;
  readonly cost: ActionCost;
  /** 行動固有のパラメータ */
  readonly params?: {
    direction?: Direction;
    targetId?: string;
    targetPosition?: Vector3;
    itemId?: string;
    skillId?: string;
  };
}

/** 行動の実行結果 */
export interface ActionResult {
  /** 実行が成功したか */
  readonly success: boolean;
  /** 実際に消費した時間単位（失敗時は 0） */
  readonly consumedTime: number;
  /** 失敗理由（ログ・UI 表示用） */
  readonly reason?: string;
}
```

### 4.2 行動コストの定義（純データ）

新規ファイル `src/engine/turn/ActionCostTable.ts`

現在ドメインへ散っているコストを1箇所に集約する。`EnemyStatProfile` と同じ「純データ + 純粋関数」の形にそろえる。

```ts
/**
 * 行動種別ごとの既定コスト。
 *
 * 現行の実効挙動と一致する値を初期値とする:
 * - 移動: エネルギー1消費（Player.ts:102 相当）、1ターン
 * - 攻撃: エネルギー2消費（Player.ts:205 相当）、1ターン
 * - 方向転換: エネルギー消費なし、1ターン（Player.ts:155-179 相当）
 */
export const DEFAULT_ACTION_COSTS: Readonly<Record<ActionKind, ActionCost>> = Object.freeze({
  move:      { timeCost: 1, energyCost: 1 },
  turn:      { timeCost: 1, energyCost: 0 },
  attack:    { timeCost: 1, energyCost: 2 },
  use_item:  { timeCost: 1, energyCost: 0 },
  use_skill: { timeCost: 1, energyCost: 0 }, // 実コストは Skill 定義側が持つ
  interact:  { timeCost: 0, energyCost: 0 }, // 現行は自動発火のため 0
  wait:      { timeCost: 1, energyCost: 0 },
});

export function getActionCost(kind: ActionKind): ActionCost;
```

### 4.3 TurnSystem の新しい責務

```ts
export class TurnSystem implements System {
  /** 現在のターン番号（1 始まり、単調増加） */
  getTurnNumber(): number;
  /** 現在のフェーズ */
  getCurrentPhase(): TurnPhase;

  /**
   * 行動を要求する。
   * コストを検証し、実行可能なら ActionExecutor へ渡す。
   * timeCost > 0 の行動が成功した場合、ターンを進める。
   */
  requestAction(action: Action): Promise<ActionResult>;

  /** 現在行動可能なアクターか */
  canAct(entityId: string): boolean;
}
```

`turn_started` イベントを追加し、BU-1 の `EventMap` へ宣言する。

```ts
turn_started: { turn: number; phase: 'player' | 'enemy' };
turn_ended: { turn: number; phase: 'player' | 'enemy' };
```

### 4.4 行動可能性の宣言

敵の行動呼び出しを `'act' in enemy` のダックタイピングから、Component ベースへ移す。C3 の `BlockingComponent` / `VisionBlockingComponent` と同じパターンにそろえる。

```ts
/** 自律行動する Entity が持つコンポーネント */
export class ActorComponent implements Component {
  type = 'actor';
  entity: Entity | null = null;

  /** 行動速度。高いほど1ターンあたりの行動機会が多い */
  private _speed: number;

  /** 次の行動までに必要な残り時間 */
  private _timeUntilNextAction = 0;

  /** 次の行動を決定する（AI または入力待ち） */
  decideAction(): Promise<Action | null>;
}
```

## 5. 行動順の方式

**未決事項 2 として2案を提示する。着手前に判断が必要。**

### 案 A: フェーズ制のまま行動コストだけ導入する（推奨）

現行の「プレイヤー全員 → 敵全員」というフェーズ構造を維持し、`Action` と `timeCost` だけを導入する。

- 変更範囲が小さく、現行挙動を維持しやすい
- ターン番号と継続効果はこの案でも成立する
- 「素早い敵が2回動く」は、敵フェーズ内で `ActorComponent.speed` に応じて行動回数を変える形で近似できる
- 完全な行動順の入れ替え（敵がプレイヤーより先に2回動く等）は表現できない

### 案 B: エネルギー式スケジューラ

全アクターを1つのキューで管理し、各アクターが蓄積時間を消費して行動する。

- ローグライクで一般的な方式。素早さを厳密に表現できる
- プレイヤーと敵の行動が交互でなくなるため、`InputSystem` / UI 側の「プレイヤーターン」の扱いを再設計する必要がある
- 変更範囲が大きく、BU-4（UI 境界）と密結合になる

**推奨は案 A。** 本プランの目的は「機能が乗る土台を作る」ことであり、行動順の厳密さは現時点で要求されていない。案 A でも `Action` / コスト / ターン番号は手に入り、案 B への移行は `TurnSystem` 内部の変更で済む（`Action` の型は変わらない）。

## 6. 移行手順

各段階は独立してコミットでき、途中で止めてもゲームは動作する。

### 段階 1: ターン番号の導入（1 コミット）

1. `TurnSystem` に `turnNumber` を追加し、`startNewTurn()` でインクリメントする
2. `turn_started` / `turn_ended` イベントを追加する（`EventMap` へ宣言）
3. 既存の `player_turn_started` / `enemy_turn_started` は併存させる
4. `SkillSystem` のクールダウンを `turnNumber` ベースへ変更する（「あと N ターン」ではなく「ターン X まで」で保持する）
5. **この段階で「N ターン継続」を表現する土台が成立する**

### 段階 2: Action 型とコストテーブルの追加（1 コミット）

1. `Action.ts`、`ActionCostTable.ts` を追加する
2. コスト値は現行の実効挙動と一致させる
3. この時点では誰も参照しない
4. `getActionCost` の単体テストを追加する

### 段階 3: ActionExecutor の追加と移動の移行（1〜2 コミット）

1. `ActionExecutor` を追加し、`move` / `turn` / `attack` / `wait` を実装する
2. `TurnSystem.requestAction()` を追加する
3. `InputSystem` の `requestPlayerMove` / `requestPlayerAttack` / `requestPlayerSkip` を `TurnSystem.requestAction()` 経由へ変更する
4. 旧経路（`move_completed` などによるターン進行）は残す
5. エネルギー消費を `Player` から `ActionExecutor` へ移す
   - `Player.ts:102` の移動時エネルギー消費
   - `Player.ts:205` の攻撃時エネルギー消費

### 段階 4: 旧トリガーの撤去（1 コミット）

1. `TurnSystem` から4つのイベントリスナーを削除する
2. `Player.turn()` の `player_turn_ended` 直接発行を削除する
3. `processingTurn` フラグを不要にできるか確認する
4. **この段階で「新しい行動を TurnSystem の変更なしで追加できる」が成立する**

### 段階 5: 敵行動の Component 化（1〜2 コミット）

1. `ActorComponent` を追加し、`Enemy` に付与する
2. `TurnSystem.processAllEnemies()` の `'act' in enemy` を `ActorComponent` の有無で判定する形へ変更する
3. `EnemyBehaviorStrategy` が `Action` を返す形へ移行する（現行は直接 World を操作している）
4. `ActorComponent.speed` による行動回数の差を実装する（案 A の場合）
5. `EnemyStatProfile.moveSpeed` と行動速度の関係を整理する（未決事項 3）

### 段階 6: タイル効果のターンベース化（1 コミット）

1. `WorldSystem.applyTileEffect()` の `setTimeout` を撤去する
2. 効果の残存を「ターン X まで」で表現し、`turn_started` で失効を判定する
3. `destroy()` / `reset()` / フロア遷移で確実に破棄されることをテストで固定する

### 段階 7: 入力制御の一本化（1 コミット）

1. `InputSystem.waitingForInput` を廃止し、`TurnSystem.canAct(playerId)` を参照する形へ変更する
2. ターン状態の正本を `TurnSystem` に一本化する

## 7. 完了条件

- ターン番号が存在し、単調増加する
- 行動が `Action` として表現され、コストが1箇所に定義されている
- 新しい行動種別を、`TurnSystem` の変更なしで追加できる
- ターンを消費しない行動を表現できる
- 敵の行動呼び出しがダックタイピングでない
- タイル効果が実時間タイマーに依存しない
- ターン状態の正本が `TurnSystem` の1つになっている
- 現行の実効挙動（移動1回でターン進行、敵は全員1回ずつ行動、エネルギー消費 移動1/攻撃2）が維持される
- 既存 603 件のテストが維持される

## 8. テスト方針

追加するテスト:

1. **ターン番号の単調増加テスト** — プレイヤー行動 → 敵行動 → プレイヤーターンで 1 増えること
2. **行動コストテスト** — `timeCost: 0` の行動でターンが進まないこと
3. **エネルギー不足時のテスト** — コストを払えない場合に `ActionResult.success === false` を返し、ターンが進まないこと
4. **新規行動の追加テスト** — テスト内で新しい `ActionKind` を定義し、`TurnSystem` を変更せずに実行できることを検証（拡張性の契約テスト）
5. **クールダウンのターン基準テスト** — `turnNumber` ベースで正しく失効すること
6. **タイル効果の失効テスト** — 指定ターン後に効果が切れ、`reset()` で残らないこと
7. **敵の行動回数テスト** — `ActorComponent.speed` に応じた行動回数（案 A の場合）

## 9. 未決事項

1. **`interact` のコスト**。現在インタラクションは `InteractionSystem.update()` から毎フレーム自動発火しており、ターンを消費しない。これを明示的な行動にするか、自動発火のまま `timeCost: 0` とするか
2. **行動順の方式**（§5）。案 A（フェーズ制 + コスト）と案 B（エネルギー式スケジューラ）のどちらを採るか。**着手前に判断が必要**
3. **`moveSpeed` の意味の再定義**。`EnemyStatProfile.moveSpeed`（6/4/2）は現在アニメーション速度である。行動速度として再利用するか、別の値を持つか。BU-2 の `StatKey` に `moveSpeed` を含めるかとも関連する
4. **プレイヤーの複数回行動**。案 A で敵の行動回数を可変にする場合、プレイヤー側も同じ仕組みを持つか（加速アイテム等の余地）
5. **`player_turn_started` / `enemy_turn_started` の最終的な扱い**。`turn_started` へ統合するか、UI 向けの通知として残すか。BU-4 の UI 境界と合わせて決める

## 10. スコープ外

- 状態異常システムそのもの（本フェーズでターン基盤を作り、実装は BU-2 の `StatSource` として別途）
- 行動のアンドゥ / リプレイ
- ターン単位のセーブ
- AI の意思決定アルゴリズムの改良（`EnemyBehaviorStrategy` の内部ロジック）
- ゲームバランス調整（コスト値は現行の実効値と一致させる）
