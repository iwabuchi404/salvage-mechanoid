# BU-1: イベント契約の型付け — 設計ドキュメント

最終更新: 2026-08-16

親プラン: `docs/BRUSHUP_PLAN.md`

## 1. 目的

`EventSystem` はシステム間通信の唯一の土台でありながら、イベント名が文字列リテラル、ペイロードが `any` である。この状態で BU-2 〜 BU-4 が新しいイベントを追加すると、契約不整合が実行時まで検出されない事故が増え続ける。

本フェーズでは、**イベント名を定数化し、ペイロード型を宣言し、`on` / `emit` を型付きにする**。全面的なイベントバス再実装は行わない。

## 2. 現状の構造と問題

### 2.1 型が無い

```ts
// src/engine/events/EventSystem.ts:49,77
on(eventName: string, callback: (data: any) => void): void
emit(eventName: string, data: any = {}): void
```

イベント名の誤記もペイロードの不一致も、コンパイル時に検出されない。

### 2.2 実際に事故が起きている

R6.5 の D1 で `MovementComponent` が `ENTITY_MOVED` を `{ entityId, from, to }` で発行した際、同じイベント名を `TransformComponent` が `{ entityId, position, rotation, scale }` で発行し続けていた。結果:

- `WorldSystem.onEntityMoved()` が `data.position.x` を読めず TypeError（`EventSystem.processEvent` の try/catch に飲まれて `console.error` のみ）
- `EntitySystem` の索引更新が `data.from` を読めずフルスキャンにフォールバック

**両方とも全テストが緑のまま見逃された。** これは型の欠如が直接の原因である。

### 2.3 イベント名の定義場所が二重化している

`EventName` enum（`src/engine/types.ts:65-88`）に載っているのは 15 件。しかし実際に使われているイベント名は 40 件以上あり、大半は文字列リテラル直書きである。

enum に載っているもの: `entity_created` / `entity_destroyed` / `entity_moved` / `entity_collision` / `game_start` / `game_pause` / `game_resume` / `game_over` / `key_pressed` / `key_released` / `mouse_moved` / `mouse_clicked` / `ui_button_clicked` / `ui_window_opened` / `ui_window_closed`

enum に無い主なもの: `move_started` / `move_completed` / `direction_changed` / `health_changed` / `damage_taken` / `entity_died` / `entity_healed` / `attack_performed` / `player_attack_requested` / `player_attacked` / `player_turn_started` / `player_turn_ended` / `enemy_turn_started` / `enemy_action_started` / `enemy_attack_requested` / `turn_action_completed` / `floor_changed` / `floor_generated` / `portal_activated` / `portal_discovered` / `energy_recharged` / `tile_entered` / `tile_exited` / `tile_changed` / `tile_selected` / `tile_hovered` / `tile_visibility_changed` / `tile_explored` / `entity_visibility_changed` / `entity_selected` / `interaction_completed` / `item_found` / `item_dropped` / `skill_used` / `skill_learned` / `fov_update_requested` / `screen_clicked` / `screen_hovered` / `shake_requested` / `apply_tile_effect` / `all_enemies_defeated` / `game_clear`

さらに `EventName` enum に載っているにもかかわらず、UI 入力系（`key_pressed` / `mouse_clicked` / `ui_*`）は実際には誰も発行していない。

### 2.4 購読されているが発行されないイベントがある

調査の結果、以下は `.on()` で購読されているが `.emit()` される箇所が存在しない。

| イベント名 | 購読側 |
| --- | --- |
| `character_selected` | `Game.setupEventListeners()` |
| `enemy_selected` | `Game.setupEventListeners()` |
| `player_move_completed` | `InteractionSystem.setupEventListeners()` |
| `render_entity` | `RendererSystem` |

`character_selected` と `enemy_selected` は Game 内で「後方互換性のため残す」とコメントされているが、発行元が存在しないため実際には後方互換の対象が無い。これらは死んだリスナーである。

### 2.5 命名規則が統一されていない

- 過去形（発生の通知）: `move_completed`、`floor_changed`、`item_found`
- 命令形（要求）: `player_attack_requested`、`fov_update_requested`、`apply_tile_effect`
- 両方が混在: `player_attack`（要求）と `player_attacked`（通知）が別イベントとして共存

要求と通知の区別が名前から読み取れないため、購読側がどちらの意味で使うべきか判断できない。

## 3. 設計方針

