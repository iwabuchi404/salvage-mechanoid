import { System } from '../System';
import { Engine } from '../Engine';
import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { TransformComponent } from '../entity/components/Transform';
import { InteractableComponent } from '../entity/components/Interactable';
import { RendererSystem } from '../graphics/RendererSystem';
import { WorldSystem } from '../world/WorldSystem';
import { findEntityAtTilePosition } from './InteractionQuery';
import { InteractionExecutor } from './InteractionExecutor';

/**
 * インタラクションシステム - イベントオブジェクトとの相互作用を管理
 *
 * 候補抽出は InteractionQuery（純粋関数）、効果実行は InteractionExecutor へ委譲し、
 * 本クラスはシステム間の依存解決とイベント購読、UI 操作（クリック/ホバー）を担当する。
 *
 * タイル選択、エンティティ選択機能も担当する。
 */
export class InteractionSystem implements System {
  // エンジンへの参照
  private engine: Engine | null = null;

  // エンティティシステムへの参照
  private entitySystem: EntitySystem | null = null;

  // イベントシステムへの参照
  private eventSystem: EventSystem | null = null;

  // レンダラーシステムへの参照
  private rendererSystem: RendererSystem | null = null;

  // ワールドシステムへの参照
  private worldSystem: WorldSystem | null = null;

  // 効果実行を委譲する Executor
  private executor: InteractionExecutor | null = null;

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.entitySystem = engine.getSystem<EntitySystem>('entity') || null;
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;
    this.rendererSystem = engine.getSystem<RendererSystem>('renderer') || null;
    this.worldSystem = engine.getSystem<WorldSystem>('world') || null;

    if (this.entitySystem && this.eventSystem) {
      this.executor = new InteractionExecutor(this.entitySystem, this.eventSystem);
    }

