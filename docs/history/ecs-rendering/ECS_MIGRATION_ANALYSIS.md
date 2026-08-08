# ECSシステム移行分析レポート

## 📋 概要

このドキュメントは、旧システム (`src/game.ts`) から新ECSシステム (`src/game/Game.ts`) への移行に必要な情報をまとめたものです。

---

## 🔍 システム比較

### 旧システム (src/game.ts)
- **アーキテクチャ**: オブジェクト指向 + Stage中心設計
- **レンダリング**: PIXI.js直接操作
- **状態管理**: Pinia (gameStore) + ローカル状態
- **主要クラス**: `Game`, `Stage`, `Character`, `Enemy`, `GameObject`, `EventObject`

### 新システム (src/game/Game.ts)
- **アーキテクチャ**: ECS (Entity Component System)
- **レンダリング**: `RendererSystem` (システム化)
- **状態管理**: Pinia (gameStore) + ECS Entity/Component
- **主要クラス**: `Game`, `Engine`, `Entity`, `Component`, `System`

---

## ✅ 新システムに既に実装されている機能

### 1. コアシステム
- ✅ エンジン初期化 (`Engine`, `System`インターフェース)
- ✅ レンダリングシステム (`RendererSystem`)
- ✅ エンティティシステム (`EntitySystem`)
- ✅ イベントシステム (`EventSystem`)
- ✅ ワールドシステム (`WorldSystem`)

### 2. マップ生成
- ✅ マップ生成 (`MapGeneratorFacade`)
- ✅ リソース生成 (`ResourceGenerationSystem`)
- ✅ タイルマップ (`TileMap`)
- ✅ 戦術的マップ生成 (`TacticalMapGenerator`)

### 3. プレイヤー
- ✅ プレイヤーエンティティ (`Player`)
- ✅ 移動システム (`MovementComponent`)
- ✅ 体力システム (`HealthComponent`)
- ✅ エネルギーシステム (`EnergyComponent`)
- ✅ スプライト表示 (`SpriteComponent`)
- ✅ 座標変換 (`TransformComponent`)

### 4. 敵
- ✅ 敵エンティティ (`Enemy`)
- ✅ AI行動 (`RandomMoveBehavior`, `AggressiveBehavior`)

### 5. アイテム
- ✅ アイテムエンティティ (`Item`)
- ✅ アイテム取得イベント (`item_found`)
- ✅ インベントリ統合 (gameStore)

### 6. 障害物
- ✅ 障害物エンティティ (`Obstacle`)
- ✅ 障害物配置 (`ObstaclePlacer`)

### 7. UI連携
- ✅ ゲームオーバーイベント
- ✅ アイテム取得ダイアログ (`ItemPickupDialog`)
- ✅ ゲームストア連携

---

## ❌ 新システムに未実装の機能

### 1. ターン管理システム ⚠️ **重要**
旧システムでは `TurnManager` を使用してプレイヤーと敵のターンを管理しています。

#### 旧システムの実装
```typescript
// src/game.ts
private turnManager: TurnManager | null = null;
private isPlayerTurn = true;
private currentPhase: TurnPhase = TurnPhase.PLAYER;

private startNewTurn(): void {
  this.currentPhase = this.turnManager!.startTurn();
  this.handleTurnPhase(this.currentPhase);
}

private handleTurnPhase(phase: TurnPhase): void {
  switch (phase) {
    case TurnPhase.PLAYER:
      this.startPlayerTurn();
      break;
    case TurnPhase.ENEMY:
      this.startEnemyTurn();
      break;
    case TurnPhase.END:
      this.endTurn();
      break;
  }
}

private async processEnemyTurn(): Promise<void> {
  while (this.turnManager!.getCurrentPhase() === TurnPhase.ENEMY) {
    const currentCharacter = this.turnManager!.getCurrentCharacter();
    if (currentCharacter instanceof Enemy) {
      await this.performEnemyAction(currentCharacter);
    }
    const nextPhase = this.turnManager!.nextTurn();
    if (nextPhase === TurnPhase.END) {
      this.endTurn();
      break;
    }
  }
}
```

