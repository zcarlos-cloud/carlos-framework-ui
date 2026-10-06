<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Tag } from 'ant-design-vue';
import { fetchGetJobLogDetail } from '@/service/api';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';

defineOptions({
  name: 'JobLogDetailDrawer'
});

ensureEnumDict('job');

interface Props {
  /** 待查看的执行日志主键（Long 字符串） */
  id: string;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const loading = ref(false);
const detail = ref<Api.Job.ExecutionLog | null>(null);

/** 空值统一显示为短横线，避免 Descriptions 出现空白格 */
const EMPTY_TEXT = '-';

function text(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') {
    return EMPTY_TEXT;
  }

  return String(value);
}

const items = computed(() => {
  const record = detail.value;

  if (!record) {
    return [];
  }

  return [
    { key: 'id', label: 'ID', value: text(record.id) },
    { key: 'jobName', label: $t('page.manage.job.jobName'), value: text(record.jobName) },
    { key: 'jobGroup', label: $t('page.manage.job.jobGroup'), value: text(record.jobGroup) },
    { key: 'serviceName', label: $t('page.manage.job.serviceName'), value: text(record.serviceName) },
    { key: 'handlerName', label: $t('page.manage.job.handlerName'), value: text(record.handlerName) },
    {
      key: 'triggerType',
      label: $t('page.manage.jobLog.triggerType'),
      value: enumDictText('job', 'JobTriggerType', record.triggerType)
    },
    { key: 'cronExpression', label: $t('page.manage.job.cronExpression'), value: text(record.cronExpression) },
    { key: 'startTime', label: $t('page.manage.jobLog.startTime'), value: formatDateTime(record.startTime) },
    { key: 'endTime', label: $t('page.manage.jobLog.endTime'), value: formatDateTime(record.endTime) },
    { key: 'durationMs', label: $t('page.manage.jobLog.durationMs'), value: text(record.durationMs) },
    { key: 'serverNode', label: $t('page.manage.jobLog.serverNode'), value: text(record.serverNode) }
  ];
});

async function loadDetail() {
  if (!props.id) {
    return;
  }

  loading.value = true;
  try {
    const { data, error } = await fetchGetJobLogDetail(props.id);

    if (error) {
      // 静默 return 会让用户面对一个无反馈的空抽屉
      window.$message?.error?.($t('page.manage.jobLog.detailFailed'));
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
  <ADrawer v-model:open="visible" :title="$t('page.manage.jobLog.detail')" :width="560">
    <ASpin :spinning="loading">
      <div v-if="detail" class="flex flex-col gap-16px">
        <ADescriptions :column="1" size="small" bordered>
          <ADescriptionsItem v-for="item in items" :key="item.key" :label="item.label">
            {{ item.value }}
          </ADescriptionsItem>
          <ADescriptionsItem :label="$t('page.manage.jobLog.status')">
            <Tag :color="enumDictColor('job', 'JobExecutionStatus', detail.status)">
              {{ enumDictText('job', 'JobExecutionStatus', detail.status) }}
            </Tag>
          </ADescriptionsItem>
        </ADescriptions>
        <!-- 失败原因/结果说明可能很长（堆栈摘要），独立成块并保留换行 -->
        <div>
          <div class="mb-4px font-medium">{{ $t('page.manage.jobLog.resultMessage') }}</div>
          <pre class="whitespace-pre-wrap break-all text-12px">{{ text(detail.resultMessage) }}</pre>
        </div>
      </div>
    </ASpin>
  </ADrawer>
</template>

<style scoped></style>
