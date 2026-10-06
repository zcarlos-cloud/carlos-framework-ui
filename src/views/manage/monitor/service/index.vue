<script setup lang="tsx">
import { computed, onMounted, ref } from 'vue';
import { Button, Tag } from 'ant-design-vue';
import {
  fetchGetServiceInstances,
  fetchGetServiceList,
  fetchGetServiceMetricHistory,
  fetchGetSkywalkingUrl,
  fetchUpdateServiceLogger,
  issueConfirmToken
} from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import ConfirmDangerModal from '../modules/confirm-danger-modal.vue';
import MetricRangeChart from '../modules/metric-range-chart.vue';
import { formatBytes, healthStatusTagColor, healthStatusText } from '../shared';

defineOptions({
  name: 'MonitorService'
});

const { hasAuth } = useAuth();

const loading = ref(false);
const services = ref<Api.Monitor.ServiceSummary[]>([]);
const skywalkingUrls = ref<Record<string, string>>({});

const serviceColumns = computed(() => [
  { key: 'index', dataIndex: 'index', title: $t('common.index'), width: 64 },
  {
    key: 'serviceName',
    dataIndex: 'serviceName',
    title: $t('page.manage.monitor.service.serviceName'),
    ellipsis: true
  },
  {
    key: 'instanceCount',
    dataIndex: 'instanceCount',
    title: $t('page.manage.monitor.service.instanceCount'),
    width: 130,
    customRender: ({ record }: { record: Api.Monitor.ServiceSummary }) =>
      `${record.healthyCount ?? 0} / ${record.instanceCount ?? 0}`
  },
  {
    key: 'healthStatus',
    dataIndex: 'healthStatus',
    title: $t('page.manage.monitor.instance.healthStatus'),
    width: 100,
    customRender: ({ record }: { record: Api.Monitor.ServiceSummary }) => {
      if (!record.healthStatus) {
        return null;
      }
      return <Tag color={healthStatusTagColor(record.healthStatus)}>{healthStatusText(record.healthStatus)}</Tag>;
    }
  },
  {
    key: 'lastCollectTime',
    dataIndex: 'lastCollectTime',
    title: $t('page.manage.monitor.instance.lastCollectTime'),
    width: 170,
    customRender: ({ record }: { record: Api.Monitor.ServiceSummary }) => formatDateTime(record.lastCollectTime)
  },
  {
    key: 'disabled',
    dataIndex: 'disabled',
    title: $t('page.manage.monitor.service.disabled'),
    width: 90,
    customRender: ({ record }: { record: Api.Monitor.ServiceSummary }) =>
      record.disabled ? <Tag color="default">{$t('page.manage.monitor.service.disabledYes')}</Tag> : ''
  },
  {
    key: 'operate',
    title: $t('common.operate'),
    width: 260,
    customRender: ({ record }: { record: Api.Monitor.ServiceSummary }) => (
      <div class="flex-center gap-8px">
        <Button type="primary" ghost size="small" onClick={() => openInstances(record)}>
          {$t('page.manage.monitor.service.instances')}
        </Button>
        <Button size="small" onClick={() => openTrend(record)}>
          {$t('page.manage.monitor.service.trend')}
        </Button>
        {skywalkingUrls.value[record.serviceName] && (
          <Button type="link" size="small" href={skywalkingUrls.value[record.serviceName]} target="_blank">
            SkyWalking
          </Button>
        )}
      </div>
    )
  }
]);

async function loadServices() {
  loading.value = true;
  try {
    const { data, error } = await fetchGetServiceList();
    services.value = error || !data ? [] : data;
    // 逐个取 SkyWalking 链接（未配置返回空串，前端隐藏入口）
    services.value.forEach(item => {
      fetchGetSkywalkingUrl(item.serviceName).then(({ data: url }) => {
        skywalkingUrls.value[item.serviceName] = url ?? '';
      });
    });
  } finally {
    loading.value = false;
  }
}

// ==================== 实例明细 ====================

const instancesVisible = ref(false);
const instancesLoading = ref(false);
const activeService = ref<Api.Monitor.ServiceSummary | null>(null);
const instances = ref<Api.Monitor.ServiceInstance[]>([]);

function serviceInstanceRowKey(record: Api.Monitor.ServiceInstance) {
  return `${record.ip}:${record.port}`;
}

