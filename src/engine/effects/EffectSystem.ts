import { System } from '../System';
import { Engine } from '../Engine';
import { EffectManager } from '../../common/EffectManager';
import { onCharacterDestroyed } from '../../common/VisualEffect';
import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { RendererSystem } from '../graphics/RendererSystem';
import { SpriteComponent } from '../entity/components/Sprite';
import { TransformComponent } from '../entity/components/Transform';
import { CoordinateSystem } from '../graphics/CoordinateSystem';
import { LayerName } from '../types';
import * as PIXI from 'pixi.js';

/**
 * エフェクトシステム - 旧EffectManagerをECSに統合
 * ビジュアルエフェクト（ダメージ、回復、爆発など）を管理
 */
export class EffectSystem implements System {
  // エンジンへの参照
  private engine: Engine | null = null;

  // イベントシステムへの参照
  private eventSystem: EventSystem | null = null;

  // エンティティシステムへの参照
  private entitySystem: EntitySystem | null = null;

  // レンダラーシステムへの参照
  private rendererSystem: RendererSystem | null = null;

  // 座標変換システム
  private coordinateSystem: CoordinateSystem;

  /**
   * コンストラクタ
   */
  constructor() {
    this.coordinateSystem = new CoordinateSystem(160, 120);
  }

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    this.entitySystem = engine.getSystem<EntitySystem>('entity') || null;
    this.rendererSystem = engine.getSystem<RendererSystem>('renderer') || null;

    // イベントリスナーを設定
    this.setupEventListeners();

