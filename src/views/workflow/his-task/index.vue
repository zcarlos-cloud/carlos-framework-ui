<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Tag } from 'ant-design-vue';
import { fetchGetWorkflowHisTasks } from '@/service/api';
import { useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';

// 本页经路由直达（已办任务的行操作跳转），不挂在列表页里，自行加载枚举字典
ensureEnumDict('workflow');

/**
 * 审批记录（隐藏页）
 *
 * 入口是「已办任务」列表的行操作，`instanceId` 走 query 传进来
 * （`sys_menu` 里 hide_in_menu=TRUE、active_menu='workflow_done'，所以侧边栏高亮的是已办任务）。
 *
 * ⚠️ 这里**不分页**：后端 `/instance/{instanceId}/his-task` 返回的是该实例的全部历史任务
 * （一个流程实例的办理条数天然有界），普通表格渲染即可，不用 `useTable`。
 *
 * 列宽：定宽列合计 64+160+160+140+110+140+100+100+170 = 1144，审批意见列吃剩余宽度。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1400);

const route = useRoute();

/** query 里可能是数组或 undefined（用户手敲 URL 时），统一收敛成字符串 */
const instanceId = computed(() => {
  const value = route.query.instanceId;

  return typeof value === 'string' ? value : '';
});

const loading = ref(false);
const data = ref<Api.Workflow.WorkflowHisTask[]>([]);

const columns = computed<AntDesign.TableColumnType<Api.Workflow.WorkflowHisTask>[]>(() => [
  {
    key: 'index',
    dataIndex: 'index',
    title: $t('common.index'),
    width: 64,
    align: 'center'
  },
  {
    key: 'nodeName',
    dataIndex: 'nodeName',
    title: $t('page.workflow.hisTask.nodeName'),
    align: 'center',
    width: 160,
    ellipsis: true
  },
  {
    key: 'targetNodeName',
    dataIndex: 'targetNodeName',
    title: $t('page.workflow.hisTask.targetNodeName'),
    align: 'center',
    width: 160,
    ellipsis: true,
    customRender: ({ record }) => record.targetNodeName || '-'
  },
  {
    key: 'approver',
    dataIndex: 'approver',
    title: $t('page.workflow.hisTask.approver'),
    align: 'center',
    width: 140,
    ellipsis: true,
    customRender: ({ record }) => record.approver || '-'
  },
  {
    key: 'cooperateType',
    dataIndex: 'cooperateType',
    title: $t('page.workflow.hisTask.cooperateType'),
    align: 'center',
    width: 110,
    customRender: ({ record }) => (
      <Tag color={enumDictColor('workflow', 'WorkflowCooperateType', record.cooperateType)}>
        {enumDictText('workflow', 'WorkflowCooperateType', record.cooperateType)}
      </Tag>
    )
  },
  {
    key: 'collaborator',
    dataIndex: 'collaborator',
    title: $t('page.workflow.hisTask.collaborator'),
    align: 'center',
    width: 140,
    ellipsis: true,
    // 后端下发的已是姓名串（`,` 分隔），不再查用户
    customRender: ({ record }) => record.collaborator || '-'
  },
  {
    key: 'flowStatus',
    dataIndex: 'flowStatus',
    title: $t('page.workflow.hisTask.flowStatus'),
    align: 'center',
    width: 100,
    customRender: ({ record }) => (
      <Tag color={enumDictColor('workflow', 'WorkflowFlowStatus', record.flowStatus)}>
        {enumDictText('workflow', 'WorkflowFlowStatus', record.flowStatus)}
      </Tag>
    )
  },
  {
    key: 'message',
    dataIndex: 'message',
    title: $t('page.workflow.hisTask.message'),
    align: 'center',
    // 不写 width：审批意见吃掉剩余宽度
    ellipsis: true,
    customRender: ({ record }) => record.message || '-'
  },
  {
    key: 'skipType',
    dataIndex: 'skipType',
    title: $t('page.workflow.hisTask.skipType'),
    align: 'center',
    width: 100,
    customRender: ({ record }) => (
      <Tag color={enumDictColor('workflow', 'WorkflowSkipType', record.skipType)}>
        {enumDictText('workflow', 'WorkflowSkipType', record.skipType)}
      </Tag>
    )
  },
  {
    key: 'createTime',
    dataIndex: 'createTime',
    title: $t('page.workflow.hisTask.createTime'),
    align: 'center',
    width: 170,
    customRender: ({ record }) => formatDateTime(record.createTime)
  }
]);

async function getData() {
  if (!instanceId.value) {
    data.value = [];
    return;
  }

  loading.value = true;

  try {
    const { data: records, error } = await fetchGetWorkflowHisTasks(instanceId.value);

    if (error) {
      window.$message?.error?.($t('page.workflow.hisTask.loadFailed'));
      return;
    }

    data.value = records ?? [];
  } finally {
    loading.value = false;
  }
}

// immediate：进入页面（含从已办页再次跳入并改变 instanceId）即加载
watch(instanceId, getData, { immediate: true });
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <ACard
      :title="$t('page.workflow.hisTask.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <AButton size="small" :loading="loading" :disabled="!instanceId" @click="getData">
          <template #icon>
            <icon-ic-round-refresh class="align-sub text-icon" />
          </template>
          <span class="ml-8px">{{ $t('common.refresh') }}</span>
        </AButton>
      </template>
      <AAlert
        v-if="!instanceId"
        type="warning"
        show-icon
        class="mb-16px"
        :message="$t('page.workflow.hisTask.missingInstanceId')"
      />
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="data"
        :loading="loading"
        row-key="hisTaskId"
        size="small"
        :pagination="false"
        :scroll="scrollConfig"
        class="h-full"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
