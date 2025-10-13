import { PlacedPortal, PlacedCharger, Room, EnergyPoint } from '../../types';

/**
 * 特殊オブジェクト配置システム
 * ポータルとエネルギーチャージャーを配置
 */
export class SpecialObjectPlacer {
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * ポータルを配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param count 配置数（デフォルト2個）
   * @param playerStartPos プレイヤー開始位置（遠くに配置するため）
   * @returns 配置されたポータルのリスト
   */
  placePortals(
    map: number[][],
    rooms: Room[],
    count = 2,
    playerStartPos?: { x: number; y: number }
  ): PlacedPortal[] {
    console.log('SpecialObjectPlacer: Placing portals...');
    const portals: PlacedPortal[] = [];

    // 大きな部屋を優先
    const largeRooms = rooms
      .filter((room) => room.width >= 6 && room.height >= 6)
      .sort((a, b) => b.width * b.height - a.width * a.height);

    // 使用する部屋リスト（大きい部屋がなければ全部屋）
    const targetRooms = largeRooms.length > 0 ? largeRooms : rooms;

    for (let i = 0; i < count && i < targetRooms.length; i++) {
      const room = targetRooms[i];

      // 部屋の中心付近にポータルを配置
      const centerX = room.x + Math.floor(room.width / 2);
      const centerY = room.y + Math.floor(room.height / 2);

      // ランダムオフセット（中心からずらす）
      const offsetX = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
      const offsetY = Math.floor(Math.random() * 3) - 1;

      const x = centerX + offsetX;
      const y = centerY + offsetY;

      // 歩行可能タイルかチェック
      if (!this.isWalkable(map, x, y)) {
        // 中心がダメなら部屋内でランダムに探す
        const validPos = this.findValidPositionInRoom(map, room);
        if (!validPos) continue;

        portals.push({
          id: `portal_${Date.now()}_${i}`,
          x: validPos.x,
          y: validPos.y,
          active: true,
        });
      } else {
        portals.push({
          id: `portal_${Date.now()}_${i}`,
          x,
          y,
          active: true,
        });
      }
    }

    console.log(`SpecialObjectPlacer: Placed ${portals.length} portals`);
    return portals;
  }

  /**
   * エネルギーチャージャーを配置
   * @param map マップデータ
   * @param rooms 部屋のリスト
   * @param energyPoints エネルギーポイントのリスト
   * @param playerLevel プレイヤーレベル
   * @param difficulty 難易度
   * @returns 配置されたチャージャーのリスト
   */
  placeEnergyChargers(
    map: number[][],
    rooms: Room[],
    energyPoints: EnergyPoint[] = [],
    playerLevel = 1,
    difficulty = 1
  ): PlacedCharger[] {
    console.log('SpecialObjectPlacer: Placing energy chargers...');
    const chargers: PlacedCharger[] = [];

    // 難易度に応じてチャージャー数を決定
    // 難易度が高いほど少なく（エネルギー管理が厳しい）
    const baseCount = Math.max(1, Math.floor(rooms.length / 4));
    const count = Math.max(1, Math.floor(baseCount / difficulty));

    console.log(`Placing ${count} chargers (base: ${baseCount}, difficulty: ${difficulty})`);

    // エネルギーポイント近くに配置（優先）
    if (energyPoints.length > 0) {
      const chargersNearEnergy = Math.min(count, energyPoints.length);

      for (let i = 0; i < chargersNearEnergy; i++) {
        const energyPoint = energyPoints[i];

        // エネルギーポイント近くの部屋を探す
        const nearbyRoom = this.findNearestRoom(energyPoint.x, energyPoint.y, rooms);

        if (nearbyRoom) {
          const validPos = this.findValidPositionInRoom(map, nearbyRoom);
          if (validPos) {
            chargers.push({
              id: `charger_${Date.now()}_${i}`,
              x: validPos.x,
              y: validPos.y,
              chargeAmount: this.calculateChargeAmount(playerLevel),
              maxUses: this.calculateMaxUses(difficulty),
              remainingUses: this.calculateMaxUses(difficulty),
              rechargeTime: 10, // 10ターンで再チャージ
            });
          }
        }
      }
    }

    // 残りをランダムな部屋に配置
    const remainingCount = count - chargers.length;
    const shuffledRooms = [...rooms].sort(() => Math.random() - 0.5);

    for (let i = 0; i < remainingCount && i < shuffledRooms.length; i++) {
      const room = shuffledRooms[i];
      const validPos = this.findValidPositionInRoom(map, room);

      if (validPos) {
        chargers.push({
          id: `charger_${Date.now()}_${chargers.length}`,
          x: validPos.x,
          y: validPos.y,
          chargeAmount: this.calculateChargeAmount(playerLevel),
          maxUses: this.calculateMaxUses(difficulty),
          remainingUses: this.calculateMaxUses(difficulty),
          rechargeTime: 10,
        });
      }
    }

    console.log(`SpecialObjectPlacer: Placed ${chargers.length} energy chargers`);
    return chargers;
  }

  /**
   * 部屋内で歩行可能な位置を探す
   */
  private findValidPositionInRoom(map: number[][], room: Room): { x: number; y: number } | null {
    const attempts = 20;

    for (let i = 0; i < attempts; i++) {
      const x = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
      const y = room.y + 1 + Math.floor(Math.random() * (room.height - 2));

      if (this.isWalkable(map, x, y)) {
        return { x, y };
      }
    }

    return null;
  }

  /**
   * 最も近い部屋を探す
   */
  private findNearestRoom(x: number, y: number, rooms: Room[]): Room | null {
    if (rooms.length === 0) return null;

    let nearestRoom = rooms[0];
    let minDistance = this.getDistanceToRoom(x, y, nearestRoom);

    for (const room of rooms) {
      const distance = this.getDistanceToRoom(x, y, room);
      if (distance < minDistance) {
        minDistance = distance;
        nearestRoom = room;
      }
    }

    return nearestRoom;
  }

  /**
   * 点から部屋までの距離を計算（部屋の中心まで）
   */
  private getDistanceToRoom(x: number, y: number, room: Room): number {
    const centerX = room.x + Math.floor(room.width / 2);
    const centerY = room.y + Math.floor(room.height / 2);
    return Math.abs(x - centerX) + Math.abs(y - centerY);
  }

  /**
   * チャージ量を計算（プレイヤーレベルに応じて）
   */
  private calculateChargeAmount(playerLevel: number): number {
    return Math.floor(20 + playerLevel * 5);
  }

  /**
   * 最大使用回数を計算（難易度に応じて）
   */
  private calculateMaxUses(difficulty: number): number {
    // 難易度が高いほど使用回数が少ない
    if (difficulty >= 3) return 1; // 高難易度: 1回のみ
    if (difficulty >= 2) return 2; // 中難易度: 2回
    return 3; // 低難易度: 3回
  }

  /**
   * 歩行可能か確認
   */
  private isWalkable(map: number[][], x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    return map[y][x] > 0;
  }
}