#### 新システムで必要な実装
- `TurnSystem` の作成
- プレイヤー行動後の自動ターン進行
- 敵AIの順次実行
- ターンフェーズ管理

---

### 2. ビジュアルエフェクト ⚠️ **重要**
旧システムでは以下のエフェクトが実装されています。

#### 実装済みエフェクト
- **ダメージエフェクト** (`EffectManager.applyEffect('damage')`)
  - 赤色点滅
  - シェイクアニメーション
- **回復エフェクト** (`EffectManager.applyEffect('heal')`)
  - 緑色点滅
- **爆発エフェクト** (`onCharacterDestroyed()`)
  - パーティクルエフェクト
  - 敵撃破時の演出

#### 使用箇所
```typescript
// src/game.ts (521-548行目)
public async playerAttack(): Promise<void> {
  // ...攻撃処理...
  if (!target.isAlive()) {
    const effectPos = this.stage.isometricToScreen(
      target.getPosition().x,
      target.getPosition().y
    );
    this.soundManager.playSE('explosion');
    const effectContainer = onCharacterDestroyed(
      { x: effectPos.x + cameraPos.x, y: effectPos.y + cameraPos.y },
      40
    );
    this.app?.stage.addChild(effectContainer);
    this.stage.removeEnemy(target);
  }
}
```

#### 新システムで必要な実装
- `EffectSystem` の作成
- `EffectComponent` の作成
- パーティクルシステムの統合

---

### 3. サウンドシステム ⚠️ **重要**
旧システムでは `SoundManager` (Singleton) を使用しています。

#### 実装済み機能
- BGM再生/停止 (`playBGM`, `stopBGM`)
- SE再生 (`playSE`)
- ボリューム調整 (`setVolume`)
- ミュート機能 (`mute`, `unmute`)

#### 使用箇所
```typescript
// src/game.ts
private soundManager: SoundManager = SoundManager.getInstance();

// 攻撃時
this.soundManager.playSE('attack');

// 爆発時
this.soundManager.playSE('explosion');
```

#### 新システムで必要な実装
- `AudioSystem` の作成
- `AudioComponent` の作成（オプション）
- または `SoundManager` をそのまま統合

---

### 4. カメラシステム ⚠️ **重要**
旧システムでは `Stage` がカメラ機能を持っています。

#### 実装済み機能
```typescript
// src/common/Stage.ts
public setFollowTarget(character: Character): void {
  this.followTarget = character;
}

public setCameraSmoothing(factor: number): void {
  this.cameraLerpFactor = factor;
}

public updateCameraPosition(): void {
  if (this.followTarget) {
    const targetPos = this.followTarget.getPosition();
    const screenPos = this.isometricToScreen(targetPos.x, targetPos.y);
    
    // スムーズな追従
    const targetX = this.viewportWidth / 2 - screenPos.x;
    const targetY = this.viewportHeight / 2 - screenPos.y;
    
    this.camera.x += (targetX - this.camera.x) * this.cameraLerpFactor;
    this.camera.y += (targetY - this.camera.y) * this.cameraLerpFactor;
    
    // マップ境界チェック
    const bounds = this.getMapBounds();
    this.camera.x = Math.max(Math.min(this.camera.x, 0), -bounds.maxX);
    this.camera.y = Math.max(Math.min(this.camera.y, 0), -bounds.maxY);
  }
}
```

#### 新システムの状況
- `Camera` クラスは存在する (`src/engine/graphics/Camera.ts`)
- `RendererSystem` に統合されている
- プレイヤー追従は `Player.setCameraTarget()` で設定可能

#### 新システムで必要な実装
- カメラのスムーズ追従の確認
- マップ境界チェックの実装確認

---

### 5. イベントオブジェクト ⚠️ **中程度**
旧システムでは `EventObject` クラスを使用しています。

#### 実装済み機能
```typescript
// src/common/EventObject.ts
export class EventObject extends GameObject {
  private eventCallback: EventCallback;
  
  public triggerEvent(character: Character): void {
    this.eventCallback(character);
  }
  
  public isCharacterOn(x, y, z): boolean {
    return this.position.x === x && this.position.y === y && this.position.z === z;
  }
}
```

