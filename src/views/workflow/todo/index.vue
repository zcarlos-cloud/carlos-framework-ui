<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import {
  fetchActivateWorkflowInstance,
  fetchGetWorkflowTodoPage,
  fetchHandleWorkflowTask,
  fetchSuspendWorkflowInstance
} from '@/service/api';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import WarmFlowChart from '@/components/custom/warm-flow-chart.vue';
import TodoCandidateModal from './modules/todo-candidate-modal.vue';
import TodoHandleModal from './modules/todo-handle-modal.vue';
import TodoSearch from './modules/todo-search.vue';

// 流程状态/激活状态改由后端枚举字典驱动：搜索栏共用本页加载的字典
ensureEnumDict('workflow');

/**
 * 列宽：定宽列合计 64+180+140+120+120+100+100+170+380 = 1374，flowName 列吃剩余宽度。
 * 行操作有 7 个（办理/转办/委托/加签/减签/挂起|激活/流程图），故操作列给到 380。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1560);

/** 实例已挂起 / 已激活，与后端 `activity_status` 一致 */
const ACTIVITY_SUSPENDED: Api.Workflow.WorkflowActivityStatus = 0;

/** 需要挑人的四个动作（转办 / 委托 / 加签 / 减签） */
type CandidateAction = Extract<
  Api.Workflow.WorkflowAction,
  'TRANSFER' | 'DEPUTE' | 'ADD_SIGNATURE' | 'REDUCTION_SIGNATURE'
>;

/** 行操作进行中（挂起 / 激活 / 挑人后提交），绑定按钮 disabled 防重复触发 */
const operating = ref(false);

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
  apiFn: fetchGetWorkflowTodoPage,
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
      title: $t('page.workflow.todo.flowName'),
      align: 'center',
      // 不写 width：名称列吃掉剩余宽度
      ellipsis: true
    },
    {
      key: 'nodeName',
      dataIndex: 'nodeName',
      title: $t('page.workflow.todo.nodeName'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      key: 'approver',
      dataIndex: 'approver',
      title: $t('page.workflow.todo.approver'),
      align: 'center',
      width: 140,
      ellipsis: true,
      // approver / transferredBy / delegate 后端已是姓名串（`;` 分隔），不再查用户
      customRender: ({ record }) => record.approver || '-'
    },
    {
      key: 'transferredBy',
      dataIndex: 'transferredBy',
      title: $t('page.workflow.todo.transferredBy'),
      align: 'center',
      width: 120,
      ellipsis: true,
      customRender: ({ record }) => record.transferredBy || '-'
    },
    {
      key: 'delegate',
      dataIndex: 'delegate',
      title: $t('page.workflow.todo.delegate'),
      align: 'center',
      width: 120,
      ellipsis: true,
      customRender: ({ record }) => record.delegate || '-'
    },
    {
      key: 'flowStatus',
      dataIndex: 'flowStatus',
      title: $t('page.workflow.todo.flowStatus'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('workflow', 'WorkflowFlowStatus', record.flowStatus)}>
          {enumDictText('workflow', 'WorkflowFlowStatus', record.flowStatus)}
        </Tag>
      )
    },
    {
      key: 'activityStatus',
      dataIndex: 'activityStatus',
      title: $t('page.workflow.todo.activityStatus'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('workflow', 'WorkflowActivityStatus', record.activityStatus)}>
          {enumDictText('workflow', 'WorkflowActivityStatus', record.activityStatus)}
        </Tag>
      )
    },
    {
      key: 'createTime',
      dataIndex: 'createTime',
      title: $t('page.workflow.todo.createTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => formatDateTime(record.createTime)
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 380,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="link" size="small" onClick={() => openHandle(record)}>
            {$t('page.workflow.todo.handle')}
          </Button>
          <Button type="link" size="small" onClick={() => openCandidate(record, 'TRANSFER')}>
            {$t('page.workflow.todo.transfer')}
          </Button>
          <Button type="link" size="small" onClick={() => openCandidate(record, 'DEPUTE')}>
            {$t('page.workflow.todo.depute')}
          </Button>
          <Button type="link" size="small" onClick={() => openCandidate(record, 'ADD_SIGNATURE')}>
            {$t('page.workflow.todo.addSignature')}
          </Button>
          <Button type="link" size="small" onClick={() => openCandidate(record, 'REDUCTION_SIGNATURE')}>
            {$t('page.workflow.todo.reductionSignature')}
          </Button>
          {/* 挂起 / 激活是**实例级**动作：挂起的实例要激活，激活的实例才谈得上挂起 */}
          {record.activityStatus === ACTIVITY_SUSPENDED ? (
            <Popconfirm
              title={$t('page.workflow.todo.activateConfirm')}
              onConfirm={() => toggleActivity(record, 'ACTIVATE')}
            >
              <Button type="link" size="small" disabled={operating.value}>
                {$t('page.workflow.todo.activate')}
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title={$t('page.workflow.todo.suspendConfirm')}
              onConfirm={() => toggleActivity(record, 'SUSPEND')}
            >
              <Button type="link" size="small" disabled={operating.value}>
                {$t('page.workflow.todo.suspend')}
              </Button>
            </Popconfirm>
          )}
          <Button type="link" size="small" onClick={() => openChart(record.instanceId)}>
            {$t('page.workflow.todo.flowChart')}
          </Button>
        </div>
      )
    }
  ]
});

