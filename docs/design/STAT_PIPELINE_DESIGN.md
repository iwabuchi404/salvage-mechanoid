# BU-2: ステータスパイプラインの一本化 — 設計ドキュメント

最終更新: 2026-08-16

親プラン: `docs/BRUSHUP_PLAN.md`

## 1. 目的

プレイヤーのステータスが3箇所に分散し、しかも「導出」ではなく「一度きりの複写」で繋がっている。このため装備変更・アイテム効果・状態異常といった**ステータスを動かす機能が原理的に実装できない**。

本フェーズでは、実効ステータスの正本を1つにし、**すべての変化要因が同じ経路で反映される**構造を作る。

## 2. 現状の構造と問題

### 2.1 正本が3つある

| 保持場所 | 持っている値 | 参照元 |
| --- | --- | --- |
| `gameStore.player.status` | level / hp / maxHp / energy / maxEnergy / strength / defense / viewRadius | UI、`Player`、`Game` |
| `HealthComponent` | currentHp / maxHp / defense / regenerationRate | `CombatSystem`、`FloorManager` |
| `EnergyComponent` | currentEnergy / maxEnergy | `Player`、`FloorManager` |
| `PartsSystem.getStats()` | maxHp / defense / maxEnergy / totalWeight / carryCapacity / passiveEffects | `Game` の初期化時のみ |

### 2.2 Parts → ステータスが導出になっていない

`PartsSystem.getStats()` の呼び出し元は `src/game/Game.ts:298`（`updatePlayerStatsFromParts`）の1箇所のみで、`setupInitialLoadout()` からしか呼ばれない。つまり**初期化時に一度だけ gameStore へ複写される**。

- `PartsSystem` はイベントを一切発行しない（`emit` の出現数 0）
- `setLoadout()` / `resetLoadout()` を実行しても、誰も再計算しない
- `getPassiveEffects()`（`PartsSystem.ts:328`）は消費者が存在しない

結果として、**この作品の看板機能であるパーツシステムが、ゲーム値を駆動できない**。

### 2.3 HP に同期しない書き込み経路が2本ある

```text
経路 A: CombatSystem → HealthComponent.takeDamage()
          → health_changed イベント → Player.ts:118 が gameStore へ反映

経路 B: gameStore.applyItemEffect() の heal（gameStore.ts:158-159）
          → gameStore だけ書き換え。HealthComponent は知らない
```

**現在の不具合**: 回復アイテムを使うと UI の HP は増えるが `HealthComponent.currentHp` は変わらない。次に被弾すると経路 A が走り、HealthComponent 由来の値で gameStore が上書きされ、回復分が消える。

`gameStore.damagePlayer()`（`gameStore.ts:55-57`）も同じ問題を持つ。

### 2.4 攻撃力が生成時スナップショットになっている

`src/engine/entity/Player.ts:48`

```ts
this.addComponent(new AttackPowerComponent(this.gameStore.player.status.strength + 5));
```

コンストラクタ時点の値で固定される。`gameStore.ts:175` の `stat_boost` アイテム（`strength += effect.value`）は UI 表示だけ増やし、実ダメージは変わらない。

さらに `Player.ts:241` は `player_attacked` イベントの `power` に素の `strength`（10）を入れており、戦闘計算側の 15 と別値になっている。

### 2.5 ドメインが UI ストアへ依存している

`src/engine/entity/Player.ts:12,23` が `useGameStore()` を import し、初期値の読み取りと結果の書き戻しの両方を行っている。

C1 でドメイン層から PixiJS を追い出したが、**状態ストアへの依存が残っている**。描画より結合が重いため、こちらのほうが問題が大きい。

### 2.6 viewRadius も同じ構造

A2 で `viewRadius` を FOV 計算へ接続したが、値の流れは `gameStore → Player._viewRadius`（コンストラクタで複写）である。装備で視界を変える機能を足すと、また同じ複写を1本増やすことになる。

## 3. 設計方針

