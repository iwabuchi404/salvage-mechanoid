// src/SoundManager.ts

import * as PIXI from 'pixi.js';
import { sound, IMediaInstance } from '@pixi/sound';

export class SoundManager {
  private static instance: SoundManager;
  private backgroundMusic: IMediaInstance | null = null;

  private constructor() {
    //コンストラクター
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  public loadSounds(): void {
    //bgm読み込み
    sound.add('bgm01', 'sound/bgm01.mp3');
    sound.add('bgm02', 'sound/bgm02.mp3');
    sound.add('bgm03', 'sound/bgm03.mp3');

    //se読み込み
    sound.add('attack', 'sound/se_attack.mp3');
    sound.add('explosion', 'sound/explosion.mp3');
  }

  public async playBGM(key: string): Promise<void> {
    if (this.backgroundMusic) {
      this.backgroundMusic.stop();
    }
    this.backgroundMusic = await sound.play(key, { loop: true, volume: 0.2 });
  }

  public stopBGM(): void {
    if (this.backgroundMusic) {
      this.backgroundMusic.stop();
      this.backgroundMusic = null;
    }
  }

  public async playSE(key: string): Promise<void> {
    await sound.play(key, { volume: 0.2 });
  }

  public setVolume(volume: number): void {
    sound.volumeAll = volume;
  }

  public mute(): void {
    sound.muteAll();
  }

  public unmute(): void {
    sound.unmuteAll();
  }
}
