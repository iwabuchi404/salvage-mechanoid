import { System } from '../System';
import { Engine } from '../Engine';
import { EventSystem } from '../events/EventSystem';
import { Skill, SkillType, SkillTarget } from '../types';

/**
 * スキルシステム - プレイヤーのスキル管理
 * スキルの登録、使用、クールダウン管理を担当
 */
export class SkillSystem implements System {
  // エンジンへの参照
  private engine: Engine | null = null;

  // イベントシステムへの参照
  private eventSystem: EventSystem | null = null;

  // 登録されているスキルのマップ
  private skills: Map<string, Skill> = new Map();

  // プレイヤーが習得しているスキルID一覧
  private learnedSkills: Set<string> = new Set();

  // スキルのクールダウン状態（スキルID -> 残りターン数）
  private cooldowns: Map<string, number> = new Map();

  /**
   * システムを初期化
   * @param engine エンジンのインスタンス
   */
  async initialize(engine: Engine): Promise<void> {
    this.engine = engine;
    this.eventSystem = engine.getSystem<EventSystem>('event') || null;

    // イベントリスナーを設定
    this.setupEventListeners();

    // デフォルトスキルを登録
    this.registerDefaultSkills();

    console.log('SkillSystem initialized');
  }

  /**
   * 毎フレームの更新処理
   * @param _deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(_deltaTime: number): void {
    // スキルシステムはターンベース
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) {
      return;
    }

    // プレイヤーターン開始時にクールダウンを更新
    this.eventSystem.on('player_turn_started', () => {
      this.updateCooldowns();
    });
  }

  /**
   * クールダウンを更新（1ターン経過）
   */
  private updateCooldowns(): void {
    for (const [skillId, remainingTurns] of this.cooldowns.entries()) {
      if (remainingTurns > 0) {
        this.cooldowns.set(skillId, remainingTurns - 1);
      } else {
        this.cooldowns.delete(skillId);
      }
    }
  }

  /**
   * スキルを登録
   * @param skill スキル定義
   */
  registerSkill(skill: Skill): void {
    this.skills.set(skill.id, skill);
    console.log(`Skill registered: ${skill.name} (${skill.id})`);
  }

  /**
   * スキルを習得
   * @param skillId スキルID
   */
  learnSkill(skillId: string): void {
    if (!this.skills.has(skillId)) {
      console.warn(`Skill not found: ${skillId}`);
      return;
    }

    this.learnedSkills.add(skillId);
    console.log(`Skill learned: ${skillId}`);

    // スキル習得イベントを発行
    this.eventSystem?.emit('skill_learned', {
      skillId: skillId,
    });
  }

  /**
   * スキルを使用
   * @param skillId スキルID
   * @param playerId プレイヤーID
   * @param currentEnergy 現在のエネルギー
   * @returns 使用成功したかどうか
   */
  useSkill(skillId: string, playerId: string, currentEnergy: number): boolean {
    // スキルが存在するか確認
    const skill = this.skills.get(skillId);
    if (!skill) {
      console.warn(`Skill not found: ${skillId}`);
      return false;
    }

    // スキルを習得しているか確認
    if (!this.learnedSkills.has(skillId)) {
      console.warn(`Skill not learned: ${skillId}`);
      return false;
    }

    // クールダウン中か確認
    if (this.isOnCooldown(skillId)) {
      console.warn(`Skill on cooldown: ${skillId}`);
      return false;
    }

    // エネルギーが足りるか確認
    if (currentEnergy < skill.energyCost) {
      console.warn(
        `Not enough energy for skill: ${skillId} (required: ${skill.energyCost}, current: ${currentEnergy})`
      );
      return false;
    }

    // スキルを使用
    console.log(`Using skill: ${skill.name} (${skillId})`);

    // クールダウンを設定
    if (skill.cooldown > 0) {
      this.cooldowns.set(skillId, skill.cooldown);
    }

    // スキル使用イベントを発行
    this.eventSystem?.emit('skill_used', {
      playerId: playerId,
      skillId: skillId,
      skill: skill,
    });

    return true;
  }

