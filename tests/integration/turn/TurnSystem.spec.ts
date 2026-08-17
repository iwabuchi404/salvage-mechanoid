import { Engine } from '@/engine/Engine';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { TurnPhase, TurnSystem } from '@/engine/turn/TurnSystem';
import { TurnScheduler } from '@/engine/turn/TurnScheduler';
import { ActorComponent } from '@/engine/entity/components/Actor';
import { Action, ActionResult } from '@/engine/turn/Action';
import { getActionCost } from '@/engine/turn/ActionCostTable';

/**
 * BU-3 P0-3: TurnSystem の薄い委譲テスト
 *
 * 旧TurnSystem の4つのイベントリスナー / processAllEnemies() / startNewTurn() は撤去された。
 * TurnSystem は TurnScheduler への委譲のみを行う。
 * 旧イベント（move_completed 等）を発行しても敵が行動しないことを検証する。
 */
describe('BU-3 P0-3: TurnSystem は TurnScheduler への薄い委譲', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let turns: TurnSystem;
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

    turns = new TurnSystem();
    await turns.initialize(Engine.instance);
    turns.setScheduler(scheduler);

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

  it('getTurnNumber() は TurnScheduler へ委譲する', () => {
    expect(turns.getTurnNumber()).toBe(0);
    expect(turns.getTurnNumber()).toBe(scheduler.getTurnNumber());
  });

  it('getCurrentPhase() は入力待ち中は PLAYER を返す', async () => {
    scheduler.start();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(turns.getCurrentPhase()).toBe(TurnPhase.PLAYER);
  });

  it('getCurrentPhase() は停止中は ENEMY を返す', () => {
    // スケジューラ未開始時は入力待ちではない
    expect(turns.getCurrentPhase()).toBe(TurnPhase.ENEMY);
  });

  it('旧イベント（move_completed）を発行しても敵が行動しない', async () => {
    const enemySpy = jest.fn(async () => null);
    const enemy = new Entity('enemy-1', 'enemy');
    enemy.addTag('enemy');
    enemy.addComponent(
      new ActorComponent({
        inputControlled: false,
        actionSpeed: 100,
        decideAction: enemySpy,
      })
    );
    entities.registerEntity(enemy);

    // 旧イベントを発行
    events.emit('move_completed', {
      entityId: 'player',
      position: { x: 0, y: 0, z: 0 },
      direction: 'up' as any,
    });
    events.emit('player_turn_ended', { playerId: 'player' });
    events.emit('player_attacked', {
      attackerId: 'player',
      position: { x: 0, y: 0, z: 0 },
      power: 10,
    });
    events.emit('turn_action_completed', { entityId: 'player' });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // 旧TurnSystem は撤去されたため、これらのイベントで敵は行動しない
    expect(enemySpy).not.toHaveBeenCalled();
  });

  it('startNewTurn() は存在しない（コンパイルエラーにならないことを確認）', () => {
    // startNewTurn は削除されたため、呼び出すと TypeScript エラーになる
    // ここでは TurnSystem が startNewTurn メソッドを持たないことを確認
    expect((turns as any).startNewTurn).toBeUndefined();
  });
});
