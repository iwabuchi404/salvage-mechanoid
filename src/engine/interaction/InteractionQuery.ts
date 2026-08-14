import { Entity } from '../entity/Entity';
import { TransformComponent } from '../entity/components/Transform';
import { InteractableComponent } from '../entity/components/Interactable';

/**
 * Interaction 候補抽出を純粋関数として切り出したモジュール。
 *
 * 「指定位置でインタラクション可能な Entity はどれか」「指定タイル位置に
 * どの Entity があるか」といった候補抽出だけを担当し、効果実行
 * （InteractableComponent.interact() の呼び出し）は行わない。
 *
 * これにより、候補抽出ロジックをシステム初期化なしで単体テストできる。
 */

/** 3次元位置 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * インタラクション候補。
 * 候補抽出時点では効果を実行せず、実行可否と位置情報だけを保持する。
 */
export interface InteractionCandidate {
  entityId: string;
  position: Position3D;
  canInteract: boolean;
}

/** インタラクション候補を検索する距離条件 */
export interface InteractionQueryOptions {
  /** 候補に含める最小マンハッタン距離（同一マスは 0、隣接だけなら 1） */
  minRange?: number;
  /** 候補に含める最大マンハッタン距離（既定は同一マスだけを表す 0） */
  maxRange?: number;
}

/**
 * 指定位置と一致するインタラクション候補を抽出する。
 *
 * event_object タグを持ち、Transform・Interactable を保持し、
 * active で、指定したマンハッタン距離の範囲内にある Entity を候補として返す。
 * z 座標（階層内の高さ）は常に一致する必要がある。
 * canInteract フラグは候補抽出時点での状態を反映する。
 *
 * 効果実行は呼び出し側（InteractionExecutor）が行う。
 */
export function findInteractionCandidates(
  entities: readonly Entity[],
  position: Position3D,
  options: InteractionQueryOptions = {}
): InteractionCandidate[] {
  const candidates: InteractionCandidate[] = [];
  const minRange = Math.max(0, options.minRange ?? 0);
  const maxRange = Math.max(minRange, options.maxRange ?? 0);

  for (const entity of entities) {
    if (!entity.active) continue;
    if (!entity.hasTag('event_object')) continue;

    const transform = entity.getComponent<TransformComponent>('transform');
    const interactable = entity.getComponent<InteractableComponent>('interactable');
    if (!transform || !interactable) continue;

    const pos = transform.position;
    if (pos.z !== position.z) continue;

    const distance = Math.abs(pos.x - position.x) + Math.abs(pos.y - position.y);
    if (distance < minRange || distance > maxRange) continue;

    candidates.push({
      entityId: entity.id,
      position: { x: pos.x, y: pos.y, z: pos.z },
      canInteract: interactable.canInteract(),
    });
  }

  return candidates;
}

/**
 * 指定タイル座標に存在する Entity を検索する。
 *
 * クリック時のエンティティ選択などで使用する。
 * Transform を持つ Entity のうち、タイル座標（四捨五入）が一致する
 * 最初の Entity を返す。
 */
export function findEntityAtTilePosition(
  entities: readonly Entity[],
  x: number,
  y: number
): Entity | null {
  for (const entity of entities) {
    const transform = entity.getComponent<TransformComponent>('transform');
    if (!transform) continue;

    const pos = transform.position;
    if (Math.round(pos.x) === x && Math.round(pos.y) === y) {
      return entity;
    }
  }
  return null;
}

/**
 * インタラクション候補のうち、実行可能なものを先頭に並べ替える。
 *
 * 実行可能（canInteract === true）な候補を優先し、
 * そうでない候補は後ろに維持する。順序は安定ソート。
 */
export function prioritizeExecutable(
  candidates: readonly InteractionCandidate[]
): InteractionCandidate[] {
  const executable = candidates.filter((c) => c.canInteract);
  const notExecutable = candidates.filter((c) => !c.canInteract);
  return [...executable, ...notExecutable];
}