  /**
   * スキルがクールダウン中かチェック
   * @param skillId スキルID
   * @returns クールダウン中ならtrue
   */
  isOnCooldown(skillId: string): boolean {
    const remaining = this.cooldowns.get(skillId);
    return remaining !== undefined && remaining > 0;
  }

  /**
   * スキルの残りクールダウンを取得
   * @param skillId スキルID
   * @returns 残りターン数（0ならクールダウン完了）
   */
  getCooldownRemaining(skillId: string): number {
    return this.cooldowns.get(skillId) || 0;
  }

  /**
   * 習得済みスキル一覧を取得
   * @returns 習得済みスキルの配列
   */
  getLearnedSkills(): Skill[] {
    const learnedSkillsArray: Skill[] = [];
    for (const skillId of this.learnedSkills) {
      const skill = this.skills.get(skillId);
      if (skill) {
        learnedSkillsArray.push(skill);
      }
    }
    return learnedSkillsArray;
  }

  /**
   * スキル情報を取得
   * @param skillId スキルID
   * @returns スキル定義
   */
  getSkill(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * スキルが使用可能かチェック
   * @param skillId スキルID
   * @param currentEnergy 現在のエネルギー
   * @returns 使用可能ならtrue
   */
  canUseSkill(skillId: string, currentEnergy: number): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;
    if (!this.learnedSkills.has(skillId)) return false;
    if (this.isOnCooldown(skillId)) return false;
    if (currentEnergy < skill.energyCost) return false;
    return true;
  }

  /**
   * デフォルトスキルを登録
   */
  private registerDefaultSkills(): void {
    // ダッシュスキル
    this.registerSkill({
      id: 'dash',
      name: 'ダッシュ',
      description: '前方3マスまで素早く移動する',
      icon: '⚡',
      type: SkillType.MOBILITY,
      target: SkillTarget.SELF,
      energyCost: 5,
      cooldown: 3,
      range: 3,
    });

    // 火炎放射スキル
    this.registerSkill({
      id: 'flamethrower',
      name: '火炎放射',
      description: '前方の敵に火炎ダメージを与える',
      icon: '🔥',
      type: SkillType.ATTACK,
      target: SkillTarget.AREA,
      energyCost: 10,
      cooldown: 5,
      range: 2,
      areaOfEffect: 1,
      damage: 15,
    });

    // シールドスキル
    this.registerSkill({
      id: 'shield',
      name: 'シールド',
      description: '3ターンの間ダメージを50%軽減',
      icon: '🛡',
      type: SkillType.DEFENSE,
      target: SkillTarget.SELF,
      energyCost: 8,
      cooldown: 8,
      range: 0,
      statusEffect: 'shield_3turns',
    });

    // 煙幕スキル
    this.registerSkill({
      id: 'smoke',
      name: '煙幕',
      description: '周囲に煙幕を展開して敵の視界を遮る',
      icon: '💨',
      type: SkillType.UTILITY,
      target: SkillTarget.AREA,
      energyCost: 6,
      cooldown: 4,
      range: 0,
      areaOfEffect: 2,
      statusEffect: 'smoke_2turns',
    });

    // 連続攻撃スキル
    this.registerSkill({
      id: 'rapid_fire',
      name: '連続攻撃',
      description: '前方の敵に3回連続攻撃',
      icon: '⚔',
      type: SkillType.ATTACK,
      target: SkillTarget.ENEMY,
      energyCost: 12,
      cooldown: 6,
      range: 1,
      damage: 8, // 1発あたり8ダメージ、計24ダメージ
    });

    // 修理スキル
    this.registerSkill({
      id: 'repair',
      name: '緊急修理',
      description: 'HPを30回復する',
      icon: '🔧',
      type: SkillType.SUPPORT,
      target: SkillTarget.SELF,
      energyCost: 15,
      cooldown: 10,
      range: 0,
      heal: 30,
    });

    // デフォルトで全スキルを習得（テスト用）
    this.learnSkill('dash');
    this.learnSkill('flamethrower');
    this.learnSkill('shield');
    this.learnSkill('smoke');
    this.learnSkill('rapid_fire');
    this.learnSkill('repair');
  }
}
