<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { Button, Tag } from 'ant-design-vue';
import {
  fetchGetBigkeyReportPage,
  fetchGetRedisMetricCurrent,
  fetchGetRedisMetricHistory,
  fetchGetRedisNodes,
  fetchGetRedisSlowlogPage,
  fetchTriggerBigkeyScan
} from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import SvgIcon from '@/components/custom/svg-icon.vue';
import InstanceSelect from '../../modules/instance-select.vue';
import MetricRangeChart from '../../modules/metric-range-chart.vue';
import { formatBytes, metricValueOf } from '../../shared';
import ReportDetailDrawer from './modules/report-detail-drawer.vue';

defineOptions({
  name: 'MonitorRedisMetrics'
});

const { hasAuth } = useAuth();

const instanceId = ref<string>();
const instance = ref<Api.Monitor.Instance>();
const nodes = ref<Api.Monitor.RedisNode[]>([]);
const activeNode = ref<string>('');
const currentMetrics = ref<Record<string, string>>({});

const memoryUsed = computed(() =>
  metricValueOf(currentMetrics.value, 'redis.memory.used', activeNode.value || undefined)
);
const memoryPercent = computed(() =>
  metricValueOf(currentMetrics.value, 'redis.memory.used_percent', activeNode.value || undefined)
);
const opsPerSec = computed(() =>
  metricValueOf(currentMetrics.value, 'redis.stats.ops_per_sec', activeNode.value || undefined)
);
const hitRate = computed(() =>
  metricValueOf(currentMetrics.value, 'redis.stats.hit_rate', activeNode.value || undefined)
);
const connectedClients = computed(() =>
  metricValueOf(currentMetrics.value, 'redis.clients.connected', activeNode.value || undefined)
);
const keyCount = computed(() =>
  metricValueOf(currentMetrics.value, 'redis.keyspace.keys', activeNode.value || undefined)
);

const memoryChartRef = ref<InstanceType<typeof MetricRangeChart>>();
const opsChartRef = ref<InstanceType<typeof MetricRangeChart>>();
const hitRateChartRef = ref<InstanceType<typeof MetricRangeChart>>();

const chartRefs = computed(() => [memoryChartRef.value, opsChartRef.value, hitRateChartRef.value].filter(Boolean));

const percentFormatter = (value: number) => `${value.toFixed(1)} %`;

interface MetricDef {
  key: string;
  title: string;
  unit?: string;
  valueFormatter?: (value: number) => string;
  description: string;
}

const metricDefs = computed<MetricDef[]>(() => [
  {
    key: 'redis.memory.used',
    title: $t('page.manage.monitor.redisMetrics.memoryTrend'),
    valueFormatter: formatBytes,
    description: $t('page.manage.monitor.redisMetrics.descMemoryTrend')
  },
  {
    key: 'redis.stats.ops_per_sec',
    title: $t('page.manage.monitor.redisMetrics.opsTrend'),
    unit: 'ops/s',
    description: $t('page.manage.monitor.redisMetrics.descOpsTrend')
  },
  {
    key: 'redis.stats.hit_rate',
    title: $t('page.manage.monitor.redisMetrics.hitRateTrend'),
    valueFormatter: percentFormatter,
    description: $t('page.manage.monitor.redisMetrics.descHitRateTrend')
  }
]);

function historyLoader(metric: string) {
  return async (range: string) => {
    if (!instanceId.value) {
      return [];
    }
    const { data, error } = await fetchGetRedisMetricHistory(instanceId.value, {
      metric,
      range,
      node: activeNode.value || undefined
    });
    if (error || !data) {
      return [];
    }
    return [{ name: metric, points: data }];
  };
}

async function loadNodes() {
  if (!instanceId.value) {
    nodes.value = [];
    return;
  }
  const { data, error } = await fetchGetRedisNodes(instanceId.value);
  nodes.value = error || !data ? [] : data;
}

async function loadCurrent() {
  if (!instanceId.value) {
    currentMetrics.value = {};
    return;
  }
  const { data, error } = await fetchGetRedisMetricCurrent(instanceId.value);
  currentMetrics.value = error || !data ? {} : (data.metrics ?? {});
}

function handleInstanceChange(value?: string, item?: Api.Monitor.Instance) {
  instanceId.value = value;
  instance.value = item;
  activeNode.value = '';
  loadNodes();
  loadCurrent();
  loadSlowlogs(true);
  loadReports();
  chartRefs.value.forEach(chart => chart?.reload());
}

watch(activeNode, () => {
  loadCurrent();
  chartRefs.value.forEach(chart => chart?.reload());
});

