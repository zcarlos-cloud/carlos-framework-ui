<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Upload } from 'ant-design-vue';
import type { UploadProps } from 'ant-design-vue';
import { fetchImportWorkflowDefinition } from '@/service/api';
import { $t } from '@/locales';

/**
 * 导入流程定义弹窗
 *
 * 与导入用户（`components/advanced/import-drawer.vue`）不同，这里**不做两阶段预览**：
 * 流程定义 JSON 由引擎解析，前端看不懂它的节点结构，能校验的只有「扩展名是不是 .json」，
 * 因此没有「预览」这一步，选完文件直接提交。
 *
 * ⚠️ `auto-upload` 必须关掉（`beforeUpload` 返回 `false`）：上传要等用户点「确定」才发，
 * 否则选中文件的瞬间就提交了，用户连取消的机会都没有。
 */
defineOptions({
  name: 'DefinitionImportModal'
});

const visible = defineModel<boolean>('visible', {
  default: false
});

interface Emits {
  /** 导入成功，调用方据此刷新列表 */
  (e: 'imported'): void;
}

const emit = defineEmits<Emits>();

/** 用 antd 自己的 fileList 类型，避免 any */
const fileList = ref<NonNullable<UploadProps['fileList']>>([]);
const importing = ref(false);

const selectedCount = computed(() => fileList.value?.length ?? 0);

/**
 * 只放行 `.json`
 *
 * 后端按内容解析，这里拦一道是为了让用户立刻看到提示，不用等一次往返。
 * 返回 `Upload.LIST_IGNORE` 才是「不进列表」；返回 `false` 只是不自动上传，
 * 文件仍会留在列表里，用户点确定就会把一个非法文件提交上去。
 */
const beforeUpload: UploadProps['beforeUpload'] = file => {
  if (!(file.name ?? '').toLowerCase().endsWith('.json')) {
    window.$message?.error?.($t('page.workflow.definition.importNeedFile'));

    return Upload.LIST_IGNORE;
  }

  return false;
};

function closeModal() {
  visible.value = false;
}

async function handleSubmit() {
  const raw = fileList.value?.[0]?.originFileObj as File | undefined;

  if (!raw) {
    window.$message?.warning?.($t('page.workflow.definition.importNeedFile'));

    return;
  }

  importing.value = true;

  try {
    const { error } = await fetchImportWorkflowDefinition(raw);

    if (error) {
      // 具体原因（格式非法 / 编码重复 …）在 HTTP 错误里，请求层已弹过，此处不重复
      return;
    }

    window.$message?.success?.($t('page.workflow.definition.importSuccess'));
    closeModal();
    emit('imported');
  } finally {
    importing.value = false;
  }
}

/** 每次打开都清空上次选中的文件，避免「以为没选、其实是上一次的」 */
watch(visible, value => {
  if (value) {
    fileList.value = [];
    importing.value = false;
  }
});
</script>

<template>
  <AModal v-model:open="visible" :title="$t('page.workflow.definition.importTitle')" :width="480">
    <div class="flex flex-col gap-16px">
      <AAlert type="info" show-icon :message="$t('page.workflow.definition.importHint')" />
      <AUpload
        v-model:file-list="fileList"
        accept=".json"
        :max-count="1"
        :before-upload="beforeUpload"
        :disabled="importing"
      >
        <AButton :disabled="importing">
          <template #icon>
            <icon-ic-round-plus class="align-sub text-icon" />
          </template>
          <span class="ml-8px">{{ $t('common.selectFile') }}</span>
        </AButton>
      </AUpload>
    </div>

    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton :disabled="importing" @click="closeModal">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="importing" :disabled="selectedCount === 0" @click="handleSubmit">
          {{ $t('common.confirm') }}
        </AButton>
      </div>
    </template>
  </AModal>
</template>

<style scoped></style>
