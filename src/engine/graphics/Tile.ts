import * as PIXI from 'pixi.js';
import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';

// タイルのタイプを表す列挙型
export enum TileType {
  EMPTY = 0,
  GRASS = 1,
  WATER = 2,
  MOUNTAIN = 3,
  TILE = 4,
  PORTAL = 5,
  DAMAGE = 6,
  HEAL = 7,
  EVENT = 8,
}

// タイルの情報を表す型
export interface TileInfo {
  name: string;
  effect: string;
  walkable: boolean;
  statModifier: { [key: string]: number };
  textureKey: string;
}

// タイルタイプごとの情報マップ
export const TileInfoMap: Record<TileType, TileInfo> = {
  [TileType.EMPTY]: {
    name: 'Empty',
    effect: 'Impassable',
    walkable: false,
    statModifier: {},
    textureKey: 'empty',
  },
  [TileType.GRASS]: {
    name: 'Grass',
    effect: 'Normal terrain',
    walkable: true,
    statModifier: {},
    textureKey: 'grass',
  },
  [TileType.WATER]: {
    name: 'Water',
    effect: 'Slows movement',
    walkable: true,
    statModifier: { speed: -1 },
    textureKey: 'water',
  },
  [TileType.MOUNTAIN]: {
    name: 'Mountain',
    effect: 'Increases defense',
    walkable: false,
    statModifier: { defense: 1 },
    textureKey: 'mountain',
  },
  [TileType.TILE]: {
    name: 'Tile',
    effect: 'Increases defense',
    walkable: true,
    statModifier: {},
    textureKey: 'tile',
  },
  [TileType.PORTAL]: {
    name: 'Portal',
    effect: 'Teleports to another location',
    walkable: true,
    statModifier: {},
    textureKey: 'portal',
  },
  [TileType.DAMAGE]: {
    name: 'Damage Tile',
    effect: 'Damages entities',
    walkable: true,
    statModifier: { hp: -5 },
    textureKey: 'damage',
  },
  [TileType.HEAL]: {
    name: 'Healing Tile',
    effect: 'Heals entities',
    walkable: true,
    statModifier: { hp: 5 },
    textureKey: 'heal',
  },
  [TileType.EVENT]: {
    name: 'Event Tile',
    effect: 'Triggers an event',
    walkable: true,
    statModifier: {},
    textureKey: 'event',
  },
};

export class Tile {
  // タイルの基本属性
  public readonly type: TileType;
  public readonly position: { x: number; y: number; z: number };

  // 表示関連
  public sprite: PIXI.Sprite | null = null;
  public overlay: PIXI.Graphics | null = null;

  // 状態フラグ
  public explored = false;
  public visible = false;
  public selected = false;
  public highlighted = false;

  // カスタムプロパティ（イベントなど）
  private properties: Map<string, any> = new Map();

  /**
   * タイルコンストラクタ
   * @param type タイルタイプ
   * @param x X座標
   * @param y Y座標
   * @param z Z座標（高さ）
   */
  constructor(type: TileType, x: number, y: number, z: number) {
    this.type = type;
    this.position = { x, y, z };
  }

  /**
   * このタイルが通行可能かを返す
   */
  public get walkable(): boolean {
    return TileInfoMap[this.type].walkable;
  }

  /**
   * タイルの情報を取得
   */
  public get info(): TileInfo {
    return TileInfoMap[this.type];
  }

  /**
   * スプライトを設定する
   * @param sprite PIXIスプライト
   */
  public setSprite(sprite: PIXI.Sprite): void {
    this.sprite = sprite;
    this.updateVisuals();
  }

  /**
   * オーバーレイを設定する
   * @param overlay PIXIグラフィックスオブジェクト
   */
  public setOverlay(overlay: PIXI.Graphics): void {
    this.overlay = overlay;
    this.updateVisuals();
  }

  /**
   * タイルの可視性を設定
   * @param visible 可視フラグ
   */
  public setVisible(visible: boolean): void {
    if (this.visible !== visible) {
      this.visible = visible;

      if (visible && !this.explored) {
        this.explored = true;

        // 初めて探索されたことをイベントで通知
        const eventSystem = Engine.instance.getSystem<EventSystem>('event');
        if (eventSystem) {
          eventSystem.emit('tile_explored', {
            position: this.position,
            type: this.type,
          });
        }
      }

      this.updateVisuals();
    }
  }

