import {
  PlacedItem,
  ItemType,
  ItemRarity,
  ItemPlacementConfig,
  Room,
  RoomType,
  PlacedObstacle,
  TacticalElement,
} from '../../types';

/**
 * アイテム配置システム
 * レアリティとルールに基づいてアイテムを配置
 */
export class ItemPlacer {
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * アイテムを配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param obstacles 障害物のリスト（配置済み）
   * @param tacticalElements 戦術要素のリスト
   * @param config アイテム配置設定
   * @returns 配置されたアイテムのリスト
   */
  placeItems(
    map: number[][],
    rooms: Room[],
    obstacles: PlacedObstacle[],
    tacticalElements: TacticalElement[],
    config: ItemPlacementConfig
  ): PlacedItem[] {
    console.log('ItemPlacer: Starting item placement...');
    const startTime = performance.now();

    const items: PlacedItem[] = [];

    // 1. アイテム総数を決定
    const itemCount = this.calculateItemCount(config, rooms);

    // 2. 宝物部屋へのアイテム配置（高レアリティ）
    items.push(...this.placeTreasureRoomItems(rooms, config));

    // 3. ボス部屋近くに回復アイテム配置
    items.push(...this.placeBossRoomSupplies(rooms, config));

    // 4. 戦術要素近くにアイテム配置
    items.push(...this.placeTacticalItems(tacticalElements, config));

    // 5. 一般アイテムの配置（障害物を考慮）
    const remainingCount = Math.max(0, itemCount - items.length);
    items.push(...this.placeGeneralItems(rooms, obstacles, config, remainingCount));

    const endTime = performance.now();
    console.log(
      `ItemPlacer: Placed ${items.length} items in ${(endTime - startTime).toFixed(2)}ms`
    );

    return items;
  }

  /**
   * アイテム総数を計算
   */
  private calculateItemCount(config: ItemPlacementConfig, rooms: Room[]): number {
    const baseCount = Math.floor(rooms.length * 2);
    const count = Math.floor(Math.random() * (config.maxItems - config.minItems)) + config.minItems;
    return Math.min(count, config.maxItems);
  }

  /**
   * 宝物部屋へのアイテム配置
   */
  private placeTreasureRoomItems(rooms: Room[], config: ItemPlacementConfig): PlacedItem[] {
    const items: PlacedItem[] = [];

    // 宝物部屋を検索
    const treasureRooms = rooms.filter((room) => room.type === RoomType.TREASURE);

    for (const room of treasureRooms) {
      // 宝物部屋には2-4個の高レアアイテムを配置
      const itemCountInRoom = 2 + Math.floor(Math.random() * 3);

      for (let i = 0; i < itemCountInRoom; i++) {
        // 中央付近に配置
        const x = room.x + Math.floor(room.width / 2) + (Math.random() < 0.5 ? -1 : 1);
        const y = room.y + Math.floor(room.height / 2) + (Math.random() < 0.5 ? -1 : 1);

        // 宝物部屋では高レアリティ優先
        const rarity = this.determineTreasureRarity();
        const itemType = this.selectItemType(config.itemTypes, rarity);

        items.push({
          id: `item_treasure_${Date.now()}_${items.length}`,
          type: itemType,
          x,
          y,
          rarity,
          properties: this.generateItemProperties(itemType, rarity),
        });
      }
    }

    return items;
  }

