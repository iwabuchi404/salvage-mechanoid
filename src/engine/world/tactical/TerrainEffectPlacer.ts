import { TileEffect, TacticalGenerationConfig, Room } from '../../types';

/**
 * 地形効果配置システム
 * スキル活用を促進する地形効果を戦略的に配置
 */
export class TerrainEffectPlacer {
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * スキル活用地形の配置
   * @param map マップデータ
   * @param rooms 部屋リスト
   * @param config 設定
   * @returns 地形効果マップ
   */
  placeSkillEnhancingTerrain(
    map: number[][],
    rooms: Room[],
    config: TacticalGenerationConfig
  ): Map<string, TileEffect> {
    console.log('Placing skill-enhancing terrain...');

    const terrainEffects = new Map<string, TileEffect>();

    // 戦術的焦点に応じた地形配置
    switch (config.primaryTacticalFocus) {
      case 'energy_management':
        this.placeEnergyFocusedTerrain(map, rooms, terrainEffects, config);
        break;
      case 'skill_selection':
        this.placeSkillFocusedTerrain(map, rooms, terrainEffects, config);
        break;
      case 'sensor_usage':
        this.placeSensorFocusedTerrain(map, rooms, terrainEffects, config);
        break;
      case 'mixed':
        this.placeMixedTerrain(map, rooms, terrainEffects, config);
        break;
    }

    console.log(`Placed ${terrainEffects.size} terrain effects`);
    return terrainEffects;
  }

  /**
   * エネルギー管理重視の地形配置
   */
  private placeEnergyFocusedTerrain(
    map: number[][],
    rooms: Room[],
    terrainEffects: Map<string, TileEffect>,
    config: TacticalGenerationConfig
  ): void {
    // エネルギー消費地帯を通路に配置
    const corridorTiles = this.findCorridorTiles(map, rooms);
    const drainZoneCount = Math.floor(corridorTiles.length * 0.2);

    for (let i = 0; i < drainZoneCount; i++) {
      if (corridorTiles.length === 0) break;

      const randomIndex = Math.floor(Math.random() * corridorTiles.length);
      const tile = corridorTiles[randomIndex];

      terrainEffects.set(`${tile.x},${tile.y}`, TileEffect.ENERGY_DRAIN);
      corridorTiles.splice(randomIndex, 1);
    }

    // エネルギー回復地帯を部屋の隅に配置
    for (const room of rooms) {
      if (Math.random() < 0.3) {
        // 30%の確率
        const boostTile = {
          x: room.x + 1,
          y: room.y + 1,
        };

        if (this.isValidPosition(boostTile.x, boostTile.y)) {
          terrainEffects.set(`${boostTile.x},${boostTile.y}`, TileEffect.ENERGY_BOOST);
        }
      }
    }
  }

  /**
   * スキル選択重視の地形配置
   */
  private placeSkillFocusedTerrain(
    map: number[][],
    rooms: Room[],
    terrainEffects: Map<string, TileEffect>,
    config: TacticalGenerationConfig
  ): void {
    // 遮蔽地形の配置（防御スキル有利）
    this.placeCoverZones(map, rooms, terrainEffects);

    // スキル強化地形の配置
    this.placeSkillBoostZones(map, rooms, terrainEffects);

    // 露出地形の配置（リスク・リワード）
    this.placeExposedZones(map, rooms, terrainEffects);
  }

