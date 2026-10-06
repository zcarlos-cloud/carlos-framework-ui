<script setup lang="ts">
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'MineSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

/** 与「我发起的」列表共用同一份分页参数（后端 `ApiWorkflowInstancePageParam`） */
const model = defineModel<Api.Workflow.WorkflowInstanceSearchParams>('model', { required: true });

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
          <AFormItem :label="$t('page.workflow.mine.flowName')" name="flowName" class="m-0">
            <!-- 后端 flowName 取自流程定义，是 like 模糊匹配 -->
            <AInput v-model:value="model.flowName" :placeholder="$t('page.workflow.mine.form.flowName')" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.workflow.mine.flowStatus')" name="flowStatus" class="m-0">
            <!-- 选项由后端枚举字典驱动（父页 ensureEnumDict('workflow')），本组件不请求数据 -->
            <ASelect
              v-model:value="model.flowStatus"
              :placeholder="$t('page.workflow.mine.form.flowStatus')"
              :options="enumDictOptions('workflow', 'WorkflowFlowStatus')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.workflow.mine.businessId')" name="businessId" class="m-0">
            <!-- 业务单号是等值匹配（后端不像流程名那样做 like），故提示里写明「精确」 -->
            <AInput
              v-model:value="model.businessId"
              :placeholder="$t('page.workflow.mine.form.businessId')"
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
