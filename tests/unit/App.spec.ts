import { createPinia } from 'pinia';
import { nextTick } from 'vue';
import { shallowMount, VueWrapper } from '@vue/test-utils';
import App from '@/App.vue';

jest.mock('@/components/scene/StartScreen.vue', () => ({
  name: 'StartScreen',
  template: '<div />',
}));
jest.mock('@/components/scene/GameScreen.vue', () => ({
  name: 'GameScreen',
  template: '<div />',
}));
jest.mock('@/components/scene/ClearScreen.vue', () => ({
  name: 'ClearScreen',
  template: '<div />',
}));
jest.mock('@/components/scene/GameOverScreen.vue', () => ({
  name: 'GameOverScreen',
  props: ['score'],
  template: '<div />',
}));
jest.mock('@/views/EngineTestView.vue', () => ({
  name: 'EngineTestView',
  template: '<div />',
}));

const mockSoundManager = {
  loadSounds: jest.fn(),
  stopBGM: jest.fn(),
  playBGM: jest.fn(),
};

jest.mock('@/common/SoundManager', () => ({
  SoundManager: {
    getInstance: () => mockSoundManager,
  },
}));

describe('App', () => {
  let wrapper: VueWrapper;

  const mountApp = () =>
    shallowMount(App, {
      global: {
        plugins: [createPinia()],
      },
    });

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    jest.clearAllMocks();
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it('通常起動ではスタート画面を表示する', () => {
    wrapper = mountApp();

    expect(wrapper.findComponent({ name: 'StartScreen' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'GameScreen' }).exists()).toBe(false);
    expect(mockSoundManager.loadSounds).toHaveBeenCalledTimes(1);
  });

  it('ゲーム開始とゲームオーバーの画面遷移を管理する', async () => {
    wrapper = mountApp();

    wrapper.findComponent({ name: 'StartScreen' }).vm.$emit('start-game');
    await nextTick();
    expect(wrapper.findComponent({ name: 'GameScreen' }).exists()).toBe(true);

    wrapper.findComponent({ name: 'GameScreen' }).vm.$emit('game-over', 420);
    await nextTick();

    const gameOver = wrapper.findComponent({ name: 'GameOverScreen' });
    expect(gameOver.exists()).toBe(true);
    expect(gameOver.props('score')).toBe(420);
  });

  it('?testではエンジンテスト画面だけを表示する', () => {
    window.history.replaceState({}, '', '/?test');
    wrapper = mountApp();

    expect(wrapper.findComponent({ name: 'EngineTestView' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'StartScreen' }).exists()).toBe(false);
  });
});
