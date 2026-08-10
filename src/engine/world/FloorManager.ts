import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';
import { EntitySystem } from '../entity/EntitySystem';
import { Player } from '../entity/Player';
import { HealthComponent } from '../entity/components/Health';
import { TransformComponent } from '../entity/components/Transform';
import { StageType } from '../types';
import { WorldSystem } from './WorldSystem';

/**
 * フロア生成を依頼するときに Game へ渡す情報
 */
export interface FloorGenerationRequest {
  floor: number;
  stageType: StageType;
  difficulty: number;
}

/**
 * 実際のマップ・リソース生成を担当するコールバック
 */
export type FloorGenerationHandler = (request: FloorGenerationRequest) => Promise<void>;

/**
 * フロアマネージャー - ダンジョンの階層管理を担当
 * フロア生成、フロア移動、プレイヤーの状態保持などを管理
 */
export class FloorManager {
  // エンジンへの参照
  private engine: Engine;

  // 現在のフロア番号（1から始まる）
  private currentFloor = 1;

  // 最大フロア数
  private maxFloors = 10;

  // 実際のフロア生成処理は Game 側から注入する
  private floorGenerationHandler: FloorGenerationHandler | null = null;

  /**
   * コンストラクタ
   * @param engine エンジンのインスタンス
   * @param maxFloors 最大フロア数（デフォルト: 10）
   */
  constructor(engine: Engine, maxFloors = 10) {
    this.engine = engine;
    this.maxFloors = maxFloors;

    console.log(`FloorManager created with ${maxFloors} floors`);
  }

  /**
   * 現在のフロア番号を取得
   * @returns フロア番号
   */
  getCurrentFloor(): number {
    return this.currentFloor;
  }

  /**
   * 最大フロア数を取得
   * @returns 最大フロア数
   */
  getMaxFloors(): number {
    return this.maxFloors;
  }

  /**
   * 実際のマップ・リソース生成処理を設定する
   * @param handler フロア生成処理。null で解除する
   */
  setFloorGenerationHandler(handler: FloorGenerationHandler | null): void {
    this.floorGenerationHandler = handler;
  }

  /**
   * 次のフロアへ移動
   * @returns 移動に成功したらtrue
   */
  async moveToNextFloor(): Promise<boolean> {
    if (this.currentFloor >= this.maxFloors) {
      console.log('Already at the last floor!');
      return false;
    }
    return await this.transitionToFloor(this.currentFloor + 1);
  }

  /**
   * 前のフロアへ移動（デバッグ用）
   * @returns 移動に成功したらtrue
   */
  async moveToPreviousFloor(): Promise<boolean> {
    if (this.currentFloor <= 1) {
      console.log('Already at the first floor!');
      return false;
    }
    return await this.transitionToFloor(this.currentFloor - 1);
  }

  /**
   * 指定フロアへ移動（デバッグ用）
   * @param floor フロア番号
   * @returns 移動に成功したらtrue
   */
  async moveToFloor(floor: number): Promise<boolean> {
    if (floor < 1 || floor > this.maxFloors) {
      console.error(`Invalid floor number: ${floor}`);
      return false;
    }
    if (floor === this.currentFloor) {
      console.log('Already at this floor');
      return false;
    }
    return await this.transitionToFloor(floor);
  }

  /**
   * フロア遷移の共通処理（生成→コミット→イベント発行）
   * 生成失敗時は旧フロアへロールバックし、イベントを発行しない。
   * @param targetFloor 移動先フロア番号
   * @returns 移動に成功したらtrue
   */
  private async transitionToFloor(targetFloor: number): Promise<boolean> {
    const oldFloor = this.currentFloor;
    console.log(`Moving from floor ${oldFloor} to ${targetFloor}`);

    // プレイヤーの状態を保存（HP、エネルギー、位置）
    const playerState = this.savePlayerState();
    if (!playerState) {
      console.error('Failed to save player state');
      return false;
    }

    // 暫定的に現在階を切り替え（ハンドラーが getCurrentFloor() で参照するため）
    this.currentFloor = targetFloor;

    try {
      // 新しいフロアを生成（ハンドラーが例外を投げた場合は catch へ）
      await this.generateFloor();
    } catch (error) {
      console.error(`Failed to generate floor ${targetFloor}:`, error);
      // ロールバック: 現在階を元に戻す
      this.currentFloor = oldFloor;
      // ロールバック: WorldSystem の現在階を元に戻す
      const worldSystem = this.engine.getSystem<WorldSystem>('world');
      if (worldSystem) {
        worldSystem.setCurrentFloor(oldFloor);
      }
      // ロールバック: プレイヤー状態を元に戻す（+20 ボーナスなし）
      this.revertPlayerState(playerState);
      return false;
    }

    // 成功: プレイヤーの状態を復元（エネルギー +20 ボーナス付き）
    this.restorePlayerState(playerState);

    // フロア移動イベントを発行
    const eventSystem = this.engine.getSystem<EventSystem>('event');
    eventSystem?.emit('floor_changed', {
      floor: this.currentFloor,
      maxFloors: this.maxFloors,
    });

    console.log(`Successfully moved to floor ${this.currentFloor}`);
    return true;
  }

