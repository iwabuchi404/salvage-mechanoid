# ECSシステム移行: 流用可能機能 vs 新規作成機能 詳細分析

## 📋 分析概要

このドキュメントは、旧システムから新ECSシステムへの移行において、**どの機能を流用できるか**、**どの機能を新規作成する必要があるか**を詳細に分析したものです。

---

## 🔍 分析方法

1. **新システムの既存実装を確認**
2. **旧システムの実装を確認**
3. **互換性と統合可能性を評価**
4. **推奨される実装方法を決定**

---

## 📊 総合評価サマリー

| 機能 | 旧システム | 新システム | 推奨アプローチ | 優先度 |
|------|----------|----------|--------------|--------|
| **1. ターン管理** | ✅ 完全実装 | ❌ なし | 🔄 **流用可能** | 🔴 最優先 |
| **2. ビジュアルエフェクト** | ✅ 完全実装 | ⚠️ 基盤あり | 🔄 **流用+拡張** | 🔴 最優先 |
| **3. サウンド** | ✅ 完全実装 | ❌ なし | 🔄 **そのまま流用** | 🔴 最優先 |
| **4. 戦闘システム** | ✅ 完全実装 | ⚠️ 部分実装 | 🆕 **新規作成** | 🔴 最優先 |
| **5. カメラ追従** | ✅ 完全実装 | ✅ 実装済み | ✅ **既存使用** | 🟢 確認のみ |
| **6. イベントオブジェクト** | ✅ 完全実装 | ❌ なし | 🆕 **新規作成** | 🟡 高 |
| **7. 入力システム** | ✅ Stage内実装 | ❌ なし | 🆕 **新規作成** | 🟡 高 |
| **8. エネルギー管理** | ✅ 完全実装 | ⚠️ 部分実装 | 🔄 **流用+拡張** | 🟡 高 |
| **9. ゲームループ** | ✅ 完全実装 | ✅ 実装済み | ✅ **既存使用** | 🟢 確認のみ |
| **10. 階層移動** | ⚠️ 未完成 | ❌ なし | 🆕 **新規作成** | 🟢 低 |

### 凡例
- 🔄 **流用可能**: 旧システムのコードをそのまま、または軽微な修正で使用可能
- 🆕 **新規作成**: ECSアーキテクチャに合わせて新規実装が必要
- ✅ **既存使用**: 新システムに既に実装済み

---

## 🔄 流用可能な機能（詳細分析）

### 1. ターン管理システム ⭐ **最優先・完全流用可能**

#### 旧システムの実装
- **ファイル**: `src/common/TurnManager.ts`
- **状態**: ✅ 完全実装、Singleton パターン
- **依存関係**: `Character`, `Enemy` クラスのみ

#### 流用可能性評価
| 項目 | 評価 | 理由 |
|------|------|------|
| **コード品質** | ⭐⭐⭐⭐⭐ | シンプルで明確なロジック |
| **依存関係** | ⭐⭐⭐⭐⭐ | 最小限の依存 |
| **ECS互換性** | ⭐⭐⭐⭐ | Systemとして統合可能 |
| **テスト容易性** | ⭐⭐⭐⭐⭐ | 独立したロジック |

#### 推奨実装方法: **Systemラッパー作成**

```typescript
// src/engine/turn/TurnSystem.ts (新規作成)
import { System } from '../System';
import { Engine } from '../Engine';
import { TurnManager, TurnPhase } from '../../common/TurnManager'; // 流用
import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';

/**
 * ターン管理システム - 旧TurnManagerをECSに統合
 */
export class TurnSystem implements System {
  private turnManager: TurnManager;
  private engine: Engine | null = null;
  private eventSystem: EventSystem | null = null;
  private entitySystem: EntitySystem | null = null;

  constructor() {
    // 既存のTurnManagerをそのまま使用
    this.turnManager = TurnManager.getInstance();
  }

  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event');
    this.entitySystem = engine.getSystem<EntitySystem>('entity');

    // プレイヤーと敵を取得してTurnManagerに登録
    const player = this.entitySystem?.getEntitiesByTag('player')[0];
    const enemies = this.entitySystem?.getEntitiesByTag('enemy') || [];

    if (player && enemies) {
      // 注: Character/Enemyインスタンスへの変換が必要
      // this.turnManager.initialize(player, enemies);
    }

    console.log('TurnSystem initialized');
  }

  update(): void {
    // ターン管理の更新処理（必要に応じて）
  }

  /**
   * 新しいターンを開始
   */
  startTurn(): TurnPhase {
    return this.turnManager.startTurn();
  }

  /**
   * 次のターンに進む
   */
  nextTurn(): TurnPhase {
    const phase = this.turnManager.nextTurn();
    
    // イベント発行
    this.eventSystem?.emit('turn_changed', {
      phase: phase,
      currentCharacter: this.turnManager.getCurrentCharacter(),
    });
    
    return phase;
  }

  /**
   * 現在のフェーズを取得
   */
  getCurrentPhase(): TurnPhase {
    return this.turnManager.getCurrentPhase();
  }

  /**
   * 現在のキャラクターを取得
   */
  getCurrentCharacter(): any {
    return this.turnManager.getCurrentCharacter();
  }
}
```

