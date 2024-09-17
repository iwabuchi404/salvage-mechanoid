import * as PIXI from 'pixi.js';

export interface Effect {
  apply: (sprite: PIXI.Sprite) => void;
  duration: number;
  update?: (sprite: PIXI.Sprite, progress: number) => void;
  complete?: (sprite: PIXI.Sprite) => void;
}

export class EffectManager {
  private static effects: Map<string, Effect> = new Map();
  private static activeEffects: Map<PIXI.Sprite, { effect: Effect; startTime: number }[]> =
    new Map();

  static registerEffect(name: string, effect: Effect): void {
    this.effects.set(name, effect);
  }

  static getEffect(name: string): Effect | undefined {
    return this.effects.get(name);
  }

  static applyEffect(sprite: PIXI.Sprite, effectName: string): void {
    const effect = this.getEffect(effectName);
    if (effect) {
      effect.apply(sprite);

      if (!this.activeEffects.has(sprite)) {
        this.activeEffects.set(sprite, []);
      }
      this.activeEffects.get(sprite)!.push({ effect, startTime: Date.now() });

      if (effect.update) {
        this.startUpdateLoop();
      }

      setTimeout(() => {
        if (effect.complete) {
          effect.complete(sprite);
        }
        const activeEffectsForSprite = this.activeEffects.get(sprite);
        if (activeEffectsForSprite) {
          const index = activeEffectsForSprite.findIndex((e) => e.effect === effect);
          if (index !== -1) {
            activeEffectsForSprite.splice(index, 1);
          }
          if (activeEffectsForSprite.length === 0) {
            this.activeEffects.delete(sprite);
          }
        }
      }, effect.duration);
    }
  }

  private static updateLoop: number | null = null;

  private static startUpdateLoop(): void {
    if (this.updateLoop === null) {
      this.updateLoop = requestAnimationFrame(this.update.bind(this));
    }
  }

  private static update(): void {
    const currentTime = Date.now();
    for (const [sprite, effects] of this.activeEffects.entries()) {
      for (const { effect, startTime } of effects) {
        if (effect.update) {
          const progress = Math.min((currentTime - startTime) / effect.duration, 1);
          effect.update(sprite, progress);
        }
      }
    }

    if (this.activeEffects.size > 0) {
      this.updateLoop = requestAnimationFrame(this.update.bind(this));
    } else {
      this.updateLoop = null;
    }
  }
}

EffectManager.registerEffect('damage', {
  apply: (sprite: PIXI.Sprite) => {
    sprite.tint = 0xff0000;
    sprite.pivot.set(sprite.width / 2, sprite.height / 2);
    sprite.position.set(
      sprite.position.x + sprite.width / 2,
      sprite.position.y + sprite.height / 2
    );
    // 元の位置をスプライトのプロパティとして保存
    (sprite as any)._damageEffectOriginalX = sprite.x;
    (sprite as any)._damageEffectOriginalY = sprite.y;
  },
  update: (sprite: PIXI.Sprite, progress: number) => {
    const amplitude = 10; // 最大シェイク距離（ピクセル）
    const frequency = 30; // 1秒あたりのシェイク回数
    const shake = Math.sin(progress * Math.PI * frequency) * amplitude * (1 - progress);
    sprite.x = (sprite as any)._damageEffectOriginalX + shake;
    sprite.y = (sprite as any)._damageEffectOriginalY + shake;
  },
  duration: 200,
  complete: (sprite: PIXI.Sprite) => {
    // スプライトを元の位置に戻す
    sprite.x = (sprite as any)._damageEffectOriginalX;
    sprite.y = (sprite as any)._damageEffectOriginalY;
    sprite.position.set(
      sprite.position.x - sprite.width / 2,
      sprite.position.y - sprite.height / 2
    );
    sprite.pivot.set(0, 0);
    // 一時的に追加したプロパティを削除
    delete (sprite as any)._damageEffectOriginalX;
    delete (sprite as any)._damageEffectOriginalY;
    sprite.tint = 0xffffff;
  },
});

EffectManager.registerEffect('heal', {
  apply: (sprite: PIXI.Sprite) => {
    sprite.tint = 0x00ff00;
  },
  duration: 200,
  complete: (sprite: PIXI.Sprite) => {
    sprite.tint = 0xffffff;
  },
});

EffectManager.registerEffect('shake', {
  apply: (sprite: PIXI.Sprite) => {
    sprite.pivot.set(sprite.width / 2, sprite.height / 2);
    sprite.position.set(
      sprite.position.x + sprite.width / 2,
      sprite.position.y + sprite.height / 2
    );
    (sprite as any)._originalShakeX = sprite.x;
    (sprite as any)._originalShakeY = sprite.y;
  },
  update: (sprite: PIXI.Sprite, progress: number) => {
    const amplitude = 10;
    const frequency = 50;
    const shake = Math.sin(progress * Math.PI * frequency) * amplitude * (1 - progress);
    sprite.x = (sprite as any)._originalShakeX + shake;
    sprite.y = (sprite as any)._originalShakeY + shake;
  },
  complete: (sprite: PIXI.Sprite) => {
    sprite.x = (sprite as any)._originalShakeX;
    sprite.y = (sprite as any)._originalShakeY;
    sprite.position.set(
      sprite.position.x - sprite.width / 2,
      sprite.position.y - sprite.height / 2
    );
    sprite.pivot.set(0, 0);
    delete (sprite as any)._originalShakeX;
    delete (sprite as any)._originalShakeY;
  },
  duration: 400,
});

EffectManager.registerEffect('attack', {
  apply: (sprite: PIXI.Sprite) => {
    (sprite as any)._originalAttackX = sprite.x;
  },
  update: (sprite: PIXI.Sprite, progress: number) => {
    const forwardDistance = 20;
    const originalX = (sprite as any)._originalAttackX;

    if (progress < 0.5) {
      sprite.x = originalX + forwardDistance * (progress * 2);
    } else {
      sprite.x = originalX + forwardDistance * (2 - progress * 2);
    }
  },
  complete: (sprite: PIXI.Sprite) => {
    sprite.x = (sprite as any)._originalAttackX;
    delete (sprite as any)._originalAttackX;
  },
  duration: 300,
});
