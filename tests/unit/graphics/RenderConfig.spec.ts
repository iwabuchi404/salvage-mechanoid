import { RENDER_CONFIG, TILE_TEXTURES, getTileTexturePath } from '@/engine/graphics/RenderConfig';
import { TileType } from '@/engine/types';

describe('RenderConfig', () => {
  describe('RENDER_CONFIG', () => {
    it('should have required config values', () => {
      expect(RENDER_CONFIG.TILE_WIDTH).toBeGreaterThan(0);
      expect(RENDER_CONFIG.TILE_HEIGHT).toBeGreaterThan(0);
      expect(RENDER_CONFIG.SCREEN_WIDTH).toBeGreaterThan(0);
      expect(RENDER_CONFIG.SCREEN_HEIGHT).toBeGreaterThan(0);
    });

    it('should have tile width of 160', () => {
      expect(RENDER_CONFIG.TILE_WIDTH).toBe(160);
    });

    it('should have tile height of 120', () => {
      expect(RENDER_CONFIG.TILE_HEIGHT).toBe(120);
    });
  });

  describe('TILE_TEXTURES', () => {
    it('should have texture paths for all tile types', () => {
      expect(TILE_TEXTURES[TileType.GRASS]).toBeDefined();
      expect(TILE_TEXTURES[TileType.WATER]).toBeDefined();
      expect(TILE_TEXTURES[TileType.MOUNTAIN]).toBeDefined();
      expect(TILE_TEXTURES[TileType.TILE]).toBeDefined();
    });

    it('should have WATER map to image02.png', () => {
      expect(TILE_TEXTURES[TileType.WATER]).toBe('./image02.png');
    });

    it('should have MOUNTAIN map to image03.png', () => {
      expect(TILE_TEXTURES[TileType.MOUNTAIN]).toBe('./image03.png');
    });
  });

  describe('getTileTexturePath', () => {
    it('should return correct path for known tile type', () => {
      expect(getTileTexturePath(TileType.GRASS)).toBe('./image.png');
      expect(getTileTexturePath(TileType.WATER)).toBe('./image02.png');
      expect(getTileTexturePath(TileType.MOUNTAIN)).toBe('./image03.png');
    });

    it('should return default path for unknown tile type', () => {
      expect(getTileTexturePath(999)).toBe('./image.png');
    });
  });
});