// ==================== 慢日志（offset 翻页） ====================

const slowlogLoading = ref(false);
const slowlogs = ref<Api.Monitor.SlowlogRecord[]>([]);
const slowlogOffset = ref(0);
const slowlogSize = ref(20);
const slowlogHasMore = ref(false);
const slowlogHours = ref<number | undefined>(24);
const slowlogMinDurationMs = ref<number | undefined>();

const slowlogColumns = computed(() => [
  { key: 'ts', dataIndex: 'ts', title: $t('page.manage.monitor.redisMetrics.slowlogTime'), width: 180 },
  { key: 'node', dataIndex: 'node', title: $t('page.manage.monitor.redisMetrics.node'), width: 160 },
  {
    key: 'durationUs',
    dataIndex: 'durationUs',
    title: $t('page.manage.monitor.redisMetrics.slowlogDuration'),
    width: 120,
    customRender: ({ record }: { record: Api.Monitor.SlowlogRecord }) =>
      `${((record.durationUs ?? 0) / 1000).toFixed(1)} ms`
  },
  {
    key: 'command',
    dataIndex: 'command',
    title: $t('page.manage.monitor.redisMetrics.slowlogCommand'),
    ellipsis: true
  },
  { key: 'clientAddr', dataIndex: 'clientAddr', title: $t('page.manage.monitor.redisMetrics.clientAddr'), width: 140 }
]);

async function loadSlowlogs(reset = false) {
  if (!instanceId.value) {
    slowlogs.value = [];
    return;
  }
  if (reset) {
    slowlogOffset.value = 0;
  }
  slowlogLoading.value = true;
  try {
    const { data, error } = await fetchGetRedisSlowlogPage(instanceId.value, {
      hours: slowlogHours.value,
      minDurationUs: slowlogMinDurationMs.value ? slowlogMinDurationMs.value * 1000 : undefined,
      node: activeNode.value || undefined,
      offset: slowlogOffset.value,
      size: slowlogSize.value
    });
    if (error || !data) {
      return;
    }
    slowlogs.value = data.records ?? [];
    slowlogHasMore.value = Boolean(data.hasMore);
  } finally {
    slowlogLoading.value = false;
  }
}

function slowlogPrev() {
  slowlogOffset.value = Math.max(0, slowlogOffset.value - slowlogSize.value);
  loadSlowlogs();
}

function slowlogNext() {
  slowlogOffset.value += slowlogSize.value;
  loadSlowlogs();
}

// ==================== 大 key 报告 ====================

const reportLoading = ref(false);
const reports = ref<Api.Monitor.BigkeyReport[]>([]);
const reportCurrent = ref(1);
const reportSize = ref(10);
const reportTotal = ref(0);
const scanning = ref(false);
const detailVisible = ref(false);
const activeReport = ref<Api.Monitor.BigkeyReport | null>(null);

const reportColumns = computed(() => [
  { key: 'id', dataIndex: 'id', title: 'ID', width: 180, ellipsis: true },
  {
    key: 'reportType',
    dataIndex: 'reportType',
    title: $t('page.manage.monitor.redisMetrics.reportType'),
    width: 100,
    customRender: ({ record }: { record: Api.Monitor.BigkeyReport }) => <Tag>{record.reportType}</Tag>
  },
  {
    key: 'scanStatus',
    dataIndex: 'scanStatus',
    title: $t('page.manage.monitor.redisMetrics.scanStatus'),
    width: 110,
    customRender: ({ record }: { record: Api.Monitor.BigkeyReport }) => {
      const colorMap: Record<string, string> = { RUNNING: 'processing', SUCCESS: 'success', FAILED: 'error' };
      return <Tag color={colorMap[record.scanStatus ?? ''] ?? 'default'}>{record.scanStatus}</Tag>;
    }
  },
  {
    key: 'scannedKeys',
    dataIndex: 'scannedKeys',
    title: $t('page.manage.monitor.redisMetrics.scannedKeys'),
    width: 110
  },
  {
    key: 'startTime',
    dataIndex: 'startTime',
    title: $t('page.manage.monitor.redisMetrics.startTime'),
    width: 170,
    customRender: ({ record }: { record: Api.Monitor.BigkeyReport }) => formatDateTime(record.startTime)
  },
  {
    key: 'operate',
    title: $t('common.operate'),
    width: 100,
    customRender: ({ record }: { record: Api.Monitor.BigkeyReport }) => (
      <Button
        type="link"
        size="small"
        disabled={record.scanStatus !== 'SUCCESS'}
        onClick={() => openReportDetail(record)}
      >
        {$t('page.manage.monitor.redisMetrics.viewDetail')}
      </Button>
    )
  }
]);

