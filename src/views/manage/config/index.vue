<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { configValueTypeRecord, configValueTypeTagColor } from '@/constants/business';
import {
  fetchDeleteConfig,
  fetchExportConfig,
  fetchExportConfigTemplate,
  fetchGetConfigList,
  fetchImportConfig
} from '@/service/api';
import { useExport } from '@/hooks/business/use-export';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { enumText } from '@/utils/common';
import { $t } from '@/locales';
import ConfigOperateDrawer from './modules/config-operate-drawer.vue';
import ConfigSearch from './modules/config-search.vue';

/**
 * 列宽：定宽列合计 64+150+180+100+100+130 = 724，configValue / remark 两列吃剩余宽度。
 * 默认 702 装不下，给到 1100 让这两列各剩约 188px。
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
  apiFn: fetchGetConfigList,
  apiParams: {
    current: 1,
    size: 10,
    // 后端 SysConfigPageParam：configName / configCode / valueType / configStatus
    configName: undefined,
    configCode: undefined,
    valueType: undefined,
    configStatus: undefined
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
      key: 'configName',
      dataIndex: 'configName',
      title: $t('page.manage.config.configName'),
      align: 'center',
      width: 150,
      ellipsis: true
    },
    {
      key: 'configCode',
      dataIndex: 'configCode',
      title: $t('page.manage.config.configCode'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'configValue',
      dataIndex: 'configValue',
      title: $t('page.manage.config.configValue'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'valueType',
      dataIndex: 'valueType',
      title: $t('page.manage.config.valueType'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={configValueTypeTagColor[record.valueType]}>{enumText(configValueTypeRecord, record.valueType)}</Tag>
      )
    },
    {
      key: 'configStatus',
      dataIndex: 'configStatus',
      title: $t('page.manage.config.configStatus'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => {
        const { configStatus } = record;

        if (configStatus === null || configStatus === undefined) {
          return null;
        }

        const labelKey = configStatus ? 'page.manage.common.status.enable' : 'page.manage.common.status.disable';

        return <Tag color={configStatus ? 'success' : 'default'}>{$t(labelKey)}</Tag>;
      }
    },
    {
      // 不写宽度：与 configValue 一起分剩余宽度
      key: 'remark',
      dataIndex: 'remark',
      title: $t('page.manage.config.remark'),
      align: 'center',
      ellipsis: true
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
    const { error } = await fetchDeleteConfig(ids);

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
    const { error } = await fetchDeleteConfig([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    deleting.value = false;
  }
}

const { exporting, exportFile } = useExport();

/**
 * 导出**当前筛选结果**
 *
 * 之前这里是不传参的 `fetchExportConfig()`，加上后端也只按整表导出，
 * 于是「先筛选再导出」是个空动作。现在两边都通了：service 层剥掉 current/size
 * 并把 configStatus/valueType 转成后端要的形式，后端按同一套条件过滤。
 */
function handleExport() {
  return exportFile(() => fetchExportConfig(searchParams), 'sys_config');
}

function handleExportTemplate() {
  return exportFile(() => fetchExportConfigTemplate(), 'sys_config_template');
}

const importVisible = ref(false);

function handleImportClick() {
  importVisible.value = true;
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <ConfigSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.config.title')"
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
            <AButton size="small" :loading="exporting" @click="handleExport">
              {{ $t('page.manage.common.export') }}
            </AButton>
            <AButton size="small" :loading="exporting" @click="handleExportTemplate">
              {{ $t('page.manage.common.template') }}
            </AButton>
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

      <ConfigOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />

      <!-- 导入改为公共抽屉：模板下载 + 扩展名校验 + 加载态（原先是一个裸 input，可连点重复提交） -->
      <ImportDrawer
        v-model:visible="importVisible"
        :title="$t('page.manage.common.import')"
        :template-fn="fetchExportConfigTemplate"
        :import-fn="fetchImportConfig"
        template-name="sys_config_template"
        @imported="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