#### 必要な作業
1. ✅ `TurnManager.ts` をそのまま使用
2. ⬜ `TurnSystem.ts` を作成（上記コード）
3. ⬜ `Character`/`Enemy` の旧クラスとECS Entityの橋渡し実装
4. ⬜ `Game.ts` に `TurnSystem` を登録

#### 工数見積もり
- **実装**: 2-3時間
- **テスト**: 1-2時間
- **合計**: 3-5時間

---

### 2. サウンドシステム ⭐ **最優先・完全流用可能**

#### 旧システムの実装
- **ファイル**: `src/common/SoundManager.ts`
- **状態**: ✅ 完全実装、Singleton パターン
- **依存関係**: `@pixi/sound` のみ

#### 流用可能性評価
| 項目 | 評価 | 理由 |
|------|------|------|
| **コード品質** | ⭐⭐⭐⭐⭐ | 完璧なSingleton実装 |
| **依存関係** | ⭐⭐⭐⭐⭐ | 外部ライブラリのみ |
| **ECS互換性** | ⭐⭐⭐⭐⭐ | 完全に独立 |
| **テスト容易性** | ⭐⭐⭐⭐⭐ | モック化容易 |

#### 推奨実装方法: **Systemラッパー作成**

```typescript
// src/engine/audio/AudioSystem.ts (新規作成)
import { System } from '../System';
import { Engine } from '../Engine';
import { SoundManager } from '../../common/SoundManager'; // そのまま流用
import { EventSystem } from '../events/EventSystem';

/**
 * オーディオシステム - 旧SoundManagerをECSに統合
 */
export class AudioSystem implements System {
  private soundManager: SoundManager;
  private engine: Engine | null = null;
  private eventSystem: EventSystem | null = null;

  constructor() {
    // 既存のSoundManagerをそのまま使用
    this.soundManager = SoundManager.getInstance();
  }

  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event');

    // サウンドファイルを読み込み
    this.soundManager.loadSounds();

    // イベントリスナーを設定
    this.setupEventListeners();

    console.log('AudioSystem initialized');
  }

  update(): void {
    // 必要に応じて更新処理
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) return;

    // 攻撃時のSE
    this.eventSystem.on('player_attack', () => {
      this.playSE('attack');
    });

    // 爆発時のSE
    this.eventSystem.on('enemy_destroyed', () => {
      this.playSE('explosion');
    });

    // ダメージ時のSE
    this.eventSystem.on('damage_taken', () => {
      // this.playSE('damage');
    });
  }

  /**
   * BGMを再生
   */
  playBGM(key: string): void {
    this.soundManager.playBGM(key);
  }

  /**
   * BGMを停止
   */
  stopBGM(): void {
    this.soundManager.stopBGM();
  }

  /**
   * SEを再生
   */
  playSE(key: string): void {
    this.soundManager.playSE(key);
  }

  /**
   * ボリュームを設定
   */
  setVolume(volume: number): void {
    this.soundManager.setVolume(volume);
  }

  /**
   * ミュート
   */
  mute(): void {
    this.soundManager.mute();
  }

  /**
   * ミュート解除
   */
  unmute(): void {
    this.soundManager.unmute();
  }
}
```

#### 必要な作業
1. ✅ `SoundManager.ts` をそのまま使用
2. ⬜ `AudioSystem.ts` を作成（上記コード）
3. ⬜ イベントリスナーの設定
4. ⬜ `Game.ts` に `AudioSystem` を登録

#### 工数見積もり
- **実装**: 1-2時間
- **テスト**: 1時間
- **合計**: 2-3時間

---

### 3. ビジュアルエフェクトシステム ⭐ **最優先・流用+拡張**

#### 旧システムの実装
- **ファイル**: 
  - `src/common/EffectManager.ts` (スプライトエフェクト)
  - `src/common/VisualEffect.ts` (パーティクルエフェクト)
- **状態**: ✅ 完全実装
- **依存関係**: PIXI.js のみ

