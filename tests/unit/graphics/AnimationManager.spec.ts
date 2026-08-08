import { AnimationManager, Easing } from '@/engine/graphics/AnimationManager';

describe('AnimationManager', () => {
  let manager: AnimationManager;

  beforeEach(() => {
    manager = new AnimationManager();
  });

  describe('animate / update', () => {
    it('should call onUpdate with eased progress', () => {
      const updates: number[] = [];
      manager.animate({
        id: 'test',
        duration: 100,
        easing: Easing.linear,
        onUpdate: (p: number) => updates.push(p),
      });

      manager.update(50);
      expect(updates).toHaveLength(1);
      expect(updates[0]).toBeCloseTo(0.5, 5);
    });

    it('should call onComplete when duration is reached', () => {
      let completed = false;
      manager.animate({
        id: 'test',
        duration: 100,
        easing: Easing.linear,
        onUpdate: () => {},
        onComplete: () => { completed = true; },
      });

      manager.update(100);
      expect(completed).toBe(true);
    });

    it('should remove track after completion', () => {
      manager.animate({
        id: 'test',
        duration: 100,
        easing: Easing.linear,
        onUpdate: () => {},
      });

      manager.update(100);
      expect(manager.isAnimating('test')).toBe(false);
    });

    it('should clamp progress to 1.0 when elapsed exceeds duration', () => {
      const updates: number[] = [];
      manager.animate({
        id: 'test',
        duration: 100,
        easing: Easing.linear,
        onUpdate: (p: number) => updates.push(p),
      });

      manager.update(150);
      expect(updates[0]).toBe(1.0);
    });

    it('should support multiple simultaneous tracks', () => {
      let v1 = 0, v2 = 0;
      manager.animate({
        id: 'a',
        duration: 100,
        easing: Easing.linear,
        onUpdate: (p: number) => { v1 = p; },
      });
      manager.animate({
        id: 'b',
        duration: 200,
        easing: Easing.linear,
        onUpdate: (p: number) => { v2 = p; },
      });

      manager.update(100);
      expect(v1).toBeCloseTo(1.0, 5);
      expect(v2).toBeCloseTo(0.5, 5);
      expect(manager.getActiveCount()).toBe(1);
    });
  });

  describe('Easing functions', () => {
    it('linear should return input directly', () => {
      expect(Easing.linear(0)).toBe(0);
      expect(Easing.linear(0.5)).toBe(0.5);
      expect(Easing.linear(1)).toBe(1);
    });

    it('easeIn should square the input', () => {
      expect(Easing.easeIn(0)).toBe(0);
      expect(Easing.easeIn(0.5)).toBe(0.25);
      expect(Easing.easeIn(1)).toBe(1);
    });

    it('easeOut should produce eased output', () => {
      expect(Easing.easeOut(0)).toBe(0);
      expect(Easing.easeOut(1)).toBe(1);
      expect(Easing.easeOut(0.5)).toBeCloseTo(0.75, 5);
    });

    it('easeInOut should be symmetric around 0.5', () => {
      expect(Easing.easeInOut(0)).toBe(0);
      expect(Easing.easeInOut(1)).toBe(1);
      expect(Easing.easeInOut(0.5)).toBeCloseTo(0.5, 5);
      expect(Easing.easeInOut(0.25)).toBeCloseTo(0.125, 5);
    });
  });

  describe('cancel', () => {
    it('should cancel an active animation', () => {
      let called = false;
      manager.animate({
        id: 'test',
        duration: 100,
        easing: Easing.linear,
        onUpdate: () => { called = true; },
      });

      manager.cancel('test');
      manager.update(50);
      expect(called).toBe(false);
      expect(manager.isAnimating('test')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all animations', () => {
      manager.animate({ id: 'a', duration: 100, easing: Easing.linear, onUpdate: () => {} });
      manager.animate({ id: 'b', duration: 100, easing: Easing.linear, onUpdate: () => {} });

      manager.clear();
      expect(manager.getActiveCount()).toBe(0);
    });
  });

  describe('replace existing track with same id', () => {
    it('should replace the old track when same id is animated again', () => {
      const updates: number[] = [];
      manager.animate({
        id: 'test',
        duration: 100,
        easing: Easing.linear,
        onUpdate: (p: number) => updates.push(p),
      });

      manager.update(30);
      updates.length = 0;

      manager.animate({
        id: 'test',
        duration: 100,
        easing: Easing.linear,
        onUpdate: (p: number) => updates.push(p),
      });

      manager.update(50);
      expect(updates[0]).toBeCloseTo(0.5, 5);
    });
  });
});
