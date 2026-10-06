<script setup lang="ts">
import { computed } from 'vue';
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'DefinitionSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Workflow.WorkflowDefinitionSearchParams>('model', { required: true });

/**
 * isPublish 是数字编码（0/1/9），而字典选项的 value 统一为字符串，
 * 这里转回数字 —— antd Select 按严格相等匹配选项，类型不一致会导致选中后不回显。
 *
 * 必须做成 computed：字典是异步到达的（父页 ensureEnumDict），setup 期的普通常量
 * 只会拿到空数组快照、此后永不更新；模板内联调用 `enumDictOptions()` 才天然随字典重渲染。
 */
const publishStatusOptions = computed(() =>
  enumDictOptions('workflow', 'WorkflowPublishStatus').map(item => ({
    label: item.label,
    value: Number(item.value)
  }))
);

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
          <AFormItem :label="$t('page.workflow.definition.flowName')" name="flowName" class="m-0">
            <AInput
              v-model:value="model.flowName"
              :placeholder="$t('page.workflow.definition.form.flowName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.workflow.definition.flowCode')" name="flowCode" class="m-0">
            <AInput
              v-model:value="model.flowCode"
              :placeholder="$t('page.workflow.definition.form.flowCode')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <!-- 类别是流定义表上的自由文本（可选值来自后端 CategoryService SPI，尚未实现），故用输入框 -->
          <AFormItem :label="$t('page.workflow.definition.category')" name="category" class="m-0">
            <AInput
              v-model:value="model.category"
              :placeholder="$t('page.workflow.definition.form.category')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.workflow.definition.isPublish')" name="isPublish" class="m-0">
            <!-- 选项由后端枚举字典驱动（父页 ensureEnumDict('workflow')），本组件不请求数据 -->
            <ASelect
              v-model:value="model.isPublish"
              :placeholder="$t('page.workflow.definition.form.isPublish')"
              :options="publishStatusOptions"
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
