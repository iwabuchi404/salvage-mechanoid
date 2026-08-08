# 敵が密集時に動かなくなる問題 - 原因分析

**分析日:** 2025-11-08  
**問題:** 敵が密集した場合に動かなくなる

---

## 🔴 問題の原因

### 原因1: 経路探索の失敗時の処理不足 ⭐ **主要原因**

**場所:** `src/common/EnemyBehavior.ts` (60-70行目)

```typescript
if (distance <= this.chaseDistance) {
  const path = stage.findPath(enemyPos, playerPos);
  console.log('path.length', path.length);
  if (path.length > 2) {
    const nextStep = path[1];
    await stage.moveCharacter(enemy, nextStep.x, nextStep.y, nextStep.z);
  } else if (path.length === 2) {
    // プレイヤーに隣接している場合、攻撃
    player.takeDamage(await enemy.attack());
  }
  // ❌ 問題: path.length が 0 または 1 の場合、何もしない
}
```

**問題点:**
- `path.length === 0` (経路が見つからない)
- `path.length === 1` (現在位置のみ)

この場合、**何もせず次のターンでまた同じ処理を繰り返す**

**密集時の状況:**
```
敵A → 経路探索 → 他の敵に阻まれる → path.length = 0 → 何もしない
敵B → 経路探索 → 他の敵に阻まれる → path.length = 0 → 何もしない
敵C → 経路探索 → 他の敵に阻まれる → path.length = 0 → 何もしない
↓
全員が動けず、デッドロック状態！
```

---

### 原因2: 移動失敗時のフォールバック処理がない

**場所:** `src/common/Stage.ts` (522-528行目)

```typescript
if (
  !this.isValidMove(targetX, targetY, targetZ) ||
  this.isOccupied(targetX, targetY, targetZ)
) {
  // ❌ 問題: 単にreturnするだけで、代替行動がない
  return Promise.resolve();
}
```

**問題点:**
- 移動先が占有されている場合、何もしない
- 敵は「移動できなかった」ことを知らない
- 次のターンでまた同じ場所に移動しようとする

---

### 原因3: ランダム移動が1方向のみ試行

**場所:** `src/common/EnemyBehavior.ts` (78-103行目)

```typescript
private async moveRandomly(enemy: Enemy, stage: Stage): Promise<void> {
  const directions = ['up', 'down', 'left', 'right'];
  const randomDirection = directions[Math.floor(Math.random() * directions.length)];
  // ...
  
  if (stage.isWalkable(newX, newY, currentPosition.z)) {
    await stage.moveCharacter(enemy, newX, newY, currentPosition.z);
  }
  // ❌ 問題: 1方向だけ試して、ダメなら何もしない
}
```

**問題点:**
- ランダムに1方向を選ぶ
- その方向が塞がっていたら、他の方向を試さない
- 密集時は全方向が塞がっている可能性が高い

---

### 原因4: 経路探索が他の敵を考慮していない可能性

**場所:** `src/engine/world/WorldSystem.ts` の `findPath` メソッド

経路探索時に、**他の敵の位置を障害物として考慮しているか**が不明確。

もし考慮していない場合:
```
敵A: プレイヤーへの経路 = [A, B, C, Player]
敵B: プレイヤーへの経路 = [B, C, Player]
↓
両方とも同じマスCに移動しようとする
↓
先に移動した敵がCを占有
↓
後の敵は移動できない
```

---

## 📊 デッドロックが発生するシナリオ

### シナリオ1: 狭い通路での渋滞

```
壁壁壁壁壁
壁敵敵敵壁
壁敵P敵壁  ← プレイヤーを囲んでいる
壁敵敵敵壁
壁壁壁壁壁
```

**何が起こるか:**
1. 全ての敵がプレイヤーに向かおうとする
2. しかし、全方向が他の敵で塞がれている
3. 経路探索が失敗 → 何もしない
4. 次のターンも同じ → **デッドロック**

---

### シナリオ2: 複数の敵が同じ目標地点を目指す

```
敵A → ● (目標)
敵B → ●
敵C → ●
```

**何が起こるか:**
1. 敵A, B, Cが同じマスに移動しようとする
2. 敵Aが先に移動成功
3. 敵B, Cは移動失敗 → 何もしない
4. 次のターン、敵B, Cはまた同じマスを目指す → **繰り返し**

---

## 🎯 解決策

### 解決策1: 経路探索失敗時のフォールバック処理 ⭐ **最重要**

```typescript
// src/common/EnemyBehavior.ts
async act(enemy: Enemy, stage: Stage): Promise<void> {
  const player = stage.getPlayer();
  if (player) {
    const enemyPos = enemy.getPosition();
    const playerPos = player.getPosition();
    const distance = stage.getDistance(enemyPos, playerPos);

    if (distance <= this.chaseDistance) {
      const path = stage.findPath(enemyPos, playerPos);
      
      if (path.length > 2) {
        const nextStep = path[1];
        const moved = await stage.moveCharacter(enemy, nextStep.x, nextStep.y, nextStep.z);
        
        // ✅ 移動失敗時のフォールバック
        if (!moved) {
          await this.tryAlternativeMove(enemy, stage, playerPos);
        }
      } else if (path.length === 2) {
        // プレイヤーに隣接している場合、攻撃
        player.takeDamage(await enemy.attack());
      } else {
        // ✅ 経路が見つからない場合のフォールバック
        await this.tryAlternativeMove(enemy, stage, playerPos);
      }
    } else {
      await this.moveRandomly(enemy, stage);
    }
  }
}

// ✅ 新規メソッド: 代替移動を試行
private async tryAlternativeMove(
  enemy: Enemy,
  stage: Stage,
  targetPos: { x: number; y: number; z: number }
): Promise<void> {
  const enemyPos = enemy.getPosition();
  
  // プレイヤーに近づく方向を優先的に試す
  const directions = this.getSortedDirections(enemyPos, targetPos);
  
  for (const dir of directions) {
    const newPos = this.getPositionInDirection(enemyPos, dir);
    const moved = await stage.moveCharacter(enemy, newPos.x, newPos.y, newPos.z);
    if (moved) {
      return; // 移動成功
    }
  }
  
  // 全方向が塞がっている場合は待機（何もしない）
}
```

