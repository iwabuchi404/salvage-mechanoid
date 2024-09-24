// src/stores/ui.ts
import { defineStore } from 'pinia';

export const useUIStore = defineStore('ui', {
  state: () => ({
    isMenuOpen: false,
    selectedMenuItem: null,
    volume: 0.5,
    isMuted: false,
  }),
  actions: {
    toggleMenu() {
      this.isMenuOpen = !this.isMenuOpen;
    },
    setVolume(volume: number) {
      this.volume = volume;
    },
    toggleMute() {
      this.isMuted = !this.isMuted;
    },
  },
});