  /**
   * タイルの選択状態を設定
   * @param selected 選択フラグ
   */
  public setSelected(selected: boolean): void {
    if (this.selected !== selected) {
      this.selected = selected;
      this.updateVisuals();
    }
  }

  /**
   * タイルのハイライト状態を設定
   * @param highlighted ハイライトフラグ
   * @param color ハイライトの色（16進数）
   */
  public setHighlighted(highlighted: boolean, color = 0xffffff): void {
    if (this.highlighted !== highlighted) {
      this.highlighted = highlighted;
      this.updateOverlay(highlighted ? color : null);
    }
  }

  /**
   * タイルのビジュアルを更新
   */
  private updateVisuals(): void {
    if (this.sprite) {
      // 可視性に基づいて表示/非表示を切り替え
      this.sprite.visible = this.visible;

      // 探索済みだが現在見えていない場合は暗く表示
      if (this.explored && !this.visible) {
        this.sprite.alpha = 0.5;
        this.sprite.tint = 0x888888;
      } else {
        this.sprite.alpha = 1.0;
        this.sprite.tint = 0xffffff;
      }
    }
  }

  /**
   * オーバーレイを更新（選択、ハイライトなど）
   */
  private updateOverlay(color: number | null = null): void {
    if (!this.overlay) return;

    // オーバーレイをクリア
    this.overlay.clear();

    if (this.selected) {
      // 選択時の表示
      this.drawOverlayEffect(0xffff00, 0.5);
    } else if (this.highlighted && color !== null) {
      // ハイライト時の表示
      this.drawOverlayEffect(color, 0.3);
    }
  }

  /**
   * オーバーレイエフェクトを描画
   */
  private drawOverlayEffect(color: number, alpha: number): void {
    if (!this.overlay) return;

    this.overlay.beginFill(color, alpha);
    // アイソメトリック形状を描画（例）
    this.overlay.moveTo(0, -20); // 上部
    this.overlay.lineTo(40, 0); // 右部
    this.overlay.lineTo(0, 20); // 下部
    this.overlay.lineTo(-40, 0); // 左部
    this.overlay.closePath();
    this.overlay.endFill();
  }

  /**
   * カスタムプロパティを設定
   * @param key プロパティキー
   * @param value プロパティ値
   */
  public setProperty(key: string, value: any): void {
    this.properties.set(key, value);
  }

  /**
   * カスタムプロパティを取得
   * @param key プロパティキー
   * @param defaultValue デフォルト値（プロパティが存在しない場合）
   */
  public getProperty<T>(key: string, defaultValue?: T): T | undefined {
    return this.properties.has(key) ? this.properties.get(key) : defaultValue;
  }

  /**
   * エンティティがこのタイルに入った時のイベント処理
   * @param entityId 入ったエンティティのID
   */
  public onEnter(entityId: string): void {
    // タイルタイプに応じた効果を適用
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (!eventSystem) return;

    switch (this.type) {
      case TileType.DAMAGE:
        // ダメージタイル効果
        eventSystem.emit('apply_tile_effect', {
          entityId,
          effect: 'damage',
          value: TileInfoMap[TileType.DAMAGE].statModifier.hp,
        });
        break;

      case TileType.HEAL:
        // 回復タイル効果
        eventSystem.emit('apply_tile_effect', {
          entityId,
          effect: 'heal',
          value: TileInfoMap[TileType.HEAL].statModifier.hp,
        });
        break;

      case TileType.PORTAL:
        // ポータルタイル効果
        // portal_activated は Game.ts のポータルコールバックで発行されるため、
        // ここでは発行しない（契約: { playerId, position }）
        break;

      case TileType.EVENT:
        // イベントタイル - 設定されたイベントを発行
        const eventName = this.getProperty<string>('eventName');
        if (eventName) {
          eventSystem.emit(eventName, {
            entityId,
            position: this.position,
            data: this.getProperty('eventData'),
          });
        }
        break;
    }

    // 汎用的なタイル進入イベント
    eventSystem.emit('tile_entered', {
      entityId,
      tilePosition: this.position,
      tileType: this.type,
    });
  }

  /**
   * エンティティがこのタイルから出た時のイベント処理
   * @param entityId 出たエンティティのID
   */
  public onExit(entityId: string): void {
    // タイルから出る時のイベント発行
    const eventSystem = Engine.instance.getSystem<EventSystem>('event');
    if (eventSystem) {
      eventSystem.emit('tile_exited', {
        entityId,
        position: this.position,
        type: this.type,
      });
    }
  }
}
