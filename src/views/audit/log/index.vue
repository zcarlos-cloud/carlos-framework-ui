<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Tag } from 'ant-design-vue';
import { auditRiskLevelRecord, auditRiskLevelTagColor, getAuditRiskLevelKey } from '@/constants/business';
import { fetchExportAuditLog, fetchGetAuditLogList } from '@/service/api';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import AuditLogDetailDrawer from './modules/audit-log-detail-drawer.vue';
import AuditLogSearch from './modules/audit-log-search.vue';
import AuditLogStats from './modules/audit-log-stats.vue';

ensureEnumDict('audit');

/**
 * 12 个数据列 + 操作列，定宽列之和 1484，弹性列（operation）留 200 的下限，故取 1700。
 * 不显式给值时用的是默认 702，列一多就全部挤在一起。
 */
const TABLE_SCROLL_X = 1700;

/** 当前激活的标签页：列表 / 统计概览。搜索表单始终置顶，统计不再阻挡列表 */
const activeTab = ref<'list' | 'stats'>('list');

const { tableWrapperRef, scrollConfig } = useTableScroll(TABLE_SCROLL_X);

/** 详情抽屉状态。函数声明会被提升，因此可在下方 columns 中直接引用 openDetail */
const detailVisible = ref(false);
const detailId = ref('');

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
  apiFn: fetchGetAuditLogList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    category: undefined,
    logType: undefined,
    logStatus: undefined,
    principalId: undefined,
    principalName: undefined,
    principalType: undefined,
    targetId: undefined,
    targetType: undefined,
    riskLevelMin: undefined,
    riskLevelMax: undefined,
    bizChannel: undefined,
    clientIp: undefined,
    resultCode: undefined,
    startTime: undefined,
    endTime: undefined
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
      key: 'serverTime',
      dataIndex: 'serverTime',
      title: $t('page.audit.log.serverTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => formatDateTime(record.serverTime)
    },
    {
      key: 'category',
      dataIndex: 'category',
      title: $t('page.audit.log.category'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('audit', 'AuditLogCategory', record.category)}>
          {enumDictText('audit', 'AuditLogCategory', record.category)}
        </Tag>
      )
    },
    {
      key: 'logType',
      dataIndex: 'logType',
      title: $t('page.audit.log.logType'),
      align: 'center',
      width: 150,
      ellipsis: true
    },
    {
      key: 'riskLevel',
      dataIndex: 'riskLevel',
      title: $t('page.audit.log.riskLevel'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => {
        const { riskLevel } = record;

        if (riskLevel === null || riskLevel === undefined) {
          return null;
        }

        const levelKey = getAuditRiskLevelKey(riskLevel);

        return (
          <Tag color={auditRiskLevelTagColor[levelKey]}>
            {riskLevel} {$t(auditRiskLevelRecord[levelKey])}
          </Tag>
        );
      }
    },
    {
      key: 'logStatus',
      dataIndex: 'logStatus',
      title: $t('page.audit.log.logStatus'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('audit', 'AuditLogState', record.logStatus)}>
          {enumDictText('audit', 'AuditLogState', record.logStatus)}
        </Tag>
      )
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'operation',
      dataIndex: 'operation',
      title: $t('page.audit.log.operation'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'principalName',
      dataIndex: 'principalName',
      title: $t('page.audit.log.principal'),
      align: 'center',
      width: 150,
      ellipsis: true,
      customRender: ({ record }) => record.principalName || record.principalId || ''
    },
    {
      key: 'targetId',
      dataIndex: 'targetId',
      title: $t('page.audit.log.target'),
      align: 'center',
      width: 180,
      ellipsis: true,
      customRender: ({ record }) => {
        const { targetType, targetId, targetName } = record;

        return [targetType, targetName || targetId].filter(Boolean).join(' / ');
      }
    },
    {
      key: 'clientIp',
      dataIndex: 'clientIp',
      title: $t('page.audit.log.clientIp'),
      align: 'center',
      width: 140
    },
    {
      key: 'bizChannel',
      dataIndex: 'bizChannel',
      title: $t('page.audit.log.bizChannel'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => enumDictText('audit', 'AuditLogBizChannel', record.bizChannel)
    },
    {
      key: 'durationMs',
      dataIndex: 'durationMs',
      title: $t('page.audit.log.durationMs'),
      align: 'center',
      width: 100
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => openDetail(record.id)}>
            {$t('page.audit.log.detail')}
          </Button>
        </div>
      )
    }
  ]
});

const exporting = ref(false);

async function handleExport() {
  exporting.value = true;
  try {
    const { data: blob, error } = await fetchExportAuditLog(searchParams);

    if (error) {
      window.$message?.error?.($t('page.manage.common.exportFailed'));
      return;
    }

    if (blob) {
      const url = window.URL.createObjectURL(blob as unknown as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_log_${new Date().getTime()}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    }
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-auto">
    <AuditLogSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard :bordered="false" class="card-wrapper">
      <ATabs v-model:active-key="activeTab">
        <ATabPane key="list" :tab="$t('page.audit.log.title')">
          <div class="mb-12px flex justify-end">
            <!--
              审计日志为只读数据：用 props 隐藏「新增 / 批量删除」
              （原先用 `<template #default />` 覆盖插槽并不生效——空模板会被 Vue 编译器丢弃，
              插槽未注册，组件内的兜底按钮照常渲染）
            -->
            <TableHeaderOperation
              v-model:columns="columnChecks"
              :loading="loading"
              :show-add="false"
              :show-delete="false"
              @refresh="getData"
            >
              <template #suffix>
                <AButton size="small" :loading="exporting" @click="handleExport">
                  <template #icon>
                    <icon-mdi-download class="align-sub text-icon" />
                  </template>
                  <span class="ml-8px">{{ $t('page.manage.common.export') }}</span>
                </AButton>
              </template>
            </TableHeaderOperation>
          </div>
          <ATable
            ref="tableWrapperRef"
            :columns="columns"
            :data-source="data"
            size="small"
            :scroll="scrollConfig"
            :loading="loading"
            row-key="id"
            :pagination="mobilePagination"
          />
        </ATabPane>
        <ATabPane key="stats" :tab="$t('page.audit.log.statTitle')">
          <AuditLogStats />
        </ATabPane>
      </ATabs>
      <AuditLogDetailDrawer :id="detailId" v-model:visible="detailVisible" />
    </ACard>
  </div>
</template>

<style scoped></style>
