<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchChangeMessageTypeEnabled, fetchDeleteMessageType, fetchGetMessageTypeList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import TypeOperateDrawer from './modules/type-operate-drawer.vue';
import TypeSearch from './modules/type-search.vue';

const { tableWrapperRef, scrollConfig } = useTableScroll();

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
  apiFn: fetchGetMessageTypeList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    typeCode: undefined,
    typeName: undefined
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
      key: 'typeCode',
      dataIndex: 'typeCode',
      title: $t('page.message.type.typeCode'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'typeName',
      dataIndex: 'typeName',
      title: $t('page.message.type.typeName'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'enabled',
      dataIndex: 'enabled',
      title: $t('page.message.type.enabled'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => {
        const { enabled } = record;

        // 必须守卫：字段缺失时 $t(undefined) 会抛异常，导致表格永远不结束 loading
        if (enabled === null || enabled === undefined) {
          return null;
        }

        // 后端 is_enabled 为 Boolean（与渠道的 0/1/2 数字码不同），故用三元而非 tagMap
        return (
          <Tag color={enabled ? 'success' : 'error'}>
            {$t(enabled ? 'page.message.common.enabled' : 'page.message.common.disabled')}
          </Tag>
        );
      }
    },
    {
      key: 'createTime',
      dataIndex: 'createTime',
      title: $t('page.message.common.createTime'),
      align: 'center',
      width: 180,
      customRender: ({ record }) => formatDateTime(record.createTime)
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      // 三个按钮：启用/停用 + 编辑 + 删除，宽度按「最宽组合不换行」取值
      width: 200,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button size="small" onClick={() => handleChangeEnabled(record)}>
            {$t(record.enabled ? 'page.message.common.disabled' : 'page.message.common.enabled')}
          </Button>
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
} = useTableOperate(data, getData);

const deleting = ref(false);

/**
 * 启用 / 停用
 *
 * 走后端的 enable / disable 专用端点（只收 `@RequestParam Long id`），
 * 与抽屉里改 enabled 等价，但少一次全量 update。
 */
async function handleChangeEnabled(record: Api.Message.MessageType) {
  const { error } = await fetchChangeMessageTypeEnabled(record.id, !record.enabled);

  if (error) {
    window.$message?.error?.($t('common.updateFailed'));
    return;
  }

  window.$message?.success?.($t('common.updateSuccess'));
  await getData();
}

async function handleBatchDelete() {
  const ids = checkedRowKeys.value;

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteMessageType(ids);

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
    const { error } = await fetchDeleteMessageType([id]);

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
    <TypeSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.message.type.title')"
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
      <TypeOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
