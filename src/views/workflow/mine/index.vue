<script setup lang="tsx">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import {
  fetchActivateWorkflowInstance,
  fetchGetWorkflowMinePage,
  fetchSuspendWorkflowInstance,
  fetchTakeBackWorkflowInstance
} from '@/service/api';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import WarmFlowChart from '@/components/custom/warm-flow-chart.vue';
import MineActionModal from './modules/mine-action-modal.vue';
import MineSearch from './modules/mine-search.vue';

// 流程状态/激活状态改由后端枚举字典驱动：搜索栏共用本页加载的字典
ensureEnumDict('workflow');

/**
 * 列宽：定宽列合计 64+160+180+100+100+170+330 = 1104，flowName 列吃剩余宽度，
 * 故横向最小宽度取 1400（≈ 给 flowName 留 296）。
 *
 * 操作列给到 330：行操作有 6 个（撤销 / 终止 / 拿回 / 挂起|激活 / 流程图 / 审批记录），
 * 且全部是 `type="link"` 的文字按钮（无边框，比 default 按钮窄），参考待办页的取值。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1400);

const router = useRouter();

/** 实例已挂起码值，与后端 `activity_status` 一致（0 挂起 / 1 激活） */
const ACTIVITY_SUSPENDED: Api.Workflow.WorkflowActivityStatus = 0;

/** 行操作进行中（拿回 / 挂起 / 激活），绑定按钮 disabled 防双击重复触发 */
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
  apiFn: fetchGetWorkflowMinePage,
  apiParams: {
    current: 1,
    size: 10,
    // 后端：flowName 为模糊匹配，flowStatus / businessId 为等值匹配；发起人恒为当前用户
    flowName: undefined,
    flowStatus: undefined,
    businessId: undefined
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
      title: $t('page.workflow.mine.flowName'),
      align: 'center',
      // 不写 width：名称列吃掉剩余宽度
      ellipsis: true
    },
    {
      key: 'businessId',
      dataIndex: 'businessId',
      title: $t('page.workflow.mine.businessId'),
      align: 'center',
      width: 160,
      ellipsis: true,
      // 业务单号是发起人自己传的，**可能为空**，空值显示 `-`（与其它可空列的写法一致）
      customRender: ({ record }) => record.businessId || '-'
    },
    {
      key: 'nodeName',
      dataIndex: 'nodeName',
      title: $t('page.workflow.mine.nodeName'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      key: 'flowStatus',
      dataIndex: 'flowStatus',
      title: $t('page.workflow.mine.flowStatus'),
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
      title: $t('page.workflow.mine.activityStatus'),
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
      title: $t('page.workflow.mine.createTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => formatDateTime(record.createTime)
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 330,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          {/* 撤销 / 终止都不可恢复，且要填意见，故弹确认框（见 MineActionModal 的注释） */}
          <Button type="link" size="small" onClick={() => openAction('REVOKE', record)}>
            {$t('page.workflow.mine.revoke')}
          </Button>
          <Button type="link" size="small" onClick={() => openAction('TERMINATE', record)}>
            {$t('page.workflow.mine.terminate')}
          </Button>
          <Button type="link" size="small" disabled={operating.value} onClick={() => confirmTakeBack(record)}>
            {$t('page.workflow.mine.takeBack')}
          </Button>
          {/* 挂起 / 激活是**实例级**动作：挂起的实例要激活，激活的实例才谈得上挂起 */}
          {record.activityStatus === ACTIVITY_SUSPENDED ? (
            <Popconfirm
              title={$t('page.workflow.mine.activateConfirm')}
              onConfirm={() => toggleActivity(record, 'ACTIVATE')}
            >
              <Button type="link" size="small" disabled={operating.value}>
                {$t('page.workflow.mine.activate')}
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title={$t('page.workflow.mine.suspendConfirm')}
              onConfirm={() => toggleActivity(record, 'SUSPEND')}
            >
              <Button type="link" size="small" disabled={operating.value}>
                {$t('page.workflow.mine.suspend')}
              </Button>
            </Popconfirm>
          )}
          <Button type="link" size="small" onClick={() => openChart(record.instanceId)}>
            {$t('page.workflow.mine.flowChart')}
          </Button>
          {/* 审批记录是独立路由（侧边栏隐藏），按实例 id 打开 */}
          <Button type="link" size="small" onClick={() => goApprovalRecord(record.instanceId)}>
            {$t('page.workflow.mine.approvalRecord')}
          </Button>
        </div>
      )
    }
  ]
});

