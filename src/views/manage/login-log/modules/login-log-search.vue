<script setup lang="ts">
import { computed } from 'vue';
import { DatePicker } from 'ant-design-vue';
import { loginLogAuthTypeOptions, loginLogStatusOptions } from '@/constants/business';
import { $t } from '@/locales';

defineOptions({
  name: 'LoginLogSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Auth.LoginLogSearchParams>('model', { required: true });

/**
 * RangePicker 绑定的是 [start, end] 字符串数组，
 * 而后端接收的是两个独立字段 startTime / endTime，故在此做双向映射。
 *
 * value-format 输出 ISO-8601（不带时区），与后端 LocalDateTime 的 Jackson 默认反序列化格式一致。
 */
const timeRange = computed<[string, string] | undefined>({
  get() {
    const { startTime, endTime } = model.value;

    return startTime && endTime ? [startTime, endTime] : undefined;
  },
  set(value) {
    model.value.startTime = value?.[0];
    model.value.endTime = value?.[1];
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
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.loginLog.username')" name="username" class="m-0">
            <AInput
              v-model:value="model.username"
              :placeholder="$t('page.manage.loginLog.form.username')"
              allow-clear
              @press-enter="search"
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.loginLog.logStatus')" name="logStatus" class="m-0">
            <ASelect
              v-model:value="model.logStatus"
              :placeholder="$t('page.manage.loginLog.form.logStatus')"
              allow-clear
            >
              <ASelectOption v-for="option in loginLogStatusOptions" :key="option.value" :value="option.value">
                {{ $t(option.label) }}
              </ASelectOption>
            </ASelect>
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.loginLog.ip')" name="ip" class="m-0">
            <AInput
              v-model:value="model.ip"
              :placeholder="$t('page.manage.loginLog.form.ip')"
              allow-clear
              @press-enter="search"
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.loginLog.authType')" name="authType" class="m-0">
            <ASelect v-model:value="model.authType" :placeholder="$t('page.manage.loginLog.form.authType')" allow-clear>
              <ASelectOption v-for="option in loginLogAuthTypeOptions" :key="option.value" :value="option.value">
                {{ $t(option.label) }}
              </ASelectOption>
            </ASelect>
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="8">
          <AFormItem :label="$t('page.manage.loginLog.loginTime')" class="m-0">
            <!-- eslint-disable-next-line vue/component-name-in-template-casing -- RangePicker 是 antd 的嵌套组件，点号命名无法满足 PascalCase -->
            <DatePicker.RangePicker
              v-model:value="timeRange"
              show-time
              value-format="YYYY-MM-DDTHH:mm:ss"
              class="w-full"
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
