import { Vector3, Direction, TileType, StageType } from '../types';
import { Entity } from '../entity/Entity';
import { FloorGenerationRequest } from '../world/FloorManager';

/**
 * イベント名とペイロード型の対応表。
 *
 * ここが唯一のイベント契約の定義場所。
 * 新しいイベントを追加する場合は必ずここへ宣言する。
 *
 * 命名規則:
 * - 過去形（発生の通知）: move_completed, floor_changed, item_found ...
 * - *_requested（要求）: player_attack_requested, fov_update_requested ...
 * - 要求と通知を区別し、同名で両方の意味を持たせない
 */
export interface EventMap {
  // ===== Entity ライフサイクル =====
  entity_created: { entity: Entity };
  entity_destroyed: { entity: Entity };
  entity_moved: {
    entityId: string;
    from: Vector3;
    to: Vector3;
    position: Vector3;
  };
  entity_died: { entityId: string };
  entity_damaged: {
    entityId: string;
    damage: number;
    currentHp: number;
    maxHp: number;
  };
  entity_healed: {
    entityId: string;
    heal: number;
    currentHp: number;
    maxHp: number;
  };
  health_changed: {
    entityId: string;
    currentHp: number;
    maxHp: number;
    percentage: number;
  };
  entity_visibility_changed: { entityId: string; inFOV: boolean };
  enemy_destroyed: { entityId: string; position: Vector3 };

  // ===== 移動 =====
  move_started: {
    entityId: string;
    from: Vector3;
    to: Vector3;
    direction: Direction;
  };
  move_completed: {
    entityId: string;
    position: Vector3;
    direction: Direction;
  };
  direction_changed: { entityId: string; direction: Direction };

  // ===== 戦闘 =====
  player_attack_requested: { playerId: string };
  enemy_attack_requested: { enemyId: string; targetId: string };
  attack_performed: { entityId: string };
  player_attack: Record<string, never>;
  player_attacked: {
    attackerId: string;
    position: Vector3;
    power: number;
  };
  damage_taken: { entityId: string; damage: number; attackerId: string };
  shake_requested: { entityId: string };
  turn_action_completed: { entityId: string };
  all_enemies_defeated: Record<string, never>;

  // ===== ターン =====
  player_turn_started: Record<string, never>;
  player_turn_ended: { playerId: string } | Record<string, never>;
  enemy_turn_started: Record<string, never>;
  enemy_action_started: { enemyId: string };

  // ===== フロア =====
  floor_changed: { floor: number; maxFloors: number };
  floor_generated: FloorGenerationRequest;
  portal_activated: { playerId: string; position: Vector3 };
  portal_discovered: { entityId: string; currentFloor: number };

  // ===== タイル =====
  tile_entered:
    | {
        entityId: string;
        tilePosition: Vector3;
        tileType: TileType;
      }
    | {
        entityId: string;
        position: Vector3;
        type: TileType;
      };
  tile_exited: { entityId: string; position: Vector3; type: TileType };
  tile_changed: { position: Vector3; type: TileType };
  tile_explored: { position: Vector3; type: TileType };
  tile_visibility_changed: {
    x: number;
    y: number;
    visible: boolean;
    explored: boolean;
    roomId?: string;
  };
  tile_selected:
    | {
        tile: unknown;
        position: { x: number; y: number };
      }
    | {
        position: Vector3;
        type: TileType;
        selected: boolean;
      };
  tile_hovered: { position: { x: number; y: number } | null };
  fov_update_requested: { entityId: string };
  apply_tile_effect: {
    entityId: string;
    effect: 'damage' | 'heal';
    value: number;
  };

  // ===== インタラクション =====
  interaction_completed: {
    playerId: string;
    objectId: string;
    position: Vector3;
  };
  item_found: {
    playerId: string;
    itemEntity: Entity;
    position: Vector3;
  };
  item_dropped: {
    itemId: string;
    itemType: string;
    position: Vector3;
  };
  energy_recharged: {
    playerId: string;
    amount: number;
    position: Vector3;
  };

  // ===== 入力・選択 =====
  screen_clicked: { screenX: number; screenY: number };
  screen_hovered: { screenX: number; screenY: number };
  entity_selected: {
    entityId: string;
    entity: Entity;
    position: { x: number; y: number };
  };

  // ===== スキル =====
  skill_used: {
    playerId: string;
    skillId: string;
    skill: unknown;
  };
  skill_learned: { skillId: string };

  // ===== ゲーム進行 =====
  game_over: { score: number };
  game_clear: { floor: number };
}

/** 宣言済みのイベント名 */
export type EventKey = keyof EventMap;
