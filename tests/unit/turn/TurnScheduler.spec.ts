import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { ActorComponent } from '@/engine/entity/components/Actor';
import { HealthComponent } from '@/engine/entity/components/Health';
import { TurnScheduler } from '@/engine/turn/TurnScheduler';
import { Action, ActionResult } from '@/engine/turn/Action';
import { ActionExecutor } from '@/engine/turn/ActionExecutor';

/**
 * BU-3 段階5: TurnScheduler の単体テスト
 *
 * ActionExecutor をモックし、アニメーション時間に依存せずに
 * スケジューラの挙動を検証する。
 */
describe('BU-3 段階5: TurnScheduler', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let scheduler: TurnScheduler;
  let mockExecutor: { execute: jest.Mock };

  const makeAction = (actorId: string, kind: Action['kind'] = 'wait'): Action => ({
    kind,
    actorId,
    cost: { timeCost: 1, energyCost: 0 },
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

    // ActionExecutor をモック
    mockExecutor = {
      execute: jest.fn(async (action: Action): Promise<ActionResult> => {
        return { success: true, consumedTime: action.cost.timeCost };
      }),
    };

    scheduler = new TurnScheduler();
    scheduler.initialize(Engine.instance);
    // executor をモックへ差し替え
    (scheduler as any).executor = mockExecutor;

    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    scheduler.stop();
    jest.restoreAllMocks();
  });

  it('start() でターン1が開始され turn_started / player_turn_started が発行される', () => {
    const turnStarted = jest.fn();
    const playerTurnStarted = jest.fn();
    events.on('turn_started', turnStarted);
    events.on('player_turn_started', playerTurnStarted);

    scheduler.start();

    expect(turnStarted).toHaveBeenCalledWith({ turn: 1 });
    expect(playerTurnStarted).toHaveBeenCalledTimes(1);
    expect(scheduler.getTurnNumber()).toBe(1);
    expect(scheduler.isWaitingForPlayerInput()).toBe(true);
  });

  it('submitPlayerAction() でプレイヤー行動を実行し、敵ターンへ進む', async () => {
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('enemy-1', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(new ActorComponent({ inputControlled: false, decideAction: enemySpy }));
    entities.registerEntity(enemy);

    const enemyTurnStarted = jest.fn();
    events.on('enemy_turn_started', enemyTurnStarted);

    scheduler.start();
    scheduler.submitPlayerAction(makeAction('player'));

    // 敵行動が完了するまで待つ
    await new Promise((r) => setTimeout(r, 50));

    expect(mockExecutor.execute).toHaveBeenCalledTimes(1);
    expect(enemySpy).toHaveBeenCalledTimes(1);
    expect(enemyTurnStarted).toHaveBeenCalledTimes(1);
  });

  it('敵ターン完了後に次のターンが開始される', async () => {
    scheduler.start();
    scheduler.submitPlayerAction(makeAction('player'));
    await new Promise((r) => setTimeout(r, 50));

    // ターン2の入力待ちになる
    expect(scheduler.getTurnNumber()).toBe(2);
    expect(scheduler.isWaitingForPlayerInput()).toBe(true);
  });

  it('stop() でループが停止し入力 Promise が null で解決される', async () => {
    scheduler.start();
    expect(scheduler.isWaitingForPlayerInput()).toBe(true);

    scheduler.stop();

    expect(scheduler.isRunning()).toBe(false);
    expect(scheduler.isWaitingForPlayerInput()).toBe(false);
  });

  it('stop() 後に submitPlayerAction しても無視される', () => {
    scheduler.start();
    scheduler.stop();

    scheduler.submitPlayerAction(makeAction('player'));
    expect(mockExecutor.execute).not.toHaveBeenCalled();
  });

  it('フロア遷移相当: stop() 後に start() するとターン番号がリセットされる', async () => {
    scheduler.start();
    scheduler.submitPlayerAction(makeAction('player'));
    await new Promise((r) => setTimeout(r, 50));
    expect(scheduler.getTurnNumber()).toBe(2);

    scheduler.stop();
    scheduler.start();
    expect(scheduler.getTurnNumber()).toBe(1);
  });

  it('死亡済みの敵は行動しない', async () => {
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('dead-enemy', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(new ActorComponent({ inputControlled: false, decideAction: enemySpy }));
    enemy.addComponent(new HealthComponent(1, 0, 0, 0, 0, false));
    entities.registerEntity(enemy);

    scheduler.start();
    scheduler.submitPlayerAction(makeAction('player'));
    await new Promise((r) => setTimeout(r, 50));

    expect(enemySpy).not.toHaveBeenCalled();
  });

  it('行動失敗時は行動権を消費せず再入力を待つ', async () => {
    mockExecutor.execute.mockResolvedValueOnce({
      success: false,
      consumedTime: 0,
      reason: 'blocked',
    });

    scheduler.start();
    scheduler.submitPlayerAction(makeAction('player'));
    await new Promise((r) => setTimeout(r, 50));

    // 失敗したので敵ターンへ進まず、ターン番号は1のまま
    expect(scheduler.getTurnNumber()).toBe(1);
    // 再入力待ち状態に戻る
    expect(scheduler.isWaitingForPlayerInput()).toBe(true);
  });

  it('連続失敗が上限に達したら強制的にターンを進める', async () => {
    mockExecutor.execute.mockResolvedValue({
      success: false,
      consumedTime: 0,
      reason: 'blocked',
    });

    scheduler.start();

    // MAX_CONSECUTIVE_FAILURES 回失敗させる
    for (let i = 0; i < 10; i++) {
      scheduler.submitPlayerAction(makeAction('player'));
      await new Promise((r) => setTimeout(r, 10));
    }

    // 10回目の失敗で強制的にターンが進む
    await new Promise((r) => setTimeout(r, 50));
    expect(scheduler.getTurnNumber()).toBeGreaterThanOrEqual(2);
  });
});
