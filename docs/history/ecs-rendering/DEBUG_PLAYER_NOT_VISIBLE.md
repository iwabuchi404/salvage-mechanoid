# プレイヤーが表示されない問題のデバッグ

## 🔍 確認すべきこと

### 1. ブラウザコンソールで以下のログを探してください

```
Texture loaded successfully: ./robo01_l.png
Added sprite to layer 'characters' at position (33, 12, 0)
```

これらのログが出ていれば、プレイヤーのスプライトは作成されています。

### 2. ブラウザコンソールで以下を実行

```javascript
// PIXIアプリケーションを取得
const canvas = document.querySelector('#game-container canvas');
const app = canvas.__PIXI_APP__;

// キャラクターレイヤーを取得
const charactersLayer = app.stage.children.find(c => c.zIndex === 300);
console.log('Characters layer:', charactersLayer);
console.log('Characters count:', charactersLayer ? charactersLayer.children.length : 0);

// プレイヤースプライトを探す（最初のスプライトがプレイヤーのはず）
if (charactersLayer && charactersLayer.children.length > 0) {
  const playerSprite = charactersLayer.children[0];
  console.log('First character sprite (should be player):', {
    x: playerSprite.x.toFixed(1),
    y: playerSprite.y.toFixed(1),
    visible: playerSprite.visible,
    alpha: playerSprite.alpha,
    width: playerSprite.width.toFixed(1),
    height: playerSprite.height.toFixed(1),
    zIndex: playerSprite.zIndex,
    texture: playerSprite.texture.textureCacheIds
  });
  
  // 画面内にあるか確認
  const inScreen = 
    playerSprite.x >= -200 && playerSprite.x <= 1000 &&
    playerSprite.y >= -200 && playerSprite.y <= 800;
  console.log('Is player in screen bounds?', inScreen);
  
  // プレイヤーを強制的に画面中央に移動（テスト用）
  // playerSprite.x = 400;
  // playerSprite.y = 300;
  // playerSprite.visible = true;
  // playerSprite.alpha = 1;
  // console.log('Player moved to center for testing');
}

// カメラ位置を確認
console.log('Camera position:', {
  x: app.stage.children[0].x,
  y: app.stage.children[0].y
});
```

### 3. 考えられる原因

#### 原因A: プレイヤースプライトが画面外にいる
- カメラ位置の計算が間違っている
- プレイヤーの座標が極端に大きい/小さい

#### 原因B: プレイヤースプライトが他のスプライトの後ろに隠れている
- zIndex の計算が間違っている
- レイヤーの順序が間違っている

#### 原因C: プレイヤースプライトが透明になっている
- `visible = false` または `alpha = 0`

#### 原因D: テクスチャの読み込みに失敗している
- `./robo01_l.png` が存在しない
- `width = 0, height = 0`

---

## 🔧 障害物の位置ずれについて

障害物は表示されているが位置がずれている場合、以下を確認：

### アンカーポイントの問題

障害物のアンカーポイントが `(0.5, 1.0)` になっているか確認してください。

```javascript
// ブラウザコンソールで実行
const objectsLayer = app.stage.children.find(c => c.zIndex === 200);
if (objectsLayer && objectsLayer.children.length > 0) {
  const obstacle = objectsLayer.children[0];
  console.log('Obstacle sprite:', {
    x: obstacle.x.toFixed(1),
    y: obstacle.y.toFixed(1),
    anchor: { x: obstacle.anchor.x, y: obstacle.anchor.y },
    width: obstacle.width.toFixed(1),
    height: obstacle.height.toFixed(1)
  });
}
```

### 期待されるアンカーポイント
- タイル: `(0.5, 1.0)` - 底面中央
- キャラクター: `(0.5, 1.0)` - 足元中央
- 障害物: `(0.5, 1.0)` - 底面中央

---

## 🎯 次のステップ

1. 上記のコンソールコマンドを実行して結果を報告してください
2. プレイヤースプライトの位置、可視性、テクスチャ情報を確認してください
3. 障害物のアンカーポイントを確認してください

これらの情報があれば、正確な修正ができます。



