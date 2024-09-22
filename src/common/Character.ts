import * as PIXI from 'pixi.js';
import { CharacterBase } from './CharacterBase';
import { Direction } from './types';

export class Character extends CharacterBase {
  private stats: { [key: string]: number };
  private actions: string[];
  private equipment: { [key: string]: string };
  private items: string[];
  private maxEnergy: number;
  private currentEnergy: number;

  constructor(
    id: string,
    name: string,
    textureUrls: { [key: string]: string },
    center?: { x: number; y: number }
  ) {
    super(id, name, textureUrls, center);

    this.stats = {};
    this.actions = [];
    this.equipment = {};
    this.items = [];
    this.status = {
      level: 1,
      hp: 100,
      maxHp: 100,
      mp: 50,
      maxMp: 50,
      strength: 10,
      defense: 5,
    };
    this.maxEnergy = 100;
    this.currentEnergy = this.maxEnergy;
  }

  public setStat(key: string, value: number) {
    this.stats[key] = value;
  }

  public getStat(key: string): number {
    return this.stats[key] || 0;
  }

  public addAction(action: string) {
    this.actions.push(action);
  }

  public getActions(): string[] {
    return this.actions;
  }

  public equip(slot: string, item: string) {
    this.equipment[slot] = item;
  }
  public getEquipment(): { [key: string]: string } {
    return this.equipment;
  }

  public addItem(item: string) {
    this.items.push(item);
  }

  public getItems(): string[] {
    return this.items;
  }

  public getStatus(): typeof this.status {
    return { ...this.status };
  }
  public getEnergy(): number {
    return this.currentEnergy;
  }

  public getMaxEnergy(): number {
    return this.maxEnergy;
  }

  public consumeEnergy(amount: number): boolean {
    if (this.currentEnergy >= amount) {
      this.currentEnergy -= amount;
      this.updateEnergyEffects();
      return true;
    }
    return false;
  }

  private updateEnergyEffects(): void {
    const energyPercentage = (this.currentEnergy / this.maxEnergy) * 100;

    if (energyPercentage >= 75) {
      // 通常状態
    } else if (energyPercentage >= 50) {
      // スキャン範囲減少
    } else if (energyPercentage >= 25) {
      // 移動速度と攻撃力低下
    } else if (energyPercentage > 0) {
      // クリティカルモード
    } else {
      // 緊急シャットダウン
    }
  }

  public restoreEnergy(amount: number): void {
    this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + amount);
    this.updateEnergyEffects();
  }

  public move(targetX: number, targetY: number, targetZ: number, duration = 200): Promise<void> {
    if (this.consumeEnergy(1)) {
      return super.move(targetX, targetY, targetZ, duration);
    }
    return Promise.resolve();
  }

  public async attack(): Promise<number> {
    if (this.consumeEnergy(2)) {
      return super.attack();
    }
    return 0;
  }

  public setClickHandler(handler: () => void) {
    this.sprite.eventMode = 'static';
    this.sprite.onmousedown = () => {
      console.log('onclick');
      console.log(handler);
      handler();
    };
  }
}
