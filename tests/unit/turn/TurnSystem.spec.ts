import { Engine } from '@/engine/Engine';
import { HealthComponent } from '@/engine/entity/components/Health';
import { ActorComponent } from '@/engine/entity/components/Actor';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { TurnPhase, TurnSystem } from '@/engine/turn/TurnSystem';

describe('TurnSystem', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let turns: TurnSystem;

  beforeEach(async () => {
    events = new EventSystem();
    entities = new EntitySystem();
    const engine = {
      getSystem: (name: string) => {
        if (name === 'event') return events;
        if (name === 'entity') return entities;
        return undefined;
      },
    } as unknown as Engine;
    await entities.initialize(engine);
    turns = new TurnSystem();
    await turns.initialize(engine);
  });

  it('新しいターンをプレイヤーフェーズとして通知する', () => {
    const listener = jest.fn();
    events.on('player_turn_started', listener);

    turns.startNewTurn();

    expect(turns.getCurrentPhase()).toBe(TurnPhase.PLAYER);
    expect(listener).toHaveBeenCalledWith({});
  });

  it.each(['move_completed', 'turn_action_completed'])(
    'プレイヤーの%sを受けると敵を順番に行動させてプレイヤーへ戻す',
    async (eventName) => {
      let releaseFirst!: () => void;
      const firstAction = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      // BU-3 段階4: ActorComponent 経由で行動を宣言する
      const firstSpy = jest.fn(() => firstAction.then(() => null));
      const secondSpy = jest.fn(async () => null);
      const first = new Entity('enemy-1', 'enemy');
      first.addTag('enemy');
      first.addComponent(
        new ActorComponent({
          inputControlled: false,
          decideAction: firstSpy,
        })
      );
      const second = new Entity('enemy-2', 'enemy');
      second.addTag('enemy');
      second.addComponent(
        new ActorComponent({
          inputControlled: false,
          decideAction: secondSpy,
        })
      );
      entities.registerEntity(first);
      entities.registerEntity(second);
      const actionStarted = jest.fn();
      const playerStarted = jest.fn();
      events.on('enemy_action_started', actionStarted);
      events.on('player_turn_started', playerStarted);

      events.emit(eventName, { entityId: 'player' });

      expect(turns.getCurrentPhase()).toBe(TurnPhase.ENEMY);
      expect(firstSpy).toHaveBeenCalledTimes(1);
      expect(secondSpy).not.toHaveBeenCalled();

      releaseFirst();
      await firstAction;
      // processAllEnemies はイベントリスナーから await なしで呼ばれるため、
      // すべての microtask が消化されるまで待つ
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(secondSpy).toHaveBeenCalledTimes(1);
      expect(actionStarted.mock.calls).toEqual([
        [{ enemyId: 'enemy-1' }],
        [{ enemyId: 'enemy-2' }],
      ]);
      expect(turns.getCurrentPhase()).toBe(TurnPhase.PLAYER);
      expect(playerStarted).toHaveBeenCalledTimes(1);
    }
  );

  it('死亡済みの敵を行動対象から除外する', async () => {
    const deadSpy = jest.fn(async () => null);
    const dead = new Entity('dead', 'enemy');
    dead.addTag('enemy');
    dead.addComponent(
      new ActorComponent({
        inputControlled: false,
        decideAction: deadSpy,
      })
    );
    dead.addComponent(new HealthComponent(1, 0, 0, 0, 0, false));
    entities.registerEntity(dead);

    events.emit('player_attacked', {
      attackerId: 'player',
      position: { x: 0, y: 0, z: 0 },
      power: 10,
    });
    await Promise.resolve();

    expect(deadSpy).not.toHaveBeenCalled();
    expect(turns.getCurrentPhase()).toBe(TurnPhase.PLAYER);
  });
});
