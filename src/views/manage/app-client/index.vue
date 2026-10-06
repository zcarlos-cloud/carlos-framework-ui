<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag, TypographyParagraph } from 'ant-design-vue';
import { clientStatusRecord } from '@/constants/business';
import {
  fetchDeleteAppClient,
  fetchExportAppClient,
  fetchExportAppClientTemplate,
  fetchGetAppClientPage,
  fetchImportAppClient,
  fetchResetClientSecret
} from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { $t } from '@/locales';
import AppClientOperateDrawer from './modules/app-client-operate-drawer.vue';
import AppClientSearch from './modules/app-client-search.vue';
import AppCategoryManageModal from './modules/app-category-manage-modal.vue';

/**
 * 列宽：定宽列合计 64+200+100+160+220+170+170+170+220 = 1474，appName 吃剩余宽度。
 * 默认的 702 装不下 10 列，给到 1700 让 appName 还剩约 226px。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1700);

/** 后端下发的 clientStatus 是枚举名（ENABLE / DISABLE / LOGGED_OUT） */
const statusTagMap: Record<string, string> = {
  ENABLE: 'success',
  DISABLE: 'default',
  LOGGED_OUT: 'warning'
};

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
  apiFn: fetchGetAppClientPage,
  apiParams: {
    current: 1,
    size: 10,
    // 后端 AppClientPageParam：appKey / appName / clientStatus
    // （clientStatus 此前只是声明了参数、从没进过 wrapper，B5 已修，现为真实筛选）
    appKey: undefined,
    appName: undefined,
    clientStatus: undefined
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
      key: 'appKey',
      dataIndex: 'appKey',
      title: $t('page.manage.appClient.appKey'),
      align: 'center',
      width: 200,
      ellipsis: true
    },
    {
      key: 'appName',
      dataIndex: 'appName',
      title: $t('page.manage.appClient.appName'),
      align: 'center',
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      ellipsis: true
    },
    {
      key: 'clientStatus',
      dataIndex: 'clientStatus',
      title: $t('page.manage.common.statusTitle'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => {
        const status = record.clientStatus as string | undefined;

        if (status === null || status === undefined) {
          return null;
        }

        const label = status in clientStatusRecord ? $t(clientStatusRecord[status]) : status;

        return <Tag color={statusTagMap[status] ?? 'default'}>{label}</Tag>;
      }
    },
    {
      key: 'scopes',
      dataIndex: 'scopes',
      title: $t('page.manage.appClient.scopes'),
      align: 'center',
      width: 160,
      ellipsis: true
    },
    {
      key: 'redirectUris',
      dataIndex: 'redirectUris',
      title: $t('page.manage.appClient.redirectUris'),
      align: 'center',
      width: 220,
      ellipsis: true
    },
    {
      key: 'clientIssuedAt',
      dataIndex: 'clientIssuedAt',
      title: $t('page.manage.appClient.clientIssuedAt'),
      align: 'center',
      width: 170
    },
    {
      key: 'clientSecretExpiresAt',
      dataIndex: 'clientSecretExpiresAt',
      title: $t('page.manage.appClient.clientSecretExpiresAt'),
      align: 'center',
      width: 170
    },
    {
      key: 'updateTime',
      dataIndex: 'updateTime',
      title: $t('page.manage.appClient.updateTime'),
      align: 'center',
      width: 170
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      // 3 个按钮，其中「重置密钥」为 4 字文案，故比基准的 130 宽
      width: 220,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
            {$t('common.edit')}
          </Button>
          <Popconfirm
            title={$t('page.manage.appClient.confirmResetSecret')}
            onConfirm={() => handleResetSecret(record.id)}
          >
            <Button type="primary" ghost size="small">
              {$t('page.manage.appClient.resetSecret')}
            </Button>
          </Popconfirm>
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
const fileInputRef = ref<HTMLInputElement | null>(null);
const categoryModalVisible = ref(false);

/**
 * 列定义在 useTableOperate 之前，而 handleEdit 是解构出来的 const（不提升），
 * 直接引用会触发 @typescript-eslint/no-use-before-define。
 * 用函数声明（会提升）包一层即可，调用发生在点击时，handleEdit 必然已就绪。
 */
function edit(id: string) {
  handleEdit(id);
}

function openCategoryModal() {
  categoryModalVisible.value = true;
}

async function handleBatchDelete() {
  const ids = checkedRowKeys.value as string[];

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteAppClient(ids);

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
    const { error } = await fetchDeleteAppClient([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    deleting.value = false;
  }
}

async function handleResetSecret(id: string) {
  const { data: secret, error } = await fetchResetClientSecret(id);

  if (error || !secret) {
    return;
  }

  window.$modal?.info({
    title: $t('page.manage.appClient.resetSecretSuccess'),
    content: () => (
      <div>
        <p>{$t('page.manage.appClient.resetSecretTip')}</p>
        <TypographyParagraph copyable code>
          {secret}
        </TypographyParagraph>
      </div>
    ),
    okText: $t('page.manage.appClient.savedSecret')
  });

  getDataByPage();
}

/** 下载 blob 并触发浏览器保存 */
function downloadBlob(blob: unknown, fileName: string) {
  const url = window.URL.createObjectURL(blob as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}

async function handleExport() {
  const { data: blob, error } = await fetchExportAppClient();

  if (error) {
    window.$message?.error?.($t('page.manage.common.exportFailed'));
    return;
  }

  if (blob) {
    downloadBlob(blob, `app_client_export_${new Date().getTime()}.xlsx`);
  }
}

async function handleExportTemplate() {
  const { data: blob, error } = await fetchExportAppClientTemplate();

  if (error) {
    window.$message?.error?.($t('page.manage.common.exportFailed'));
    return;
  }

  if (blob) {
    downloadBlob(blob, 'app_client_template.xlsx');
  }
}

function handleImportClick() {
  fileInputRef.value?.click();
}

async function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    return;
  }

  const { error } = await fetchImportAppClient(file);

  if (error) {
    window.$message?.error?.($t('page.manage.common.importFailed'));
    return;
  }

  window.$message?.success?.($t('page.manage.common.importSuccess'));
  getDataByPage();
  target.value = '';
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <AppClientSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.appClient.title')"
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
            <AButton size="small" @click="openCategoryModal">{{ $t('page.manage.appClient.categoryManage') }}</AButton>
            <AButton size="small" @click="handleExport">{{ $t('page.manage.common.export') }}</AButton>
            <AButton size="small" @click="handleExportTemplate">{{ $t('page.manage.common.template') }}</AButton>
            <AButton size="small" @click="handleImportClick">{{ $t('page.manage.common.import') }}</AButton>
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

      <AppClientOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
      <AppCategoryManageModal v-model:visible="categoryModalVisible" />

      <input ref="fileInputRef" type="file" accept=".xlsx" class="hidden" @change="handleFileChange" />
    </ACard>
  </div>
</template>

<style scoped></style>