async function loadReports() {
  if (!instanceId.value) {
    reports.value = [];
    return;
  }
  reportLoading.value = true;
  try {
    const { data, error } = await fetchGetBigkeyReportPage({
      instanceId: instanceId.value,
      current: reportCurrent.value,
      size: reportSize.value
    });
    if (error || !data) {
      return;
    }
    reports.value = data.records ?? [];
    reportTotal.value = Number(data.total ?? 0);
  } finally {
    reportLoading.value = false;
  }
}

function handleReportPageChange(page: number, pageSize: number) {
  reportCurrent.value = page;
  reportSize.value = pageSize;
  loadReports();
}

async function handleTriggerScan() {
  if (!instanceId.value) {
    return;
  }
  scanning.value = true;
  try {
    const { error } = await fetchTriggerBigkeyScan(instanceId.value);
    if (error) {
      window.$message?.error?.($t('page.manage.monitor.redisMetrics.scanFailed'));
      return;
    }
    window.$message?.success?.($t('page.manage.monitor.redisMetrics.scanTriggered'));
    loadReports();
  } finally {
    scanning.value = false;
  }
}

function openReportDetail(record: Api.Monitor.BigkeyReport) {
  activeReport.value = record;
  detailVisible.value = true;
}
</script>

<template>
  <div class="flex-col-stretch gap-16px overflow-auto">
    <ACard :bordered="false" class="card-wrapper">
      <div class="flex-y-center flex-wrap gap-16px">
        <span>{{ $t('page.manage.monitor.common.instance') }}</span>
        <InstanceSelect
          v-model="instanceId"
          :instance-type="['REDIS_STANDALONE', 'REDIS_CLUSTER', 'REDIS_SENTINEL']"
          class="w-320px"
          @change="handleInstanceChange"
        />
        <template v-if="nodes.length > 1">
          <span>{{ $t('page.manage.monitor.redisMetrics.node') }}</span>
          <ARadioGroup v-model:value="activeNode" size="small">
            <ARadioButton value="">{{ $t('page.manage.monitor.common.allNodes') }}</ARadioButton>
            <ARadioButton v-for="node in nodes" :key="node.address" :value="node.address">
              {{ node.address }}（{{ node.role }}）
            </ARadioButton>
          </ARadioGroup>
        </template>
      </div>
    </ACard>

    <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.monitor.redisMetrics.currentTitle')">
      <ARow :gutter="[16, 16]">
        <ACol :xs="12" :sm="8" :lg="4">
          <AStatistic :value="memoryUsed === null ? '-' : formatBytes(memoryUsed)">
            <template #title>
              <span class="flex-y-center gap-4px">
                {{ $t('page.manage.monitor.redisMetrics.memoryUsed') }}
                <ATooltip :title="$t('page.manage.monitor.redisMetrics.descMemoryUsed')">
                  <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
                </ATooltip>
              </span>
            </template>
          </AStatistic>
        </ACol>
        <ACol :xs="12" :sm="8" :lg="4">
          <AStatistic :value="memoryPercent === null ? '-' : `${memoryPercent.toFixed(1)} %`">
            <template #title>
              <span class="flex-y-center gap-4px">
                {{ $t('page.manage.monitor.redisMetrics.memoryPercent') }}
                <ATooltip :title="$t('page.manage.monitor.redisMetrics.descMemoryPercent')">
                  <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
                </ATooltip>
              </span>
            </template>
          </AStatistic>
        </ACol>
        <ACol :xs="12" :sm="8" :lg="4">
          <AStatistic :value="opsPerSec === null ? '-' : opsPerSec.toFixed(0)">
            <template #title>
              <span class="flex-y-center gap-4px">
                {{ $t('page.manage.monitor.redisMetrics.opsPerSec') }}
                <ATooltip :title="$t('page.manage.monitor.redisMetrics.descOpsPerSec')">
                  <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
                </ATooltip>
              </span>
            </template>
          </AStatistic>
        </ACol>
        <ACol :xs="12" :sm="8" :lg="4">
          <AStatistic :value="hitRate === null ? '-' : `${hitRate.toFixed(1)} %`">
            <template #title>
              <span class="flex-y-center gap-4px">
                {{ $t('page.manage.monitor.redisMetrics.hitRate') }}
                <ATooltip :title="$t('page.manage.monitor.redisMetrics.descHitRate')">
                  <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
                </ATooltip>
              </span>
            </template>
          </AStatistic>
        </ACol>
        <ACol :xs="12" :sm="8" :lg="4">
          <AStatistic :value="connectedClients === null ? '-' : connectedClients">
            <template #title>
              <span class="flex-y-center gap-4px">
                {{ $t('page.manage.monitor.redisMetrics.connectedClients') }}
                <ATooltip :title="$t('page.manage.monitor.redisMetrics.descConnectedClients')">
                  <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
                </ATooltip>
              </span>
            </template>
          </AStatistic>
        </ACol>
        <ACol :xs="12" :sm="8" :lg="4">
          <AStatistic :value="keyCount === null ? '-' : keyCount">
            <template #title>
              <span class="flex-y-center gap-4px">
                {{ $t('page.manage.monitor.redisMetrics.keyCount') }}
                <ATooltip :title="$t('page.manage.monitor.redisMetrics.descKeyCount')">
                  <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
                </ATooltip>
              </span>
            </template>
          </AStatistic>
        </ACol>
      </ARow>
    </ACard>

    <ARow :gutter="[16, 16]">
      <ACol :xs="24" :lg="8">
        <MetricRangeChart
          ref="memoryChartRef"
          :title="metricDefs[0].title"
          :load="historyLoader(metricDefs[0].key)"
          :unit="metricDefs[0].unit"
          :value-formatter="metricDefs[0].valueFormatter"
          :description="metricDefs[0].description"
        />
      </ACol>
      <ACol :xs="24" :lg="8">
        <MetricRangeChart
          ref="opsChartRef"
          :title="metricDefs[1].title"
          :load="historyLoader(metricDefs[1].key)"
          :unit="metricDefs[1].unit"
          :value-formatter="metricDefs[1].valueFormatter"
          :description="metricDefs[1].description"
        />
      </ACol>
      <ACol :xs="24" :lg="8">
        <MetricRangeChart
          ref="hitRateChartRef"
          :title="metricDefs[2].title"
          :load="historyLoader(metricDefs[2].key)"
          :unit="metricDefs[2].unit"
          :value-formatter="metricDefs[2].valueFormatter"
          :description="metricDefs[2].description"
        />
      </ACol>
    </ARow>

    <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.monitor.redisMetrics.slowlogTitle')">
      <template #extra>
        <div class="flex-y-center gap-12px">
          <AInputNumber
            v-model:value="slowlogHours"
            :min="1"
            :max="720"
            :placeholder="$t('page.manage.monitor.redisMetrics.form.hours')"
            class="w-120px"
          />
          <AInputNumber
            v-model:value="slowlogMinDurationMs"
            :min="0"
            :placeholder="$t('page.manage.monitor.redisMetrics.form.minDurationMs')"
            class="w-160px"
          />
          <AButton size="small" @click="loadSlowlogs(true)">{{ $t('common.search') }}</AButton>
        </div>
      </template>
      <ATable
        :columns="slowlogColumns"
        :data-source="slowlogs"
        size="small"
        :loading="slowlogLoading"
        row-key="slowlogId"
        :pagination="false"
        :scroll="{ x: 900 }"
      />
      <div class="mt-12px flex-y-center justify-end gap-12px">
        <AButton size="small" :disabled="slowlogOffset === 0 || slowlogLoading" @click="slowlogPrev">
          {{ $t('page.manage.monitor.common.prevPage') }}
        </AButton>
        <AButton size="small" :disabled="!slowlogHasMore || slowlogLoading" @click="slowlogNext">
          {{ $t('page.manage.monitor.common.nextPage') }}
        </AButton>
      </div>
    </ACard>

    <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.monitor.redisMetrics.reportTitle')">
      <template #extra>
        <AButton
          v-if="hasAuth('monitor:redis:analysis')"
          type="primary"
          size="small"
          :loading="scanning"
          :disabled="!instanceId"
          @click="handleTriggerScan"
        >
          {{ $t('page.manage.monitor.redisMetrics.triggerScan') }}
        </AButton>
      </template>
      <ATable
        :columns="reportColumns"
        :data-source="reports"
        size="small"
        :loading="reportLoading"
        row-key="id"
        :scroll="{ x: 900 }"
        :pagination="{
          current: reportCurrent,
          pageSize: reportSize,
          total: reportTotal,
          showSizeChanger: true,
          onChange: handleReportPageChange
        }"
      />
    </ACard>

    <ReportDetailDrawer v-model:visible="detailVisible" :report="activeReport" :instance-id="instanceId" />
  </div>
</template>

<style scoped></style>
