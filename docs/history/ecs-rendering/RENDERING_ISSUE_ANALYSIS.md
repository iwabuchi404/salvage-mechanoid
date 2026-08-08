# マップとキャラクター表示問題の分析レポート

## 🔍 調査結果

### 旧システム (src/game.ts + src/common/Stage.ts) の動作

#### タイルレンダリング
1. **Stage.initializeTileMap()** (行133-150)
   - `createTileSprite()` でタイルスプライトを作成
   - `PIXI.Assets.load()` でテクスチャを読み込み
   - `this.tileContainer.addChild(sprite)` で **即座にコンテナに追加**
   - アイソメトリック座標計算: `sprite.x = ((x - y) * width) / 2`

#### キャラクターレンダリング
1. **Character.loadTextures()** (CharacterBase経由)
   - テクスチャを読み込み
   - スプライトを作成
   - `Stage.addCharacter()` で **即座にコンテナに追加**

#### 重要なポイント
- **PIXIのコンテナに直接追加している**
- **Stage.initialize(app)** で `app.stage.addChild(this.camera)` を実行
- カメラコンテナ内に `tileContainer`, `characterContainer` を配置
- すべてのスプライトが **即座に表示される**

---

### 新システム (src/game/Game.ts + ECS) の動作

#### タイルレンダリング
1. **Game.generateMap()** (行184-248)
   - `MapGeneratorFacade` でマップデータ生成
   - `WorldSystem.setTileMap()` で TileMap オブジェクトを保存
   - **Game.renderTileMap()** (行253-281) を呼び出し
   - `RendererSystem.renderTileMap()` でタイル描画

2. **RendererSystem.renderTileMap()** (行266-322)
   - タイルマップデータを受け取る
   - `PIXI.Assets.load()` でテクスチャを読み込み
   - `PIXI.Sprite` を作成
   - `terrainLayer.addChild(sprite)` で **レイヤーに追加**

#### キャラクターレンダリング
1. **Game.createPlayer()** (行321-355)
   - `Player` エンティティを作成
   - `await player.initialize()` を呼び出し

2. **Player.initialize()** (src/engine/entity/Player.ts 行51-86)
   - `SpriteComponent` を追加
   - **コンポーネントの初期化は呼ばれていない！**

3. **SpriteComponent.initialize()** (src/engine/entity/components/Sprite.ts 行67-113)
   - テクスチャを読み込み
   - スプライトを作成
   - `rendererSystem.renderEntity()` を呼び出し

4. **RendererSystem.renderEntity()** (行133-188)
   - スプライトの位置・設定を行う
   - `this.layers.get(layer)!.addChild(sprite)` で **レイヤーに追加**

---

## ❌ 問題箇所リスト

### 問題1: コンポーネントの初期化が呼ばれていない ⭐⭐⭐ (最重要)
**場所**: `src/engine/entity/Player.ts`, `Enemy.ts`, `Item.ts`, `Obstacle.ts`

**問題**:
- `Entity.addComponent()` でコンポーネントを追加しているが、**コンポーネントの `initialize()` メソッドが呼ばれていない**
- `SpriteComponent.initialize()` が呼ばれないため、スプライトが作成されず、レンダラーに登録されない

**影響**:
- プレイヤー、敵、アイテム、障害物のスプライトが表示されない

---

### 問題2: EntitySystem.registerEntity() がコンポーネントを初期化していない ⭐⭐⭐
**場所**: `src/engine/entity/EntitySystem.ts`

**問題**:
- `registerEntity()` メソッドがエンティティを登録するだけで、**コンポーネントの初期化を行っていない**
- 旧システムでは `Stage.addCharacter()` が即座にスプライトをコンテナに追加していた

**影響**:
- すべてのエンティティのコンポーネントが未初期化状態

---

### 問題3: タイルマップのレンダリングタイミング ⭐⭐
**場所**: `src/game/Game.ts` 行247

**問題**:
- `await this.renderTileMap()` を呼び出しているが、**WorldSystem が初期化されていない可能性**
- `WorldSystem` の登録が `generateMap()` 内で行われているが、システムの初期化順序が不明確

**影響**:
- タイルマップが表示されない可能性

---

### 問題4: RendererSystem の初期化タイミング ⭐
**場所**: `src/game/Game.ts` 行134-178

**問題**:
- `RendererSystem` を登録後、`await this.engine.initialize()` でシステムを初期化
- しかし、**レイヤーが正しく作成されているか確認が必要**

**影響**:
- レイヤーが存在しない場合、スプライトが追加されない

---

### 問題5: カメラの位置が設定されていない ⭐
**場所**: `src/engine/graphics/RendererSystem.ts`

