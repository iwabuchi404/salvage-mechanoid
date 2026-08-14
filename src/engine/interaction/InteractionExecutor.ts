import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { Entity } from '../entity/Entity';
import { InteractableComponent } from '../entity/components/Interactable';
import { TransformComponent } from '../entity/components/Transform';
import {
  findInteractionCandidates,
  prioritizeExecutable,
  InteractionCandidate,
  Position3D,
} from './InteractionQuery';

/**
 * Interaction の効果実行を担当するモジュール。
 *
 * InteractionQuery が抽出した候補に対して InteractableComponent.interact()
 * を呼び出し、成功時に interaction_completed イベントを発行する。
 *
 * 候補抽出（どの Entity が対象か）と効果実行（interact() を呼ぶ）を
 * 分離することで、候補抽出ロジックを副作用なしでテストできるようにする。
 */
export class InteractionExecutor {
  constructor(
    private readonly entitySystem: EntitySystem,
    private readonly eventSystem: EventSystem
  ) {}

  /**
   * 単一候補に対してインタラクションを実行する。
   *
   * 候補の canInteract が false の場合は実行せず false を返す。
   * 実行成功時に interaction_completed イベントを発行する。
   *
   * @param candidate インタラクション候補
   * @param playerId プレイヤーID
   * @returns 実行成功時に true
   */
  execute(candidate: InteractionCandidate, playerId: string): boolean {
    if (!candidate.canInteract) return false;

    const entity = this.entitySystem.getEntity(candidate.entityId);
    if (!entity || !entity.active) return false;

    const interactable = entity.getComponent<InteractableComponent>('interactable');
    if (!interactable || !interactable.canInteract()) return false;

    const success = interactable.interact(playerId);
    if (success) {
      this.eventSystem.emit('interaction_completed', {
        playerId,
        objectId: candidate.entityId,
        position: candidate.position,
      });
    }
    return success;
  }

  /**
   * 候補リストに対して順番にインタラクションを実行する。
   *
   * 最初に成功した候補で打ち切る。全候補失敗時は false を返す。
   *
   * @param candidates インタラクション候補リスト
   * @param playerId プレイヤーID
   * @returns いずれかの候補で成功した場合に true
   */
  executeAll(candidates: readonly InteractionCandidate[], playerId: string): boolean {
    for (const candidate of candidates) {
      if (this.execute(candidate, playerId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 指定位置の候補を抽出して実行する。
   *
   * InteractionQuery.findInteractionCandidates で候補を抽出し、
   * 実行可能な候補を優先して実行する。
   * 候補抽出と効果実行を1メソッドで完結させる利便用API。
   *
   * @param entities 検索対象の Entity 配列
   * @param position プレイヤー位置
   * @param playerId プレイヤーID
   * @returns 実行成功時に true
   */
  executeAtPosition(entities: readonly Entity[], position: Position3D, playerId: string): boolean {
    const candidates = prioritizeExecutable(findInteractionCandidates(entities, position));
    return this.executeAll(candidates, playerId);
  }

  /**
   * オブジェクトIDを直接指定してインタラクションを実行する。
   *
   * 手動トリガー（triggerInteraction）用のAPI。
   * 候補抽出を経由せず、指定IDの Entity に対して直接実行する。
   *
   * @param objectId オブジェクトID
   * @param playerId プレイヤーID
   * @returns 実行成功時に true
   */
  executeById(objectId: string, playerId: string): boolean {
    const entity = this.entitySystem.getEntity(objectId);
    if (!entity || !entity.active) return false;

    const interactable = entity.getComponent<InteractableComponent>('interactable');
    if (!interactable || !interactable.canInteract()) return false;

    const success = interactable.interact(playerId);
    if (success) {
      const transform = entity.getComponent<TransformComponent>('transform');
      this.eventSystem.emit('interaction_completed', {
        playerId,
        objectId,
        position: transform ? transform.position : { x: 0, y: 0, z: 0 },
      });
    }
    return success;
  }
}