#### 使用箇所
```typescript
// src/game.ts (244-286行目)
// ポータル
for (const portalData of resources.portals) {
  const portal = this.stage.addEventObject(
    './obj02.png',
    portalData.x,
    portalData.y,
    0,
    (character) => {
      if (character === this.player) {
        this.gameStore.setPortalActive(true);
      }
    },
    false,
    { x: 0.5, y: 0.8 }
  );
  this.stage.addObject(portal);
}

// エネルギーチャージャー
for (const chargerData of resources.chargers) {
  const charger = this.stage.addEventObject(
    './obj01.png',
    chargerData.x,
    chargerData.y,
    0,
    (character) => {
      if (character === this.player && chargerData.remainingUses > 0) {
        const newEnergy = Math.min(
          currentEnergy + chargerData.chargeAmount,
          maxEnergy
        );
        this.gameStore.player.status.energy = newEnergy;
        chargerData.remainingUses--;
      }
    },
    false,
    { x: 0.5, y: 0.8 }
  );
  this.stage.addObject(charger);
}
```

#### 新システムで必要な実装
- `EventObjectEntity` の作成
- `InteractableComponent` の作成
- ポータル・チャージャーの実装

---

### 6. タイル選択・キャラクター選択 UI ⚠️ **中程度**
旧システムでは、マウスクリックでタイル・キャラクター・敵を選択できます。

#### 実装済み機能
```typescript
// src/common/Stage.ts
private onMouseClick(event: PIXI.FederatedMouseEvent): void {
  const clickPos = event.global;
  const isoPos = this.screenToIsometric(clickPos.x - this.camera.x, clickPos.y - this.camera.y);
  const tile = this.getTileAtPosition(isoPos.x, isoPos.y);
  
  // タイル選択
  if (tile) {
    this.selectedTile = tile;
    const tileInfo = TileInfoMap[tile.type];
    this.onTileSelect(tileInfo);
  }
  
  // キャラクター選択
  const character = this.getCharacterAt(isoPos.x, isoPos.y, 0);
  if (character) {
    this.onCharacterSelect(character);
  }
  
  // 敵選択
  const enemy = this.enemies?.get(...);
  if (enemy) {
    this.onEnemySelect(enemy);
  }
}
```

#### 新システムで必要な実装
- `InputSystem` の作成
- マウスクリック処理
- タイル/エンティティ選択イベント

---

### 7. ゲームループと更新処理 ⚠️ **重要**
旧システムでは `app.ticker` を使用してゲームループを実装しています。

#### 実装済み機能
```typescript
// src/game.ts
private start() {
  if (this.app) {
    this.app.ticker.add(() => this.gameLoop());
  }
}

private gameLoop() {
  this.checkGameOver();
  this.stage.update(this.app?.ticker.deltaMS);
}

private checkGameOver() {
  if (this.player && this.player.getStatus().hp <= 0) {
    this.gameOver();
  }
}
```

#### 新システムの状況
- `Engine.start()` でゲームループが開始される
- 各 `System` の `update()` が呼ばれる
- ゲームオーバーチェックは未実装

#### 新システムで必要な実装
- ゲームオーバーチェックの追加
- HP監視システム

---

### 8. プレイヤー攻撃処理 ⚠️ **重要**
旧システムでは詳細な攻撃処理が実装されています。

#### 実装済み機能
```typescript
// src/game.ts (521-560行目)
public async playerAttack(): Promise<void> {
  if (!this.isPlayerTurn || !this.player) return;
  if (this.player.getMoveState()) return;

  const targetPosition = this.stage.getAttackTargetPosition(this.player);
  const target = this.stage.getCharacterAt(targetPosition.x, targetPosition.y, targetPosition.z);

  if (target && target instanceof Enemy && this.player.getEnergy() >= 2) {
    this.soundManager.playSE('attack');
    const damage = await this.player.attack();
    await target.takeDamage(damage);
    this.checkEnergyStatus();

    if (!target.isAlive()) {
      // 爆発エフェクト
      const effectContainer = onCharacterDestroyed(...);
      this.app?.stage.addChild(effectContainer);
      this.stage.removeEnemy(target);
    }
  } else {
    // 空振り
    await this.player.attack();
    this.soundManager.playSE('attack');
  }

  // ターン進行
  const nextPhase = this.turnManager!.nextTurn();
  this.handleTurnPhase(nextPhase);
}
```