**問題**:
- `this.camera.x` と `this.camera.y` がデフォルト値 (0, 0) のまま
- 旧システムでは `Stage.centerCamera()` でカメラを中央に配置していた

**影響**:
- スプライトの位置がずれる、または画面外に配置される

---

### 問題6: Engine.start() の実装 ⭐
**場所**: `src/engine/Engine.ts`

**問題**:
- `Engine.start()` が各システムの `update()` を呼び出しているか確認が必要
- 旧システムでは `app.ticker.add(() => this.gameLoop())` でゲームループを開始

**影響**:
- システムが更新されない、スプライトが動かない

---

## 📋 修正プラン

### 修正1: Entity.initialize() でコンポーネントを初期化 ⭐⭐⭐
**対象ファイル**: `src/engine/entity/Entity.ts`

**修正内容**:
```typescript
async initialize(): Promise<void> {
  // すべてのコンポーネントを初期化
  for (const component of this.components.values()) {
    if (component.initialize && typeof component.initialize === 'function') {
      await component.initialize();
    }
  }
}
```

**または**、`addComponent()` 時に初期化:
```typescript
async addComponent(component: Component): Promise<void> {
  this.components.set(component.type, component);
  component.entity = this;
  
  // コンポーネントを即座に初期化
  if (component.initialize && typeof component.initialize === 'function') {
    await component.initialize();
  }
}
```

---

### 修正2: EntitySystem.registerEntity() でエンティティを初期化 ⭐⭐⭐
**対象ファイル**: `src/engine/entity/EntitySystem.ts`

**修正内容**:
```typescript
async registerEntity(entity: Entity): Promise<void> {
  // エンティティが既に初期化されていない場合は初期化
  if (entity.initialize && typeof entity.initialize === 'function') {
    await entity.initialize();
  }
  
  this.entities.set(entity.id, entity);
  // タグの登録など...
}
```

---

### 修正3: WorldSystem の初期化を確認 ⭐⭐
**対象ファイル**: `src/game/Game.ts`, `src/engine/world/WorldSystem.ts`

**修正内容**:
- `WorldSystem` を `initializeSystems()` で登録
- `generateMap()` 内で `WorldSystem.setTileMap()` を呼び出す前に、システムが初期化されているか確認

---

### 修正4: カメラの初期位置を設定 ⭐
**対象ファイル**: `src/game/Game.ts`

**修正内容**:
```typescript
// プレイヤー作成後、カメラをプレイヤーに合わせる
const rendererSystem = this.engine.getSystem<RendererSystem>('renderer');
if (rendererSystem && this.player) {
  const camera = rendererSystem.getCamera();
  const playerPos = this.player.getComponent<TransformComponent>('transform')?.position;
  if (playerPos) {
    camera.setTarget(playerPos.x, playerPos.y);
  }
}
```

---

### 修正5: Engine.start() の確認 ⭐
**対象ファイル**: `src/engine/Engine.ts`

**修正内容**:
- `start()` メソッドが PIXI の ticker を使用してゲームループを開始しているか確認
- 各システムの `update()` が呼ばれているか確認

---

## 🎯 修正の優先順位

1. **最優先**: 修正1 (コンポーネントの初期化)
2. **最優先**: 修正2 (エンティティの初期化)
3. **高**: 修正3 (WorldSystem の初期化確認)
4. **中**: 修正4 (カメラの初期位置)
5. **低**: 修正5 (Engine.start() の確認)

---

## 🔧 修正手順

1. `Entity` クラスに `initialize()` メソッドを追加し、すべてのコンポーネントを初期化
2. `EntitySystem.registerEntity()` を修正し、エンティティ登録時に初期化を呼び出す
3. `WorldSystem` の初期化タイミングを確認・修正
4. カメラの初期位置を設定
5. 動作確認：マップとキャラクターが表示されるか確認
6. Engine のゲームループを確認

---

## 📝 補足

### 旧システムとの主な違い

| 項目 | 旧システム | 新システム |
|------|-----------|-----------|
| スプライト追加 | 即座に `container.addChild()` | `renderEntity()` 経由でレイヤーに追加 |
| 初期化タイミング | コンストラクタ内で即座に | `initialize()` メソッドで遅延初期化 |
| レンダリング | Stage が直接管理 | RendererSystem が管理 |
| カメラ | Stage.camera (PIXI.Container) | RendererSystem.camera (Camera クラス) |

### 新システムの設計意図
- **遅延初期化**: リソースの読み込みを非同期で行う
- **レイヤー管理**: 描画順序を明確に管理
- **ECS アーキテクチャ**: コンポーネントベースの柔軟な設計

### 問題の根本原因
- **初期化の呼び忘れ**: `Entity.initialize()` や `Component.initialize()` が呼ばれていない
- **非同期処理の不完全な実装**: `await` が適切に使われていない箇所がある

