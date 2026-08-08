import { TileType } from '../types';

export const RENDER_CONFIG = {
  TILE_WIDTH: 160,
  TILE_HEIGHT: 120,
  SCREEN_WIDTH: 800,
  SCREEN_HEIGHT: 600,
  BACKGROUND_COLOR: 0x202020,
  ANTIALIAS: true,
} as const;

export const TILE_TEXTURES: Record<number, string> = {
  [TileType.GRASS]: './image.png',
  [TileType.WATER]: './image02.png',
  [TileType.MOUNTAIN]: './image03.png',
  [TileType.TILE]: './image.png',
  [TileType.PORTAL]: './image.png',
  [TileType.DAMAGE]: './image.png',
  [TileType.HEAL]: './image.png',
  [TileType.EVENT]: './image.png',
};

export function getTileTexturePath(tileType: number): string {
  return TILE_TEXTURES[tileType] ?? './image.png';
}