const instanceColumns = computed(() => [
  {
    key: 'addr',
    title: $t('page.manage.monitor.service.addr'),
    width: 170,
    customRender: ({ record }: { record: Api.Monitor.ServiceInstance }) => `${record.ip}:${record.port}`
  },
  {
    key: 'healthy',
    dataIndex: 'healthy',
    title: $t('page.manage.monitor.service.healthy'),
    width: 100,
    customRender: ({ record }: { record: Api.Monitor.ServiceInstance }) => (
      <Tag color={record.healthy ? 'success' : 'error'}>{record.healthy ? 'Y' : 'N'}</Tag>
    )
  },
  {
    key: 'actuatorHealth',
    dataIndex: 'actuatorHealth',
    title: 'Actuator',
    width: 120,
    customRender: ({ record }: { record: Api.Monitor.ServiceInstance }) => (
      <Tag color={record.actuatorHealth === 'UP' ? 'success' : 'error'}>{record.actuatorHealth ?? '-'}</Tag>
    )
  },
  { key: 'weight', dataIndex: 'weight', title: $t('page.manage.monitor.service.weight'), width: 90 },
  {
    key: 'metadata',
    dataIndex: 'metadata',
    title: 'Metadata',
    ellipsis: true,
    customRender: ({ record }: { record: Api.Monitor.ServiceInstance }) => JSON.stringify(record.metadata ?? {})
  },
  {
    key: 'operate',
    title: $t('common.operate'),
    width: 120,
    customRender: ({ record }: { record: Api.Monitor.ServiceInstance }) =>
      hasAuth('monitor:service:logger') && (
        <Button size="small" onClick={() => openLoggerModal(record)}>
          {$t('page.manage.monitor.service.logger')}
        </Button>
      )
  }
]);

async function openInstances(record: Api.Monitor.ServiceSummary) {
  activeService.value = record;
  instancesVisible.value = true;
  instancesLoading.value = true;
  try {
    const { data, error } = await fetchGetServiceInstances(record.serviceName);
    instances.value = error || !data ? [] : data;
  } finally {
    instancesLoading.value = false;
  }
}

// ==================== 日志级别调整（高危） ====================

const loggerFormVisible = ref(false);
const loggerConfirmVisible = ref(false);
const loggerInstance = ref<Api.Monitor.ServiceInstance | null>(null);
const loggerName = ref('');
const loggerLevel = ref('INFO');
const loggerTtl = ref(600);

const levelOptions = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'OFF'].map(value => ({ label: value, value }));

const loggerAddr = computed(() =>
  loggerInstance.value ? `${loggerInstance.value.ip}:${loggerInstance.value.port}` : ''
);

const loggerDescription = computed(() =>
  $t('page.manage.monitor.service.loggerDesc', {
    addr: loggerAddr.value,
    logger: loggerName.value,
    level: loggerLevel.value,
    ttl: loggerTtl.value
  })
);

function openLoggerModal(record: Api.Monitor.ServiceInstance) {
  loggerInstance.value = record;
  loggerName.value = '';
  loggerLevel.value = 'INFO';
  loggerTtl.value = 600;
  loggerFormVisible.value = true;
}

function openLoggerConfirm() {
  if (!loggerName.value.trim()) {
    window.$message?.warning?.($t('page.manage.monitor.service.form.loggerName'));
    return;
  }
  loggerFormVisible.value = false;
  loggerConfirmVisible.value = true;
}

async function issueLoggerToken(): Promise<string | null> {
  if (!activeService.value?.instanceId || !loggerInstance.value) {
    return null;
  }
  // 操作摘要与 ServiceMonitorServiceImpl 消费端保持一致：service:logger:{service}:{addr}:{logger}:{LEVEL}
  const operation = `service:logger:${activeService.value.serviceName}:${loggerAddr.value}:${loggerName.value}:${loggerLevel.value.toUpperCase()}`;
  const { data, error } = await issueConfirmToken(activeService.value.instanceId, operation);
  if (error || !data) {
    return null;
  }
  return data.token;
}

async function submitLogger(token: string): Promise<boolean> {
  if (!activeService.value) {
    return false;
  }
  const { error } = await fetchUpdateServiceLogger(
    activeService.value.serviceName,
    {
      instanceAddr: loggerAddr.value,
      loggerName: loggerName.value,
      level: loggerLevel.value,
      ttlSeconds: loggerTtl.value
    },
    token
  );
  if (error) {
    window.$message?.error?.($t('common.updateFailed'));
    return false;
  }
  window.$message?.success?.($t('common.updateSuccess'));
  return true;
}

// ==================== 指标趋势 ====================

const trendVisible = ref(false);
const trendServiceName = ref('');
const trendChartRef = ref<InstanceType<typeof MetricRangeChart>>();

