<script setup lang="ts">
import { onMounted, ref, compile, computed, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    type: string;
    tag?: 'a' | 'btn';
    href?: string;
  }>(),
  { tag: 'btn' }
);

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <button v-if="tag === 'btn'" @click="$emit('click')" class="button" :class="type">
    <span class="button__inner"><slot></slot></span>
  </button>
  <a v-if="tag === 'a'" :href="href" @click="$emit('click')" class="button" :class="type">
    <slot></slot>
  </a>
</template>

<style scoped>
.button {
  /* font-family: 'Press Start 2P', cursive; */
  font-size: 1.5rem;
  padding: 1rem 2rem;
  background-color: rgba(255, 102, 0, 0.2);
  border: none;
  border: 2px solid #f17623;
  border-bottom: none;
  border-top: none;
  color: #f17623;
  cursor: pointer;
  transition: all 0.1s ease-in-out;
  position: relative;
  font-family: 'DotGothic16', sans-serif;
  box-shadow: 0 0 10px #ff5e001c, 0 0 20px #ff5e001c;
  letter-spacing: 4px;
  animation: bgAnime 1s alternate infinite;
  position: relative;

  .button__inner {
    z-index: 3;
    display: block;
    transition: all 0.4s ease-in-out;
  }
  .button__inner::before,
  .button__inner::after {
    content: '';
    display: block;
    position: absolute;
    z-index: 1;
    width: 15px;
    height: 100%;
    border: #f17623 solid 1px;
    border-left: #f17623 solid 4px;
    border-right: #f17623 solid 4px;
    transition: all 0.25s ease-in-out;
  }
  .button__inner::before {
    left: 0;
    top: 0;
    border-right: none;
  }

  .button__inner::after {
    right: 0;
    top: 0;
    border-left: none;
  }
}
.button.small {
  padding: 0.5rem 1.2rem;
  font-size: 1.2rem;
  .button__inner::before {
    border-left: #f17623 solid 2px;
  }
  .button__inner::after {
    border-right: #f17623 solid 2px;
  }
}
.button:hover {
  background-color: rgba(206, 93, 18, 0.2);
  box-shadow: 0 0 10px #4119023b, 0 0 20px #4119023b;
  transform: scale(1.05);
  .button__inner {
    /* color: white; */
  }
  .button__inner::before {
    width: calc(100% + 1px);
  }
  .button__inner::after {
    width: calc(100% + 1px);
  }
}
.button::before {
  content: '';
  display: block;
  position: absolute;
  z-index: 1;
}
.button::after {
  content: '';
  display: block;
  position: absolute;
  z-index: -1;
  left: 0;
  top: 0;
  height: 100%;
  width: 100%;
  background-color: rgba(206, 93, 18, 0.1);
  border: 2px solid #f17623;
  opacity: 0;
  filter: blur(2px);
}

.button:hover::after {
  opacity: 0.3;
  animation: zoomEffect 0.4s ease-out alternate forwards;
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
