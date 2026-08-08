# レンダリング問題のデバッグチェックリスト

## 🔍 確認すべきコンソールログ

ブラウザの開発者ツール（F12）のコンソールタブで以下のログを確認してください：

### 1. エンティティ初期化ログ
```
Initializing entity: player
Texture loaded successfully: ./robo01_l.png
Entity initialized: player
```
- ✅ このログが出ていれば、エンティティは正しく初期化されている
- ❌ 出ていなければ、`Entity.initialize()` が呼ばれていない

### 2. スプライト追加ログ
```
Added sprite to layer 'characters' at position (x, y, z)
Added sprite to layer 'terrain' at position (x, y, z)
```
- ✅ このログが出ていれば、スプライトはレイヤーに追加されている
- ❌ 出ていなければ、`renderEntity()` が呼ばれていない

### 3. カメラ位置ログ
```
Camera positioned at (-xxx, -yyy) to center player
```
- カメラの位置が適切か確認

### 4. タイルマップレンダリングログ
```
Rendering tilemap: 50x50
Rendered 2500 tiles
```
- タイルが実際に描画されているか確認

---

## 🎯 考えられる原因

### 原因1: カメラ位置の計算が間違っている ⭐⭐⭐
**症状**: オブジェクトは表示されるが、タイルとキャラクターが表示されない

**問題**:
```typescript
// Game.ts で設定
camera.setPosition(-screenPos.x + 400, -screenPos.y + 300);

// RendererSystem.renderEntity() で使用
sprite.x = screenPos.x + this.camera.x;  // これが間違い！
sprite.y = screenPos.y + this.camera.y;
```

カメラの位置が負の値なのに、スプライトの位置に**加算**している。
正しくは**減算**すべき。

**修正案**:
```typescript
// カメラオフセットを引く
sprite.x = screenPos.x - this.camera.x;
sprite.y = screenPos.y - this.camera.y;
```

または、カメラの位置設定を変更：
```typescript
// カメラの位置を正の値で設定
camera.setPosition(screenPos.x - 400, screenPos.y - 300);
```

---

### 原因2: レイヤーが表示されていない ⭐⭐
**確認方法**:
```javascript
// ブラウザのコンソールで実行
const app = document.querySelector('canvas').__PIXI_APP__;
console.log('Stage children:', app.stage.children.length);
app.stage.children.forEach((child, i) => {
  console.log(`Layer ${i}:`, child.children.length, 'children, visible:', child.visible);
});
```

---

### 原因3: スプライトが画面外に配置されている ⭐⭐
**確認方法**:
```javascript
// ブラウザのコンソールで実行
const app = document.querySelector('canvas').__PIXI_APP__;
const terrainLayer = app.stage.children.find(c => c.label === 'terrain');
if (terrainLayer) {
  console.log('Terrain layer children:', terrainLayer.children.length);
  terrainLayer.children.slice(0, 5).forEach(sprite => {
    console.log('Sprite position:', sprite.x, sprite.y, 'visible:', sprite.visible);
  });
}
```

---

### 原因4: タイルマップのレンダリングが実行されていない ⭐
**確認方法**:
コンソールログで `Rendering tilemap:` が出ているか確認

---

## 🔧 デバッグ手順

### ステップ1: コンソールログを確認
1. ブラウザをリフレッシュ
2. F12で開発者ツールを開く
3. コンソールタブを確認
4. 上記のログが出ているか確認

### ステップ2: PIXIステージを確認
ブラウザのコンソールで以下を実行：
```javascript
const canvas = document.querySelector('#game-container canvas');
const app = canvas.__PIXI_APP__;
console.log('PIXI App:', app);
console.log('Stage children:', app.stage.children.length);
console.log('Stage:', app.stage);

// 各レイヤーの情報を表示
app.stage.children.forEach((layer, i) => {
  console.log(`Layer ${i}:`, {
    children: layer.children.length,
    visible: layer.visible,
    alpha: layer.alpha,
    x: layer.x,
    y: layer.y,
    zIndex: layer.zIndex
  });
  
  // 最初の5個のスプライトを表示
  layer.children.slice(0, 5).forEach((sprite, j) => {
    console.log(`  Sprite ${j}:`, {
      x: sprite.x,
      y: sprite.y,
      visible: sprite.visible,
      alpha: sprite.alpha,
      width: sprite.width,
      height: sprite.height
    });
  });
});
```

### ステップ3: カメラ位置を確認
コンソールログで `Camera positioned at` を探し、カメラの位置を確認

---

## 💡 推奨される修正

### 修正案A: カメラオフセットの計算を修正

**ファイル**: `src/engine/graphics/RendererSystem.ts`

```typescript
// 現在（間違い）
sprite.x = screenPos.x + this.camera.x;
sprite.y = screenPos.y + this.camera.y;

// 修正後（正しい）
sprite.x = screenPos.x - this.camera.x;
sprite.y = screenPos.y - this.camera.y;
```

**理由**: カメラが移動すると、スプライトは逆方向に移動すべき

---

### 修正案B: カメラの位置設定を変更

**ファイル**: `src/game/Game.ts`

```typescript
// 現在
camera.setPosition(-screenPos.x + 400, -screenPos.y + 300);

// 修正後
camera.setPosition(screenPos.x - 400, screenPos.y - 300);
```

**理由**: カメラの位置を正の値で管理し、スプライト位置から減算する

---

## 📊 期待される結果

修正後、以下のようになるはず：
- ✅ タイルマップが画面に表示される
- ✅ プレイヤーが画面中央に表示される
- ✅ 敵、アイテムが表示される
- ✅ カメラがプレイヤーを追跡する

---

## 🚨 緊急デバッグコマンド

ブラウザのコンソールで以下を実行して、すべてのスプライトを強制的に表示：

```javascript
const canvas = document.querySelector('#game-container canvas');
const app = canvas.__PIXI_APP__;

// すべてのレイヤーとスプライトを可視化
app.stage.children.forEach(layer => {
  layer.visible = true;
  layer.alpha = 1;
  layer.children.forEach(sprite => {
    sprite.visible = true;
    sprite.alpha = 1;
    // 画面中央に移動（テスト用）
    // sprite.x = 400;
    // sprite.y = 300;
  });
});

console.log('All sprites made visible');
```

