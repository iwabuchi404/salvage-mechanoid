import {
  computeFOV,
  tileKey,
  keyToTile,
  getDirectionFromDelta,
  isFrontDirection,
  hasLineOfSight,
  FOVBoundsQuery,
  FOVObstacleQuery,
} from '@/engine/fov/FOVCalculator';
import { TileMap } from '@/engine/world/TileMap';
import { TileType } from '@/engine/types';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * FOVCalculator - 視界計算の純粋関数テスト
 *
 * WorldSystem や EntitySystem を初期化せず、bounds/obstacle query を
 * 直接組み立てて計算結果を検証する。
 */
describe('FOVCalculator', () => {
  describe('tileKey / keyToTile', () => {
    it('tileKey は "x,y" 形式の文字列を返す', () => {
      expect(tileKey(3, 5)).toBe('3,5');
      expect(tileKey(0, 0)).toBe('0,0');
    });

    it('keyToTile は有効なキーを座標へ戻す', () => {
      expect(keyToTile('3,5')).toEqual({ x: 3, y: 5 });
      expect(keyToTile('0,0')).toEqual({ x: 0, y: 0 });
    });

    it('keyToTile は無効な形式に null を返す', () => {
      expect(keyToTile('abc')).toBeNull();
      expect(keyToTile('1,2,3')).toBeNull();
      expect(keyToTile('1.5,2')).toBeNull();
    });
  });

  describe('getDirectionFromDelta', () => {
    it('中心 (0,0) は center を返す', () => {
      expect(getDirectionFromDelta(0, 0)).toBe('center');
    });

    it('上下左右の基本方向を返す', () => {
      expect(getDirectionFromDelta(0, -1)).toBe('up');
      expect(getDirectionFromDelta(0, 1)).toBe('down');
      expect(getDirectionFromDelta(-1, 0)).toBe('left');
      expect(getDirectionFromDelta(1, 0)).toBe('right');
    });

    it('斜め方向を返す', () => {
      expect(getDirectionFromDelta(-1, -1)).toBe('up-left');
      expect(getDirectionFromDelta(1, -1)).toBe('up-right');
      expect(getDirectionFromDelta(-1, 1)).toBe('down-left');
      expect(getDirectionFromDelta(1, 1)).toBe('down-right');
    });

    it('斜めでない場合は近い方の軸を優先する', () => {
      expect(getDirectionFromDelta(2, -1)).toBe('right');
      expect(getDirectionFromDelta(-1, 2)).toBe('down');
    });
  });

  describe('isFrontDirection', () => {
    it('center は常に正面', () => {
      expect(isFrontDirection('up', 'center')).toBe(true);
      expect(isFrontDirection('down', 'center')).toBe(true);
    });

    it('up 向きの正面は up/up-left/up-right', () => {
      expect(isFrontDirection('up', 'up')).toBe(true);
      expect(isFrontDirection('up', 'up-left')).toBe(true);
      expect(isFrontDirection('up', 'up-right')).toBe(true);
      expect(isFrontDirection('up', 'down')).toBe(false);
      expect(isFrontDirection('up', 'left')).toBe(false);
    });

    it('down 向きの正面は down/down-left/down-right', () => {
      expect(isFrontDirection('down', 'down')).toBe(true);
      expect(isFrontDirection('down', 'down-left')).toBe(true);
      expect(isFrontDirection('down', 'down-right')).toBe(true);
      expect(isFrontDirection('down', 'up')).toBe(false);
    });

    it('left 向きの正面は left/up-left/down-left', () => {
      expect(isFrontDirection('left', 'left')).toBe(true);
      expect(isFrontDirection('left', 'up-left')).toBe(true);
      expect(isFrontDirection('left', 'down-left')).toBe(true);
      expect(isFrontDirection('left', 'right')).toBe(false);
    });

    it('right 向きの正面は right/up-right/down-right', () => {
      expect(isFrontDirection('right', 'right')).toBe(true);
      expect(isFrontDirection('right', 'up-right')).toBe(true);
      expect(isFrontDirection('right', 'down-right')).toBe(true);
      expect(isFrontDirection('right', 'left')).toBe(false);
    });
  });

  describe('hasLineOfSight', () => {
    const noObstacle: FOVObstacleQuery = { isBlocking: () => false };
    const wallAt = (wx: number, wy: number): FOVObstacleQuery => ({
      isBlocking: (x, y) => x === wx && y === wy,
    });

    it('遮蔽がない場合は到達可能', () => {
      expect(hasLineOfSight(0, 0, 3, 0, noObstacle)).toBe(true);
      expect(hasLineOfSight(0, 0, 0, 3, noObstacle)).toBe(true);
      expect(hasLineOfSight(0, 0, 2, 2, noObstacle)).toBe(true);
    });

    it('同一地点は到達可能', () => {
      expect(hasLineOfSight(2, 2, 2, 2, noObstacle)).toBe(true);
    });

    it('経路上の遮蔽タイルで視線が遮られる', () => {
      expect(hasLineOfSight(0, 0, 4, 0, wallAt(2, 0))).toBe(false);
      expect(hasLineOfSight(0, 0, 0, 4, wallAt(0, 2))).toBe(false);
    });

    it('開始地点の遮蔽は無視される', () => {
      expect(hasLineOfSight(2, 2, 4, 2, wallAt(2, 2))).toBe(true);
    });

    it('目標地点自体が遮蔽でも到達可能', () => {
      expect(hasLineOfSight(0, 0, 2, 0, wallAt(2, 0))).toBe(true);
    });
  });

  describe('computeFOV', () => {
    /**
     * 指定サイズの全 TILE マップを作成するヘルパ。
     * TileMap はデフォルトでタイル未設定のため、明示的に TILE を敷き詰める。
     */
    const makeFilledMap = (w: number, h: number): TileMap => {
      const map = new TileMap(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          map.setTileAt(x, y, 0, TileType.TILE, true);
        }
      }
      return map;
    };

    const makeBounds = (map: TileMap): FOVBoundsQuery => ({
      isInBounds: (x, y) => x >= 0 && x < map.getWidth() && y >= 0 && y < map.getHeight(),
    });

    const makeObstacleFromMap = (map: TileMap): FOVObstacleQuery => ({
      isBlocking: (x, y) => {
        const tile = map.getTile(x, y);
        if (!tile) return true;
        if (tile.type === TileType.EMPTY) return true;
        if (tile.type === TileType.MOUNTAIN) return true;
        return false;
      },
    });

    it('プレイヤー位置は常に可視', () => {
      const map = makeFilledMap(10, 10);
      const result = computeFOV({
        cx: 5,
        cy: 5,
        direction: 'up',
        bounds: makeBounds(map),
        obstacle: makeObstacleFromMap(map),
      });
      expect(result.visibleTiles.has(tileKey(5, 5))).toBe(true);
    });

    it('正面方向の半径は4、側面は3（up 向き）', () => {
      const map = makeFilledMap(20, 20);
      const result = computeFOV({
        cx: 10,
        cy: 10,
        direction: 'up',
        bounds: makeBounds(map),
        obstacle: makeObstacleFromMap(map),
      });

      // 正面 (10,6) は距離4で可視
      expect(result.visibleTiles.has(tileKey(10, 6))).toBe(true);
      // 正面 (10,5) は距離5で不可視
      expect(result.visibleTiles.has(tileKey(10, 5))).toBe(false);

      // 側面 (13,10) は距離3で可視
      expect(result.visibleTiles.has(tileKey(13, 10))).toBe(true);
      // 側面 (14,10) は距離4で不可視
      expect(result.visibleTiles.has(tileKey(14, 10))).toBe(false);
    });

    it('壁タイルは視線を遮り、背後のタイルを不可視にする', () => {
      const map = makeFilledMap(20, 20);
      // (10,7) に壁を置く
      map.setTileAt(10, 7, 0, TileType.MOUNTAIN, false);

      const result = computeFOV({
        cx: 10,
        cy: 10,
        direction: 'up',
        bounds: makeBounds(map),
        obstacle: makeObstacleFromMap(map),
      });

      // 壁自体は可視（目標地点として到達可能）
      expect(result.visibleTiles.has(tileKey(10, 7))).toBe(true);
      // 壁の背後 (10,6) は遮蔽される
      expect(result.visibleTiles.has(tileKey(10, 6))).toBe(false);
    });

    it('EMPTY タイルは背後を遮蔽するが、EMPTY 自体は到達可能', () => {
      const map = makeFilledMap(20, 20);
      // (10,8) を EMPTY（壁）にする
      map.setTileAt(10, 8, 0, TileType.EMPTY, false);

      const result = computeFOV({
        cx: 10,
        cy: 10,
        direction: 'up',
        bounds: makeBounds(map),
        obstacle: makeObstacleFromMap(map),
      });

      // EMPTY 自体は目標地点として到達可能なので可視
      expect(result.visibleTiles.has(tileKey(10, 8))).toBe(true);
      // EMPTY の背後 (10,7) は遮蔽される
      expect(result.visibleTiles.has(tileKey(10, 7))).toBe(false);
    });

    it('マップ範囲外のタイルは不可視', () => {
      const map = makeFilledMap(5, 5);
      const result = computeFOV({
        cx: 0,
        cy: 0,
        direction: 'down',
        bounds: makeBounds(map),
        obstacle: makeObstacleFromMap(map),
      });

      // 範囲外 (-1,0) は不可視
      expect(result.visibleTiles.has(tileKey(-1, 0))).toBe(false);
      expect(result.visibleTiles.has(tileKey(0, -1))).toBe(false);
    });

    it('計算は純粋で入力に副作用を持たない', () => {
      const map = makeFilledMap(10, 10);
      const bounds = makeBounds(map);
      const obstacle = makeObstacleFromMap(map);

      const r1 = computeFOV({ cx: 5, cy: 5, direction: 'up', bounds, obstacle });
      const r2 = computeFOV({ cx: 5, cy: 5, direction: 'up', bounds, obstacle });

      // 同一入力なら同一結果
      expect(r1.visibleTiles.size).toBe(r2.visibleTiles.size);
      // 結果の Set は呼び出しごとに独立
      expect(r1.visibleTiles).not.toBe(r2.visibleTiles);
    });

    it('方向を変えると可視範囲が変わる', () => {
      const map = makeFilledMap(20, 20);
      const up = computeFOV({
        cx: 10,
        cy: 10,
        direction: 'up',
        bounds: makeBounds(map),
        obstacle: makeObstacleFromMap(map),
      });
      const down = computeFOV({
        cx: 10,
        cy: 10,
        direction: 'down',
        bounds: makeBounds(map),
        obstacle: makeObstacleFromMap(map),
      });

      // up 向きでは (10,6) が可視、down 向きでは不可視なはず
      expect(up.visibleTiles.has(tileKey(10, 6))).toBe(true);
      expect(down.visibleTiles.has(tileKey(10, 6))).toBe(false);
      // down 向きでは (10,14) が可視
      expect(down.visibleTiles.has(tileKey(10, 14))).toBe(true);
      expect(up.visibleTiles.has(tileKey(10, 14))).toBe(false);
    });
  });
});