1. **実効ステータスの正本を `StatsComponent` に置く**。ドメイン側に1つだけ持つ
2. **実効値は「基礎値 + 修飾子」から導出する**。修飾子の追加・削除で必ず再計算される
3. **装備・アイテム・状態異常・レベルを、すべて同じ「修飾子」として表現する**。要因ごとに別経路を作らない
4. **`HealthComponent` / `EnergyComponent` は「現在値」だけを持つ**。最大値は `StatsComponent` から導出する
5. **`gameStore` は表示用の投影（read model）にする**。ドメインからストアへは一方向。ストアからドメインへの書き戻しは廃止する
6. **`Player` から `useGameStore()` を削除する**

### 3.1 目標とする依存方向

```text
PartsSystem（装備）─┐
StatusEffect（状態異常）─┤
InventoryItem（永続強化）─┤
LevelProgression（成長）─┘
        │ StatModifier を提供
        ↓
   StatsComponent（実効ステータスの正本）
        │ stats_changed
        ├→ HealthComponent / EnergyComponent（最大値の更新）
        ├→ FOVSystem（viewRadius）
        ├→ CombatSystem（attackPower / defense）
        └→ gameStore（表示用の投影）
                 ↓
               UI（読み取りのみ）
```

## 4. 型定義

### 4.1 ステータスキーと修飾子

新規ファイル `src/engine/entity/stats/StatTypes.ts`

```ts
/**
 * 実効ステータスとして管理する値のキー。
 *
 * ここに無い値（level、score など）は StatsComponent の管理対象外とし、
 * 進行状態として別に保持する。
 */
export type StatKey =
  | 'maxHp'
  | 'maxEnergy'
  | 'defense'
  | 'attackPower'
  | 'viewRadius'
  | 'moveSpeed'
  | 'carryCapacity';

/** 修飾子の適用方法 */
export type StatOp = 'add' | 'multiply';

/**
 * ステータス修飾子。
 *
 * 装備・状態異常・永続強化など、あらゆる変化要因をこの形で表現する。
 * sourceId は同一要因の修飾子をまとめて外すために使う。
 */
export interface StatModifier {
  readonly stat: StatKey;
  readonly op: StatOp;
  readonly value: number;
  /** 修飾子の出所（例: "parts:head", "effect:poison", "item:strength_chip"） */
  readonly sourceId: string;
}

/** 修飾子を提供できるもの（装備、状態異常など） */
export interface StatSource {
  /** この要因を識別する ID（sourceId のプレフィックスに使う） */
  readonly sourceId: string;
  /** 現在の修飾子一覧を返す */
  getModifiers(): readonly StatModifier[];
}

/** 実効ステータス（導出結果） */
export type EffectiveStats = Readonly<Record<StatKey, number>>;
```

### 4.2 導出関数（純粋関数）

新規ファイル `src/engine/entity/stats/resolveStats.ts`

```ts
import { StatKey, StatModifier, EffectiveStats } from './StatTypes';

/**
 * 基礎値と修飾子から実効ステータスを導出する（純粋関数）。
 *
 * 適用順序: 基礎値 → add をすべて加算 → multiply をすべて乗算 → 切り捨て
 * 順序を固定することで、修飾子の登録順に結果が依存しないようにする。
 */
export function resolveStats(
  base: EffectiveStats,
  modifiers: readonly StatModifier[]
): EffectiveStats {
  const result = { ...base } as Record<StatKey, number>;

  for (const mod of modifiers) {
    if (mod.op === 'add') result[mod.stat] += mod.value;
  }
  for (const mod of modifiers) {
    if (mod.op === 'multiply') result[mod.stat] *= mod.value;
  }
  for (const key of Object.keys(result) as StatKey[]) {
    result[key] = Math.floor(result[key]);
  }

  return Object.freeze(result);
}
```

`EnemyStatProfile`（`resolveEnemyStats`）と同じ「純データ + 純粋関数」の形にそろえる。

### 4.3 StatsComponent

新規ファイル `src/engine/entity/components/Stats.ts`

