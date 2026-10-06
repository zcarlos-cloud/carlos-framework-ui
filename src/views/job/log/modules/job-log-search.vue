<script setup lang="ts">
import { computed } from 'vue';
import { DatePicker } from 'ant-design-vue';
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'JobLogSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Job.LogSearchParams>('model', { required: true });

/** 执行状态选项（数字码）：字典直驱（label 已本地化），转回数字以匹配 number 模型 */
const statusOptions = computed(() =>
  enumDictOptions('job', 'JobExecutionStatus').map(option => ({ ...option, value: Number(option.value) }))
);

/**
 * RangePicker 绑定 [start, end] 字符串数组，后端接收两个独立字段 start / end（作用于 start_time）。
 *
 * value-format 输出 ISO-8601（不带时区），与后端 LocalDateTime 的 Jackson 默认反序列化格式一致。
 */
const timeRange = computed<[string, string] | undefined>({
  get() {
    const { start, end } = model.value;

    return start && end ? [start, end] : undefined;
  },
  set(value) {
    model.value.start = value?.[0];
    model.value.end = value?.[1];
  }
});

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
        <ACol :span="24" :md="12" :lg="8">
          <AFormItem :label="$t('page.manage.jobLog.startTime')" name="timeRange" class="m-0">
            <!-- eslint-disable-next-line vue/component-name-in-template-casing -- RangePicker 是 antd 的嵌套组件，点号命名无法满足 PascalCase -->
            <DatePicker.RangePicker
              v-model:value="timeRange"
              class="w-full"
              show-time
              value-format="YYYY-MM-DDTHH:mm:ss"
              :placeholder="[$t('page.manage.jobLog.form.start'), $t('page.manage.jobLog.form.end')]"
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.manage.job.jobName')" name="jobName" class="m-0">
            <AInput v-model:value="model.jobName" :placeholder="$t('page.manage.job.form.jobName')" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.manage.job.serviceName')" name="serviceName" class="m-0">
            <AInput
              v-model:value="model.serviceName"
              :placeholder="$t('page.manage.job.form.serviceName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.manage.job.handlerName')" name="handlerName" class="m-0">
            <AInput
              v-model:value="model.handlerName"
              :placeholder="$t('page.manage.job.form.handlerName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.manage.jobLog.status')" name="status" class="m-0">
            <ASelect
              v-model:value="model.status"
              :placeholder="$t('page.manage.jobLog.form.status')"
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
