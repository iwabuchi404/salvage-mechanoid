import { TacticalElement, TacticalElementType, TacticalGenerationConfig, Room } from '../../types';

/**
 * 戦術的要素配置システム
 * 高台、チョークポイント、観測所などの戦術的要素を配置
 */
export class TacticalElementPlacer {
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * 戦術的位置の配置
   * @param rooms 部屋リスト
   * @param config 設定
   * @returns 戦術的要素リスト
   */
  placeTacticalPositions(rooms: Room[], config: TacticalGenerationConfig): TacticalElement[] {
    console.log('Placing tactical positions...');

    const elements: TacticalElement[] = [];

    // 高台の配置
    elements.push(...this.placeHighGround(rooms, config));

    // チョークポイントの配置
    elements.push(...this.placeChokePoints(rooms, config));

    // 観測ポイントの配置（情報戦重視の場合）
    if (config.primaryTacticalFocus === 'sensor_usage' || config.primaryTacticalFocus === 'mixed') {
      elements.push(...this.placeObservationPosts(rooms, config));
    }

    // 補給キャッシュの配置
    elements.push(...this.placeSupplyCaches(rooms, config));

    // 待ち伏せポイントの配置
    elements.push(...this.placeAmbushPoints(rooms, config));

    // 脱出ルートの配置
    elements.push(...this.placeEscapeRoutes(rooms, config));

    console.log(`Placed ${elements.length} tactical elements`);
    return elements;
  }

  /**
   * 高台の配置
   * 射程と視界にボーナスを提供
   */
  private placeHighGround(rooms: Room[], config: TacticalGenerationConfig): TacticalElement[] {
    const highGrounds: TacticalElement[] = [];

    // 大きな部屋の角に高台を配置
    for (const room of rooms) {
      if (room.width >= 6 && room.height >= 6) {
        // 部屋の4つの角を候補とする
        const candidates = [
          { x: room.x + 1, y: room.y + 1 }, // 左上
          { x: room.x + room.width - 2, y: room.y + 1 }, // 右上
          { x: room.x + 1, y: room.y + room.height - 2 }, // 左下
          { x: room.x + room.width - 2, y: room.y + room.height - 2 }, // 右下
        ];

        // ランダムに1つ選択
        const selected = candidates[Math.floor(Math.random() * candidates.length)];

        highGrounds.push({
          x: selected.x,
          y: selected.y,
          type: TacticalElementType.HIGH_GROUND,
          effect: {
            range: 2,
            bonus: 1,
            description: 'Provides +1 range and +20% damage bonus',
          },
          accessibility: {
            energyCost: 2,
          },
        });
      }
    }

    // 小さな部屋でも確率的に配置
    for (const room of rooms) {
      if (room.width < 6 || room.height < 6) {
        if (Math.random() < 0.3) {
          // 30%の確率
          const center = {
            x: room.x + Math.floor(room.width / 2),
            y: room.y + Math.floor(room.height / 2),
          };

          highGrounds.push({
            x: center.x,
            y: center.y,
            type: TacticalElementType.HIGH_GROUND,
            effect: {
              range: 1,
              bonus: 1,
              description: 'Provides +1 range and +10% damage bonus',
            },
            accessibility: {
              energyCost: 1,
            },
          });
        }
      }
    }

    return highGrounds;
  }

  /**
   * チョークポイントの配置
   * 戦術的に重要な通路の制御点
   */
  private placeChokePoints(rooms: Room[], config: TacticalGenerationConfig): TacticalElement[] {
    const chokePoints: TacticalElement[] = [];

    if (rooms.length < 3) return chokePoints;

    // 部屋間の接続点をチョークポイントとする
    for (let i = 1; i < rooms.length - 1; i++) {
      const currentRoom = rooms[i];
      const nextRoom = rooms[i + 1];

      // 2つの部屋の間の位置を計算
      const chokePosition = this.calculateChokePointPosition(currentRoom, nextRoom);

      if (chokePosition) {
        chokePoints.push({
          x: chokePosition.x,
          y: chokePosition.y,
          type: TacticalElementType.CHOKEPOINT,
          effect: {
            description: 'Defensive position that controls movement between areas',
          },
          accessibility: {
            requiresSkill: 'tactical_positioning',
          },
        });
      }
    }

    return chokePoints;
  }

