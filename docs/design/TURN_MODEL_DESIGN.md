# BU-3: ターンモデルの導入 — 設計ドキュメント

最終更新: 2026-08-17

親プラン: `docs/BRUSHUP_PLAN.md`

**方式決定: 案 B（エネルギー式スケジューラ）を採用する（2026-08-17 ユーザー判断）。**

## 1. 目的

ターン制ゲームでありながら、ターン番号・行動コスト・行動順のいずれも存在しない。このため「N ターン継続する効果」「素早い敵」「新しい行動」といった、ローグライクの基本要素が実装できない。

本フェーズでは、**行動（Action）→ コスト → エネルギー式スケジューラ**という構造を導入し、新しい行動や継続効果を `TurnSystem` の変更なしで追加できる状態にする。

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

1. **新しい行動を追加するたびに、イベントとリスナーを1組ずつ `TurnSystem` へ足す必要がある**
2. **ターンを消費しない行動を表現できない**。行動とターン終了が1対1に固定されている
3. **同一行動で複数のトリガーが走る可能性がある**。`processingTurn` フラグ（`TurnSystem.ts:119-121`）で二重実行を防いでいるが、構造的な問題を実行時フラグで抑えている

### 2.3 行動順・素早さの概念がない

`processAllEnemies()`（`TurnSystem.ts:137-187`）は `getEntitiesByTag('enemy')` の**登録順に全員が必ず1回ずつ**行動する。

`EnemyStatProfile.moveSpeed`（SCOUT 6 / SOLDIER 4 / HEAVY 2）は `MovementComponent` の移動アニメーション速度であり、行動回数には影響しない。

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

ターンの状態が `TurnSystem.currentPhase` と `InputSystem.waitingForInput` の2箇所にある。

### 2.6 行動のコストがドメインへ散っている

- 移動のエネルギー消費 1 は、`Player` が `move_completed` を購読して実行（`Player.ts:102` 付近）
- 攻撃のエネルギー消費 2 は、`Player.attack()` の冒頭
- 方向転換は `Player.turn()` が直接 `player_turn_ended` を発行

行動ごとのコストが一覧できず、バランス調整の対象を特定できない。

### 2.7 ターン制に実時間タイマーが混在している

`WorldSystem.applyTileEffect()` が `setTimeout(..., 1000)` / `setTimeout(..., 3000)` で移動速度を戻している（`WorldSystem.ts:208,229` 付近）。フロア遷移や `reset()` 後もタイマーが生き残る。

### 2.8 既存の非同期モデル（案 B の前提として重要）

現在の行動実行は**アニメーション完了を待つ非同期処理**である。

- `TurnSystem.processAllEnemies()` は `await enemy.act()` で敵を1体ずつ直列に処理する
- `EnemyMovementHelper.moveTowardsPlayer()` は `await waitForMovement(movement)` で移動アニメーション完了を待つ（`EnemyAIUtils.ts:52-70`、最大 500ms でタイムアウト）
- 攻撃は `await waitForAttack()` で固定 200ms 待つ

つまり**行動の実行時間 = アニメーション時間**であり、スケジューラは各行動の完了を await して直列化できる。案 B のループはこの性質にそのまま乗る。

## 3. 設計方針

1. **行動を `Action` という値として表現する**。イベント名ではなく型で扱う
2. **行動コストを `Action` が持つ**。ターンを消費するかどうかも `Action` が宣言する
3. **`TurnScheduler` が行動順を決める**。全アクターを1つのキューでエネルギー蓄積により管理する
4. **論理時刻とターン番号を分ける**。継続効果はターン番号を参照する
5. **行動の実行は `ActionExecutor` へ委譲する**
6. **プレイヤーの入力待ちはスケジューラの中断として表現する**
7. **既定パラメータでは現行の実効挙動を維持する**。全アクターの速度を同一にすれば「プレイヤー1回 → 敵全員1回」と等価になる

### 3.1 目標とする構造

