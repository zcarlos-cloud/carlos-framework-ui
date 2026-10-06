<script setup lang="ts">
import { computed } from 'vue';
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'DevkitRecordSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Devkit.GenerateRecordSearchParams>('model', { required: true });

const bizTypeOptions = enumDictOptions('devkit', 'DevkitTemplateType');
const statusOptions = enumDictOptions('devkit', 'DevkitStatus');

/** 数字码 ↔ 字符串选项值桥接（antd Select 按严格相等匹配） */
const bizTypeValue = computed<string | undefined>({
  get() {
    return model.value.bizType === undefined ? undefined : String(model.value.bizType);
  },
  set(value) {
    model.value.bizType = value === undefined ? undefined : (Number(value) as Api.Devkit.TemplateType);
  }
});

const statusValue = computed<string | undefined>({
  get() {
    return model.value.status === undefined ? undefined : String(model.value.status);
  },
  set(value) {
    model.value.status = value === undefined ? undefined : (Number(value) as Api.Devkit.Status);
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
          <AFormItem :label="$t('page.devkit.record.bizType')" name="bizType" class="m-0">
            <ASelect
              v-model:value="bizTypeValue"
              :placeholder="$t('page.devkit.record.form.bizType')"
              :options="bizTypeOptions"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.devkit.record.projectName')" name="projectName" class="m-0">
            <AInput
              v-model:value="model.projectName"
              :placeholder="$t('page.devkit.record.form.projectName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.devkit.record.status')" name="status" class="m-0">
            <ASelect
              v-model:value="statusValue"
              :placeholder="$t('page.devkit.record.form.status')"
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
