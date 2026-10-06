<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchGetDashboardAbnormal, fetchGetDashboardSummary, fetchGetDashboardTrend } from '@/service/api';
import { type ECOption, useEcharts } from '@/hooks/common/echarts';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { alarmLevelTagColor, instanceTypeText } from '../shared';

defineOptions({
  name: 'MonitorDashboard'
});

const loading = ref(false);
const summary = ref<Api.Monitor.DashboardSummary | null>(null);
const abnormal = ref<Api.Monitor.DashboardAbnormal | null>(null);

const trendMetric = ref('redis.memory.used_percent');
const trendRange = ref('24h');
const trend = ref<Api.Monitor.DashboardTrend | null>(null);
const trendLoading = ref(false);

const trendMetricOptions = computed(() => [
  { label: $t('page.manage.monitor.dashboard.metricRedisMemory'), value: 'redis.memory.used_percent' },
  { label: $t('page.manage.monitor.dashboard.metricRedisOps'), value: 'redis.stats.ops_per_sec' },
  { label: $t('page.manage.monitor.dashboard.metricRedisHitRate'), value: 'redis.stats.hit_rate' },
  { label: $t('page.manage.monitor.dashboard.metricDbPoolActive'), value: 'db.pool.active_count' },
  { label: $t('page.manage.monitor.dashboard.metricServiceHealth'), value: 'service.health' }
]);

/** 每个指标的 y 轴单位与含义说明（标题旁信息图标 + y 轴顶部展示） */
const trendMetricMeta = computed<Record<string, { unit: string; desc: string }>>(() => ({
  'redis.memory.used_percent': { unit: '%', desc: $t('page.manage.monitor.dashboard.metricDescRedisMemory') },
  'redis.stats.ops_per_sec': { unit: 'ops/s', desc: $t('page.manage.monitor.dashboard.metricDescRedisOps') },
  'redis.stats.hit_rate': { unit: '%', desc: $t('page.manage.monitor.dashboard.metricDescRedisHitRate') },
  'db.pool.active_count': {
    unit: $t('page.manage.monitor.dbMetrics.unitConn'),
    desc: $t('page.manage.monitor.dashboard.metricDescDbPoolActive')
  },
  'service.health': { unit: '', desc: $t('page.manage.monitor.dashboard.metricDescServiceHealth') }
}));

const activeTrendMeta = computed(() => trendMetricMeta.value[trendMetric.value] ?? { unit: '', desc: '' });

const rangeOptions = computed(() => [
  { label: $t('page.manage.monitor.common.range24h'), value: '24h' },
  { label: $t('page.manage.monitor.common.range7d'), value: '7d' }
]);

function alarmCount(level: Api.Monitor.AlarmLevel): number {
  const stat = summary.value?.alarmStats?.find(item => item.alarmLevel === level);
  return Number(stat?.count ?? 0);
}

/** tooltip 数值格式化：带单位后缀，空值显示 - */
function formatTrendValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  return unit ? `${value} ${unit}` : String(value);
}

const trendOption = computed<ECOption>(() => {
  const series = trend.value?.series ?? [];
  const unit = activeTrendMeta.value.unit;
  const tsSet = new Set<string>();
  series.forEach(item => item.points.forEach(point => tsSet.add(point.ts)));
  const tsList = Array.from(tsSet).sort();

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params : [params];
        const first = items[0] as { axisValue?: string } | undefined;
        const lines = items.map(item => {
          const point = item as { marker?: string; seriesName?: string; value?: number | null };
          return `${point.marker ?? ''}${point.seriesName ?? ''}: ${formatTrendValue(point.value, unit)}`;
        });
        return [first?.axisValue ?? '', ...lines].filter(Boolean).join('<br/>');
      }
    },
    legend: { top: 0, data: series.map(item => item.instanceName) },
    grid: { left: '3%', right: '4%', top: 40, bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: tsList },
    yAxis: {
      type: 'value',
      name: unit,
      nameTextStyle: { align: 'left', color: '#999' }
    },
    series: series.map(item => {
      const valueMap = new Map(item.points.map(point => [point.ts, point.value]));
      return {
        name: item.instanceName,
        type: 'line' as const,
        smooth: true,
        showSymbol: false,
        connectNulls: true,
        data: tsList.map(ts => valueMap.get(ts) ?? null)
      };
    })
  };
});

const { domRef: trendRef, updateOptions: updateTrend } = useEcharts(() => trendOption.value);

async function loadSummary() {
  loading.value = true;
  try {
    const [{ data: summaryData }, { data: abnormalData }] = await Promise.all([
      fetchGetDashboardSummary(),
      fetchGetDashboardAbnormal(20)
    ]);
    summary.value = summaryData ?? null;
    abnormal.value = abnormalData ?? null;
  } finally {
    loading.value = false;
  }
}

async function loadTrend() {
  trendLoading.value = true;
  try {
    const { data, error } = await fetchGetDashboardTrend({
      metric: trendMetric.value,
      range: trendRange.value,
      topN: 5
    });
    if (error || !data) {
      return;
    }
    trend.value = data;
    updateTrend(() => trendOption.value);
  } finally {
    trendLoading.value = false;
  }
}

function loadAll() {
  loadSummary();
  loadTrend();
}

onMounted(() => {
  loadAll();
});
</script>

