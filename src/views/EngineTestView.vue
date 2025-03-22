<template>
  <div class="engine-test-view">
    <EngineTestComponent />
  </div>
</template>

<script setup lang="ts">
import EngineTestComponent from '@/components/test/EngineTestComponent.vue';
console.log('test');
</script>

<style scoped>
.engine-test-view {
  min-height: 100vh;
  padding: 20px;
  background-color: #121212;
  color: #fff;
}
</style>