#### 新システムの状況
- `Player.attack()` は存在するが、簡易実装
- ターゲット検出・ダメージ計算・エフェクトが未実装

#### 新システムで必要な実装
- `CombatSystem` の作成
- ターゲット検出ロジック
- ダメージ計算
- 攻撃エフェクト統合

---

### 9. エネルギー管理 ⚠️ **重要**
旧システムでは詳細なエネルギー管理が実装されています。

#### 実装済み機能
```typescript
// src/game.ts (579-600行目)
private checkEnergyStatus(): void {
  const player = this.player;
  if (!player) return;

  const energy = player.getEnergy();
  if (energy === 0) {
    this.handleEmergencyShutdown();
  } else if (energy <= player.getMaxEnergy() * 0.15) {
    // クリティカルモード: 1ダメージ
    player.takeDamage(1);
    if (!player.isAlive()) {
      this.gameOver();
    }
  }
}

private handleEmergencyShutdown(): void {
  console.log('Emergency Shutdown!');
  // 3ターン行動不能 + 強制帰還
  this.gameOver();
}
```

#### 新システムの状況
- `EnergyComponent` は存在する
- エネルギー消費は実装済み
- クリティカルモード・緊急シャットダウンは未実装

#### 新システムで必要な実装
- エネルギー状態監視
- クリティカルモード処理
- 緊急シャットダウン処理

---

### 10. 方向転換 ⚠️ **低**
旧システムでは、攻撃時に自動で方向転換します。

#### 実装済み機能
```typescript
// src/game.ts (562-566行目)
public changePlayerDirection(direction: any): void {
  if (this.player) {
    this.stage.changeCharacterDirection(this.player, direction);
  }
}

// src/common/Stage.ts (601-604行目)
public changeCharacterDirection(character: Character, direction: Direction): void {
  character.setDirection(direction);
  // スプライト更新も含む
}
```

#### 新システムで必要な実装
- 方向転換メソッドの追加（オプション）

---

### 11. アイテム表示 ⚠️ **中程度**
旧システムでは、アイテムを `PIXI.Graphics` で描画しています。

#### 実装済み機能
```typescript
// src/game.ts (188-222行目)
for (const itemData of resources.items) {
  const itemGraphics = new PIXI.Graphics();
  
  const colorMap: { [key: string]: number } = {
    health_pack: 0x00ff00,
    energy_cell: 0x00ffff,
    weapon_upgrade: 0xff9900,
    armor_upgrade: 0x0099ff,
    key_item: 0xffff00,
  };
  const color = colorMap[itemData.type] || 0xffffff;
  
  itemGraphics.circle(0, 0, 10);
  itemGraphics.fill(color);
  itemGraphics.stroke({ width: 2, color: 0x000000 });
  
  const screenPos = this.stage.isometricToScreen(itemData.x, itemData.y);
  itemGraphics.x = screenPos.x;
  itemGraphics.y = screenPos.y - 20; // 少し浮かせる
  
  this.stage.addGraphicsToCamera(itemGraphics);
  this.stage.addItemData(itemData, itemGraphics);
}
```

#### 新システムの状況
- `Item` エンティティは存在する
- `SpriteComponent` を使用
- グラフィック描画は未確認

#### 新システムで必要な実装
- アイテムスプライト/グラフィックの表示確認
- 色分け表示の実装

---

### 12. 階層移動 ⚠️ **低**
旧システムでは、ポータルを使って次の階層に移動できます。

#### 実装済み機能
```typescript
// GameScreen.vue (156-158行目)
const moveToNextFloor = () => {
  // game.moveToNextFloor();  // コメントアウト済み
};
```

#### 新システムで必要な実装
- `moveToNextFloor()` メソッドの実装
- マップ再生成
- プレイヤー位置リセット
- 敵・アイテムの再配置

---

## 📊 機能実装状況サマリー

