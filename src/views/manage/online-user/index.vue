<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag, Tooltip } from 'ant-design-vue';
import { fetchGetOnlineUserList, fetchKickOnlineUser } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import OnlineUserSearch from './modules/online-user-search.vue';

/**
 * 列宽：定宽列合计 64+120+140+120+170+170+220 = 1004，弹性列 userAgent 不封顶。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1100);

/** 踢下线进行中，绑定按钮 disabled 防双击 */
const operating = ref(false);

const authStore = useAuthStore();

/**
 * 是否当前登录用户自己的会话行 —— 踢自己会立即掉登录态（含本页面），前端直接禁用以避免误操作。
 * 后端无法区分“当前操作者”，故保护只做在前端。
 */
function isSelf(record: Api.Auth.OnlineUser) {
  return record.username === authStore.userInfo.userName;
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
  apiFn: fetchGetOnlineUserList,
  apiParams: {
    current: 1,
    size: 10,
    username: undefined
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
      title: $t('page.manage.onlineUser.username'),
      align: 'center',
      width: 120
    },
    {
      key: 'clientId',
      dataIndex: 'clientId',
      title: $t('page.manage.onlineUser.clientId'),
      align: 'center',
      width: 140,
      customRender: ({ record }) => <Tag>{record.clientId}</Tag>
    },
    {
      key: 'ip',
      dataIndex: 'ip',
      title: $t('page.manage.onlineUser.ip'),
      align: 'center',
      width: 120,
      customRender: ({ record }) => record.ip || '-'
    },
    {
      key: 'loginTime',
      dataIndex: 'loginTime',
      title: $t('page.manage.onlineUser.loginTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => formatDateTime(record.loginTime)
    },
    {
      key: 'expireTime',
      dataIndex: 'expireTime',
      title: $t('page.manage.onlineUser.expireTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => formatDateTime(record.expireTime)
    },
    {
      key: 'userAgent',
      dataIndex: 'userAgent',
      title: $t('page.manage.onlineUser.userAgent'),
      align: 'center',
      width: 220,
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
      width: 180,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Popconfirm
            title={$t('page.manage.onlineUser.kickConfirm')}
            onConfirm={() => handleKick({ sessionIds: [record.sessionId] })}
          >
            <Button danger size="small" disabled={operating.value || isSelf(record)}>
              {$t('page.manage.onlineUser.kick')}
            </Button>
          </Popconfirm>
          <Popconfirm
            title={$t('page.manage.onlineUser.kickAllConfirm', { name: record.username })}
            onConfirm={() => handleKick({ username: record.username })}
          >
            <Button danger type="text" size="small" disabled={operating.value || isSelf(record)}>
              {$t('page.manage.onlineUser.kickAll')}
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ]
});

/**
 * 踢下线：按会话（sessionIds）或按用户全部会话（username），成功后刷新列表。
 *
 * 后端语义：零命中（会话均已过期）时抛 BusinessException（50251），
 * 由请求层统一弹出后端 message，前端不再自定义失败文案；成功时返回实际踢掉的会话数。
 */
async function handleKick(params: Api.Auth.OnlineUserKickParams) {
  operating.value = true;
  try {
    const { data: kicked, error } = await fetchKickOnlineUser(params);
    if (error) {
      return;
    }
    window.$message?.success?.($t('page.manage.onlineUser.kickSuccess', { count: kicked ?? 0 }));
    await getData();
  } finally {
    operating.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <OnlineUserSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.onlineUser.title')"
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
        row-key="sessionId"
        size="small"
        :pagination="mobilePagination"
        :scroll="scrollConfig"
        class="h-full"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
