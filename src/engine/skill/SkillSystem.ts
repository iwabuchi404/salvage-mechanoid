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

  // BU-3 段階1: クールダウンを「失効ターン番号」で保持する。
  // 旧実装は「残りターン数」を player_turn_started で減らしていたが、
  // これはターン番号がない時代の代替手段。turn_started が導入されたので
  // 「使用時の turnNumber + cooldown + 1」を失効ターンとする。
  // getCooldownRemaining は現在ターンとの差で算出する。
  private cooldownUntilTurn: Map<string, number> = new Map();

  // 現在のターン番号（turn_started で更新）
  private currentTurn = 0;

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
   *
   * BU-3 段階1: クールダウン更新を player_turn_started から turn_started へ変更。
   * ターン番号ベースで失効を判定するため、毎ターンの減算処理は不要。
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) {
      return;
    }

    // ターン番号が進んだら現在ターンを更新
    this.eventSystem.on('turn_started', (data) => {
      this.currentTurn = data.turn;
    });
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

    // BU-3 段階1: クールダウンを失効ターン番号で設定
    // 現在ターン + cooldown + 1 が失効ターン（cooldown=3 なら3ターン後の同じターンで使用可能）
    if (skill.cooldown > 0) {
      this.cooldownUntilTurn.set(skillId, this.currentTurn + skill.cooldown + 1);
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
   *
   * BU-3 段階1: 現在ターンが失効ターン未満ならクールダウン中。
   */
  isOnCooldown(skillId: string): boolean {
    const untilTurn = this.cooldownUntilTurn.get(skillId);
    if (untilTurn === undefined) return false;
    return this.currentTurn < untilTurn;
  }

  /**
   * スキルの残りクールダウンを取得
   * @param skillId スキルID
   * @returns 残りターン数（0ならクールダウン完了）
   *
   * BU-3 段階1: 失効ターン - 現在ターン で算出。
   */
  getCooldownRemaining(skillId: string): number {
    const untilTurn = this.cooldownUntilTurn.get(skillId);
    if (untilTurn === undefined) return 0;
    return Math.max(0, untilTurn - this.currentTurn);
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
