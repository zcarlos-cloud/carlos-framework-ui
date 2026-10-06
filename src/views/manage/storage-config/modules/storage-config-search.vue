<script setup lang="ts">
import { storageTypeOptions } from '@/constants/business';
import { translateOptions } from '@/utils/common';
import { $t } from '@/locales';

defineOptions({
  name: 'StorageConfigSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.SystemManage.StorageConfigSearchParams>('model', { required: true });

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
          <AFormItem :label="$t('page.manage.storageConfig.configName')" name="configName" class="m-0">
            <AInput
              v-model:value="model.configName"
              :placeholder="$t('page.manage.storageConfig.form.configName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.storageConfig.storageType')" name="storageType" class="m-0">
            <ASelect
              v-model:value="model.storageType"
              :placeholder="$t('page.manage.storageConfig.form.storageType')"
              :options="translateOptions(storageTypeOptions)"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.common.statusTitle')" name="configStatus" class="m-0">
            <!-- configStatus 后端为 Integer 0/1，不是 boolean，故直接用数字选项 -->
            <ASelect v-model:value="model.configStatus" :placeholder="$t('common.pleaseCheckValue')" allow-clear>
              <ASelectOption :value="1">{{ $t('page.manage.common.status.enable') }}</ASelectOption>
              <ASelectOption :value="0">{{ $t('page.manage.common.status.disable') }}</ASelectOption>
            </ASelect>
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
