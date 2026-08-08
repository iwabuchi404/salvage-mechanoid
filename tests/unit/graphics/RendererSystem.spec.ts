import { CoordinateSystem } from '@/engine/graphics/CoordinateSystem';
import { Camera } from '@/engine/graphics/Camera';
import { TileRenderer } from '@/engine/graphics/TileRenderer';
import { AnimationManager } from '@/engine/graphics/AnimationManager';
import { RENDER_CONFIG } from '@/engine/graphics/RenderConfig';

describe('RendererSystem integration units', () => {
  describe('Camera + CoordinateSystem + screenToTile', () => {
    let coord: CoordinateSystem;
    let camera: Camera;

    beforeEach(() => {
      coord = new CoordinateSystem(160, 120);
      camera = new Camera();
    });

    it('should convert screen to tile with camera offset', () => {
      camera.setPosition(100, 50);

      const screenX = 400;
      const screenY = 300;
      const worldX = screenX / camera.zoom + camera.x;
      const worldY = screenY / camera.zoom + camera.y;
      const tile = coord.screenToTile(worldX, worldY);

      expect(Number.isInteger(tile.x)).toBe(true);
      expect(Number.isInteger(tile.y)).toBe(true);
    });

    it('should convert screen to tile with zoom', () => {
      camera.setPosition(0, 0);
      camera.zoom = 2.0;

      const screenX = 160;
      const screenY = 80;
      const worldX = screenX / camera.zoom + camera.x;
      const worldY = screenY / camera.zoom + camera.y;
      const tile = coord.screenToTile(worldX, worldY);

      const expectedScreen = coord.isometricToScreen(tile.x, tile.y, 0);
      expect(expectedScreen.x).toBeCloseTo(worldX, 0);
      expect(expectedScreen.y).toBeCloseTo(worldY, 0);
    });

    it('should be consistent: tile center -> screen -> tile', () => {
      camera.setPosition(200, 100);
      camera.zoom = 1.5;

      const tileX = 5;
      const tileY = 3;
      const screenPos = coord.isometricToScreen(tileX, tileY, 0);

      const screenX = (screenPos.x - camera.x) * camera.zoom;
      const screenY = (screenPos.y - camera.y) * camera.zoom;

      const worldX = screenX / camera.zoom + camera.x;
      const worldY = screenY / camera.zoom + camera.y;
      const result = coord.screenToTile(worldX, worldY);

      expect(result.x).toBe(tileX);
      expect(result.y).toBe(tileY);
    });
  });

  describe('TileRenderer viewport calculation', () => {
    let coord: CoordinateSystem;
    let camera: Camera;
    let tileRenderer: TileRenderer;

    beforeEach(() => {
      coord = new CoordinateSystem(RENDER_CONFIG.TILE_WIDTH, RENDER_CONFIG.TILE_HEIGHT);
      camera = new Camera();
      tileRenderer = new TileRenderer(coord);
    });

    it('should calculate viewport at origin', () => {
      const viewport = tileRenderer.calculateViewport(camera, coord);
      expect(viewport.minX).toBeLessThanOrEqual(viewport.maxX);
      expect(viewport.minY).toBeLessThanOrEqual(viewport.maxY);
    });

    it('should shift viewport when camera moves', () => {
      const vp1 = tileRenderer.calculateViewport(camera, coord);
      camera.setPosition(500, 300);
      const vp2 = tileRenderer.calculateViewport(camera, coord);
      expect(vp2.minX).not.toBe(vp1.minX);
    });

    it('should include margin', () => {
      const viewport = tileRenderer.calculateViewport(camera, coord);
      const widthWithoutMargin = viewport.maxX - viewport.minX;
      expect(widthWithoutMargin).toBeGreaterThan(0);
    });

    it('should adjust viewport for zoom', () => {
      const vp1 = tileRenderer.calculateViewport(camera, coord);
      camera.zoom = 2.0;
      const vp2 = tileRenderer.calculateViewport(camera, coord);
      const width1 = vp1.maxX - vp1.minX;
      const width2 = vp2.maxX - vp2.minX;
      expect(width2).toBeLessThanOrEqual(width1);
    });
  });

  describe('AnimationManager integration with Camera', () => {
    it('should animate camera movement via AnimationManager', () => {
      const camera = new Camera();
      const anim = new AnimationManager();

      camera.setTargetPosition(100, 100);

      let progress = 0;
      anim.animate({
        id: 'camera_test',
        duration: 300,
        easing: (t: number) => t,
        onUpdate: (p: number) => { progress = p; },
      });

      for (let i = 0; i < 100; i++) {
        anim.update(16);
        camera.update(16);
      }

      expect(progress).toBe(1.0);
      expect(camera.x).toBeCloseTo(100, 0);
      expect(camera.y).toBeCloseTo(100, 0);
    });
  });

  describe('TileRenderer state management', () => {
    let coord: CoordinateSystem;
    let tileRenderer: TileRenderer;

    beforeEach(() => {
      coord = new CoordinateSystem(160, 120);
      tileRenderer = new TileRenderer(coord);
    });

    it('should start with no tile map data', () => {
      expect(tileRenderer.hasTileMapData()).toBe(false);
    });

    it('should track tile visibility state', () => {
      tileRenderer.updateTileVisibility(5, 3, true, true);
      expect(tileRenderer.getActiveSprite(5, 3)).toBeUndefined();
    });

    it('should clear all state', () => {
      tileRenderer.updateTileVisibility(1, 1, true, true);
      tileRenderer.clear();
      expect(tileRenderer.hasTileMapData()).toBe(false);
      expect(tileRenderer.getActiveSpriteCount()).toBe(0);
    });

    it('should report pool size', () => {
      expect(tileRenderer.getPoolSize()).toBe(0);
    });
  });
});
