<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { storageTypeRecord } from '@/constants/business';
import {
  fetchDeleteStorageConfig,
  fetchGetStorageConfigList,
  fetchSetDefaultStorageConfig,
  fetchTestStorageConfig
} from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { $t } from '@/locales';
import StorageConfigOperateDrawer from './modules/storage-config-operate-drawer.vue';
import StorageConfigSearch from './modules/storage-config-search.vue';

/**
 * 列宽：定宽列合计 64+120+130+220+100+100+260 = 994，configName 吃剩余宽度。
 * 默认的 702 装不下 8 列，给到 1200 让 configName 还剩约 206px。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1200);

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
  apiFn: fetchGetStorageConfigList,
  apiParams: {
    current: 1,
    size: 10,
    // 后端 FileStorageConfigPageParam：configName / storageType / configStatus
    configName: undefined,
    storageType: undefined,
    configStatus: undefined
  },
  columns: () => [
    {
      key: 'index',
      title: $t('common.index'),
      dataIndex: 'index',
      align: 'center',
      width: 64
    },
    {
      key: 'configName',
      dataIndex: 'configName',
      title: $t('page.manage.storageConfig.configName'),
      align: 'center',
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      ellipsis: true
    },
    {
      key: 'storageType',
      dataIndex: 'storageType',
      title: $t('page.manage.storageConfig.storageType'),
      align: 'center',
      width: 120,
      customRender: ({ record }) => {
        const { storageType } = record;

        if (storageType === null || storageType === undefined) {
          return null;
        }

        const tagMap: Record<Api.SystemManage.StorageConfig['storageType'], string> = {
          S3: 'blue',
          LOCAL: 'green'
        };

        return <Tag color={tagMap[storageType]}>{$t(storageTypeRecord[storageType])}</Tag>;
      }
    },
    {
      key: 'bucketName',
      dataIndex: 'bucketName',
      title: $t('page.manage.storageConfig.bucketName'),
      align: 'center',
      width: 130,
      ellipsis: true
    },
    {
      key: 'endpoint',
      title: $t('page.manage.storageConfig.endpoint'),
      align: 'center',
      width: 220,
      ellipsis: true,
      customRender: ({ record }) => {
        return record.storageType === 'S3' ? record.endpoint : record.localBasePath;
      }
    },
    {
      key: 'isDefault',
      dataIndex: 'isDefault',
      title: $t('page.manage.storageConfig.isDefault'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => {
        const { isDefault } = record;

        if (isDefault === null || isDefault === undefined) {
          return null;
        }

        return isDefault ? (
          <Tag color="success">{$t('page.manage.storageConfig.defaultTag')}</Tag>
        ) : (
          <Tag color="default">-</Tag>
        );
      }
    },
    {
      key: 'configStatus',
      dataIndex: 'configStatus',
      title: $t('page.manage.common.statusTitle'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => {
        const { configStatus } = record;

        // 后端为 Integer 0/1，不是 boolean
        if (configStatus === null || configStatus === undefined) {
          return null;
        }

        const enabled = configStatus === 1;
        const labelKey = enabled ? 'page.manage.common.status.enable' : 'page.manage.common.status.disable';

        return <Tag color={enabled ? 'success' : 'default'}>{$t(labelKey)}</Tag>;
      }
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      // 4 个按钮，其中「设为默认」为 4 字文案，故比基准的 130 宽
      width: 260,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
            {$t('common.edit')}
          </Button>
          <Button size="small" disabled={record.isDefault} onClick={() => handleSetDefault(record.id)}>
            {$t('page.manage.storageConfig.setDefault')}
          </Button>
          <Button size="small" onClick={() => handleTest(record.id)}>
            {$t('page.manage.storageConfig.test')}
          </Button>
          <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
            <Button danger size="small">
              {$t('common.delete')}
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ]
});

const {
  drawerVisible,
  operateType,
  editingData,
  handleAdd,
  handleEdit,
  checkedRowKeys,
  rowSelection,
  onBatchDeleted,
  onDeleted
} = useTableOperate(data, getData);

const deleting = ref(false);

/**
 * 列定义在 useTableOperate 之前，而 handleEdit 是解构出来的 const（不提升），
 * 直接引用会触发 @typescript-eslint/no-use-before-define。
 * 用函数声明（会提升）包一层即可，调用发生在点击时，handleEdit 必然已就绪。
 */
function edit(id: string) {
  handleEdit(id);
}

async function handleBatchDelete() {
  const ids = checkedRowKeys.value as string[];

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteStorageConfig(ids);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    // success toast 由 onBatchDeleted 内部统一发出，此处不得重复
    await onBatchDeleted();
  } finally {
    deleting.value = false;
  }
}

async function handleDelete(id: string) {
  deleting.value = true;
  try {
    const { error } = await fetchDeleteStorageConfig([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    deleting.value = false;
  }
}

async function handleSetDefault(id: string) {
  const { error } = await fetchSetDefaultStorageConfig(id);

  if (error) {
    return;
  }

  window.$message?.success?.($t('page.manage.storageConfig.setDefaultSuccess'));
  getDataByPage();
}

async function handleTest(id: string) {
  const { error, data: result } = await fetchTestStorageConfig(id);

  if (error) {
    return;
  }

  if (result) {
    window.$message?.success?.($t('page.manage.storageConfig.testSuccess'));
  } else {
    window.$message?.error?.($t('page.manage.storageConfig.testFailed'));
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <StorageConfigSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.storageConfig.title')"
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
        />
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

      <StorageConfigOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
