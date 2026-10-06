<script setup lang="tsx">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Tag } from 'ant-design-vue';
import { fetchGetWorkflowDonePage } from '@/service/api';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import WarmFlowChart from '@/components/custom/warm-flow-chart.vue';
import DoneSearch from './modules/done-search.vue';

// 流程状态/协作类型改由后端枚举字典驱动：搜索栏共用本页加载的字典
ensureEnumDict('workflow');

/**
 * 列宽：定宽列合计 64+200+140+110+140+100+170+170 = 1094，flowName 列吃剩余宽度。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1300);

const router = useRouter();

const {
  columns,
  columnChecks,
  data,
  getData,
  getDataByPage,
  loading,
  mobilePagination,
  searchParams,
  resetSearchParams
} = useTable({
  apiFn: fetchGetWorkflowDonePage,
  apiParams: {
    current: 1,
    size: 10,
    // 后端：nodeName 为模糊匹配，flowStatus 为等值匹配
    nodeName: undefined,
    flowStatus: undefined
  },
  columns: () => [
    {
      key: 'index',
      dataIndex: 'index',
      title: $t('common.index'),
      width: 64,
      align: 'center'
    },
    {
      key: 'flowName',
      dataIndex: 'flowName',
      title: $t('page.workflow.done.flowName'),
      align: 'center',
      // 不写 width：名称列吃掉剩余宽度
      ellipsis: true
    },
    {
      key: 'nodeName',
      dataIndex: 'nodeName',
      title: $t('page.workflow.done.nodeName'),
      align: 'center',
      width: 200,
      ellipsis: true
    },
    {
      key: 'approver',
      dataIndex: 'approver',
      title: $t('page.workflow.done.approver'),
      align: 'center',
      width: 140,
      ellipsis: true,
      customRender: ({ record }) => record.approver || '-'
    },
    {
      key: 'cooperateType',
      dataIndex: 'cooperateType',
      title: $t('page.workflow.done.cooperateType'),
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
      title: $t('page.workflow.done.collaborator'),
      align: 'center',
      width: 140,
      ellipsis: true,
      // collaborator 后端已是姓名串（`,` 分隔），不再查用户
      customRender: ({ record }) => record.collaborator || '-'
    },
    {
      key: 'flowStatus',
      dataIndex: 'flowStatus',
      title: $t('page.workflow.done.flowStatus'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('workflow', 'WorkflowFlowStatus', record.flowStatus)}>
          {enumDictText('workflow', 'WorkflowFlowStatus', record.flowStatus)}
        </Tag>
      )
    },
    {
      key: 'createTime',
      dataIndex: 'createTime',
      title: $t('page.workflow.done.createTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => formatDateTime(record.createTime)
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          {/* 已办列表「每个实例只留最近一条」，完整链路在隐藏页 /workflow/his-task 里看 */}
          <Button type="link" size="small" onClick={() => goApprovalRecord(record.instanceId)}>
            {$t('page.workflow.done.approvalRecord')}
          </Button>
          <Button type="link" size="small" onClick={() => openChart(record.instanceId)}>
            {$t('page.workflow.done.flowChart')}
          </Button>
        </div>
      )
    }
  ]
});

/** 流程图弹窗（⚠️ 传的是 instanceId，不是 hisTaskId） */
const chartVisible = ref(false);
const chartInstanceId = ref('');

/** 审批记录是独立的路由（侧边栏隐藏，靠 activeMenu 把「已办任务」点亮） */
function goApprovalRecord(instanceId: string) {
  router.push({ name: 'workflow_his-task', query: { instanceId } });
}

function openChart(instanceId: string) {
  chartInstanceId.value = instanceId;
  chartVisible.value = true;
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <DoneSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.workflow.done.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <!-- 已办记录是历史数据，不可编辑，故关掉「新增 / 批量删除」 -->
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :show-add="false"
          :show-delete="false"
          :loading="loading"
          @refresh="getData"
        />
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="data"
        :loading="loading"
        row-key="hisTaskId"
        size="small"
        :pagination="mobilePagination"
        :scroll="scrollConfig"
        class="h-full"
      />
      <WarmFlowChart v-model:visible="chartVisible" :instance-id="chartInstanceId" />
    </ACard>
  </div>
</template>

<style scoped></style>
