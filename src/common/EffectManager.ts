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

  static async applyEffect(sprite: PIXI.Sprite, effectName: string): Promise<void> {
    const effect = this.getEffect(effectName);
    if (effect) {
      console.log(`エフェクト適用: ${effectName}, スプライト位置: (${sprite.x}, ${sprite.y})`);

      // 元の位置を保存（まだ保存されていない場合）
      if (!(sprite as any)._effectOriginalPosition) {
        (sprite as any)._effectOriginalPosition = sprite.position.clone();
      }

      effect.apply(sprite);

      if (!this.activeEffects.has(sprite)) {
        this.activeEffects.set(sprite, []);
      }
      this.activeEffects.get(sprite)!.push({ effect, startTime: Date.now() });

      if (effect.update) {
        this.startUpdateLoop();
      }

      return new Promise((resolve) => {
        setTimeout(() => {
          if (effect.complete) {
            effect.complete(sprite);
          }
          console.log(`エフェクト完了: ${effectName}, スプライト位置: (${sprite.x}, ${sprite.y})`);

          const activeEffectsForSprite = this.activeEffects.get(sprite);
          if (activeEffectsForSprite) {
            const index = activeEffectsForSprite.findIndex((e) => e.effect === effect);
            if (index !== -1) {
              activeEffectsForSprite.splice(index, 1);
            }
            if (activeEffectsForSprite.length === 0) {
              this.activeEffects.delete(sprite);
              // すべてのエフェクトが完了したら元の位置に戻す
              sprite.position.copyFrom((sprite as any)._effectOriginalPosition);
              delete (sprite as any)._effectOriginalPosition;
            }
          }
          resolve();
        }, effect.duration);
      });
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
  },
  update: (sprite: PIXI.Sprite, progress: number) => {
    const amplitude = 10; // 最大シェイク距離（ピクセル）
    const frequency = 30; // 1秒あたりのシェイク回数
    const shake = Math.sin(progress * Math.PI * frequency) * amplitude * (1 - progress);
    sprite.position.set(
      (sprite as any)._effectOriginalPosition.x + shake,
      (sprite as any)._effectOriginalPosition.y + shake
    );
  },
  duration: 200,
  complete: (sprite: PIXI.Sprite) => {
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
    //
  },
  update: (sprite: PIXI.Sprite, progress: number) => {
    const amplitude = 10;
    const frequency = 50;
    const shake = Math.sin(progress * Math.PI * frequency) * amplitude * (1 - progress);
    sprite.x = (sprite as any)._effectOriginalPosition.x + shake;
    sprite.y = (sprite as any)._effectOriginalPosition.y + shake;
  },
  complete: (sprite: PIXI.Sprite) => {
    //
  },
  duration: 400,
});

EffectManager.registerEffect('attack', {
  apply: (sprite: PIXI.Sprite) => {
    //
  },
  update: (sprite: PIXI.Sprite, progress: number) => {
    const forwardDistance = 20;
    const originalX = (sprite as any)._effectOriginalPosition.x;

    if (progress < 0.5) {
      sprite.x = originalX + forwardDistance * (progress * 2);
    } else {
      sprite.x = originalX + forwardDistance * (2 - progress * 2);
    }
  },
  complete: (sprite: PIXI.Sprite) => {
    //
  },
  duration: 300,
});