/** 趋势指标元数据：中文名 + y 轴单位 + 含义说明（语言切换后实时取文案） */
const trendMetrics = computed(() => [
  {
    value: 'service.health',
    label: $t('page.manage.monitor.service.metricHealth'),
    unit: '',
    formatter: undefined as ((value: number) => string) | undefined,
    desc: $t('page.manage.monitor.service.descMetricHealth')
  },
  {
    value: 'service.instance.healthy.count',
    label: $t('page.manage.monitor.service.metricHealthyCount'),
    unit: $t('page.manage.monitor.dbMetrics.unitConn'),
    formatter: undefined as ((value: number) => string) | undefined,
    desc: $t('page.manage.monitor.service.descMetricHealthyCount')
  },
  {
    value: 'service.jvm.memory.used',
    label: $t('page.manage.monitor.service.metricJvmMemory'),
    unit: '',
    formatter: formatBytes,
    desc: $t('page.manage.monitor.service.descMetricJvmMemory')
  },
  {
    value: 'service.jvm.threads.live',
    label: $t('page.manage.monitor.service.metricJvmThreads'),
    unit: $t('page.manage.monitor.dbMetrics.unitConn'),
    formatter: undefined as ((value: number) => string) | undefined,
    desc: $t('page.manage.monitor.service.descMetricJvmThreads')
  }
]);

const trendMetricOptions = computed(() => trendMetrics.value.map(item => ({ label: item.label, value: item.value })));

const trendMetric = ref('service.health');

const activeTrendMetric = computed(() => trendMetrics.value.find(item => item.value === trendMetric.value));

async function loadServiceTrend(range: string) {
  if (!trendServiceName.value) {
    return [];
  }
  const { data, error } = await fetchGetServiceMetricHistory(trendServiceName.value, {
    metric: trendMetric.value,
    range
  });
  if (error || !data) {
    return [];
  }
  return [{ name: activeTrendMetric.value?.label ?? trendMetric.value, points: data }];
}

function openTrend(record: Api.Monitor.ServiceSummary) {
  trendServiceName.value = record.serviceName;
  trendVisible.value = true;
}

function handleTrendMetricChange() {
  trendChartRef.value?.reload();
}

onMounted(() => {
  loadServices();
});
</script>

<template>
  <div class="flex-col-stretch gap-16px overflow-auto">
    <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.monitor.service.title')">
      <template #extra>
        <AButton size="small" :loading="loading" @click="loadServices">{{ $t('common.refresh') }}</AButton>
      </template>
      <ATable
        :columns="serviceColumns"
        :data-source="services"
        size="small"
        :loading="loading"
        row-key="serviceName"
        :scroll="{ x: 1000 }"
        :pagination="{ pageSize: 20 }"
      />
    </ACard>

    <ADrawer
      v-model:open="instancesVisible"
      :title="$t('page.manage.monitor.service.instancesTitle', { name: activeService?.serviceName ?? '' })"
      :width="860"
    >
      <ATable
        :columns="instanceColumns"
        :data-source="instances"
        size="small"
        :loading="instancesLoading"
        :row-key="serviceInstanceRowKey"
        :scroll="{ x: 800 }"
        :pagination="false"
      />
    </ADrawer>

    <AModal v-model:open="trendVisible" :title="trendServiceName" :width="860" :footer="null">
      <div class="mb-12px flex-y-center gap-12px">
        <ASelect
          v-model:value="trendMetric"
          :options="trendMetricOptions"
          class="w-280px"
          @change="handleTrendMetricChange"
        />
      </div>
      <MetricRangeChart
        v-if="trendVisible"
        ref="trendChartRef"
        :load="loadServiceTrend"
        :title="activeTrendMetric?.label"
        :unit="activeTrendMetric?.unit"
        :value-formatter="activeTrendMetric?.formatter"
        :description="activeTrendMetric?.desc"
      />
    </AModal>

    <AModal v-model:open="loggerFormVisible" :title="$t('page.manage.monitor.service.logger')" :width="480">
      <AForm layout="vertical">
        <AFormItem :label="$t('page.manage.monitor.service.addr')">
          <AInput :value="loggerAddr" disabled />
        </AFormItem>
        <AFormItem :label="$t('page.manage.monitor.service.loggerName')" required>
          <AInput
            v-model:value="loggerName"
            :maxlength="200"
            :placeholder="$t('page.manage.monitor.service.form.loggerName')"
          />
        </AFormItem>
        <AFormItem :label="$t('page.manage.monitor.service.level')" required>
          <ASelect v-model:value="loggerLevel" :options="levelOptions" />
        </AFormItem>
        <AFormItem :label="$t('page.manage.monitor.service.ttl')" required>
          <AInputNumber v-model:value="loggerTtl" :min="60" :max="86400" class="w-full" />
        </AFormItem>
      </AForm>
      <template #footer>
        <div class="flex-y-center justify-end gap-12px">
          <AButton @click="loggerFormVisible = false">{{ $t('common.cancel') }}</AButton>
          <AButton danger type="primary" @click="openLoggerConfirm">{{ $t('common.confirm') }}</AButton>
        </div>
      </template>
    </AModal>

    <ConfirmDangerModal
      v-model:visible="loggerConfirmVisible"
      :title="$t('page.manage.monitor.service.logger')"
      :description="loggerDescription"
      :confirm-text="loggerAddr"
      :issue-token="issueLoggerToken"
      :submit="submitLogger"
    />
  </div>
</template>

<style scoped></style>
