import { TileType } from '@/engine/types';
import { TileMap } from '@/engine/world/TileMap';

describe('TileMap', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('サイズの最小値を1に制限する', () => {
    const map = new TileMap(0, -1, 0);

    expect(map.getSize()).toEqual({ width: 1, height: 1, depth: 1 });
  });

  it('範囲内のタイルを保存し、座標を丸めて取得する', () => {
    const map = new TileMap(3, 3);

    const tile = map.setTileAt(1, 2, 0, TileType.TILE, true, { roomId: 'a' });

    expect(map.getTile(1.2, 1.7)).toBe(tile);
    expect(map.isWalkable(1, 2)).toBe(true);
    expect(map.isWalkable(0, 0)).toBe(false);
    expect(() => map.setTileAt(3, 0)).toThrow('Tile position out of bounds');
  });

  it('2次元データをインポートしてタイル種別ごとの通行可否を設定する', () => {
    const map = new TileMap(3, 2);

    map.importMapData([
      [TileType.EMPTY, TileType.GRASS, TileType.WATER],
      [TileType.MOUNTAIN, TileType.PORTAL, TileType.DAMAGE],
    ]);

    expect(map.getTile(0, 0)).toBeUndefined();
    expect(map.isWalkable(1, 0)).toBe(true);
    expect(map.isWalkable(2, 0)).toBe(false);
    expect(map.isWalkable(0, 1)).toBe(false);
    expect(map.isWalkable(1, 1)).toBe(true);
    expect(map.isWalkable(2, 1)).toBe(true);
  });

  it('種別検索・範囲検索・最寄り検索を行う', () => {
    const map = new TileMap(5, 5);
    map.setTileAt(0, 0, 0, TileType.HEAL, true);
    map.setTileAt(2, 2, 0, TileType.HEAL, true);
    map.setTileAt(4, 4, 0, TileType.DAMAGE, true);

    expect(map.findTilesByType(TileType.HEAL)).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 2, z: 0 },
    ]);
    expect(map.getTilesInRange(1, 1, 0, 1)).toHaveLength(2);
    expect(map.findNearestTileOfType(3, 2, 0, TileType.HEAL)).toEqual({ x: 2, y: 2, z: 0 });
    expect(map.findNearestTileOfType(4, 4, 0, TileType.HEAL, 2)).toBeNull();
  });

  it('clearでタイルだけを消し、active状態は独立して保持する', () => {
    const map = new TileMap(2, 2);
    map.setTileAt(0, 0, 0, TileType.TILE, true);
    map.active = false;

    map.clear();

    expect(map.getTile(0, 0)).toBeUndefined();
    expect(map.active).toBe(false);
  });
});
