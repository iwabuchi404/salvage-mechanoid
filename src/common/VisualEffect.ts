import * as PIXI from 'pixi.js';

class Particle extends PIXI.Graphics {
  private vx: number;
  private vy: number;
  private radius: number;
  private color: number;
  private decay: number;

  constructor(explosionSize: number) {
    super();
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * explosionSize * 0.2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.alpha = 1;
    this.radius = Math.random() * explosionSize * 0.05 + explosionSize * 0.02;
    this.color = this.getRandomRedOrangeColor();
    this.decay = Math.random() * 0.02 + 0.02;
    this.draw();
  }

  private getRandomRedOrangeColor(): number {
    const r = Math.floor(Math.random() * 56) + 200; // 200-255
    const g = Math.floor(Math.random() * 150); // 0-150
    const b = 0;
    return (r << 16) | (g << 8) | b;
  }

  private draw(): void {
    this.clear();
    this.beginFill(this.color);
    this.drawCircle(0, 0, this.radius);
    this.endFill();
  }

  public update(): boolean {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
    this.radius *= 0.99;
    this.draw();
    return this.alpha > 0;
  }
}

class Explosion extends PIXI.Container {
  private particles: Particle[];
  private isCompleted = false;
  private explosionSize: number;

  constructor(explosionSize: number, particleCount = 60) {
    super();
    this.explosionSize = explosionSize;
    this.particles = [];
    for (let i = 0; i < particleCount; i++) {
      const particle = new Particle(this.explosionSize);
      this.particles.push(particle);
      this.addChild(particle);
    }
  }

  public update(): boolean {
    if (this.isCompleted) return false;

    this.particles = this.particles.filter((particle) => {
      const alive = particle.update();
      if (!alive) {
        this.removeChild(particle);
      }
      return alive;
    });

    if (this.particles.length === 0) {
      this.isCompleted = true;
    }

    return !this.isCompleted;
  }
}

// キャラクターの型定義
interface Character {
  x: number;
  y: number;
}

// キャラクターがやられたときに爆発アニメーションを含むコンテナを返す
export function onCharacterDestroyed(character: Character, explosionSize = 100): PIXI.Container {
  const explosionContainer = new PIXI.Container();
  const explosion = new Explosion(explosionSize);
  explosionContainer.addChild(explosion);
  explosionContainer.x = character.x;
  explosionContainer.y = character.y;

  function animate(): void {
    if (explosion.update()) {
      requestAnimationFrame(animate);
    } else {
      // アニメーション完了時の処理
      // explosionContainer.parent?.removeChild(explosionContainer);
    }
  }
  animate();

  return explosionContainer;
}
