/**
 * World module exports
 */

// 基本的なマップ生成
export { FlexibleMapGenerator } from './FlexibleMapGenerator';
export { TacticalMapGenerator } from './TacticalMapGenerator';

// マップ生成インターフェース
export {
  MapGeneratorInterface,
  RoomGeneratorInterface,
  CorridorGeneratorInterface,
  FeaturePlacerInterface,
  MapGeneratorFactory,
  mapGeneratorFactory,
  initializeMapGeneratorFactory,
} from './MapGeneratorInterface';

// 各種ジェネレーター
export { BSPGenerator } from './generators/BSPGenerator';
export { CaveGenerator } from './generators/CaveGenerator';
export { BaseRoomGenerator } from './generators/BaseGenerator';

// 通路生成
export { AStarCorridorGenerator } from './corridors/AStarCorridorGenerator';
export { LShapeCorridorGenerator } from './corridors/LShapeCorridorGenerator';

// 特徴配置
export { BasicFeaturePlacer } from './features/BasicFeaturePlacer';
export { RuleBasedFeaturePlacer } from './features/RuleBasedFeaturePlacer';
export { BaseFeaturePlacer } from './features/BaseFeaturePlacer';

// 基本システム
export { TileMap } from './TileMap';
export { WorldSystem } from './WorldSystem';
export { createFloorSnapshot } from './FloorSnapshot';
export type { FloorSnapshot, FloorNumber } from './FloorSnapshot';
export { createRoomId, roomToId, isRoomId, roomIdToCoords } from './RoomId';
export type { RoomId } from './RoomId';
export {
  corridorToDoorways,
  corridorsToDoorways,
  detectDirection,
  isOnRoomBoundary,
  validateDoorways,
  areAllRoomsConnected,
  buildRoomGraph,
  isRoomGraphConnected,
} from './Doorway';
export type {
  Doorway,
  DoorwayValidationResult,
  DoorwayValidationError,
  DoorwayErrorKind,
} from './Doorway';

// パスファインディング
export { AStar } from './pathfinding/AStar';
