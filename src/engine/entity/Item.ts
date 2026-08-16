import { Entity } from './Entity';
import { TransformComponent } from './components/Transform';
import {
  Vector3,
  ItemType,
  ItemRarity,
  PlacedItem,
  InventoryItemType,
  InventoryItem,
} from '../types';

/**
 * アイテムエンティティクラス
 * 拾得可能なアイテムを表現
 */
export class Item extends Entity {
  private itemType: ItemType;
  private rarity: ItemRarity;
  private properties: Record<string, any>;
  private collected = false;
  private inventoryItemType: InventoryItemType | null = null;
  private itemData: Omit<InventoryItem, 'id'> | null = null;

  /**
   * コンストラクタ
   * @param placedItem 配置されたアイテムデータ
   */
  constructor(placedItem: PlacedItem) {
    super(placedItem.id, 'item');

    // タグを追加
    this.addTag('item');
    this.addTag(placedItem.type);
    this.addTag(`rarity_${placedItem.rarity}`);

    this.itemType = placedItem.type;
    this.rarity = placedItem.rarity;
    this.properties = placedItem.properties || {};

    // Transform コンポーネントを追加
    this.addComponent(new TransformComponent(placedItem.x, placedItem.y, 0));
  }

  /**
   * 初期化
   * C1: 描画ライフサイクルは ItemPresentation が担当するため、
   * ドメイン初期化のみを行う
   */
  async initialize(): Promise<void> {
    await super.initialize();
  }

  /**
   * アイテムタイプを取得
   */
  getItemType(): ItemType {
    return this.itemType;
  }

  /**
   * レアリティを取得
   */
  getRarity(): ItemRarity {
    return this.rarity;
  }

  /**
   * インベントリアイテムタイプを取得
   * C1: Presentation 側が表示色を決定するために使用する
   */
  getInventoryItemType(): InventoryItemType | null {
    return this.inventoryItemType;
  }

  /**
   * プロパティを取得
   */
  getProperties(): Record<string, any> {
    return this.properties;
  }

  /**
   * 特定のプロパティを取得
   */
  getProperty<T = any>(key: string, defaultValue?: T): T {
    return (this.properties[key] as T) ?? (defaultValue as T);
  }

  /**
   * アイテムが収集済みかどうか
   */
  isCollected(): boolean {
    return this.collected;
  }

  /**
   * アイテムを収集
   * @returns 収集に成功したかどうか
   */
  collect(): boolean {
    if (this.collected) {
      return false;
    }

    this.collected = true;
    this.active = false;
    console.log(`Item collected: ${this.id} (${this.itemType})`);
    return true;
  }

  /**
   * アイテムの効果を適用
   * @param target 効果を適用する対象エンティティ
   */
  applyEffect(target: Entity): void {
    switch (this.itemType) {
      case ItemType.ENERGY:
        // エネルギー回復処理
        // TODO: エネルギーコンポーネントへの適用
        console.log(`Applied energy effect to ${target.id}`);
        break;

      case ItemType.HEALTH: {
        // 体力回復処理
        const health = target.getComponent<any>('health');
        if (health && typeof health.heal === 'function') {
          const healAmount = this.getProperty('healAmount', 20);
          health.heal(healAmount);
          console.log(`Healed ${target.id} for ${healAmount} HP`);
        }
        break;
      }

      case ItemType.WEAPON:
      case ItemType.ARMOR:
      case ItemType.UPGRADE:
        // 装備・アップグレード処理
        // TODO: インベントリシステムへの追加
        console.log(`Added ${this.itemType} to ${target.id}'s inventory`);
        break;

      case ItemType.KEY:
        // 鍵アイテム処理
        // TODO: インベントリシステムへの追加
        console.log(`Added key to ${target.id}'s inventory`);
        break;

      case ItemType.CONSUMABLE:
        // 消耗品処理
        console.log(`Used consumable on ${target.id}`);
        break;
    }
  }

  /**
   * インベントリアイテムタイプを設定
   * @param invType インベントリアイテムタイプ
   */
  setInventoryItemType(invType: InventoryItemType): void {
    this.inventoryItemType = invType;
    this.itemData = this.createItemData(invType);
  }

  /**
   * アイテムタイプからアイテムデータを生成
   */
  private createItemData(type: InventoryItemType): Omit<InventoryItem, 'id'> {
    switch (type) {
      case InventoryItemType.HEALTH_PACK:
        return {
          type: InventoryItemType.HEALTH_PACK,
          name: 'ヘルスパック',
          description: 'HPを30回復する',
          effect: {
            type: 'heal',
            value: 30,
          },
          stackable: true,
          quantity: 1,
        };

      case InventoryItemType.ENERGY_CELL:
        return {
          type: InventoryItemType.ENERGY_CELL,
          name: 'エネルギーセル',
          description: 'エネルギーを50回復する',
          effect: {
            type: 'energy',
            value: 50,
          },
          stackable: true,
          quantity: 1,
        };

      case InventoryItemType.WEAPON_UPGRADE:
        return {
          type: InventoryItemType.WEAPON_UPGRADE,
          name: '武器強化モジュール',
          description: '攻撃力を永続的に5上昇させる',
          effect: {
            type: 'stat_boost',
            statType: 'strength',
            value: 5,
          },
          stackable: false,
          quantity: 1,
        };

      case InventoryItemType.ARMOR_UPGRADE:
        return {
          type: InventoryItemType.ARMOR_UPGRADE,
          name: '装甲強化モジュール',
          description: '防御力を永続的に3上昇させる',
          effect: {
            type: 'stat_boost',
            statType: 'defense',
            value: 3,
          },
          stackable: false,
          quantity: 1,
        };

      case InventoryItemType.KEY_ITEM:
        return {
          type: InventoryItemType.KEY_ITEM,
          name: 'アクセスキー',
          description: 'ポータルを解放する特殊なキー',
          effect: {
            type: 'special',
          },
          stackable: false,
          quantity: 1,
        };

      default:
        throw new Error(`Unknown inventory item type: ${type}`);
    }
  }

  /**
   * アイテムをインベントリアイテムに変換
   */
  toInventoryItem(): InventoryItem | null {
    console.log(
      `toInventoryItem called for item ${this.id}, inventoryItemType: ${this.inventoryItemType}, itemData:`,
      this.itemData
    );
    if (!this.itemData) {
      console.warn(`itemData is null for item ${this.id}`);
      return null;
    }
    return {
      id: this.id,
      ...this.itemData,
    };
  }

  /**
   * アイテムの位置を取得
   */
  getPosition(): Vector3 {
    const transform = this.getComponent<TransformComponent>('transform');
    return transform ? transform.position : { x: 0, y: 0, z: 0 };
  }
}