#### 新システムの状況
- **既存**: `SpriteComponent` が `sprite.tint` などを制御可能
- **不足**: エフェクト管理システムがない

#### 流用可能性評価
| 項目 | 評価 | 理由 |
|------|------|------|
| **コード品質** | ⭐⭐⭐⭐ | 良好な設計 |
| **依存関係** | ⭐⭐⭐⭐ | PIXI.Spriteのみ |
| **ECS互換性** | ⭐⭐⭐ | 一部調整が必要 |
| **テスト容易性** | ⭐⭐⭐⭐ | 独立したロジック |

#### 推奨実装方法: **Systemラッパー + Componentの作成**

```typescript
// src/engine/effects/EffectSystem.ts (新規作成)
import { System } from '../System';
import { Engine } from '../Engine';
import { EffectManager } from '../../common/EffectManager'; // 流用
import { onCharacterDestroyed } from '../../common/VisualEffect'; // 流用
import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { RendererSystem } from '../graphics/RendererSystem';
import { SpriteComponent } from '../entity/components/Sprite';
import * as PIXI from 'pixi.js';

/**
 * エフェクトシステム - 旧EffectManagerをECSに統合
 */
export class EffectSystem implements System {
  private engine: Engine | null = null;
  private eventSystem: EventSystem | null = null;
  private entitySystem: EntitySystem | null = null;
  private rendererSystem: RendererSystem | null = null;

  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event');
    this.entitySystem = engine.getSystem<EntitySystem>('entity');
    this.rendererSystem = engine.getSystem<RendererSystem>('renderer');

    // イベントリスナーを設定
    this.setupEventListeners();

    console.log('EffectSystem initialized');
  }

  update(): void {
    // EffectManagerの更新は内部で自動的に行われる
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) return;

    // ダメージエフェクト
    this.eventSystem.on('damage_taken', (data) => {
      this.playDamageEffect(data.entityId);
    });

    // 回復エフェクト
    this.eventSystem.on('health_recovered', (data) => {
      this.playHealEffect(data.entityId);
    });

    // 爆発エフェクト
    this.eventSystem.on('enemy_destroyed', (data) => {
      this.playExplosionEffect(data.position);
    });

    // 攻撃エフェクト
    this.eventSystem.on('attack_performed', (data) => {
      this.playAttackEffect(data.entityId);
    });
  }

  /**
   * ダメージエフェクトを再生
   */
  async playDamageEffect(entityId: string): Promise<void> {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) return;

    const spriteComponent = entity.getComponent<SpriteComponent>('sprite');
    if (!spriteComponent) return;

    const sprite = spriteComponent.getSprite();
    if (sprite) {
      // 既存のEffectManagerを使用
      await EffectManager.applyEffect(sprite, 'damage');
    }
  }

  /**
   * 回復エフェクトを再生
   */
  async playHealEffect(entityId: string): Promise<void> {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) return;

    const spriteComponent = entity.getComponent<SpriteComponent>('sprite');
    if (!spriteComponent) return;

    const sprite = spriteComponent.getSprite();
    if (sprite) {
      await EffectManager.applyEffect(sprite, 'heal');
    }
  }

  /**
   * 攻撃エフェクトを再生
   */
  async playAttackEffect(entityId: string): Promise<void> {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) return;

    const spriteComponent = entity.getComponent<SpriteComponent>('sprite');
    if (!spriteComponent) return;

    const sprite = spriteComponent.getSprite();
    if (sprite) {
      await EffectManager.applyEffect(sprite, 'attack');
    }
  }

  /**
   * 爆発エフェクトを再生
   */
  playExplosionEffect(position: { x: number; y: number }): void {
    if (!this.rendererSystem) return;

    // 既存のonCharacterDestroyedを使用
    const explosionContainer = onCharacterDestroyed(position, 40);
    
    // レンダラーのステージに追加
    const app = this.rendererSystem.getApp();
    if (app) {
      app.stage.addChild(explosionContainer);
    }
  }
}
```

```typescript
// src/engine/entity/components/Sprite.ts (拡張)
export class SpriteComponent implements Component {
  // ... 既存のコード ...

  /**
   * スプライトを取得（エフェクトシステム用）
   */
  getSprite(): PIXI.Sprite | null {
    return this.sprite;
  }

  // ... 既存のコード ...
}
```

#### 必要な作業
1. ✅ `EffectManager.ts` をそのまま使用
2. ✅ `VisualEffect.ts` をそのまま使用
3. ⬜ `EffectSystem.ts` を作成（上記コード）
4. ⬜ `SpriteComponent.getSprite()` メソッドを追加
5. ⬜ イベントリスナーの設定
6. ⬜ `Game.ts` に `EffectSystem` を登録