  /**
   * ボス部屋近くに回復アイテム配置
   */
  private placeBossRoomSupplies(rooms: Room[], config: ItemPlacementConfig): PlacedItem[] {
    const items: PlacedItem[] = [];

    // ボス部屋を検索
    const bossRooms = rooms.filter((room) => room.type === RoomType.BOSS);

    for (const bossRoom of bossRooms) {
      // ボス部屋の入口近くに体力とエネルギー回復アイテムを配置
      const entranceX = bossRoom.x + 1;
      const entranceY = bossRoom.y + Math.floor(bossRoom.height / 2);

      // 体力回復
      items.push({
        id: `item_boss_supply_${Date.now()}_${items.length}`,
        type: ItemType.HEALTH,
        x: entranceX,
        y: entranceY - 1,
        rarity: ItemRarity.UNCOMMON,
        properties: { healAmount: 50 },
      });

      // エネルギー回復
      items.push({
        id: `item_boss_supply_${Date.now()}_${items.length}`,
        type: ItemType.ENERGY,
        x: entranceX,
        y: entranceY + 1,
        rarity: ItemRarity.UNCOMMON,
        properties: { energyAmount: 30 },
      });
    }

    return items;
  }

  /**
   * 戦術要素近くにアイテム配置
   */
  private placeTacticalItems(
    tacticalElements: TacticalElement[],
    config: ItemPlacementConfig
  ): PlacedItem[] {
    const items: PlacedItem[] = [];

    // 補給キャッシュの近くにアイテム配置
    for (const element of tacticalElements) {
      if (element.type === 'supply_cache' && Math.random() < 0.7) {
        const rarity = this.determineRarity(config);
        const itemType = this.selectItemType(config.itemTypes, rarity);

        items.push({
          id: `item_tactical_${Date.now()}_${items.length}`,
          type: itemType,
          x: element.x,
          y: element.y,
          rarity,
          properties: this.generateItemProperties(itemType, rarity),
        });
      }
    }

    return items;
  }

  /**
   * 一般アイテムの配置
   */
  private placeGeneralItems(
    rooms: Room[],
    obstacles: PlacedObstacle[],
    config: ItemPlacementConfig,
    count: number
  ): PlacedItem[] {
    const items: PlacedItem[] = [];

    // 危険エリアを避けるルールがあるかチェック
    const avoidEnemiesRule = config.placementRules?.find((rule) => rule.avoidEnemies);

    for (let i = 0; i < count; i++) {
      // ランダムな部屋を選択
      const room = rooms[Math.floor(Math.random() * rooms.length)];

      // ボス部屋と宝物部屋は除外
      if (room.type === RoomType.BOSS || room.type === RoomType.TREASURE) {
        continue;
      }

      // ランダムな位置を選択
      let x, y;
      let attempts = 0;
      const maxAttempts = 20;

      do {
        x = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
        y = room.y + 1 + Math.floor(Math.random() * (room.height - 2));
        attempts++;
      } while (
        attempts < maxAttempts &&
        (this.isPositionOccupied(x, y, items, obstacles) ||
          this.isTooCloseToObstacle(x, y, obstacles))
      );

      if (attempts >= maxAttempts) {
        continue; // この部屋では配置できない
      }

      const rarity = this.determineRarity(config);
      const itemType = this.selectItemType(config.itemTypes, rarity);

      items.push({
        id: `item_general_${Date.now()}_${items.length}`,
        type: itemType,
        x,
        y,
        rarity,
        properties: this.generateItemProperties(itemType, rarity),
      });
    }

    return items;
  }

  /**
   * レアリティを決定
   */
  private determineRarity(config: ItemPlacementConfig): ItemRarity {
    const rand = Math.random();
    const dist = config.rarityDistribution;

    if (rand < dist.common) return ItemRarity.COMMON;
    if (rand < dist.common + dist.uncommon) return ItemRarity.UNCOMMON;
    if (rand < dist.common + dist.uncommon + dist.rare) return ItemRarity.RARE;
    return ItemRarity.LEGENDARY;
  }

  /**
   * 宝物部屋用のレアリティを決定（高レアリティ優先）
   */
  private determineTreasureRarity(): ItemRarity {
    const rand = Math.random();

    if (rand < 0.1) return ItemRarity.LEGENDARY; // 10%
    if (rand < 0.4) return ItemRarity.RARE; // 30%
    if (rand < 0.8) return ItemRarity.UNCOMMON; // 40%
    return ItemRarity.COMMON; // 20%
  }

