import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { ActorComponent } from '@/engine/entity/components/Actor';
import { TurnScheduler } from '@/engine/turn/TurnScheduler';
import { Action, ActionResult } from '@/engine/turn/Action';
import { getActionCost } from '@/engine/turn/ActionCostTable';

/**
 * BU-3 段階7: 速度差の有効化テスト
 *
 * speed が高いアクターは1ターンに複数回行動し、
 * speed が低いアクターは1回行動することを検証する。
 */
describe('BU-3 段階7: 速度差の有効化', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let scheduler: TurnScheduler;

  beforeEach(async () => {
    events = new EventSystem();
    entities = new EntitySystem();

    jest.spyOn(Engine, 'instance', 'get').mockReturnValue({
      getSystem: jest.fn((key: string) => {
        if (key === 'event') return events;
        if (key === 'entity') return entities;
        return undefined;
      }),
    } as any);

    const mockExecutor = {
      execute: jest.fn(
        async (action: Action): Promise<ActionResult> => ({
          success: true,
          consumedTime: action.cost.timeCost,
        })
      ),
    };

    scheduler = new TurnScheduler();
    scheduler.initialize(Engine.instance);
    (scheduler as any).executor = mockExecutor;

    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    scheduler.stop();
    jest.restoreAllMocks();
  });

  it('speed 100 の敵は1ターンに1回行動する', async () => {
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('enemy-normal', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({
        inputControlled: false,
        speed: 100,
        decideAction: enemySpy,
      })
    );
    entities.registerEntity(enemy);

    scheduler.start();
    scheduler.submitPlayerAction({
      kind: 'wait',
      actorId: 'player',
      cost: getActionCost('wait'),
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(enemySpy).toHaveBeenCalledTimes(1);
  });

  it('speed 200 の敵は1ターンに2回行動する', async () => {
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('enemy-fast', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({
        inputControlled: false,
        speed: 200,
        decideAction: enemySpy,
      })
    );
    entities.registerEntity(enemy);

    scheduler.start();
    scheduler.submitPlayerAction({
      kind: 'wait',
      actorId: 'player',
      cost: getActionCost('wait'),
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(enemySpy).toHaveBeenCalledTimes(2);
  });

  it('speed 300 の敵は1ターンに3回行動する', async () => {
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('enemy-very-fast', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({
        inputControlled: false,
        speed: 300,
        decideAction: enemySpy,
      })
    );
    entities.registerEntity(enemy);

    scheduler.start();
    scheduler.submitPlayerAction({
      kind: 'wait',
      actorId: 'player',
      cost: getActionCost('wait'),
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(enemySpy).toHaveBeenCalledTimes(3);
  });

  it('同速の敵は登録順に行動する', async () => {
    const order: string[] = [];
    const enemy1 = new Entity('enemy-1', 'enemy');
    enemy1.addTag('enemy');
    enemy1.addComponent(
      new ActorComponent({
        inputControlled: false,
        speed: 100,
        decideAction: jest.fn(async () => {
          order.push('enemy-1');
          return null;
        }),
      })
    );
    const enemy2 = new Entity('enemy-2', 'enemy');
    enemy2.addTag('enemy');
    enemy2.addComponent(
      new ActorComponent({
        inputControlled: false,
        speed: 100,
        decideAction: jest.fn(async () => {
          order.push('enemy-2');
          return null;
        }),
      })
    );
    entities.registerEntity(enemy1);
    entities.registerEntity(enemy2);

    scheduler.start();
    scheduler.submitPlayerAction({
      kind: 'wait',
      actorId: 'player',
      cost: getActionCost('wait'),
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(order).toEqual(['enemy-1', 'enemy-2']);
  });
});