1. **イベント名とペイロード型を1箇所で対にして宣言する**。`EventMap` インターフェースを唯一の定義場所とする
2. **`EventSystem.on` / `emit` をジェネリックにする**。イベント名から自動的にペイロード型が決まるようにする
3. **既存の呼び出しは段階的に移行する**。文字列リテラルを許容する後方互換シグネチャを残し、移行完了後に削除する
4. **全面的な型付きイベントバス実装は行わない**。バッファリング・優先度・非同期配送などの機構は現状のまま
5. **要求（command）と通知（event）を命名で区別する**。`*_requested` を要求、それ以外を通知とする

## 4. 型定義

### 4.1 イベントマップ

新規ファイル `src/engine/events/EventMap.ts` に定義する。

```ts
import { Vector3, Direction, TileType } from '../types';
import { Entity } from '../entity/Entity';

/**
 * イベント名とペイロード型の対応表。
 *
 * ここが唯一のイベント契約の定義場所。
 * 新しいイベントを追加する場合は必ずここへ宣言する。
 */
export interface EventMap {
  // ===== Entity ライフサイクル =====
  entity_created: { entity: Entity };
  entity_destroyed: { entity: Entity };
  entity_moved: {
    entityId: string;
    from: Vector3;
    to: Vector3;
    position: Vector3;
  };
  entity_died: { entityId: string; killerId?: string };

  // ===== 移動 =====
  move_started: { entityId: string; from: Vector3; to: Vector3 };
  move_completed: { entityId: string; position: Vector3 };
  direction_changed: { entityId: string; direction: Direction };

  // ===== 戦闘 =====
  player_attack_requested: { playerId: string };
  enemy_attack_requested: { enemyId: string; targetId: string };
  attack_performed: { attackerId: string; targetId: string; damage: number };
  damage_taken: { entityId: string; damage: number; attackerId?: string };
  health_changed: { entityId: string; currentHp: number; maxHp: number };
  entity_healed: { entityId: string; amount: number };

  // ===== ターン =====
  player_turn_started: Record<string, never>;
  player_turn_ended: Record<string, never>;
  enemy_turn_started: Record<string, never>;
  enemy_action_started: { enemyId: string };
  turn_action_completed: { entityId: string };

  // ===== フロア =====
  floor_changed: { floor: number; maxFloors: number };
  floor_generated: { floor: number; stageType: string; difficulty: number };
  portal_activated: { playerId: string; position: Vector3 };
  portal_discovered: { entityId: string; currentFloor: number };

  // ===== タイル =====
  tile_entered: { entityId: string; tilePosition: Vector3; tileType: TileType };
  tile_changed: { position: Vector3; type: TileType };
  tile_visibility_changed: {
    x: number;
    y: number;
    visible: boolean;
    explored: boolean;
    roomId?: string;
  };
  entity_visibility_changed: { entityId: string; inFOV: boolean };
  fov_update_requested: { entityId: string };

  // ===== インタラクション =====
  interaction_completed: { playerId: string; objectId: string; position: Vector3 };
  item_found: { itemEntity: unknown; position: Vector3 };
  energy_recharged: { playerId: string; amount: number; position: Vector3 };

  // ===== 入力・選択 =====
  screen_clicked: { screenX: number; screenY: number };
  screen_hovered: { screenX: number; screenY: number };
  tile_selected: { tile: unknown; position: { x: number; y: number } };
  tile_hovered: { position: { x: number; y: number } | null };
  entity_selected: { entityId: string; entity: Entity; position: { x: number; y: number } };

  // ===== スキル =====
  skill_used: { skillId: string; entityId: string };
  skill_learned: { skillId: string };

  // ===== ゲーム進行 =====
  game_over: { score?: number };
  game_clear: { floor: number };
  all_enemies_defeated: Record<string, never>;
}

/** 宣言済みのイベント名 */
export type EventKey = keyof EventMap;
```

### 4.2 EventSystem のジェネリック化

```ts
export class EventSystem implements System {
  /** 型付き購読 */
  on<K extends EventKey>(eventName: K, callback: (data: EventMap[K]) => void): void;
  /** 移行期間中の後方互換シグネチャ（移行完了後に削除する） */
  on(eventName: string, callback: (data: any) => void): void;
  on(eventName: string, callback: (data: any) => void): void {
    // 実装は現行のまま
  }

  off<K extends EventKey>(eventName: K, callback: (data: EventMap[K]) => void): void;
  off(eventName: string, callback: (data: any) => void): void;
  off(eventName: string, callback: (data: any) => void): void {
    // 実装は現行のまま
  }

  emit<K extends EventKey>(eventName: K, data: EventMap[K]): void;
  emit(eventName: string, data?: any): void;
  emit(eventName: string, data: any = {}): void {
    // 実装は現行のまま
  }
}
```

**オーバーロードで型付きシグネチャを先に置く**ことで、`EventMap` に宣言済みの名前は型検査され、未宣言の名前は従来どおり通る。移行を段階的に進められる。

