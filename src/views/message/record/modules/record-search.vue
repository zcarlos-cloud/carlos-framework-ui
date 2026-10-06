<script setup lang="ts">
import { computed } from 'vue';
import { DatePicker } from 'ant-design-vue';
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'RecordSearch'
});

interface Props {
  /**
   * 消息类型下拉项（`code → name`），由 `index.vue` 拉取后传入
   *
   * ⚠️ 搜索组件**不自己发请求**（SKILL 的约定：`*-search.vue` 只做表单与 emit）。
   * 类型选项与列表列的名称映射共用同一份数据源，所以放在 `index.vue` 里拉。
   */
  typeOptions?: CommonType.Option<string, string>[];
}

const props = defineProps<Props>();

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Message.RecordSearchParams>('model', { required: true });

/**
 * 创建时间区间
 *
 * RangePicker 绑定的是 [start, end] 字符串数组，而后端 `MessageRecordPageParam`
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
          <AFormItem :label="$t('page.message.common.messageId')" name="messageId" class="m-0">
            <!-- 后端 messageId 是 eq 精确匹配，不是模糊 -->
            <AInput
              v-model:value="model.messageId"
              :placeholder="$t('page.message.record.form.messageId')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.record.messageTitle')" name="messageTitle" class="m-0">
            <!-- 标题是 like 模糊匹配，可以只填片段 -->
            <AInput
              v-model:value="model.messageTitle"
              :placeholder="$t('page.message.record.form.messageTitle')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.record.messageType')" name="messageType" class="m-0">
            <!--
              类型必须是 code → name 的下拉：后端 messageType 是 eq 精确匹配类型编码，
              手输错一个字符只会得到零行、且没有任何反馈。
            -->
            <ASelect
              v-model:value="model.messageType"
              :placeholder="$t('page.message.record.form.messageType')"
              :options="props.typeOptions ?? []"
              allow-clear
              show-search
              option-filter-prop="label"
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.record.priority')" name="priority" class="m-0">
            <ASelect
              v-model:value="model.priority"
              :placeholder="$t('page.message.record.form.priority')"
              :options="enumDictOptions('message', 'MessagePriority')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.record.senderSystem')" name="senderSystem" class="m-0">
            <!-- 后端 senderSystem 是 eq 精确匹配 -->
            <AInput
              v-model:value="model.senderSystem"
              :placeholder="$t('page.message.record.form.senderSystem')"
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
              :placeholder="[$t('page.message.record.form.startTime'), $t('page.message.record.form.endTime')]"
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