#### 工数見積もり
- **実装**: 3-4時間
- **テスト**: 2時間
- **合計**: 5-6時間

---

### 4. エネルギー管理システム ⭐ **高優先・流用+拡張**

#### 旧システムの実装
- **ファイル**: `src/game.ts` 内の `checkEnergyStatus()`, `handleEmergencyShutdown()`
- **状態**: ✅ 完全実装
- **依存関係**: `Player`, `gameStore`

#### 新システムの状況
- **既存**: `EnergyComponent` が基本的なエネルギー管理を実装
- **不足**: クリティカルモード、緊急シャットダウンのロジック

#### 推奨実装方法: **Player.ts に統合**

```typescript
// src/engine/entity/Player.ts (拡張)
export class Player extends Entity {
  // ... 既存のコード ...

  /**
   * エネルギー状態をチェック（旧システムから流用）
   */
  private checkEnergyStatus(): void {
    const energy = this.currentEnergy;
    const maxEnergy = this.maxEnergy;

    if (energy === 0) {
      // 緊急シャットダウン
      this.handleEmergencyShutdown();
    } else if (energy <= maxEnergy * 0.15) {
      // クリティカルモード: 1ダメージ
      console.warn('Critical energy mode! Taking damage...');
      const healthComponent = this.getComponent<HealthComponent>('health');
      if (healthComponent) {
        healthComponent.takeDamage(1);
      }

      // HPチェック
      if (healthComponent && healthComponent.getCurrentHp() <= 0) {
        this.onDeath();
      }
    }
  }

  /**
   * 緊急シャットダウン処理（旧システムから流用）
   */
  private handleEmergencyShutdown(): void {
    console.error('Emergency Shutdown!');
    
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      // 緊急シャットダウンイベントを発行
      eventSystem.emit('emergency_shutdown', {
        entityId: this.id,
        message: 'Energy depleted! System shutdown!',
      });

      // ゲームオーバー
      eventSystem.emit('game_over', {
        reason: 'emergency_shutdown',
        score: this.gameStore.score,
      });
    }
  }

  /**
   * エネルギーを消費（拡張版）
   */
  consumeEnergy(amount: number): boolean {
    const energyComponent = this.getComponent('energy') as any;
    if (!energyComponent) return false;

    const success = energyComponent.consume(amount);
    if (success) {
      this.currentEnergy = energyComponent.currentEnergy;
      this.gameStore.player.status.energy = this.currentEnergy;

      // エネルギー状態をチェック
      this.checkEnergyStatus();
    }

    return success;
  }

  // ... 既存のコード ...
}
```

#### 必要な作業
1. ⬜ `Player.ts` に `checkEnergyStatus()` を追加
2. ⬜ `Player.ts` に `handleEmergencyShutdown()` を追加
3. ⬜ `consumeEnergy()` を拡張
4. ⬜ イベント発行の実装

#### 工数見積もり
- **実装**: 1-2時間
- **テスト**: 1時間
- **合計**: 2-3時間

---

## 🆕 新規作成が必要な機能（詳細分析）

### 5. 戦闘システム ⭐ **最優先・新規作成**

#### 理由
旧システムの戦闘処理は `Stage` クラスに密結合しており、ECSアーキテクチャに適合しません。

#### 旧システムの実装
```typescript
// src/game.ts (521-560行目)
public async playerAttack(): Promise<void> {
  // 1. ターゲット位置を取得
  const targetPosition = this.stage.getAttackTargetPosition(this.player);
  
  // 2. ターゲットを取得
  const target = this.stage.getCharacterAt(targetPosition.x, targetPosition.y, targetPosition.z);
  
  // 3. ダメージ計算
  if (target && target instanceof Enemy && this.player.getEnergy() >= 2) {
    const damage = await this.player.attack();
    await target.takeDamage(damage);
    
    // 4. エフェクト・サウンド
    this.soundManager.playSE('attack');
    
    // 5. 撃破判定
    if (!target.isAlive()) {
      const effectContainer = onCharacterDestroyed(...);
      this.app?.stage.addChild(effectContainer);
      this.stage.removeEnemy(target);
    }
  }
  
  // 6. ターン進行
  const nextPhase = this.turnManager!.nextTurn();
  this.handleTurnPhase(nextPhase);
}
```

#### 新システムで必要な実装

