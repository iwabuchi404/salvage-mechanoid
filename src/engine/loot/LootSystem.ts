import { System } from '../System';
import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';
import { EntitySystem } from '../entity/EntitySystem';
import { Item } from '../entity/Item';
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

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    this.entitySystem = engine.getSystem<EntitySystem>('entity') || null;

    // イベントリスナーを設定
    this.setupEventListeners();

    console.log('LootSystem initialized');
  }

  /**
   * 毎フレームの更新処理
   * @param _deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(_deltaTime: number): void {
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
    this.eventSystem.on('enemy_destroyed', (data) => {
      if (data.position) {
        this.tryDropItem(data.position);
      }
    });
  }

  /**
   * アイテムをドロップする（確率判定）
   * @param position ドロップ位置
   */
  private tryDropItem(position: { x: number; y: number; z: number }): void {
    // ドロップ判定
    if (Math.random() > this.dropChance) {
      console.log('No item dropped (failed drop chance)');
      return;
    }

    // ドロップするアイテムタイプを決定
    const itemType = this.selectRandomItemType();

    // アイテムを生成
    this.spawnItem(itemType, position);
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
  private spawnItem(itemType: ItemType, position: { x: number; y: number; z: number }): void {
    if (!this.entitySystem) {
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

    // アイテムを作成
    const item = new Item(placedItem);

    // エンティティシステムに登録
    this.entitySystem.registerEntity(item);

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
}
