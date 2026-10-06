<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  fetchGetDevkitTemplateVersionDetail,
  fetchGetDevkitTemplateVersionList,
  fetchRollbackDevkitTemplateVersion
} from '@/service/api';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import DevkitCodeEditor from '../../components/code-editor.vue';

defineOptions({
  name: 'DevkitTemplateVersionDrawer'
});

interface Props {
  templateId: string;
  /** 编辑器里当前的正文（对比左栏） */
  currentContent: string;
  filePath: string;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'rolledBack'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const loading = ref(false);
const rollbackLoading = ref(false);
const versions = ref<Api.Devkit.TemplateVersion[]>([]);

/** 对比模式：选中版本后展示「当前 vs 该版本」 */
const compare = ref<Api.Devkit.TemplateVersion | null>(null);

async function loadVersions() {
  if (!props.templateId) {
    versions.value = [];
    return;
  }

  loading.value = true;
  try {
    const { error, data } = await fetchGetDevkitTemplateVersionList({
      templateId: props.templateId,
      current: 1,
      size: 100
    });

    if (!error) {
      versions.value = data.records;
    }
  } finally {
    loading.value = false;
  }
}

async function handleCompare(version: Api.Devkit.TemplateVersion) {
  // 列表接口不下发正文快照，对比时再取详情
  const { error, data } = await fetchGetDevkitTemplateVersionDetail(version.id);
  if (error) {
    return;
  }
  compare.value = data;
}

async function handleRollback(version: Api.Devkit.TemplateVersion) {
  rollbackLoading.value = true;
  try {
    const { error } = await fetchRollbackDevkitTemplateVersion(version.id);

    if (error) {
      window.$message?.error?.($t('common.updateFailed'));
      return;
    }

    window.$message?.success?.($t('page.devkit.editor.rollbackSuccess', { no: version.versionNo }));
    compare.value = null;
    await loadVersions();
    emit('rolledBack');
  } finally {
    rollbackLoading.value = false;
  }
}

watch(visible, () => {
  if (visible.value) {
    compare.value = null;
    loadVersions();
  }
});
</script>

<template>
  <ADrawer v-model:open="visible" :title="$t('page.devkit.editor.versionHistory')" :width="960">
    <div class="flex-col-stretch gap-12px">
      <div class="text-12px text-gray-500">
        {{ $t('page.devkit.editor.versionHint') }}
      </div>
      <ATable
        :data-source="versions"
        :loading="loading"
        size="small"
        row-key="id"
        :pagination="false"
        :scroll="{ y: compare ? 200 : 520 }"
      >
        <ATableColumn key="versionNo" data-index="versionNo" :title="$t('page.devkit.editor.versionNo')" width="90" />
        <ATableColumn key="changeLog" data-index="changeLog" :title="$t('page.devkit.editor.changeLog')" ellipsis />
        <ATableColumn key="fileSize" data-index="fileSize" :title="$t('page.devkit.common.size')" width="100" />
        <ATableColumn key="createTime" :title="$t('page.devkit.common.createTime')" width="180">
          <template #default="{ record }">
            {{ formatDateTime(record.createTime) }}
          </template>
        </ATableColumn>
        <ATableColumn key="operate" :title="$t('common.operate')" width="160" align="center">
          <template #default="{ record }">
            <div class="flex-center gap-8px">
              <AButton size="small" @click="handleCompare(record)">{{ $t('page.devkit.editor.compare') }}</AButton>
              <APopconfirm :title="$t('page.devkit.editor.rollbackConfirm')" @confirm="handleRollback(record)">
                <AButton size="small" danger :loading="rollbackLoading">
                  {{ $t('page.devkit.editor.rollback') }}
                </AButton>
              </APopconfirm>
            </div>
          </template>
        </ATableColumn>
      </ATable>

      <ACard v-if="compare" :bordered="false" size="small" class="card-wrapper">
        <template #title>
          <div class="flex-y-center justify-between">
            <span>{{ $t('page.devkit.editor.compareTitle', { no: compare.versionNo }) }}</span>
            <AButton size="small" @click="compare = null">{{ $t('common.close') }}</AButton>
          </div>
        </template>
        <div class="flex gap-12px">
          <div class="min-w-0 flex-1">
            <div class="mb-4px text-12px text-gray-500">{{ $t('page.devkit.editor.currentContent') }}</div>
            <DevkitCodeEditor :model-value="currentContent" :path="filePath" readonly height="320px" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="mb-4px text-12px text-gray-500">
              {{ $t('page.devkit.editor.versionContent', { no: compare.versionNo }) }}
            </div>
            <DevkitCodeEditor :model-value="compare.content ?? ''" :path="filePath" readonly height="320px" />
          </div>
        </div>
      </ACard>
    </div>
  </ADrawer>
</template>

<style scoped></style>