```typescript
// src/engine/combat/CombatSystem.ts (新規作成)
import { System } from '../System';
import { Engine } from '../Engine';
import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { WorldSystem } from '../world/WorldSystem';
import { TransformComponent } from '../entity/components/Transform';
import { HealthComponent } from '../entity/components/Health';
import { Direction } from '../types';

/**
 * 戦闘システム - 攻撃・ダメージ計算を管理
 */
export class CombatSystem implements System {
  private engine: Engine | null = null;
  private entitySystem: EntitySystem | null = null;
  private eventSystem: EventSystem | null = null;
  private worldSystem: WorldSystem | null = null;

  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.entitySystem = engine.getSystem<EntitySystem>('entity');
    this.eventSystem = engine.getSystem<EventSystem>('event');
    this.worldSystem = engine.getSystem<WorldSystem>('world');

    // イベントリスナーを設定
    this.setupEventListeners();

    console.log('CombatSystem initialized');
  }

  update(): void {
    // 必要に応じて更新処理
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) return;

    // プレイヤー攻撃イベント
    this.eventSystem.on('player_attack_requested', (data) => {
      this.handlePlayerAttack(data.playerId);
    });
  }

  /**
   * プレイヤーの攻撃を処理
   */
  private async handlePlayerAttack(playerId: string): Promise<void> {
    const player = this.entitySystem?.getEntity(playerId);
    if (!player) return;

    // 1. ターゲットを検出
    const targetId = this.findAttackTarget(playerId);
    
    if (targetId) {
      // 2. ダメージを計算
      const damage = this.calculateDamage(playerId, targetId);
      
      // 3. ダメージを適用
      await this.applyDamage(targetId, damage, playerId);
      
      // 4. 攻撃エフェクトを再生
      this.eventSystem?.emit('attack_performed', { entityId: playerId });
      
      // 5. サウンドを再生
      this.eventSystem?.emit('player_attack', {});
    } else {
      // 空振り
      this.eventSystem?.emit('attack_performed', { entityId: playerId });
      this.eventSystem?.emit('player_attack', {});
    }

    // 6. ターン進行
    this.eventSystem?.emit('turn_action_completed', { entityId: playerId });
  }

  /**
   * 攻撃ターゲットを検出
   */
  private findAttackTarget(attackerId: string): string | null {
    const attacker = this.entitySystem?.getEntity(attackerId);
    if (!attacker) return null;

    const transform = attacker.getComponent<TransformComponent>('transform');
    if (!transform) return null;

    // 攻撃者の向きに基づいてターゲット位置を計算
    // TODO: 方向情報の取得方法を実装
    const direction = this.getAttackerDirection(attackerId);
    const targetPos = this.getPositionInDirection(transform.position, direction);

    // ターゲット位置にいる敵を検索
    const enemies = this.entitySystem?.getEntitiesByTag('enemy') || [];
    for (const enemy of enemies) {
      const enemyTransform = enemy.getComponent<TransformComponent>('transform');
      if (enemyTransform) {
        const pos = enemyTransform.position;
        if (pos.x === targetPos.x && pos.y === targetPos.y && pos.z === targetPos.z) {
          return enemy.id;
        }
      }
    }

    return null;
  }

  /**
   * ダメージを計算
   */
  private calculateDamage(attackerId: string, targetId: string): number {
    // TODO: ステータスベースのダメージ計算
    // 仮実装
    return 10;
  }

  /**
   * ダメージを適用
   */
  private async applyDamage(
    targetId: string,
    damage: number,
    attackerId: string
  ): Promise<void> {
    const target = this.entitySystem?.getEntity(targetId);
    if (!target) return;

    const healthComponent = target.getComponent<HealthComponent>('health');
    if (!healthComponent) return;

    // ダメージを適用
    healthComponent.takeDamage(damage);

    // ダメージエフェクトを再生
    this.eventSystem?.emit('damage_taken', {
      entityId: targetId,
      damage: damage,
      attackerId: attackerId,
    });

    // 撃破判定
    if (healthComponent.getCurrentHp() <= 0) {
      this.handleEntityDestroyed(targetId);
    }
  }

  /**
   * エンティティ撃破処理
   */
  private handleEntityDestroyed(entityId: string): void {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) return;

    // 位置を取得
    const transform = entity.getComponent<TransformComponent>('transform');
    if (transform) {
      // 爆発エフェクトを再生
      this.eventSystem?.emit('enemy_destroyed', {
        entityId: entityId,
        position: transform.position,
      });
    }

    // エンティティを削除
    this.entitySystem?.removeEntity(entityId);
  }

  /**
   * 攻撃者の方向を取得
   */
  private getAttackerDirection(attackerId: string): Direction {
    // TODO: 実装
    return 'down';
  }

  /**
   * 指定方向の位置を取得
   */
  private getPositionInDirection(
    position: { x: number; y: number; z: number },
    direction: Direction
  ): { x: number; y: number; z: number } {
    const { x, y, z } = position;
    switch (direction) {
      case 'up':
        return { x, y: y - 1, z };
      case 'down':
        return { x, y: y + 1, z };
      case 'left':
        return { x: x - 1, y, z };
      case 'right':
        return { x: x + 1, y, z };
      default:
        return { x, y, z };
    }
  }
}
```