```text
InputSystem                EnemyBehaviorStrategy
   │ submitPlayerAction()      │ decideAction()
   ↓                           ↓
        TurnScheduler（行動順の決定）
   │ エネルギー蓄積 → 行動権のあるアクターを選ぶ
   │ プレイヤーなら入力を待って中断・再開
   ↓
   ActionExecutor（行動の実行）
   │ Move / Attack / UseItem / Wait ...
   ↓
   Entity / Component（状態変更）

TurnScheduler が turn_started / actor_turn_started を発行
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
 * timeCost が 0 の行動はエネルギーを消費せず、行動権を保持したままになる（自由行動）。
 * 現行の挙動を維持する場合、移動・攻撃・方向転換はすべて timeCost 1。
 */
export interface ActionCost {
  /** 行動に要する時間単位。0 なら行動権を消費しない */
  readonly timeCost: number;
  /** 消費エネルギー（ゲーム内リソースとしてのエネルギー。スケジューラのエネルギーとは別物） */
  readonly energyCost: number;
}

/** 行動 */
export interface Action {
  readonly kind: ActionKind;
  readonly actorId: string;
  readonly cost: ActionCost;
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
  readonly success: boolean;
  /** 実際に消費した時間単位（失敗時は 0） */
  readonly consumedTime: number;
  readonly reason?: string;
}
```

**用語の注意**: 本設計では「エネルギー」が2つ登場する。

| 名称 | 意味 | 保持場所 |
| --- | --- | --- |
| スケジューラエネルギー（`schedulerEnergy`） | 行動順を決める内部値 | `ActorComponent` |
| ゲームエネルギー | プレイヤーの行動リソース（HUD に表示） | `EnergyComponent` |

混同を避けるため、コード上は前者を `schedulerEnergy` と明示的に命名する。

### 4.2 行動コストの定義（純データ）

新規ファイル `src/engine/turn/ActionCostTable.ts`

```ts
/**
 * 行動種別ごとの既定コスト。
 *
 * 現行の実効挙動と一致する値を初期値とする:
 * - 移動: ゲームエネルギー1消費、時間1
 * - 攻撃: ゲームエネルギー2消費、時間1
 * - 方向転換: ゲームエネルギー消費なし、時間1
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

### 4.3 ActorComponent

C3 の `BlockingComponent` / `VisionBlockingComponent` と同じパターンで、行動可能性を Component として宣言する。

```ts
/** 自律行動または入力によって行動する Entity が持つコンポーネント */
export class ActorComponent implements Component {
  type = 'actor';
  entity: Entity | null = null;

  /** 行動速度。1 tick あたりに蓄積するスケジューラエネルギー */
  get speed(): number;
  set speed(value: number);

  /** 蓄積済みのスケジューラエネルギー */
  get schedulerEnergy(): number;

  /** 入力待ちが必要か（プレイヤーは true、AI は false） */
  readonly inputControlled: boolean;

  /** スケジューラが呼ぶ。次の行動を決める。null なら行動放棄（wait 扱い） */
  decideAction(): Promise<Action | null>;
}
```

速度の供給元は `StatsComponent`（BU-2）とする。`StatKey` の `moveSpeed` を**行動速度として再定義**し、`ActorComponent.speed` はそこから読む。これにより「素早さを上げる装備」が BU-2 の修飾子だけで表現できる。

### 4.4 TurnScheduler

新規ファイル `src/engine/turn/TurnScheduler.ts`

```ts
/** 行動権を得るために必要なスケジューラエネルギー */
export const ACTION_THRESHOLD = 100;

export class TurnScheduler {
  /** 論理時刻（tick 単位、単調増加） */
  getCurrentTime(): number;

  /** ターン番号。プレイヤーが行動を完了するたびに +1 */
  getTurnNumber(): number;

  /** スケジューラを開始する（多重起動しない） */
  start(): void;

  /** スケジューラを停止する（フロア遷移・ゲームオーバー・reset 時） */
  stop(): void;

  /** 指定アクターが今まさに行動権を持ち、入力待ちか */
  canAct(entityId: string): boolean;