```ts
export class StatsComponent implements Component {
  type = 'stats';
  entity: Entity | null = null;

  private base: EffectiveStats;
  private sources: Map<string, StatSource> = new Map();
  private cached: EffectiveStats | null = null;

  constructor(base: EffectiveStats) {
    this.base = Object.freeze({ ...base });
  }

  /** 修飾子の供給元を登録する（装備、状態異常など） */
  addSource(source: StatSource): void;
  /** 供給元を解除する */
  removeSource(sourceId: string): void;
  /** 供給元の内容が変わったことを通知し、再計算させる */
  invalidate(): void;

  /** 実効ステータスを取得する（キャッシュあり） */
  get(): EffectiveStats;
  /** 単一のステータス値を取得する */
  getValue(key: StatKey): number;
}
```

`invalidate()` は再計算後に `stats_changed` イベントを発行する。ペイロードは BU-1 の `EventMap` へ追加する。

```ts
stats_changed: { entityId: string; stats: EffectiveStats; previous: EffectiveStats };
```

### 4.4 各 System 側の受け取り

- `HealthComponent`: `maxHp` を自前で保持せず、`stats_changed` を受けて `setMaxHp()` する。現在 HP は上限でクランプする
- `EnergyComponent`: 同様に `setMaxEnergy()`
- `CombatSystem`: `AttackPowerComponent` を廃止し、`StatsComponent.getValue('attackPower')` を毎回参照する
- `FOVSystem`: `player.viewRadius` を `StatsComponent.getValue('viewRadius')` に置き換える
- `PartsSystem`: `StatSource` を実装し、`setLoadout()` で `invalidate()` を呼ぶ

## 5. 移行手順

各段階は独立してコミットでき、途中で止めてもゲームは動作する。

### 段階 1: 型と純粋関数の追加（1 コミット）

1. `StatTypes.ts`、`resolveStats.ts` を追加する
2. `resolveStats` の単体テストを追加する（適用順序、切り捨て、修飾子ゼロ件）
3. この時点では誰も参照しない

### 段階 2: StatsComponent の追加（1 コミット）

1. `StatsComponent` を追加し、`Player` に付与する。基礎値は現在の gameStore 初期値と同じ値にする
2. まだ誰も `StatsComponent` を読まない（既存経路と併存）
3. `stats_changed` を `EventMap` へ追加する
4. 単体テストで、供給元の追加・削除・invalidate が実効値へ反映されることを確認する

### 段階 3: PartsSystem を StatSource 化する（1〜2 コミット）

1. `PartsSystem` に `StatSource` を実装する。`getStats()` の結果を `StatModifier[]` へ変換する
2. `setLoadout()` / `resetLoadout()` で `StatsComponent.invalidate()` を呼ぶ
3. `Game.updatePlayerStatsFromParts()` の複写を削除し、`StatsComponent` への供給元登録に置き換える
4. **この段階で「装備を変えると実効ステータスが変わる」が成立する**
5. `passiveEffects` の扱いを決める（下記 未決事項 2）

### 段階 4: Health / Energy の最大値を導出へ（1〜2 コミット）

1. `HealthComponent` が `stats_changed` を購読し、`maxHp` を更新する
2. `EnergyComponent` が同様に `maxEnergy` を更新する
3. 最大値低下時に現在値をクランプする挙動をテストで固定する
4. `Player` のコンストラクタが gameStore から maxHp / maxEnergy を読む処理を削除する

### 段階 5: 攻撃力と視界を導出へ（1 コミット）

1. `CombatSystem` が `StatsComponent.getValue('attackPower')` を参照する
2. `AttackPowerComponent` を削除する（Enemy 側は `EnemyStatProfile` から `StatsComponent` の基礎値へ移す）
3. `FOVSystem` が `StatsComponent.getValue('viewRadius')` を参照する
4. `Player._viewRadius` / `setViewRadius()` を削除する
5. **この段階で「攻撃力アップアイテムが実際に効く」が成立する**

### 段階 6: アイテム効果を修飾子へ（1〜2 コミット）

1. `gameStore.applyItemEffect()` からドメイン状態への直接書き込みを撤去する
2. 効果の種別ごとに反映先を決める
   - `heal` → `HealthComponent.heal()`
   - `energy` → `EnergyComponent.restore()`（既存の handlers 経由を維持）
   - `stat_boost` → 永続 `StatModifier` として `StatsComponent` へ追加
   - `special` → 現状維持（`setPortalActive`）
