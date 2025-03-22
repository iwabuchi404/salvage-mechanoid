import { Component } from './Component';
import { Vector3 } from '../types';

/**
 * エンティティクラス - ゲーム内のオブジェクトを表現
 * コンポーネントベースのアーキテクチャにより、柔軟な機能拡張が可能
 */
export class Entity {
  // エンティティのID
  id: string;

  // エンティティのタイプ
  type: string;

  // エンティティが有効かどうか
  private _active = true;

  // エンティティのタグ（検索や識別に使用）
  private tags: Set<string> = new Set();

  // コンポーネントのマップ（タイプ -> コンポーネント）
  private components: Map<string, Component> = new Map();

  // 親エンティティ
  private parent: Entity | null = null;

  // 子エンティティのリスト
  private children: Entity[] = [];

  /**
   * コンストラクタ
   * @param id エンティティのID
   * @param type エンティティのタイプ
   */
  constructor(id: string, type: string) {
    this.id = id;
    this.type = type;
    console.log(`Entity created: ${id} (${type})`);
  }

  /**
   * エンティティがアクティブかどうかを取得
   */
  get active(): boolean {
    // 親が非アクティブならば、このエンティティも非アクティブ
    if (this.parent && !this.parent.active) {
      return false;
    }
    return this._active;
  }

  /**
   * エンティティのアクティブ状態を設定
   */
  set active(value: boolean) {
    this._active = value;
  }

  /**
   * コンポーネントをエンティティに追加
   * @param component 追加するコンポーネント
   * @returns このエンティティ（メソッドチェーン用）
   */
  addComponent(component: Component): Entity {
    if (this.components.has(component.type)) {
      console.warn(
        `Component of type ${component.type} already exists on entity ${this.id}, overwriting`
      );
    }

    this.components.set(component.type, component);
    component.entity = this;
    component.initialize();

    console.log(`Added component ${component.type} to entity ${this.id}`);
    return this;
  }

  /**
   * 指定したタイプのコンポーネントを取得
   * @param type コンポーネントのタイプ
   * @returns コンポーネント、または undefined
   */
  getComponent<T extends Component>(type: string): T | undefined {
    return this.components.get(type) as T;
  }

  /**
   * 指定したタイプのコンポーネントを持っているかどうかを確認
   * @param type コンポーネントのタイプ
   * @returns コンポーネントを持っている場合は true
   */
  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  /**
   * 指定したタイプのコンポーネントを削除
   * @param type 削除するコンポーネントのタイプ
   * @returns 削除が成功した場合は true
   */
  removeComponent(type: string): boolean {
    const component = this.components.get(type);
    if (component) {
      // コンポーネントのクリーンアップ
      component.entity = null;

      // マップから削除
      this.components.delete(type);
      console.log(`Removed component ${type} from entity ${this.id}`);
      return true;
    }
    return false;
  }

  /**
   * すべてのコンポーネントを更新
   * @param deltaTime 前回のフレームからの経過時間（ミリ秒）
   */
  update(deltaTime: number): void {
    if (!this.active) return;

    // すべてのコンポーネントを更新
    for (const component of this.components.values()) {
      component.update(deltaTime);
    }

    // すべての子エンティティを更新
    for (const child of this.children) {
      child.update(deltaTime);
    }
  }

  /**
   * タグをエンティティに追加
   * @param tag 追加するタグ
   */
  addTag(tag: string): void {
    this.tags.add(tag);
  }

  /**
   * タグを削除
   * @param tag 削除するタグ
   */
  removeTag(tag: string): void {
    this.tags.delete(tag);
  }

  /**
   * 指定したタグを持っているかどうかを確認
   * @param tag 確認するタグ
   */
  hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }

  /**
   * すべてのタグを取得
   * @returns タグの配列
   */
  getTags(): string[] {
    return Array.from(this.tags);
  }

  /**
   * 子エンティティを追加
   * @param child 追加する子エンティティ
   */
  addChild(child: Entity): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }

    this.children.push(child);
    child.parent = this;
  }

  /**
   * 子エンティティを削除
   * @param child 削除する子エンティティ
   * @returns 削除が成功した場合は true
   */
  removeChild(child: Entity): boolean {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
      return true;
    }
    return false;
  }

  /**
   * すべての子エンティティを取得
   * @returns 子エンティティの配列
   */
  getChildren(): Entity[] {
    return [...this.children];
  }

  /**
   * 親エンティティを取得
   * @returns 親エンティティ、またはnull
   */
  getParent(): Entity | null {
    return this.parent;
  }

  /**
   * エンティティを破棄
   * コンポーネントのクリーンアップと、親からの切り離しを行う
   */
  destroy(): void {
    // すべてのコンポーネントを削除
    for (const type of this.components.keys()) {
      this.removeComponent(type);
    }

    // すべての子を破棄
    for (const child of [...this.children]) {
      child.destroy();
    }

    // 親から切り離す
    if (this.parent) {
      this.parent.removeChild(this);
    }

    console.log(`Entity destroyed: ${this.id}`);
  }
}