/** 办理弹窗 */
const handleVisible = ref(false);
const handleTask = ref<Api.Workflow.WorkflowTask | null>(null);

/** 选人弹窗（转办 / 委托 / 加签 / 减签） */
const candidateVisible = ref(false);
const candidateAction = ref<CandidateAction>('TRANSFER');
const candidateTaskId = ref('');
const candidateSubmitting = ref(false);

/** 流程图弹窗（⚠️ 传的是 instanceId，不是 taskId） */
const chartVisible = ref(false);
const chartInstanceId = ref('');

function openHandle(record: Api.Workflow.WorkflowTask) {
  handleTask.value = record;
  handleVisible.value = true;
}

function openCandidate(record: Api.Workflow.WorkflowTask, action: CandidateAction) {
  candidateTaskId.value = record.taskId;
  candidateAction.value = action;
  candidateVisible.value = true;
}

function openChart(instanceId: string) {
  chartInstanceId.value = instanceId;
  chartVisible.value = true;
}

/** 挂起 / 激活实例（挂起后该实例的所有待办都办不了，故有二次确认） */
async function toggleActivity(record: Api.Workflow.WorkflowTask, action: 'SUSPEND' | 'ACTIVATE') {
  const suspend = action === 'SUSPEND';

  operating.value = true;
  try {
    const { error } = suspend
      ? await fetchSuspendWorkflowInstance(record.instanceId)
      : await fetchActivateWorkflowInstance(record.instanceId);

    if (error) {
      window.$message?.error?.(
        suspend ? $t('page.workflow.todo.suspendFailed') : $t('page.workflow.todo.activateFailed')
      );
      return;
    }

    window.$message?.success?.(
      suspend ? $t('page.workflow.todo.suspendSuccess') : $t('page.workflow.todo.activateSuccess')
    );
    await getData();
  } finally {
    operating.value = false;
  }
}

/** 选人确认：统一走 `/workflow/task/handle`，`targetHandlers` 传用户 id 字符串数组 */
async function handleCandidateConfirmed(userIds: string[]) {
  candidateSubmitting.value = true;
  try {
    const { error } = await fetchHandleWorkflowTask({
      taskId: candidateTaskId.value,
      action: candidateAction.value,
      targetHandlers: userIds
    });

    if (error) {
      // 失败时保留弹窗与已勾选的人，用户不必重选
      window.$message?.error?.($t('page.workflow.todo.handleFailed'));
      return;
    }

    window.$message?.success?.($t('page.workflow.todo.handleSuccess'));
    candidateVisible.value = false;
    await getData();
  } finally {
    candidateSubmitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <TodoSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.workflow.todo.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <!-- 待办只能逐条办理，没有「新增 / 批量删除」，故关掉这两个内置按钮 -->
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
        row-key="taskId"
        size="small"
        :pagination="mobilePagination"
        :scroll="scrollConfig"
        class="h-full"
      />
      <TodoHandleModal v-model:visible="handleVisible" :task="handleTask" @handled="getData" />
      <TodoCandidateModal
        v-model:visible="candidateVisible"
        :task-id="candidateTaskId"
        :action="candidateAction"
        :confirm-loading="candidateSubmitting"
        @confirmed="handleCandidateConfirmed"
      />
      <WarmFlowChart v-model:visible="chartVisible" :instance-id="chartInstanceId" />
    </ACard>
  </div>
</template>

<style scoped></style>
