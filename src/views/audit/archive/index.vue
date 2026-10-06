<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchDeleteArchiveRecord, fetchGetArchiveRecordList, fetchRestoreArchive } from '@/service/api';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { formatDateTime, formatFileSize } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import AuditArchiveDetailDrawer from './modules/audit-archive-detail-drawer.vue';
import AuditArchiveSearch from './modules/audit-archive-search.vue';

ensureEnumDict('audit');

// 归档记录列较多（含批次ID、数据区间、存储路径）：定宽列之和 1554，
// 弹性列 storagePath 留 240 的下限，故取 1800
const { tableWrapperRef, scrollConfig } = useTableScroll(1800);

/** 详情抽屉状态。函数声明会被提升，因此可在下方 columns 中直接引用 openDetail */
const detailVisible = ref(false);
const detailId = ref('');

/**
 * 行内操作状态，声明在 useTable 之前以便 columns 的渲染函数直接读取
 *
 * ⚠️ 存的是**行标识**而不是 boolean。原先这里是 `deleting` / `restoring` 两个全局单例 ref，
 * 却接到了每一行按钮的 `loading` 上 —— 点第 1 行的「恢复」会让当页 10 行全部一起转圈。
 */
const deletingId = ref('');
const restoringId = ref('');

function openDetail(id: string) {
  detailId.value = id;
  detailVisible.value = true;
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
  apiFn: fetchGetArchiveRecordList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    archiveId: undefined,
    archiveStatus: undefined,
    storageType: undefined,
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
      key: 'archiveId',
      dataIndex: 'archiveId',
      title: $t('page.audit.archive.archiveId'),
      align: 'center',
      width: 220,
      ellipsis: true
    },
    {
      key: 'archiveDate',
      dataIndex: 'archiveDate',
      title: $t('page.audit.archive.archiveDate'),
      align: 'center',
      width: 120
    },
    {
      key: 'startTime',
      dataIndex: 'startTime',
      title: $t('page.audit.archive.dataRange'),
      align: 'center',
      width: 330,
      customRender: ({ record }) =>
        [formatDateTime(record.startTime), formatDateTime(record.endTime)].filter(Boolean).join(' ~ ')
    },
    {
      key: 'recordCount',
      dataIndex: 'recordCount',
      title: $t('page.audit.archive.recordCount'),
      align: 'center',
      width: 110
    },
    {
      key: 'fileSizeBytes',
      dataIndex: 'fileSizeBytes',
      title: $t('page.audit.archive.fileSizeBytes'),
      align: 'center',
      width: 120,
      customRender: ({ record }) => formatFileSize(record.fileSizeBytes)
    },
    {
      key: 'storageType',
      dataIndex: 'storageType',
      title: $t('page.audit.archive.storageType'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => enumDictText('audit', 'AuditLogStorageType', record.storageType)
    },
    {
      key: 'archiveStatus',
      dataIndex: 'archiveStatus',
      title: $t('page.audit.archive.archiveStatus'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('audit', 'AuditLogArchiveState', record.archiveStatus)}>
          {enumDictText('audit', 'AuditLogArchiveState', record.archiveStatus)}
        </Tag>
      )
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'storagePath',
      dataIndex: 'storagePath',
      title: $t('page.audit.archive.storagePath'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'createdTime',
      dataIndex: 'createdTime',
      title: $t('page.audit.archive.createdTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => formatDateTime(record.createdTime)
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 200,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => openDetail(record.id)}>
            {$t('page.audit.archive.detail')}
          </Button>
          <Popconfirm title={$t('page.audit.archive.confirmRestore')} onConfirm={() => handleRestore(record.archiveId)}>
            <Button type="primary" ghost size="small" loading={restoringId.value === record.archiveId}>
              {$t('page.audit.archive.restore')}
            </Button>
          </Popconfirm>
          <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
            <Button danger size="small" loading={deletingId.value === record.id}>
              {$t('common.delete')}
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ]
});

/**
 * 删除后的刷新
 *
 * 成功提示在这里直接发（不像其它页那样借 `onDeleted()`）：`useTableOperate` 的
 * 泛型约束是 `T extends TableData = Api.Common.CommonRecord<object>`，而
 * `Api.Audit.ArchiveRecord` 刻意没有 createBy/createTime/updateBy/updateTime/status
 * 这几个字段（归档表只有 `created_time`），套进去通不过类型检查。
 * 这里**只弹一次**，SKILL #10 要防的「hook 已弹、页面又弹一遍」并不存在。
 *
 * `getData()` 不会重置 `current`，所以删掉第 N 页最后一行后会停在**空白页**上；
 * 这里按刷新回来的实际结果判断，空了且不在首页时回退一页。
 */
async function refreshAfterRemoval() {
  await getData();

  const current = mobilePagination.value.current ?? 1;

  if (data.value.length === 0 && current > 1) {
    await getDataByPage(current - 1);
  }
}

async function handleDelete(id: string) {
  deletingId.value = id;
  try {
    const { error } = await fetchDeleteArchiveRecord([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    window.$message?.success?.($t('common.deleteSuccess'));
    await refreshAfterRemoval();
  } finally {
    deletingId.value = '';
  }
}

async function handleRestore(archiveId: string) {
  restoringId.value = archiveId;
  try {
    const { error } = await fetchRestoreArchive(archiveId);

    if (error) {
      window.$message?.error?.($t('page.audit.archive.restoreFailed'));
      return;
    }

    window.$message?.success?.($t('page.audit.archive.restoreSuccess'));
    await getData();
  } finally {
    restoringId.value = '';
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <AuditArchiveSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.audit.archive.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <!--
          归档记录由归档任务生成，不提供新增；删除仅支持行内单条，故一并隐藏批量操作按钮。
          用 props 隐藏（原先用 `<template #default />` 覆盖插槽并不生效——空模板会被
          Vue 编译器丢弃，插槽未注册，组件内的兜底按钮照常渲染）
        -->
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading"
          :show-add="false"
          :show-delete="false"
          @refresh="getData"
        />
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
      <AuditArchiveDetailDrawer :id="detailId" v-model:visible="detailVisible" />
    </ACard>
  </div>
</template>

<style scoped></style>
