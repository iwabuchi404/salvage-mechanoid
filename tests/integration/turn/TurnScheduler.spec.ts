import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { ActorComponent } from '@/engine/entity/components/Actor';
import { HealthComponent } from '@/engine/entity/components/Health';
import { TurnScheduler } from '@/engine/turn/TurnScheduler';
import { Action, ActionResult } from '@/engine/turn/Action';
import { getActionCost } from '@/engine/turn/ActionCostTable';

/**
 * BU-3 案B: TurnScheduler の単体テスト
 *
 * ActionExecutor をモックし、アニメーション時間に依存せずに
 * エネルギー式スケジューラの挙動を検証する。
 */
describe('BU-3 案B: TurnScheduler（エネルギー式スケジューラ）', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let scheduler: TurnScheduler;
  let mockExecutor: { execute: jest.Mock };

  const makeWaitAction = (actorId: string = 'player'): Action => ({
    kind: 'wait',
    actorId,
    cost: getActionCost('wait'),
  });

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

    mockExecutor = {
      execute: jest.fn(async (action: Action): Promise<ActionResult> => {
        return { success: true, consumedTime: action.cost.timeCost };
      }),
    };

    scheduler = new TurnScheduler();
    scheduler.initialize(Engine.instance);
    (scheduler as any).executor = mockExecutor;

    // プレイヤーを登録（actionSpeed 100 = 標準）
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

  it('start() でスケジューラが開始され、プレイヤー入力待ちになる', async () => {
    scheduler.start();
    await waitForNextInputRequest();

    expect(scheduler.isRunning()).toBe(true);
    expect(scheduler.isWaitingForPlayerInput()).toBe(true);
    expect(scheduler.canAct('player')).toBe(true);
  });

  it('start() 時点では turn_started は未発行（プレイヤー行動完了時に発行）', async () => {
    const turnStarted = jest.fn();
    events.on('turn_started', turnStarted);

    scheduler.start();
    await waitForNextInputRequest();

    expect(turnStarted).not.toHaveBeenCalled();
    expect(scheduler.getTurnNumber()).toBe(0);
  });

  it('submitPlayerAction() でプレイヤー行動を実行し、turn_started が発行される', async () => {
    const turnStarted = jest.fn();
    events.on('turn_started', turnStarted);

    scheduler.start();
    await waitForNextInputRequest();

    scheduler.submitPlayerAction(makeWaitAction());
    await waitForNextInputRequest();

    expect(mockExecutor.execute).toHaveBeenCalledTimes(1);
    expect(turnStarted).toHaveBeenCalledWith({ turn: 1 });
    expect(scheduler.getTurnNumber()).toBe(1);
  });

  it('プレイヤー行動後に敵が行動する', async () => {
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('enemy-1', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({ inputControlled: false, actionSpeed: 100, decideAction: enemySpy })
    );
    entities.registerEntity(enemy);

    scheduler.start();
    await waitForNextInputRequest();

    scheduler.submitPlayerAction(makeWaitAction());
    await waitForNextInputRequest();

    expect(enemySpy).toHaveBeenCalledTimes(1);
  });

  it('stop() でループが停止し入力 Promise が解決される', async () => {
    scheduler.start();
    await waitForNextInputRequest();
    expect(scheduler.isWaitingForPlayerInput()).toBe(true);

    scheduler.stop();

    expect(scheduler.isRunning()).toBe(false);
    expect(scheduler.isWaitingForPlayerInput()).toBe(false);
    expect(scheduler.canAct('player')).toBe(false);
  });

  it('stop() 後に submitPlayerAction しても無視される', async () => {
    scheduler.start();
    await waitForNextInputRequest();
    scheduler.stop();

    const result = scheduler.submitPlayerAction(makeWaitAction());
    expect(result).toBe(false);
    expect(mockExecutor.execute).not.toHaveBeenCalled();
  });

  it('フロア遷移相当: stop() 後に start() するとターン番号がリセットされる', async () => {
    scheduler.start();
    await waitForNextInputRequest();
    scheduler.submitPlayerAction(makeWaitAction());
    await waitForNextInputRequest();
    expect(scheduler.getTurnNumber()).toBe(1);

    scheduler.stop();
    scheduler.start();
    await waitForNextInputRequest();
    expect(scheduler.getTurnNumber()).toBe(0);
  });

  it('死亡済みの敵は行動しない', async () => {
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('dead-enemy', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({ inputControlled: false, actionSpeed: 100, decideAction: enemySpy })
    );
    enemy.addComponent(new HealthComponent(1, 0, 0, 0, 0, false));
    entities.registerEntity(enemy);

    scheduler.start();
    await waitForNextInputRequest();
    scheduler.submitPlayerAction(makeWaitAction());
    await waitForNextInputRequest();

    expect(enemySpy).not.toHaveBeenCalled();
  });

  it('行動失敗時はターンを消費せず再入力を待つ', async () => {
    mockExecutor.execute.mockResolvedValueOnce({
      success: false,
      consumedTime: 0,
      reason: 'blocked',
    });

    scheduler.start();
    await waitForNextInputRequest();

    scheduler.submitPlayerAction(makeWaitAction());
    await waitForNextInputRequest();

    // 失敗したのでターン番号は進まない
    expect(scheduler.getTurnNumber()).toBe(0);
    // 再入力待ち状態に戻る
    expect(scheduler.isWaitingForPlayerInput()).toBe(true);
  });

  it('行動失敗時に player_input_requested が再発行される（P1: デッドロック防止）', async () => {
    mockExecutor.execute.mockResolvedValueOnce({
      success: false,
      consumedTime: 0,
      reason: 'blocked',
    });

    const inputRequested = jest.fn();
    events.on('player_input_requested', inputRequested);

    scheduler.start();
    await waitForNextInputRequest();
    const countAtFirst = inputRequested.mock.calls.length;
    expect(countAtFirst).toBe(1);

    // 失敗する行動を投入
    scheduler.submitPlayerAction(makeWaitAction());
    await waitForNextInputRequest();

    // 失敗後に player_input_requested が再発行されている
    expect(inputRequested.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(scheduler.isWaitingForPlayerInput()).toBe(true);
  });

  it('連続失敗が上限に達したら強制的にターンを進める', async () => {
    mockExecutor.execute.mockResolvedValue({
      success: false,
      consumedTime: 0,
      reason: 'blocked',
    });

    const turnStarted = jest.fn();
    events.on('turn_started', turnStarted);

    scheduler.start();
    await waitForNextInputRequest();

    // MAX_CONSECUTIVE_FAILURES(10) 回失敗させる
    for (let i = 0; i < 10; i++) {
      scheduler.submitPlayerAction(makeWaitAction());
      await waitForNextInputRequest();
    }

    // 10回目の失敗で強制的にターンが進む
    expect(scheduler.getTurnNumber()).toBeGreaterThanOrEqual(1);
  });

  it('currentTime が単調増加する', async () => {
    expect(scheduler.getCurrentTime()).toBe(0);

    scheduler.start();
    await waitForNextInputRequest();
    // 最初の tick で currentTime が進む
    expect(scheduler.getCurrentTime()).toBeGreaterThanOrEqual(1);

    scheduler.submitPlayerAction(makeWaitAction());
    await waitForNextInputRequest();
    // さらに時間が進む
    expect(scheduler.getCurrentTime()).toBeGreaterThanOrEqual(2);
  });

  it('actor_turn_started イベントが発行される', async () => {
    const actorTurnStarted = jest.fn();
    events.on('actor_turn_started', actorTurnStarted);

    scheduler.start();
    await waitForNextInputRequest();

    // プレイヤーの actor_turn_started が発行されている
    expect(actorTurnStarted).toHaveBeenCalledWith({
      actorId: 'player',
      time: expect.any(Number),
    });
  });

  it('player_input_requested / player_input_resolved イベントが発行される', async () => {
    const inputRequested = jest.fn();
    const inputResolved = jest.fn();
    events.on('player_input_requested', inputRequested);
    events.on('player_input_resolved', inputResolved);

    scheduler.start();
    await waitForNextInputRequest();

    expect(inputRequested).toHaveBeenCalledTimes(1);

    scheduler.submitPlayerAction(makeWaitAction());
    await waitForNextInputRequest();

    expect(inputResolved).toHaveBeenCalledTimes(1);
  });

  it('敵が1回のプレイヤー行動で2回行動しない（重複行動の防止）', async () => {
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('enemy-1', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({ inputControlled: false, actionSpeed: 100, decideAction: enemySpy })
    );
    entities.registerEntity(enemy);

    scheduler.start();
    await waitForNextInputRequest();

    scheduler.submitPlayerAction(makeWaitAction());
    await waitForNextInputRequest();

    // プレイヤー1回行動に対して敵は1回のみ行動（旧TurnSystemの二重動作なし）
    expect(enemySpy).toHaveBeenCalledTimes(1);
  });
});
