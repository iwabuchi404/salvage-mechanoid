import {
  PlayerViewState,
  SelectionViewState,
  ProgressViewState,
  GameViewState,
} from '@/game/view/GameViewState';

/**
 * BU-4 段階1: ビューモデル型の追加
 *
 * 型のみの追加段階。GameViewState が正しく定義されていること、
 * 判別可能ユニオンの kind で分岐できることを検証する。
 */
describe('BU-4 段階1: GameViewState 型定義', () => {
  it('PlayerViewState を構築できる', () => {
    const player: PlayerViewState = {
      hp: 80,
      maxHp: 100,
      energy: 150,
      maxEnergy: 200,
      level: 3,
      direction: 'right',
      position: { x: 5, y: 3 },
    };

    expect(player.hp).toBe(80);
    expect(player.direction).toBe('right');
    expect(player.position).toEqual({ x: 5, y: 3 });
  });

  it('ProgressViewState を構築できる', () => {
    const progress: ProgressViewState = {
      floor: 2,
      maxFloors: 5,
      turn: 12,
      isPlayerTurn: true,
    };

    expect(progress.floor).toBe(2);
    expect(progress.isPlayerTurn).toBe(true);
  });

  describe('SelectionViewState 判別可能ユニオン', () => {
    it('tile kind で分岐できる', () => {
      const selection: SelectionViewState = {
        kind: 'tile',
        name: '床',
        position: { x: 3, y: 4 },
        effect: 'なし',
      };

      expect(selection.kind).toBe('tile');
      if (selection.kind === 'tile') {
        expect(selection.effect).toBe('なし');
      }
    });

    it('enemy kind で分岐できる', () => {
      const selection: SelectionViewState = {
        kind: 'enemy',
        name: 'SOLDIER',
        position: { x: 7, y: 2 },
        hp: 30,
        maxHp: 50,
      };

      expect(selection.kind).toBe('enemy');
      if (selection.kind === 'enemy') {
        expect(selection.hp).toBe(30);
        expect(selection.maxHp).toBe(50);
      }
    });

    it('player kind で分岐できる', () => {
      const selection: SelectionViewState = {
        kind: 'player',
        name: 'プレイヤー',
        position: { x: 1, y: 1 },
      };

      expect(selection.kind).toBe('player');
      if (selection.kind === 'player') {
        expect(selection.name).toBe('プレイヤー');
      }
    });

    it('object kind で分岐できる', () => {
      const selection: SelectionViewState = {
        kind: 'object',
        name: 'ポータル',
        position: { x: 9, y: 9 },
      };

      expect(selection.kind).toBe('object');
      if (selection.kind === 'object') {
        expect(selection.name).toBe('ポータル');
      }
    });
  });

  it('GameViewState を構築できる', () => {
    const state: GameViewState = {
      player: {
        hp: 100,
        maxHp: 100,
        energy: 200,
        maxEnergy: 200,
        level: 1,
        direction: 'down',
        position: { x: 0, y: 0 },
      },
      progress: {
        floor: 1,
        maxFloors: 5,
        turn: 1,
        isPlayerTurn: true,
      },
      selection: null,
    };

    expect(state.player.hp).toBe(100);
    expect(state.progress.floor).toBe(1);
    expect(state.selection).toBeNull();
  });

  it('selection に enemy を設定できる', () => {
    const state: GameViewState = {
      player: {
        hp: 100,
        maxHp: 100,
        energy: 200,
        maxEnergy: 200,
        level: 1,
        direction: 'down',
        position: { x: 0, y: 0 },
      },
      progress: {
        floor: 1,
        maxFloors: 5,
        turn: 1,
        isPlayerTurn: true,
      },
      selection: {
        kind: 'enemy',
        name: 'SCOUT',
        position: { x: 5, y: 5 },
        hp: 20,
        maxHp: 30,
      },
    };

    expect(state.selection).not.toBeNull();
    expect(state.selection!.kind).toBe('enemy');
  });
});
