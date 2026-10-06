<script setup lang="ts">
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'TodoSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Workflow.WorkflowTaskSearchParams>('model', { required: true });

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
          <AFormItem :label="$t('page.workflow.todo.nodeName')" name="nodeName" class="m-0">
            <!-- 后端 nodeName 是 like 模糊匹配 -->
            <AInput v-model:value="model.nodeName" :placeholder="$t('page.workflow.todo.form.nodeName')" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.workflow.todo.flowStatus')" name="flowStatus" class="m-0">
            <!-- 选项由后端枚举字典驱动（父页 ensureEnumDict('workflow')），本组件不请求数据 -->
            <ASelect
              v-model:value="model.flowStatus"
              :placeholder="$t('page.workflow.todo.form.flowStatus')"
              :options="enumDictOptions('workflow', 'WorkflowFlowStatus')"
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
