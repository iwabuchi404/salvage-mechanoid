import { RendererSystem } from '@/engine/graphics/RendererSystem';
import { RENDER_CONFIG } from '@/engine/graphics/RenderConfig';

describe('RendererSystem config integration', () => {
  describe('constructor with RENDER_CONFIG defaults', () => {
    it('should use RENDER_CONFIG tile dimensions when no args provided', () => {
      const renderer = new RendererSystem();
      const coord = renderer.getCoordinateSystem();

      expect(coord.getTileWidth()).toBe(RENDER_CONFIG.TILE_WIDTH);
      expect(coord.getTileHeight()).toBe(RENDER_CONFIG.TILE_HEIGHT);
    });

    it('should use RENDER_CONFIG tile dimensions when explicitly passed', () => {
      const renderer = new RendererSystem(
        RENDER_CONFIG.TILE_WIDTH,
        RENDER_CONFIG.TILE_HEIGHT
      );
      const coord = renderer.getCoordinateSystem();

      expect(coord.getTileWidth()).toBe(RENDER_CONFIG.TILE_WIDTH);
      expect(coord.getTileHeight()).toBe(RENDER_CONFIG.TILE_HEIGHT);
    });

    it('should allow custom tile dimensions for testing', () => {
      const renderer = new RendererSystem(64, 48);
      const coord = renderer.getCoordinateSystem();

      expect(coord.getTileWidth()).toBe(64);
      expect(coord.getTileHeight()).toBe(48);
    });

    it('should produce consistent screen coordinates with config values', () => {
      const renderer = new RendererSystem();
      const coord = renderer.getCoordinateSystem();

      const screenPos = coord.isometricToScreen(0, 0, 0);
      expect(screenPos.x).toBe(0);
      expect(screenPos.y).toBe(0);
    });
  });
});
