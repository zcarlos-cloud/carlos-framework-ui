<script setup lang="ts">
import { $t } from '@/locales';

defineOptions({
  name: 'FileUploadDrawer'
});

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

/**
 * 选中即传（FileUpload 默认行为），成功后关抽屉并通知列表刷新；
 * 不再需要「选完再点确认」的手动提交 —— 上传本身就是用户意图
 */
function handleUploaded() {
  window.$message?.success?.($t('page.manage.file.uploadSuccess'));
  visible.value = false;
  emit('submitted');
}
</script>

<template>
  <ADrawer v-model:open="visible" :title="$t('page.manage.file.upload')" :width="360" :destroy-on-close="true">
    <FileUpload namespace="default" @uploaded="handleUploaded" />
  </ADrawer>
</template>

<style scoped></style>
