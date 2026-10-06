<script setup lang="ts">
/**
 * 助手机器人图标（内联 SVG）
 *
 * 不用图标库：项目离线图标包要跑 `pnpm gen:icons` 才能补进来，
 * 而这个图形需要在渐变底上保持形状清晰，内联可控性最好。
 */
defineOptions({ name: 'AgentRobot' });
</script>

<template>
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" aria-hidden="true">
    <path d="M12 4.2V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    <circle cx="12" cy="3" r="1.3" fill="currentColor" />
    <rect x="3.6" y="6.4" width="16.8" height="12.4" rx="4.4" stroke="currentColor" stroke-width="1.6" />
    <circle cx="9.1" cy="12" r="1.5" fill="currentColor" />
    <circle cx="14.9" cy="12" r="1.5" fill="currentColor" />
    <path d="M9.6 15.6h4.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    <path d="M2.2 10.6v3.4M21.8 10.6v3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
  </svg>
</template>

<style scoped></style>
