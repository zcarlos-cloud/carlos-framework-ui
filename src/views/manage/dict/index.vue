<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { dictTypeRecord, dictTypeTagColor } from '@/constants/business';
import { fetchDeleteDict, fetchGetDictList, fetchRefreshDictCache } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { enumTagColor, enumText } from '@/utils/common';
import { $t } from '@/locales';
import DictItemDrawer from './modules/dict-item-drawer.vue';
import DictOperateDrawer from './modules/dict-operate-drawer.vue';
import DictSearch from './modules/dict-search.vue';

const { tableWrapperRef, scrollConfig } = useTableScroll(1000);

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
  apiFn: fetchGetDictList,
  apiParams: {
    current: 1,
    size: 10,
    // 后端 SysDictPageParam：dictName / description / type
    dictName: undefined,
    type: undefined,
    description: undefined
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
      key: 'dictCode',
      dataIndex: 'dictCode',
      title: $t('page.manage.dict.dictCode'),
      align: 'center',
      width: 160,
      ellipsis: true
    },
    {
      key: 'dictName',
      dataIndex: 'dictName',
      title: $t('page.manage.dict.dictName'),
      align: 'center',
      width: 160,
      ellipsis: true
    },
    {
      key: 'type',
      dataIndex: 'type',
      title: $t('page.manage.dict.dictType'),
      align: 'center',
      width: 120,
      customRender: ({ record }) => (
        <Tag color={enumTagColor(dictTypeTagColor, record.type)}>{enumText(dictTypeRecord, record.type)}</Tag>
      )
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'description',
      dataIndex: 'description',
      title: $t('page.manage.dict.description'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 200,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
            {$t('common.edit')}
          </Button>
          <Button size="small" onClick={() => openDictItem(record)}>
            {$t('page.manage.dict.dictItem')}
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
    const { error } = await fetchDeleteDict(ids);

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
    const { error } = await fetchDeleteDict([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    deleting.value = false;
  }
}

async function handleRefreshCache() {
  const { error } = await fetchRefreshDictCache();

  if (error) {
    return;
  }

  window.$message?.success?.($t('page.manage.dict.cacheRefreshed'));
}

const dictItemVisible = ref(false);
const selectedDict = ref<Api.SystemManage.Dict | null>(null);

function openDictItem(record: Api.SystemManage.Dict) {
  selectedDict.value = record;
  dictItemVisible.value = true;
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <DictSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.dict.title')"
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
            <AButton size="small" @click="handleRefreshCache">{{ $t('page.manage.dict.refreshCache') }}</AButton>
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

      <DictOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />

      <DictItemDrawer
        v-if="selectedDict"
        v-model:visible="dictItemVisible"
        :dict-id="selectedDict.id"
        @submitted="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
