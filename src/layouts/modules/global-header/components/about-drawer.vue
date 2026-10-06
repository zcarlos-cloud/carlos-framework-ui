<script setup lang="ts">
import { $t } from '@/locales';

defineOptions({
  name: 'AboutDrawer'
});

/**
 * 「关于」抽屉。内容块是 AboutInfo（自动导入），与隐藏路由页 /about 共用同一份。
 *
 * 用 ADrawer 而非 AModal —— carlos-ui-standard skill 的硬性约定第 12 条：
 * 「新增/编辑一律用 ADrawer；AModal 只用于非表单的确认/选择」。
 * 关于页是长内容展示，抽屉既合规也更合适。
 */
const visible = defineModel<boolean>('visible', { default: false });
</script>

<template>
  <ADrawer v-model:open="visible" :title="$t('page.about.title')" :width="560" :footer="null">
    <AboutInfo />
  </ADrawer>
</template>

<style scoped></style>