  /**
   * フロアを生成
   * ハンドラー成功後に旧エンティティを削除し、floor_generated を発行する。
   * ハンドラーが例外を投げた場合はそのまま例外を伝播する（呼び出し元でロールバック）。
   */
  private async generateFloor(): Promise<void> {
    console.log(`Generating floor ${this.currentFloor}...`);

    // フロアの難易度を計算（フロアが進むほど難しくなる）
    const difficulty = Math.min(1 + (this.currentFloor - 1) * 0.2, 3);

    // ステージタイプを決定（フロアに応じて変化）
    const stageType = this.determineStageType(this.currentFloor);

    const request: FloorGenerationRequest = {
      floor: this.currentFloor,
      stageType,
      difficulty,
    };

    // 旧エンティティ（プレイヤー以外）の ID をスナップショット
    // ハンドラー成功後にこれらを削除するため、失敗時はエンティティが残る
    const oldEntityIds = this.snapshotNonPlayerEntityIds();

    // 実際のマップ・リソース生成が完了するまで待つ。
    // ハンドラーが例外を投げた場合は catch ブロックへ伝播し、エンティティは削除されない。
    await this.floorGenerationHandler?.(request);

    // ハンドラー成功: 旧エンティティを削除（新規生成されたエンティティは残す）
    this.removeEntitiesByIds(oldEntityIds);

    // フロア生成の完了を通知する
    const eventSystem = this.engine.getSystem<EventSystem>('event');
    eventSystem?.emit('floor_generated', request);

    console.log(`Floor ${this.currentFloor} generated successfully`);
  }

  /**
   * ステージタイプを決定
   * @param floor フロア番号
   * @returns ステージタイプ
   */
  private determineStageType(floor: number): StageType {
    // フロアに応じてステージタイプを変化させる
    if (floor <= 3) {
      return StageType.CLASSIC;
    } else if (floor <= 6) {
      return StageType.ENERGY_MANAGEMENT;
    } else if (floor <= 9) {
      return StageType.TACTICAL_COMBAT;
    } else {
      return StageType.RESOURCE_CONTROL;
    }
  }

  /**
   * プレイヤーの状態を保存（HP、エネルギー、位置）
   * @returns プレイヤーの状態
   */
  private savePlayerState(): PlayerState | null {
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');
    if (!entitySystem) return null;

    const players = entitySystem.getEntitiesByTag('player');
    if (players.length === 0) return null;

    const player = players[0] as Player;
    const health = player.getComponent('health');
    const energy = player.getEnergySnapshot();
    const transform = player.getComponent<TransformComponent>('transform');

    if (!health || !energy) return null;

    const position = transform ? transform.position : { x: 0, y: 0, z: 0 };

    return {
      hp: (health as unknown as { currentHp: number }).currentHp,
      maxHp: (health as unknown as { maxHp: number }).maxHp,
      energy: energy.currentEnergy,
      maxEnergy: energy.maxEnergy,
      position: { x: position.x, y: position.y, z: position.z },
    };
  }

  /**
   * プレイヤーの状態を復元
   * 階層移動時のボーナスとしてエネルギーを +20 回復する（最大値まで）
   * @param state プレイヤーの状態
   */
  private restorePlayerState(state: PlayerState): void {
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');
    if (!entitySystem) return;

    const players = entitySystem.getEntitiesByTag('player');
    if (players.length === 0) return;

    const player = players[0] as Player;
    const health = player.getComponent<HealthComponent>('health');

    if (health) {
      health.restoreSnapshot({ currentHp: state.hp, maxHp: state.maxHp });
    }

    // 階層移動ボーナス: エネルギー +20 回復（最大値を超えない）
    const ENERGY_RECOVERY_BONUS = 20;
    const restoredEnergy = Math.min(state.energy + ENERGY_RECOVERY_BONUS, state.maxEnergy);

    player.restoreEnergySnapshot({
      currentEnergy: restoredEnergy,
      maxEnergy: state.maxEnergy,
    });

    console.log('Player state restored:', { ...state, energy: restoredEnergy });
  }

  /**
   * プレイヤーの状態をロールバック（生成失敗時）
   * +20 ボーナスなしで元の状態へ戻す
   * @param state プレイヤーの状態
   */
  private revertPlayerState(state: PlayerState): void {
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');
    if (!entitySystem) return;

    const players = entitySystem.getEntitiesByTag('player');
    if (players.length === 0) return;

    const player = players[0] as Player;
    const health = player.getComponent<HealthComponent>('health');

    if (health) {
      health.restoreSnapshot({ currentHp: state.hp, maxHp: state.maxHp });
    }

    player.restoreEnergySnapshot({
      currentEnergy: state.energy,
      maxEnergy: state.maxEnergy,
    });

    // 位置を元に戻す
    const transform = player.getComponent<TransformComponent>('transform');
    if (transform) {
      transform.setPosition(state.position.x, state.position.y, state.position.z);
    }

    console.log('Player state reverted:', state);
  }

  /**
   * プレイヤー以外のエンティティIDをスナップショット
   * @returns エンティティIDの配列
   */
  private snapshotNonPlayerEntityIds(): string[] {
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');
    if (!entitySystem) return [];

    return entitySystem
      .getEntities()
      .filter((entity) => !entity.hasTag('player'))
      .map((entity) => entity.id);
  }

  /**
   * 指定IDのエンティティを削除
   * @param ids 削除するエンティティIDの配列
   */
  private removeEntitiesByIds(ids: string[]): void {
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');
    if (!entitySystem) return;

    for (const id of ids) {
      entitySystem.removeEntity(id);
    }

    console.log(`Cleared ${ids.length} old entities`);
  }

  /**
   * フロアをリセット（最初から）
   */
  async reset(): Promise<void> {
    console.log('Resetting floor manager...');
    this.currentFloor = 1;
    await this.generateFloor();
  }
}

/**
 * プレイヤーの状態
 */
interface PlayerState {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  position: { x: number; y: number; z: number };
}
