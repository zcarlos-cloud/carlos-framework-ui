<script setup lang="tsx">
import { type Ref, ref } from 'vue';
import { Button, Popconfirm, Tag, Tooltip } from 'ant-design-vue';
import { fetchDeleteDevkitRecord, fetchGetDevkitRecordList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { enumDictColor, enumDictText } from '@/utils/enum-dict';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import DevkitRecordSearch from './modules/record-search.vue';

const TABLE_SCROLL_X = 1400;

const { tableWrapperRef, scrollConfig } = useTableScroll(TABLE_SCROLL_X);

function formatSize(size?: string | number) {
  const bytes = Number(size ?? 0);
  if (!bytes) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

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
  apiFn: fetchGetDevkitRecordList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    bizType: undefined,
    projectName: undefined,
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
      key: 'bizType',
      dataIndex: 'bizType',
      title: $t('page.devkit.record.bizType'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('devkit', 'DevkitTemplateType', record.bizType)}>
          {enumDictText('devkit', 'DevkitTemplateType', record.bizType)}
        </Tag>
      )
    },
    {
      key: 'templateGroupName',
      dataIndex: 'templateGroupName',
      title: $t('page.devkit.record.templateGroup'),
      align: 'center',
      width: 200,
      ellipsis: true
    },
    {
      // 不写宽度：吃掉剩余宽度
      key: 'projectName',
      dataIndex: 'projectName',
      title: $t('page.devkit.record.projectName'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'fileCount',
      dataIndex: 'fileCount',
      title: $t('page.devkit.template.fileCount'),
      align: 'center',
      width: 90,
      customRender: ({ record }) => record.fileCount ?? 0
    },
    {
      key: 'totalSize',
      dataIndex: 'totalSize',
      title: $t('page.devkit.record.totalSize'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => formatSize(record.totalSize)
    },
    {
      key: 'durationMs',
      dataIndex: 'durationMs',
      title: $t('page.devkit.record.duration'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => `${record.durationMs ?? 0} ms`
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: $t('page.devkit.record.status'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => {
        const tag = (
          <Tag color={enumDictColor('devkit', 'DevkitStatus', record.status)}>
            {enumDictText('devkit', 'DevkitStatus', record.status)}
          </Tag>
        );
        // 失败时把原因挂在 tooltip 上，列表不额外占一列
        return record.status === 0 && record.errorMsg ? <Tooltip title={record.errorMsg}>{tag}</Tooltip> : tag;
      }
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
      width: 90,
      customRender: ({ record }) => (
        <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
          <Button danger size="small">
            {$t('common.delete')}
          </Button>
        </Popconfirm>
      )
    }
  ]
});

// devkit 的 status 是数字码（0/1），与框架 TableData 的 EnableStatus（'1'/'2'）不兼容，
// 故在调用处断言 —— 与 manage/menu、org/department 的既有做法一致
const { checkedRowKeys, rowSelection, onBatchDeleted, onDeleted } = useTableOperate(
  data as unknown as Ref<AntDesign.TableData[]>,
  getData
);

const deleting = ref(false);

async function handleBatchDelete() {
  if (checkedRowKeys.value.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteDevkitRecord(checkedRowKeys.value);

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
    const { error } = await fetchDeleteDevkitRecord([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <DevkitRecordSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.devkit.record.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0 || deleting"
          :show-add="false"
          :loading="loading"
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
    </ACard>
  </div>
</template>

<style scoped></style>
