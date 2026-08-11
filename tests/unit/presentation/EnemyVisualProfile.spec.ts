import {
  getEnemyVisualProfile,
  getEnemyTexturePath,
} from '@/engine/presentation/enemy/EnemyVisualProfile';
import { EnemyType, Direction, LayerName } from '@/engine/types';

/**
 * EnemyVisualProfile の純粋関数テスト
 * PixiJS 初期化なしで実行できる。
 */
describe('EnemyVisualProfile', () => {
  describe('getEnemyVisualProfile', () => {
    it('SCOUT のプロファイルを取得できる', () => {
      const profile = getEnemyVisualProfile(EnemyType.SCOUT);

      expect(profile.defaultTexturePath).toBe('./robo04_l.png');
      expect(profile.anchor).toEqual({ x: 0.5, y: 1.0 });
      expect(profile.layer).toBe(LayerName.CHARACTERS);
    });

    it('SOLDIER のプロファイルを取得できる', () => {
      const profile = getEnemyVisualProfile(EnemyType.SOLDIER);

      expect(profile.defaultTexturePath).toBe('./robo03_l.png');
      expect(profile.anchor).toEqual({ x: 0.5, y: 1.0 });
      expect(profile.layer).toBe(LayerName.CHARACTERS);
    });

    it('HEAVY のプロファイルを取得できる', () => {
      const profile = getEnemyVisualProfile(EnemyType.HEAVY);

      expect(profile.defaultTexturePath).toBe('./robo02_l.png');
      expect(profile.anchor).toEqual({ x: 0.5, y: 1.0 });
      expect(profile.layer).toBe(LayerName.CHARACTERS);
    });

    it('未知の EnemyType にはフォールバック（HEAVY と同等）を返す', () => {
      const profile = getEnemyVisualProfile('unknown' as EnemyType);
      const heavyProfile = getEnemyVisualProfile(EnemyType.HEAVY);

      expect(profile.defaultTexturePath).toBe(heavyProfile.defaultTexturePath);
      expect(profile.texturePaths).toEqual(heavyProfile.texturePaths);
    });

    it('プロファイルに PixiJS オブジェクトが含まれていない', () => {
      const profile = getEnemyVisualProfile(EnemyType.SCOUT);

      // プロファイルは純粋なデータのみ（文字列と数値）
      expect(typeof profile.defaultTexturePath).toBe('string');
      expect(typeof profile.anchor.x).toBe('number');
      expect(typeof profile.anchor.y).toBe('number');
      expect(typeof profile.layer).toBe('string');
      for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
        expect(typeof profile.texturePaths[dir]).toBe('string');
      }
    });

    it('プロファイルとネストした設定が凍結され、共有状態を変更できない', () => {
      const profile = getEnemyVisualProfile(EnemyType.SCOUT);

      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.texturePaths)).toBe(true);
      expect(Object.isFrozen(profile.anchor)).toBe(true);
    });

    it('各 EnemyType で方向別テクスチャが4方向すべて定義されている', () => {
      const directions: Direction[] = ['up', 'down', 'left', 'right'];

      for (const enemyType of [EnemyType.SCOUT, EnemyType.SOLDIER, EnemyType.HEAVY]) {
        const profile = getEnemyVisualProfile(enemyType);
        for (const dir of directions) {
          expect(profile.texturePaths[dir]).toBeTruthy();
          expect(typeof profile.texturePaths[dir]).toBe('string');
        }
      }
    });
  });

  describe('getEnemyTexturePath', () => {
    it('SCOUT の up 方向は robo04_r.png を返す', () => {
      expect(getEnemyTexturePath(EnemyType.SCOUT, 'up')).toBe('./robo04_r.png');
    });

    it('SCOUT の down 方向は robo04_l.png を返す', () => {
      expect(getEnemyTexturePath(EnemyType.SCOUT, 'down')).toBe('./robo04_l.png');
    });

    it('SOLDIER の left 方向は robo03_l.png を返す', () => {
      expect(getEnemyTexturePath(EnemyType.SOLDIER, 'left')).toBe('./robo03_l.png');
    });

    it('HEAVY の right 方向は robo02_r.png を返す', () => {
      expect(getEnemyTexturePath(EnemyType.HEAVY, 'right')).toBe('./robo02_r.png');
    });

    it('各タイプで左右のテクスチャが異なる（右向きは _r、左向きは _l）', () => {
      for (const enemyType of [EnemyType.SCOUT, EnemyType.SOLDIER, EnemyType.HEAVY]) {
        const rightPath = getEnemyTexturePath(enemyType, 'right');
        const leftPath = getEnemyTexturePath(enemyType, 'left');

        expect(rightPath).toMatch(/_r\.png$/);
        expect(leftPath).toMatch(/_l\.png$/);
        expect(rightPath).not.toBe(leftPath);
      }
    });

    it('up と right は同じテクスチャ（右向き画像を流用）', () => {
      for (const enemyType of [EnemyType.SCOUT, EnemyType.SOLDIER, EnemyType.HEAVY]) {
        expect(getEnemyTexturePath(enemyType, 'up')).toBe(getEnemyTexturePath(enemyType, 'right'));
      }
    });

    it('down と left は同じテクスチャ（左向き画像を流用）', () => {
      for (const enemyType of [EnemyType.SCOUT, EnemyType.SOLDIER, EnemyType.HEAVY]) {
        expect(getEnemyTexturePath(enemyType, 'down')).toBe(getEnemyTexturePath(enemyType, 'left'));
      }
    });
  });

  describe('プロファイルの一貫性', () => {
    it('全 EnemyType のアンカーとレイヤーが同じ', () => {
      const types = [EnemyType.SCOUT, EnemyType.SOLDIER, EnemyType.HEAVY];
      const profiles = types.map((t) => getEnemyVisualProfile(t));

      // アンカーは全タイプ共通
      for (const profile of profiles) {
        expect(profile.anchor).toEqual({ x: 0.5, y: 1.0 });
        expect(profile.layer).toBe(LayerName.CHARACTERS);
      }
    });

    it('defaultTexturePath は down 方向と一致する', () => {
      for (const enemyType of [EnemyType.SCOUT, EnemyType.SOLDIER, EnemyType.HEAVY]) {
        const profile = getEnemyVisualProfile(enemyType);
        expect(profile.defaultTexturePath).toBe(profile.texturePaths.down);
      }
    });

    it('同じ EnemyType で複数回呼び出しても同じ結果を返す（参照安定性）', () => {
      const p1 = getEnemyVisualProfile(EnemyType.SCOUT);
      const p2 = getEnemyVisualProfile(EnemyType.SCOUT);

      // 同じオブジェクト参照が返ることを確認（キャッシュ相当）
      expect(p1).toBe(p2);
    });
  });
});