3. `gameStore.damagePlayer()` を削除し、ダメージ経路を `HealthComponent` に一本化する
4. **この段階で「回復アイテムが実際に効く」が成立する**

### 段階 7: gameStore を投影に変える（1〜2 コミット）

1. `Player` が `stats_changed` / `health_changed` / エネルギー変化を購読して gameStore へ書き込む処理を、専用の投影モジュールへ移す（例: `src/game/StatsProjection.ts`）
2. `Player.ts` から `useGameStore()` の import を削除する
3. gameStore の `player.status` を「書き込み禁止・表示専用」とコメントで明示する
4. `DomainRenderingIndependence.spec.ts` と同様の import ガードテストを追加する（`Player.ts` が `stores/` を import しないこと）

## 6. 完了条件

- プレイヤーの実効ステータスの正本が `StatsComponent` の1つになっている
- `PartsSystem` の装備変更が、`HealthComponent` / `EnergyComponent` / `CombatSystem` / `FOVSystem` へ伝播する
- 回復アイテムを使うと `HealthComponent.currentHp` が実際に増える
- 攻撃力アップアイテムを使うと実ダメージが増える
- `Player.ts` が `stores/gameStore` を import しない
- 既定の装備・アイテム未使用状態での実効値が、現行と一致する
- 既存 603 件のテストが維持される

## 7. テスト方針

追加するテスト:

1. `resolveStats` の純粋関数テスト（適用順序、multiply の可換性、切り捨て）
2. `StatsComponent` の供給元追加・削除・invalidate テスト
3. **装備変更の伝播テスト** — `setLoadout()` 後に `HealthComponent.maxHp` が変わることを検証
4. **回復アイテムの結線テスト** — `useItem('heal')` 後に `HealthComponent.currentHp` が増えることを検証（現在の不具合の回帰防止）
5. **攻撃力アイテムの結線テスト** — `stat_boost` 適用後に `CombatSystem` のダメージが増えることを検証
6. **最大値低下時のクランプテスト** — 装備を外して maxHp が下がったとき currentHp が上限を超えないこと
7. import ガードテスト — `Player.ts` が `stores/` を import しないこと

## 8. 未決事項

1. **`strength` と `level` の扱い**。`strength` は現在 gameStore にのみ存在し、`attackPower` の基礎値として使われている。`StatKey` に `attackPower` として吸収するか、`strength` を基礎値として別に持つか。`level` は進行状態であり `StatKey` に含めない想定だが、レベルによるステータス成長を修飾子として表現するかは要判断
2. **`passiveEffects` の表現**。単純な数値修飾子で表せるものは `StatModifier` へ、条件付き効果（「HP が半分以下のとき攻撃力+20%」など）は別機構が必要。本フェーズでは数値修飾子で表せるものだけを対象とし、条件付き効果はスコープ外とするか
3. **Enemy への適用範囲**。`EnemyStatProfile` は既に純データ化されているため、Enemy にも `StatsComponent` を付けて統一するか、プレイヤーのみとするか。統一すると敵のバフ・デバフが同じ仕組みで書けるが、変更範囲は広がる
4. **`moveSpeed` の意味**。現在は移動アニメーション速度であり、BU-3（ターンモデル）で行動速度として再定義する可能性がある。`StatKey` に含めるかは BU-3 の設計と合わせて決める
5. **修飾子の永続化**。`stat_boost` アイテムによる永続強化はセーブ対象になる。修飾子リストをシリアライズ可能な形にしておくか（本プランのスコープ外だが、型設計に影響する）

## 9. スコープ外

- 敵のステータス修飾子（未決事項 3 で統一しない判断をした場合）
- 条件付きパッシブ効果の機構
- 状態異常システムそのもの（BU-3 のターンモデル完成後に、本フェーズの `StatSource` として実装する）
- セーブ / ロード
- ゲームバランス調整（既定値は現行と一致させる）
