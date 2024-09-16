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
  },
  update: (sprite: PIXI.Sprite, progress: number) => {
    const amplitude = 10; // Maximum shake distance in pixels
    const frequency = 50; // Number of shakes per second
    const shake = Math.sin(progress * Math.PI * frequency) * amplitude * (1 - progress);
    sprite.x += shake;
    sprite.y += shake;
  },
  complete: (sprite: PIXI.Sprite) => {
    sprite.position.set(
      sprite.position.x - sprite.width / 2,
      sprite.position.y - sprite.height / 2
    );
    sprite.pivot.set(0, 0);
  },
  duration: 400, // Shake duration in milliseconds
});

EffectManager.registerEffect('attack', {
  apply: (sprite: PIXI.Sprite) => {
    // スプライトに元の位置を保存するプロパティを追加
    (sprite as any)._originalX = sprite.x;
  },
  update: (sprite: PIXI.Sprite, progress: number) => {
    const forwardDistance = 20; // 前方への移動距離（ピクセル）
    const originalX = (sprite as any)._originalX;

    if (progress < 0.5) {
      // 前半：前方に素早く移動
      sprite.x = originalX + forwardDistance * (progress * 2);
    } else {
      // 後半：元の位置にゆっくり戻る
      sprite.x = originalX + forwardDistance * (2 - progress * 2);
    }
  },
  complete: (sprite: PIXI.Sprite) => {
    sprite.x = (sprite as any)._originalX;
    delete (sprite as any)._originalX;
  },
  duration: 300, // アニメーションの持続時間（ミリ秒）
});
