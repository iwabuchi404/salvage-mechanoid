# FOV System Implementation Summary

## Overview

Successfully implemented a Field of View (FOV) system for the game using Recursive Shadowcasting algorithm. The system provides:
- Fog of War (unexplored areas are hidden)
- Line of Sight (walls and obstacles block vision)
- Dynamic player view radius
- Enemy visibility only within FOV

## Files Modified

### 1. Type Definitions
**File**: `src/engine/types.ts`
- Added `blocksVision: boolean` to `PlacedObstacle` interface

### 2. Player Entity
**File**: `src/engine/entity/Player.ts`
- Added `_viewRadius` property (default: 8 tiles)
- Added `viewRadius` getter
- Added `setViewRadius()` method that emits FOV update event

### 3. FOV System (New)
**File**: `src/engine/fov/FOVSystem.ts`
- Implements Recursive Shadowcasting algorithm
- Calculates visible and explored tiles
- Handles 8-directional octant calculations
- Checks for blocking tiles (walls) and obstacles
- Emits visibility change events for tiles and entities

### 4. Obstacle Placer
**File**: `src/engine/world/placement/ObstaclePlacer.ts`
- Added `getBlocksVision()` helper method
- Updated all obstacle creation to include `blocksVision` property
- Default values:
  - CRATE: true (blocks vision)
  - BARREL: false (low, doesn't block)
  - WALL: true (blocks vision)
  - DEBRIS: false (low, doesn't block)
  - CONSOLE: false (low, doesn't block)

### 5. Obstacle Entity
**File**: `src/engine/entity/Obstacle.ts`
- Added `_blocksVision` property
- Added `blocksVision()` method to expose the property

### 6. Renderer System
**File**: `src/engine/graphics/RendererSystem.ts`
- Added `tileSprites` map to track tile sprites by coordinates
- Added `handleTileVisibilityChanged()` event handler
- Added `updateTileVisibility()` method
- Tile visibility states:
  - Unexplored: `visible = false` (hidden)
  - Explored but out of FOV: `alpha = 0.4, tint = 0x444444` (dark)
  - In FOV: `alpha = 1.0, tint = 0xffffff` (normal)

### 7. Sprite Component
**File**: `src/engine/entity/components/Sprite.ts`
- Added `_inPlayerFOV` flag (default: true)
- Added `setInFOV()` method
- Modified visibility logic to consider FOV for non-player entities
- Listens to `entity_visibility_changed` events

### 8. Game Integration
**File**: `src/game/Game.ts`
- Added FOVSystem import
- Registered FOVSystem in engine
- Calls `calculateInitialFOV()` after player creation

## Event Flow

```
Player moves
    ↓
MovementComponent emits 'move_completed'
    ↓
FOVSystem.updatePlayerFOV()
    ↓
FOVSystem.calculateFOV() (Shadowcasting)
    ↓
Checks blocking: walls (TileType.MOUNTAIN/WALL) + obstacles (blocksVision=true)
    ↓
Updates visibleTiles and exploredTiles sets
    ↓
Emits 'tile_visibility_changed' for each tile
    ↓
RendererSystem.updateTileVisibility() updates tile sprites
    ↓
Emits 'entity_visibility_changed' for each entity
    ↓
SpriteComponent.setInFOV() updates entity visibility
```

## Algorithm Details

### Recursive Shadowcasting
- Divides 360° view into 8 octants
- For each octant, recursively casts light from player position
- Uses slope calculations to determine shadow boundaries
- Respects view radius limit
- Blocks vision at walls and blocking obstacles

### Octant Transformation
```
    \  1  /
   7 \   / 2
      \ /
  -----@-----  (@ = player)
      / \
   6 /   \ 3
    /  4  \
```

## Usage Examples

### Change Player View Radius
```typescript
player.setViewRadius(12); // Extend to 12 tiles (e.g., night vision item)
player.setViewRadius(4);  // Reduce to 4 tiles (e.g., darkness effect)
```

### Check Tile Visibility
```typescript
const fovSystem = engine.getSystem<FOVSystem>('fov');
const isVisible = fovSystem.isTileVisible(x, y);
const isExplored = fovSystem.isTileExplored(x, y);
```

## Testing Checklist

- [x] All todos completed
- [x] No linter errors
- [ ] Test player movement updates FOV
- [ ] Test walls block vision
- [ ] Test obstacles with blocksVision=true block vision
- [ ] Test obstacles with blocksVision=false don't block vision
- [ ] Test enemies only visible in FOV
- [ ] Test explored tiles remain visible but darkened
- [ ] Test view radius changes update FOV correctly
- [ ] Test initial FOV calculation on game start

## Future Enhancements

1. **Performance Optimization**
   - Cache FOV calculations for static obstacles
   - Only recalculate changed regions
   - Use dirty flags for tiles

2. **Visual Effects**
   - Smooth fade transitions for FOV changes
   - Animated fog of war reveal
   - Pulsing effect for view radius changes

3. **Gameplay Features**
   - Torch/light items that extend view radius
   - Enemy detection radius (enemies can see player)
   - Stealth mechanics based on FOV
   - Reveal map items/abilities

4. **Debug Tools**
   - Visual FOV overlay for debugging
   - Toggle FOV on/off for testing
   - Display view radius circle

## Notes

- FOV recalculates on every player move (event-driven)
- Explored tiles persist across the entire game session
- Player is always visible (not affected by FOV)
- Items on ground are only visible within FOV
- Dead enemies remain visible in explored areas (future: could hide them)


