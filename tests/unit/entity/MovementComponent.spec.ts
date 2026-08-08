import { MovementComponent } from '@/engine/entity/components/Movement';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { Entity } from '@/engine/entity/Entity';
import { Easing } from '@/engine/graphics/AnimationManager';

describe('MovementComponent', () => {
  let entity: Entity;
  let transform: TransformComponent;
  let movement: MovementComponent;

  beforeEach(() => {
    entity = new Entity('test', 'test');
    transform = new TransformComponent();
    entity.addComponent(transform);
    movement = new MovementComponent(4, 200, Easing.linear);
    movement.entity = entity;
    movement.initialize();
  });

  describe('initial state', () => {
    it('should not be moving', () => {
      expect(movement.isMoving).toBe(false);
    });

    it('should have default direction down', () => {
      expect(movement.direction).toBe('down');
    });
  });

  describe('moveTo', () => {
    it('should start moving to target', () => {
      transform.setPosition(5, 5, 0);
      const result = movement.moveTo(6, 5, 0);
      expect(result).toBe(true);
      expect(movement.isMoving).toBe(true);
    });

    it('should immediately set logical position to target', () => {
      transform.setPosition(5, 5, 0);
      movement.moveTo(6, 5, 0);
      expect(transform.position.x).toBe(6);
      expect(transform.position.y).toBe(5);
    });

    it('should not start moving if already moving', () => {
      transform.setPosition(5, 5, 0);
      movement.moveTo(6, 5, 0);
      const result = movement.moveTo(7, 5, 0);
      expect(result).toBe(false);
    });

    it('should return false if no transform component', () => {
      const emptyEntity = new Entity('empty', 'test');
      movement.entity = emptyEntity;
      expect(movement.moveTo(1, 1, 0)).toBe(false);
    });
  });

  describe('interpolated position', () => {
    it('should start at the original position', () => {
      transform.setPosition(5, 5, 0);
      movement.moveTo(7, 5, 0);
      const interp = movement.getInterpolatedPosition();
      expect(interp.x).toBe(5);
      expect(interp.y).toBe(5);
    });

    it('should interpolate towards target with deltaTime', () => {
      transform.setPosition(0, 0, 0);
      movement.moveTo(10, 0, 0);

      movement.update(100); // 50% progress with 200ms duration
      const interp = movement.getInterpolatedPosition();
      expect(interp.x).toBeCloseTo(5, 5);
    });

    it('should reach target after full duration', () => {
      transform.setPosition(0, 0, 0);
      movement.moveTo(10, 0, 0);

      movement.update(200);
      const interp = movement.getInterpolatedPosition();
      expect(interp.x).toBe(10);
      expect(movement.isMoving).toBe(false);
    });

    it('should clamp to target if deltaTime exceeds duration', () => {
      transform.setPosition(0, 0, 0);
      movement.moveTo(10, 0, 0);

      movement.update(300);
      const interp = movement.getInterpolatedPosition();
      expect(interp.x).toBe(10);
      expect(movement.isMoving).toBe(false);
    });

    it('should interpolate Y axis', () => {
      transform.setPosition(0, 0, 0);
      movement.moveTo(0, 10, 0);

      movement.update(100);
      const interp = movement.getInterpolatedPosition();
      expect(interp.y).toBeCloseTo(5, 5);
    });

    it('should interpolate Z axis', () => {
      transform.setPosition(0, 0, 0);
      movement.moveTo(0, 0, 5);

      movement.update(100);
      const interp = movement.getInterpolatedPosition();
      expect(interp.z).toBeCloseTo(2.5, 5);
    });
  });

  describe('direction', () => {
    it('should set direction to right when moving +X', () => {
      transform.setPosition(5, 5, 0);
      movement.moveTo(6, 5, 0);
      expect(movement.direction).toBe('right');
    });

    it('should set direction to left when moving -X', () => {
      transform.setPosition(5, 5, 0);
      movement.moveTo(4, 5, 0);
      expect(movement.direction).toBe('left');
    });

    it('should set direction to down when moving +Y', () => {
      transform.setPosition(5, 5, 0);
      movement.moveTo(5, 6, 0);
      expect(movement.direction).toBe('down');
    });

    it('should set direction to up when moving -Y', () => {
      transform.setPosition(5, 5, 0);
      movement.moveTo(5, 4, 0);
      expect(movement.direction).toBe('up');
    });
  });

  describe('easing', () => {
    it('should apply easing function', () => {
      const easeInMovement = new MovementComponent(4, 200, Easing.easeIn);
      easeInMovement.entity = entity;
      easeInMovement.initialize();

      transform.setPosition(0, 0, 0);
      easeInMovement.moveTo(10, 0, 0);

      easeInMovement.update(100); // 50% raw progress
      const interp = easeInMovement.getInterpolatedPosition();
      // easeIn(0.5) = 0.25, so x should be 2.5
      expect(interp.x).toBeCloseTo(2.5, 5);
    });
  });

  describe('multiple updates', () => {
    it('should accumulate progress across multiple updates', () => {
      transform.setPosition(0, 0, 0);
      movement.moveTo(10, 0, 0);

      movement.update(50);
      movement.update(50);
      movement.update(50);
      movement.update(50);

      const interp = movement.getInterpolatedPosition();
      expect(interp.x).toBe(10);
      expect(movement.isMoving).toBe(false);
    });
  });

  describe('speed property', () => {
    it('should get speed', () => {
      expect(movement.speed).toBe(4);
    });

    it('should set speed with minimum clamp', () => {
      movement.speed = 0.01;
      expect(movement.speed).toBe(0.1);
    });
  });

  describe('direction setter', () => {
    it('should set direction', () => {
      movement.direction = 'up';
      expect(movement.direction).toBe('up');
    });
  });
});
