<script setup lang="ts">
import { ref, watch } from 'vue';
import { fetchGetWorkflowDefinitionDetail } from '@/service/api';
import { formatDateTime } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'DefinitionOperateDrawer'
});

// 独立抽屉不挂在列表页也能打开，自行加载枚举字典
ensureEnumDict('workflow');

/**
 * 只读详情抽屉
 *
 * ⚠️ 这里**只做展示**，不是编辑表单。流程定义的「新增 / 编辑」在
 * `definition-basic-modal.vue`（走 `POST /workflow/definition/basic`，只写主记录、不建节点）；
 * 节点与跳转线仍由设计器自己通过 `POST /warm-flow/save-json` 落库（iframe 内部行为）。
 * 本抽屉只做一件事 —— 用 `GET /workflow/definition/{id}` 展示定义的元数据。
 */
interface Props {
  /** 流程定义 id（Long 字符串） */
  definitionId?: string | null;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const loading = ref(false);

/** 详情数据；请求失败或无 id 时为 null */
const detail = ref<Api.Workflow.WorkflowDefinition | null>(null);

async function fetchDetail() {
  const id = props.definitionId;

  if (!id) {
    detail.value = null;
    return;
  }

  loading.value = true;
  try {
    const { data, error } = await fetchGetWorkflowDefinitionDetail(id);

    if (error) {
      window.$message?.error?.($t('page.workflow.definition.detailLoadFailed'));
      detail.value = null;
      return;
    }

    detail.value = data;
  } finally {
    loading.value = false;
  }
}

watch(visible, val => {
  if (val) {
    fetchDetail();
  }
});
</script>

<template>
  <!-- 宽度 480：纯展示，字段少但含时间与状态标签 -->
  <ADrawer v-model:open="visible" :title="$t('page.workflow.definition.detailTitle')" :width="480">
    <ASpin :spinning="loading">
      <ADescriptions v-if="detail" :column="1" bordered size="small">
        <ADescriptionsItem :label="$t('page.workflow.definition.flowName')">
          {{ detail.flowName }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.workflow.definition.flowCode')">
          {{ detail.flowCode }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.workflow.definition.version')">
          {{ detail.version }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.workflow.definition.category')">
          {{ detail.category || '-' }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.workflow.definition.isPublish')">
          <ATag :color="enumDictColor('workflow', 'WorkflowPublishStatus', detail.isPublish)">
            {{ enumDictText('workflow', 'WorkflowPublishStatus', detail.isPublish) }}
          </ATag>
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.workflow.definition.activityStatus')">
          <ATag :color="enumDictColor('workflow', 'WorkflowActivityStatus', detail.activityStatus)">
            {{ enumDictText('workflow', 'WorkflowActivityStatus', detail.activityStatus) }}
          </ATag>
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.workflow.definition.createTime')">
          {{ formatDateTime(detail.createTime) }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.workflow.definition.updateTime')">
          {{ formatDateTime(detail.updateTime) }}
        </ADescriptionsItem>
      </ADescriptions>
      <AEmpty v-else :description="$t('common.noData')" />
    </ASpin>
    <template #footer>
      <div class="flex-y-center justify-end">
        <AButton @click="visible = false">{{ $t('common.close') }}</AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
