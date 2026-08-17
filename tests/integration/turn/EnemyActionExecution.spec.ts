import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { ActorComponent } from '@/engine/entity/components/Actor';
import { TurnScheduler } from '@/engine/turn/TurnScheduler';
import { Action, ActionResult } from '@/engine/turn/Action';
import { getActionCost } from '@/engine/turn/ActionCostTable';

/**
 * BU-3 段階6 / P2: 敵 AI が Action を返した場合の TurnScheduler 実行テスト
 *
 * ActionExecutor が汎用化され、敵の Action も ActionExecutor 経由で実行されることを検証する。
 */
describe('BU-3 段階6 / P2: 敵 AI の Action ベース実行', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let scheduler: TurnScheduler;
  let executedActions: Action[];

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

    executedActions = [];

    const mockExecutor = {
      execute: jest.fn(async (action: Action): Promise<ActionResult> => {
        executedActions.push(action);
        return { success: true, consumedTime: action.cost.timeCost };
      }),
    };

    scheduler = new TurnScheduler();
    scheduler.initialize(Engine.instance);
    (scheduler as any).executor = mockExecutor;

    // プレイヤーを登録
    const player = new Entity('player', 'player');
    player.addTag('player');
    player.addComponent(new ActorComponent({ inputControlled: true, actionSpeed: 100 }));
    entities.registerEntity(player);

    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    scheduler.stop();
    jest.restoreAllMocks();
  });

  /** 次の player_input_requested まで待つ */
  async function waitForNextInputRequest(timeoutMs = 200): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        events.off('player_input_requested', handler);
        resolve();
      }, timeoutMs);
      const handler = () => {
        clearTimeout(timer);
        events.off('player_input_requested', handler);
        setTimeout(resolve, 5);
      };
      events.on('player_input_requested', handler);
    });
  }

  it('敵が Action を返した場合 ActionExecutor 経由で実行される', async () => {
    const enemyAction: Action = {
      kind: 'wait',
      actorId: 'enemy-1',
      cost: getActionCost('wait'),
    };
    const enemy = new Entity('enemy-1', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({
        inputControlled: false,
        actionSpeed: 100,
        decideAction: jest.fn(async () => enemyAction),
      })
    );
    entities.registerEntity(enemy);

    scheduler.start();
    await waitForNextInputRequest();

    scheduler.submitPlayerAction({
      kind: 'wait',
      actorId: 'player',
      cost: getActionCost('wait'),
    });
    await waitForNextInputRequest();

    // プレイヤー行動と敵行動の両方が ActionExecutor 経由で実行される
    expect(executedActions).toHaveLength(2);
    expect(executedActions[1]).toEqual(enemyAction);
  });

  it('敵が null を返した場合は従来通り副作用実行済みとして扱う', async () => {
    const sideEffect = jest.fn();
    const enemy = new Entity('enemy-1', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({
        inputControlled: false,
        actionSpeed: 100,
        decideAction: jest.fn(async () => {
          sideEffect();
          return null;
        }),
      })
    );
    entities.registerEntity(enemy);

    scheduler.start();
    await waitForNextInputRequest();

    scheduler.submitPlayerAction({
      kind: 'wait',
      actorId: 'player',
      cost: getActionCost('wait'),
    });
    await waitForNextInputRequest();

    // 副作用は実行される
    expect(sideEffect).toHaveBeenCalledTimes(1);
    // ActionExecutor にはプレイヤー行動のみ渡される
    expect(executedActions).toHaveLength(1);
  });
});
