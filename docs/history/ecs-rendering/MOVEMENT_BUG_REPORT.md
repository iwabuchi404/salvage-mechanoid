# 移動不可バグ調査レポート

## 🐛 問題の概要

**症状**: 特定の方向に移動できなくなることがある

**発生頻度**: たまに（不定期）

**影響度**: 高（ゲームプレイに支障）

---

## 🔍 原因分析

### 根本原因

**移動アニメーション中の座標が小数値になることで、衝突判定が誤作動する**

### 詳細な問題フロー

1. **移動アニメーション中の座標**
   - `MovementComponent.update()` (行90-102) で、移動中は座標が小数値で補間される
   ```typescript
   const newX = this._moveStartPosition.x + 
                (this._moveTargetPosition.x - this._moveStartPosition.x) * progress;
   const newY = this._moveStartPosition.y + 
                (this._moveTargetPosition.y - this._moveStartPosition.y) * progress;
   ```
   - 例: (5, 5) から (6, 5) への移動中、座標は (5.5, 5.0) のような小数値になる

2. **衝突判定のタイミング問題**
   - `WorldSystem.isPositionOccupied()` (行288-328) は `Math.round()` で座標を丸める
   - 移動アニメーション中のエンティティの座標も `Math.round()` される
   
3. **問題のシナリオ**
   
   **ケース1: 移動中の自分自身との衝突**
   ```
   プレイヤーが (5, 5) から (6, 5) へ移動中
   - 現在の実座標: (5.7, 5.0) → Math.round() → (6, 5)
   - 次の移動先: (7, 5)
   
   衝突判定:
   - isPositionOccupied(7, 5, 0, "player_id")
   - プレイヤーの現在位置 (5.7, 5.0) → Math.round() → (6, 5)
   - 問題なし（この場合は正常）
   ```
   
   **ケース2: 移動中の敵との衝突（問題発生）**
   ```
   敵が (6, 5) から (7, 5) へ移動中
   - 敵の実座標: (6.3, 5.0) → Math.round() → (6, 5)
   
   プレイヤーが (5, 5) から (6, 5) へ移動しようとする:
   - canMoveTo(6, 5, 0) をチェック
   - isPositionOccupied(6, 5, 0, "player_id")
   - 敵の座標 (6.3, 5.0) → Math.round() → (6, 5)
   - 衝突判定: TRUE（移動不可）
   
   実際には敵は (7, 5) に向かって移動中だが、
   Math.round() により (6, 5) にいると判定される
   ```

   **ケース3: より深刻な問題（四捨五入の境界）**
   ```
   敵が (5, 5) から (6, 5) へ移動中
   - 敵の実座標: (5.5, 5.0) → Math.round() → (6, 5)
   
   プレイヤーが (5, 4) から (5, 5) へ移動完了直後
   - プレイヤー位置: (5, 5)
   
   プレイヤーが右へ移動しようとする:
   - canMoveTo(6, 5, 0) をチェック
   - 敵の座標 (5.5, 5.0) → Math.round() → (6, 5)
   - 衝突判定: TRUE（移動不可）
   
   見た目上は敵が (5, 5) にいるように見えるが、
   判定上は (6, 5) にいることになり、右への移動がブロックされる
   ```

4. **タイミング依存の問題**
   - 移動アニメーション時間: 250ms (デフォルト)
   - この間、座標は連続的に変化
   - `Math.round()` の境界 (x.5) を跨ぐタイミングで判定が反転
   - フレームレートやタイミングにより、問題が発生したりしなかったりする

---

## 📊 影響範囲

### 影響を受けるファイル

1. **`src/engine/entity/components/Movement.ts`**
   - 行78-116: `update()` メソッド（小数座標を生成）
   - 行123-161: `moveInDirection()` メソッド（移動判定）
   - 行220-230: `canMoveTo()` メソッド（WorldSystemを呼び出し）

2. **`src/engine/world/WorldSystem.ts`**
   - 行271-278: `isWalkable()` メソッド
   - 行288-328: `isPositionOccupied()` メソッド（問題の核心）

3. **`src/engine/world/TileMap.ts`**
   - 行148-161: `isWalkable()` メソッド（座標を丸める）

### 影響を受けるエンティティ

- プレイヤー（Player）
- 敵（Enemy）
- その他の移動可能なエンティティすべて

---

## 🎯 再現条件

1. エンティティが移動アニメーション中である
2. 別のエンティティが、移動中のエンティティの目標位置または経路上に移動しようとする
3. 移動中のエンティティの座標が、`Math.round()` により目標位置に丸められる範囲にある

**再現しやすい状況**:
- 敵が多い場所での移動
- 狭い通路での移動
- 連続して移動を試みる場合

---

## 💡 解決策の提案

### 案1: 移動判定時に目標位置を使用（推奨）

**概要**: 移動中のエンティティの衝突判定には、現在の補間座標ではなく目標位置を使用する