---

### 解決策2: moveCharacterの戻り値を追加

```typescript
// src/common/Stage.ts
public async moveCharacter(
  character: Character | Enemy,
  targetX: number,
  targetY: number,
  targetZ: number
): Promise<boolean> {  // ✅ 戻り値を追加
  if (
    !this.isValidMove(targetX, targetY, targetZ) ||
    this.isOccupied(targetX, targetY, targetZ)
  ) {
    return false;  // ✅ 移動失敗を通知
  }

  // ... 移動処理 ...
  
  return true;  // ✅ 移動成功を通知
}
```

---

### 解決策3: ランダム移動で全方向を試行

```typescript
// src/common/EnemyBehavior.ts
private async moveRandomly(enemy: Enemy, stage: Stage): Promise<boolean> {
  const currentPosition = enemy.getPosition();
  
  // ✅ 全方向をシャッフルして試行
  const directions = ['up', 'down', 'left', 'right'];
  this.shuffleArray(directions);
  
  for (const direction of directions) {
    const newPos = this.getPositionInDirection(currentPosition, direction);
    
    if (stage.isWalkable(newPos.x, newPos.y, newPos.z)) {
      const moved = await stage.moveCharacter(enemy, newPos.x, newPos.y, newPos.z);
      if (moved) {
        return true;  // 移動成功
      }
    }
  }
  
  return false;  // 全方向が塞がっている
}

// ✅ 配列をシャッフル
private shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
```

---

### 解決策4: 経路探索で他の敵を考慮

```typescript
// src/engine/world/WorldSystem.ts
findPath(start: Vector3, end: Vector3): Vector3[] {
  // ...
  
  // ✅ 他の敵の位置を障害物として考慮
  const isWalkable = (x: number, y: number) => {
    if (!this.tileMap.isWalkable(x, y)) return false;
    
    // 他のエンティティが占有しているかチェック
    const entities = this.getAllEntities();
    for (const entity of entities) {
      if (entity.hasTag('enemy') || entity.hasTag('player')) {
        const transform = entity.getComponent<TransformComponent>('transform');
        if (transform && transform.position.x === x && transform.position.y === y) {
          // ゴール地点でない限り、占有されているマスは通れない
          if (x !== end.x || y !== end.y) {
            return false;
          }
        }
      }
    }
    
    return true;
  };
  
  // A*アルゴリズムで経路探索...
}
```

---

### 解決策5: 待機カウンターの導入（高度）

```typescript
// src/engine/entity/Enemy.ts
export class Enemy extends Entity {
  private stuckCounter = 0;  // ✅ 動けなかった回数
  private lastPosition: Vector3 | null = null;
  
  updateAI(deltaTime: number, playerPosition: Vector3): void {
    const currentPos = this.getPosition();
    
    // ✅ 前回と同じ位置なら、stuckカウンターを増やす
    if (this.lastPosition &&
        this.lastPosition.x === currentPos.x &&
        this.lastPosition.y === currentPos.y) {
      this.stuckCounter++;
    } else {
      this.stuckCounter = 0;
    }
    
    this.lastPosition = { ...currentPos };
    
    // ✅ 3ターン以上動けていない場合、特別な行動
    if (this.stuckCounter >= 3) {
      // オプション1: ランダムな方向に強制移動を試みる
      // オプション2: 一時的に待機モードに入る
      // オプション3: 別の目標地点を設定する
      this.handleStuckSituation();
      this.stuckCounter = 0;
    }
    
    // 通常のAI処理...
  }
}
```

---

## 📈 推奨される実装順序

### フェーズ1: 最小限の修正（即効性あり）

1. ✅ **moveCharacterに戻り値を追加** (5分)
2. ✅ **経路探索失敗時のフォールバック** (15分)
3. ✅ **ランダム移動で全方向を試行** (10分)

**効果:** デッドロックの80%を解消

---

### フェーズ2: 改善（推奨）

4. ✅ **経路探索で他の敵を考慮** (30分)
5. ✅ **方向の優先順位付け** (15分)

**効果:** より自然な敵の動き、渋滞の軽減

---

### フェーズ3: 高度な対策（オプション）

6. ✅ **待機カウンターの導入** (30分)
7. ✅ **群衆シミュレーション** (2-3時間)

**効果:** 完全なデッドロック解消、リアルな集団行動

---

## 🎯 まとめ

### 問題の本質

**「移動できなかった時に何もしない」**

これが積み重なることで、全ての敵が動けなくなる。

### 解決の鍵

1. **移動失敗を検知する** (戻り値)
2. **代替行動を取る** (フォールバック)
3. **複数の選択肢を試す** (全方向試行)
4. **他の敵を考慮する** (経路探索)

### 最優先の修正

**解決策1, 2, 3** を実装すれば、ほとんどのデッドロックは解消されます。

---

**レポート終了**

