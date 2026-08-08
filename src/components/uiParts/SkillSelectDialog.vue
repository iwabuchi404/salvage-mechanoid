<script setup lang="ts">
import BaseButton from './BaseButton.vue';

interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  energyCost: number;
  cooldown: number;
  currentCooldown: number;
  canUse: boolean;
}

interface Props {
  skills: Skill[];
  currentEnergy: number;
}

interface Emits {
  (e: 'use-skill', skillId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const useSkill = (skillId: string) => {
  emit('use-skill', skillId);
};

const getSkillStatus = (skill: Skill): string => {
  if (skill.currentCooldown > 0) {
    return `CT:${skill.currentCooldown}`;
  }
  if (props.currentEnergy < skill.energyCost) {
    return 'EN不足';
  }
  return '使用可';
};

const isSkillDisabled = (skill: Skill): boolean => {
  return skill.currentCooldown > 0 || props.currentEnergy < skill.energyCost;
};
</script>

<template>
  <div class="skill-content">
    <div v-if="skills.length === 0" class="no-skills">習得スキルなし</div>

    <div v-else class="skill-list">
      <div
        v-for="skill in skills"
        :key="skill.id"
        class="skill-item"
        :class="{ disabled: isSkillDisabled(skill) }"
      >
        <div class="skill-icon">{{ skill.icon }}</div>
        <div class="skill-info">
          <div class="skill-name">{{ skill.name }}</div>
          <div class="skill-meta">
            <span class="energy-cost">⚡{{ skill.energyCost }}</span>
            <span class="status">{{ getSkillStatus(skill) }}</span>
          </div>
        </div>
        <BaseButton @click="useSkill(skill.id)" :type="'small'" :disabled="isSkillDisabled(skill)">
          使用
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skill-content {
  padding: 8px;
  height: 100%;
  overflow-y: auto;
}

/* カスタムスクロールバー */
.skill-content::-webkit-scrollbar {
  width: 8px;
}

.skill-content::-webkit-scrollbar-track {
  background: rgba(54, 30, 16, 0.5);
  border-radius: 4px;
}

.skill-content::-webkit-scrollbar-thumb {
  background: #f17623;
  border-radius: 4px;
}

.skill-content::-webkit-scrollbar-thumb:hover {
  background: #fdb788;
}

.no-skills {
  text-align: center;
  padding: 20px;
  color: #999;
  font-family: 'DotGothic16', sans-serif;
  font-size: 14px;
}

.skill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background-color: rgba(241, 118, 35, 0.1);
  border: 1px solid rgba(241, 118, 35, 0.3);
  border-radius: 4px;
  transition: all 0.2s;
}

.skill-item:not(.disabled):hover {
  background-color: rgba(241, 118, 35, 0.2);
  border-color: #f17623;
}

.skill-item.disabled {
  opacity: 0.5;
}

.skill-icon {
  font-size: 24px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.skill-info {
  flex: 1;
  min-width: 0;
}

.skill-name {
  color: #fdb788;
  font-size: 14px;
  margin-bottom: 2px;
  font-family: 'DotGothic16', sans-serif;
  font-weight: bold;
}

.skill-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  font-family: 'DotGothic16', sans-serif;
}

.energy-cost {
  color: #4a9eff;
}

.status {
  color: #999;
}
</style>