| カテゴリ | 旧システム | 新システム | 優先度 |
|---------|----------|----------|--------|
| **コアシステム** | ✅ | ✅ | - |
| **マップ生成** | ✅ | ✅ | - |
| **プレイヤー移動** | ✅ | ✅ | - |
| **敵AI** | ✅ | ✅ | - |
| **アイテム取得** | ✅ | ✅ | - |
| **ターン管理** | ✅ | ❌ | 🔴 **最優先** |
| **ビジュアルエフェクト** | ✅ | ❌ | 🔴 **最優先** |
| **サウンドシステム** | ✅ | ❌ | 🔴 **最優先** |
| **カメラ追従** | ✅ | ⚠️ 要確認 | 🟡 **高** |
| **イベントオブジェクト** | ✅ | ❌ | 🟡 **高** |
| **タイル/キャラ選択** | ✅ | ❌ | 🟡 **高** |
| **ゲームオーバー判定** | ✅ | ⚠️ 部分実装 | 🟡 **高** |
| **プレイヤー攻撃** | ✅ | ⚠️ 簡易実装 | 🔴 **最優先** |
| **エネルギー管理** | ✅ | ⚠️ 部分実装 | 🟡 **高** |
| **方向転換** | ✅ | ❌ | 🟢 **低** |
| **アイテム表示** | ✅ | ⚠️ 要確認 | 🟡 **高** |
| **階層移動** | ⚠️ 未完成 | ❌ | 🟢 **低** |

---

## 🎯 移行に必要な実装

### フェーズ1: 最優先機能 🔴

#### 1. ターン管理システム
```typescript
// src/engine/turn/TurnSystem.ts (新規作成)
export class TurnSystem implements System {
  private turnManager: TurnManager;
  private currentPhase: TurnPhase;
  
  async initialize(): Promise<void> { }
  
  update(): void {
    // ターン進行ロジック
  }
  
  startPlayerTurn(): void { }
  startEnemyTurn(): void { }
  endTurn(): void { }
}
```

#### 2. ビジュアルエフェクトシステム
```typescript
// src/engine/effects/EffectSystem.ts (新規作成)
export class EffectSystem implements System {
  async initialize(): Promise<void> { }
  
  update(): void {
    // エフェクト更新
  }
  
  playEffect(entityId: string, effectName: string): void { }
  playParticleEffect(position: Vector3, config: ParticleConfig): void { }
}

// src/engine/entity/components/EffectComponent.ts (新規作成)
export class EffectComponent implements Component {
  type = 'effect';
  currentEffect: string | null = null;
  effectStartTime: number = 0;
}
```

#### 3. サウンドシステム
```typescript
// src/engine/audio/AudioSystem.ts (新規作成)
export class AudioSystem implements System {
  private soundManager: SoundManager;
  
  async initialize(): Promise<void> {
    this.soundManager = SoundManager.getInstance();
    this.soundManager.loadSounds();
  }
  
  update(): void { }
  
  playBGM(key: string): void {
    this.soundManager.playBGM(key);
  }
  
  playSE(key: string): void {
    this.soundManager.playSE(key);
  }
}
```

#### 4. 戦闘システム
```typescript
// src/engine/combat/CombatSystem.ts (新規作成)
export class CombatSystem implements System {
  async initialize(): Promise<void> { }
  
  update(): void { }
  
  performAttack(attackerId: string, targetId: string): void {
    // ダメージ計算
    // エフェクト再生
    // サウンド再生
    // ターン進行
  }
  
  getAttackTarget(attackerId: string): string | null {
    // ターゲット検出ロジック
  }
}
```

---

### フェーズ2: 高優先度機能 🟡

#### 5. イベントオブジェクトシステム
```typescript
// src/engine/entity/EventObjectEntity.ts (新規作成)
export class EventObjectEntity extends Entity {
  private eventCallback: (player: Player) => void;
  
  constructor(id: string, position: Vector3, callback: (player: Player) => void) {
    super(id, 'event_object');
    this.addTag('event_object');
    this.eventCallback = callback;
  }
  
  trigger(player: Player): void {
    this.eventCallback(player);
  }
}

// src/engine/entity/components/InteractableComponent.ts (新規作成)
export class InteractableComponent implements Component {
  type = 'interactable';
  onInteract: (player: Player) => void;
}
```

