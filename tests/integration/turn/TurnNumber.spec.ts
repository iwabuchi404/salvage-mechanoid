import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { TurnScheduler } from '@/engine/turn/TurnScheduler';
import { ActorComponent } from '@/engine/entity/components/Actor';
import { getActionCost } from '@/engine/turn/ActionCostTable';
import { Action, ActionResult } from '@/engine/turn/Action';

/**
 * BU-3 段階1 / 案B: ターン番号の単調増加テスト
 *
 * TurnScheduler において、プレイヤー行動完了ごとに
 * turnNumber が +1 され、turn_started イベントが発行されることを検証する。
 */
describe('BU-3 段階1: ターン番号の導入（案Bスケジューラ）', () => {
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

  /** wait 行動を投入する */
  function submitWait(): boolean {
    return scheduler.submitPlayerAction({
      kind: 'wait',
      actorId: 'player',
      cost: getActionCost('wait'),
    });
  }

  it('初期ターン番号は 0', () => {
    expect(scheduler.getTurnNumber()).toBe(0);
  });

  it('プレイヤー行動完了ごとにターン番号が +1 される', async () => {
    scheduler.start();
    await waitForNextInputRequest();
    expect(scheduler.getTurnNumber()).toBe(0); // 最初の入力待ち時点では0

    submitWait();
    await waitForNextInputRequest();
    expect(scheduler.getTurnNumber()).toBe(1);

    submitWait();
    await waitForNextInputRequest();
    expect(scheduler.getTurnNumber()).toBe(2);

    submitWait();
    await waitForNextInputRequest();
    expect(scheduler.getTurnNumber()).toBe(3);
  });

  it('プレイヤー行動完了ごとに turn_started イベントが発行される', async () => {
    const listener = jest.fn();
    events.on('turn_started', listener);

    scheduler.start();
    await waitForNextInputRequest();
    // 最初の入力待ち時点では turn_started は未発行
    const countAtStart = listener.mock.calls.length;

    submitWait();
    await waitForNextInputRequest();
    submitWait();
    await waitForNextInputRequest();

    const newCalls = listener.mock.calls.length - countAtStart;
    expect(newCalls).toBe(2);
    // turn_started は1回につき1回のみ発行（重複なし）
  });

  it('turn_started が重複発行されない（旧TurnSystemの二重動作が無い）', async () => {
    const listener = jest.fn();
    events.on('turn_started', listener);

    scheduler.start();
    await waitForNextInputRequest();

    submitWait();
    await waitForNextInputRequest();

    // 1回のプレイヤー行動で turn_started は正確に1回のみ
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
