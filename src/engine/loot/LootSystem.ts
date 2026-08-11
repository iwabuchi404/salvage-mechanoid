import { System } from '../System';
import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';
import { EntitySystem } from '../entity/EntitySystem';
import { ItemFactory } from '../factory/ItemFactory';
import { ItemType, ItemRarity, PlacedItem } from '../types';

/**
 * ルートシステム - 敵を倒した時のアイテムドロップを管理
 */
export class LootSystem implements System {
  // エンジンへの参照
  private engine: Engine | null = null;

  // イベントシステムへの参照
  private eventSystem: EventSystem | null = null;

  // エンティティシステムへの参照
  private entitySystem: EntitySystem | null = null;

  // ドロップ確率（0-1）
  private dropChance = 0.3; // 30%の確率でドロップ

  // enemy_destroyed 購読の解除と再初期化時の重複防止に使用する
  private enemyDestroyedListener:
    | ((data: { position?: { x: number; y: number; z: number } }) => void)
    | null = null;

  // 非同期生成が開始された System ライフサイクルを識別する
  private lifecycleVersion = 0;

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    this.unsubscribeFromEnemyDestroyed();
    this.lifecycleVersion += 1;
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    this.entitySystem = engine.getSystem<EntitySystem>('entity') || null;

    // イベントリスナーを設定
    this.setupEventListeners();

    console.log('LootSystem initialized');
  }

  /**
   * 毎フレームの更新処理
   */
  update(): void {
    // ルートシステムはイベント駆動
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) {
      return;
    }

    // 敵が倒された時にアイテムをドロップ
    this.enemyDestroyedListener = (data) => {
      if (data.position) {
        void this.tryDropItem(data.position).catch((error) => {
          console.error('Failed to spawn dropped item:', error);
        });
      }
    };
    this.eventSystem.on('enemy_destroyed', this.enemyDestroyedListener);
  }

  /**
   * アイテムをドロップする（確率判定）
   * @param position ドロップ位置
   */
  private async tryDropItem(position: { x: number; y: number; z: number }): Promise<void> {
    // ドロップ判定
    if (Math.random() > this.dropChance) {
      console.log('No item dropped (failed drop chance)');
      return;
    }

    // ドロップするアイテムタイプを決定
    const itemType = this.selectRandomItemType();

    // アイテムを生成
    await this.spawnItem(itemType, position);
  }

  /**
   * ランダムなアイテムタイプを選択
   * @returns アイテムタイプ
   */
  private selectRandomItemType(): ItemType {
    const itemTypes: ItemType[] = [
      ItemType.ENERGY,
      ItemType.HEALTH,
      ItemType.WEAPON,
      ItemType.ARMOR,
      ItemType.CONSUMABLE,
    ];

    // 重み付け（エネルギーと体力が出やすい）
    const weights = [
      0.35, // ENERGY - 35%
      0.35, // HEALTH - 35%
      0.15, // WEAPON - 15%
      0.1, // ARMOR - 10%
      0.05, // CONSUMABLE - 5%
    ];

    // 重み付けランダム選択
    const random = Math.random();
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += weights[i];
      if (random < sum) {
        return itemTypes[i];
      }
    }

    // フォールバック
    return ItemType.ENERGY;
  }

  /**
   * アイテムを生成
   * @param itemType アイテムタイプ
   * @param position 生成位置
   */
  private async spawnItem(
    itemType: ItemType,
    position: { x: number; y: number; z: number }
  ): Promise<void> {
    const entitySystem = this.entitySystem;
    const lifecycleVersion = this.lifecycleVersion;
    if (!entitySystem) {
      console.warn('EntitySystem not found, cannot spawn item');
      return;
    }

    // PlacedItemデータを作成
    const placedItem: PlacedItem = {
      id: `item_drop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: itemType,
      rarity: ItemRarity.COMMON,
      x: position.x,
      y: position.y,
      properties: {},
    };

    // マップ配置アイテムと同じ Factory を通して、型変換と初期化を一元化する
    const item = await ItemFactory.create(placedItem);

    // 非同期生成中に LootSystem が破棄・再初期化された場合は旧 System へ登録しない
    if (this.lifecycleVersion !== lifecycleVersion || this.entitySystem !== entitySystem) {
      item.destroy();
      return;
    }

    // エンティティシステムに登録
    entitySystem.registerEntity(item);

    console.log(`Item dropped: ${itemType} at (${position.x}, ${position.y}, ${position.z})`);

    // アイテムドロップイベントを発行
    this.eventSystem?.emit('item_dropped', {
      itemId: item.id,
      itemType: itemType,
      position: position,
    });
  }

  /**
   * ドロップ確率を設定
   * @param chance ドロップ確率（0-1）
   */
  setDropChance(chance: number): void {
    this.dropChance = Math.max(0, Math.min(1, chance));
  }

  /**
   * ドロップ確率を取得
   * @returns ドロップ確率
   */
  getDropChance(): number {
    return this.dropChance;
  }

  /**
   * イベント購読と System 参照を解放する
   */
  destroy(): void {
    this.unsubscribeFromEnemyDestroyed();
    this.lifecycleVersion += 1;
    this.entitySystem = null;
    this.eventSystem = null;
    this.engine = null;
  }

  /**
   * enemy_destroyed の購読を解除する
   */
  private unsubscribeFromEnemyDestroyed(): void {
    if (this.eventSystem && this.enemyDestroyedListener) {
      this.eventSystem.off('enemy_destroyed', this.enemyDestroyedListener);
    }

    this.enemyDestroyedListener = null;
  }
}
