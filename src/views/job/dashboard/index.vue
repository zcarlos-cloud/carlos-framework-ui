<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchJobDashboardOverview } from '@/service/api';
import { type ECOption, useEcharts } from '@/hooks/common/echarts';
import { $t } from '@/locales';

defineOptions({
  name: 'JobDashboard'
});

const loading = ref(false);
const days = ref(7);
const dashboard = ref<Api.Job.JobDashboard>({});

const dayOptions = computed(() => [
  { label: $t('page.manage.jobDashboard.days7'), value: 7 },
  { label: $t('page.manage.jobDashboard.days15'), value: 15 },
  { label: $t('page.manage.jobDashboard.days30'), value: 30 }
]);

/** Long 字段以字符串下发，展示前统一转数字 */
function toNumber(value?: string | number): number {
  return Number(value ?? 0);
}

const trendOption = computed<ECOption>(() => {
  const rows = dashboard.value.dateDistribution ?? [];
  return {
    tooltip: { trigger: 'axis' },
    /**
     * ECharts 6 把图例默认位置从顶部改到了底部（LegendModel.defaultOption.bottom），
     * 不显式指定 top 时图例会压在 x 轴日期标签上。必须钉住 top。
     */
    legend: {
      top: 0,
      data: [$t('page.manage.jobDashboard.successCount'), $t('page.manage.jobDashboard.failCount')]
    },
    // top 给图例留位（v6 的 grid 默认 top: 65 也是为此，但这里 bottom 被覆盖了，需自己写）
    grid: { left: '3%', right: '4%', top: 40, bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map(row => row.date)
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: $t('page.manage.jobDashboard.successCount'),
        type: 'bar',
        stack: 'total',
        itemStyle: { color: '#52c41a' },
        data: rows.map(row => toNumber(row.successCount))
      },
      {
        name: $t('page.manage.jobDashboard.failCount'),
        type: 'bar',
        stack: 'total',
        itemStyle: { color: '#ff4d4f' },
        data: rows.map(row => toNumber(row.failCount))
      }
    ]
  };
});

const statusOption = computed<ECOption>(() => {
  const rows = dashboard.value.statusDistribution ?? [];
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        label: { formatter: '{b}: {c}' },
        data: rows.map(row => ({ name: row.statusName, value: toNumber(row.count) }))
      }
    ]
  };
});

const { domRef: trendRef, updateOptions: updateTrend } = useEcharts(() => trendOption.value);
const { domRef: statusRef, updateOptions: updateStatus } = useEcharts(() => statusOption.value);

async function loadData() {
  loading.value = true;
  try {
    const { data, error } = await fetchJobDashboardOverview(days.value);
    if (error || !data) {
      return;
    }
    dashboard.value = data;
    updateTrend(() => trendOption.value);
    updateStatus(() => statusOption.value);
  } finally {
    loading.value = false;
  }
}

function handleDaysChange() {
  loadData();
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="flex-col-stretch gap-16px overflow-auto">
    <ACard :bordered="false" class="card-wrapper">
      <template #title>{{ $t('page.manage.jobDashboard.title') }}</template>
      <template #extra>
        <ARadioGroup v-model:value="days" :options="dayOptions" option-type="button" @change="handleDaysChange" />
      </template>
      <ASpin :spinning="loading">
        <ARow :gutter="[16, 16]">
          <ACol :xs="12" :sm="8" :lg="6" :xl="3">
            <AStatistic :title="$t('page.manage.jobDashboard.jobCount')" :value="toNumber(dashboard.jobCount)" />
          </ACol>
          <ACol :xs="12" :sm="8" :lg="6" :xl="3">
            <AStatistic
              :title="$t('page.manage.jobDashboard.onlineNodeCount')"
              :value="toNumber(dashboard.onlineNodeCount)"
            />
          </ACol>
          <ACol :xs="12" :sm="8" :lg="6" :xl="3">
            <AStatistic
              :title="$t('page.manage.jobDashboard.todayTriggerCount')"
              :value="toNumber(dashboard.todayTriggerCount)"
            />
          </ACol>
          <ACol :xs="12" :sm="8" :lg="6" :xl="3">
            <AStatistic
              :title="$t('page.manage.jobDashboard.todaySuccessCount')"
              :value="toNumber(dashboard.todaySuccessCount)"
              :value-style="{ color: '#52c41a' }"
            />
          </ACol>
          <ACol :xs="12" :sm="8" :lg="6" :xl="3">
            <AStatistic
              :title="$t('page.manage.jobDashboard.todayFailCount')"
              :value="toNumber(dashboard.todayFailCount)"
              :value-style="{
                color: dashboard.todayFailCount && toNumber(dashboard.todayFailCount) > 0 ? '#ff4d4f' : undefined
              }"
            />
          </ACol>
          <ACol :xs="12" :sm="8" :lg="6" :xl="3">
            <AStatistic
              :title="$t('page.manage.jobDashboard.todaySuccessRate')"
              :value="dashboard.todaySuccessRate ?? 0"
              suffix="%"
            />
          </ACol>
          <ACol :xs="12" :sm="8" :lg="6" :xl="3">
            <AStatistic
              :title="$t('page.manage.jobDashboard.runningJobCount')"
              :value="dashboard.runningJobCount ?? 0"
            />
          </ACol>
        </ARow>
      </ASpin>
    </ACard>

    <ARow :gutter="[16, 16]">
      <ACol :xs="24" :lg="14">
        <ACard :title="$t('page.manage.jobDashboard.dateDistribution')" :bordered="false" class="card-wrapper">
          <div ref="trendRef" class="h-360px"></div>
        </ACard>
      </ACol>
      <ACol :xs="24" :lg="10">
        <ACard :title="$t('page.manage.jobDashboard.statusDistribution')" :bordered="false" class="card-wrapper">
          <div ref="statusRef" class="h-360px"></div>
        </ACard>
      </ACol>
    </ARow>
  </div>
</template>

<style scoped></style>
