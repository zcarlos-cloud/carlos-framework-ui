<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { type ECOption, useEcharts } from '@/hooks/common/echarts';
import { $t } from '@/locales';
import SvgIcon from '@/components/custom/svg-icon.vue';

defineOptions({
  name: 'MonitorMetricRangeChart'
});

/**
 * 指标趋势图（range 切换 + 加载 + 空态）
 *
 * load 由父组件提供，入参 range（1h/6h/24h/7d），返回多序列时序点；
 * 聚合点取 avgValue，原始点取 value。
 *
 * 可读性约定：
 * - unit 展示在 y 轴顶部，并追加到 tooltip 数值后；
 * - valueFormatter 优先于 unit（用于内存等需要字节格式化的场景），tooltip 同样套用；
 * - description 以信息图标形式挂在卡片标题旁，鼠标悬停展示指标含义；
 * - 单序列图隐藏图例（图例与标题重复），多序列图显示图例。
 */

export interface MetricSeriesData {
  name: string;
  points: Api.Monitor.HistoryPoint[];
}

interface Props {
  /** 图表标题 */
  title?: string;
  /** 拉取时序数据 */
  load: (range: string) => Promise<MetricSeriesData[]>;
  /** 默认 range */
  defaultRange?: string;
  /** 图表高度 px */
  height?: number;
  /** y 轴值格式化 */
  valueFormatter?: (value: number) => string;
  /** y 轴单位（如 %、ops/s、次/秒），tooltip 数值后自动追加 */
  unit?: string;
  /** 指标含义说明（标题旁信息图标悬停展示） */
  description?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  defaultRange: '1h',
  height: 260,
  valueFormatter: undefined,
  unit: '',
  description: ''
});

const range = ref(props.defaultRange);
const loading = ref(false);
const seriesData = ref<MetricSeriesData[]>([]);

const rangeOptions = computed(() => [
  { label: $t('page.manage.monitor.common.range1h'), value: '1h' },
  { label: $t('page.manage.monitor.common.range6h'), value: '6h' },
  { label: $t('page.manage.monitor.common.range24h'), value: '24h' },
  { label: $t('page.manage.monitor.common.range7d'), value: '7d' }
]);

const isEmpty = computed(() => seriesData.value.every(item => item.points.length === 0));

/** 数值展示：优先 valueFormatter，其次 unit 后缀 */
function formatValue(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  if (props.valueFormatter) {
    return props.valueFormatter(value);
  }
  return props.unit ? `${value} ${props.unit}` : String(value);
}

const chartOption = computed<ECOption>(() => {
  const tsSet = new Set<string>();
  seriesData.value.forEach(item => item.points.forEach(point => tsSet.add(point.ts)));
  const tsList = Array.from(tsSet).sort();
  const showLegend = seriesData.value.length > 1;

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params : [params];
        const first = items[0] as { axisValue?: string } | undefined;
        const lines = items.map(item => {
          const point = item as { marker?: string; seriesName?: string; value?: number | null };
          return `${point.marker ?? ''}${point.seriesName ?? ''}: ${formatValue(point.value ?? null)}`;
        });
        return [first?.axisValue ?? '', ...lines].filter(Boolean).join('<br/>');
      }
    },
    legend: showLegend ? { top: 0, data: seriesData.value.map(item => item.name) } : undefined,
    grid: { left: '3%', right: '4%', top: 40, bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: tsList },
    yAxis: {
      type: 'value',
      name: props.unit,
      nameTextStyle: { align: 'left', color: '#999' },
      axisLabel: {
        formatter: (value: number) => (props.valueFormatter ? props.valueFormatter(value) : String(value))
      }
    },
    series: seriesData.value.map(item => {
      const valueMap = new Map(item.points.map(point => [point.ts, point.avgValue ?? point.value ?? null]));
      return {
        name: item.name,
        type: 'line' as const,
        smooth: true,
        showSymbol: false,
        connectNulls: true,
        data: tsList.map(ts => valueMap.get(ts) ?? null)
      };
    })
  };
});

const { domRef, updateOptions } = useEcharts(() => chartOption.value);

async function loadData() {
  loading.value = true;
  try {
    seriesData.value = await props.load(range.value);
    updateOptions(() => chartOption.value);
  } finally {
    loading.value = false;
  }
}

function handleRangeChange() {
  loadData();
}

/** 暴露给父组件：实例切换等场景下重新拉取 */
defineExpose({ reload: loadData });

onMounted(() => {
  loadData();
});
</script>

<template>
  <ACard :bordered="false" class="card-wrapper" :body-style="{ padding: '12px 16px' }">
    <template v-if="title" #title>
      <span class="flex-y-center gap-4px">
        {{ title }}
        <ATooltip v-if="description" :title="description">
          <SvgIcon icon="ant-design:info-circle-outlined" class="text-14px text-#999" />
        </ATooltip>
      </span>
    </template>
    <template #extra>
      <ARadioGroup
        v-model:value="range"
        :options="rangeOptions"
        option-type="button"
        size="small"
        @change="handleRangeChange"
      />
    </template>
    <ASpin :spinning="loading">
      <div v-show="!isEmpty" ref="domRef" :style="{ height: `${height}px` }" />
      <AEmpty
        v-if="isEmpty && !loading"
        :description="$t('common.noData')"
        :style="{ height: `${height}px` }"
        class="flex-col-center justify-center"
      />
    </ASpin>
  </ACard>
</template>

<style scoped></style>