<template>
  <div class="flex-col-stretch gap-16px overflow-auto">
    <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.monitor.dashboard.title')">
      <template #extra>
        <AButton size="small" :loading="loading" @click="loadAll">{{ $t('common.refresh') }}</AButton>
      </template>
      <ASpin :spinning="loading">
        <ARow :gutter="[16, 16]">
          <ACol :xs="12" :sm="8" :lg="4">
            <AStatistic
              :title="$t('page.manage.monitor.dashboard.totalInstances')"
              :value="summary?.totalInstances ?? 0"
            />
          </ACol>
          <ACol :xs="12" :sm="8" :lg="4">
            <AStatistic
              :title="$t('page.manage.monitor.dashboard.upCount')"
              :value="summary?.upCount ?? 0"
              :value-style="{ color: '#52c41a' }"
            />
          </ACol>
          <ACol :xs="12" :sm="8" :lg="4">
            <AStatistic
              :title="$t('page.manage.monitor.dashboard.downCount')"
              :value="summary?.downCount ?? 0"
              :value-style="{ color: '#ff4d4f' }"
            />
          </ACol>
          <ACol :xs="12" :sm="8" :lg="4">
            <AStatistic
              :title="$t('page.manage.monitor.dashboard.alarmCritical')"
              :value="alarmCount('CRITICAL')"
              :value-style="{ color: '#ff4d4f' }"
            />
          </ACol>
          <ACol :xs="12" :sm="8" :lg="4">
            <AStatistic
              :title="$t('page.manage.monitor.dashboard.alarmWarn')"
              :value="alarmCount('WARN')"
              :value-style="{ color: '#faad14' }"
            />
          </ACol>
          <ACol :xs="12" :sm="8" :lg="4">
            <AStatistic :title="$t('page.manage.monitor.dashboard.alarmInfo')" :value="alarmCount('INFO')" />
          </ACol>
        </ARow>
        <div v-if="summary?.typeStats?.length" class="mt-16px flex flex-wrap gap-8px">
          <ATag v-for="item in summary.typeStats" :key="item.instanceType">
            {{ instanceTypeText(item.instanceType) }}: {{ item.up }}/{{ item.total }}
          </ATag>
          <ATag v-if="summary.staleCount" color="orange">
            {{ $t('page.manage.monitor.dashboard.staleCount') }}: {{ summary.staleCount }}
          </ATag>
        </div>
      </ASpin>
    </ACard>

    <ACard :bordered="false" class="card-wrapper">
      <template #title>
        <span class="flex-y-center gap-4px">
          {{ $t('page.manage.monitor.dashboard.trendTitle') }}
          <ATooltip :title="activeTrendMeta.desc">
            <SvgIcon icon="ant-design:info-circle-outlined" class="text-14px text-#999" />
          </ATooltip>
        </span>
      </template>
      <template #extra>
        <div class="flex-y-center gap-12px">
          <ASelect
            v-model:value="trendMetric"
            :options="trendMetricOptions"
            class="w-200px"
            size="small"
            @change="loadTrend"
          />
          <ARadioGroup
            v-model:value="trendRange"
            :options="rangeOptions"
            option-type="button"
            size="small"
            @change="loadTrend"
          />
        </div>
      </template>
      <div class="mb-8px flex-y-center gap-4px text-12px text-#999">
        <SvgIcon icon="ant-design:info-circle-outlined" class="text-13px" />
        {{ $t('page.manage.monitor.dashboard.trendHint') }}
      </div>
      <ASpin :spinning="trendLoading">
        <div v-if="trend?.series?.length" ref="trendRef" class="h-320px" />
        <AEmpty
          v-else-if="!trendLoading"
          :description="$t('common.noData')"
          class="h-320px flex-col-center justify-center"
        />
        <div v-else class="h-320px" />
      </ASpin>
    </ACard>

    <ARow :gutter="[16, 16]">
      <ACol :xs="24" :lg="12">
        <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.monitor.dashboard.abnormalInstances')">
          <AList
            :data-source="abnormal?.abnormalInstances ?? []"
            size="small"
            :pagination="{ pageSize: 5 }"
            :locale="{ emptyText: $t('common.noData') }"
          >
            <template #renderItem="{ item }">
              <AListItem>
                <div class="w-full flex-y-center justify-between gap-8px">
                  <div class="flex-y-center gap-8px">
                    <ATag :color="item.healthStatus === 'DOWN' ? 'error' : 'default'">{{ item.healthStatus }}</ATag>
                    <span>{{ item.instanceName }}</span>
                    <ATag>{{ instanceTypeText(item.instanceType) }}</ATag>
                    <ATag>{{ item.env }}</ATag>
                  </div>
                  <span class="text-12px text-#999">{{ formatDateTime(item.lastCollectTime) }}</span>
                </div>
              </AListItem>
            </template>
          </AList>
        </ACard>
      </ACol>
      <ACol :xs="24" :lg="12">
        <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.monitor.dashboard.latestAlarms')">
          <AList
            :data-source="abnormal?.alarms ?? []"
            size="small"
            :pagination="{ pageSize: 5 }"
            :locale="{ emptyText: $t('common.noData') }"
          >
            <template #renderItem="{ item }">
              <AListItem>
                <div class="w-full">
                  <div class="flex-y-center gap-8px">
                    <ATag v-if="item.alarmLevel" :color="alarmLevelTagColor(item.alarmLevel)">
                      {{ item.alarmLevel }}
                    </ATag>
                    <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{{ item.alarmContent }}</span>
                  </div>
                  <div class="mt-4px text-12px text-#999">
                    {{ item.instanceName }} · {{ item.metricName }} · {{ formatDateTime(item.lastTriggerTime) }}
                  </div>
                </div>
              </AListItem>
            </template>
          </AList>
        </ACard>
      </ACol>
    </ARow>
  </div>
</template>

<style scoped></style>
