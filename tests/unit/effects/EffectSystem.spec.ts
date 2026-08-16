import { Engine } from '@/engine/Engine';
import { Component } from '@/engine/entity/Component';
import { Entity } from '@/engine/entity/Entity';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { EffectSystem } from '@/engine/effects/EffectSystem';
import { AnimationManager } from '@/engine/graphics/AnimationManager';
import { RendererSystem } from '@/engine/graphics/RendererSystem';
import * as PIXI from 'pixi.js';

describe('EffectSystem', () => {
  let events: EventSystem;
  let entities: EntitySystem;
  let animations: AnimationManager;
  let effects: EffectSystem;
  let sprite: PIXI.Sprite;

  beforeEach(async () => {
    events = new EventSystem();
    entities = new EntitySystem();
    animations = new AnimationManager();
    sprite = { tint: 0xffffff, x: 10, y: 20 } as PIXI.Sprite;

    const entity = new Entity('target', 'actor');
    const spriteComponent = {
      type: 'sprite',
      entity: null,
      initialize: jest.fn(),
      update: jest.fn(),
      getSprite: () => sprite,
    } as Component & { getSprite: () => PIXI.Sprite };
    entity.addComponent(spriteComponent);

    const renderer = {
      getAnimationManager: () => animations,
    } as unknown as RendererSystem;
    const engine = {
      getSystem: (name: string) => {
        if (name === 'event') return events;
        if (name === 'entity') return entities;
        if (name === 'renderer') return renderer;
        return undefined;
      },
    } as unknown as Engine;
    await entities.initialize(engine);
    entities.registerEntity(entity);
    effects = new EffectSystem();
    await effects.initialize(engine);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('damage_takenで赤く点滅し、完了時に元の色へ戻す', () => {
    events.emit('damage_taken', { entityId: 'target', damage: 10, attackerId: 'attacker' });

    animations.update(50);
    expect(sprite.tint).toBe(0xff4444);

    animations.update(250);
    expect(sprite.tint).toBe(0xffffff);
  });

  it('entity_healedで緑に点滅し、完了時に元の色へ戻す', () => {
    events.emit('entity_healed', { entityId: 'target', heal: 10, currentHp: 90, maxHp: 100 });

    animations.update(50);
    expect(sprite.tint).toBe(0x44ff44);

    animations.update(350);
    expect(sprite.tint).toBe(0xffffff);
  });

  it('attack_performedでスプライトを動かし、完了時に元の位置へ戻す', () => {
    events.emit('attack_performed', { entityId: 'target' });

    animations.update(100);
    expect(sprite.x).toBeGreaterThan(10);
    expect(sprite.y).toBeLessThan(20);

    animations.update(100);
    expect({ x: sprite.x, y: sprite.y }).toEqual({ x: 10, y: 20 });
  });

  it('shake_requestedで減衰する揺れを開始し、完了時に元の位置へ戻す', () => {
    jest.spyOn(Math, 'random').mockReturnValue(1);

    events.emit('shake_requested', { entityId: 'target' });

    animations.update(100);
    expect(sprite.x).toBeGreaterThan(10);
    expect(sprite.y).toBeGreaterThan(20);

    animations.update(200);
    expect({ x: sprite.x, y: sprite.y }).toEqual({ x: 10, y: 20 });
  });

  it('enemy_destroyedの位置を爆発エフェクトへ渡す', () => {
    const explosion = jest.spyOn(effects, 'playExplosionEffect').mockImplementation();
    const position = { x: 3, y: 4, z: 0 };

    events.emit('enemy_destroyed', { entityId: 'enemy', position });

    expect(explosion).toHaveBeenCalledWith(position);
  });

  it('対象エンティティがない場合はアニメーションを登録しない', () => {
    const animate = jest.spyOn(animations, 'animate');

    events.emit('damage_taken', { entityId: 'missing', damage: 10, attackerId: 'attacker' });

    expect(animate).not.toHaveBeenCalled();
  });
});
