<script setup lang="tsx">
import { type Ref, computed, ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchDeleteDevkitDataSource, fetchGetDevkitDataSourceList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { enumDictColor, enumDictText } from '@/utils/enum-dict';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import DevkitDatasourceOperateDrawer from './modules/datasource-operate-drawer.vue';
import DevkitDatasourceSearch from './modules/datasource-search.vue';

const TABLE_SCROLL_X = 1400;

const { tableWrapperRef, scrollConfig } = useTableScroll(TABLE_SCROLL_X);

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
  apiFn: fetchGetDevkitDataSourceList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    dsName: undefined,
    dbType: undefined,
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
      key: 'dsName',
      dataIndex: 'dsName',
      title: $t('page.devkit.datasource.dsName'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      key: 'dbType',
      dataIndex: 'dbType',
      title: $t('page.devkit.datasource.dbType'),
      align: 'center',
      width: 120,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('devkit', 'DevkitDbType', record.dbType)}>
          {enumDictText('devkit', 'DevkitDbType', record.dbType)}
        </Tag>
      )
    },
    {
      // 不写宽度：吃掉剩余宽度
      key: 'host',
      dataIndex: 'host',
      title: $t('page.devkit.datasource.address'),
      align: 'center',
      ellipsis: true,
      customRender: ({ record }) => `${record.host}:${record.port}`
    },
    {
      key: 'databaseName',
      dataIndex: 'databaseName',
      title: $t('page.devkit.datasource.databaseName'),
      align: 'center',
      width: 160,
      ellipsis: true
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: $t('page.devkit.datasource.status'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('devkit', 'DevkitStatus', record.status)}>
          {enumDictText('devkit', 'DevkitStatus', record.status)}
        </Tag>
      )
    },
    {
      key: 'createTime',
      dataIndex: 'createTime',
      title: $t('page.devkit.common.createTime'),
      align: 'center',
      width: 180,
      customRender: ({ record }) => formatDateTime(record.createTime)
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 130,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
            {$t('common.edit')}
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
  // devkit 的 status 是数字码（0/1），与框架 TableData 的 EnableStatus（'1'/'2'）不兼容，
  // 故在调用处断言 —— 与 manage/menu、org/department 的既有做法一致
} = useTableOperate(data as unknown as Ref<AntDesign.TableData[]>, getData);

/** 编辑行数据（从断言后的 TableData 取回真实类型） */
const editingRow = computed(() => (editingData.value as unknown as Api.Devkit.DataSource | null) ?? null);

const deleting = ref(false);

async function handleBatchDelete() {
  if (checkedRowKeys.value.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteDevkitDataSource(checkedRowKeys.value);

    if (error) {
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
    const { error } = await fetchDeleteDevkitDataSource([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    deleting.value = false;
  }
}

/** 用函数声明包一层：columns 在 useTableOperate 之前取值，直接引用 handleEdit 会触发 no-use-before-define */
function edit(id: string) {
  handleEdit(id);
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <DevkitDatasourceSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.devkit.datasource.title')"
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
      <DevkitDatasourceOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingRow"
        @submitted="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