移行完了後に後方互換シグネチャを削除すれば、未宣言のイベント名がコンパイルエラーになる。

### 4.3 イベント名定数の扱い

`EventName` enum は**削除せず、`EventMap` のキーと一致させる**。enum は「よく使う名前の短縮参照」として残し、契約の正本は `EventMap` とする。

enum に載っていて実際には未使用のもの（`key_pressed` / `key_released` / `mouse_moved` / `mouse_clicked` / `ui_button_clicked` / `ui_window_opened` / `ui_window_closed` / `game_start` / `game_pause` / `game_resume` / `entity_collision`）は、BU-4（UI 境界）で使うかどうかを判断してから削除する。本フェーズでは触らない。

## 5. 移行手順

### 段階 1: EventMap の追加（1 コミット）

1. `src/engine/events/EventMap.ts` を新規作成し、現在使用中の全イベントを宣言する
2. この時点では誰も参照しない。型定義のみ
3. `EventMap` のキーが、実際に `emit` されている名前を網羅していることを確認するテストを追加する

### 段階 2: EventSystem のジェネリック化（1 コミット）

1. `on` / `off` / `emit` にオーバーロードを追加する
2. 実装本体は変更しない
3. 既存コードは後方互換シグネチャに流れるため、この時点では何も壊れない
4. 型付き経路の動作を確認するテストを追加する

### 段階 3: 呼び出し側の移行（1〜2 コミット）

1. `emit` 側から移行する。型エラーが出た箇所はペイロードの不整合であり、そのまま修正対象
2. 次に `on` 側を移行する
3. 対象順序は依存の少ないものから: `fov` → `interaction` → `combat` → `turn` → `world` → `entity` → `game`

### 段階 4: 死んだリスナーの削除と命名の整理（1 コミット）

1. 発行元が存在しない購読を削除する
   - `Game`: `character_selected`、`enemy_selected`
   - `InteractionSystem`: `player_move_completed`
   - `RendererSystem`: `render_entity`
2. `player_attack` と `player_attacked` の使い分けを整理する
   - 要求は `player_attack_requested` に統一
   - 通知は `attack_performed` に統一
   - `player_attack` / `player_attacked` は移行後に削除
3. `apply_tile_effect` の要求・通知の区別を確認する

**注意**: `player_attacked` は `TurnSystem` のターン進行トリガーの1つであり、`PlayerPresentation` の攻撃演出トリガーでもある。BU-3（ターンモデル）で行動モデルへ移す対象なので、**本フェーズでは名前の整理までに留め、トリガー構造は変更しない**。

### 段階 5: 後方互換シグネチャの削除（1 コミット、任意）

全呼び出しの移行が完了してから実施する。BU-2 〜 BU-4 の途中で新しいイベントを追加する可能性があるため、**BU-4 完了後に回してもよい**。

## 6. 完了条件

- `EventMap` に、実際に発行されている全イベントが宣言されている
- `EventSystem.on` / `emit` が、宣言済みイベントについて型検査される
- ペイロードの不整合がコンパイルエラーになることを、テストで確認できる
- 発行元の無い購読が存在しない
- 既存 603 件のテストが維持される
- 全テスト出力に `Error in event listener` が現れない

## 7. テスト方針

追加するテスト:

1. **契約網羅テスト** — `EventMap` のキー集合が、src 配下で `emit` されている名前集合を包含することを検証する（`EntityMovedContract.spec.ts` と同様に、ソースを走査する形で実装可能）
2. **型テスト** — 誤ったペイロードで `emit` した場合に型エラーになることを、`@ts-expect-error` を使って検証する
3. **孤児検出テスト** — `on` されているが `emit` されていない名前を検出する（削除の回帰防止）

既存の `EntityMovedContract.spec.ts` は、本フェーズ完了後も残す。型が通っても実行時の購読者の組み合わせを検証する価値がある。

## 8. 未決事項

1. `EventName` enum を最終的に廃止して `EventMap` のキーに一本化するか、両立させるか
2. `item_found` のペイロード `itemEntity` は現在 `Item` の実体を渡している。Entity をイベントに乗せるか、ID のみにして受信側で解決するか（BU-4 の UI 境界と関連）
3. `entity_selected` が `Entity` 実体を渡している点も同様。UI へドメインオブジェクトを露出させ続けるかは BU-4 で決める

## 9. スコープ外

- イベントバッファリング機構の変更
- 非同期イベント配送
- イベントの優先度・順序保証
- リスナーの自動解除機構（WeakRef など）
- `EventName` enum の未使用エントリの削除（BU-4 で判断）
