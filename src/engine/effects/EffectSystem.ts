import { System } from '../System';
import { Engine } from '../Engine';
import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { RendererSystem } from '../graphics/RendererSystem';
import { AnimationManager, Easing } from '../graphics/AnimationManager';
import { SpriteComponent } from '../entity/components/Sprite';
import { LayerName } from '../types';
import * as PIXI from 'pixi.js';

let effectIdCounter = 0;

/**
 * エフェクトシステム - AnimationManagerベースでビジュアルエフェクトを管理
 * 全アニメーションはEngineのゲームループで更新（requestAnimationFrame不使用）
 */
export class EffectSystem implements System {
  private engine: Engine | null = null;
  private eventSystem: EventSystem | null = null;
  private entitySystem: EntitySystem | null = null;
  private rendererSystem: RendererSystem | null = null;
  private animationManager: AnimationManager | null = null;

  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    this.entitySystem = engine.getSystem<EntitySystem>('entity') || null;
    this.rendererSystem = engine.getSystem<RendererSystem>('renderer') || null;
    this.animationManager = this.rendererSystem?.getAnimationManager() ?? null;
    this.setupEventListeners();
  }

  update(_deltaTime: number): void {
    // AnimationManagerはRendererSystem.update()で更新される
  }

  private setupEventListeners(): void {
    if (!this.eventSystem) return;

    this.eventSystem.on('damage_taken', (data: { entityId: string }) => {
      this.playDamageEffect(data.entityId);
    });
    this.eventSystem.on('entity_healed', (data: { entityId: string }) => {
      this.playHealEffect(data.entityId);
    });
    this.eventSystem.on(
      'enemy_destroyed',
      (data: { position: { x: number; y: number; z?: number } }) => {
        if (data?.position) this.playExplosionEffect(data.position);
      }
    );
    this.eventSystem.on('attack_performed', (data: { entityId: string }) => {
      this.playAttackEffect(data.entityId);
    });
    this.eventSystem.on('shake_requested', (data: { entityId: string }) => {
      this.playShakeEffect(data.entityId);
    });
  }

  private getSprite(entityId: string): PIXI.Sprite | null {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) return null;
    const spriteComponent = entity.getComponent<SpriteComponent>('sprite');
    return spriteComponent?.getSprite() ?? null;
  }

  playDamageEffect(entityId: string): void {
    const sprite = this.getSprite(entityId);
    if (!sprite || !this.animationManager) return;

    const originalTint = sprite.tint;
    const id = `damage_${entityId}_${effectIdCounter++}`;

    this.animationManager.animate({
      id,
      duration: 300,
      easing: Easing.easeOut,
      onUpdate: (p: number) => {
        if (p < 0.5) {
          sprite.tint = 0xff4444;
        } else {
          const t = (p - 0.5) * 2;
          sprite.tint = blendTint(0xff4444, originalTint, t);
        }
      },
      onComplete: () => {
        sprite.tint = originalTint;
      },
    });
  }

  playHealEffect(entityId: string): void {
    const sprite = this.getSprite(entityId);
    if (!sprite || !this.animationManager) return;

    const originalTint = sprite.tint;
    const id = `heal_${entityId}_${effectIdCounter++}`;

    this.animationManager.animate({
      id,
      duration: 400,
      easing: Easing.easeOut,
      onUpdate: (p: number) => {
        if (p < 0.5) {
          sprite.tint = 0x44ff44;
        } else {
          const t = (p - 0.5) * 2;
          sprite.tint = blendTint(0x44ff44, originalTint, t);
        }
      },
      onComplete: () => {
        sprite.tint = originalTint;
      },
    });
  }

  playAttackEffect(entityId: string): void {
    const sprite = this.getSprite(entityId);
    if (!sprite || !this.animationManager) return;

    const originalX = sprite.x;
    const originalY = sprite.y;
    const id = `attack_${entityId}_${effectIdCounter++}`;

    this.animationManager.animate({
      id,
      duration: 200,
      easing: Easing.easeInOut,
      onUpdate: (p: number) => {
        const offset = Math.sin(p * Math.PI) * 10;
        sprite.x = originalX + offset;
        sprite.y = originalY - offset * 0.5;
      },
      onComplete: () => {
        sprite.x = originalX;
        sprite.y = originalY;
      },
    });
  }

  playShakeEffect(entityId: string): void {
    const sprite = this.getSprite(entityId);
    if (!sprite || !this.animationManager) return;

    const originalX = sprite.x;
    const originalY = sprite.y;
    const id = `shake_${entityId}_${effectIdCounter++}`;

    this.animationManager.animate({
      id,
      duration: 300,
      easing: Easing.linear,
      onUpdate: (p: number) => {
        const intensity = (1 - p) * 5;
        sprite.x = originalX + (Math.random() - 0.5) * intensity * 2;
        sprite.y = originalY + (Math.random() - 0.5) * intensity * 2;
      },
      onComplete: () => {
        sprite.x = originalX;
        sprite.y = originalY;
      },
    });
  }

  playExplosionEffect(position: { x: number; y: number; z?: number }): void {
    if (!this.rendererSystem || !this.animationManager) return;

    const coordSystem = this.rendererSystem.getCoordinateSystem();
    const screenPos = coordSystem.isometricToScreen(position.x, position.y, position.z || 0);

    const effectsLayer = this.rendererSystem.getLayer(LayerName.EFFECTS);
    if (!effectsLayer) return;

    const container = new PIXI.Container();
    container.x = screenPos.x;
    container.y = screenPos.y;
    effectsLayer.addChild(container);

    const particles: PIXI.Graphics[] = [];
    const particleCount = 12;

    for (let i = 0; i < particleCount; i++) {
      const particle = new PIXI.Graphics();
      const size = 3 + Math.random() * 5;
      particle.circle(0, 0, size);
      particle.fill({ color: 0xff8800, alpha: 1.0 });
      container.addChild(particle);
      particles.push(particle);
    }

    const id = `explosion_${effectIdCounter++}`;
    const duration = 600;

    this.animationManager.animate({
      id,
      duration,
      easing: Easing.easeOut,
      onUpdate: (p: number) => {
        for (let i = 0; i < particles.length; i++) {
          const particle = particles[i];
          const angle = (i / particleCount) * Math.PI * 2;
          const distance = p * 60;
          particle.x = Math.cos(angle) * distance;
          particle.y = Math.sin(angle) * distance;
          particle.alpha = 1 - p;
          particle.scale.set(1 - p * 0.5);
        }
      },
      onComplete: () => {
        for (const particle of particles) {
          particle.destroy();
        }
        container.destroy();
      },
    });
  }

  registerEffect(_name: string, _effect: unknown): void {
    // 将来の拡張用
  }
}

function blendTint(from: number, to: number, t: number): number {
  const r1 = (from >> 16) & 0xff;
  const g1 = (from >> 8) & 0xff;
  const b1 = from & 0xff;
  const r2 = (to >> 16) & 0xff;
  const g2 = (to >> 8) & 0xff;
  const b2 = to & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}
