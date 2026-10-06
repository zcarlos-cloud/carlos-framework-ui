<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Tag } from 'ant-design-vue';
import { loginLogAuthTypeRecord, loginLogStatusRecord, loginLogStatusTagColor } from '@/constants/business';
import { fetchGetLoginLogDetail } from '@/service/api';
import { enumTagColor, enumText, formatDateTime } from '@/utils/common';
import { $t } from '@/locales';

defineOptions({
  name: 'LoginLogDetailDrawer'
});

interface Props {
  /** 待查看的日志主键 */
  id: string;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const loading = ref(false);

const detail = ref<Api.Auth.LoginLogDetail | null>(null);

/** 空值统一显示为短横线，避免 Descriptions 出现空白格 */
const EMPTY_TEXT = '-';

function text(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') {
    return EMPTY_TEXT;
  }

  return String(value);
}

interface DetailItem {
  label: string;
  value: string;
}

interface DetailGroup {
  key: string;
  title: string;
  items: DetailItem[];
}

const groups = computed<DetailGroup[]>(() => {
  const record = detail.value;

  if (!record) {
    return [];
  }

  return [
    {
      key: 'basic',
      title: $t('page.manage.loginLog.group.basic'),
      items: [
        { label: $t('page.manage.loginLog.principalId'), value: text(record.principalId) },
        { label: $t('page.manage.loginLog.username'), value: text(record.username) },
        { label: $t('page.manage.loginLog.principalType'), value: text(record.principalType) },
        { label: $t('page.manage.loginLog.deptName'), value: text(record.deptName) },
        { label: $t('page.manage.loginLog.tenantId'), value: text(record.tenantId) },
        { label: $t('page.manage.loginLog.logStatus'), value: enumText(loginLogStatusRecord, record.logStatus) },
        { label: $t('page.manage.loginLog.loginTime'), value: text(formatDateTime(record.loginTime)) },
        { label: $t('page.manage.loginLog.clientTime'), value: text(formatDateTime(record.clientTime)) },
        { label: $t('page.manage.loginLog.serverTime'), value: text(formatDateTime(record.serverTime)) },
        { label: $t('page.manage.loginLog.durationMs'), value: text(record.durationMs) },
        { label: $t('page.manage.loginLog.riskLevel'), value: text(record.riskLevel) },
        { label: $t('page.manage.loginLog.resultCode'), value: text(record.resultCode) },
        { label: $t('page.manage.loginLog.resultMessage'), value: text(record.resultMessage) }
      ]
    },
    {
      key: 'client',
      title: $t('page.manage.loginLog.group.client'),
      items: [
        { label: $t('page.manage.loginLog.ip'), value: text(record.ip) },
        { label: $t('page.manage.loginLog.clientPort'), value: text(record.clientPort) },
        { label: $t('page.manage.loginLog.serverIp'), value: text(record.serverIp) },
        { label: $t('page.manage.loginLog.location'), value: text(record.location) },
        { label: $t('page.manage.onlineUser.userAgent'), value: text(record.userAgent) },
        { label: $t('page.manage.loginLog.deviceFingerprint'), value: text(record.deviceFingerprint) }
      ]
    },
    {
      key: 'auth',
      title: $t('page.manage.loginLog.group.auth'),
      items: [
        { label: $t('page.manage.loginLog.authType'), value: enumText(loginLogAuthTypeRecord, record.authType) },
        { label: $t('page.manage.loginLog.authProvider'), value: text(record.authProvider) },
        { label: $t('page.manage.loginLog.bizChannel'), value: text(record.bizChannel) }
      ]
    },
    {
      key: 'tech',
      title: $t('page.manage.loginLog.group.tech'),
      items: [
        { label: $t('page.manage.loginLog.traceId'), value: text(record.traceId) },
        { label: $t('page.manage.loginLog.appName'), value: text(record.appName) }
      ]
    }
  ];
});

async function loadDetail() {
  if (!props.id) {
    return;
  }

  loading.value = true;
  try {
    const { data, error } = await fetchGetLoginLogDetail(props.id);

    if (error) {
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
  <ADrawer v-model:open="visible" :title="$t('page.manage.loginLog.detailTitle')" :width="640">
    <ASpin :spinning="loading">
      <div v-if="detail" class="flex flex-col gap-16px">
        <div class="flex-y-center gap-8px">
          <Tag :color="enumTagColor(loginLogStatusTagColor, detail.logStatus)">
            {{ enumText(loginLogStatusRecord, detail.logStatus) }}
          </Tag>
          <Tag v-if="detail.authType" color="blue">{{ enumText(loginLogAuthTypeRecord, detail.authType) }}</Tag>
        </div>
        <ADescriptions v-for="group in groups" :key="group.key" :title="group.title" :column="2" size="small" bordered>
          <ADescriptionsItem v-for="item in group.items" :key="item.label" :label="item.label">
            {{ item.value }}
          </ADescriptionsItem>
        </ADescriptions>
      </div>
    </ASpin>
  </ADrawer>
</template>

<style scoped></style>