  /**
   * センサー活用重視の地形配置
   */
  private placeSensorFocusedTerrain(
    map: number[][],
    rooms: Room[],
    terrainEffects: Map<string, TileEffect>,
    config: TacticalGenerationConfig
  ): void {
    // センサー強化エリア
    const observationPoints = this.findObservationPoints(rooms);
    for (const point of observationPoints) {
      terrainEffects.set(`${point.x},${point.y}`, TileEffect.SENSOR_BOOST);

      // 周囲にも効果を配置
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;

          const nx = point.x + dx;
          const ny = point.y + dy;

          if (this.isValidPosition(nx, ny) && Math.random() < 0.5) {
            terrainEffects.set(`${nx},${ny}`, TileEffect.SENSOR_BOOST);
          }
        }
      }
    }

    // センサー妨害エリア
    const jammedAreas = this.findJammingAreas(rooms);
    for (const area of jammedAreas) {
      // 3x3エリアに妨害効果
      for (let dx = 0; dx < 3; dx++) {
        for (let dy = 0; dy < 3; dy++) {
          const jx = area.x + dx;
          const jy = area.y + dy;

          if (this.isValidPosition(jx, jy)) {
            terrainEffects.set(`${jx},${jy}`, TileEffect.SENSOR_JAMMING);
          }
        }
      }
    }
  }

  /**
   * 混合タイプの地形配置
   */
  private placeMixedTerrain(
    map: number[][],
    rooms: Room[],
    terrainEffects: Map<string, TileEffect>,
    config: TacticalGenerationConfig
  ): void {
    // バランスの取れた地形配置
    this.placeEnergyFocusedTerrain(map, rooms, terrainEffects, config);

    // 遮蔽地形を少し追加
    const coverCount = Math.floor(rooms.length * 0.5);
    this.placeLimitedCoverZones(map, rooms, terrainEffects, coverCount);

    // センサー効果を少し追加
    const sensorCount = Math.floor(rooms.length * 0.3);
    this.placeLimitedSensorEffects(map, rooms, terrainEffects, sensorCount);
  }

  /**
   * 遮蔽地形の配置
   */
  private placeCoverZones(
    map: number[][],
    rooms: Room[],
    terrainEffects: Map<string, TileEffect>
  ): void {
    // 各部屋の入り口付近に遮蔽
    for (const room of rooms) {
      const entrances = this.findRoomEntrances(room, map);

      for (const entrance of entrances) {
        // 入り口から少し離れた位置に遮蔽
        const coverPositions = this.calculateCoverPositions(entrance, room);

        for (const pos of coverPositions) {
          if (this.isValidPosition(pos.x, pos.y) && Math.random() < 0.7) {
            terrainEffects.set(`${pos.x},${pos.y}`, TileEffect.COVER);
          }
        }
      }
    }
  }

  /**
   * スキル強化地形の配置
   */
  private placeSkillBoostZones(
    map: number[][],
    rooms: Room[],
    terrainEffects: Map<string, TileEffect>
  ): void {
    // 大きな部屋の中央にスキル強化エリア
    for (const room of rooms) {
      if (room.width >= 6 && room.height >= 6) {
        const centerX = room.x + Math.floor(room.width / 2);
        const centerY = room.y + Math.floor(room.height / 2);

        // 2x2のスキル強化エリア
        for (let dx = 0; dx < 2; dx++) {
          for (let dy = 0; dy < 2; dy++) {
            const sx = centerX + dx - 1;
            const sy = centerY + dy - 1;

            if (this.isValidPosition(sx, sy)) {
              terrainEffects.set(`${sx},${sy}`, TileEffect.SKILL_BOOST);
            }
          }
        }
      }
    }
  }

  /**
   * 露出地形の配置（リスクとリワードのバランス）
   */
  private placeExposedZones(
    map: number[][],
    rooms: Room[],
    terrainEffects: Map<string, TileEffect>
  ): void {
    // 長い通路に露出エリア
    const longCorridors = this.findLongCorridors(map, rooms);

    for (const corridor of longCorridors) {
      // 通路の中央部分を露出エリアに
      const midIndex = Math.floor(corridor.length / 2);
      const midTile = corridor[midIndex];

      terrainEffects.set(`${midTile.x},${midTile.y}`, TileEffect.EXPOSED);

      // 周囲も露出効果
      for (let i = midIndex - 1; i <= midIndex + 1; i++) {
        if (i >= 0 && i < corridor.length && Math.random() < 0.6) {
          const tile = corridor[i];
          terrainEffects.set(`${tile.x},${tile.y}`, TileEffect.EXPOSED);
        }
      }
    }
  }

  /**
   * 観測ポイントを検出
   */
  private findObservationPoints(rooms: Room[]): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];

    for (const room of rooms) {
      // 部屋の角を観測ポイントとして使用
      const corners = [
        { x: room.x + 1, y: room.y + 1 }, // 左上
        { x: room.x + room.width - 2, y: room.y + 1 }, // 右上
        { x: room.x + 1, y: room.y + room.height - 2 }, // 左下
        { x: room.x + room.width - 2, y: room.y + room.height - 2 }, // 右下
      ];

      // ランダムに1-2個の角を選択
      const selectedCorners = corners
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.random() < 0.5 ? 1 : 2);

      points.push(...selectedCorners);
    }

    return points;
  }

  /**
   * センサー妨害エリアを検出
   */
  private findJammingAreas(rooms: Room[]): Array<{ x: number; y: number }> {
    const areas: Array<{ x: number; y: number }> = [];

    // 大きな部屋の一部を妨害エリアに
    for (const room of rooms) {
      if (room.width >= 8 && room.height >= 8 && Math.random() < 0.4) {
        areas.push({
          x: room.x + Math.floor(room.width * 0.3),
          y: room.y + Math.floor(room.height * 0.3),
        });
      }
    }

    return areas;
  }

  /**
   * 制限された遮蔽地形の配置
   */
  private placeLimitedCoverZones(
    map: number[][],
    rooms: Room[],
    terrainEffects: Map<string, TileEffect>,
    maxCount: number
  ): void {
    let count = 0;

    for (const room of rooms) {
      if (count >= maxCount) break;

      if (Math.random() < 0.5) {
        const coverX = room.x + Math.floor(room.width / 2);
        const coverY = room.y + Math.floor(room.height / 2);

        if (this.isValidPosition(coverX, coverY)) {
          terrainEffects.set(`${coverX},${coverY}`, TileEffect.COVER);
          count++;
        }
      }
    }
  }

  /**
   * 制限されたセンサー効果の配置
   */
  private placeLimitedSensorEffects(
    map: number[][],
    rooms: Room[],
    terrainEffects: Map<string, TileEffect>,
    maxCount: number
  ): void {
    let count = 0;

    for (const room of rooms) {
      if (count >= maxCount) break;

      if (Math.random() < 0.4) {
        const sensorX = room.x + room.width - 2;
        const sensorY = room.y + room.height - 2;

        if (this.isValidPosition(sensorX, sensorY)) {
          terrainEffects.set(`${sensorX},${sensorY}`, TileEffect.SENSOR_BOOST);
          count++;
        }
      }
    }
  }

  // ヘルパーメソッド群

  private findCorridorTiles(map: number[][], rooms: Room[]): Array<{ x: number; y: number }> {
    const corridorTiles: Array<{ x: number; y: number }> = [];
    const roomTiles = new Set<string>();

    // 部屋のタイルをマーク
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          roomTiles.add(`${x},${y}`);
        }
      }
    }

    // 通路タイルを検出
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        if (map[y][x] === 1 && !roomTiles.has(`${x},${y}`)) {
          corridorTiles.push({ x, y });
        }
      }
    }

    return corridorTiles;
  }

  private findRoomEntrances(room: Room, map: number[][]): Array<{ x: number; y: number }> {
    const entrances: Array<{ x: number; y: number }> = [];

    // 部屋の境界をチェック
    for (let x = room.x; x < room.x + room.width; x++) {
      // 上下の境界
      if (this.isValidPosition(x, room.y - 1) && map[room.y - 1][x] === 1) {
        entrances.push({ x, y: room.y });
      }
      if (this.isValidPosition(x, room.y + room.height) && map[room.y + room.height][x] === 1) {
        entrances.push({ x, y: room.y + room.height - 1 });
      }
    }

    for (let y = room.y; y < room.y + room.height; y++) {
      // 左右の境界
      if (this.isValidPosition(room.x - 1, y) && map[y][room.x - 1] === 1) {
        entrances.push({ x: room.x, y });
      }
      if (this.isValidPosition(room.x + room.width, y) && map[y][room.x + room.width] === 1) {
        entrances.push({ x: room.x + room.width - 1, y });
      }
    }

    return entrances;
  }

  private calculateCoverPositions(
    entrance: { x: number; y: number },
    room: Room
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];

    // 入り口から部屋内部の方向に2-3タイル離れた位置
    const centerX = room.x + Math.floor(room.width / 2);
    const centerY = room.y + Math.floor(room.height / 2);

    const dx = centerX > entrance.x ? 1 : -1;
    const dy = centerY > entrance.y ? 1 : -1;

    positions.push(
      { x: entrance.x + dx * 2, y: entrance.y + dy * 2 },
      { x: entrance.x + dx * 3, y: entrance.y + dy * 2 },
      { x: entrance.x + dx * 2, y: entrance.y + dy * 3 }
    );

    return positions.filter(
      (pos) =>
        pos.x >= room.x &&
        pos.x < room.x + room.width &&
        pos.y >= room.y &&
        pos.y < room.y + room.height
    );
  }

  private findLongCorridors(
    map: number[][],
    rooms: Room[]
  ): Array<Array<{ x: number; y: number }>> {
    const corridors: Array<Array<{ x: number; y: number }>> = [];
    const corridorTiles = this.findCorridorTiles(map, rooms);

    // 簡単な実装：直線的な通路を検出
    for (const tile of corridorTiles) {
      // 水平方向の連続性をチェック
      const horizontalCorridor: Array<{ x: number; y: number }> = [tile];

      // 右方向に拡張
      let rightX = tile.x + 1;
      while (rightX < this.width && map[tile.y][rightX] === 1) {
        horizontalCorridor.push({ x: rightX, y: tile.y });
        rightX++;
      }

      // 左方向に拡張
      let leftX = tile.x - 1;
      while (leftX >= 0 && map[tile.y][leftX] === 1) {
        horizontalCorridor.unshift({ x: leftX, y: tile.y });
        leftX--;
      }

      // 長い通路（6タイル以上）を追加
      if (horizontalCorridor.length >= 6) {
        corridors.push(horizontalCorridor);
      }
    }

    return corridors;
  }

  private isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}