#### 6. 入力システム
```typescript
// src/engine/input/InputSystem.ts (新規作成)
export class InputSystem implements System {
  async initialize(): Promise<void> {
    this.setupMouseListeners();
    this.setupKeyboardListeners();
  }
  
  update(): void { }
  
  private onMouseClick(event: MouseEvent): void {
    // タイル選択
    // エンティティ選択
    // イベント発行
  }
}
```

#### 7. エネルギー監視システム
```typescript
// src/engine/entity/Player.ts (拡張)
private checkEnergyStatus(): void {
  const energy = this.currentEnergy;
  const maxEnergy = this.maxEnergy;
  
  if (energy === 0) {
    this.handleEmergencyShutdown();
  } else if (energy <= maxEnergy * 0.15) {
    // クリティカルモード
    this.takeDamage(1);
  }
}

private handleEmergencyShutdown(): void {
  // 緊急シャットダウン処理
  const eventSystem = Engine.instance.getSystem<EventSystem>('event');
  eventSystem?.emit('emergency_shutdown', { entityId: this.id });
}
```

---

### フェーズ3: 低優先度機能 🟢

#### 8. 階層移動システム
```typescript
// src/game/Game.ts (拡張)
async moveToNextFloor(): Promise<void> {
  // 現在の階層を保存
  this.gameStore.incrementFloor();
  
  // マップ再生成
  await this.generateMap();
  
  // プレイヤー位置リセット
  const startPosition = this.findStartPosition();
  // ...
  
  // リソース再生成
  await this.generateResources();
}
```

---

## 🚀 移行ステップ

### ステップ1: 準備
1. ✅ 両システムの詳細な比較分析（このドキュメント）
2. ⬜ 新システムの動作確認
3. ⬜ テスト環境の構築

### ステップ2: フェーズ1実装 (最優先)
1. ⬜ `TurnSystem` の実装
2. ⬜ `EffectSystem` の実装
3. ⬜ `AudioSystem` の実装
4. ⬜ `CombatSystem` の実装
5. ⬜ 統合テスト

### ステップ3: フェーズ2実装 (高優先度)
1. ⬜ `EventObjectEntity` の実装
2. ⬜ `InputSystem` の実装
3. ⬜ エネルギー監視の実装
4. ⬜ 統合テスト

### ステップ4: フェーズ3実装 (低優先度)
1. ⬜ 階層移動の実装
2. ⬜ その他の細かい機能

### ステップ5: 移行完了
1. ⬜ `GameScreen.vue` の import を `src/game/Game.ts` に変更
2. ⬜ 旧システム (`src/game.ts`) の削除
3. ⬜ 全機能の動作確認
4. ⬜ パフォーマンステスト

---

## 📝 注意事項

### 互換性の維持
- `GameScreen.vue` のインターフェースは変更しない
- コールバック関数のシグネチャを維持
- `gameStore` の構造は変更しない

### テスト戦略
- 各システムを個別にテスト
- 統合テストで全体の動作を確認
- 旧システムと新システムの動作を比較

### パフォーマンス
- ECSアーキテクチャの利点を活かす
- 不要なオブジェクト生成を避ける
- イベント駆動で疎結合を維持

---

## 📚 参考資料

### 旧システムの主要ファイル
- `src/game.ts` - メインゲームロジック
- `src/common/Stage.ts` - ステージ管理
- `src/common/Character.ts` - プレイヤークラス
- `src/common/Enemy.ts` - 敵クラス
- `src/common/TurnManager.ts` - ターン管理
- `src/common/EffectManager.ts` - エフェクト管理
- `src/common/SoundManager.ts` - サウンド管理
- `src/common/VisualEffect.ts` - ビジュアルエフェクト

### 新システムの主要ファイル
- `src/game/Game.ts` - メインゲームロジック (ECS)
- `src/engine/Engine.ts` - エンジンコア
- `src/engine/entity/Player.ts` - プレイヤーエンティティ
- `src/engine/entity/Enemy.ts` - 敵エンティティ
- `src/engine/graphics/RendererSystem.ts` - レンダリングシステム
- `src/engine/world/WorldSystem.ts` - ワールドシステム

---

**作成日**: 2025-11-15
**最終更新**: 2025-11-15

