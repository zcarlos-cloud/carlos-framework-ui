<script setup lang="tsx">
import { computed, ref } from 'vue';
import { Button, Tag } from 'ant-design-vue';
import {
  fetchGetDbCapacity,
  fetchGetDbLocks,
  fetchGetDbMetricCurrent,
  fetchGetDbMetricHistory,
  fetchGetDbSessions,
  fetchGetSlowSqlPage,
  fetchKillDbSession,
  issueConfirmToken
} from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { type ECOption, useEcharts } from '@/hooks/common/echarts';
import { $t } from '@/locales';
import SvgIcon from '@/components/custom/svg-icon.vue';
import ConfirmDangerModal from '../../modules/confirm-danger-modal.vue';
import InstanceSelect from '../../modules/instance-select.vue';
import MetricRangeChart from '../../modules/metric-range-chart.vue';
import { formatBytes, metricValueOf } from '../../shared';

defineOptions({
  name: 'MonitorDbMetrics'
});

const { hasAuth } = useAuth();

const DB_TYPES: Api.Monitor.InstanceType[] = ['POSTGRESQL', 'MYSQL', 'DM', 'CLICKHOUSE'];

const instanceId = ref<string>();
const instance = ref<Api.Monitor.Instance>();
const currentMetrics = ref<Record<string, string>>({});

const poolActive = computed(() => metricValueOf(currentMetrics.value, 'db.pool.active_count'));
const poolMax = computed(() => metricValueOf(currentMetrics.value, 'db.pool.max_active'));
const poolWait = computed(() => metricValueOf(currentMetrics.value, 'db.pool.wait_thread_count'));
const threadsRunning = computed(() => metricValueOf(currentMetrics.value, 'db.threads.running'));
const questions = computed(() => metricValueOf(currentMetrics.value, 'db.questions'));
const slowQueries = computed(() => metricValueOf(currentMetrics.value, 'db.slow_queries'));

const poolUsagePercent = computed(() => {
  if (poolActive.value === null || poolMax.value === null || poolMax.value === 0) {
    return null;
  }
  return (poolActive.value / poolMax.value) * 100;
});

const poolChartRef = ref<InstanceType<typeof MetricRangeChart>>();
const qpsChartRef = ref<InstanceType<typeof MetricRangeChart>>();

function historyLoader(metric: string) {
  return async (range: string) => {
    if (!instanceId.value) {
      return [];
    }
    const { data, error } = await fetchGetDbMetricHistory(instanceId.value, { metric, range });
    if (error || !data) {
      return [];
    }
    return [{ name: metric, points: data }];
  };
}

async function loadCurrent() {
  if (!instanceId.value) {
    currentMetrics.value = {};
    return;
  }
  const { data, error } = await fetchGetDbMetricCurrent(instanceId.value);
  currentMetrics.value = error || !data ? {} : (data.metrics ?? {});
}

function handleInstanceChange(value?: string, item?: Api.Monitor.Instance) {
  instanceId.value = value;
  instance.value = item;
  loadCurrent();
  loadSlowSql(true);
  loadSessions();
  loadLocks();
  loadCapacity();
  poolChartRef.value?.reload();
  qpsChartRef.value?.reload();
}

// ==================== 慢 SQL（聚合 + 展开明细） ====================

const slowSqlLoading = ref(false);
const slowSqlRecords = ref<Api.Monitor.SlowSqlRecord[]>([]);
const slowSqlOffset = ref(0);
const slowSqlSize = ref(20);
const slowSqlHasMore = ref(false);
const slowSqlHours = ref<number | undefined>(24);
const detailRows = ref<Api.Monitor.SlowSqlRecord[]>([]);
const detailLoading = ref(false);

