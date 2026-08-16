import { createPinia, setActivePinia } from 'pinia';
import { Player } from '@/engine/entity/Player';
import { PlayerInitialConfig } from '@/engine/entity/PlayerInitialConfig';
import { Game } from '@/game/Game';
import { StatsProjection } from '@/game/StatsProjection';
import { useGameStore } from '@/stores/gameStore';
import { InventoryItemType } from '@/engine/types';
import { Engine } from '@/engine/Engine';
import { EventSystem } from '@/engine/events/EventSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';

const defaultConfig: PlayerInitialConfig = {
  maxHp: 100,
  hp: 100,
  maxEnergy: 100,
  energy: 80,
  defense: 5,
  strength: 10,
  viewRadius: 4,
  level: 1,
};

describe('Player energy integration', () => {
  let eventSystem: EventSystem;
  let entitySystem: EntitySystem;
  let projection: StatsProjection;

  beforeEach(() => {
    setActivePinia(createPinia());

    eventSystem = new EventSystem();
    entitySystem = new EntitySystem();

    jest.spyOn(Engine, 'instance', 'get').mockReturnValue({
      getSystem: jest.fn((key: string) => {
        if (key === 'event') return eventSystem;
        if (key === 'entity') return entitySystem;
        return undefined;
      }),
    } as any);

    projection = new StatsProjection();
    projection.initialize();

    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('EnergyComponentの変更を表示用ストアへ同期する', () => {
    const store = useGameStore();
    const player = new Player('player', { x: 0, y: 0, z: 0 }, defaultConfig);
    entitySystem.registerEntity(player);

    expect(player.consumeEnergy(30)).toBe(true);
    expect(player.getEnergy()).toBe(50);
    expect(store.player.status.energy).toBe(50);

    expect(player.restoreEnergy(20)).toBe(20);
    expect(player.getEnergy()).toBe(70);
    expect(store.player.status.energy).toBe(70);
  });

  it('最大エネルギーの変更とスナップショット復元を同じ正本へ反映する', () => {
    const store = useGameStore();
    const config = { ...defaultConfig, energy: 70, maxEnergy: 100 };
    const player = new Player('player', { x: 0, y: 0, z: 0 }, config);
    entitySystem.registerEntity(player);

    expect(player.increaseMaxEnergy(25)).toBe(true);
    expect(player.getEnergySnapshot()).toEqual({ currentEnergy: 70, maxEnergy: 125 });
    expect(store.player.status.maxEnergy).toBe(125);

    expect(player.restoreEnergySnapshot({ currentEnergy: 40, maxEnergy: 90 })).toBe(true);
    expect(player.getEnergySnapshot()).toEqual({ currentEnergy: 40, maxEnergy: 90 });
    expect(store.player.status.energy).toBe(40);
    expect(store.player.status.maxEnergy).toBe(90);
  });

  it('エネルギーアイテムはPlayer用ハンドラがない場合に消費しない', () => {
    const store = useGameStore();
    store.addItemToInventory({
      id: 'energy-cell',
      type: InventoryItemType.ENERGY_CELL,
      name: 'Energy Cell',
      description: 'Restores energy',
      effect: { type: 'energy', value: 50 },
      stackable: false,
      quantity: 1,
    });

    expect(store.useItem('energy-cell')).toBe(false);
    expect(store.inventory).toHaveLength(1);
  });

  it('エネルギーアイテムの効果をPlayer経由で適用してから消費する', () => {
    const store = useGameStore();
    const config = { ...defaultConfig, energy: 20, maxEnergy: 100 };
    const player = new Player('player', { x: 0, y: 0, z: 0 }, config);
    entitySystem.registerEntity(player);
    store.addItemToInventory({
      id: 'energy-cell',
      type: InventoryItemType.ENERGY_CELL,
      name: 'Energy Cell',
      description: 'Restores energy',
      effect: { type: 'energy', value: 50 },
      stackable: false,
      quantity: 1,
    });

    const game = new Game();
    (game as unknown as { player: Player }).player = player;

    const success = game.useInventoryItem('energy-cell');

    expect(success).toBe(true);
    expect(player.getEnergy()).toBe(70);
    expect(store.player.status.energy).toBe(70);
    expect(store.inventory).toHaveLength(0);
  });

  it('スキルの消費もPlayer経由で正本と表示値を更新する', () => {
    const store = useGameStore();
    const config = { ...defaultConfig, energy: 80, maxEnergy: 100 };
    const player = new Player('player', { x: 0, y: 0, z: 0 }, config);
    entitySystem.registerEntity(player);
    const game = new Game();
    (game as unknown as { player: Player }).player = player;
    jest.spyOn(game, 'getSkillSystem').mockReturnValue({
      useSkill: jest.fn(() => true),
      getSkill: jest.fn(() => ({ energyCost: 25 })),
    } as any);

    expect(game.useSkill('test-skill')).toBe(true);
    expect(player.getEnergy()).toBe(55);
    expect(store.player.status.energy).toBe(55);
  });
});
