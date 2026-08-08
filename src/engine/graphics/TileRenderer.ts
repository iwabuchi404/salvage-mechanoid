import * as PIXI from 'pixi.js';
import { CoordinateSystem } from './CoordinateSystem';
import { Camera } from './Camera';
import { RENDER_CONFIG, getTileTexturePath } from './RenderConfig';
import { TileType } from '../types';
interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface TileSpriteState {
  explored: boolean;
  visible: boolean;
}

export class TileRenderer {
  private coordinateSystem: CoordinateSystem;
  private spritePool: PIXI.Sprite[] = [];
  private activeSprites: Map<string, PIXI.Sprite> = new Map();
  private tileStates: Map<string, TileSpriteState> = new Map();
  private textures: Map<number, PIXI.Texture> = new Map();
  private texturesLoaded = false;
  private tileMapData: number[][] | null = null;

  constructor(coordinateSystem: CoordinateSystem) {
    this.coordinateSystem = coordinateSystem;
  }

  async loadTextures(): Promise<void> {
    const uniquePaths = new Set<string>();
    for (const tileType of [
      TileType.GRASS,
      TileType.WATER,
      TileType.MOUNTAIN,
      TileType.TILE,
      TileType.PORTAL,
      TileType.DAMAGE,
      TileType.HEAL,
      TileType.EVENT,
    ]) {
      uniquePaths.add(getTileTexturePath(tileType));
    }

    const loadPromises: Promise<void>[] = [];
    for (const path of uniquePaths) {
      loadPromises.push(
        PIXI.Assets.load(path).then((texture: PIXI.Texture) => {
          for (const tileType of [
            TileType.GRASS,
            TileType.WATER,
            TileType.MOUNTAIN,
            TileType.TILE,
            TileType.PORTAL,
            TileType.DAMAGE,
            TileType.HEAL,
            TileType.EVENT,
          ]) {
            if (getTileTexturePath(tileType) === path) {
              this.textures.set(tileType, texture);
            }
          }
        })
      );
    }

    await Promise.all(loadPromises);
    this.texturesLoaded = true;
  }

  renderTiles(
    layer: PIXI.Container,
    tileMapData: number[][],
    camera: Camera,
    coordSystem: CoordinateSystem
  ): void {
    if (!this.texturesLoaded) return;

    this.tileMapData = tileMapData;
    const viewport = this.calculateViewport(camera, coordSystem);

    this.recycleInvisibleSprites(viewport);

    const mapHeight = tileMapData.length;
    const mapWidth = tileMapData[0]?.length ?? 0;

    for (let y = viewport.minY; y <= viewport.maxY; y++) {
      if (y < 0 || y >= mapHeight) continue;
      for (let x = viewport.minX; x <= viewport.maxX; x++) {
        if (x < 0 || x >= mapWidth) continue;

        const tileType = tileMapData[y][x];
        if (tileType === TileType.EMPTY) continue;

        const key = `${x},${y}`;
        if (this.activeSprites.has(key)) continue;

        const texture = this.textures.get(tileType);
        if (!texture) continue;

        const sprite = this.acquireSprite(texture);
        sprite.anchor.set(0.5, 0.5);

        const screenPos = coordSystem.isometricToScreen(x, y, 0);
        sprite.x = screenPos.x;
        sprite.y = screenPos.y;
        sprite.zIndex = (x + y) * 1000;

        const state = this.tileStates.get(key);
        this.applyVisibility(sprite, state);

        layer.addChild(sprite);
        this.activeSprites.set(key, sprite);
      }
    }
  }

  updateViewport(layer: PIXI.Container, camera: Camera, coordSystem: CoordinateSystem): void {
    if (!this.tileMapData) return;
    this.renderTiles(layer, this.tileMapData, camera, coordSystem);
  }

  calculateViewport(camera: Camera, coordSystem: CoordinateSystem): ViewportBounds {
    const screenW = RENDER_CONFIG.SCREEN_WIDTH;
    const screenH = RENDER_CONFIG.SCREEN_HEIGHT;
    const zoom = camera.zoom;

    const corners = [
      { x: 0, y: 0 },
      { x: screenW, y: 0 },
      { x: 0, y: screenH },
      { x: screenW, y: screenH },
    ];

    let minTileX = Infinity,
      maxTileX = -Infinity;
    let minTileY = Infinity,
      maxTileY = -Infinity;

    for (const corner of corners) {
      const worldX = corner.x / zoom + camera.x;
      const worldY = corner.y / zoom + camera.y;
      const tile = coordSystem.screenToTile(worldX, worldY);
      minTileX = Math.min(minTileX, tile.x);
      maxTileX = Math.max(maxTileX, tile.x);
      minTileY = Math.min(minTileY, tile.y);
      maxTileY = Math.max(maxTileY, tile.y);
    }

    const margin = 2;
    return {
      minX: minTileX - margin,
      maxX: maxTileX + margin,
      minY: minTileY - margin,
      maxY: maxTileY + margin,
    };
  }

  private recycleInvisibleSprites(viewport: ViewportBounds): void {
    const toRemove: string[] = [];

    for (const [key, sprite] of this.activeSprites) {
      const [x, y] = key.split(',').map(Number);
      if (x < viewport.minX || x > viewport.maxX || y < viewport.minY || y > viewport.maxY) {
        sprite.parent?.removeChild(sprite);
        this.releaseSprite(sprite);
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      this.activeSprites.delete(key);
    }
  }

  private applyVisibility(sprite: PIXI.Sprite, state: TileSpriteState | undefined): void {
    if (!state || !state.explored) {
      sprite.visible = false;
    } else if (!state.visible) {
      sprite.visible = true;
      sprite.tint = 0x808080;
    } else {
      sprite.visible = true;
      sprite.tint = 0xffffff;
    }
  }

  updateTileVisibility(tileX: number, tileY: number, visible: boolean, explored: boolean): void {
    const key = `${tileX},${tileY}`;
    this.tileStates.set(key, { explored, visible });

    const sprite = this.activeSprites.get(key);
    if (!sprite) return;

    if (!explored) {
      sprite.visible = false;
    } else if (!visible) {
      sprite.visible = true;
      sprite.tint = 0x808080;
    } else {
      sprite.visible = true;
      sprite.tint = 0xffffff;
    }
  }

  private acquireSprite(texture: PIXI.Texture): PIXI.Sprite {
    const sprite = this.spritePool.pop() ?? new PIXI.Sprite();
    sprite.texture = texture;
    sprite.visible = true;
    sprite.tint = 0xffffff;
    sprite.alpha = 1.0;
    return sprite;
  }

  private releaseSprite(sprite: PIXI.Sprite): void {
    this.spritePool.push(sprite);
  }

  clear(): void {
    for (const [, sprite] of this.activeSprites) {
      sprite.parent?.removeChild(sprite);
      this.releaseSprite(sprite);
    }
    this.activeSprites.clear();
    this.tileStates.clear();
    this.tileMapData = null;
  }

  getActiveSpriteCount(): number {
    return this.activeSprites.size;
  }

  getPoolSize(): number {
    return this.spritePool.length;
  }

  isTexturesLoaded(): boolean {
    return this.texturesLoaded;
  }

  getActiveSprite(x: number, y: number): PIXI.Sprite | undefined {
    return this.activeSprites.get(`${x},${y}`);
  }

  hasTileMapData(): boolean {
    return this.tileMapData !== null;
  }

  destroy(): void {
    this.clear();
    for (const sprite of this.spritePool) {
      sprite.destroy();
    }
    this.spritePool.length = 0;
  }
}
