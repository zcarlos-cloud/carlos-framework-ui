<script setup lang="ts">
import { computed } from 'vue';
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'DevkitTemplateGroupSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Devkit.TemplateGroupSearchParams>('model', { required: true });

const templateTypeOptions = enumDictOptions('devkit', 'DevkitTemplateType');
const statusOptions = enumDictOptions('devkit', 'DevkitStatus');

/**
 * 数字码 ↔ 字符串选项值的双向桥接
 *
 * 字典选项的 value 是字符串，而模型里是数字码，antd Select 按严格相等匹配 ——
 * 不归一的话预填与选中都会失效。两个字段各写一个 computed：
 * 用 `model[key]` 的联合键访问会被 TS 收窄成 never。
 */
const templateTypeValue = computed<string | undefined>({
  get() {
    return model.value.templateType === undefined ? undefined : String(model.value.templateType);
  },
  set(value) {
    model.value.templateType = value === undefined ? undefined : (Number(value) as Api.Devkit.TemplateType);
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
          <AFormItem :label="$t('page.devkit.template.groupName')" name="groupName" class="m-0">
            <AInput
              v-model:value="model.groupName"
              :placeholder="$t('page.devkit.template.form.groupName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.devkit.template.groupCode')" name="groupCode" class="m-0">
            <AInput
              v-model:value="model.groupCode"
              :placeholder="$t('page.devkit.template.form.groupCode')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.devkit.template.templateType')" name="templateType" class="m-0">
            <ASelect
              v-model:value="templateTypeValue"
              :placeholder="$t('page.devkit.template.form.templateType')"
              :options="templateTypeOptions"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.devkit.template.status')" name="status" class="m-0">
            <ASelect
              v-model:value="statusValue"
              :placeholder="$t('page.devkit.template.form.status')"
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
