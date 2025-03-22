import { System } from '../System';
import { Engine } from '../Engine';
import { Entity } from './Entity';
import { EventSystem } from '../events/EventSystem';
import { EventName } from '../types';

/**
 * エンティティシステム - ゲーム内のすべてのエンティティを管理
 */
export class EntitySystem implements System {
  // エンティティのマップ（ID -> エンティティ）
  private entities: Map<string, Entity> = new Map();

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
    if (!this.eventSystem) {
      console.warn('EventSystem not found, entity events will not be processed');
    }

    console.log('EntitySystem initialized');
  }

  /**
   * エンティティを登録
   * @param entity 登録するエンティティ
   */
  registerEntity(entity: Entity): void {
    if (this.entities.has(entity.id)) {
      console.warn(`Entity with ID ${entity.id} already exists, overwriting`);
    }

    this.entities.set(entity.id, entity);

    // エンティティ作成イベントを発行
    if (this.eventSystem) {
      this.eventSystem.emit(EventName.ENTITY_CREATED, { entity });
    }

    console.log(`Entity registered: ${entity.id} (${entity.type})`);
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

      // エンティティのクリーンアップ
      entity.destroy();

      // マップから削除
      this.entities.delete(id);

      console.log(`Entity removed: ${id}`);
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
    console.log('All entities cleared');
  }
}