#### 必要な作業
1. ⬜ `CombatSystem.ts` を新規作成
2. ⬜ ターゲット検出ロジックの実装
3. ⬜ ダメージ計算ロジックの実装
4. ⬜ 方向情報の管理（DirectionComponent?）
5. ⬜ イベント統合
6. ⬜ `Game.ts` に `CombatSystem` を登録

#### 工数見積もり
- **実装**: 6-8時間
- **テスト**: 3-4時間
- **合計**: 9-12時間

---

### 6. イベントオブジェクトシステム ⭐ **高優先・新規作成**

#### 理由
旧システムの `EventObject` は `GameObject` を継承しており、ECSアーキテクチャに適合しません。

#### 推奨実装方法

```typescript
// src/engine/entity/EventObjectEntity.ts (新規作成)
import { Entity } from './Entity';
import { TransformComponent } from './components/Transform';
import { SpriteComponent } from './components/Sprite';
import { InteractableComponent } from './components/Interactable'; // 新規作成
import { Vector3 } from '../types';

/**
 * イベントオブジェクトエンティティ
 */
export class EventObjectEntity extends Entity {
  constructor(
    id: string,
    position: Vector3,
    texturePath: string,
    onInteract: (playerId: string) => void,
    hasCollision = false
  ) {
    super(id, 'event_object');

    // タグを追加
    this.addTag('event_object');
    if (!hasCollision) {
      this.addTag('no_collision');
    }

    // Transform コンポーネント
    this.addComponent(new TransformComponent(position.x, position.y, position.z));

    // Interactable コンポーネント
    this.addComponent(new InteractableComponent(onInteract));
  }

  async initialize(): Promise<void> {
    // スプライトコンポーネントを追加
    // TODO: テクスチャパスの設定
  }
}
```

```typescript
// src/engine/entity/components/Interactable.ts (新規作成)
import { Component } from '../Component';
import { Entity } from '../Entity';

/**
 * インタラクション可能コンポーネント
 */
export class InteractableComponent implements Component {
  type = 'interactable';
  entity: Entity | null = null;

  private onInteract: (playerId: string) => void;
  private interacted = false;
  private oneTimeUse: boolean;

  constructor(onInteract: (playerId: string) => void, oneTimeUse = false) {
    this.onInteract = onInteract;
    this.oneTimeUse = oneTimeUse;
  }

  async initialize(): Promise<void> {
    console.log(`InteractableComponent initialized for entity: ${this.entity?.id}`);
  }

  update(): void {
    // 必要に応じて更新処理
  }

  /**
   * インタラクションを実行
   */
  interact(playerId: string): void {
    if (this.oneTimeUse && this.interacted) {
      console.log('This interactable has already been used');
      return;
    }

    this.onInteract(playerId);
    this.interacted = true;
  }

  /**
   * インタラクション済みかどうか
   */
  isInteracted(): boolean {
    return this.interacted;
  }

  /**
   * リセット
   */
  reset(): void {
    this.interacted = false;
  }
}
```

```typescript
// src/engine/interaction/InteractionSystem.ts (新規作成)
import { System } from '../System';
import { Engine } from '../Engine';
import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { TransformComponent } from '../entity/components/Transform';
import { InteractableComponent } from '../entity/components/Interactable';

/**
 * インタラクションシステム - イベントオブジェクトとの相互作用を管理
 */
export class InteractionSystem implements System {
  private engine: Engine | null = null;
  private entitySystem: EntitySystem | null = null;
  private eventSystem: EventSystem | null = null;

  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.entitySystem = engine.getSystem<EntitySystem>('entity');
    this.eventSystem = engine.getSystem<EventSystem>('event');

    // イベントリスナーを設定
    this.setupEventListeners();

    console.log('InteractionSystem initialized');
  }

  update(): void {
    // プレイヤーの位置を監視し、イベントオブジェクトとの衝突をチェック
    this.checkInteractions();
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) return;

    // 移動完了時にインタラクションをチェック
    this.eventSystem.on('move_completed', (data) => {
      if (data.entityId.startsWith('player')) {
        this.checkInteractionAt(data.entityId, data.position);
      }
    });
  }

  /**
   * インタラクションをチェック
   */
  private checkInteractions(): void {
    const players = this.entitySystem?.getEntitiesByTag('player') || [];
    
    for (const player of players) {
      const playerTransform = player.getComponent<TransformComponent>('transform');
      if (!playerTransform) continue;

      this.checkInteractionAt(player.id, playerTransform.position);
    }
  }

  /**
   * 指定位置でのインタラクションをチェック
   */
  private checkInteractionAt(
    playerId: string,
    position: { x: number; y: number; z: number }
  ): void {
    const eventObjects = this.entitySystem?.getEntitiesByTag('event_object') || [];

    for (const eventObject of eventObjects) {
      const transform = eventObject.getComponent<TransformComponent>('transform');
      const interactable = eventObject.getComponent<InteractableComponent>('interactable');

      if (!transform || !interactable) continue;

      // 位置が一致するかチェック
      const pos = transform.position;
      if (pos.x === position.x && pos.y === position.y && pos.z === position.z) {
        // インタラクションを実行
        interactable.interact(playerId);
      }
    }
  }
}
```

