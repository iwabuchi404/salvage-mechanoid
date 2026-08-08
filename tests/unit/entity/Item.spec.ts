import { Item } from '@/engine/entity/Item';
import { PlacedItem, ItemType, ItemRarity } from '@/engine/types';

describe('Item entity dead code removal', () => {
  const createTestPlacedItem = (): PlacedItem => ({
    id: 'test-item-1',
    type: ItemType.CONSUMABLE,
    rarity: ItemRarity.COMMON,
    x: 5,
    y: 3,
    properties: {},
  });

  it('should not have createGraphics method', () => {
    const item = new Item(createTestPlacedItem());
    expect((item as any).createGraphics).toBeUndefined();
  });

  it('should not have getGraphics method', () => {
    const item = new Item(createTestPlacedItem());
    expect((item as any).getGraphics).toBeUndefined();
  });
});