  /**
   * 観測ポイントの配置
   * 情報収集と偵察に特化
   */
  private placeObservationPosts(
    rooms: Room[],
    config: TacticalGenerationConfig
  ): TacticalElement[] {
    const observationPosts: TacticalElement[] = [];

    // 中央付近の部屋に観測所を配置
    const centralRoomIndex = Math.floor(rooms.length / 2);
    const centralRoom = rooms[centralRoomIndex];

    // 部屋の中央に観測所
    const observationPosition = {
      x: centralRoom.x + Math.floor(centralRoom.width / 2),
      y: centralRoom.y + Math.floor(centralRoom.height / 2),
    };

    observationPosts.push({
      x: observationPosition.x,
      y: observationPosition.y,
      type: TacticalElementType.OBSERVATION_POST,
      effect: {
        range: 5,
        description: 'Reveals enemy positions and provides tactical information',
      },
      accessibility: {
        requiresSkill: 'advanced_sensors',
        energyCost: 3,
      },
    });

    // 大きなマップの場合、追加の観測ポイント
    if (rooms.length >= 6) {
      const lateRoom = rooms[Math.floor(rooms.length * 0.75)];

      observationPosts.push({
        x: lateRoom.x + 1,
        y: lateRoom.y + 1,
        type: TacticalElementType.OBSERVATION_POST,
        effect: {
          range: 3,
          description: 'Secondary observation point for extended coverage',
        },
        accessibility: {
          requiresSkill: 'sensors',
          energyCost: 2,
        },
      });
    }

    return observationPosts;
  }

  /**
   * 補給キャッシュの配置
   * 戦術的リソースの提供
   */
  private placeSupplyCaches(rooms: Room[], config: TacticalGenerationConfig): TacticalElement[] {
    const supplyCaches: TacticalElement[] = [];

    // エネルギー管理が厳しい場合、補給キャッシュを配置
    if (config.energyTightness === 'tight' || config.energyTightness === 'critical') {
      // 隠れた場所に補給キャッシュ
      for (let i = 2; i < rooms.length; i += 3) {
        const room = rooms[i];

        // 部屋の隅に配置
        const cachePosition = {
          x: room.x + room.width - 2,
          y: room.y + room.height - 2,
        };

        supplyCaches.push({
          x: cachePosition.x,
          y: cachePosition.y,
          type: TacticalElementType.SUPPLY_CACHE,
          effect: {
            description: 'Hidden cache containing energy packs and tactical equipment',
          },
          accessibility: {
            requiresSkill: 'exploration',
            energyCost: 1,
          },
        });
      }
    }

    return supplyCaches;
  }

  /**
   * 待ち伏せポイントの配置
   * 奇襲攻撃に適した位置
   */
  private placeAmbushPoints(rooms: Room[], config: TacticalGenerationConfig): TacticalElement[] {
    const ambushPoints: TacticalElement[] = [];

    // 通路の入り口付近に待ち伏せポイント
    for (let i = 1; i < rooms.length - 1; i++) {
      const room = rooms[i];

      if (Math.random() < 0.4) {
        // 40%の確率
        // 部屋の入り口付近
        const ambushPosition = {
          x: room.x,
          y: room.y + Math.floor(room.height / 2),
        };

        ambushPoints.push({
          x: ambushPosition.x,
          y: ambushPosition.y,
          type: TacticalElementType.AMBUSH_POINT,
          effect: {
            bonus: 2,
            description: 'Provides surprise attack bonus and concealment',
          },
          accessibility: {
            requiresSkill: 'stealth',
            energyCost: 2,
          },
        });
      }
    }

    return ambushPoints;
  }

  /**
   * 脱出ルートの配置
   * 緊急時の退避路
   */
  private placeEscapeRoutes(rooms: Room[], config: TacticalGenerationConfig): TacticalElement[] {
    const escapeRoutes: TacticalElement[] = [];

    // 危険度の高い設定の場合、脱出ルートを配置
    if (config.energyTightness === 'critical' || config.playerLevel >= 3) {
      // 後半の部屋に脱出ルート
      const dangerousRoomIndex = Math.floor(rooms.length * 0.8);
      if (dangerousRoomIndex < rooms.length) {
        const dangerousRoom = rooms[dangerousRoomIndex];

        const escapePosition = {
          x: dangerousRoom.x + dangerousRoom.width - 1,
          y: dangerousRoom.y + dangerousRoom.height - 1,
        };

        escapeRoutes.push({
          x: escapePosition.x,
          y: escapePosition.y,
          type: TacticalElementType.ESCAPE_ROUTE,
          effect: {
            description: 'Emergency escape route for quick retreat',
          },
          accessibility: {
            requiresSkill: 'mobility',
            energyCost: 5,
          },
        });
      }
    }

    return escapeRoutes;
  }

  /**
   * チョークポイントの位置を計算
   */
  private calculateChokePointPosition(room1: Room, room2: Room): { x: number; y: number } | null {
    // 2つの部屋の中心を結ぶ線の中点付近
    const center1 = {
      x: room1.x + Math.floor(room1.width / 2),
      y: room1.y + Math.floor(room1.height / 2),
    };

    const center2 = {
      x: room2.x + Math.floor(room2.width / 2),
      y: room2.y + Math.floor(room2.height / 2),
    };

    const midpoint = {
      x: Math.floor((center1.x + center2.x) / 2),
      y: Math.floor((center1.y + center2.y) / 2),
    };

    // 有効な位置かチェック
    if (this.isValidPosition(midpoint.x, midpoint.y)) {
      return midpoint;
    }

    return null;
  }

