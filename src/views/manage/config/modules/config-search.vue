<script setup lang="ts">
import { computed } from 'vue';
import { configValueTypeOptions } from '@/constants/business';
import { translateOptions } from '@/utils/common';
import { $t } from '@/locales';

defineOptions({
  name: 'ConfigSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.SystemManage.SysConfigSearchParams>('model', { required: true });

/**
 * configStatus 在筛选栏里用 "Y"/"N" 表达
 *
 * antd 的 `SelectValue` 不接受布尔值（搜索栏用的是 `ASelect`），
 * 所以这里以 "Y"/"N" 承载，service 层再统一转成后端的 `Boolean`
 * （见 `src/service/api/system-config.ts` 的 `toQueryParams`）。
 *
 * **文案必须与表格列一致（启用 / 禁用）**：原先这里复用了通用的 `yesOrNoOptions`
 * （是 / 否），于是同一个字段在筛选框叫「是/否」、在列里叫「启用/禁用」，
 * 读起来像两个不同字段。
 */
const configStatusOptions = computed(() => [
  { value: 'Y', label: $t('page.manage.common.status.enable') },
  { value: 'N', label: $t('page.manage.common.status.disable') }
]);

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
          <AFormItem :label="$t('page.manage.config.configName')" name="configName" class="m-0">
            <AInput
              v-model:value="model.configName"
              :placeholder="$t('page.manage.config.form.configName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.config.configCode')" name="configCode" class="m-0">
            <AInput
              v-model:value="model.configCode"
              :placeholder="$t('page.manage.config.form.configCode')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.config.valueType')" name="valueType" class="m-0">
            <ASelect
              v-model:value="model.valueType"
              :placeholder="$t('page.manage.config.form.valueType')"
              :options="translateOptions(configValueTypeOptions)"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.config.configStatus')" name="configStatus" class="m-0">
            <ASelect
              v-model:value="model.configStatus"
              :placeholder="$t('page.manage.config.form.configStatus')"
              :options="configStatusOptions"
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
