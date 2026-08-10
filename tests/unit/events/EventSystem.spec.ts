import { EventSystem } from '@/engine/events/EventSystem';

describe('EventSystem', () => {
  it('イベントを登録済みリスナーへ即時配送する', () => {
    const events = new EventSystem();
    const listener = jest.fn();
    events.on('test', listener);

    events.emit('test', { value: 1 });

    expect(listener).toHaveBeenCalledWith({ value: 1 });
    expect(events.getListenerCount('test')).toBe(1);
  });

  it('同じリスナーは重複登録せず、offで解除する', () => {
    const events = new EventSystem();
    const listener = jest.fn();
    events.on('test', listener);
    events.on('test', listener);

    expect(events.getListenerCount('test')).toBe(1);

    events.off('test', listener);
    events.emit('test');

    expect(events.getListenerCount('test')).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('バッファ中のイベントはupdateまで配送しない', () => {
    const events = new EventSystem();
    const listener = jest.fn();
    events.on('test', listener);
    events.setBuffering(true);

    events.emit('test', { sequence: 1 });
    events.emit('test', { sequence: 2 });
    expect(listener).not.toHaveBeenCalled();

    events.update(16);

    expect(listener.mock.calls).toEqual([[{ sequence: 1 }], [{ sequence: 2 }]]);
  });

  it('バッファリングを無効にした時点で未配送イベントを順に流す', () => {
    const events = new EventSystem();
    const listener = jest.fn();
    events.on('test', listener);
    events.setBuffering(true);
    events.emit('test', { sequence: 1 });

    events.setBuffering(false);

    expect(listener).toHaveBeenCalledWith({ sequence: 1 });
  });

  it('あるリスナーの例外が後続リスナーの配送を止めない', () => {
    const events = new EventSystem();
    const error = jest.spyOn(console, 'error').mockImplementation();
    const next = jest.fn();
    events.on('test', () => {
      throw new Error('listener failed');
    });
    events.on('test', next);

    events.emit('test', { value: 1 });

    expect(error).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith({ value: 1 });
    error.mockRestore();
  });

  it('destroyでリスナーと未配送イベントを破棄し、バッファリングも解除する', () => {
    const events = new EventSystem();
    const oldListener = jest.fn();
    events.on('test', oldListener);
    events.setBuffering(true);
    events.emit('test', { value: 'queued' });

    events.destroy();
    events.update(16);
    events.emit('test', { value: 'after-destroy' });

    expect(events.getListenerCount('test')).toBe(0);
    expect(oldListener).not.toHaveBeenCalled();

    const newListener = jest.fn();
    events.on('test', newListener);
    events.emit('test', { value: 'new' });

    expect(newListener).toHaveBeenCalledWith({ value: 'new' });
  });
});
