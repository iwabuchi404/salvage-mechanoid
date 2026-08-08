import { Component } from '../../engine/entity/Component';
import { Entity } from '../../engine/entity/Entity';
import { TransformComponent } from '../../engine/entity/components/Transform';
import { Engine } from '../../engine/Engine';
import { TileMap } from '../../engine/world/TileMap';
import { WorldSystem } from '../../engine/world/WorldSystem';

export class AIComponent implements Component {
  type = 'ai';
  entity: Entity | null = null;

  private behavior: string;
  private searchRange: number;

  constructor(behavior = 'random', searchRange = 5) {
    this.behavior = behavior;
    this.searchRange = searchRange;
  }

  initialize(): void {
    // イベントリスナー登録など
  }

  update(deltaTime: number): void {
    if (!this.entity) return;

    // 現在のターンが敵のターンかチェック

    // 対応する行動を実行
    switch (this.behavior) {
      case 'random':
        this.randomMovement();
        break;
      case 'chase':
        this.chasePlayer();
        break;
      case 'patrol':
        this.patrolArea();
        break;
    }
  }

  private randomMovement(): void {
    if (!this.entity) return;

    const transform = this.entity.getComponent<TransformComponent>('transform');
    if (!transform) return;

    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    const newPos = {
      x: transform.position.x + randomDir.x,
      y: transform.position.y + randomDir.y,
      z: transform.position.z,
    };

    // タイルマップから移動可能か確認
    const tileMap = Engine.instance.getSystem<WorldSystem>('world')?.getTileMap();
    if (tileMap && tileMap.isWalkable(newPos.x, newPos.y, newPos.z)) {
      transform.setPosition(newPos.x, newPos.y, newPos.z);
    }
  }

  private chasePlayer(): void {
    // プレイヤー追跡の実装
  }

  private patrolArea(): void {
    // パトロール行動の実装
  }
}
