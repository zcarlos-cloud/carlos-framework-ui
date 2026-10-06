<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Tag } from 'ant-design-vue';
import { fetchCleanJobLog, fetchGetJobLogList } from '@/service/api';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import JobLogDetailDrawer from './modules/job-log-detail-drawer.vue';
import JobLogSearch from './modules/job-log-search.vue';

ensureEnumDict('job');

/**
 * 8 个定宽列 + 操作列：64+150+160+100+90+160+100+150+90 = 1064，
 * 弹性列 resultMessage 吃剩余宽度，故取 1200。
 */
const TABLE_SCROLL_X = 1200;

const { tableWrapperRef, scrollConfig } = useTableScroll(TABLE_SCROLL_X);

/**
 * 执行日志只读（日志由调度链路产生，页面不暴露新增/编辑/删除单条），
 * 因此不接 useTableOperate；唯一的写操作是「按保留天数清理」。
 */
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
  apiFn: fetchGetJobLogList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    jobName: undefined,
    serviceName: undefined,
    handlerName: undefined,
    status: undefined,
    start: undefined,
    end: undefined
  },
  columns: () => [
    {
      key: 'index',
      dataIndex: 'index',
      title: $t('common.index'),
      align: 'center',
      width: 64
    },
    {
      key: 'jobName',
      dataIndex: 'jobName',
      title: $t('page.manage.job.jobName'),
      align: 'center',
      width: 150,
      ellipsis: true
    },
    {
      key: 'handlerName',
      dataIndex: 'handlerName',
      title: $t('page.manage.job.handlerName'),
      align: 'center',
      width: 160,
      ellipsis: true
    },
    {
      key: 'triggerType',
      dataIndex: 'triggerType',
      title: $t('page.manage.jobLog.triggerType'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => <Tag>{enumDictText('job', 'JobTriggerType', record.triggerType)}</Tag>
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: $t('page.manage.jobLog.status'),
      align: 'center',
      width: 90,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('job', 'JobExecutionStatus', record.status)}>
          {enumDictText('job', 'JobExecutionStatus', record.status)}
        </Tag>
      )
    },
    {
      key: 'startTime',
      dataIndex: 'startTime',
      title: $t('page.manage.jobLog.startTime'),
      align: 'center',
      width: 160,
      customRender: ({ record }) => formatDateTime(record.startTime)
    },
    {
      key: 'durationMs',
      dataIndex: 'durationMs',
      title: $t('page.manage.jobLog.durationMs'),
      align: 'center',
      width: 100,
      // durationMs 是 Long，后端按字符串下发；执行中的记录没有耗时。
      // 字符串 "0" 是 truthy，耗时 0ms 会正确显示为 "0 ms" 而非 "-"——这正是要的行为
      customRender: ({ record }) => (record.durationMs ? `${record.durationMs} ms` : '-')
    },
    {
      key: 'serverNode',
      dataIndex: 'serverNode',
      title: $t('page.manage.jobLog.serverNode'),
      align: 'center',
      width: 150,
      ellipsis: true
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'resultMessage',
      dataIndex: 'resultMessage',
      title: $t('page.manage.jobLog.resultMessage'),
      align: 'center',
      ellipsis: true,
      customRender: ({ record }) => record.resultMessage || '-'
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 90,
      customRender: ({ record }) => (
        <Button type="primary" ghost size="small" onClick={() => openDetail(record.id)}>
          {$t('page.manage.jobLog.detail')}
        </Button>
      )
    }
  ]
});

/** 详情抽屉（只读） */
const detailVisible = ref(false);
const detailId = ref('');

function openDetail(id: string) {
  detailId.value = id;
  detailVisible.value = true;
}

/**
 * 按保留天数清理历史日志
 *
 * 后端 JobLogController.clean 的 retainDays 约束为 @Min(1) @Max(3650)，这里控件层对齐。
 */
const cleanVisible = ref(false);
const cleanLoading = ref(false);
const retainDays = ref(30);

function openClean() {
  retainDays.value = 30;
  cleanVisible.value = true;
}

async function handleClean() {
  // AInputNumber 可被清空为 null；axios 丢弃 null 参数后后端走 defaultValue=30，
  // 用户会以为按自己填的天数执行，实则静默按 30 天做不可恢复的批量删除——必须先拦下
  if (!retainDays.value) {
    window.$message?.warning?.($t('page.manage.jobLog.form.retainDaysRequired'));
    return;
  }

  cleanLoading.value = true;
  try {
    const { data: removed, error } = await fetchCleanJobLog(retainDays.value);

    if (error) {
      window.$message?.error?.($t('page.manage.jobLog.cleanFailed'));
      return;
    }

    window.$message?.success?.($t('page.manage.jobLog.cleanSuccess', { count: removed ?? 0 }));
    cleanVisible.value = false;
    await getData();
  } finally {
    cleanLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <JobLogSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.jobLog.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <!-- 执行日志只读：隐藏「新增 / 批量删除」 -->
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading"
          :show-add="false"
          :show-delete="false"
          @refresh="getData"
        >
          <template #suffix>
            <AButton danger size="small" @click="openClean">{{ $t('page.manage.jobLog.clean') }}</AButton>
          </template>
        </TableHeaderOperation>
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="data"
        size="small"
        :scroll="scrollConfig"
        :loading="loading"
        row-key="id"
        :pagination="mobilePagination"
        class="h-full"
      />
      <JobLogDetailDrawer :id="detailId" v-model:visible="detailVisible" />
      <AModal
        v-model:open="cleanVisible"
        :title="$t('page.manage.jobLog.clean')"
        :confirm-loading="cleanLoading"
        @ok="handleClean"
      >
        <div class="flex-y-center gap-12px">
          <span>{{ $t('page.manage.jobLog.cleanRetainDays') }}</span>
          <AInputNumber v-model:value="retainDays" :min="1" :max="3650" />
        </div>
        <div class="mt-8px text-12px text-gray-400">{{ $t('page.manage.jobLog.cleanTip') }}</div>
      </AModal>
    </ACard>
  </div>
</template>

<style scoped></style>
