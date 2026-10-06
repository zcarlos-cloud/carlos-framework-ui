<script setup lang="ts">
import { computed } from 'vue';

defineOptions({
  name: 'GlobalFooter'
});

/**
 * 当前年份。不硬编码，避免页脚年份随时间过期。
 */
const currentYear = computed(() => new Date().getFullYear());
</script>

<template>
  <DarkModeContainer class="h-full flex-center">
    <div class="text-center">
      <span>Copyright © 2021-{{ currentYear }} Carlos Framework</span>
      <!--
        上游署名必须保留：本仓库是 Soybean Admin Antd 的 fork，
        其 MIT 许可要求保留原始版权声明（见仓库根 LICENSE 第 3 行）。
      -->
      <a
        class="ml-8px text-primary"
        href="https://github.com/honghuangdc/soybean-admin/blob/main/LICENSE"
        target="_blank"
        rel="noopener noreferrer"
      >
        Based on Soybean Admin (MIT)
      </a>
    </div>
  </DarkModeContainer>
</template>

<style scoped></style>
