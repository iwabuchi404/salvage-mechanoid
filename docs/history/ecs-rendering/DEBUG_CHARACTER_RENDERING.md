# キャラクター表示問題のデバッグ

## 🔍 ブラウザコンソールで実行してください

```javascript
// PIXIアプリケーションを取得
const canvas = document.querySelector('#game-container canvas');
const app = canvas.__PIXI_APP__;

// キャラクターレイヤーを確認
const charactersLayer = app.stage.children.find(c => c.zIndex === 300);
console.log('Characters layer:', charactersLayer);
console.log('Characters count:', charactersLayer ? charactersLayer.children.length : 0);

// プレイヤースプライトを確認
if (charactersLayer && charactersLayer.children.length > 0) {
  const playerSprite = charactersLayer.children[0];
  console.log('Player sprite:', {
    x: playerSprite.x,
    y: playerSprite.y,
    visible: playerSprite.visible,
    alpha: playerSprite.alpha,
    width: playerSprite.width,
    height: playerSprite.height,
    texture: playerSprite.texture,
    zIndex: playerSprite.zIndex
  });
  
  // 画面内にあるか確認
  console.log('Screen bounds: 0-800 x 0-600');
  console.log('Is in screen?', 
    playerSprite.x >= -100 && playerSprite.x <= 900 &&
    playerSprite.y >= -100 && playerSprite.y <= 700
  );
}

// すべてのレイヤーの情報を表示
console.log('=== All Layers ===');
app.stage.children.forEach((layer, i) => {
  console.log(`Layer ${i} (zIndex: ${layer.zIndex}):`, {
    children: layer.children.length,
    visible: layer.visible,
    alpha: layer.alpha
  });
  
  // 最初の3個のスプライトを表示
  layer.children.slice(0, 3).forEach((sprite, j) => {
    console.log(`  Sprite ${j}:`, {
      x: sprite.x.toFixed(1),
      y: sprite.y.toFixed(1),
      visible: sprite.visible,
      width: sprite.width.toFixed(1),
      height: sprite.height.toFixed(1)
    });
  });
});
```

## 📊 期待される結果

### 正常な場合
- Characters layer が存在する
- Characters count が 17（プレイヤー1 + 敵16）
- Player sprite の x, y が画面内（0-800, 0-600付近）
- visible が true
- alpha が 1
- width, height が 0 より大きい

### 問題がある場合

#### ケース1: スプライトが画面外
```
Player sprite: { x: -2000, y: -3000, ... }
Is in screen? false
```
→ カメラ位置の計算が間違っている

#### ケース2: スプライトが存在しない
```
Characters count: 0
```
→ `renderEntity` が呼ばれていない、または `sprite.parent` チェックで追加されていない

#### ケース3: スプライトが透明
```
Player sprite: { ..., visible: false, alpha: 0, ... }
```
→ 可視性の設定が間違っている

#### ケース4: テクスチャが読み込まれていない
```
Player sprite: { ..., width: 0, height: 0, texture: [Texture: EMPTY] }
```
→ 画像の読み込みに失敗している

---

## 🔧 タイルの高さ問題

現在のタイル設定: `160x120`

実際の画像サイズを確認する必要があります。

### 画像サイズを確認
```javascript
// タイル画像のサイズを確認
const terrainLayer = app.stage.children.find(c => c.zIndex === 100);
if (terrainLayer && terrainLayer.children.length > 0) {
  const tileSprite = terrainLayer.children[0];
  console.log('Tile sprite:', {
    width: tileSprite.width,
    height: tileSprite.height,
    texture: {
      width: tileSprite.texture.width,
      height: tileSprite.texture.height
    }
  });
}
```

### タイルが4分の1の高さになっている原因

アイソメトリック座標変換の式：
```typescript
y: ((x + y) * this.tileHeight) / 2
```

`tileHeight = 120` の場合、実際の画像が `480px` の高さなら、表示は `120px` になります（4分の1）。

**解決策**: 実際の画像サイズに合わせて `tileWidth` と `tileHeight` を調整する必要があります。

---

## 🎯 次のステップ

1. 上記のコンソールコマンドを実行して結果を報告してください
2. タイル画像の実際のサイズを確認してください
3. キャラクター画像（robo01_l.png）の実際のサイズも確認してください

これらの情報があれば、正確な修正ができます。

