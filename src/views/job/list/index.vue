<script setup lang="tsx">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchDeleteJob, fetchGetJobList, fetchPauseJob, fetchResumeJob, fetchRunJobOnce } from '@/service/api';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import JobOperateDrawer from './modules/job-operate-drawer.vue';
import JobSearch from './modules/job-search.vue';

ensureEnumDict('job');

/**
 * 列宽：定宽列合计 64+150+130+160+140+90+160+260 = 1154，description 列吃剩余宽度。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1200);

const router = useRouter();

/**
 * 行操作进行中（执行/暂停/恢复），绑定到按钮 disabled 防双击重复触发。
 *
 * 必须定义在 useTable 之前，columns 的渲染函数才能直接读到（同 record 页的 revokingId）。
 */
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
  apiFn: fetchGetJobList,
  apiParams: {
    current: 1,
    size: 10,
    // 后端 JobPageParam：jobName / handlerName 为模糊，jobGroup / serviceName / status 为精确
    jobName: undefined,
    serviceName: undefined,
    handlerName: undefined,
    status: undefined
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
      key: 'serviceName',
      dataIndex: 'serviceName',
      title: $t('page.manage.job.serviceName'),
      align: 'center',
      width: 130,
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
      key: 'scheduleConf',
      dataIndex: 'scheduleConf',
      title: $t('page.manage.job.scheduleConf'),
      align: 'center',
      width: 160,
      ellipsis: true,
      customRender: ({ record }) => {
        // 老数据没有 scheduleType/scheduleConf 时回退 cronExpression 列
        const scheduleType = record.scheduleType ?? 1;
        const conf = record.scheduleConf || record.cronExpression;
        if (!conf) {
          return null;
        }
        if (scheduleType === 2) {
          return `${$t('page.manage.job.intervalMs')}: ${conf}`;
        }
        return conf;
      }
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: $t('page.manage.job.status'),
      align: 'center',
      width: 90,
      customRender: ({ record }) => {
        if (!record.status) {
          return null;
        }
        return (
          <Tag color={enumDictColor('job', 'JobStatus', record.status)}>
            {enumDictText('job', 'JobStatus', record.status)}
          </Tag>
        );
      }
    },
    {
      key: 'nextFireTime',
      dataIndex: 'nextFireTime',
      title: $t('page.manage.job.nextFireTime'),
      align: 'center',
      width: 160,
      ellipsis: true
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'description',
      dataIndex: 'description',
      title: $t('page.manage.job.description'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 260,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button
            type="primary"
            ghost
            size="small"
            disabled={operating.value}
            onClick={() => handleRunOnce(record.jobName)}
          >
            {$t('page.manage.job.runOnce')}
          </Button>
          {record.status === 'PAUSED' ? (
            <Button
              type="primary"
              ghost
              size="small"
              disabled={operating.value}
              onClick={() => handleResume(record.jobName)}
            >
              {$t('page.manage.job.resume')}
            </Button>
          ) : (
            <Button size="small" disabled={operating.value} onClick={() => handlePause(record.jobName)}>
              {$t('page.manage.job.pause')}
            </Button>
          )}
          <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
            {$t('common.edit')}
          </Button>
          <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.jobName)}>
            <Button danger size="small">
              {$t('common.delete')}
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ]
});

/**
 * 抽屉状态手写，不接 useTableOperate
 *
 * 任务行数据来自 Quartz（JobVO），没有 createBy / createTime 等公共审计字段，
 * 不满足 useTableOperate 的 AntDesign.TableData 约束（它与 audit/archive 的
 * ArchiveRecord 情况相同）。
 */
const drawerVisible = ref(false);
const operateType = ref<AntDesign.TableOperateType>('add');
const editingData = ref<Api.Job.JobRecord | null>(null);

function handleAdd() {
  operateType.value = 'add';
  editingData.value = null;
  drawerVisible.value = true;
}

/**
 * 列定义在上方，而本函数若在列定义里直接以 const 箭头函数引用会触发
 * @typescript-eslint/no-use-before-define，故用函数声明（会提升）；
 * 调用发生在点击时，data 必然已就绪。
 */
function edit(id: string) {
  const record = data.value.find(item => item.id === id);

  // 行已不在当前页数据里（如刚被删）时不应开着三个锁定字段全空的编辑抽屉
  if (!record) {
    return;
  }

  operateType.value = 'edit';
  editingData.value = record;
  drawerVisible.value = true;
}

async function handleRunOnce(jobName: string) {
  operating.value = true;
  try {
    const { error } = await fetchRunJobOnce(jobName);
    if (error) {
      window.$message?.error?.($t('page.manage.job.runFailed'));
      return;
    }
    window.$message?.success?.($t('page.manage.job.runTriggered'));
  } finally {
    operating.value = false;
  }
}

async function handlePause(jobName: string) {
  operating.value = true;
  try {
    const { error } = await fetchPauseJob(jobName);
    if (error) {
      return;
    }
    await getData();
  } finally {
    operating.value = false;
  }
}

async function handleResume(jobName: string) {
  operating.value = true;
  try {
    const { error } = await fetchResumeJob(jobName);
    if (error) {
      return;
    }
    await getData();
  } finally {
    operating.value = false;
  }
}

async function handleDelete(jobName: string) {
  const { error } = await fetchDeleteJob(jobName);
  if (error) {
    window.$message?.error?.($t('common.deleteFailed'));
    return;
  }
  window.$message?.success?.($t('common.deleteSuccess'));
  await getData();
}

/** 跳转执行日志页 */
function goLog() {
  router.push({ name: 'job_log' });
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <JobSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.job.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="true"
          :loading="loading"
          @add="handleAdd"
          @refresh="getData"
        >
          <template #suffix>
            <AButton size="small" @click="goLog">{{ $t('page.manage.job.viewLog') }}</AButton>
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

      <JobOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
