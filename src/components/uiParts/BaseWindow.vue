<script setup lang="ts">
import { onMounted, ref, compile, computed, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    type: string;
    state: boolean;
    width: string;
    height: string;
    pos: {
      x: string;
      y: string;
    };
    zIndex?: number;
    title?: string;
  }>(),
  {
    zIndex: 1,
    type: 'normal',
  }
);

const showState = ref(false);
const styleState = ref(false);

const x = computed(() => {
  return props.pos.x;
});
const y = computed(() => {
  return props.pos.y;
});

const emit = defineEmits<{
  (e: 'click'): void;
  (e: 'close'): void;
}>();

watch(
  () => props.state,
  (newState) => {
    if (newState) {
      showState.value = newState;
      setTimeout(() => {
        styleState.value = newState;
      }, 10);
    } else {
      styleState.value = newState;
      setTimeout(() => {
        showState.value = newState;
      }, 400);
    }
  }
);
</script>

<template>
  <div
    v-if="showState"
    @click="$emit('click')"
    class="window"
    :class="[type, { 'is-open': styleState }]"
  >
    <span class="title">{{ title }}</span>
    <button
      class="close"
      @click="
        () => {
          emit('close');
        }
      "
    >
      X
    </button>
    <span class="window__inner"><slot></slot></span>
  </div>
</template>

<style scoped>
.title {
  position: absolute;
  display: block;
  padding: 1px 20px 4px 8px;
  color: #fceadd;
  background-color: #f17623;
  top: 0;
  left: 0;
  font-size: 1rem;
  min-width: 80px;
}
.title::after {
  position: absolute;
  content: '';
  display: block;
  top: 0;
  right: -10px;
  height: 100%;
  width: 20px;
  background-color: #f17623;
  transform: skewX(330deg);
}

.close {
  position: absolute;
  top: 0;
  right: 0;
  background-color: #f17623;
  border: solid #f17623 1px;
  padding: 1px 8px 4px 8px;
  font-size: 1rem;
  transition: all 0.15s;
  pointer-events: auto;
}
.close:hover {
  background-color: #4e260fbb;
  color: #f17623;
  cursor: pointer;
}

.window {
  position: absolute;
  overflow: hidden;
  top: v-bind(y);
  left: v-bind(x);
  right: 0;
  bottom: 0;
  height: v-bind(0);
  width: v-bind(0);
  margin: auto;
  z-index: v-bind(zIndex);
  border: #f17623 solid 1px;
  background-color: #361e10b6;
  padding: 36px 10px 10px 10px;
  transition: display 0.5s ease-in-out, height 0.3s, width 0.4s;
  transition-behavior: allow-discrete;
  pointer-events: auto;
}

.window.is-open {
  height: v-bind(height);
  width: v-bind(width);
  .window__inner {
    opacity: 1;
  }
}

.window__inner {
  width: 100%;
  height: 100%;
  font-size: 1rem;
  color: #f17623;
  opacity: 0;
  transition: 0.1s;
}

@keyframes zoomEffect {
  0% {
    transform: scale(0.8);
    opacity: 0.4;
  }
  15% {
    transform: scale(1.4);
    opacity: 0.2;
  }
  100% {
    opacity: 0;
  }
}
@keyframes bgAnime {
  0% {
    background: rgba(255, 102, 0, 0.35);
  }
  10% {
    background: rgba(255, 102, 0, 0.4);
  }
  15% {
    background: rgba(255, 102, 0, 0.3);
  }
  25% {
    background: rgba(255, 102, 0, 0.4);
  }
  30% {
    background: rgba(255, 102, 0, 0.35);
  }
  100% {
    background: rgba(255, 102, 0, 0.4);
  }
}
@keyframes gradationAnime {
  0% {
    text-shadow: 0 0 10px #ff5e00, 0 0 20px #ff5e00;
  }
  10% {
    text-shadow: 0 0 15px #ff5e00, 0 0 15px #ff5e00;
  }
  100% {
    text-shadow: 0 0 6px #ff5e00, 0 0 25px #ff5e00;
  }
}
</style>