  /**
   * 特殊な戦術的要素の配置
   * ステージタイプ特有の要素
   */
  placeSpecialTacticalElements(rooms: Room[], config: TacticalGenerationConfig): TacticalElement[] {
    const specialElements: TacticalElement[] = [];

    switch (config.primaryTacticalFocus) {
      case 'energy_management':
        specialElements.push(...this.placeEnergySpecialElements(rooms, config));
        break;
      case 'skill_selection':
        specialElements.push(...this.placeSkillSpecialElements(rooms, config));
        break;
      case 'sensor_usage':
        specialElements.push(...this.placeSensorSpecialElements(rooms, config));
        break;
    }

    return specialElements;
  }

  /**
   * エネルギー管理特化の特殊要素
   */
  private placeEnergySpecialElements(
    rooms: Room[],
    config: TacticalGenerationConfig
  ): TacticalElement[] {
    const elements: TacticalElement[] = [];

    // エネルギー効率化装置
    if (rooms.length >= 4) {
      const midRoom = rooms[Math.floor(rooms.length / 2)];

      elements.push({
        x: midRoom.x + Math.floor(midRoom.width / 2),
        y: midRoom.y + Math.floor(midRoom.height / 2),
        type: 'energy_optimizer' as TacticalElementType,
        effect: {
          description: 'Reduces energy consumption of all actions by 25%',
          bonus: 0.25,
        },
        accessibility: {
          requiresSkill: 'energy_engineering',
          energyCost: 10,
        },
      });
    }

    return elements;
  }

  /**
   * スキル選択特化の特殊要素
   */
  private placeSkillSpecialElements(
    rooms: Room[],
    config: TacticalGenerationConfig
  ): TacticalElement[] {
    const elements: TacticalElement[] = [];

    // スキル訓練場
    if (rooms.length >= 5) {
      const trainingRoom = rooms[Math.floor(rooms.length * 0.6)];

      elements.push({
        x: trainingRoom.x + 2,
        y: trainingRoom.y + 2,
        type: 'training_facility' as TacticalElementType,
        effect: {
          description: 'Temporarily enhances skill effectiveness by 50%',
          bonus: 0.5,
        },
        accessibility: {
          energyCost: 5,
        },
      });
    }

    return elements;
  }

  /**
   * センサー活用特化の特殊要素
   */
  private placeSensorSpecialElements(
    rooms: Room[],
    config: TacticalGenerationConfig
  ): TacticalElement[] {
    const elements: TacticalElement[] = [];

    // 高度センサーアレイ
    if (rooms.length >= 3) {
      const sensorRoom = rooms[Math.floor(rooms.length * 0.3)];

      elements.push({
        x: sensorRoom.x + Math.floor(sensorRoom.width / 2),
        y: sensorRoom.y + Math.floor(sensorRoom.height / 2),
        type: 'sensor_array' as TacticalElementType,
        effect: {
          range: 10,
          description: 'Provides complete map awareness and enemy tracking',
        },
        accessibility: {
          requiresSkill: 'sensor_mastery',
          energyCost: 8,
        },
      });
    }

    return elements;
  }

  /**
   * 戦術的要素の価値評価
   * @param elements 配置された要素
   * @returns 評価結果
   */
  evaluateTacticalValue(elements: TacticalElement[]): {
    totalValue: number;
    distribution: Record<string, number>;
    recommendation: string;
  } {
    const distribution: Record<string, number> = {};
    let totalValue = 0;

    for (const element of elements) {
      const type = element.type.toString();
      distribution[type] = (distribution[type] || 0) + 1;

      // 要素タイプごとの価値を計算
      switch (element.type) {
        case TacticalElementType.HIGH_GROUND:
          totalValue += 3;
          break;
        case TacticalElementType.CHOKEPOINT:
          totalValue += 2;
          break;
        case TacticalElementType.OBSERVATION_POST:
          totalValue += 4;
          break;
        case TacticalElementType.AMBUSH_POINT:
          totalValue += 2;
          break;
        case TacticalElementType.SUPPLY_CACHE:
          totalValue += 1;
          break;
        case TacticalElementType.ESCAPE_ROUTE:
          totalValue += 1;
          break;
        default:
          totalValue += 1;
          break;
      }
    }

    let recommendation = '';
    if (totalValue < 5) {
      recommendation = 'Consider adding more tactical elements for increased depth';
    } else if (totalValue > 15) {
      recommendation = 'May have too many tactical elements - consider reducing complexity';
    } else {
      recommendation = 'Tactical element distribution is well balanced';
    }

    return {
      totalValue,
      distribution,
      recommendation,
    };
  }

  private isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}