const slowSqlColumns = computed(() => [
  { key: 'sampleSql', dataIndex: 'sampleSql', title: $t('page.manage.monitor.dbMetrics.sampleSql'), ellipsis: true },
  { key: 'dbName', dataIndex: 'dbName', title: $t('page.manage.monitor.dbMetrics.dbName'), width: 140 },
  { key: 'execCount', dataIndex: 'execCount', title: $t('page.manage.monitor.dbMetrics.execCount'), width: 100 },
  {
    key: 'avgMs',
    dataIndex: 'avgMs',
    title: $t('page.manage.monitor.dbMetrics.avgMs'),
    width: 110,
    customRender: ({ record }: { record: Api.Monitor.SlowSqlRecord }) =>
      record.avgMs === undefined ? '-' : `${record.avgMs.toFixed(1)} ms`
  },
  {
    key: 'maxMs',
    dataIndex: 'maxMs',
    title: $t('page.manage.monitor.dbMetrics.maxMs'),
    width: 110,
    customRender: ({ record }: { record: Api.Monitor.SlowSqlRecord }) =>
      record.maxMs === undefined ? '-' : `${record.maxMs.toFixed(1)} ms`
  },
  {
    key: 'lastExecTime',
    dataIndex: 'lastExecTime',
    title: $t('page.manage.monitor.dbMetrics.lastExecTime'),
    width: 170,
    customRender: ({ record }: { record: Api.Monitor.SlowSqlRecord }) => record.lastExecTime || '-'
  }
]);

const slowSqlDetailColumns = computed(() => [
  { key: 'sampleSql', dataIndex: 'sampleSql', title: $t('page.manage.monitor.dbMetrics.sampleSql'), ellipsis: true },
  { key: 'dbName', dataIndex: 'dbName', title: $t('page.manage.monitor.dbMetrics.dbName'), width: 140 },
  {
    key: 'collectTime',
    dataIndex: 'collectTime',
    title: $t('page.manage.monitor.dbMetrics.collectTime'),
    width: 170,
    customRender: ({ record }: { record: Api.Monitor.SlowSqlRecord }) => record.collectTime || '-'
  }
]);

async function loadSlowSql(reset = false) {
  if (!instanceId.value) {
    slowSqlRecords.value = [];
    return;
  }
  if (reset) {
    slowSqlOffset.value = 0;
  }
  slowSqlLoading.value = true;
  try {
    const { data, error } = await fetchGetSlowSqlPage(instanceId.value, {
      hours: slowSqlHours.value,
      offset: slowSqlOffset.value,
      size: slowSqlSize.value
    });
    if (error || !data) {
      return;
    }
    slowSqlRecords.value = data.records ?? [];
    slowSqlHasMore.value = Boolean(data.hasMore);
  } finally {
    slowSqlLoading.value = false;
  }
}

async function handleExpand(expanded: boolean, record: Api.Monitor.SlowSqlRecord) {
  if (!expanded || !record.fingerprint || !instanceId.value) {
    return;
  }
  detailLoading.value = true;
  try {
    const { data, error } = await fetchGetSlowSqlPage(instanceId.value, {
      fingerprint: record.fingerprint,
      hours: slowSqlHours.value,
      offset: 0,
      size: 20
    });
    detailRows.value = error || !data ? [] : (data.records ?? []);
  } finally {
    detailLoading.value = false;
  }
}

// ==================== 会话（kill 高危） ====================

const sessionsLoading = ref(false);
const sessions = ref<Api.Monitor.DbSession[]>([]);

const sessionColumns = computed(() => [
  { key: 'sessionId', dataIndex: 'sessionId', title: $t('page.manage.monitor.dbMetrics.sessionId'), width: 120 },
  { key: 'username', dataIndex: 'username', title: $t('page.manage.monitor.dbMetrics.username'), width: 120 },
  { key: 'dbName', dataIndex: 'dbName', title: $t('page.manage.monitor.dbMetrics.dbName'), width: 140 },
  { key: 'state', dataIndex: 'state', title: $t('page.manage.monitor.dbMetrics.state'), width: 110 },
  {
    key: 'durationSec',
    dataIndex: 'durationSec',
    title: $t('page.manage.monitor.dbMetrics.durationSec'),
    width: 110,
    customRender: ({ record }: { record: Api.Monitor.DbSession }) => record.durationSec ?? '-'
  },
  { key: 'clientAddr', dataIndex: 'clientAddr', title: $t('page.manage.monitor.dbMetrics.clientAddr'), width: 140 },
  { key: 'query', dataIndex: 'query', title: $t('page.manage.monitor.dbMetrics.query'), ellipsis: true },
  {
    key: 'operate',
    title: $t('common.operate'),
    width: 90,
    customRender: ({ record }: { record: Api.Monitor.DbSession }) =>
      hasAuth('monitor:db:session:kill') && (
        <Button danger type="link" size="small" onClick={() => openKillModal(record)}>
          {$t('page.manage.monitor.dbMetrics.kill')}
        </Button>
      )
  }
]);

