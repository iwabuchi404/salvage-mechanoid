import * as PIXI from 'pixi.js';
import { CharacterBase } from './CharacterBase';
import { Direction } from './types';

export class Character extends CharacterBase {
  private stats: { [key: string]: number };
  private actions: string[];
  private equipment: { [key: string]: string };
  private items: string[];

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

  public setClickHandler(handler: () => void) {
    this.sprite.eventMode = 'static';
    this.sprite.onmousedown = () => {
      console.log('onclick');
      console.log(handler);
      handler();
    };
  }
}
