<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Tag, Tooltip } from 'ant-design-vue';
import { loginLogAuthTypeRecord, loginLogStatusRecord, loginLogStatusTagColor } from '@/constants/business';
import { fetchGetLoginLogList } from '@/service/api';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { enumTagColor, enumText, formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import LoginLogDetailDrawer from './modules/login-log-detail-drawer.vue';
import LoginLogSearch from './modules/login-log-search.vue';

/**
 * 列宽：定宽列合计 64+120+90+140+140+170+100+100+200+200+90 = 1414，弹性列不留，取 1500。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1500);

/** 详情抽屉 */
const detailVisible = ref(false);
const detailId = ref('');

function handleViewDetail(id: string) {
  detailId.value = id;
  detailVisible.value = true;
}

const {
  columns,
  columnChecks,
  data,
  loading,
  getData,
  getDataByPage,
  mobilePagination,
  searchParams,
  resetSearchParams
} = useTable({
  apiFn: fetchGetLoginLogList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    username: undefined,
    logStatus: undefined,
    ip: undefined,
    authType: undefined,
    startTime: undefined,
    endTime: undefined
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
      key: 'username',
      dataIndex: 'username',
      title: $t('page.manage.loginLog.username'),
      align: 'center',
      width: 120
    },
    {
      key: 'logStatus',
      dataIndex: 'logStatus',
      title: $t('page.manage.loginLog.logStatus'),
      align: 'center',
      width: 90,
      customRender: ({ record }) => (
        <Tag color={enumTagColor(loginLogStatusTagColor, record.logStatus)}>
          {enumText(loginLogStatusRecord, record.logStatus)}
        </Tag>
      )
    },
    {
      key: 'ip',
      dataIndex: 'ip',
      title: $t('page.manage.loginLog.ip'),
      align: 'center',
      width: 140,
      customRender: ({ record }) => record.ip || '-'
    },
    {
      key: 'location',
      dataIndex: 'location',
      title: $t('page.manage.loginLog.location'),
      align: 'center',
      width: 140,
      customRender: ({ record }) => record.location || '-'
    },
    {
      key: 'loginTime',
      dataIndex: 'loginTime',
      title: $t('page.manage.loginLog.loginTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => formatDateTime(record.loginTime)
    },
    {
      key: 'authType',
      dataIndex: 'authType',
      title: $t('page.manage.loginLog.authType'),
      align: 'center',
      width: 110,
      customRender: ({ record }) =>
        record.authType ? enumText(loginLogAuthTypeRecord, record.authType as Api.Audit.AuthType) : '-'
    },
    {
      key: 'durationMs',
      dataIndex: 'durationMs',
      title: $t('page.manage.loginLog.durationMs'),
      align: 'center',
      width: 100,
      customRender: ({ record }) =>
        record.durationMs === null || record.durationMs === undefined ? '-' : `${record.durationMs}ms`
    },
    {
      key: 'resultMessage',
      dataIndex: 'resultMessage',
      title: $t('page.manage.loginLog.resultMessage'),
      align: 'center',
      width: 200,
      ellipsis: true,
      customRender: ({ record }) => (
        <Tooltip title={record.resultMessage} placement="topLeft">
          {record.resultMessage || '-'}
        </Tooltip>
      )
    },
    {
      key: 'userAgent',
      dataIndex: 'userAgent',
      title: $t('page.manage.onlineUser.userAgent'),
      align: 'center',
      width: 200,
      ellipsis: true,
      customRender: ({ record }) => (
        <Tooltip title={record.userAgent} placement="topLeft">
          {record.userAgent || '-'}
        </Tooltip>
      )
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 90,
      customRender: ({ record }) => (
        <Button type="link" size="small" onClick={() => handleViewDetail(record.id)}>
          {$t('page.manage.loginLog.detail')}
        </Button>
      )
    }
  ]
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <LoginLogSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.loginLog.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
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
        row-key="id"
        size="small"
        :pagination="mobilePagination"
        :scroll="scrollConfig"
        class="h-full"
      />
    </ACard>
    <LoginLogDetailDrawer :id="detailId" v-model:visible="detailVisible" />
  </div>
</template>

<style scoped></style>