async function loadSessions() {
  if (!instanceId.value) {
    sessions.value = [];
    return;
  }
  sessionsLoading.value = true;
  try {
    const { data, error } = await fetchGetDbSessions(instanceId.value);
    sessions.value = error || !data ? [] : data;
  } finally {
    sessionsLoading.value = false;
  }
}

const killVisible = ref(false);
const killingSession = ref<Api.Monitor.DbSession | null>(null);

const killDescription = computed(() =>
  $t('page.manage.monitor.dbMetrics.killDesc', { sessionId: killingSession.value?.sessionId ?? '' })
);

function openKillModal(record: Api.Monitor.DbSession) {
  killingSession.value = record;
  killVisible.value = true;
}

async function issueKillToken(): Promise<string | null> {
  if (!instanceId.value || !killingSession.value) {
    return null;
  }
  // 操作摘要与后端消费端 DbMonitorServiceImpl 保持一致：db:session:kill:{sessionId}
  const { data, error } = await issueConfirmToken(
    instanceId.value,
    `db:session:kill:${killingSession.value.sessionId}`
  );
  if (error || !data) {
    return null;
  }
  return data.token;
}

async function submitKill(token: string): Promise<boolean> {
  if (!instanceId.value || !killingSession.value) {
    return false;
  }
  const { error } = await fetchKillDbSession(instanceId.value, killingSession.value.sessionId, token);
  if (error) {
    window.$message?.error?.($t('page.manage.monitor.dbMetrics.killFailed'));
    return false;
  }
  window.$message?.success?.($t('page.manage.monitor.dbMetrics.killSuccess'));
  loadSessions();
  return true;
}

// ==================== 锁 ====================

const locksLoading = ref(false);
const locks = ref<Api.Monitor.DbLock[]>([]);

/** 锁记录可能同会话多行，row-key 需要带上行号 */
function lockRowKey(record: Api.Monitor.DbLock, index?: number) {
  return `${record.sessionId}-${record.relation}-${index}`;
}

const lockColumns = computed(() => [
  { key: 'lockType', dataIndex: 'lockType', title: $t('page.manage.monitor.dbMetrics.lockType'), width: 130 },
  { key: 'mode', dataIndex: 'mode', title: $t('page.manage.monitor.dbMetrics.lockMode'), width: 170, ellipsis: true },
  {
    key: 'relation',
    dataIndex: 'relation',
    title: $t('page.manage.monitor.dbMetrics.lockRelation'),
    width: 170,
    ellipsis: true
  },
  { key: 'sessionId', dataIndex: 'sessionId', title: $t('page.manage.monitor.dbMetrics.sessionId'), width: 110 },
  {
    key: 'granted',
    dataIndex: 'granted',
    title: $t('page.manage.monitor.dbMetrics.granted'),
    width: 90,
    customRender: ({ record }: { record: Api.Monitor.DbLock }) =>
      record.granted === undefined ? (
        '-'
      ) : (
        <Tag color={record.granted ? 'success' : 'warning'}>{record.granted ? 'Y' : 'N'}</Tag>
      )
  },
  {
    key: 'blockingSessionId',
    dataIndex: 'blockingSessionId',
    title: $t('page.manage.monitor.dbMetrics.blockingSessionId'),
    width: 110
  },
  { key: 'query', dataIndex: 'query', title: $t('page.manage.monitor.dbMetrics.query'), ellipsis: true }
]);

