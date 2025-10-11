import { EnergyPoint, EnergyPointType, TacticalGenerationConfig, Room } from '../../types';

/**
 * エネルギーポイント配置システム
 * 戦術的に意味のあるエネルギーポイント配置を行う
 */
export class EnergyPointPlacer {
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * 戦略的エネルギーポイントの配置
   * @param rooms 部屋のリスト
   * @param config 戦術的生成設定
   * @returns 配置されたエネルギーポイント
   */
  placeStrategicEnergyPoints(rooms: Room[], config: TacticalGenerationConfig): EnergyPoint[] {
    console.log('Placing strategic energy points...');

    const energyPoints: EnergyPoint[] = [];

    if (rooms.length < 2) {
      console.warn('Not enough rooms for strategic energy point placement');
      return energyPoints;
    }

    // エネルギー厳しさに応じた配置戦略
    switch (config.energyTightness) {
      case 'relaxed':
        energyPoints.push(...this.placeRelaxedEnergyPoints(rooms, config));
        break;
      case 'balanced':
        energyPoints.push(...this.placeBalancedEnergyPoints(rooms, config));
        break;
      case 'tight':
        energyPoints.push(...this.placeTightEnergyPoints(rooms, config));
        break;
      case 'critical':
        energyPoints.push(...this.placeCriticalEnergyPoints(rooms, config));
        break;
    }

    console.log(`Placed ${energyPoints.length} strategic energy points`);
    return energyPoints;
  }

  /**
   * リラックス設定：豊富なエネルギー供給
   */
  private placeRelaxedEnergyPoints(rooms: Room[], config: TacticalGenerationConfig): EnergyPoint[] {
    const points: EnergyPoint[] = [];

    // 各部屋に何らかのエネルギー補給
    for (let i = 1; i < rooms.length; i += 2) {
      const room = rooms[i];
      const center = this.getRoomCenter(room);

      points.push({
        x: center.x,
        y: center.y,
        type: i % 4 === 1 ? EnergyPointType.CHARGING_STATION : EnergyPointType.ENERGY_TANK,
        recoveryAmount: i % 4 === 1 ? 30 : 50,
        turnsRequired: i % 4 === 1 ? 3 : undefined,
      });
    }

    return points;
  }

  /**
   * バランス設定：計画的なエネルギー管理が必要
   */
  private placeBalancedEnergyPoints(
    rooms: Room[],
    config: TacticalGenerationConfig
  ): EnergyPoint[] {
    const points: EnergyPoint[] = [];

    // 早期充電ステーション（戦術的判断の機会）
    if (rooms.length >= 3) {
      const earlyRoomIndex = Math.floor(rooms.length * 0.25);
      const earlyRoom = rooms[earlyRoomIndex];
      const earlyCenter = this.getRoomCenter(earlyRoom);

      points.push({
        x: earlyCenter.x,
        y: earlyCenter.y,
        type: EnergyPointType.CHARGING_STATION,
        recoveryAmount: 30,
        turnsRequired: 3,
      });
    }

    // 中間地点のバッテリーパック（選択的使用）
    if (rooms.length >= 5) {
      const midRoomIndex = Math.floor(rooms.length * 0.6);
      const midRoom = rooms[midRoomIndex];
      const midCenter = this.getRoomCenter(midRoom);

      points.push({
        x: midCenter.x,
        y: midCenter.y,
        type: EnergyPointType.BATTERY_PACK,
        recoveryAmount: 25,
      });
    }

    // 終盤のエネルギータンク（最終戦前の準備）
    if (rooms.length >= 2) {
      const lateRoomIndex = rooms.length - 2;
      const lateRoom = rooms[lateRoomIndex];
      const lateCenter = this.getRoomCenter(lateRoom);

      points.push({
        x: lateCenter.x,
        y: lateCenter.y,
        type: EnergyPointType.ENERGY_TANK,
        recoveryAmount: 40,
      });
    }

    return points;
  }

  /**
   * タイト設定：厳しいエネルギー管理が必要
   */
  private placeTightEnergyPoints(rooms: Room[], config: TacticalGenerationConfig): EnergyPoint[] {
    const points: EnergyPoint[] = [];

    // 最小限のエネルギー補給のみ
    if (rooms.length >= 4) {
      // 中間地点に1つだけ
      const midRoomIndex = Math.floor(rooms.length / 2);
      const midRoom = rooms[midRoomIndex];
      const midCenter = this.getRoomCenter(midRoom);

      points.push({
        x: midCenter.x,
        y: midCenter.y,
        type: EnergyPointType.CHARGING_STATION,
        recoveryAmount: 25,
        turnsRequired: 4, // より時間がかかる
      });
    }

    // 終盤に小さなバッテリーパック
    if (rooms.length >= 3) {
      const lateRoomIndex = rooms.length - 2;
      const lateRoom = rooms[lateRoomIndex];
      const lateCenter = this.getRoomCenter(lateRoom);

      points.push({
        x: lateCenter.x,
        y: lateCenter.y,
        type: EnergyPointType.BATTERY_PACK,
        recoveryAmount: 20,
      });
    }

    return points;
  }

  /**
   * クリティカル設定：極限のエネルギー管理
   */
  private placeCriticalEnergyPoints(
    rooms: Room[],
    config: TacticalGenerationConfig
  ): EnergyPoint[] {
    const points: EnergyPoint[] = [];

    // 1つのエネルギーポイントのみ、戦略的位置に配置
    if (rooms.length >= 3) {
      const criticalRoomIndex = Math.floor(rooms.length * 0.7); // 後半に配置
      const criticalRoom = rooms[criticalRoomIndex];
      const center = this.getRoomCenter(criticalRoom);

      points.push({
        x: center.x,
        y: center.y,
        type: EnergyPointType.POWER_NODE,
        recoveryAmount: 15,
        turnsRequired: 2,
      });
    }

    return points;
  }

