<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Tag } from 'ant-design-vue';
import { auditRiskLevelRecord, auditRiskLevelTagColor, getAuditRiskLevelKey } from '@/constants/business';
import { fetchGetAuditLogDetail } from '@/service/api';
import { formatDateTime, formatJson } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'AuditLogDetailDrawer'
});

ensureEnumDict('audit');

interface Props {
  /** 待查看的日志主键 */
  id: string;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const loading = ref(false);

const detail = ref<Api.Audit.LogRecord | null>(null);

/** 空值统一显示为短横线，避免 Descriptions 出现空白格 */
const EMPTY_TEXT = '-';

function text(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') {
    return EMPTY_TEXT;
  }

  return String(value);
}

interface DetailItem {
  label: string;
  value: string;
}

interface DetailGroup {
  key: string;
  title: string;
  items: DetailItem[];
}

const groups = computed<DetailGroup[]>(() => {
  const record = detail.value;

  if (!record) {
    return [];
  }

  return [
    {
      key: 'basic',
      title: $t('page.audit.log.group.basic'),
      items: [
        { label: $t('page.audit.log.id'), value: text(record.id) },
        { label: $t('page.audit.log.serverTime'), value: text(formatDateTime(record.serverTime)) },
        { label: $t('page.audit.log.eventDate'), value: text(record.eventDate) },
        { label: $t('page.audit.log.clientTime'), value: text(formatDateTime(record.clientTime)) },
        { label: $t('page.audit.log.eventTime'), value: text(formatDateTime(record.eventTime)) },
        { label: $t('page.audit.log.durationMs'), value: text(record.durationMs) },
        { label: $t('page.audit.log.category'), value: enumDictText('audit', 'AuditLogCategory', record.category) },
        { label: $t('page.audit.log.logType'), value: text(record.logType) },
        { label: $t('page.audit.log.riskLevel'), value: text(record.riskLevel) },
        { label: $t('page.audit.log.logStatus'), value: enumDictText('audit', 'AuditLogState', record.logStatus) },
        { label: $t('page.audit.log.operation'), value: text(record.operation) },
        { label: $t('page.audit.log.resultCode'), value: text(record.resultCode) },
        { label: $t('page.audit.log.resultMessage'), value: text(record.resultMessage) }
      ]
    },
    {
      key: 'principal',
      title: $t('page.audit.log.group.principal'),
      items: [
        { label: $t('page.audit.log.principalId'), value: text(record.principalId) },
        { label: $t('page.audit.log.principalName'), value: text(record.principalName) },
        {
          label: $t('page.audit.log.principalType'),
          value: enumDictText('audit', 'AuditLogPrincipalType', record.principalType)
        },
        { label: $t('page.audit.log.tenantId'), value: text(record.tenantId) },
        { label: $t('page.audit.log.deptId'), value: text(record.deptId) },
        { label: $t('page.audit.log.deptName'), value: text(record.deptName) },
        { label: $t('page.audit.log.deptPath'), value: text(record.deptPath) }
      ]
    },
    {
      key: 'target',
      title: $t('page.audit.log.group.target'),
      items: [
        { label: $t('page.audit.log.targetType'), value: text(record.targetType) },
        { label: $t('page.audit.log.targetId'), value: text(record.targetId) },
        { label: $t('page.audit.log.targetName'), value: text(record.targetName) }
      ]
    },
    {
      key: 'client',
      title: $t('page.audit.log.group.client'),
      items: [
        { label: $t('page.audit.log.clientIp'), value: text(record.clientIp) },
        { label: $t('page.audit.log.clientPort'), value: text(record.clientPort) },
        { label: $t('page.audit.log.serverIp'), value: text(record.serverIp) },
        { label: $t('page.audit.log.userAgent'), value: text(record.userAgent) },
        { label: $t('page.audit.log.deviceFingerprint'), value: text(record.deviceFingerprint) },
        { label: $t('page.audit.log.location'), value: text(locationText(record)) },
        { label: $t('page.audit.log.authType'), value: enumDictText('audit', 'AuditLogAuthType', record.authType) },
        {
          label: $t('page.audit.log.authProvider'),
          value: enumDictText('audit', 'AuditLogAuthProvider', record.authProvider)
        },
        {
          label: $t('page.audit.log.bizChannel'),
          value: enumDictText('audit', 'AuditLogBizChannel', record.bizChannel)
        },
        { label: $t('page.audit.log.bizScene'), value: text(record.bizScene) }
      ]
    },
    {
      key: 'dataChange',
      title: $t('page.audit.log.group.dataChange'),
      items: [
        { label: $t('page.audit.log.hasDataChange'), value: text(record.hasDataChange) },
        { label: $t('page.audit.log.entityClass'), value: text(record.entityClass) },
        { label: $t('page.audit.log.tableName'), value: text(record.tableName) },
        { label: $t('page.audit.log.changeSummary'), value: text(record.changeSummary) },
        { label: $t('page.audit.log.changedFieldCount'), value: text(record.changedFieldCount) }
      ]
    },
    {
      key: 'tech',
      title: $t('page.audit.log.group.tech'),
      items: [
        { label: $t('page.audit.log.traceId'), value: text(record.traceId) },
        { label: $t('page.audit.log.spanId'), value: text(record.spanId) },
        { label: $t('page.audit.log.parentSpanId'), value: text(record.parentSpanId) },
        { label: $t('page.audit.log.dbQueryCount'), value: text(record.dbQueryCount) },
        { label: $t('page.audit.log.dbQueryTimeMs'), value: text(record.dbQueryTimeMs) },
        { label: $t('page.audit.log.externalCallCount'), value: text(record.externalCallCount) },
        { label: $t('page.audit.log.externalCallTimeMs'), value: text(record.externalCallTimeMs) },
        { label: $t('page.audit.log.appName'), value: text(record.appName) },
        { label: $t('page.audit.log.appVersion'), value: text(record.appVersion) },
        { label: $t('page.audit.log.cluster'), value: text(record.cluster) },
        { label: $t('page.audit.log.hostName'), value: text(record.hostName) }
      ]
    },
    {
      key: 'business',
      title: $t('page.audit.log.group.business'),
      items: [
        { label: $t('page.audit.log.bizOrderNo'), value: text(record.bizOrderNo) },
        { label: $t('page.audit.log.monetaryAmount'), value: text(record.monetaryAmount) },
        { label: $t('page.audit.log.processId'), value: text(record.processId) },
        { label: $t('page.audit.log.batchId'), value: text(record.batchId) },
        { label: $t('page.audit.log.batchIndex'), value: text(record.batchIndex) },
        { label: $t('page.audit.log.batchTotal'), value: text(record.batchTotal) },
        { label: $t('page.audit.log.taskId'), value: text(record.taskId) },
        { label: $t('page.audit.log.approverId'), value: text(record.approverId) },
        { label: $t('page.audit.log.approvalComment'), value: text(record.approvalComment) },
        { label: $t('page.audit.log.attachmentCount'), value: text(record.attachmentCount) }
      ]
    }
  ];
});

