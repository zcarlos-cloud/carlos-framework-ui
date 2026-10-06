<script setup lang="ts">
import { computed } from 'vue';
import { DatePicker } from 'ant-design-vue';
import { enumDictNameOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'AuditArchiveSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Audit.ArchiveSearchParams>('model', { required: true });

/**
 * RangePicker 绑定的是 [start, end] 字符串数组，而后端接收的是两个独立字段 start / end，
 * 故在此做双向映射。value-format 输出 ISO-8601，与后端 LocalDateTime 解析兼容。
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
    <AForm :model="model" :label-width="90">
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.audit.archive.archiveId')" name="archiveId" class="m-0">
            <AInput
              v-model:value="model.archiveId"
              :placeholder="$t('page.audit.archive.form.archiveId')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.archive.archiveStatus')" name="archiveStatus" class="m-0">
            <ASelect
              v-model:value="model.archiveStatus"
              :placeholder="$t('page.audit.archive.form.archiveStatus')"
              :options="enumDictNameOptions('audit', 'AuditLogArchiveState')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.archive.storageType')" name="storageType" class="m-0">
            <ASelect
              v-model:value="model.storageType"
              :placeholder="$t('page.audit.archive.form.storageType')"
              :options="enumDictNameOptions('audit', 'AuditLogStorageType')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.audit.archive.createdTime')" name="createdRange" class="m-0">
            <!-- eslint-disable-next-line vue/component-name-in-template-casing -- RangePicker 是 antd 的嵌套组件，点号命名无法满足 PascalCase -->
            <DatePicker.RangePicker
              v-model:value="createdRange"
              class="w-full"
              show-time
              value-format="YYYY-MM-DDTHH:mm:ss"
              :placeholder="[$t('page.audit.archive.form.startTime'), $t('page.audit.archive.form.endTime')]"
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
