<script setup lang="tsx">
import { computed, ref } from 'vue';
import { Button, Popconfirm, Switch, Tag } from 'ant-design-vue';
import type { TableRowSelection } from 'ant-design-vue/es/table/interface';
import { jsonClone } from '@sa/utils';
import {
  fetchDeleteInstance,
  fetchGetInstanceList,
  fetchTestConnection,
  fetchUpdateInstanceStatus
} from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import { healthStatusTagColor, healthStatusText, instanceTypeTagColor, instanceTypeText } from '../shared';
import GroupManageModal from './modules/group-manage-modal.vue';
import InstanceOperateDrawer from './modules/instance-operate-drawer.vue';
import InstanceSearch from './modules/instance-search.vue';

defineOptions({
  name: 'MonitorInstance'
});

const { hasAuth } = useAuth();

/** 搜索区组件引用：分组变更后需同步刷新其分组下拉 */
const instanceSearchRef = ref<InstanceType<typeof InstanceSearch>>();

// 列宽：定宽列合计 64+90+100+80+90+100+170+100+240 = 1034，名称/地址为弹性列
const { tableWrapperRef, scrollConfig } = useTableScroll(1500);

/** 启停开关进行中（绑定 Switch disabled 防双击） */
const statusLoading = ref(false);

const deleting = ref(false);

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
  apiFn: fetchGetInstanceList,
  apiParams: {
    current: 1,
    size: 10,
    keyword: undefined,
    instanceType: undefined,
    env: undefined,
    groupId: undefined,
    healthStatus: undefined
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
      key: 'instanceName',
      dataIndex: 'instanceName',
      title: $t('page.manage.monitor.instance.instanceName'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'instanceType',
      dataIndex: 'instanceType',
      title: $t('page.manage.monitor.instance.instanceType'),
      align: 'center',
      width: 140,
      customRender: ({ record }) => (
        <Tag color={instanceTypeTagColor(record.instanceType)}>{instanceTypeText(record.instanceType)}</Tag>
      )
    },
    {
      key: 'env',
      dataIndex: 'env',
      title: $t('page.manage.monitor.instance.env'),
      align: 'center',
      width: 80,
      customRender: ({ record }) => <Tag>{record.env}</Tag>
    },
    {
      key: 'groupName',
      dataIndex: 'groupName',
      title: $t('page.manage.monitor.instance.groupId'),
      align: 'center',
      width: 120,
      customRender: ({ record }) => record.groupName || '-'
    },
    {
      key: 'addresses',
      dataIndex: 'addresses',
      title: $t('page.manage.monitor.instance.addresses'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'healthStatus',
      dataIndex: 'healthStatus',
      title: $t('page.manage.monitor.instance.healthStatus'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => {
        const { healthStatus } = record;

        if (healthStatus === null || healthStatus === undefined) {
          return null;
        }

        return <Tag color={healthStatusTagColor(healthStatus)}>{healthStatusText(healthStatus)}</Tag>;
      }
    },
    {
      key: 'lastCollectTime',
      dataIndex: 'lastCollectTime',
      title: $t('page.manage.monitor.instance.lastCollectTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => formatDateTime(record.lastCollectTime)
    },
    {
      key: 'collectEnabled',
      dataIndex: 'collectEnabled',
      title: $t('page.manage.monitor.instance.collectEnabled'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Switch
          checked={record.collectEnabled}
          disabled={!hasAuth('monitor:instance:edit') || statusLoading.value}
          onChange={checked => handleToggleCollect(record, Boolean(checked))}
        />
      )
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 240,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          {hasAuth('monitor:instance:edit') && (
            <Button type="primary" ghost size="small" onClick={() => handleEdit(record.id)}>
              {$t('common.edit')}
            </Button>
          )}
          {hasAuth('monitor:instance:test') && (
            <Button size="small" onClick={() => handleTestConnection(record)}>
              {$t('page.manage.monitor.instance.testConnection')}
            </Button>
          )}
          {hasAuth('monitor:instance:delete') && (
            <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
              <Button danger size="small">
                {$t('common.delete')}
              </Button>
            </Popconfirm>
          )}
        </div>
      )
    }
  ]
});