/**
 * 宽表中的 JSON 文本字段
 *
 * 项目内没有引入 Monaco / JSON 查看器，直接以 <pre> 渲染格式化后的文本，避免新增依赖。
 */
const jsonBlocks = computed(() => {
  const record = detail.value;

  if (!record) {
    return [];
  }

  return [
    { key: 'targetSnapshot', label: $t('page.audit.log.targetSnapshot'), content: record.targetSnapshot },
    { key: 'oldData', label: $t('page.audit.log.oldData'), content: record.oldData },
    { key: 'newData', label: $t('page.audit.log.newData'), content: record.newData },
    { key: 'customMetrics', label: $t('page.audit.log.customMetrics'), content: record.customMetrics },
    { key: 'dynamicTags', label: $t('page.audit.log.dynamicTags'), content: record.dynamicTags },
    { key: 'dynamicExtras', label: $t('page.audit.log.dynamicExtras'), content: record.dynamicExtras },
    { key: 'relatedBizIds', label: $t('page.audit.log.relatedBizIds'), content: record.relatedBizIds },
    { key: 'roles', label: $t('page.audit.log.roles'), content: record.roles },
    { key: 'permissions', label: $t('page.audit.log.permissions'), content: record.permissions }
  ].filter(block => Boolean(block.content));
});

/** 国家 / 省份 / 城市 拼接展示 */
function locationText(record: Api.Audit.LogRecord) {
  return [record.locationCountry, record.locationProvince, record.locationCity].filter(Boolean).join(' / ');
}

const riskLevelKey = computed(() => getAuditRiskLevelKey(detail.value?.riskLevel));

async function loadDetail() {
  if (!props.id) {
    return;
  }

  loading.value = true;
  try {
    const { data, error } = await fetchGetAuditLogDetail(props.id);

    if (error) {
      return;
    }

    detail.value = data ?? null;
  } finally {
    loading.value = false;
  }
}

watch(visible, () => {
  if (visible.value) {
    detail.value = null;
    loadDetail();
  }
});
</script>

<template>
  <!-- 详情含 7 组共 60+ 字段，360 的默认抽屉宽度不足以容纳 Descriptions，故放宽到 720 -->
  <ADrawer v-model:open="visible" :title="$t('page.audit.log.detailTitle')" :width="720">
    <ASpin :spinning="loading">
      <div v-if="detail" class="flex flex-col gap-16px">
        <div class="flex-y-center gap-8px">
          <Tag :color="auditRiskLevelTagColor[riskLevelKey]">
            {{ $t(auditRiskLevelRecord[riskLevelKey]) }}
          </Tag>
          <Tag v-if="detail.logStatus" :color="enumDictColor('audit', 'AuditLogState', detail.logStatus)">
            {{ enumDictText('audit', 'AuditLogState', detail.logStatus) }}
          </Tag>
        </div>
        <ADescriptions v-for="group in groups" :key="group.key" :title="group.title" :column="2" size="small" bordered>
          <ADescriptionsItem v-for="item in group.items" :key="item.label" :label="item.label">
            {{ item.value }}
          </ADescriptionsItem>
        </ADescriptions>
        <template v-if="jsonBlocks.length">
          <div v-for="block in jsonBlocks" :key="block.key" class="flex flex-col gap-4px">
            <span class="font-medium">{{ block.label }}</span>
            <pre class="m-0 max-h-320px overflow-auto rounded bg-#f5f5f5 p-12px text-12px">{{
              formatJson(block.content)
            }}</pre>
          </div>
        </template>
      </div>
    </ASpin>
  </ADrawer>
</template>

<style scoped></style>