  /**
   * アイテムタイプを選択
   */
  private selectItemType(availableTypes: ItemType[], rarity: ItemRarity): ItemType {
    // デフォルトタイプ
    const defaultTypes = [ItemType.HEALTH, ItemType.ENERGY, ItemType.CONSUMABLE];
    const types = availableTypes && availableTypes.length > 0 ? availableTypes : defaultTypes;

    // レアリティに応じて特定のアイテムタイプを優先
    if (rarity === ItemRarity.LEGENDARY || rarity === ItemRarity.RARE) {
      // 高レアは武器やアップグレード優先
      const priorityTypes = types.filter(
        (type) => type === ItemType.WEAPON || type === ItemType.UPGRADE || type === ItemType.ARMOR
      );
      if (priorityTypes.length > 0) {
        return priorityTypes[Math.floor(Math.random() * priorityTypes.length)];
      }
    }

    // それ以外はランダム
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * アイテムプロパティを生成
   */
  private generateItemProperties(type: ItemType, rarity: ItemRarity): Record<string, any> {
    const properties: Record<string, any> = {};

    // レアリティに応じた倍率
    const rarityMultiplier = this.getRarityMultiplier(rarity);

    switch (type) {
      case ItemType.HEALTH:
        properties.healAmount = Math.floor(25 * rarityMultiplier);
        break;
      case ItemType.ENERGY:
        properties.energyAmount = Math.floor(20 * rarityMultiplier);
        break;
      case ItemType.WEAPON:
        properties.damage = Math.floor(10 * rarityMultiplier);
        properties.range = 3 + Math.floor(rarityMultiplier / 2);
        break;
      case ItemType.ARMOR:
        properties.defense = Math.floor(5 * rarityMultiplier);
        break;
      case ItemType.UPGRADE:
        properties.upgradeType = this.selectUpgradeType();
        properties.bonusAmount = Math.floor(10 * rarityMultiplier);
        break;
      case ItemType.KEY:
        properties.keyType = 'generic';
        break;
      case ItemType.CONSUMABLE:
        properties.effectType = this.selectConsumableEffect();
        properties.duration = Math.floor(5 * rarityMultiplier);
        break;
    }

    return properties;
  }

  /**
   * レアリティ倍率を取得
   */
  private getRarityMultiplier(rarity: ItemRarity): number {
    switch (rarity) {
      case ItemRarity.COMMON:
        return 1.0;
      case ItemRarity.UNCOMMON:
        return 1.5;
      case ItemRarity.RARE:
        return 2.5;
      case ItemRarity.LEGENDARY:
        return 4.0;
      default:
        return 1.0;
    }
  }

  /**
   * アップグレードタイプを選択
   */
  private selectUpgradeType(): string {
    const types = ['damage', 'defense', 'speed', 'energy_max', 'health_max'];
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * 消耗品効果を選択
   */
  private selectConsumableEffect(): string {
    const effects = ['speed_boost', 'damage_boost', 'shield', 'invisibility', 'rage'];
    return effects[Math.floor(Math.random() * effects.length)];
  }

  /**
   * 位置が占有されているか確認
   */
  private isPositionOccupied(
    x: number,
    y: number,
    items: PlacedItem[],
    obstacles: PlacedObstacle[]
  ): boolean {
    // アイテムと重複チェック
    if (items.find((item) => item.x === x && item.y === y)) {
      return true;
    }

    // 障害物と重複チェック
    if (obstacles.find((obs) => obs.x === x && obs.y === y)) {
      return true;
    }

    return false;
  }

  /**
   * 障害物に近すぎるか確認
   */
  private isTooCloseToObstacle(x: number, y: number, obstacles: PlacedObstacle[]): boolean {
    // 障害物から1タイル以内は避ける（取得しにくいため）
    for (const obs of obstacles) {
      const dist = Math.abs(obs.x - x) + Math.abs(obs.y - y);
      if (dist <= 1) {
        return true;
      }
    }
    return false;
  }
}
