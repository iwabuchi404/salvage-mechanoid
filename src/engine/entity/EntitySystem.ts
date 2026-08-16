import { System } from '../System';
import { Engine } from '../Engine';
import { Entity } from './Entity';
import { EventSystem } from '../events/EventSystem';
import { EventName } from '../types';
import { TransformComponent } from './components/Transform';

/**
 * 位置インデックスのキー（"x,y,z"）
 */
function positionKey(x: number, y: number, z: number): string {
  return `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
}

/**
 * エンティティシステム - ゲーム内のすべてのエンティティを管理
 */
export class EntitySystem implements System {
  // エンティティのマップ（ID -> エンティティ）
  private entities: Map<string, Entity> = new Map();

  // 位置インデックス（"x,y,z" -> エンティティIDの Set）
  // D1: 位置によるエンティティ検索を O(1) にするためのインデックス
  private positionIndex: Map<string, Set<string>> = new Map();

  // エンジンへの参照
  private engine: Engine | null = null;

  // イベントシステムへの参照
  private eventSystem: EventSystem | null = null;

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;

    // イベントシステムを取得
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;

    // D1: ENTITY_MOVED イベントを購読して位置インデックスを更新
    // P0: ペイロード契約を { entityId, from, to, position } に統一
    if (this.eventSystem) {
      this.eventSystem.on(
        EventName.ENTITY_MOVED,
        (data: {
          entityId: string;
          from: { x: number; y: number; z: number };
          to: { x: number; y: number; z: number };
          position: { x: number; y: number; z: number };
        }) => {
          const entity = this.entities.get(data.entityId);
          if (entity) {
            this.updateEntityPosition(entity, data.from);
          }
        }
      );
    }
  }

  /**
   * エンティティを登録
   * @param entity 登録するエンティティ
   */
  registerEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);

    // 位置インデックスへ追加（D1）
    this.indexEntityPosition(entity);

    // エンティティ作成イベントを発行
    if (this.eventSystem) {
      this.eventSystem.emit(EventName.ENTITY_CREATED, { entity });
    }
  }

  /**
   * エンティティの位置をインデックスへ反映する（D1）
   * エンティティが移動した後に呼び出す必要がある。
   * @param entity 対象エンティティ
   * @param oldPosition 旧位置（省略時は現在のインデックスから推定）
   */
  updateEntityPosition(entity: Entity, oldPosition?: { x: number; y: number; z: number }): void {
    // 旧位置のインデックスから削除
    if (oldPosition) {
      this.removeFromPositionIndex(entity.id, oldPosition.x, oldPosition.y, oldPosition.z);
    } else {
      // 旧位置が不明な場合は全位置インデックスから当該エンティティを削除
      this.removeAllPositionEntries(entity.id);
    }
    // 新位置のインデックスへ追加
    this.indexEntityPosition(entity);
  }

  /**
   * 指定位置にあるエンティティを取得する（D1: O(1) 位置検索）
   * @param x X座標
   * @param y Y座標
   * @param z Z座標
   * @returns エンティティの配列（空の場合あり）
   */
  getEntitiesAtPosition(x: number, y: number, z = 0): Entity[] {
    const key = positionKey(x, y, z);
    const ids = this.positionIndex.get(key);
    if (!ids || ids.size === 0) return [];

    const result: Entity[] = [];
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity && entity.active) {
        result.push(entity);
      }
    }
    return result;
  }

  /**
   * 指定位置にある最初のエンティティを取得する（D1）
   * @param x X座標
   * @param y Y座標
   * @param z Z座標
   * @returns エンティティ、または undefined
   */
  getEntityAtPosition(x: number, y: number, z = 0): Entity | undefined {
    return this.getEntitiesAtPosition(x, y, z)[0];
  }

  /**
   * エンティティを位置インデックスへ追加（内部用）
   */
  private indexEntityPosition(entity: Entity): void {
    const transform = entity.getComponent<TransformComponent>('transform');
    if (!transform) return;

    const pos = transform.position;
    const key = positionKey(pos.x, pos.y, pos.z);
    let set = this.positionIndex.get(key);
    if (!set) {
      set = new Set();
      this.positionIndex.set(key, set);
    }
    set.add(entity.id);
  }

  /**
   * 指定位置のインデックスからエンティティを削除（内部用）
   */
  private removeFromPositionIndex(id: string, x: number, y: number, z: number): void {
    const key = positionKey(x, y, z);
    const set = this.positionIndex.get(key);
    if (set) {
      set.delete(id);
      if (set.size === 0) {
        this.positionIndex.delete(key);
      }
    }
  }

  /**
   * 全位置インデックスから当該エンティティを削除（内部用）
   * 旧位置が不明な場合のフォールバック
   */
  private removeAllPositionEntries(id: string): void {
    for (const [key, set] of this.positionIndex) {
      if (set.delete(id) && set.size === 0) {
        this.positionIndex.delete(key);
      }
    }
  }

  /**
   * IDでエンティティを取得
   * @param id エンティティのID
   * @returns エンティティ、または undefined
   */
  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /**
   * タイプでエンティティを検索
   * @param type エンティティのタイプ
   * @returns エンティティの配列
   */
  getEntitiesByType(type: string): Entity[] {
    const result: Entity[] = [];

    for (const entity of this.entities.values()) {
      if (entity.type === type) {
        result.push(entity);
      }
    }

    return result;
  }

  /**
   * タグでエンティティを検索
   * @param tag 検索するタグ
   * @returns マッチするエンティティの配列
   */
  getEntitiesByTag(tag: string): Entity[] {
    const result: Entity[] = [];

    for (const entity of this.entities.values()) {
      if (entity.hasTag(tag)) {
        result.push(entity);
      }
    }

    return result;
  }

  /**
   * エンティティを削除
   * @param id 削除するエンティティのID
   * @returns 削除が成功した場合は true
   */
  removeEntity(id: string): boolean {
    const entity = this.entities.get(id);

    if (entity) {
      // エンティティ削除イベントを発行
      if (this.eventSystem) {
        this.eventSystem.emit(EventName.ENTITY_DESTROYED, { entity });
      }

      // 位置インデックスから削除（D1）
      this.removeAllPositionEntries(id);

      // エンティティのクリーンアップ
      entity.destroy();

      // マップから削除
      this.entities.delete(id);

      return true;
    }

    return false;
  }

  /**
   * 各フレームでの更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // すべてのエンティティを更新
    for (const entity of this.entities.values()) {
      if (entity.active) {
        entity.update(deltaTime);
      }
    }
  }

  /**
   * 登録済みのエンティティ数を取得
   * @returns エンティティの数
   */
  getEntityCount(): number {
    return this.entities.size;
  }

  /**
   * すべてのエンティティを取得
   * @returns エンティティの配列
   */
  getEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * すべてのエンティティをクリア
   */
  clear(): void {
    // すべてのエンティティを破棄
    for (const entity of this.entities.values()) {
      entity.destroy();

      // エンティティ削除イベントを発行
      if (this.eventSystem) {
        this.eventSystem.emit(EventName.ENTITY_DESTROYED, { entity });
      }
    }

    this.entities.clear();
    this.positionIndex.clear();
  }

  /**
   * システムを破棄（Engine.reset() から呼ばれる）
   * clear() と同等の処理を行い、すべてのエンティティを破棄する
   */
  destroy(): void {
    this.clear();
    this.eventSystem = null;
  }
}
