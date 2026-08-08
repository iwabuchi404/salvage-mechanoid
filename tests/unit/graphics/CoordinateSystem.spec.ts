import { CoordinateSystem } from '@/engine/graphics/CoordinateSystem';

describe('CoordinateSystem', () => {
  let coord: CoordinateSystem;

  beforeEach(() => {
    coord = new CoordinateSystem(160, 120);
  });

  describe('isometricToScreen', () => {
    it('should convert (0,0,0) to screen origin', () => {
      const result = coord.isometricToScreen(0, 0, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should convert (1,0,0) correctly', () => {
      const result = coord.isometricToScreen(1, 0, 0);
      expect(result.x).toBe(80);
      expect(result.y).toBe(40);
    });

    it('should convert (0,1,0) correctly', () => {
      const result = coord.isometricToScreen(0, 1, 0);
      expect(result.x).toBe(-80);
      expect(result.y).toBe(40);
    });

    it('should convert (1,1,0) correctly', () => {
      const result = coord.isometricToScreen(1, 1, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(80);
    });

    it('should apply z offset', () => {
      const result = coord.isometricToScreen(0, 0, 1);
      expect(result.y).toBe(-40);
    });
  });

  describe('screenToIsometric', () => {
    it('should be inverse of isometricToScreen with top-face offset', () => {
      const screen = coord.isometricToScreen(5, 3, 0);
      // screenToIsometric compensates for top-face diamond offset (-tileHeight/6)
      const offsetY = -120 / 6;
      const iso = coord.screenToIsometric(screen.x, screen.y + offsetY);
      expect(iso.x).toBeCloseTo(5, 5);
      expect(iso.y).toBeCloseTo(3, 5);
    });

    it('should return floating point values', () => {
      const iso = coord.screenToIsometric(10, 10);
      expect(iso.x).not.toBe(Math.floor(iso.x));
    });
  });

  describe('screenToTile', () => {
    it('should return integer tile coordinates', () => {
      const tile = coord.screenToTile(10, 10);
      expect(Number.isInteger(tile.x)).toBe(true);
      expect(Number.isInteger(tile.y)).toBe(true);
    });

    it('should return (0,0) for screen origin', () => {
      const tile = coord.screenToTile(0, 0);
      expect(tile.x).toBe(0);
      expect(tile.y).toBe(0);
    });

    it('should convert tile center back to correct tile', () => {
      const screen = coord.isometricToScreen(3, 2, 0);
      const tile = coord.screenToTile(screen.x, screen.y);
      expect(tile.x).toBe(3);
      expect(tile.y).toBe(2);
    });

    it('should floor negative values correctly', () => {
      const tile = coord.screenToTile(-1, -1);
      expect(tile.x).toBeLessThanOrEqual(0);
      expect(tile.y).toBeLessThanOrEqual(0);
    });
  });

  describe('getTilePosition', () => {
    it('should floor the coordinates', () => {
      const pos = coord.getTilePosition(3.7, 2.2);
      expect(pos.x).toBe(3);
      expect(pos.y).toBe(2);
    });

    it('should floor negative values', () => {
      const pos = coord.getTilePosition(-1.5, -2.3);
      expect(pos.x).toBe(-2);
      expect(pos.y).toBe(-3);
    });
  });

  describe('getDistance', () => {
    it('should calculate Manhattan distance', () => {
      const dist = coord.getDistance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 });
      expect(dist).toBe(7);
    });

    it('should include z distance', () => {
      const dist = coord.getDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2 });
      expect(dist).toBe(2);
    });
  });

  describe('isAdjacent', () => {
    it('should return true for horizontally adjacent tiles', () => {
      expect(coord.isAdjacent({ x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 })).toBe(true);
    });

    it('should return true for vertically adjacent tiles', () => {
      expect(coord.isAdjacent({ x: 1, y: 1, z: 0 }, { x: 1, y: 2, z: 0 })).toBe(true);
    });

    it('should return false for diagonal tiles', () => {
      expect(coord.isAdjacent({ x: 1, y: 1, z: 0 }, { x: 2, y: 2, z: 0 })).toBe(false);
    });

    it('should return false for different z', () => {
      expect(coord.isAdjacent({ x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 1 })).toBe(false);
    });
  });

  describe('getTileWidth / getTileHeight', () => {
    it('should return configured tile width', () => {
      expect(coord.getTileWidth()).toBe(160);
    });

    it('should return configured tile height', () => {
      expect(coord.getTileHeight()).toBe(120);
    });
  });

  describe('setTileSize', () => {
    it('should update tile dimensions', () => {
      coord.setTileSize(64, 48);
      expect(coord.getTileWidth()).toBe(64);
      expect(coord.getTileHeight()).toBe(48);
    });

    it('should clamp to minimum of 1', () => {
      coord.setTileSize(0, -1);
      expect(coord.getTileWidth()).toBe(1);
      expect(coord.getTileHeight()).toBe(1);
    });
  });
});
