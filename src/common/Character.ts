import * as PIXI from 'pixi.js';
import { CharacterBase } from './CharacterBase';
import { Direction } from './types';
import { useGameStore } from '../stores/gameStore';

export class Character extends CharacterBase {
  private stats: { [key: string]: number };
  private actions: string[];
  private equipment: { [key: string]: string };
  private items: string[];
  private maxEnergy: number;
  private currentEnergy: number;
  private gameStore = useGameStore();

  constructor(
    id: string,
    name: string,
    textureUrls: { [key: string]: string },
    center?: { x: number; y: number }
  ) {
    super(id, name, textureUrls, center);

    this.position = this.gameStore.player.position;
    this.stats = {};
    this.actions = [];
    this.equipment = {};
    this.items = this.gameStore.player.items;
    this.status = this.gameStore.player.status;
    this.maxEnergy = 100;
    this.currentEnergy = this.maxEnergy;
  }

  public getPosition(): { x: number; y: number; z: number } {
    return { ...this.gameStore.player.position };
  }

  public setPosition(x: number, y: number, z: number): void {
    this.position = { x, y, z };
    this.gameStore.player.position = { x, y, z };
    // this.updateSpritePosition();
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
    this.gameStore.player.items.push(item);
  }

  public getItems(): string[] {
    return this.gameStore.player.items;
  }

  public getStatus(): typeof this.status {
    return { ...this.gameStore.player.status };
  }
  public getEnergy(): number {
    return this.gameStore.player.status.energy;
  }

  public getMaxEnergy(): number {
    return this.gameStore.player.status.maxEnergy;
  }

  public consumeEnergy(amount: number): boolean {
    if (this.getEnergy() >= amount) {
      this.gameStore.player.status.energy -= amount;
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
    this.gameStore.player.status.energy = Math.min(
      this.gameStore.player.status.maxEnergy,
      this.gameStore.player.status.energy + amount
    );
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
      handler();
    };
  }
}
