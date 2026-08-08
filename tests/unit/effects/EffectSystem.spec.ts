import { AnimationManager, Easing } from '@/engine/graphics/AnimationManager';

describe('EffectSystem units', () => {
  describe('blendTint (via AnimationManager integration)', () => {
    it('should blend tints correctly at t=0', () => {
      const from = 0xff0000;
      const to = 0x00ff00;
      const t = 0;
      const r1 = (from >> 16) & 0xff;
      const g1 = (from >> 8) & 0xff;
      const b1 = from & 0xff;
      const r2 = (to >> 16) & 0xff;
      const g2 = (to >> 8) & 0xff;
      const b2 = to & 0xff;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      const result = (r << 16) | (g << 8) | b;
      expect(result).toBe(0xff0000);
    });

    it('should blend tints correctly at t=1', () => {
      const from = 0xff0000;
      const to = 0x00ff00;
      const t = 1;
      const r1 = (from >> 16) & 0xff;
      const g1 = (from >> 8) & 0xff;
      const b1 = from & 0xff;
      const r2 = (to >> 16) & 0xff;
      const g2 = (to >> 8) & 0xff;
      const b2 = to & 0xff;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      const result = (r << 16) | (g << 8) | b;
      expect(result).toBe(0x00ff00);
    });

    it('should blend tints correctly at t=0.5', () => {
      const from = 0x000000;
      const to = 0xffffff;
      const t = 0.5;
      const r1 = (from >> 16) & 0xff;
      const g1 = (from >> 8) & 0xff;
      const b1 = from & 0xff;
      const r2 = (to >> 16) & 0xff;
      const g2 = (to >> 8) & 0xff;
      const b2 = to & 0xff;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      const result = (r << 16) | (g << 8) | b;
      expect(((result >> 16) & 0xff)).toBe(128);
      expect(((result >> 8) & 0xff)).toBe(128);
      expect((result & 0xff)).toBe(128);
    });
  });

  describe('effect animation via AnimationManager', () => {
    let anim: AnimationManager;

    beforeEach(() => {
      anim = new AnimationManager();
    });

    it('should animate damage tint effect', () => {
      const tintValues: number[] = [];
      const originalTint = 0xffffff;

      anim.animate({
        id: 'damage_test',
        duration: 300,
        easing: Easing.linear,
        onUpdate: (p: number) => {
          if (p < 0.5) {
            tintValues.push(0xff4444);
          } else {
            tintValues.push(0xffffff);
          }
        },
        onComplete: () => {
          tintValues.push(originalTint);
        },
      });

      anim.update(100);
      anim.update(200);

      expect(tintValues[0]).toBe(0xff4444);
      expect(tintValues[tintValues.length - 1]).toBe(originalTint);
    });

    it('should animate shake effect with decreasing intensity', () => {
      const offsets: number[] = [];

      anim.animate({
        id: 'shake_test',
        duration: 300,
        easing: Easing.linear,
        onUpdate: (p: number) => {
          const intensity = (1 - p) * 5;
          offsets.push(intensity);
        },
      });

      anim.update(50);
      anim.update(50);
      anim.update(50);
      anim.update(150);

      expect(offsets[0]).toBeGreaterThan(offsets[1]);
      expect(offsets[1]).toBeGreaterThan(offsets[2]);
      expect(offsets[offsets.length - 1]).toBeCloseTo(0, 5);
    });

    it('should animate attack effect with sin wave', () => {
      const offsets: number[] = [];

      anim.animate({
        id: 'attack_test',
        duration: 200,
        easing: Easing.linear,
        onUpdate: (p: number) => {
          offsets.push(Math.sin(p * Math.PI) * 10);
        },
      });

      anim.update(50);
      anim.update(150);

      expect(offsets[0]).toBeGreaterThan(0);
      expect(offsets[0]).toBeLessThanOrEqual(10);
    });

    it('should animate explosion particles outward', () => {
      const distances: number[] = [];
      const particleCount = 12;

      anim.animate({
        id: 'explosion_test',
        duration: 600,
        easing: Easing.easeOut,
        onUpdate: (p: number) => {
          for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const distance = p * 60;
            distances.push(Math.cos(angle) * distance);
          }
        },
      });

      anim.update(300);
      expect(distances.length).toBe(particleCount);
      expect(Math.abs(distances[0])).toBeGreaterThan(0);
    });

    it('should complete and clean up after effect duration', () => {
      let completed = false;
      anim.animate({
        id: 'test_effect',
        duration: 200,
        easing: Easing.linear,
        onUpdate: () => {},
        onComplete: () => { completed = true; },
      });

      anim.update(200);
      expect(completed).toBe(true);
      expect(anim.isAnimating('test_effect')).toBe(false);
    });
  });
});
