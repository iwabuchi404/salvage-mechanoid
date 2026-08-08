# 🚨 緊急デバッグ依頼

## 現状の理解

### 確認済み事項

1. **ObstaclePlacerは正しく動作**
   - 9個の Cover obstacles を壁際に配置
   - 8個の Destructible obstacles を配置
   - 合計17個

2. **BasicFeaturePlacerは障害物ではない**
   - 136個の「features」はタイル（地形）
   - WATER, MOUNTAIN, HEAL, PORTAL などのタイルタイプ
   - GameObjectではない

3. **使用されているシステム**
   - `src/game.ts` が実行されている
   - `GameObject` として障害物を配置
   - `Stage.addObject()` で登録

---

## 🔍 必要な情報

**もう一度ゲームを起動して、以下のログを確認してください：**

### 1. 障害物の座標ログ

```
Placing obstacles on stage:
  Obstacle at (15, 5) - Type: crate
  Obstacle at (17, 8) - Type: barrel
  ...
```

**これらの座標をすべてコピーしてください。**

---

### 2. 部屋の情報

```
Room 14,2 (6x8, area=48): target=2 obstacles
  ✓ Wall-adjacent: (15, 5)
  ✓ Wall-adjacent: (17, 8)
```

**各部屋の座標と配置された障害物の座標を確認してください。**

---

### 3. 実際の検証

例えば、`Room 14,2 (6x8)` の場合：

- **部屋の範囲**: X: 14-19, Y: 2-9
- **壁際の定義**:
  - 左壁際: X = 15 (14 + 1)
  - 右壁際: X = 18 (14 + 6 - 2)
  - 上壁際: Y = 3 (2 + 1)
  - 下壁際: Y = 8 (2 + 8 - 2)

`Obstacle at (15, 5)` は：
- X = 15 → **左壁際** ✅
- Y = 5 → 中央（壁際ではない）

これは**左壁際**に配置されています。

---

## 🎯 確認してほしいこと

### 質問1: 座標は壁際か？

ログに表示される座標を、部屋の範囲と照らし合わせて確認してください。

### 質問2: 画面上の障害物の数は？

- ログ: 17個
- 画面: 何個見えますか？

### 質問3: 障害物の位置

画面上で、障害物が以下のどこにあるか確認してください：
- [ ] 部屋の壁際
- [ ] 部屋の中央
- [ ] 通路の中
- [ ] その他

---

## 📸 可能であれば

1. **スクリーンショット**
   - ゲーム画面全体
   - 障害物の配置が見える画像

2. **コンソールログ全体**
   - `Placing obstacles on stage:` から始まる部分
   - すべての座標

---

## 🤔 考えられる原因

### 原因A: 座標変換の問題

`GameObject.updateSpritePosition()` で座標変換が間違っている可能性：

```typescript
const screenPosition = this.stage.isometricToScreen(this.position.x, this.position.y);
this.sprite.x = screenPosition.x;
this.sprite.y = screenPosition.y - (this.position.z * this.stage.getTileHeight()) / 2;
```

### 原因B: 別のシステムが障害物を追加

`BasicFeaturePlacer` 以外に、別のシステムが障害物を追加している可能性。

### 原因C: 視覚的な問題

座標は正しいが、グラフィックの表示位置がずれている。

---

## 📋 チェックリスト

以下を確認してください：

- [ ] コンソールログの `Placing obstacles on stage:` の内容
- [ ] 各障害物の座標
- [ ] 部屋の範囲（Room X,Y (WxH)）
- [ ] 画面上の障害物の数
- [ ] 障害物が実際にどこに見えるか

---

**この情報があれば、正確に問題を特定できます！**

