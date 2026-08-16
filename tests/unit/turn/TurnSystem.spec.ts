import { Engine } from '@/engine/Engine';
import { HealthComponent } from '@/engine/entity/components/Health';
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
      const first = Object.assign(new Entity('enemy-1', 'enemy'), {
        act: jest.fn(() => firstAction),
      });
      const second = Object.assign(new Entity('enemy-2', 'enemy'), {
        act: jest.fn(async () => undefined),
      });
      first.addTag('enemy');
      second.addTag('enemy');
      entities.registerEntity(first);
      entities.registerEntity(second);
      const actionStarted = jest.fn();
      const playerStarted = jest.fn();
      events.on('enemy_action_started', actionStarted);
      events.on('player_turn_started', playerStarted);

      events.emit(eventName, { entityId: 'player' });

      expect(turns.getCurrentPhase()).toBe(TurnPhase.ENEMY);
      expect(first.act).toHaveBeenCalledTimes(1);
      expect(second.act).not.toHaveBeenCalled();

      releaseFirst();
      await firstAction;
      await Promise.resolve();
      await Promise.resolve();

      expect(second.act).toHaveBeenCalledTimes(1);
      expect(actionStarted.mock.calls).toEqual([
        [{ enemyId: 'enemy-1' }],
        [{ enemyId: 'enemy-2' }],
      ]);
      expect(turns.getCurrentPhase()).toBe(TurnPhase.PLAYER);
      expect(playerStarted).toHaveBeenCalledTimes(1);
    }
  );

  it('死亡済みの敵を行動対象から除外する', async () => {
    const dead = Object.assign(new Entity('dead', 'enemy'), {
      act: jest.fn(async () => undefined),
    });
    dead.addTag('enemy');
    dead.addComponent(new HealthComponent(1, 0, 0, 0, 0, false));
    entities.registerEntity(dead);

    events.emit('player_attacked', {
      attackerId: 'player',
      position: { x: 0, y: 0, z: 0 },
      power: 10,
    });
    await Promise.resolve();

    expect(dead.act).not.toHaveBeenCalled();
    expect(turns.getCurrentPhase()).toBe(TurnPhase.PLAYER);
  });
});
