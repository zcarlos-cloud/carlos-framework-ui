<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchGetDashboardSummary } from '@/service/api';
import { useRouterPush } from '@/hooks/common/router';
import { $t } from '@/locales';

defineOptions({
  name: 'MonitorOverview'
});

const { routerPushByKey } = useRouterPush();

const summary = ref<Api.Monitor.DashboardSummary | null>(null);
const loading = ref(false);

const alarmTotal = computed(() => summary.value?.alarmStats.reduce((total, item) => total + item.count, 0) ?? 0);

const stats = computed(() => [
  {
    key: 'total',
    label: $t('page.home.monitorTotal'),
    value: summary.value?.totalInstances ?? null,
    color: '#2563eb'
  },
  {
    key: 'up',
    label: $t('page.home.monitorUp'),
    value: summary.value?.upCount ?? null,
    color: '#16a34a'
  },
  {
    key: 'down',
    label: $t('page.home.monitorDown'),
    value: summary.value ? summary.value.downCount + summary.value.unknownCount : null,
    color: '#dc2626'
  },
  {
    key: 'alarm',
    label: $t('page.home.monitorAlarm'),
    value: summary.value ? alarmTotal.value : null,
    color: '#d97706'
  }
]);

async function loadSummary() {
  loading.value = true;
  try {
    const { data, error } = await fetchGetDashboardSummary();

    if (!error && data) {
      summary.value = data;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadSummary();
});
</script>

<template>
  <ACard :title="$t('page.home.monitorTitle')" :bordered="false" class="h-full card-wrapper">
    <template #extra>
      <AButton type="link" size="small" @click="routerPushByKey('manage_monitor_dashboard')">
        {{ $t('page.home.monitorLink') }}
      </AButton>
    </template>
    <ASpin :spinning="loading">
      <div class="grid grid-cols-2 gap-12px">
        <div
          v-for="item in stats"
          :key="item.key"
          class="border border-#0000000f rd-10px border-solid p-14px dark:border-#ffffff14"
        >
          <div class="flex-y-center gap-6px">
            <span class="size-8px rd-50%" :style="{ backgroundColor: item.color }" />
            <span class="text-12px text-#999 dark:text-#94a3b8">{{ item.label }}</span>
          </div>
          <div class="pt-8px text-24px font-semibold">
            <CountTo v-if="item.value !== null" :start-value="0" :end-value="item.value" />
            <span v-else>--</span>
          </div>
        </div>
      </div>
      <p v-if="!loading && !summary" class="pt-8px text-center text-12px text-#999 dark:text-#64748b">
        {{ $t('page.home.monitorEmpty') }}
      </p>
    </ASpin>
  </ACard>
</template>

<style scoped></style>
