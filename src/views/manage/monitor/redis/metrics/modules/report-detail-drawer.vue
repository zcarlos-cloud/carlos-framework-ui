<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { fetchGetBigkeyReportItems } from '@/service/api';
import { $t } from '@/locales';
import { formatBytes } from '../../../shared';

defineOptions({
  name: 'MonitorBigkeyReportDetailDrawer'
});

interface Props {
  /** 当前报告 */
  report?: Api.Monitor.BigkeyReport | null;
  /** 实例ID */
  instanceId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  report: null,
  instanceId: undefined
});

const visible = defineModel<boolean>('visible', { default: false });

const loading = ref(false);
const items = ref<Api.Monitor.BigkeyReportItem[]>([]);
const current = ref(1);
const size = ref(20);
const total = ref(0);

const columns = computed(() => [
  { key: 'index', dataIndex: 'index', title: $t('common.index'), width: 64 },
  { key: 'redisKey', dataIndex: 'redisKey', title: 'Key', ellipsis: true },
  { key: 'keyType', dataIndex: 'keyType', title: $t('page.manage.monitor.redisMetrics.itemType'), width: 90 },
  {
    key: 'memoryBytes',
    dataIndex: 'memoryBytes',
    title: $t('page.manage.monitor.redisMetrics.itemMemory'),
    width: 120,
    customRender: ({ record }: { record: Api.Monitor.BigkeyReportItem }) =>
      `${formatBytes(record.memoryBytes)}${record.estimated ? ' *' : ''}`
  },
  {
    key: 'elementCount',
    dataIndex: 'elementCount',
    title: $t('page.manage.monitor.redisMetrics.itemElements'),
    width: 110
  },
  { key: 'ttlSeconds', dataIndex: 'ttlSeconds', title: 'TTL(s)', width: 90 },
  {
    key: 'nodeAddress',
    dataIndex: 'nodeAddress',
    title: $t('page.manage.monitor.redisMetrics.node'),
    width: 160,
    ellipsis: true
  }
]);

async function loadItems() {
  if (!props.instanceId || !props.report) {
    items.value = [];
    return;
  }
  loading.value = true;
  try {
    const { data, error } = await fetchGetBigkeyReportItems(props.instanceId, props.report.id, {
      current: current.value,
      size: size.value
    });
    if (error || !data) {
      return;
    }
    items.value = data.records ?? [];
    total.value = Number(data.total ?? 0);
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number, pageSize: number) {
  current.value = page;
  size.value = pageSize;
  loadItems();
}

watch(visible, val => {
  if (val) {
    current.value = 1;
    loadItems();
  }
});
</script>

<template>
  <ADrawer v-model:open="visible" :title="$t('page.manage.monitor.redisMetrics.reportDetailTitle')" :width="860">
    <ADescriptions v-if="report" size="small" :column="3" class="mb-16px">
      <ADescriptionsItem label="ID">{{ report.id }}</ADescriptionsItem>
      <ADescriptionsItem :label="$t('page.manage.monitor.redisMetrics.reportType')">
        {{ report.reportType }}
      </ADescriptionsItem>
      <ADescriptionsItem :label="$t('page.manage.monitor.redisMetrics.scannedKeys')">
        {{ report.scannedKeys ?? '-' }}
      </ADescriptionsItem>
    </ADescriptions>
    <ATable
      :columns="columns"
      :data-source="items"
      size="small"
      :loading="loading"
      row-key="id"
      :scroll="{ x: 860 }"
      :pagination="{ current, pageSize: size, total, showSizeChanger: true, onChange: handlePageChange }"
    />
  </ADrawer>
</template>

<style scoped></style>
