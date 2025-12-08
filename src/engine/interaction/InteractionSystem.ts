import { System } from '../System';
import { Engine } from '../Engine';
import { EntitySystem } from '../entity/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { TransformComponent } from '../entity/components/Transform';
import { InteractableComponent } from '../entity/components/Interactable';
import { RendererSystem } from '../graphics/RendererSystem';
import { WorldSystem } from '../world/WorldSystem';

/**
 * インタラクションシステム - イベントオブジェクトとの相互作用を管理
 * プレイヤーがイベントオブジェクトに接触した時の処理を行う
 * タイル選択、エンティティ選択機能も担当
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
   * @param playerId プレイヤーID
   * @param position 位置
   */
  private checkInteractionAt(
    playerId: string,
    position: { x: number; y: number; z: number }
  ): void {
    const eventObjects = this.entitySystem?.getEntitiesByTag('event_object') || [];

    for (const eventObject of eventObjects) {
      const transform = eventObject.getComponent<TransformComponent>('transform');
      const interactable = eventObject.getComponent<InteractableComponent>('interactable');

      if (!transform || !interactable) continue;

      // 位置が一致するかチェック
      const pos = transform.position;
      if (pos.x === position.x && pos.y === position.y && pos.z === position.z) {
        // インタラクション可能かチェック
        if (interactable.canInteract()) {
          // インタラクションを実行
          const success = interactable.interact(playerId);

          if (success) {
            // インタラクション成功イベントを発行
            this.eventSystem?.emit('interaction_completed', {
              playerId: playerId,
              objectId: eventObject.id,
              position: position,
            });
          }
        }
      }
    }
  }

  /**
   * 手動でインタラクションを実行
   * @param playerId プレイヤーID
   * @param objectId オブジェクトID
   * @returns インタラクションが成功したかどうか
   */
  triggerInteraction(playerId: string, objectId: string): boolean {
    const eventObject = this.entitySystem?.getEntity(objectId);
    if (!eventObject) {
      return false;
    }

    const interactable = eventObject.getComponent<InteractableComponent>('interactable');
    if (!interactable) {
      return false;
    }

    if (!interactable.canInteract()) {
      return false;
    }

    // インタラクションを実行
    const success = interactable.interact(playerId);

    if (success) {
      // インタラクション成功イベントを発行
      const transform = eventObject.getComponent<TransformComponent>('transform');
      this.eventSystem?.emit('interaction_completed', {
        playerId: playerId,
        objectId: objectId,
        position: transform ? transform.position : { x: 0, y: 0, z: 0 },
      });
    }

    return success;
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

    // カメラと座標変換システムを取得
    const camera = this.rendererSystem.getCamera();
    const coordSystem = this.rendererSystem.getCoordinateSystem();

    // 表示座標からスクリーン座標に変換（カメラオフセットを追加）
    const worldScreenX = screenX + camera.x;
    const worldScreenY = screenY + camera.y;

    // スクリーン座標からグリッド座標に変換
    const gridPos = coordSystem.screenToIsometric(worldScreenX, worldScreenY);

    console.log(
      `Click: screen(${screenX}, ${screenY}) -> world(${worldScreenX}, ${worldScreenY}) -> grid(${gridPos.x}, ${gridPos.y})`
    );

    // グリッド座標を整数に丸める
    const intX = Math.round(gridPos.x);
    const intY = Math.round(gridPos.y);

    // まずエンティティを検索
    const clickedEntity = this.findEntityAtPosition(intX, intY);

    if (clickedEntity) {
      // エンティティが見つかった場合
      this.selectEntity(clickedEntity.id, intX, intY);
    } else {
      // エンティティがない場合はタイルを選択
      this.selectTile(intX, intY);
    }
  }

  /**
   * 指定位置のエンティティを検索
   * @param x グリッドX座標
   * @param y グリッドY座標
   * @returns エンティティまたはnull
   */
  private findEntityAtPosition(x: number, y: number): any {
    const entities = this.entitySystem?.getEntities() || [];

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
}
