import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';
import { EntitySystem } from '../entity/EntitySystem';
import { WorldSystem } from './WorldSystem';
import { MapGeneratorFacade } from './MapGeneratorFacade';
import { ResourceGenerationSystem } from './ResourceGenerationSystem';
import { TileMap } from './TileMap';
import { Player } from '../entity/Player';
import { StageType } from '../types';

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

  // マップジェネレーター
  private mapGenerator: MapGeneratorFacade;

  // リソース生成システム
  private resourceGenerator: ResourceGenerationSystem;

  /**
   * コンストラクタ
   * @param engine エンジンのインスタンス
   * @param maxFloors 最大フロア数（デフォルト: 10）
   */
  constructor(engine: Engine, maxFloors = 10) {
    this.engine = engine;
    this.maxFloors = maxFloors;
    this.mapGenerator = new MapGeneratorFacade(40, 30);
    this.resourceGenerator = new ResourceGenerationSystem(40, 30);

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
   * 次のフロアへ移動
   * @returns 移動に成功したらtrue
   */
  async moveToNextFloor(): Promise<boolean> {
    if (this.currentFloor >= this.maxFloors) {
      console.log('Already at the last floor!');
      return false;
    }

    console.log(`Moving from floor ${this.currentFloor} to ${this.currentFloor + 1}`);

    // プレイヤーの状態を保存
    const playerState = this.savePlayerState();
    if (!playerState) {
      console.error('Failed to save player state');
      return false;
    }

    // フロアを進める
    this.currentFloor++;

    // 新しいフロアを生成
    await this.generateFloor();

    // プレイヤーの状態を復元
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
   * 前のフロアへ移動（デバッグ用）
   * @returns 移動に成功したらtrue
   */
  async moveToPreviousFloor(): Promise<boolean> {
    if (this.currentFloor <= 1) {
      console.log('Already at the first floor!');
      return false;
    }

    console.log(`Moving from floor ${this.currentFloor} to ${this.currentFloor - 1}`);

    // プレイヤーの状態を保存
    const playerState = this.savePlayerState();
    if (!playerState) {
      console.error('Failed to save player state');
      return false;
    }

    // フロアを戻す
    this.currentFloor--;

    // 新しいフロアを生成
    await this.generateFloor();

    // プレイヤーの状態を復元
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

    console.log(`Moving from floor ${this.currentFloor} to ${floor}`);

    // プレイヤーの状態を保存
    const playerState = this.savePlayerState();
    if (!playerState) {
      console.error('Failed to save player state');
      return false;
    }

    // フロアを変更
    this.currentFloor = floor;

    // 新しいフロアを生成
    await this.generateFloor();

    // プレイヤーの状態を復元
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
   */
  private async generateFloor(): Promise<void> {
    console.log(`Generating floor ${this.currentFloor}...`);

    // 既存のエンティティをクリア（プレイヤー以外）
    this.clearEntities();

    // フロアの難易度を計算（フロアが進むほど難しくなる）
    const difficulty = Math.min(1 + (this.currentFloor - 1) * 0.2, 3);

    // ステージタイプを決定（フロアに応じて変化）
    const stageType = this.determineStageType(this.currentFloor);

    // フロア生成イベントを発行（Game.tsで処理）
    const eventSystem = this.engine.getSystem<EventSystem>('event');
    eventSystem?.emit('floor_generated', {
      floor: this.currentFloor,
      stageType: stageType,
      difficulty: difficulty,
    });

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
   * プレイヤーの状態を保存
   * @returns プレイヤーの状態
   */
  private savePlayerState(): PlayerState | null {
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');
    if (!entitySystem) return null;

    const players = entitySystem.getEntitiesByTag('player');
    if (players.length === 0) return null;

    const player = players[0] as Player;
    const health = player.getComponent('health');
    const energy = player.getComponent('energy');

    if (!health || !energy) return null;

    return {
      hp: (health as unknown as { currentHp: number }).currentHp,
      maxHp: (health as unknown as { maxHp: number }).maxHp,
      energy: (energy as unknown as { getCurrentEnergy: () => number }).getCurrentEnergy(),
      maxEnergy: (energy as unknown as { getMaxEnergy: () => number }).getMaxEnergy(),
    };
  }

  /**
   * プレイヤーの状態を復元
   * @param state プレイヤーの状態
   */
  private restorePlayerState(state: PlayerState): void {
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');
    if (!entitySystem) return;

    const players = entitySystem.getEntitiesByTag('player');
    if (players.length === 0) return;

    const player = players[0] as Player;
    const health = player.getComponent('health');
    const energy = player.getComponent('energy');

    if (health && 'currentHp' in health) {
      (health as unknown as { currentHp: number }).currentHp = state.hp;
      (health as unknown as { maxHp: number }).maxHp = state.maxHp;
    }

    if (energy && 'setEnergy' in energy) {
      (energy as unknown as { setEnergy: (current: number, max: number) => void }).setEnergy(
        state.energy,
        state.maxEnergy
      );
    }

    console.log('Player state restored:', state);
  }

  /**
   * エンティティをクリア（プレイヤー以外）
   */
  private clearEntities(): void {
    const entitySystem = this.engine.getSystem<EntitySystem>('entity');
    if (!entitySystem) return;

    const entities = entitySystem.getEntities();
    const entitiesToRemove = entities.filter((entity) => !entity.hasTag('player'));

    for (const entity of entitiesToRemove) {
      entitySystem.removeEntity(entity.id);
    }

    console.log(`Cleared ${entitiesToRemove.length} entities`);
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
}