    console.log('EffectSystem initialized');
  }

  /**
   * 毎フレームの更新処理
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    // EffectManagerの更新は内部で自動的に行われる（requestAnimationFrame）
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) {
      console.warn('EventSystem not found, effect events will not be processed');
      return;
    }

    // ダメージエフェクト
    this.eventSystem.on('damage_taken', (data) => {
      console.log('Playing damage effect for:', data.entityId);
      this.playDamageEffect(data.entityId);
    });

    // 回復エフェクト
    this.eventSystem.on('health_recovered', (data) => {
      console.log('Playing heal effect for:', data.entityId);
      this.playHealEffect(data.entityId);
    });

    // 爆発エフェクト
    this.eventSystem.on('enemy_destroyed', (data) => {
      console.log('[EffectSystem] enemy_destroyed event received:', data);
      if (data && data.position) {
        console.log('[EffectSystem] Calling playExplosionEffect with:', data.position);
        this.playExplosionEffect(data.position);
      } else {
        console.warn('[EffectSystem] enemy_destroyed has no position:', data);
      }
    });

    // 攻撃エフェクト
    this.eventSystem.on('attack_performed', (data) => {
      console.log('Playing attack effect for:', data.entityId);
      this.playAttackEffect(data.entityId);
    });

    // シェイクエフェクト（オプション）
    this.eventSystem.on('shake_requested', (data) => {
      console.log('Playing shake effect for:', data.entityId);
      this.playShakeEffect(data.entityId);
    });

    console.log('EffectSystem event listeners registered');
  }

  /**
   * ダメージエフェクトを再生
   * @param entityId エンティティID
   */
  async playDamageEffect(entityId: string): Promise<void> {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) {
      console.warn(`Entity not found: ${entityId}`);
      return;
    }

    const spriteComponent = entity.getComponent<SpriteComponent>('sprite');
    if (!spriteComponent) {
      console.warn(`SpriteComponent not found for entity: ${entityId}`);
      return;
    }

    const sprite = spriteComponent.getSprite();
    if (sprite) {
      // 既存のEffectManagerを使用
      await EffectManager.applyEffect(sprite, 'damage');
      console.log(`Damage effect applied to entity: ${entityId}`);
    }
  }

  /**
   * 回復エフェクトを再生
   * @param entityId エンティティID
   */
  async playHealEffect(entityId: string): Promise<void> {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) {
      console.warn(`Entity not found: ${entityId}`);
      return;
    }

    const spriteComponent = entity.getComponent<SpriteComponent>('sprite');
    if (!spriteComponent) {
      console.warn(`SpriteComponent not found for entity: ${entityId}`);
      return;
    }

    const sprite = spriteComponent.getSprite();
    if (sprite) {
      await EffectManager.applyEffect(sprite, 'heal');
      console.log(`Heal effect applied to entity: ${entityId}`);
    }
  }

  /**
   * 攻撃エフェクトを再生
   * @param entityId エンティティID
   */
  async playAttackEffect(entityId: string): Promise<void> {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) {
      console.warn(`Entity not found: ${entityId}`);
      return;
    }

    const spriteComponent = entity.getComponent<SpriteComponent>('sprite');
    if (!spriteComponent) {
      console.warn(`SpriteComponent not found for entity: ${entityId}`);
      return;
    }

    const sprite = spriteComponent.getSprite();
    if (sprite) {
      await EffectManager.applyEffect(sprite, 'attack');
      console.log(`Attack effect applied to entity: ${entityId}`);
    }
  }

  /**
   * シェイクエフェクトを再生
   * @param entityId エンティティID
   */
  async playShakeEffect(entityId: string): Promise<void> {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) {
      console.warn(`Entity not found: ${entityId}`);
      return;
    }

    const spriteComponent = entity.getComponent<SpriteComponent>('sprite');
    if (!spriteComponent) {
      console.warn(`SpriteComponent not found for entity: ${entityId}`);
      return;
    }

    const sprite = spriteComponent.getSprite();
    if (sprite) {
      await EffectManager.applyEffect(sprite, 'shake');
      console.log(`Shake effect applied to entity: ${entityId}`);
    }
  }

  /**
   * 爆発エフェクトを再生
   * @param position 爆発位置（グリッド座標）
   */
  playExplosionEffect(position: { x: number; y: number; z?: number }): void {
    if (!this.rendererSystem) {
      console.warn('RendererSystem not found, cannot play explosion effect');
      return;
    }

    // RendererSystemの座標変換システムを使用
    const coordSystem = this.rendererSystem.getCoordinateSystem();
    const camera = this.rendererSystem.getCamera();

    // グリッド座標をスクリーン座標に変換
    const screenPos = coordSystem.isometricToScreen(position.x, position.y, position.z || 0);

    // カメラオフセットを適用した表示座標を計算
    const displayX = screenPos.x - camera.x;
    const displayY = screenPos.y - camera.y;

    console.log(
      `Explosion: grid(${position.x}, ${position.y}) -> display(${displayX}, ${displayY})`
    );

    // 爆発コンテナを作成（カメラオフセット適用済み座標で配置）
    const explosionContainer = onCharacterDestroyed({ x: displayX, y: displayY }, 60);

    // カメラ追従用のベース座標を保存（RendererSystemと同じ方式）
    (explosionContainer as any).__baseScreenX = screenPos.x;
    (explosionContainer as any).__baseScreenY = screenPos.y;

    // EFFECTSレイヤーに追加（カメラ追従対応）
    const effectsLayer = this.rendererSystem.getLayer(LayerName.EFFECTS);
    if (effectsLayer) {
      effectsLayer.addChild(explosionContainer);
      console.log(`Explosion effect added to EFFECTS layer at display(${displayX}, ${displayY})`);

      // 一定時間後に削除（パーティクルが消えた後）
      setTimeout(() => {
        if (explosionContainer.parent) {
          explosionContainer.parent.removeChild(explosionContainer);
        }
      }, 3000);
    } else {
      console.warn('EFFECTS layer not found');
    }
  }

  /**
   * カスタムエフェクトを登録
   * @param name エフェクト名
   * @param effect エフェクト定義
   */
  registerEffect(name: string, effect: any): void {
    EffectManager.registerEffect(name, effect);
    console.log(`Custom effect registered: ${name}`);
  }
}