/**
 * 抽屉状态手写，不接 useTableOperate
 *
 * Api.Monitor.Instance 不含 createBy/status 等 CommonRecord 字段，
 * 不满足 useTableOperate 的 AntDesign.TableData 约束（同 job/list 的处理方式）。
 */
const drawerVisible = ref(false);
const operateType = ref<AntDesign.TableOperateType>('add');
const editingData = ref<Api.Monitor.Instance | null>(null);

function handleAdd() {
  operateType.value = 'add';
  editingData.value = null;
  drawerVisible.value = true;
}

function handleEdit(id: string) {
  operateType.value = 'edit';
  const found = data.value.find(item => item.id === id) ?? null;
  editingData.value = jsonClone(found);
  drawerVisible.value = true;
}

const checkedRowKeys = ref<string[]>([]);

const rowSelection = computed<TableRowSelection<Api.Monitor.Instance>>(() => ({
  columnWidth: 48,
  type: 'checkbox',
  selectedRowKeys: checkedRowKeys.value,
  onChange: keys => {
    checkedRowKeys.value = keys.map(String);
  }
}));

async function onBatchDeleted() {
  window.$message?.success($t('common.deleteSuccess'));
  checkedRowKeys.value = [];
  await getData();
}

async function onDeleted() {
  window.$message?.success($t('common.deleteSuccess'));
  await getData();
}

async function handleBatchDelete() {
  const ids = checkedRowKeys.value;

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const results = await Promise.all(ids.map(id => fetchDeleteInstance(String(id))));
    if (results.some(item => item.error)) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }
    await onBatchDeleted();
  } finally {
    deleting.value = false;
  }
}

async function handleDelete(id: string) {
  deleting.value = true;
  try {
    const { error } = await fetchDeleteInstance(id);
    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }
    await onDeleted();
  } finally {
    deleting.value = false;
  }
}

async function handleToggleCollect(record: Api.Monitor.Instance, enabled: boolean) {
  statusLoading.value = true;
  try {
    const { error } = await fetchUpdateInstanceStatus(record.id, { collectEnabled: enabled });
    if (error) {
      window.$message?.error?.($t('common.updateFailed'));
      return;
    }
    record.collectEnabled = enabled;
  } finally {
    statusLoading.value = false;
  }
}

// ==================== 行内测试连接 ====================

const testingId = ref<string | null>(null);

async function handleTestConnection(record: Api.Monitor.Instance) {
  testingId.value = record.id;
  try {
    const { data: result, error } = await fetchTestConnection({ instanceId: record.id });
    if (error || !result) {
      return;
    }
    if (result.success) {
      window.$message?.success?.(
        $t('page.manage.monitor.instance.testInlineSuccess', {
          version: result.version ?? '-',
          elapsedMs: result.elapsedMs ?? '-'
        })
      );
    } else {
      window.$message?.error?.($t('page.manage.monitor.instance.testInlineFailed', { msg: result.errorMsg ?? '-' }));
    }
  } finally {
    testingId.value = null;
  }
}

// ==================== 分组管理 ====================

const groupVisible = ref(false);
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <InstanceSearch
      ref="instanceSearchRef"
      v-model:model="searchParams"
      @reset="resetSearchParams"
      @search="getDataByPage"
    />
    <ACard
      :title="$t('page.manage.monitor.instance.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0 || deleting"
          :loading="loading"
          @add="handleAdd"
          @delete="handleBatchDelete"
          @refresh="getData"
        >
          <template #suffix>
            <AButton size="small" @click="groupVisible = true">
              {{ $t('page.manage.monitor.group.title') }}
            </AButton>
          </template>
        </TableHeaderOperation>
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="data"
        size="small"
        :row-selection="rowSelection"
        :scroll="scrollConfig"
        :loading="loading"
        row-key="id"
        :pagination="mobilePagination"
        class="h-full"
      />
      <InstanceOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
      <GroupManageModal
        v-model:visible="groupVisible"
        @changed="
          () => {
            getData();
            instanceSearchRef?.reloadGroups();
          }
        "
      />
    </ACard>
  </div>
</template>

<style scoped></style>