  /**
   * エネルギー消費地帯の配置
   * @param map マップデータ
   * @param rooms 部屋リスト
   * @param config 設定
   * @returns 消費地帯の座標リスト
   */
  placeEnergyDrainZones(
    map: number[][],
    rooms: Room[],
    config: TacticalGenerationConfig
  ): Array<{ x: number; y: number; drainAmount: number }> {
    const drainZones: Array<{ x: number; y: number; drainAmount: number }> = [];

    // 通路にエネルギー消費地帯を配置
    const corridorTiles = this.findCorridorTiles(map, rooms);

    // 消費地帯の密度を決定
    let density = 0.1; // デフォルト
    switch (config.energyTightness) {
      case 'relaxed':
        density = 0.05;
        break;
      case 'balanced':
        density = 0.1;
        break;
      case 'tight':
        density = 0.15;
        break;
      case 'critical':
        density = 0.2;
        break;
    }

    const drainCount = Math.floor(corridorTiles.length * density);

    // ランダムに選択して配置
    for (let i = 0; i < drainCount && i < corridorTiles.length; i++) {
      const randomIndex = Math.floor(Math.random() * corridorTiles.length);
      const tile = corridorTiles[randomIndex];

      drainZones.push({
        x: tile.x,
        y: tile.y,
        drainAmount: this.calculateDrainAmount(config.energyTightness),
      });

      // 選択したタイルを削除（重複を避ける）
      corridorTiles.splice(randomIndex, 1);
    }

    console.log(`Placed ${drainZones.length} energy drain zones`);
    return drainZones;
  }

  /**
   * エネルギー効率チョークポイントの配置
   * @param rooms 部屋リスト
   * @returns チョークポイントリスト
   */
  placeEnergyChokePoints(rooms: Room[]): Array<{
    x: number;
    y: number;
    type: 'energy_gate' | 'efficiency_test';
    energyCost: number;
    bypass?: { skillRequired: string; alternativeCost: number };
  }> {
    const chokePoints: Array<{
      x: number;
      y: number;
      type: 'energy_gate' | 'efficiency_test';
      energyCost: number;
      bypass?: { skillRequired: string; alternativeCost: number };
    }> = [];

    if (rooms.length < 4) return chokePoints;

    // 中間地点にエネルギーゲート
    const midRoomIndex = Math.floor(rooms.length / 2);
    const midRoom = rooms[midRoomIndex];
    const gatePosition = {
      x: midRoom.x + midRoom.width,
      y: midRoom.y + Math.floor(midRoom.height / 2),
    };

    chokePoints.push({
      x: gatePosition.x,
      y: gatePosition.y,
      type: 'energy_gate',
      energyCost: 10,
      bypass: {
        skillRequired: 'energy_bypass',
        alternativeCost: 5,
      },
    });

    // 後半にエネルギー効率テスト
    if (rooms.length >= 6) {
      const lateRoomIndex = Math.floor(rooms.length * 0.75);
      const lateRoom = rooms[lateRoomIndex];
      const testPosition = {
        x: lateRoom.x - 1,
        y: lateRoom.y + Math.floor(lateRoom.height / 2),
      };

      chokePoints.push({
        x: testPosition.x,
        y: testPosition.y,
        type: 'efficiency_test',
        energyCost: 15,
        bypass: {
          skillRequired: 'energy_mastery',
          alternativeCost: 8,
        },
      });
    }

    console.log(`Placed ${chokePoints.length} energy choke points`);
    return chokePoints;
  }

  /**
   * 部屋の中心座標を取得
   */
  private getRoomCenter(room: Room): { x: number; y: number } {
    return {
      x: room.x + Math.floor(room.width / 2),
      y: room.y + Math.floor(room.height / 2),
    };
  }

  /**
   * 通路タイルを検出
   */
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

    // 通路タイルを検出（部屋以外の歩行可能タイル）
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        if (map[y][x] === 1 && !roomTiles.has(`${x},${y}`)) {
          // 1 = GRASS (歩行可能)
          corridorTiles.push({ x, y });
        }
      }
    }

    return corridorTiles;
  }

  /**
   * エネルギー消費量を計算
   */
  private calculateDrainAmount(tightness: string): number {
    switch (tightness) {
      case 'relaxed':
        return 1;
      case 'balanced':
        return 2;
      case 'tight':
        return 3;
      case 'critical':
        return 5;
      default:
        return 2;
    }
  }

  /**
   * エネルギー収支のバランスを検証
   * @param energyPoints エネルギーポイント
   * @param estimatedConsumption 推定消費量
   * @returns バランス評価
   */
  validateEnergyBalance(
    energyPoints: EnergyPoint[],
    estimatedConsumption: number
  ): {
    totalRecovery: number;
    balanceRatio: number;
    recommendation: string;
  } {
    const totalRecovery = energyPoints.reduce((total, point) => total + point.recoveryAmount, 0);

    const balanceRatio = totalRecovery / estimatedConsumption;

    let recommendation = '';
    if (balanceRatio > 1.2) {
      recommendation = 'Too much energy recovery - consider reducing points';
    } else if (balanceRatio < 0.7) {
      recommendation = 'Insufficient energy recovery - consider adding points';
    } else {
      recommendation = 'Energy balance is appropriate';
    }

    return {
      totalRecovery,
      balanceRatio,
      recommendation,
    };
  }
}
