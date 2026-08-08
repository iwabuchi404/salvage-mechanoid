import { Camera } from '@/engine/graphics/Camera';

describe('Camera', () => {
  let camera: Camera;

  beforeEach(() => {
    camera = new Camera();
  });

  describe('initial state', () => {
    it('should start at (0, 0)', () => {
      expect(camera.x).toBe(0);
      expect(camera.y).toBe(0);
    });

    it('should have zoom of 1.0', () => {
      expect(camera.zoom).toBe(1.0);
    });

    it('should have rotation of 0', () => {
      expect(camera.rotation).toBe(0);
    });
  });

  describe('setPosition', () => {
    it('should set position', () => {
      camera.setPosition(100, 200);
      expect(camera.x).toBe(100);
      expect(camera.y).toBe(200);
    });

    it('should clear target position', () => {
      camera.setTargetPosition(50, 50);
      camera.setPosition(100, 200);
      camera.update(16);
      expect(camera.x).toBe(100);
      expect(camera.y).toBe(200);
    });
  });

  describe('move', () => {
    it('should move by delta', () => {
      camera.move(10, 20);
      expect(camera.x).toBe(10);
      expect(camera.y).toBe(20);
    });

    it('should clear target position', () => {
      camera.setTargetPosition(50, 50);
      camera.move(10, 20);
      camera.update(16);
      expect(camera.x).toBe(10);
      expect(camera.y).toBe(20);
    });
  });

  describe('setTargetPosition / update (smooth movement)', () => {
    it('should move towards target on update', () => {
      camera.setTargetPosition(100, 100);
      camera.update(16);
      expect(camera.x).toBeGreaterThan(0);
      expect(camera.x).toBeLessThan(100);
      expect(camera.y).toBeGreaterThan(0);
      expect(camera.y).toBeLessThan(100);
    });

    it('should reach target after enough updates', () => {
      camera.setTargetPosition(100, 100);
      for (let i = 0; i < 100; i++) {
        camera.update(16);
      }
      expect(camera.x).toBeCloseTo(100, 0);
      expect(camera.y).toBeCloseTo(100, 0);
    });

    it('should stop updating after reaching target', () => {
      camera.setTargetPosition(100, 100);
      for (let i = 0; i < 100; i++) {
        camera.update(16);
      }
      const xAfterReach = camera.x;
      camera.update(16);
      expect(camera.x).toBe(xAfterReach);
    });
  });

  describe('zoom', () => {
    it('should set zoom', () => {
      camera.zoom = 2.0;
      expect(camera.zoom).toBe(2.0);
    });

    it('should throw for zero zoom', () => {
      expect(() => { camera.zoom = 0; }).toThrow();
    });

    it('should throw for negative zoom', () => {
      expect(() => { camera.zoom = -1; }).toThrow();
    });
  });

  describe('rotation', () => {
    it('should set rotation', () => {
      camera.rotation = Math.PI;
      expect(camera.rotation).toBeCloseTo(Math.PI, 5);
    });
  });

  describe('setSmoothingFactor', () => {
    it('should set smoothing factor', () => {
      camera.setSmoothingFactor(0.5);
      camera.setTargetPosition(100, 0);
      camera.update(16);
      expect(camera.x).toBeGreaterThan(0);
    });

    it('should throw for factor < 0', () => {
      expect(() => camera.setSmoothingFactor(-0.1)).toThrow();
    });

    it('should throw for factor > 1', () => {
      expect(() => camera.setSmoothingFactor(1.1)).toThrow();
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      camera.setPosition(100, 200);
      camera.zoom = 2.0;
      camera.rotation = Math.PI;
      camera.setTargetPosition(300, 300);

      camera.reset();
      expect(camera.x).toBe(0);
      expect(camera.y).toBe(0);
      expect(camera.zoom).toBe(1.0);
      expect(camera.rotation).toBe(0);
    });
  });

  describe('screenToWorld / worldToScreen', () => {
    it('should be inverse operations (no rotation, zoom=1)', () => {
      const world = { x: 150, y: 75 };
      const screen = camera.worldToScreen(world.x, world.y);
      const back = camera.screenToWorld(screen.x, screen.y);
      expect(back.x).toBeCloseTo(world.x, 2);
      expect(back.y).toBeCloseTo(world.y, 2);
    });

    it('should account for camera position', () => {
      camera.setPosition(50, 30);
      const screen = camera.worldToScreen(100, 100);
      expect(screen.x).toBe(150);
      expect(screen.y).toBe(130);
    });

    it('should account for zoom', () => {
      camera.zoom = 2.0;
      const screen = camera.worldToScreen(10, 10);
      expect(screen.x).toBe(20);
      expect(screen.y).toBe(20);
    });
  });
});
