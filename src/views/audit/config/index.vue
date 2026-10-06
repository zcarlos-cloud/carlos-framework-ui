<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchDeleteAuditConfig, fetchGetAuditConfigList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import AuditConfigOperateDrawer from './modules/audit-config-operate-drawer.vue';
import AuditConfigSearch from './modules/audit-config-search.vue';

/**
 * 10 列：定宽列之和 1064，弹性列 logType 留 200 的下限，故取 1400。
 */
const TABLE_SCROLL_X = 1400;

const { tableWrapperRef, scrollConfig } = useTableScroll(TABLE_SCROLL_X);

/**
 * 开关类字段的渲染
 *
 * 三个布尔列原先渲染的是裸文本「是/否」，有两个问题：
 * 1. 与同页其它状态列的 Tag 风格不一致，扫读时抓不住；
 * 2. **没有缺失守卫** —— 字段缺失时 `record.asyncWrite` 是 `undefined`、走 `?:` 的 false 分支，
 *    于是一张配置表会主动告诉运维「异步写入=否」。对配置表来说这是主动误导，不只是难看。
 */
function renderBooleanTag(value?: boolean | null) {
  if (value === null || value === undefined) {
    return null;
  }

  return <Tag color={value ? 'success' : 'default'}>{$t(value ? 'common.yesOrNo.yes' : 'common.yesOrNo.no')}</Tag>;
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
  apiFn: fetchGetAuditConfigList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    logType: undefined,
    tenantId: undefined
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
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'logType',
      dataIndex: 'logType',
      title: $t('page.audit.config.logType'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'retentionDays',
      dataIndex: 'retentionDays',
      title: $t('page.audit.config.retentionDays'),
      align: 'center',
      width: 110
    },
    {
      key: 'samplingRate',
      dataIndex: 'samplingRate',
      title: $t('page.audit.config.samplingRate'),
      align: 'center',
      width: 110
    },
    {
      key: 'asyncWrite',
      dataIndex: 'asyncWrite',
      title: $t('page.audit.config.asyncWrite'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => renderBooleanTag(record.asyncWrite)
    },
    {
      key: 'storeDataChange',
      dataIndex: 'storeDataChange',
      title: $t('page.audit.config.storeDataChange'),
      align: 'center',
      width: 130,
      customRender: ({ record }) => renderBooleanTag(record.storeDataChange)
    },
    {
      key: 'storeTechnical',
      dataIndex: 'storeTechnical',
      title: $t('page.audit.config.storeTechnical'),
      align: 'center',
      width: 140,
      customRender: ({ record }) => renderBooleanTag(record.storeTechnical)
    },
    {
      key: 'tenantId',
      dataIndex: 'tenantId',
      title: $t('page.audit.config.tenantId'),
      align: 'center',
      width: 100
    },
    {
      key: 'createTime',
      dataIndex: 'createTime',
      title: $t('page.audit.config.createTime'),
      align: 'center',
      width: 170,
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
  const ids = checkedRowKeys.value;

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteAuditConfig(ids);

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
    const { error } = await fetchDeleteAuditConfig([id]);

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
    <AuditConfigSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.audit.config.title')"
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
      <AuditConfigOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