#### 必要な作業
1. ⬜ `EventObjectEntity.ts` を新規作成
2. ⬜ `InteractableComponent.ts` を新規作成
3. ⬜ `InteractionSystem.ts` を新規作成
4. ⬜ ポータル・チャージャーの実装
5. ⬜ `Game.ts` に `InteractionSystem` を登録

#### 工数見積もり
- **実装**: 5-7時間
- **テスト**: 2-3時間
- **合計**: 7-10時間

---

### 7. 入力システム ⭐ **高優先・新規作成**

#### 理由
旧システムの入力処理は `Stage` クラスに密結合しており、ECSアーキテクチャに適合しません。

#### 推奨実装方法

```typescript
// src/engine/input/InputSystem.ts (新規作成)
import { System } from '../System';
import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';
import { RendererSystem } from '../graphics/RendererSystem';
import { WorldSystem } from '../world/WorldSystem';
import { CoordinateSystem } from '../graphics/CoordinateSystem';
import * as PIXI from 'pixi.js';

/**
 * 入力システム - マウス・キーボード入力を管理
 */
export class InputSystem implements System {
  private engine: Engine | null = null;
  private eventSystem: EventSystem | null = null;
  private rendererSystem: RendererSystem | null = null;
  private worldSystem: WorldSystem | null = null;
  private coordinateSystem: CoordinateSystem | null = null;

  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event');
    this.rendererSystem = engine.getSystem<RendererSystem>('renderer');
    this.worldSystem = engine.getSystem<WorldSystem>('world');

    if (this.rendererSystem) {
      this.coordinateSystem = new CoordinateSystem(160, 120);
    }

    // マウスリスナーを設定
    this.setupMouseListeners();

    // キーボードリスナーを設定
    this.setupKeyboardListeners();

    console.log('InputSystem initialized');
  }

  update(): void {
    // 必要に応じて更新処理
  }

  /**
   * マウスリスナーを設定
   */
  private setupMouseListeners(): void {
    const app = this.rendererSystem?.getApp();
    if (!app) return;

    // マウスクリック
    app.stage.eventMode = 'static';
    app.stage.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      this.onMouseClick(event);
    });

    // マウス移動
    app.stage.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
      this.onMouseMove(event);
    });
  }

  /**
   * キーボードリスナーを設定
   */
  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (event) => {
      this.onKeyDown(event);
    });

    window.addEventListener('keyup', (event) => {
      this.onKeyUp(event);
    });
  }

  /**
   * マウスクリック処理
   */
  private onMouseClick(event: PIXI.FederatedPointerEvent): void {
    if (!this.coordinateSystem || !this.eventSystem) return;

    const clickPos = event.global;
    
    // カメラ位置を考慮
    const camera = this.rendererSystem?.getCamera();
    const cameraX = camera?.x || 0;
    const cameraY = camera?.y || 0;

    // スクリーン座標をアイソメトリック座標に変換
    const isoPos = this.coordinateSystem.screenToIsometric(
      clickPos.x - cameraX,
      clickPos.y - cameraY
    );

    // タイル選択イベントを発行
    this.eventSystem.emit('tile_clicked', {
      x: Math.floor(isoPos.x),
      y: Math.floor(isoPos.y),
      z: 0,
    });

    // エンティティ選択をチェック
    this.checkEntitySelection(Math.floor(isoPos.x), Math.floor(isoPos.y));
  }

  /**
   * マウス移動処理
   */
  private onMouseMove(event: PIXI.FederatedPointerEvent): void {
    // TODO: ホバー処理
  }

  /**
   * キーダウン処理
   */
  private onKeyDown(event: KeyboardEvent): void {
    if (!this.eventSystem) return;

    // キー入力イベントを発行
    this.eventSystem.emit('key_down', {
      key: event.key,
      code: event.code,
    });
  }

  /**
   * キーアップ処理
   */
  private onKeyUp(event: KeyboardEvent): void {
    if (!this.eventSystem) return;

    // キー入力イベントを発行
    this.eventSystem.emit('key_up', {
      key: event.key,
      code: event.code,
    });
  }

  /**
   * エンティティ選択をチェック
   */
  private checkEntitySelection(x: number, y: number): void {
    // TODO: 指定位置のエンティティを検索して選択イベントを発行
  }
}
```

