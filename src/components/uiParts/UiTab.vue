<script setup lang="ts">
import { onMounted, ref, compile, computed, watch } from 'vue';

type tabData = {
  label: string;
  value: string;
};

const props = withDefaults(
  defineProps<{
    tabs: tabData[];
    width?: string;
  }>(),
  {
    width: '100%',
  }
);

const emit = defineEmits<{
  (e: 'change', value: string): string;
}>();

const currentTab = ref(props.tabs[0].value);

const changeTab = (value: string) => {
  currentTab.value = value;
  emit('change', value);
};
</script>

<template>
  <div class="tab-container">
    <div class="tab-buttons">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        :class="['tab', { 'is-active': currentTab === tab.value }]"
        @click="changeTab(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="tab-content">
      <slot :name="currentTab" :tab="currentTab"
        ><p>No content for {{ currentTab }}</p>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.tab-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 20px;
}
.tab-buttons {
  display: flex;
  flex-direction: row;
  gap: 8px;
  padding-left: 40px;
  padding-right: 40px;
  padding-bottom: 6px;
  border-bottom: 3px solid #f17623;
  width: v-bind(width);
}
.tab {
  flex-grow: 1;
  font-size: 1.4rem;
  padding: 8px 12px;
  background-color: rgba(138, 58, 5, 0.4);
  border: 3px solid transparent;
  border-bottom: none;
  border-top: none;
  transition: all 0.05s ease-in-out;
  text-align: center;
}
.tab.is-active {
  color: #ffffff;
  background-color: rgba(206, 93, 18, 0.9);
  box-shadow: 0 0 10px #4119023b, 0 0 20px #4119023b;
  transform: scale(1.01);
  border: 3px solid #f17623;
  border-bottom: none;
  border-top: none;
}
.tab:hover {
  background-color: rgba(206, 93, 18, 0.2);
  box-shadow: 0 0 10px #4119023b, 0 0 20px #4119023b;
  border: 3px solid rgba(206, 93, 18, 0.4);
  border-bottom: none;
  border-top: none;
}
.tab-content {
  padding-left: 60px;
  padding-right: 60px;
  padding-bottom: 20px;
}
</style>
