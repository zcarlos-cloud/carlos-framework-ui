<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DatePicker, Statistic } from 'ant-design-vue';
import dayjs from 'dayjs';
import { fetchGetAuditLogDailyStats, fetchGetAuditLogStats } from '@/service/api';
import { useEcharts } from '@/hooks/common/echarts';
import { $t } from '@/locales';

defineOptions({
  name: 'AuditLogStats'
});

interface StatTile {
  key: string;
  label: string;
  value: number;
  /** 小数位，仅平均耗时使用 */
  precision?: number;
}

/** 实时统计的查询日期，默认今天 */
const statsDate = ref<string>(dayjs().format('YYYY-MM-DD'));

const statsLoading = ref(false);
const stats = ref<Api.Audit.Stats | null>(null);

/** 趋势图的日期区间，默认最近 14 天 */
const trendRange = ref<[string, string]>([
  dayjs().subtract(13, 'day').format('YYYY-MM-DD'),
  dayjs().format('YYYY-MM-DD')
]);

const trendLoading = ref(false);

/**
 * 统计数值经后端 LongJsonComponent 序列化为字符串，展示前统一转数字。
 * `AStatistic` 的 precision 只接受 number，直接渲染字符串会被当成文本原样输出。
 */
function toNumber(value?: string | number | null) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

const statsTiles = computed<StatTile[]>(() => [
  { key: 'totalCount', label: $t('page.audit.log.stat.total'), value: toNumber(stats.value?.totalCount) },
  { key: 'successCount', label: $t('page.audit.log.stat.success'), value: toNumber(stats.value?.successCount) },
  { key: 'failCount', label: $t('page.audit.log.stat.fail'), value: toNumber(stats.value?.failCount) },
  { key: 'uniqueUsers', label: $t('page.audit.log.stat.uniqueUsers'), value: toNumber(stats.value?.uniqueUsers) },
  {
    key: 'avgDuration',
    label: $t('page.audit.log.stat.avgDuration'),
    value: toNumber(stats.value?.avgDuration),
    precision: 2
  },
  {
    key: 'maxRiskLevel',
    label: $t('page.audit.log.stat.maxRiskLevel'),
    value: toNumber(stats.value?.maxRiskLevel)
  }
]);

const { domRef, updateOptions } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'cross'
    }
  },
  // ECharts 6 图例默认贴底（v5 是顶部），不写 top 会压住 x 轴标签
  legend: {
    top: 0,
    data: [$t('page.audit.log.stat.total'), $t('page.audit.log.stat.fail')]
  },
  grid: {
    left: '3%',
    right: '4%',
    top: 40,
    bottom: '3%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: [] as string[]
  },
  yAxis: {
    type: 'value'
  },
  series: [
    {
      color: '#8e9dff',
      name: $t('page.audit.log.stat.total'),
      type: 'line',
      smooth: true,
      emphasis: { focus: 'series' },
      data: [] as number[]
    },
    {
      color: '#f5222d',
      name: $t('page.audit.log.stat.fail'),
      type: 'line',
      smooth: true,
      emphasis: { focus: 'series' },
      data: [] as number[]
    }
  ]
}));

/**
 * 更新趋势数据
 *
 * 直接改 opts 后返回，与 home/modules/line-chart.vue 的既有写法一致。
 * updateOptions 会把回调结果合并进 chartOptions 后再判断是否已渲染，
 * 因此即使本组件的异步请求先于图表初始化返回，数据也不会丢，首次 render 会带上它。
 */
function updateTrendOptions(dates: string[], totals: number[], fails: number[]) {
  updateOptions(opts => {
    opts.xAxis.data = dates;
    opts.series[0].data = totals;
    opts.series[1].data = fails;

    return opts;
  });
}

async function loadStats() {
  statsLoading.value = true;
  try {
    const { data, error } = await fetchGetAuditLogStats(statsDate.value);

    if (error) {
      return;
    }

    stats.value = data ?? null;
  } finally {
    statsLoading.value = false;
  }
}

async function loadTrend() {
  const [startDate, endDate] = trendRange.value;

  if (!startDate || !endDate) {
    return;
  }

  trendLoading.value = true;
  try {
    const { data, error } = await fetchGetAuditLogDailyStats(startDate, endDate);

    if (error) {
      return;
    }

    const list = data ?? [];

    updateTrendOptions(
      list.map(item => item.date ?? ''),
      list.map(item => toNumber(item.totalCount)),
      list.map(item => toNumber(item.failCount))
    );
  } finally {
    trendLoading.value = false;
  }
}

watch(statsDate, loadStats);
watch(trendRange, loadTrend);

// init
loadStats();
loadTrend();
</script>

<template>
  <div class="flex flex-col gap-16px p-16px">
    <div class="flex flex-wrap items-center justify-between gap-8px">
      <span class="text-16px font-medium">{{ $t('page.audit.log.statTitle') }}</span>
      <DatePicker v-model:value="statsDate" value-format="YYYY-MM-DD" :allow-clear="false" />
    </div>
    <ASpin :spinning="statsLoading">
      <ARow :gutter="[16, 16]">
        <ACol v-for="tile in statsTiles" :key="tile.key" :span="24" :sm="12" :lg="4">
          <Statistic :title="tile.label" :value="tile.value" :precision="tile.precision" />
        </ACol>
      </ARow>
    </ASpin>
    <ADivider class="my-0" />
    <div class="flex flex-wrap items-center justify-between gap-8px">
      <span class="text-14px text-gray-500">{{ $t('page.audit.log.trendTitle') }}</span>
      <!-- eslint-disable-next-line vue/component-name-in-template-casing -- RangePicker 是 antd 的嵌套组件，点号命名无法满足 PascalCase -->
      <DatePicker.RangePicker v-model:value="trendRange" value-format="YYYY-MM-DD" :allow-clear="false" />
    </div>
    <ASpin :spinning="trendLoading">
      <div ref="domRef" class="h-200px overflow-hidden"></div>
    </ASpin>
  </div>
</template>

<style scoped></style>
