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
import { Engine } from '../Engine';
import { RendererSystem } from '../graphics/RendererSystem';
import * as PIXI from 'pixi.js';

/**
 * アイテムエンティティクラス
 * 拾得可能なアイテムを表現
 */
export class Item extends Entity {
  private itemType: ItemType;
  private rarity: ItemRarity;
  private properties: Record<string, any>;
  private collected = false;
  private graphics: PIXI.Graphics | null = null;
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
   */
  async initialize(): Promise<void> {
    // 親クラスの initialize() を呼び出してコンポーネントを初期化
    await super.initialize();

    // アイテムは画像がないため、PIXI.Graphics で円を描画
    this.createItemGraphics();
  }

  /**
   * アイテムのグラフィックスを作成してレンダラーに登録
   */
  private createItemGraphics(): void {
    const rendererSystem = Engine.instance.getSystem<RendererSystem>('renderer');
    if (!rendererSystem) return;

    const transform = this.getComponent<TransformComponent>('transform');
    if (!transform) return;

    // アイテムタイプに応じた色を取得
    const color = this.getItemColor();

    // PIXI.Graphics で円を描画
    const graphics = new PIXI.Graphics();
    graphics.circle(0, 0, 8);
    graphics.fill(color);
    graphics.stroke({ width: 2, color: 0x000000 });

    // 座標変換
    const coordSystem = rendererSystem.getCoordinateSystem();
    const camera = rendererSystem.getCamera();
    const pos = transform.position;
    const screenPos = coordSystem.isometricToScreen(pos.x, pos.y, pos.z);

    // ベーススクリーン座標を保存（Y座標は少し上にオフセット）
    (graphics as any).__baseScreenX = screenPos.x;
    (graphics as any).__baseScreenY = screenPos.y - 16;

    // カメラオフセットを適用
    graphics.x = screenPos.x - camera.x;
    graphics.y = screenPos.y - camera.y - 16;

    // 深度ソート用のzIndex（SpriteComponentと同じ計算式）
    const baseZIndex = (pos.y + pos.x) * 1000;
    graphics.zIndex = baseZIndex + pos.z * 100;

    // グラフィックスを保存
    this.graphics = graphics;

    // 深度ソートを正しく行うため、キャラクターと同じレイヤー（characters）に追加
    const layer = rendererSystem.getLayer('characters');
    if (layer) {
      layer.addChild(graphics);
    }
  }

  /**
   * アイテムタイプに応じた色を取得
   */
  private getItemColor(): number {
    // インベントリアイテムタイプがある場合はそちらを優先
    if (this.inventoryItemType) {
      switch (this.inventoryItemType) {
        case InventoryItemType.HEALTH_PACK:
          return 0x00ff00; // 緑
        case InventoryItemType.ENERGY_CELL:
          return 0x00ffff; // シアン
        case InventoryItemType.WEAPON_UPGRADE:
          return 0xff9900; // オレンジ
        case InventoryItemType.ARMOR_UPGRADE:
          return 0x0099ff; // 青
        case InventoryItemType.KEY_ITEM:
          return 0xffff00; // 黄色
        default:
          break;
      }
    }

    // ItemTypeに応じた色
    switch (this.itemType) {
      case ItemType.HEALTH:
        return 0x00ff00; // 緑
      case ItemType.ENERGY:
        return 0x00ffff; // シアン
      case ItemType.WEAPON:
        return 0xff9900; // オレンジ
      case ItemType.ARMOR:
        return 0x0099ff; // 青
      case ItemType.KEY:
        return 0xffff00; // 黄色
      case ItemType.UPGRADE:
        return 0xff00ff; // マゼンタ
      case ItemType.CONSUMABLE:
        return 0xffffff; // 白
      default:
        return 0xffffff;
    }
  }

  /**
   * レアリティに応じた色を取得（将来的な拡張用）
   */
  private getRarityColor(): number {
    switch (this.rarity) {
      case ItemRarity.COMMON:
        return 0xffffff; // 白
      case ItemRarity.UNCOMMON:
        return 0x00ff00; // 緑
      case ItemRarity.RARE:
        return 0x0080ff; // 青
      case ItemRarity.LEGENDARY:
        return 0xff8000; // 橙
      default:
        return 0xffffff;
    }
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
   * アイテムグラフィックを作成（PIXI.Graphics版）
   * @param stage ステージオブジェクト（座標変換用）
   * @returns PIXI.Graphics
   */
  createGraphics(stage: {
    isometricToScreen: (x: number, y: number) => { x: number; y: number };
  }): PIXI.Graphics {
    const graphics = new PIXI.Graphics();

    // インベントリアイテムタイプがある場合はそちらを優先
    if (this.inventoryItemType) {
      const colorMap: { [key: string]: number } = {
        [InventoryItemType.HEALTH_PACK]: 0x00ff00, // 緑
        [InventoryItemType.ENERGY_CELL]: 0x00ffff, // シアン
        [InventoryItemType.WEAPON_UPGRADE]: 0xff9900, // オレンジ
        [InventoryItemType.ARMOR_UPGRADE]: 0x0099ff, // 青
        [InventoryItemType.KEY_ITEM]: 0xffff00, // 黄色
      };

      const color = colorMap[this.inventoryItemType] || 0xffffff;

      // 円形で描画
      graphics.circle(0, 0, 10);
      graphics.fill(color);
      graphics.stroke({ width: 2, color: 0x000000 });
    }

    // 位置設定
    const transform = this.getComponent<TransformComponent>('transform');
    if (transform && stage) {
      const screenPos = stage.isometricToScreen(transform.position.x, transform.position.y);
      graphics.x = screenPos.x;
      graphics.y = screenPos.y - 20;
    }

    this.graphics = graphics;
    return graphics;
  }

  /**
   * グラフィックを取得
   */
  getGraphics(): PIXI.Graphics | null {
    return this.graphics;
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

  /**
   * アイテムを削除（取得時）
   */
  override destroy(): void {
    // グラフィックを削除
    if (this.graphics && this.graphics.parent) {
      this.graphics.parent.removeChild(this.graphics);
      this.graphics.destroy();
      this.graphics = null;
    }

    // エンティティ削除
    super.destroy();
  }

  /**
   * 更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // 親クラスのupdate()を呼び出してコンポーネントを更新
    super.update(deltaTime);

    // アイテムが収集済みまたは非アクティブなら非表示
    // 位置更新は RendererSystem.updateTerrainLayerPositions() で行われる
    if (this.graphics) {
      this.graphics.visible = this.active && !this.collected;
    }
  }
}
