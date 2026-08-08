# 障害物配置のデバッグ手順

## 🔍 問題の調査

障害物が壁際に配置されない問題を調査するため、デバッグログを追加しました。

---

## 📝 実行手順

### 1. ゲームを起動

通常通りゲームを起動してください。

---

### 2. ブラウザの開発者ツールを開く

- **Chrome/Edge**: `F12` または `Ctrl+Shift+I`
- **Firefox**: `F12` または `Ctrl+Shift+K`
- **Safari**: `Cmd+Option+I`

---

### 3. コンソールタブを選択

開発者ツールの「Console」タブを選択してください。

---

### 4. ログを確認

以下のようなログが表示されます：

```
ObstaclePlacer: Starting obstacle placement...
ObstaclePlacer: Config: {
  minObstacles: 10,
  maxObstacles: 20,
  coverDensity: 0.4,
  roomCount: 8
}

ObstaclePlacer: Tactical obstacles: 0
ObstaclePlacer: Choke obstacles: 2

placeCoverObjects: Processing 8 rooms
  Room 5,5 (10x8): target=6 obstacles
    Placed: 3, Rejected: 12, Attempts: 15
  Room 20,10 (12x10): target=9 obstacles
    Placed: 5, Rejected: 20, Attempts: 25
  ...

ObstaclePlacer: Cover obstacles: 15
ObstaclePlacer: Destructible obstacles: 8
ObstaclePlacer: Interactive obstacles: 1
ObstaclePlacer: Placed 26 obstacles in 45.23ms
```

---

## 🔎 確認ポイント

### 1. coverDensity の値

```
coverDensity: 0.4
```

- **0.3-0.4**: 低め（部屋の面積50マスあたり15-20個）
- **0.5-0.7**: 普通
- **0.8-1.0**: 高め

**問題の可能性**: coverDensityが低すぎる

---

### 2. 各部屋の target 値

```
Room 5,5 (10x8): target=6 obstacles
```

計算式: `(width * height / 50) * coverDensity`

例: `(10 * 8 / 50) * 0.4 = 0.64` → 切り捨てで `0`

**問題の可能性**: 小さい部屋では target が 0 になる

---

### 3. Placed vs Rejected の比率

```
Placed: 3, Rejected: 12
```

- **Rejected が多い**: `canPlaceObstacle` が厳しすぎる
- **Placed が少ない**: 配置可能な場所が少ない

---

### 4. 各メソッドの配置数

```
Cover obstacles: 15
Destructible obstacles: 8
```

- **Cover が少ない**: coverDensity が低い、または部屋が小さい
- **Destructible が多い**: こちらがメインの配置になっている

---

## 🐛 予想される問題

### 問題1: coverDensity が低すぎる

**現在の設定**:
```typescript
coverDensity: 0.3 + difficulty * 0.1  // 0.3-0.4
```

**推奨設定**:
```typescript
coverDensity: 0.6 + difficulty * 0.2  // 0.6-0.8
```

---

### 問題2: 小さい部屋で target が 0 になる

**現在の計算**:
```typescript
const coverCount = Math.floor(((room.width * room.height) / 50) * config.coverDensity);
```

例: 6x6の部屋 = `(36 / 50) * 0.4 = 0.288` → `0`

**推奨修正**:
```typescript
const coverCount = Math.max(
  1,  // 最低1個
  Math.floor(((room.width * room.height) / 50) * config.coverDensity)
);
```

---

### 問題3: canPlaceObstacle が厳しすぎる

壁際の配置を許可したはずですが、他の条件で拒否されている可能性があります。

**確認項目**:
- `isOnCorridor` が壁際を通路と判定していないか
- `isWalkable` が正しく動作しているか
- 既存の障害物との重複チェック

---

## 📊 ログの見方

### 良い例（配置成功率が高い）

```
Room 10,10 (15x12): target=10 obstacles
  Placed: 9, Rejected: 5, Attempts: 14
```

- 配置成功率: 9/14 = 64%
- 目標達成率: 9/10 = 90%

---

### 悪い例（配置成功率が低い）

```
Room 5,5 (8x6): target=2 obstacles
  Placed: 0, Rejected: 10, Attempts: 10
```

- 配置成功率: 0/10 = 0%
- 目標達成率: 0/2 = 0%

→ **何かが間違っている！**

---

## 🔧 次のステップ

### ステップ1: ログを共有

コンソールログをコピーして共有してください。

特に以下の情報が重要です：
- `ObstaclePlacer: Config`
- 各部屋の `target` 値
- `Placed` と `Rejected` の数

---

### ステップ2: 修正案の適用

ログを確認後、以下のいずれかを修正します：

1. **coverDensity を増やす**
   - より多くの障害物を配置

2. **最低配置数を保証**
   - 小さい部屋でも最低1-2個配置

3. **canPlaceObstacle の条件を緩和**
   - より多くの場所に配置可能に

4. **配置範囲を拡大**
   - 壁際をより積極的に使用

---

## 📸 スクリーンショット

可能であれば、以下のスクリーンショットも共有してください：

1. **ゲーム画面**: 障害物の配置状況
2. **コンソールログ**: 上記のログ全体

---

**デバッグログを確認して、結果を教えてください！**

