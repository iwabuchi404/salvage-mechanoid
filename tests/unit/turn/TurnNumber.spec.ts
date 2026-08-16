import { Engine } from '@/engine/Engine';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { TurnSystem } from '@/engine/turn/TurnSystem';

/**
 * BU-3 段階1: ターン番号の単調増加テスト
 *
 * TurnSystem.startNewTurn() が呼ばれるたびに turnNumber が +1 され、
 * turn_started イベントが発行されることを検証する。
 */
describe('BU-3 段階1: ターン番号の導入', () => {
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

  it('初期ターン番号は 0', () => {
    expect(turns.getTurnNumber()).toBe(0);
  });

  it('startNewTurn() ごとにターン番号が +1 される', () => {
    turns.startNewTurn();
    expect(turns.getTurnNumber()).toBe(1);

    turns.startNewTurn();
    expect(turns.getTurnNumber()).toBe(2);

    turns.startNewTurn();
    expect(turns.getTurnNumber()).toBe(3);
  });

  it('startNewTurn() が turn_started イベントを発行する', () => {
    const listener = jest.fn();
    events.on('turn_started', listener);

    turns.startNewTurn();
    turns.startNewTurn();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, { turn: 1 });
    expect(listener).toHaveBeenNthCalledWith(2, { turn: 2 });
  });

  it('startNewTurn() が従来の player_turn_started も発行する（併存）', () => {
    const playerTurnListener = jest.fn();
    events.on('player_turn_started', playerTurnListener);

    turns.startNewTurn();

    expect(playerTurnListener).toHaveBeenCalledTimes(1);
  });
});
