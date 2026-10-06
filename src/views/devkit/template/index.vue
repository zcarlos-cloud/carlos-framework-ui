<script setup lang="tsx">
import { type Ref, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import {
  fetchDeleteDevkitTemplateGroup,
  fetchExportDevkitTemplateGroup,
  fetchGetDevkitTemplateGroupList,
  fetchToggleDevkitTemplateGroupStatus
} from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { enumDictColor, enumDictText } from '@/utils/enum-dict';
import { downloadBlob, formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import DevkitTemplateGroupCopyModal from './modules/template-group-copy-modal.vue';
import DevkitTemplateGroupOperateDrawer from './modules/template-group-operate-drawer.vue';
import DevkitTemplateGroupSearch from './modules/template-group-search.vue';

const TABLE_SCROLL_X = 1400;

const router = useRouter();

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
  apiFn: fetchGetDevkitTemplateGroupList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    groupName: undefined,
    groupCode: undefined,
    templateType: undefined,
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
      key: 'groupCode',
      dataIndex: 'groupCode',
      title: $t('page.devkit.template.groupCode'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      // 不写宽度：吃掉剩余宽度
      key: 'groupName',
      dataIndex: 'groupName',
      title: $t('page.devkit.template.groupName'),
      align: 'center',
      ellipsis: true,
      customRender: ({ record }) => (
        <div class="flex-center gap-6px">
          <span>{record.groupName}</span>
          {record.builtIn ? <Tag color="blue">{$t('page.devkit.template.builtIn')}</Tag> : null}
        </div>
      )
    },
    {
      key: 'templateType',
      dataIndex: 'templateType',
      title: $t('page.devkit.template.templateType'),
      align: 'center',
      width: 120,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('devkit', 'DevkitTemplateType', record.templateType)}>
          {enumDictText('devkit', 'DevkitTemplateType', record.templateType)}
        </Tag>
      )
    },
    {
      key: 'fileCount',
      dataIndex: 'fileCount',
      title: $t('page.devkit.template.fileCount'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => record.fileCount ?? 0
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: $t('page.devkit.template.status'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('devkit', 'DevkitStatus', record.status)}>
          {enumDictText('devkit', 'DevkitStatus', record.status)}
        </Tag>
      )
    },
    {
      key: 'updateTime',
      dataIndex: 'updateTime',
      title: $t('page.devkit.common.updateTime'),
      align: 'center',
      width: 180,
      customRender: ({ record }) => formatDateTime(record.updateTime ?? record.createTime)
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 340,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" size="small" onClick={() => openEditor(record.id)}>
            {$t('page.devkit.template.editFiles')}
          </Button>
          <Button size="small" onClick={() => handleExport(record.id)}>
            {$t('page.devkit.template.export')}
          </Button>
          <Button size="small" onClick={() => openCopy(record.id)}>
            {$t('page.devkit.common.copy')}
          </Button>
          <Button size="small" onClick={() => handleToggleStatus(record)}>
            {record.status === 1 ? $t('page.devkit.common.disabled') : $t('page.devkit.common.enabled')}
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
  // devkit 的 status 是数字码（0/1），与框架 TableData 的 EnableStatus（'1'/'2'）不兼容，
  // 故在调用处断言 —— 与 manage/menu、org/department 的既有做法一致
} = useTableOperate(data as unknown as Ref<AntDesign.TableData[]>, getData);

/** 编辑行数据（从断言后的 TableData 取回真实类型） */
const editingRow = computed(() => (editingData.value as unknown as Api.Devkit.TemplateGroup | null) ?? null);

const deleting = ref(false);
const copyVisible = ref(false);
const copyRow = ref<Api.Devkit.TemplateGroup | null>(null);

function openEditor(groupId: string) {
  router.push({ path: '/devkit/template-editor', query: { groupId } });
}

function openCopy(id: string) {
  copyRow.value = data.value.find(item => item.id === id) ?? null;
  copyVisible.value = true;
}

async function handleExport(groupId: string) {
  const { error, data: blob } = await fetchExportDevkitTemplateGroup(groupId);

  if (error || !blob) {
    window.$message?.error?.($t('page.devkit.template.exportFailed'));
    return;
  }

  downloadBlob(blob as Blob, `template-${groupId}.zip`);
}

async function handleToggleStatus(record: Api.Devkit.TemplateGroup) {
  const next: Api.Devkit.Status = record.status === 1 ? 0 : 1;
  const { error } = await fetchToggleDevkitTemplateGroupStatus(record.id, next);

  if (error) {
    window.$message?.error?.($t('common.updateFailed'));
    return;
  }

  window.$message?.success?.($t('common.updateSuccess'));
  await getData();
}

async function handleBatchDelete() {
  if (checkedRowKeys.value.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteDevkitTemplateGroup(checkedRowKeys.value);

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
    const { error } = await fetchDeleteDevkitTemplateGroup([id]);

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
    <DevkitTemplateGroupSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.devkit.template.title')"
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
      <DevkitTemplateGroupOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingRow"
        @submitted="getDataByPage"
      />
      <DevkitTemplateGroupCopyModal v-model:visible="copyVisible" :row-data="copyRow" @submitted="getData" />
    </ACard>
  </div>
</template>

<style scoped></style>
