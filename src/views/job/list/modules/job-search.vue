<script setup lang="ts">
import { computed } from 'vue';
import { ensureEnumDict, enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'JobSearch'
});

ensureEnumDict('job');

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Job.JobSearchParams>('model', { required: true });

/** 状态筛选（Quartz Trigger 状态字符串）：字典直驱，码值即常量名 */
const statusOptions = computed(() => enumDictOptions('job', 'JobStatus'));

function reset() {
  emit('reset');
}

function search() {
  emit('search');
}
</script>

<template>
  <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
    <AForm :model="model" :label-width="80">
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.job.jobName')" name="jobName" class="m-0">
            <AInput v-model:value="model.jobName" :placeholder="$t('page.manage.job.form.jobName')" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.job.serviceName')" name="serviceName" class="m-0">
            <AInput
              v-model:value="model.serviceName"
              :placeholder="$t('page.manage.job.form.serviceName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.job.handlerName')" name="handlerName" class="m-0">
            <AInput
              v-model:value="model.handlerName"
              :placeholder="$t('page.manage.job.form.handlerName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.job.status')" name="status" class="m-0">
            <ASelect
              v-model:value="model.status"
              :placeholder="$t('page.manage.job.form.status')"
              :options="statusOptions"
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