**実装方法**:
```typescript
// MovementComponent に目標位置のゲッターを追加
public getTargetPosition(): Vector3 | null {
  return this._isMoving ? this._moveTargetPosition : null;
}

// WorldSystem.isPositionOccupied() を修正
isPositionOccupied(x: number, y: number, z = 0, excludeEntityId?: string): boolean {
  // ...
  const transform = entity.getComponent<TransformComponent>('transform');
  const movement = entity.getComponent<MovementComponent>('movement');
  
  let checkPos = transform.position;
  
  // 移動中の場合は目標位置を使用
  if (movement && movement.isMoving) {
    const targetPos = movement.getTargetPosition();
    if (targetPos) {
      checkPos = targetPos;
    }
  }
  
  const entityX = Math.round(checkPos.x);
  const entityY = Math.round(checkPos.y);
  // ...
}
```

**メリット**:
- 論理的に正確（移動中のエンティティは目標位置を占有している）
- 視覚的な表示と判定が一致
- 根本的な解決

**デメリット**:
- MovementComponent の変更が必要
- 複数ファイルの修正が必要

---

### 案2: 移動中フラグによる除外

**概要**: 移動中のエンティティを衝突判定から除外する

**実装方法**:
```typescript
// WorldSystem.isPositionOccupied() を修正
isPositionOccupied(x: number, y: number, z = 0, excludeEntityId?: string): boolean {
  // ...
  for (const entity of this.getAllEntities()) {
    // 移動中のエンティティは衝突判定しない
    const movement = entity.getComponent<MovementComponent>('movement');
    if (movement && movement.isMoving) {
      continue;
    }
    // ...
  }
}
```

**メリット**:
- 実装が簡単
- 1ファイルの修正のみ

**デメリット**:
- 移動中のエンティティとすり抜け可能になる（非現実的）
- 移動完了直前のタイミングで問題が残る可能性

---

### 案3: 座標の整数化を徹底

**概要**: 移動アニメーション中も座標を整数に保つ

**実装方法**:
```typescript
// MovementComponent.update() を修正
if (progress < 1) {
  // 座標を整数に保つ（アニメーションなし）
  transform.setPosition(
    this._moveTargetPosition.x,
    this._moveTargetPosition.y,
    this._moveTargetPosition.z
  );
}
```

**メリット**:
- 問題が完全に解消
- 判定が単純明快

**デメリット**:
- 移動アニメーションが失われる（視覚的に不自然）
- ゲーム体験の低下

---

### 案4: 衝突判定の精度向上（小数座標対応）

**概要**: `Math.round()` を使わず、小数座標のまま判定する

**実装方法**:
```typescript
// WorldSystem.isPositionOccupied() を修正
isPositionOccupied(x: number, y: number, z = 0, excludeEntityId?: string): boolean {
  const checkX = Math.round(x);
  const checkY = Math.round(y);
  const checkZ = Math.round(z);
  
  for (const entity of this.getAllEntities()) {
    // ...
    const transform = entity.getComponent<TransformComponent>('transform');
    if (transform) {
      const pos = transform.position;
      
      // 小数座標の距離で判定（閾値: 0.3）
      const dx = Math.abs(pos.x - x);
      const dy = Math.abs(pos.y - y);
      const dz = Math.abs(pos.z - z);
      
      if (dx < 0.3 && dy < 0.3 && dz < 0.3) {
        return true;
      }
    }
  }
}
```

**メリット**:
- より正確な判定
- 移動アニメーションを維持

**デメリット**:
- 閾値の調整が必要
- 複雑性が増す
- パフォーマンスへの影響

---

## 🏆 推奨解決策

**案1: 移動判定時に目標位置を使用**

理由:
1. 論理的に最も正確
2. 視覚と判定の一致
3. 根本的な解決
4. 将来的な拡張性

実装の優先順位:
1. `MovementComponent` に `getTargetPosition()` を追加
2. `WorldSystem.isPositionOccupied()` を修正
3. テストして動作確認

---

## 📝 追加の注意事項

### 関連する可能性のある問題

1. **敵AIの移動判定**
   - 敵も同じ `MovementComponent` を使用
   - 同じ問題が発生する可能性

2. **経路探索との整合性**
   - `WorldSystem.findPath()` も同じ判定を使用
   - 経路探索結果と実際の移動可否が不一致になる可能性

3. **マルチプレイヤー対応時の問題**
   - ネットワーク遅延により問題が悪化する可能性

### テスト項目

修正後、以下をテストすること:
1. プレイヤーが敵の近くで移動できるか
2. 敵が移動中にプレイヤーが移動できるか
3. 狭い通路での移動
4. 連続移動（キーを押し続ける）
5. 複数の敵が同時に移動している状況

---

## 📅 作成日時

2025-12-08

## 👤 調査者

AI Assistant (Claude Sonnet 4.5)

