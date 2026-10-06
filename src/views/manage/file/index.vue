<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { storageTypeRecord } from '@/constants/business';
import { fetchDeleteFile, fetchDeleteFileBatch, fetchDownloadFile, fetchGetFileList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { EMPTY_TEXT, downloadBlob, formatFileSize } from '@/utils/common';
import { $t } from '@/locales';
import FileSearch from './modules/file-search.vue';
import FileUploadDrawer from './modules/file-upload-drawer.vue';

/**
 * 列宽：定宽列合计 64+100+120+180+120+160+130 = 874，originalName 吃剩余宽度。
 * 默认的 702 装不下 7 列，给到 1100 让 originalName 还剩约 226px。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1100);

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
  apiFn: fetchGetFileList,
  apiParams: {
    current: 1,
    size: 10,
    // 后端 UploadRecordPageParam：originalName / uses / fileExtension / storageType
    originalName: undefined,
    fileExtension: undefined,
    uses: undefined,
    storageType: undefined
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
      key: 'originalName',
      dataIndex: 'originalName',
      title: $t('page.manage.file.originalName'),
      align: 'left',
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      ellipsis: true
    },
    {
      key: 'fileExtension',
      dataIndex: 'fileExtension',
      title: $t('page.manage.file.fileExtension'),
      align: 'center',
      width: 100
    },
    {
      key: 'fileSize',
      dataIndex: 'fileSize',
      title: $t('page.manage.file.fileSize'),
      align: 'center',
      width: 120,
      // 复用 utils/common 的 formatFileSize（此处原先重复实现了一份，且只覆盖到 MB）；
      // 它把空值格式化成「0 B」，对「未知大小」是误导，故空值仍走占位符
      customRender: ({ record }) => <span>{record.fileSize ? formatFileSize(record.fileSize) : EMPTY_TEXT}</span>
    },
    {
      key: 'contentType',
      dataIndex: 'contentType',
      title: $t('page.manage.file.contentType'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      key: 'storageType',
      dataIndex: 'storageType',
      title: $t('page.manage.file.storageType'),
      align: 'center',
      width: 120,
      customRender: ({ record }) => {
        const { storageType } = record;

        if (storageType === null || storageType === undefined) {
          return null;
        }

        // 后端是普通字符串，只对已知的 S3 / LOCAL 做本地化，未知值原样展示
        const known = storageType === 'S3' || storageType === 'LOCAL';
        const tagMap: Record<string, string> = { S3: 'blue', LOCAL: 'green' };

        return (
          <Tag color={tagMap[storageType] ?? 'default'}>{known ? $t(storageTypeRecord[storageType]) : storageType}</Tag>
        );
      }
    },
    {
      key: 'repositoryName',
      dataIndex: 'repositoryName',
      title: $t('page.manage.file.repositoryName'),
      align: 'center',
      width: 160,
      ellipsis: true
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 130,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button size="small" onClick={() => handleDownload(record)}>
            {$t('page.manage.file.download')}
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

const { checkedRowKeys, rowSelection, onBatchDeleted, onDeleted } = useTableOperate(data, getData);

const deleting = ref(false);
const uploadVisible = ref(false);

/** 「新增」在本页的语义就是上传文件，故复用 TableHeaderOperation 的默认新增按钮 */
function openUpload() {
  uploadVisible.value = true;
}

async function handleBatchDelete() {
  const ids = checkedRowKeys.value as string[];

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteFileBatch(ids);

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
    const { error } = await fetchDeleteFile(id);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    deleting.value = false;
  }
}

/**
 * 下载文件
 *
 * 文件名优先用行上的 `originalName`：此前一律存成 `file_${id}`，用户拿到的是一串
 * 雪花 ID，既看不出是什么文件、也没有扩展名（系统无法关联默认程序打开）。
 * 行上没有名字（脏数据）时才退回 id 形式。
 *
 * `downloadBlob` 是 Batch 0 抽出的公共实现（原先是内联的 createObjectURL + <a> + revoke）。
 */
async function handleDownload(record: Api.SystemManage.UploadRecord) {
  const { data: blob, error } = await fetchDownloadFile(record.id);

  if (error || !blob) {
    return;
  }

  downloadBlob(blob, record.originalName || `file_${record.id}`);
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FileSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.file.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0 || deleting"
          :loading="loading"
          @add="openUpload"
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

    <FileUploadDrawer v-model:visible="uploadVisible" @submitted="getDataByPage" />
  </div>
</template>

<style scoped></style>