#### 必要な作業
1. ⬜ `InputSystem.ts` を新規作成
2. ⬜ マウスクリック処理の実装
3. ⬜ キーボード入力処理の実装
4. ⬜ エンティティ選択ロジックの実装
5. ⬜ `Game.ts` に `InputSystem` を登録

#### 工数見積もり
- **実装**: 4-6時間
- **テスト**: 2時間
- **合計**: 6-8時間

---

## 📋 実装優先順位と工数見積もり

### フェーズ1: 最優先（流用可能）🔴
| 機能 | アプローチ | 工数 | 依存関係 |
|------|----------|------|---------|
| 1. サウンドシステム | 🔄 流用 | 2-3時間 | なし |
| 2. ターン管理 | 🔄 流用 | 3-5時間 | なし |
| 3. ビジュアルエフェクト | 🔄 流用+拡張 | 5-6時間 | SpriteComponent |

**小計**: 10-14時間

### フェーズ2: 最優先（新規作成）🔴
| 機能 | アプローチ | 工数 | 依存関係 |
|------|----------|------|---------|
| 4. 戦闘システム | 🆕 新規 | 9-12時間 | TurnSystem, EffectSystem, AudioSystem |

**小計**: 9-12時間

### フェーズ3: 高優先（新規作成）🟡
| 機能 | アプローチ | 工数 | 依存関係 |
|------|----------|------|---------|
| 5. イベントオブジェクト | 🆕 新規 | 7-10時間 | なし |
| 6. 入力システム | 🆕 新規 | 6-8時間 | なし |
| 7. エネルギー管理 | 🔄 流用+拡張 | 2-3時間 | なし |

**小計**: 15-21時間

### フェーズ4: 低優先🟢
| 機能 | アプローチ | 工数 | 依存関係 |
|------|----------|------|---------|
| 8. 階層移動 | 🆕 新規 | 3-5時間 | WorldSystem |

**小計**: 3-5時間

---

## 🎯 総合工数見積もり

| フェーズ | 工数 | 期間（1日8時間） |
|---------|------|----------------|
| フェーズ1 | 10-14時間 | 1.5-2日 |
| フェーズ2 | 9-12時間 | 1-1.5日 |
| フェーズ3 | 15-21時間 | 2-2.5日 |
| フェーズ4 | 3-5時間 | 0.5日 |
| **合計** | **37-52時間** | **5-6.5日** |

---

## 🚀 推奨実装順序

### ステップ1: 基盤システム（1.5-2日）
1. ✅ `AudioSystem` の実装（2-3時間）
2. ✅ `TurnSystem` の実装（3-5時間）
3. ✅ `EffectSystem` の実装（5-6時間）

### ステップ2: コア機能（1-1.5日）
4. ✅ `CombatSystem` の実装（9-12時間）

### ステップ3: UI・インタラクション（2-2.5日）
5. ✅ `InteractionSystem` + `EventObjectEntity` の実装（7-10時間）
6. ✅ `InputSystem` の実装（6-8時間）
7. ✅ エネルギー管理の拡張（2-3時間）

### ステップ4: 最終調整（0.5日）
8. ✅ 階層移動の実装（3-5時間）
9. ✅ 統合テスト
10. ✅ `GameScreen.vue` の import 変更
11. ✅ 旧システムの削除

---

## 📝 重要な注意事項

### 1. 旧システムとの互換性
- `Character` / `Enemy` の旧クラスと ECS Entity の橋渡しが必要
- `gameStore` との統合を維持

### 2. イベント駆動設計
- 各システムは `EventSystem` を通じて疎結合に
- イベント名の統一が重要

### 3. テスト戦略
- 各システムを個別にテスト
- 統合テストで全体の動作を確認
- 旧システムと新システムの動作を比較

### 4. パフォーマンス
- ECSアーキテクチャの利点を活かす
- 不要なオブジェクト生成を避ける
- エフェクトの更新ループに注意

---

**作成日**: 2025-11-15
**最終更新**: 2025-11-15