async function loadLocks() {
  if (!instanceId.value) {
    locks.value = [];
    return;
  }
  locksLoading.value = true;
  try {
    const { data, error } = await fetchGetDbLocks(instanceId.value);
    locks.value = error || !data ? [] : data;
  } finally {
    locksLoading.value = false;
  }
}

// ==================== 容量 Top N ====================

const capacityLoading = ref(false);
const capacity = ref<Api.Monitor.CapacitySnapshot[]>([]);
const capacityTopN = ref(20);

const capacityOption = computed<ECOption>(() => {
  const rows = capacity.value.slice(0, capacityTopN.value).reverse();
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const item = (Array.isArray(params) ? params[0] : params) as { name: string; value: number };
        return `${item.name}<br/>${formatBytes(item.value)}`;
      }
    },
    grid: { left: '3%', right: '6%', top: 10, bottom: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: (value: number) => formatBytes(value) }
    },
    yAxis: {
      type: 'category',
      data: rows.map(row => `${row.schemaName}.${row.tableName}`)
    },
    series: [
      {
        type: 'bar',
        data: rows.map(row => (row.tableSizeBytes ?? 0) + (row.indexSizeBytes ?? 0))
      }
    ]
  };
});

const { domRef: capacityRef, updateOptions: updateCapacity } = useEcharts(() => capacityOption.value);

const capacityColumns = computed(() => [
  { key: 'index', dataIndex: 'index', title: $t('common.index'), width: 64 },
  { key: 'schemaName', dataIndex: 'schemaName', title: $t('page.manage.monitor.dbMetrics.schemaName'), width: 140 },
  { key: 'tableName', dataIndex: 'tableName', title: $t('page.manage.monitor.dbMetrics.tableName'), ellipsis: true },
  { key: 'tableRows', dataIndex: 'tableRows', title: $t('page.manage.monitor.dbMetrics.tableRows'), width: 120 },
  {
    key: 'tableSizeBytes',
    dataIndex: 'tableSizeBytes',
    title: $t('page.manage.monitor.dbMetrics.tableSize'),
    width: 120,
    customRender: ({ record }: { record: Api.Monitor.CapacitySnapshot }) => formatBytes(record.tableSizeBytes)
  },
  {
    key: 'indexSizeBytes',
    dataIndex: 'indexSizeBytes',
    title: $t('page.manage.monitor.dbMetrics.indexSize'),
    width: 120,
    customRender: ({ record }: { record: Api.Monitor.CapacitySnapshot }) => formatBytes(record.indexSizeBytes)
  },
  {
    key: 'snapshotDate',
    dataIndex: 'snapshotDate',
    title: $t('page.manage.monitor.dbMetrics.snapshotDate'),
    width: 120,
    customRender: ({ record }: { record: Api.Monitor.CapacitySnapshot }) => record.snapshotDate || '-'
  }
]);

async function loadCapacity() {
  if (!instanceId.value) {
    capacity.value = [];
    return;
  }
  capacityLoading.value = true;
  try {
    const { data, error } = await fetchGetDbCapacity(instanceId.value, { topN: capacityTopN.value });
    capacity.value = error || !data ? [] : data;
    updateCapacity(() => capacityOption.value);
  } finally {
    capacityLoading.value = false;
  }
}
</script>

