<script setup lang="ts">
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'RegionSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.SystemManage.RegionSearchParams>('model', { required: true });

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
          <AFormItem :label="$t('page.manage.region.regionName')" name="regionName" class="m-0">
            <AInput
              v-model:value="model.regionName"
              :placeholder="$t('page.manage.region.form.regionName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.region.regionCode')" name="regionCode" class="m-0">
            <AInput
              v-model:value="model.regionCode"
              :placeholder="$t('page.manage.region.form.regionCode')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.region.regionType')" name="regionType" class="m-0">
            <!--
              regionType 是派生字段（后端按上级自动推导），但**筛选**是有效的：
              SysRegionPageParam.regionType 一直在，只是后端 getPage 此前完全没用它。
              裸 AInput 要求用户手敲 "3" 这种码值，故换成枚举下拉。
            -->
            <ASelect
              v-model:value="model.regionType"
              :placeholder="$t('page.manage.region.form.regionType')"
              :options="enumDictOptions('sys', 'SysRegionType')"
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
