<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchGetAllGroups } from '@/service/api';
import { $t } from '@/locales';

defineOptions({
  name: 'MonitorInstanceSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Monitor.InstanceSearchParams>('model', { required: true });

const groupOptions = ref<{ label: string; value: string }[]>([]);

const typeOptions = computed(() => [
  { label: $t('page.manage.monitor.common.typeRedisStandalone'), value: 'REDIS_STANDALONE' },
  { label: $t('page.manage.monitor.common.typeRedisCluster'), value: 'REDIS_CLUSTER' },
  { label: $t('page.manage.monitor.common.typeRedisSentinel'), value: 'REDIS_SENTINEL' },
  { label: $t('page.manage.monitor.common.typePostgresql'), value: 'POSTGRESQL' },
  { label: $t('page.manage.monitor.common.typeMysql'), value: 'MYSQL' },
  { label: $t('page.manage.monitor.common.typeDm'), value: 'DM' },
  { label: $t('page.manage.monitor.common.typeClickhouse'), value: 'CLICKHOUSE' },
  { label: $t('page.manage.monitor.common.typeMicroservice'), value: 'MICROSERVICE' }
]);

const envOptions = computed(() => [
  { label: 'dev', value: 'dev' },
  { label: 'test', value: 'test' },
  { label: 'prod', value: 'prod' }
]);

const healthOptions = computed(() => [
  { label: $t('page.manage.monitor.common.healthUp'), value: 'UP' },
  { label: $t('page.manage.monitor.common.healthDown'), value: 'DOWN' },
  { label: $t('page.manage.monitor.common.healthUnknown'), value: 'UNKNOWN' }
]);

async function loadGroups() {
  const { data, error } = await fetchGetAllGroups();
  if (error || !data) {
    return;
  }
  groupOptions.value = data.map(item => ({ label: item.groupName, value: item.id }));
}

/** 分组管理弹窗变更后由父组件触发刷新 */
defineExpose({ reloadGroups: loadGroups });

function reset() {
  emit('reset');
}

function search() {
  emit('search');
}

onMounted(() => {
  loadGroups();
});
</script>

<template>
  <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
    <AForm :model="model" :label-width="80">
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.monitor.instance.keyword')" name="keyword" class="m-0">
            <AInput v-model:value="model.keyword" :placeholder="$t('page.manage.monitor.instance.form.keyword')" />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.monitor.instance.instanceType')" name="instanceType" class="m-0">
            <ASelect
              v-model:value="model.instanceType"
              :options="typeOptions"
              :placeholder="$t('page.manage.monitor.instance.form.instanceType')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.monitor.instance.env')" name="env" class="m-0">
            <ASelect
              v-model:value="model.env"
              :options="envOptions"
              :placeholder="$t('page.manage.monitor.instance.form.env')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.monitor.instance.groupId')" name="groupId" class="m-0">
            <ASelect
              v-model:value="model.groupId"
              :options="groupOptions"
              :placeholder="$t('page.manage.monitor.instance.form.groupId')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.monitor.instance.healthStatus')" name="healthStatus" class="m-0">
            <ASelect
              v-model:value="model.healthStatus"
              :options="healthOptions"
              :placeholder="$t('page.manage.monitor.instance.form.healthStatus')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol flex="1">
          <AFormItem class="m-0">
            <div class="w-full flex-y-center justify-end gap-12px">
              <AButton @click="reset">
                <template #icon>
                  <icon-ic-round-refresh class="align-sub text-icon" />
                </template>
                <span class="ml-8px">{{ $t('common.reset') }}</span>
              </AButton>
              <AButton type="primary" ghost @click="search">
                <template #icon>
                  <icon-ic-round-search class="align-sub text-icon" />
                </template>
                <span class="ml-8px">{{ $t('common.search') }}</span>
              </AButton>
            </div>
          </AFormItem>
        </ACol>
      </ARow>
    </AForm>
  </ACard>
</template>

<style scoped></style>