/** 撤销 / 终止弹窗（共用，动作由 `action` 决定） */
const actionVisible = ref(false);
const actionType = ref<'REVOKE' | 'TERMINATE'>('REVOKE');
const actionInstance = ref<Api.Workflow.WorkflowInstance | null>(null);

/** 流程图弹窗（⚠️ 传的是 instanceId） */
const chartVisible = ref(false);
const chartInstanceId = ref('');

function openAction(action: 'REVOKE' | 'TERMINATE', record: Api.Workflow.WorkflowInstance) {
  actionType.value = action;
  actionInstance.value = record;
  actionVisible.value = true;
}

function openChart(instanceId: string) {
  chartInstanceId.value = instanceId;
  chartVisible.value = true;
}

/** 审批记录是独立的路由（侧边栏隐藏，靠 activeMenu 把「已办任务」点亮） */
function goApprovalRecord(instanceId: string) {
  router.push({ name: 'workflow_his-task', query: { instanceId } });
}

/**
 * 拿回：把流程退回到自己上一次办理的节点
 *
 * 与「撤销 / 终止」不同，这里没有意见输入（后端 `message` 可空），所以用一句 Modal 确认，
 * 不单独开弹窗。
 */
function confirmTakeBack(record: Api.Workflow.WorkflowInstance) {
  window.$modal?.confirm({
    title: $t('page.workflow.mine.takeBack'),
    content: $t('page.workflow.mine.takeBackConfirm'),
    onOk: () => handleTakeBack(record.instanceId)
  });
}

async function handleTakeBack(instanceId: string) {
  operating.value = true;
  try {
    const { error } = await fetchTakeBackWorkflowInstance({ instanceId });

    if (error) {
      window.$message?.error?.($t('page.workflow.mine.takeBackFailed'));

      return;
    }

    window.$message?.success?.($t('page.workflow.mine.takeBackSuccess'));
    await getData();
  } finally {
    operating.value = false;
  }
}

/** 挂起 / 激活实例（挂起后该实例的所有待办都办不了，故有二次确认） */
async function toggleActivity(record: Api.Workflow.WorkflowInstance, action: 'SUSPEND' | 'ACTIVATE') {
  const suspend = action === 'SUSPEND';

  operating.value = true;
  try {
    const { error } = suspend
      ? await fetchSuspendWorkflowInstance(record.instanceId)
      : await fetchActivateWorkflowInstance(record.instanceId);

    if (error) {
      window.$message?.error?.(
        suspend ? $t('page.workflow.mine.suspendFailed') : $t('page.workflow.mine.activateFailed')
      );
      return;
    }

    window.$message?.success?.(
      suspend ? $t('page.workflow.mine.suspendSuccess') : $t('page.workflow.mine.activateSuccess')
    );
    await getData();
  } finally {
    operating.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <MineSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.workflow.mine.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <!-- 发起记录是业务数据，页面里没有新增入口（发起在各自业务模块），故关掉「新增 / 批量删除」 -->
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
        row-key="instanceId"
        size="small"
        :pagination="mobilePagination"
        :scroll="scrollConfig"
        class="h-full"
      />
      <MineActionModal
        v-model:visible="actionVisible"
        :action="actionType"
        :instance="actionInstance"
        @done="getData"
      />
      <WarmFlowChart v-model:visible="chartVisible" :instance-id="chartInstanceId" />
    </ACard>
  </div>
</template>

<style scoped></style>
