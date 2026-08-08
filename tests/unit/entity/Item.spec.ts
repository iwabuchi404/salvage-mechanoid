import { HealthComponent } from '@/engine/entity/components/Health';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { Entity } from '@/engine/entity/Entity';
import { Item } from '@/engine/entity/Item';
import { InventoryItemType, ItemRarity, ItemType, PlacedItem } from '@/engine/types';

describe('Item', () => {
  const createPlacedItem = (overrides: Partial<PlacedItem> = {}): PlacedItem => ({
    id: 'test-item-1',
    type: ItemType.CONSUMABLE,
    rarity: ItemRarity.COMMON,
    x: 5,
    y: 3,
    properties: {},
    ...overrides,
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('配置データをエンティティとTransformへ反映する', () => {
    const item = new Item(
      createPlacedItem({
        type: ItemType.HEALTH,
        rarity: ItemRarity.RARE,
        properties: { healAmount: 25 },
      })
    );

    expect(item.id).toBe('test-item-1');
    expect(item.type).toBe('item');
    expect(item.getItemType()).toBe(ItemType.HEALTH);
    expect(item.getRarity()).toBe(ItemRarity.RARE);
    expect(item.getProperty('healAmount')).toBe(25);
    expect(item.getProperty('missing', 10)).toBe(10);
    expect(item.getPosition()).toEqual({ x: 5, y: 3, z: 0 });
    expect(item.getComponent<TransformComponent>('transform')?.entity).toBe(item);
    expect(item.getTags()).toEqual(
      expect.arrayContaining(['item', ItemType.HEALTH, `rarity_${ItemRarity.RARE}`])
    );
  });

  it('収集は一度だけ成功し、アイテムを非アクティブにする', () => {
    const item = new Item(createPlacedItem());

    expect(item.collect()).toBe(true);
    expect(item.isCollected()).toBe(true);
    expect(item.active).toBe(false);
    expect(item.collect()).toBe(false);
  });

  it('回復アイテムの効果をHealthComponentへ委譲する', () => {
    const item = new Item(
      createPlacedItem({ type: ItemType.HEALTH, properties: { healAmount: 25 } })
    );
    const target = new Entity('target', 'player');
    const health = new HealthComponent(100, 40, 0, 0, 0, false);
    target.addComponent(health);

    item.applyEffect(target);

    expect(health.currentHp).toBe(65);
  });

  it.each([
    [InventoryItemType.HEALTH_PACK, 'ヘルスパック', 'heal', 30, true],
    [InventoryItemType.ENERGY_CELL, 'エネルギーセル', 'energy', 50, true],
    [InventoryItemType.WEAPON_UPGRADE, '武器強化モジュール', 'stat_boost', 5, false],
    [InventoryItemType.ARMOR_UPGRADE, '装甲強化モジュール', 'stat_boost', 3, false],
    [InventoryItemType.KEY_ITEM, 'アクセスキー', 'special', undefined, false],
  ])('%sをインベントリ用データへ変換する', (inventoryType, name, effectType, value, stackable) => {
    const item = new Item(createPlacedItem());
    const expectedEffect = value === undefined ? { type: effectType } : { type: effectType, value };

    item.setInventoryItemType(inventoryType as InventoryItemType);

    expect(item.toInventoryItem()).toEqual(
      expect.objectContaining({
        id: 'test-item-1',
        type: inventoryType,
        name,
        effect: expect.objectContaining(expectedEffect),
        stackable,
        quantity: 1,
      })
    );
  });

  it('インベントリ種別を設定していない場合は変換しない', () => {
    const item = new Item(createPlacedItem());

    expect(item.toInventoryItem()).toBeNull();
  });
});