<template>
  <div class="flex-col-stretch gap-16px overflow-auto">
    <ACard :bordered="false" class="card-wrapper">
      <div class="flex-y-center flex-wrap gap-16px">
        <span>{{ $t('page.manage.monitor.common.instance') }}</span>
        <InstanceSelect v-model="instanceId" :instance-type="DB_TYPES" class="w-320px" @change="handleInstanceChange" />
      </div>
    </ACard>

    <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.monitor.dbMetrics.poolTitle')">
      <ARow :gutter="[16, 16]" align="middle">
        <ACol :xs="24" :lg="6">
          <div class="mb-8px flex-y-center gap-4px">
            {{ $t('page.manage.monitor.dbMetrics.poolUsage') }}
            <ATooltip :title="$t('page.manage.monitor.dbMetrics.descPoolUsage')">
              <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
            </ATooltip>
          </div>
          <AProgress
            :percent="poolUsagePercent ?? 0"
            :status="poolUsagePercent !== null && poolUsagePercent > 85 ? 'exception' : 'normal'"
          />
        </ACol>
        <ACol :xs="12" :lg="3">
          <AStatistic :value="poolActive ?? '-'">
            <template #title>
              <span class="flex-y-center gap-4px">
                {{ $t('page.manage.monitor.dbMetrics.poolActive') }}
                <ATooltip :title="$t('page.manage.monitor.dbMetrics.descPoolActive')">
                  <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
                </ATooltip>
              </span>
            </template>
          </AStatistic>
        </ACol>
        <ACol :xs="12" :lg="3">
          <AStatistic :value="poolMax ?? '-'">
            <template #title>
              <span class="flex-y-center gap-4px">
                {{ $t('page.manage.monitor.dbMetrics.poolMax') }}
                <ATooltip :title="$t('page.manage.monitor.dbMetrics.descPoolMax')">
                  <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
                </ATooltip>
              </span>
            </template>
          </AStatistic>
        </ACol>
        <ACol :xs="12" :lg="3">
          <AStatistic :value="poolWait ?? '-'">
            <template #title>
              <span class="flex-y-center gap-4px">
                {{ $t('page.manage.monitor.dbMetrics.poolWait') }}
                <ATooltip :title="$t('page.manage.monitor.dbMetrics.descPoolWait')">
                  <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
                </ATooltip>
              </span>
            </template>
          </AStatistic>
        </ACol>
        <ACol :xs="12" :lg="3">
          <AStatistic :value="threadsRunning ?? '-'">
            <template #title>
              <span class="flex-y-center gap-4px">
                {{ $t('page.manage.monitor.dbMetrics.threadsRunning') }}
                <ATooltip :title="$t('page.manage.monitor.dbMetrics.descThreadsRunning')">
                  <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
                </ATooltip>
              </span>
            </template>
          </AStatistic>
        </ACol>
        <ACol :xs="12" :lg="3">
          <AStatistic :value="questions ?? '-'">
            <template #title>
              <span class="flex-y-center gap-4px">
                {{ $t('page.manage.monitor.dbMetrics.questions') }}
                <ATooltip :title="$t('page.manage.monitor.dbMetrics.descQuestions')">
                  <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
                </ATooltip>
              </span>
            </template>
          </AStatistic>
        </ACol>
        <ACol :xs="12" :lg="3">
          <AStatistic :value="slowQueries ?? '-'">
            <template #title>
              <span class="flex-y-center gap-4px">
                {{ $t('page.manage.monitor.dbMetrics.slowQueries') }}
                <ATooltip :title="$t('page.manage.monitor.dbMetrics.descSlowQueries')">
                  <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px text-#999" />
                </ATooltip>
              </span>
            </template>
          </AStatistic>
        </ACol>
      </ARow>
    </ACard>

    <ARow :gutter="[16, 16]">
      <ACol :xs="24" :lg="12">
        <MetricRangeChart
          ref="poolChartRef"
          :title="$t('page.manage.monitor.dbMetrics.poolTrend')"
          :load="historyLoader('db.pool.active_count')"
          :unit="$t('page.manage.monitor.dbMetrics.unitConn')"
          :description="$t('page.manage.monitor.dbMetrics.descPoolTrend')"
        />
      </ACol>
      <ACol :xs="24" :lg="12">
        <MetricRangeChart
          ref="qpsChartRef"
          :title="$t('page.manage.monitor.dbMetrics.qpsTrend')"
          :load="historyLoader('db.questions')"
          :unit="$t('page.manage.monitor.dbMetrics.unitQps')"
          :description="$t('page.manage.monitor.dbMetrics.descQpsTrend')"
        />
      </ACol>
    </ARow>

    <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.monitor.dbMetrics.slowSqlTitle')">
      <template #extra>
        <div class="flex-y-center gap-12px">
          <AInputNumber
            v-model:value="slowSqlHours"
            :min="1"
            :max="720"
            :placeholder="$t('page.manage.monitor.redisMetrics.form.hours')"
            class="w-120px"
          />
          <AButton size="small" @click="loadSlowSql(true)">{{ $t('common.search') }}</AButton>
        </div>
      </template>
      <ATable
        :columns="slowSqlColumns"
        :data-source="slowSqlRecords"
        size="small"
        :loading="slowSqlLoading"
        row-key="fingerprint"
        :pagination="false"
        :scroll="{ x: 1000 }"
        @expand="handleExpand"
      >
        <template #expandedRowRender>
          <ATable
            :columns="slowSqlDetailColumns"
            :data-source="detailRows"
            size="small"
            :loading="detailLoading"
            row-key="collectTime"
            :pagination="false"
          />
        </template>
      </ATable>
      <div class="mt-12px flex-y-center justify-end gap-12px">
        <AButton
          size="small"
          :disabled="slowSqlOffset === 0 || slowSqlLoading"
          @click="
            slowSqlOffset -= slowSqlSize;
            loadSlowSql();
          "
        >
          {{ $t('page.manage.monitor.common.prevPage') }}
        </AButton>
        <AButton
          size="small"
          :disabled="!slowSqlHasMore || slowSqlLoading"
          @click="
            slowSqlOffset += slowSqlSize;
            loadSlowSql();
          "
        >
          {{ $t('page.manage.monitor.common.nextPage') }}
        </AButton>
      </div>
    </ACard>

    <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.monitor.dbMetrics.sessionsTitle')">
      <template #extra>
        <AButton size="small" :loading="sessionsLoading" @click="loadSessions">{{ $t('common.refresh') }}</AButton>
      </template>
      <ATable
        :columns="sessionColumns"
        :data-source="sessions"
        size="small"
        :loading="sessionsLoading"
        row-key="sessionId"
        :scroll="{ x: 1100 }"
        :pagination="{ pageSize: 20 }"
      />
    </ACard>

    <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.monitor.dbMetrics.locksTitle')">
      <template #extra>
        <AButton size="small" :loading="locksLoading" @click="loadLocks">{{ $t('common.refresh') }}</AButton>
      </template>
      <ATable
        :columns="lockColumns"
        :data-source="locks"
        size="small"
        :loading="locksLoading"
        :row-key="lockRowKey"
        :scroll="{ x: 1000 }"
        :pagination="false"
      />
    </ACard>

    <ACard v-if="hasAuth('monitor:db:capacity')" :bordered="false" class="card-wrapper">
      <template #title>
        <span class="flex-y-center gap-4px">
          {{ $t('page.manage.monitor.dbMetrics.capacityTitle') }}
          <ATooltip :title="$t('page.manage.monitor.dbMetrics.descCapacity')">
            <SvgIcon icon="ant-design:info-circle-outlined" class="text-14px text-#999" />
          </ATooltip>
        </span>
      </template>
      <template #extra>
        <div class="flex-y-center gap-12px">
          <AInputNumber v-model:value="capacityTopN" :min="5" :max="100" class="w-100px" />
          <AButton size="small" :loading="capacityLoading" @click="loadCapacity">{{ $t('common.refresh') }}</AButton>
        </div>
      </template>
      <div v-if="capacity.length" ref="capacityRef" class="mb-16px h-360px" />
      <ATable
        :columns="capacityColumns"
        :data-source="capacity"
        size="small"
        :loading="capacityLoading"
        row-key="tableName"
        :scroll="{ x: 900 }"
        :pagination="false"
      />
    </ACard>

    <ConfirmDangerModal
      v-model:visible="killVisible"
      :title="$t('page.manage.monitor.dbMetrics.kill')"
      :description="killDescription"
      :confirm-text="killingSession?.sessionId ?? ''"
      :issue-token="issueKillToken"
      :submit="submitKill"
    />
  </div>
</template>

<style scoped></style>
