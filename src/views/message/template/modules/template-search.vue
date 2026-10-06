<script setup lang="ts">
import { computed } from 'vue';
import { DatePicker } from 'ant-design-vue';
import { $t } from '@/locales';

defineOptions({
  name: 'TemplateSearch'
});

interface Props {
  /**
   * 所属类型下拉项（`typeId → typeName`），由 `index.vue` 拉取后传入
   *
   * ⚠️ 搜索组件**不自己发请求**（SKILL 的约定：`*-search.vue` 只做表单与 emit）。
   * 这份选项与列表列的类型名称映射同源，所以放在 `index.vue` 里拉一次。
   */
  typeOptions?: CommonType.Option<string, string>[];
}

const props = defineProps<Props>();

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Message.TemplateSearchParams>('model', { required: true });

/**
 * 启用状态下拉
 *
 * 后端的 `enabled` 是 **Boolean**（不是渠道那种 0/1/2 数字码），而 antd 的
 * `SelectValue` 只接受 `string | number`，装不下布尔值，所以选项值用字符串，
 * 再用下面这层 computed 与 model 的布尔值做双向转换。
 * `translateOptions` 也走不通（入参签名是 `Option<string>[]`）。
 */
const ENABLED_TRUE = 'true';
const ENABLED_FALSE = 'false';

const enabledOptions = computed(() => [
  { label: $t('page.message.common.enabled'), value: ENABLED_TRUE },
  { label: $t('page.message.common.disabled'), value: ENABLED_FALSE }
]);

const enabledValue = computed<string | undefined>({
  get() {
    return model.value.enabled === undefined ? undefined : String(model.value.enabled);
  },
  set(value) {
    model.value.enabled = value === undefined ? undefined : value === ENABLED_TRUE;
  }
});

/**
 * 创建时间区间
 *
 * RangePicker 绑定的是 [start, end] 字符串数组，而后端 `MessageTemplatePageParam`
 * 接收的是两个独立字段 start / end（作用于 create_time），故在此做双向映射。
 */
const createdRange = computed<[string, string] | undefined>({
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
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.common.templateCode')" name="templateCode" class="m-0">
            <!-- 模板编码是 like 模糊匹配，可以只填片段 -->
            <AInput
              v-model:value="model.templateCode"
              :placeholder="$t('page.message.template.form.templateCode')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.template.templateName')" name="templateName" class="m-0">
            <AInput
              v-model:value="model.templateName"
              :placeholder="$t('page.message.template.form.templateName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.template.typeId')" name="typeId" class="m-0">
            <ASelect
              v-model:value="model.typeId"
              :placeholder="$t('page.message.template.form.typeId')"
              :options="props.typeOptions ?? []"
              allow-clear
              show-search
              option-filter-prop="label"
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.template.enabled')" name="enabled" class="m-0">
            <ASelect
              v-model:value="enabledValue"
              :placeholder="$t('page.message.template.form.enabled')"
              :options="enabledOptions"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.common.createTime')" name="createdRange" class="m-0">
            <!-- eslint-disable-next-line vue/component-name-in-template-casing -- RangePicker 是 antd 的嵌套组件，点号命名无法满足 PascalCase -->
            <DatePicker.RangePicker
              v-model:value="createdRange"
              class="w-full"
              show-time
              value-format="YYYY-MM-DDTHH:mm:ss"
              :placeholder="[$t('page.message.template.form.startTime'), $t('page.message.template.form.endTime')]"
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
