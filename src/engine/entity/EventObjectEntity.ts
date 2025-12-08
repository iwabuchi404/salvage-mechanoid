import { Entity } from './Entity';
import { TransformComponent } from './components/Transform';
import { SpriteComponent } from './components/Sprite';
import { InteractableComponent } from './components/Interactable';
import { Vector3 } from '../types';

/**
 * イベントオブジェクトエンティティ
 * ポータル、チャージャー、トラップなどのインタラクション可能なオブジェクト
 */
export class EventObjectEntity extends Entity {
  /**
   * コンストラクタ
   * @param id エンティティID
   * @param position 位置
   * @param texturePath テクスチャパス
   * @param onInteract インタラクション時のコールバック
   * @param hasCollision 衝突判定があるか（デフォルト: false）
   * @param oneTimeUse 一度だけ使用可能か（デフォルト: false）
   * @param maxUses 最大使用回数（デフォルト: 無制限）
   */
  constructor(
    id: string,
    position: Vector3,
    texturePath: string,
    onInteract: (playerId: string) => void,
    hasCollision = false,
    oneTimeUse = false,
    maxUses = Infinity
  ) {
    super(id, 'event_object');

    // タグを追加
    this.addTag('event_object');
    if (!hasCollision) {
      this.addTag('no_collision');
    }

    // Transform コンポーネント
    this.addComponent(new TransformComponent(position.x, position.y, position.z));

    // Sprite コンポーネント（後で初期化）
    const spriteComponent = new SpriteComponent(texturePath, 'objects', { x: 0.5, y: 0.8 });
    this.addComponent(spriteComponent);

    // Interactable コンポーネント
    this.addComponent(new InteractableComponent(onInteract, oneTimeUse, maxUses));
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    // 親クラスの initialize() を呼び出してコンポーネントを初期化
    await super.initialize();

    console.log(`EventObjectEntity initialized: ${this.id}`);
  }
}

/**
 * ポータルエンティティを作成
 * @param id エンティティID
 * @param position 位置
 * @param onActivate ポータル起動時のコールバック
 * @returns ポータルエンティティ
 */
export function createPortal(
  id: string,
  position: Vector3,
  onActivate: (playerId: string) => void
): EventObjectEntity {
  return new EventObjectEntity(
    id,
    position,
    './obj02.png',
    onActivate,
    false, // 衝突判定なし
    false, // 何度でも使用可能
    Infinity
  );
}

/**
 * エネルギーチャージャーエンティティを作成
 * @param id エンティティID
 * @param position 位置
 * @param chargeAmount チャージ量
 * @param maxUses 最大使用回数
 * @param onCharge チャージ時のコールバック
 * @returns チャージャーエンティティ
 */
export function createEnergyCharger(
  id: string,
  position: Vector3,
  chargeAmount: number,
  maxUses: number,
  onCharge: (playerId: string) => void
): EventObjectEntity {
  return new EventObjectEntity(
    id,
    position,
    './obj01.png',
    onCharge,
    false, // 衝突判定なし
    false, // 複数回使用可能
    maxUses
  );
}
