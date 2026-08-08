import { Component } from '../Component';
import { Entity } from '../Entity';

export interface EnergySnapshot {
  currentEnergy: number;
  maxEnergy: number;
}

/**
 * エネルギーの実行時状態を所有するコンポーネント。
 * ゲームロジックはこの値を正本とし、Piniaには表示用の値だけを投影する。
 */
export class EnergyComponent implements Component {
  type = 'energy';
  entity: Entity | null = null;

  private current: number;
  private maximum: number;

  constructor(maxEnergy: number, currentEnergy: number = maxEnergy) {
    this.maximum = Math.max(1, maxEnergy);
    this.current = Math.min(Math.max(0, currentEnergy), this.maximum);
  }

  initialize(): void {
    // 初期化時に外部システムへ接続する必要はない。
  }

  update(_deltaTime: number): void {
    // ターンや操作によって明示的に更新する。
  }

  get currentEnergy(): number {
    return this.current;
  }

  get maxEnergy(): number {
    return this.maximum;
  }

  get percentage(): number {
    return (this.current / this.maximum) * 100;
  }

  consume(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.current < amount) return false;

    this.current -= amount;
    return true;
  }

  restore(amount: number): number {
    if (amount <= 0) return 0;

    const previous = this.current;
    this.current = Math.min(this.current + amount, this.maximum);
    const restored = this.current - previous;

    return restored;
  }

  setMaxEnergy(maxEnergy: number): void {
    const nextMaximum = Math.max(1, maxEnergy);
    const nextCurrent = Math.min(this.current, nextMaximum);

    if (nextMaximum === this.maximum && nextCurrent === this.current) return;

    this.maximum = nextMaximum;
    this.current = nextCurrent;
  }

  createSnapshot(): EnergySnapshot {
    return {
      currentEnergy: this.current,
      maxEnergy: this.maximum,
    };
  }

  restoreSnapshot(snapshot: EnergySnapshot): void {
    const nextMaximum = Math.max(1, snapshot.maxEnergy);
    const nextCurrent = Math.min(Math.max(0, snapshot.currentEnergy), nextMaximum);

    this.maximum = nextMaximum;
    this.current = nextCurrent;
  }
}