  /** 入力側から行動を投入する。入力待ちでなければ false */
  submitPlayerAction(action: Action): boolean;
}
```

**スケジューラのループ**

```text
while (running):
    候補 = schedulerEnergy >= ACTION_THRESHOLD のアクター
    if 候補が空:
        全アクターの schedulerEnergy += speed
        currentTime += 1
        continue

    actor = 候補のうち schedulerEnergy 最大（同値なら登録順で安定ソート）

    if actor.inputControlled:
        入力待ち状態にする（canAct(actor) が true になる）
        action = await 入力Promise    ← ここでループが中断する
    else:
        action = await actor.decideAction()

    result = await executor.execute(action)    ← アニメーション完了まで await

    actor.schedulerEnergy -= result.consumedTime * ACTION_THRESHOLD

    if actor がプレイヤー and result.consumedTime > 0:
        turnNumber += 1
        emit turn_started { turn: turnNumber }
```

**現行挙動との等価性**: 全アクターの `speed` を同一（既定 100）にすると、毎 tick で全員が同時に行動権を得る。安定ソートによりプレイヤー → 敵（登録順）の順で1回ずつ行動し、現行の「プレイヤー1回 → 敵全員1回」と実質的に等価になる。速度差を導入するのは移行完了後とする。

### 4.5 イベント

BU-1 の `EventMap` へ追加する。

```ts
/** ターンが進んだ（プレイヤーの行動完了時） */
turn_started: { turn: number };
/** 個々のアクターが行動権を得た */
actor_turn_started: { actorId: string; time: number };
/** プレイヤーの入力待ちが開始・終了した（UI・InputSystem 向け） */
player_input_requested: { playerId: string; turn: number };
player_input_resolved: { playerId: string; turn: number };
```

既存の `player_turn_started` / `enemy_turn_started` / `player_turn_ended` は、移行完了まで併存させる（UI と `SkillSystem` が購読しているため）。最終的な扱いは未決事項 5。

## 5. 案 B を選んだことによる影響

案 A（フェーズ制維持）と比べ、次が追加の作業対象となる。着手前に把握しておく。

| 影響箇所 | 内容 |
| --- | --- |
| `InputSystem` | `waitingForInput` を廃止し、`TurnScheduler.canAct()` と `submitPlayerAction()` へ置き換える。キー入力は直接 `player.move()` を呼ばず `Action` を生成する |
| `TurnSystem` | `currentPhase` / `processAllEnemies()` / 4つのイベントリスナーを廃止し、`TurnScheduler` へ委譲する薄い System になる |
| UI（BU-4） | `isPlayerTurn` の意味が「プレイヤーフェーズ中」から「プレイヤーの入力待ち」に変わる。`GameScreen.vue` の `setOnTurnChange` 経路も追随が必要 |
| `SkillSystem` | クールダウンの起点を `player_turn_started` から `turn_started`（ターン番号ベース）へ変更 |
| 既存テスト | `tests/unit/turn/TurnSystem.spec.ts` はフェーズ制を前提としているため書き換えが必要 |
| 中断・再開 | フロア遷移、ゲームオーバー、`Game.reset()` でスケジューラを確実に停止する必要がある |

**とくに注意すべきリスク**

1. **スケジューラの停止漏れ** — ループが `await` で中断している間にフロア遷移や reset が起きると、古いループが生き続ける。`stop()` と世代カウンタ（`runId`）で無効化する
2. **入力 Promise の解決漏れ** — プレイヤーの入力待ち中にゲームオーバーやリセットが起きると Promise が永久に未解決になる。`stop()` 時に必ず reject / resolve する
3. **行動失敗による無限ループ** — 壁に向かって移動し続けるなど `consumedTime: 0` が返り続けると、エネルギーが減らずループが回り続ける。**失敗した行動は最低 1 時間単位を消費する**か、同一アクターの連続失敗回数に上限を設ける
4. **`waitForMovement` の 500ms タイムアウト** — アニメーションが完了しなくても 500ms で先へ進む既存挙動に依存している。スケジューラでも同様のタイムアウト保護を維持する

## 6. 移行手順

各段階は独立してコミットでき、途中で止めてもゲームは動作する。

### 段階 1: ターン番号の導入（1 コミット）

1. `TurnSystem` に `turnNumber` を追加し、現行の `startNewTurn()` でインクリメントする
2. `turn_started` イベントを追加する（`EventMap` へ宣言）
3. 既存の `player_turn_started` / `enemy_turn_started` は併存させる
4. `SkillSystem` のクールダウンを `turnNumber` ベースへ変更する（「あと N ターン」ではなく「ターン X まで」で保持する）
5. **この段階で「N ターン継続」を表現する土台が成立する**

この段階はスケジューラに依存しないため、案 A と共通。

### 段階 2: Action 型とコストテーブルの追加（1 コミット）

1. `Action.ts`、`ActionCostTable.ts` を追加する
2. コスト値は現行の実効挙動と一致させる
3. この時点では誰も参照しない
4. `getActionCost` の単体テストを追加する

### 段階 3: ActionExecutor の追加（1〜2 コミット）

1. `ActionExecutor` を追加し、`move` / `turn` / `attack` / `wait` を実装する
2. ゲームエネルギー消費を `Player` から `ActionExecutor` へ移す
3. 既存の `Player.move()` / `Player.attack()` は内部実装として残し、`ActionExecutor` から呼ぶ
4. まだスケジューラは無く、`InputSystem` からの直接呼び出しも従来どおり

### 段階 4: ActorComponent の追加（1 コミット）

1. `ActorComponent` を追加し、`Player` と `Enemy` に付与する
2. `speed` は `StatsComponent` の `moveSpeed` から読む。**この時点では全員同じ既定値**にして挙動を変えない
3. `Enemy.decideAction()` は当面 `EnemyBehaviorStrategy` をラップし、`Action` ではなく従来の副作用実行を行う形でよい（段階 6 で `Action` を返す形へ移す）
4. `TurnSystem.processAllEnemies()` の `'act' in enemy` を `ActorComponent` の有無による判定へ変更する

### 段階 5: TurnScheduler の導入（2〜3 コミット）

1. `TurnScheduler` を実装する。`start()` / `stop()` / `canAct()` / `submitPlayerAction()`
2. 停止・世代管理（`runId`）と、入力 Promise の確実な解決を実装する
3. 失敗行動の最低コスト消費（リスク 3 の対策）を実装する
4. `InputSystem` を `submitPlayerAction()` 経由へ変更し、`waitingForInput` を廃止する
5. `TurnSystem` を `TurnScheduler` への薄い委譲に変更し、4つのイベントリスナーと `processAllEnemies()` を削除する
6. `Player.turn()` の `player_turn_ended` 直接発行を削除する
7. フロア遷移・ゲームオーバー・`Game.reset()` で `stop()` を呼ぶ
8. **この段階で「新しい行動を TurnSystem の変更なしで追加できる」が成立する**

### 段階 6: 敵 AI を Action ベースへ（1〜2 コミット）

1. `EnemyBehaviorStrategy` が副作用ではなく `Action` を返す形へ移行する
2. `EnemyMovementHelper` の移動・攻撃を `Action` の生成に置き換える
3. `waitForMovement` / `waitForAttack` の待機は `ActionExecutor` 側へ集約する

### 段階 7: 速度差の有効化（1 コミット）

1. `EnemyStatProfile.moveSpeed`（6/4/2）を行動速度として `ActorComponent.speed` へ接続する
2. アニメーション速度は別の値として分離する（未決事項 3）
3. **この段階で「素早い敵が多く動く」が成立する**
4. ゲームバランスへの影響が出るため、**この段階だけは挙動が変わる**。速度値の調整は別途

### 段階 8: タイル効果のターンベース化（1 コミット）

1. `WorldSystem.applyTileEffect()` の `setTimeout` を撤去する
2. 効果の残存を「ターン X まで」で表現し、`turn_started` で失効を判定する
3. `destroy()` / `reset()` / フロア遷移で確実に破棄されることをテストで固定する

## 7. 完了条件

- ターン番号が存在し、単調増加する
- 論理時刻とターン番号が分離している
- 行動が `Action` として表現され、コストが1箇所に定義されている
- 新しい行動種別を、`TurnScheduler` / `TurnSystem` の変更なしで追加できる
- ターンを消費しない行動を表現できる
- 敵の行動呼び出しがダックタイピングでない
- 行動速度の差が行動回数に反映される
- タイル効果が実時間タイマーに依存しない
- ターン状態の正本が `TurnScheduler` の1つになっている
- フロア遷移・ゲームオーバー・reset でスケジューラが確実に停止し、入力 Promise が残らない
- 段階 7 の前まで、現行の実効挙動（移動1回でターン進行、敵は全員1回ずつ行動、ゲームエネルギー消費 移動1/攻撃2）が維持される
- 既存テストが維持される（段階 5 で `TurnSystem.spec.ts` は書き換える）

## 8. テスト方針

追加するテスト:

1. **ターン番号の単調増加テスト** — プレイヤー行動ごとに 1 増えること
2. **行動コストテスト** — `timeCost: 0` の行動で行動権が消費されないこと
3. **エネルギー不足時のテスト** — ゲームエネルギーが払えない場合に `success: false` を返すこと
4. **スケジューラの順序テスト** — 全員同速のとき、プレイヤー → 敵（登録順）で1回ずつ行動すること（現行挙動との等価性）
5. **速度差テスト** — speed 2倍のアクターが 2 回行動する間に、等速のアクターが 1 回行動すること
6. **失敗行動の無限ループ防止テスト** — 移動不能な方向へ連続で行動要求しても、ループが停止せず進むこと
7. **停止テスト** — `stop()` 後にループが継続しないこと、入力待ち Promise が解決されること
8. **フロア遷移中断テスト** — 入力待ち中にフロア遷移が起きても古いループが復活しないこと
9. **新規行動の追加テスト** — テスト内で新しい `ActionKind` を定義し、スケジューラを変更せずに実行できること（拡張性の契約テスト）
10. **クールダウンのターン基準テスト** — `turnNumber` ベースで正しく失効すること
11. **タイル効果の失効テスト** — 指定ターン後に効果が切れ、`reset()` で残らないこと

**非同期テストの注意**: スケジューラは `await` で進むため、テストでは `ActionExecutor` と待機処理をモックして即時解決させる。実アニメーション時間に依存したテストは書かない。

## 9. 未決事項

1. **`interact` のコスト**。現在インタラクションは `InteractionSystem.update()` から毎フレーム自動発火しており、ターンを消費しない。これを明示的な行動にするか、自動発火のまま `timeCost: 0` とするか
2. **ターン番号の定義**。本設計では「プレイヤーが行動を完了するたびに +1」とした。速度差が入ると「プレイヤーが2回行動する間に敵が1回」という状況が起きるため、継続効果の体感時間がプレイヤー速度に依存する。論理時刻ベース（tick）へ変更する選択肢もある
3. **`moveSpeed` の分離**。現在 `EnemyStatProfile.moveSpeed`（6/4/2）はアニメーション速度である。段階 7 で行動速度として使うと、アニメーション速度の指定先が別途必要になる。`ActionSpeed` と `AnimationSpeed` を分けるか
4. **プレイヤーの速度変更**。加速アイテム・装備で `moveSpeed` を上げると連続行動が可能になる。バランス上許容するか、プレイヤーは固定速とするか
5. **`player_turn_started` / `enemy_turn_started` の最終的な扱い**。`turn_started` / `actor_turn_started` へ統合するか、UI 向けの通知として残すか。BU-4 の UI 境界と合わせて決める
6. **段階 7 の実施タイミング**。速度差の有効化はゲームバランスを変える唯一の段階であり、BU-3 に含めるか、R7 の敵タイプ拡張と合わせて別途行うか

## 10. スコープ外

- 状態異常システムそのもの（本フェーズでターン基盤を作り、実装は BU-2 の `StatSource` として別途）
- 行動のアンドゥ / リプレイ
- ターン単位のセーブ
- AI の意思決定アルゴリズムの改良（`EnemyBehaviorStrategy` の内部ロジック）
- ゲームバランス調整（段階 7 で速度差が入るため、値の調整は別途）
