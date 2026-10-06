<script setup lang="tsx">
import { onMounted, ref } from 'vue';
import { Popconfirm, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import {
  fetchJobServices,
  fetchSchedulerMeta,
  fetchSchedulerNodes,
  fetchSchedulerPauseAll,
  fetchSchedulerResumeAll,
  fetchSchedulerStandby,
  fetchSchedulerStart,
  fetchServiceInstances
} from '@/service/api';
import { $t } from '@/locales';

defineOptions({
  name: 'JobExecutor'
});

const activeTab = ref<'nodes' | 'services'>('nodes');

/** 调度器元信息与全局控制 */
const meta = ref<Api.Job.SchedulerMeta>({});
const metaLoading = ref(false);
const operating = ref(false);

async function loadMeta() {
  metaLoading.value = true;
  try {
    const { data, error } = await fetchSchedulerMeta();
    if (!error && data) {
      meta.value = data;
    }
  } finally {
    metaLoading.value = false;
  }
}

/** 调度器全局控制（待机/启动/全部暂停/全部恢复），全部走二次确认 */
async function handleControl(action: 'standby' | 'start' | 'pauseAll' | 'resumeAll') {
  operating.value = true;
  try {
    const actionMap = {
      standby: fetchSchedulerStandby,
      start: fetchSchedulerStart,
      pauseAll: fetchSchedulerPauseAll,
      resumeAll: fetchSchedulerResumeAll
    };
    const { error } = await actionMap[action]();
    if (error) {
      window.$message?.error?.($t('page.manage.jobExecutor.operateFailed'));
      return;
    }
    window.$message?.success?.($t('page.manage.jobExecutor.operateSuccess'));
    await Promise.all([loadMeta(), loadNodes()]);
  } finally {
    operating.value = false;
  }
}

/** 调度器集群节点 */
const nodes = ref<Api.Job.SchedulerNode[]>([]);
const nodesLoading = ref(false);

async function loadNodes() {
  nodesLoading.value = true;
  try {
    const { data, error } = await fetchSchedulerNodes();
    if (!error) {
      nodes.value = data ?? [];
    }
  } finally {
    nodesLoading.value = false;
  }
}

/** 毫秒时间戳（字符串下发）格式化为本地时间 */
function formatCheckin(value?: string): string {
  const timestamp = Number(value ?? 0);
  if (!timestamp) {
    return '-';
  }
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

const nodeColumns = [
  {
    key: 'instanceId',
    dataIndex: 'instanceId',
    title: $t('page.manage.jobExecutor.instanceId'),
    align: 'center' as const
  },
  {
    key: 'lastCheckinTime',
    dataIndex: 'lastCheckinTime',
    title: $t('page.manage.jobExecutor.lastCheckinTime'),
    align: 'center' as const,
    customRender: ({ record }: { record: Api.Job.SchedulerNode }) => formatCheckin(record.lastCheckinTime)
  },
  {
    key: 'checkinInterval',
    dataIndex: 'checkinInterval',
    title: $t('page.manage.jobExecutor.checkinInterval'),
    align: 'center' as const
  },
  {
    key: 'alive',
    dataIndex: 'alive',
    title: $t('page.manage.jobExecutor.alive'),
    align: 'center' as const,
    customRender: ({ record }: { record: Api.Job.SchedulerNode }) => (
      <Tag color={record.alive ? 'success' : 'error'}>
        {record.alive ? $t('page.manage.jobExecutor.aliveYes') : $t('page.manage.jobExecutor.aliveNo')}
      </Tag>
    )
  }
];

/** 目标服务实例 */
const services = ref<string[]>([]);
const selectedService = ref<string>();
const instances = ref<Api.Job.ServiceInstance[]>([]);
const instancesLoading = ref(false);

async function loadServices() {
  const { data, error } = await fetchJobServices();
  if (!error) {
    services.value = data ?? [];
    // 默认选中第一个服务，少一次手动操作
    if (services.value.length > 0 && !selectedService.value) {
      selectedService.value = services.value[0];
      await loadInstances();
    }
  }
}

async function loadInstances() {
  if (!selectedService.value) {
    instances.value = [];
    return;
  }
  instancesLoading.value = true;
  try {
    const { data, error } = await fetchServiceInstances(selectedService.value);
    if (!error) {
      instances.value = data ?? [];
    }
  } finally {
    instancesLoading.value = false;
  }
}

const instanceColumns = [
  {
    key: 'instanceId',
    dataIndex: 'instanceId',
    title: $t('page.manage.jobExecutor.instanceId'),
    align: 'center' as const,
    ellipsis: true
  },
  { key: 'address', dataIndex: 'address', title: $t('page.manage.jobExecutor.address'), align: 'center' as const },
  {
    key: 'healthy',
    dataIndex: 'healthy',
    title: $t('page.manage.jobExecutor.healthy'),
    align: 'center' as const,
    customRender: ({ record }: { record: Api.Job.ServiceInstance }) => (
      <Tag color={record.healthy ? 'success' : 'error'}>
        {record.healthy ? $t('page.manage.jobExecutor.healthyYes') : $t('page.manage.jobExecutor.healthyNo')}
      </Tag>
    )
  }
];

onMounted(() => {
  loadMeta();
  loadNodes();
  loadServices();
});
</script>

<template>
  <div class="flex-col-stretch gap-16px overflow-auto">
    <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.jobExecutor.schedulerMeta')">
      <template #extra>
        <div class="flex-y-center gap-8px">
          <Popconfirm :title="$t('page.manage.jobExecutor.standbyConfirm')" @confirm="handleControl('standby')">
            <AButton size="small" :disabled="operating">{{ $t('page.manage.jobExecutor.standbyAction') }}</AButton>
          </Popconfirm>
          <Popconfirm :title="$t('page.manage.jobExecutor.startConfirm')" @confirm="handleControl('start')">
            <AButton size="small" type="primary" ghost :disabled="operating">
              {{ $t('page.manage.jobExecutor.startAction') }}
            </AButton>
          </Popconfirm>
          <Popconfirm :title="$t('page.manage.jobExecutor.pauseAllConfirm')" @confirm="handleControl('pauseAll')">
            <AButton size="small" danger :disabled="operating">{{ $t('page.manage.jobExecutor.pauseAll') }}</AButton>
          </Popconfirm>
          <Popconfirm :title="$t('page.manage.jobExecutor.resumeAllConfirm')" @confirm="handleControl('resumeAll')">
            <AButton size="small" type="primary" :disabled="operating">
              {{ $t('page.manage.jobExecutor.resumeAll') }}
            </AButton>
          </Popconfirm>
        </div>
      </template>
      <ASpin :spinning="metaLoading">
        <ADescriptions size="small" :column="{ xs: 1, sm: 2, lg: 4 }">
          <ADescriptionsItem :label="$t('page.manage.jobExecutor.schedulerName')">
            {{ meta.schedulerName || '-' }}
          </ADescriptionsItem>
          <ADescriptionsItem :label="$t('page.manage.jobExecutor.instanceId')">
            {{ meta.instanceId || '-' }}
          </ADescriptionsItem>
          <ADescriptionsItem :label="$t('page.manage.jobExecutor.clustered')">
            <Tag :color="meta.clustered ? 'success' : 'default'">
              {{ meta.clustered ? $t('page.manage.jobExecutor.yes') : $t('page.manage.jobExecutor.no') }}
            </Tag>
          </ADescriptionsItem>
          <ADescriptionsItem :label="$t('page.manage.jobExecutor.standby')">
            <Tag :color="meta.standby ? 'warning' : 'success'">
              {{ meta.standby ? $t('page.manage.jobExecutor.yes') : $t('page.manage.jobExecutor.no') }}
            </Tag>
          </ADescriptionsItem>
          <ADescriptionsItem :label="$t('page.manage.jobExecutor.runningSince')">
            {{ meta.runningSince || '-' }}
          </ADescriptionsItem>
          <ADescriptionsItem :label="$t('page.manage.jobExecutor.threadPoolSize')">
            {{ meta.threadPoolSize ?? '-' }}
          </ADescriptionsItem>
          <ADescriptionsItem :label="$t('page.manage.jobExecutor.executedJobCount')">
            {{ meta.executedJobCount ?? '-' }}
          </ADescriptionsItem>
          <ADescriptionsItem :label="$t('page.manage.jobExecutor.runningJobCount')">
            {{ meta.runningJobCount ?? '-' }}
          </ADescriptionsItem>
        </ADescriptions>
      </ASpin>
    </ACard>

    <ACard :bordered="false" class="card-wrapper" :title="$t('page.manage.jobExecutor.title')">
      <ATabs v-model:active-key="activeTab">
        <ATabPane key="nodes" :tab="$t('page.manage.jobExecutor.nodeTab')">
          <div class="mb-8px flex justify-end">
            <AButton size="small" :loading="nodesLoading" @click="loadNodes">{{ $t('common.refresh') }}</AButton>
          </div>
          <ATable
            :columns="nodeColumns"
            :data-source="nodes"
            size="small"
            :loading="nodesLoading"
            row-key="instanceId"
            :pagination="false"
          />
        </ATabPane>
        <ATabPane key="services" :tab="$t('page.manage.jobExecutor.serviceTab')">
          <div class="mb-8px flex-y-center gap-8px">
            <ASelect
              v-model:value="selectedService"
              :options="services.map(name => ({ label: name, value: name }))"
              :placeholder="$t('page.manage.jobExecutor.selectService')"
              class="w-320px"
              show-search
              @change="loadInstances"
            />
            <AButton size="small" :loading="instancesLoading" @click="loadInstances">
              {{ $t('common.refresh') }}
            </AButton>
          </div>
          <ATable
            :columns="instanceColumns"
            :data-source="instances"
            size="small"
            :loading="instancesLoading"
            row-key="instanceId"
            :pagination="false"
          />
        </ATabPane>
      </ATabs>
    </ACard>
  </div>
</template>

<style scoped></style>
