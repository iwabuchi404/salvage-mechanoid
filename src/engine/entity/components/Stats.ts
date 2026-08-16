import { Component } from '../Component';
import { Entity } from '../Entity';
import { Engine } from '../../Engine';
import { EventSystem } from '../../events/EventSystem';
import { StatKey, StatSource, StatModifier, EffectiveStats } from '../stats/StatTypes';
import { resolveStats } from '../stats/resolveStats';

/**
 * 実効ステータスの正本コンポーネント。
 *
 * 基礎値と修飾子供給元（StatSource）から実効ステータスを導出する。
 * invalidate() で再計算後に stats_changed イベントを発行する。
 *
 * BU-2: このコンポーネントがプレイヤーの実効ステータスの唯一の正本となる。
 * HealthComponent / EnergyComponent / CombatSystem / FOVSystem / gameStore は
 * すべてここから値を読む。
 */
export class StatsComponent implements Component {
  type = 'stats';
  entity: Entity | null = null;

  private base: EffectiveStats;
  private sources: Map<string, StatSource> = new Map();
  private cached: EffectiveStats | null = null;
  /** loadout_changed リスナーの参照（destroy 時に解除するため保持） */
  private loadoutChangedListener: ((data: { sourceId: string }) => void) | null = null;

  constructor(base: EffectiveStats) {
    this.base = Object.freeze({ ...base });
  }

  initialize(): void {
    // 初期化時に一度計算しておく
    this.recalculate();

    // P2修正: loadout_changed イベントを購読し、装備変更時に再計算する。
    // PartsSystem が loadout_changed を発行するため、
    // StatsComponent 側で invalidate() を呼ぶ。
    // P1修正: リスナー参照をフィールドに保持し、destroy() で解除する。
    if (this.entity) {
      const eventSystem = Engine.instance.getSystem<EventSystem>('event');
      if (eventSystem) {
        this.loadoutChangedListener = () => {
          this.invalidate();
        };
        eventSystem.on('loadout_changed', this.loadoutChangedListener);
      }
    }
  }

  update(_deltaTime: number): void {
    // ステータスはイベント駆動で更新されるため、毎フレームの更新は不要
  }

  /** P1修正: 破棄時に loadout_changed リスナーを解除する */
  destroy(): void {
    if (this.loadoutChangedListener) {
      const eventSystem = Engine.instance.getSystem<EventSystem>('event');
      if (eventSystem) {
        eventSystem.off('loadout_changed', this.loadoutChangedListener);
      }
      this.loadoutChangedListener = null;
    }
    this.sources.clear();
    this.entity = null;
  }

  /** 修飾子の供給元を登録する（装備、状態異常など） */
  addSource(source: StatSource): void {
    this.sources.set(source.sourceId, source);
    this.invalidate();
  }

  /** 供給元を解除する */
  removeSource(sourceId: string): void {
    if (this.sources.delete(sourceId)) {
      this.invalidate();
    }
  }

  /**
   * 供給元の内容が変わったことを通知し、再計算させる。
   * 供給元の参照は保持したまま、キャッシュを無効化して再計算する。
   */
  invalidate(): void {
    this.recalculate();
  }

  /** 実効ステータスを取得する（キャッシュあり） */
  get(): EffectiveStats {
    if (this.cached === null) {
      this.recalculate();
    }
    return this.cached!;
  }

  /** 単一のステータス値を取得する */
  getValue(key: StatKey): number {
    return this.get()[key];
  }

  /** 基礎値を取得する */
  getBase(): EffectiveStats {
    return this.base;
  }

  /** 基礎値を設定する（レベルアップ時など） */
  setBase(base: EffectiveStats): void {
    this.base = Object.freeze({ ...base });
    this.invalidate();
  }

  /** 基礎値の単一キーを更新する */
  setBaseValue(key: StatKey, value: number): void {
    this.base = Object.freeze({ ...this.base, [key]: value });
    this.invalidate();
  }

  /** 全供給元の修飾子を集めて実効ステータスを再計算する */
  private recalculate(): void {
    const previous = this.cached;
    const modifiers: StatModifier[] = [];
    for (const source of this.sources.values()) {
      modifiers.push(...source.getModifiers());
    }
    this.cached = resolveStats(this.base, modifiers);

    // エンティティに紐付いている場合は stats_changed イベントを発行
    if (this.entity) {
      const eventSystem = Engine.instance.getSystem<EventSystem>('event');
      if (eventSystem && previous) {
        eventSystem.emit('stats_changed', {
          entityId: this.entity.id,
          stats: this.cached,
          previous,
        });
      }
    }
  }
}