    // イベントリスナーを設定
    this.setupEventListeners();
  }

  /**
   * 毎フレームの更新処理
   * @param _deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(_deltaTime: number): void {
    // プレイヤーの位置を監視し、イベントオブジェクトとの衝突をチェック
    this.checkInteractions();
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) {
      return;
    }

    // 移動完了時にインタラクションをチェック
    this.eventSystem.on('move_completed', (data) => {
      if (data.entityId && data.entityId.startsWith('player')) {
        this.checkInteractionAt(data.entityId, data.position);
      }
    });

    // プレイヤー移動完了時にもチェック
    this.eventSystem.on('player_move_completed', (data) => {
      if (data.position) {
        this.checkInteractionAt('player', data.position);
      }
    });

    // スクリーンクリック時にタイル/エンティティ選択を処理
    this.eventSystem.on('screen_clicked', (data) => {
      this.handleScreenClick(data.screenX, data.screenY);
    });

    // スクリーンホバー時にタイルをハイライト
    this.eventSystem.on('screen_hovered', (data) => {
      this.handleScreenHover(data.screenX, data.screenY);
    });
  }

  /**
   * インタラクションをチェック
   */
  private checkInteractions(): void {
    const players = this.entitySystem?.getEntitiesByTag('player') || [];

    for (const player of players) {
      const playerTransform = player.getComponent<TransformComponent>('transform');
      if (!playerTransform) continue;

      this.checkInteractionAt(player.id, playerTransform.position);
    }
  }

  /**
   * 指定位置でのインタラクションをチェック
   *
   * 候補抽出と効果実行を InteractionExecutor へ委譲する。
   * @param playerId プレイヤーID
   * @param position 位置
   */
  private checkInteractionAt(
    playerId: string,
    position: { x: number; y: number; z: number }
  ): void {
    if (!this.executor || !this.entitySystem) return;

    this.executor.executeAtPosition(this.entitySystem.getEntities(), position, playerId);
  }

  /**
   * 手動でインタラクションを実行
   * @param playerId プレイヤーID
   * @param objectId オブジェクトID
   * @returns インタラクションが成功したかどうか
   */
  triggerInteraction(playerId: string, objectId: string): boolean {
    if (!this.executor) return false;
    return this.executor.executeById(objectId, playerId);
  }

  /**
   * イベントオブジェクトをリセット
   * @param objectId オブジェクトID
   */
  resetInteractable(objectId: string): void {
    const eventObject = this.entitySystem?.getEntity(objectId);
    if (!eventObject) {
      return;
    }

    const interactable = eventObject.getComponent<InteractableComponent>('interactable');
    if (interactable) {
      interactable.reset();
    }
  }

  /**
   * スクリーンクリックを処理してタイル/エンティティを選択
   * @param screenX スクリーンX座標
   * @param screenY スクリーンY座標
   */
  private handleScreenClick(screenX: number, screenY: number): void {
    if (!this.rendererSystem) {
      console.warn('RendererSystem not found, cannot handle screen click');
      return;
    }

    // RendererSystemのscreenToTileを使用（カメラオフセット・ズーム考慮済み）
    const gridPos = this.rendererSystem.screenToTile(screenX, screenY);

    const intX = gridPos.x;
    const intY = gridPos.y;

    // まずエンティティを検索（InteractionQuery へ委譲）
    const entities = this.entitySystem?.getEntities() || [];
    const clickedEntity = findEntityAtTilePosition(entities, intX, intY);

    if (clickedEntity) {
      // エンティティが見つかった場合
      this.selectEntity(clickedEntity.id, intX, intY);
    } else {
      // エンティティがない場合はタイルを選択
      this.selectTile(intX, intY);
    }
  }

  /**
   * エンティティを選択
   * @param entityId エンティティID
   * @param gridX グリッドX座標
   * @param gridY グリッドY座標
   */
  private selectEntity(entityId: string, gridX: number, gridY: number): void {
    const entity = this.entitySystem?.getEntity(entityId);
    if (!entity) return;

    console.log(`Entity selected: ${entityId} at (${gridX}, ${gridY})`);

    // エンティティ選択イベントを発行
    this.eventSystem?.emit('entity_selected', {
      entityId: entityId,
      entity: entity,
      position: { x: gridX, y: gridY },
    });
  }

  /**
   * タイルを選択
   * @param gridX グリッドX座標
   * @param gridY グリッドY座標
   */
  private selectTile(gridX: number, gridY: number): void {
    if (!this.worldSystem) {
      console.warn('WorldSystem not found, cannot select tile');
      return;
    }

    const tileMap = this.worldSystem.getTileMap();
    if (!tileMap) {
      console.warn('TileMap not found, cannot select tile');
      return;
    }

    // タイル情報を取得
    const tile = tileMap.getTile(gridX, gridY);

    if (tile) {
      console.log(`Tile selected: ${tile.type} at (${gridX}, ${gridY})`);

      // タイル選択イベントを発行
      this.eventSystem?.emit('tile_selected', {
        tile: tile,
        position: { x: gridX, y: gridY },
      });
    } else {
      console.log(`No tile found at (${gridX}, ${gridY})`);
    }
  }

  /**
   * スクリーンホバーを処理してタイルをハイライト
   * @param screenX スクリーンX座標
   * @param screenY スクリーンY座標
   */
  private handleScreenHover(screenX: number, screenY: number): void {
    if (!this.rendererSystem) {
      return;
    }

    // 無効な座標の場合はハイライトを非表示
    if (screenX < 0 || screenY < 0) {
      this.eventSystem?.emit('tile_hovered', {
        position: null,
      });
      return;
    }

    // RendererSystemのscreenToTileを使用（カメラオフセット・ズーム考慮済み）
    const gridPos = this.rendererSystem.screenToTile(screenX, screenY);

    const intX = gridPos.x;
    const intY = gridPos.y;

    // タイルホバーイベントを発行（タイルの存在チェックはRendererSystemで行う）
    this.eventSystem?.emit('tile_hovered', {
      position: { x: intX, y: intY },
    });
  }
}
