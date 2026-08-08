import { Component } from '@/engine/entity/Component';
import { Entity } from '@/engine/entity/Entity';

const createComponent = (type: string): Component & { destroy: jest.Mock } => ({
  type,
  entity: null,
  initialize: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
});

describe('Entity', () => {
  it('コンポーネントの所有関係と削除時の後始末を管理する', () => {
    const entity = new Entity('entity-1', 'test');
    const component = createComponent('test-component');

    expect(entity.addComponent(component)).toBe(entity);
    expect(entity.hasComponent(component.type)).toBe(true);
    expect(entity.getComponent(component.type)).toBe(component);
    expect(component.entity).toBe(entity);

    expect(entity.removeComponent(component.type)).toBe(true);
    expect(component.destroy).toHaveBeenCalledTimes(1);
    expect(component.entity).toBeNull();
    expect(entity.removeComponent(component.type)).toBe(false);
  });

  it('初期化可能な全コンポーネントを登録順に初期化する', async () => {
    const entity = new Entity('entity-1', 'test');
    const first = createComponent('first');
    const second = createComponent('second');
    entity.addComponent(first).addComponent(second);

    await entity.initialize();

    expect(first.initialize).toHaveBeenCalledTimes(1);
    expect(second.initialize).toHaveBeenCalledTimes(1);
    expect((first.initialize as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (second.initialize as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it('movementを先に更新してから残りのコンポーネントを更新する', () => {
    const entity = new Entity('entity-1', 'test');
    const sprite = createComponent('sprite');
    const movement = createComponent('movement');
    entity.addComponent(sprite).addComponent(movement);

    entity.update(16);

    expect(movement.update).toHaveBeenCalledWith(16);
    expect((movement.update as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (sprite.update as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it('非アクティブなエンティティはコンポーネントも子も更新しない', () => {
    const parent = new Entity('parent', 'test');
    const child = new Entity('child', 'test');
    const parentComponent = createComponent('parent-component');
    const childComponent = createComponent('child-component');
    parent.addComponent(parentComponent);
    child.addComponent(childComponent);
    parent.addChild(child);
    parent.active = false;

    parent.update(16);

    expect(parentComponent.update).not.toHaveBeenCalled();
    expect(childComponent.update).not.toHaveBeenCalled();
    expect(child.active).toBe(false);
  });

  it('子を別の親へ移すと以前の親から切り離す', () => {
    const firstParent = new Entity('first-parent', 'test');
    const secondParent = new Entity('second-parent', 'test');
    const child = new Entity('child', 'test');

    firstParent.addChild(child);
    secondParent.addChild(child);

    expect(firstParent.getChildren()).toEqual([]);
    expect(secondParent.getChildren()).toEqual([child]);
    expect(child.getParent()).toBe(secondParent);
  });

  it('破棄時にコンポーネントと子を破棄し、親から切り離す', () => {
    const parent = new Entity('parent', 'test');
    const entity = new Entity('entity-1', 'test');
    const child = new Entity('child', 'test');
    const component = createComponent('component');
    const childComponent = createComponent('child-component');
    entity.addComponent(component);
    child.addComponent(childComponent);
    entity.addChild(child);
    parent.addChild(entity);

    entity.destroy();

    expect(component.destroy).toHaveBeenCalledTimes(1);
    expect(childComponent.destroy).toHaveBeenCalledTimes(1);
    expect(parent.getChildren()).toEqual([]);
    expect(entity.getChildren()).toEqual([]);
  });

  it('タグを重複なく追加・削除する', () => {
    const entity = new Entity('entity-1', 'test');

    entity.addTag('enemy');
    entity.addTag('enemy');
    entity.addTag('armored');

    expect(entity.getTags()).toEqual(['enemy', 'armored']);
    entity.removeTag('enemy');
    expect(entity.hasTag('enemy')).toBe(false);
  });
});
