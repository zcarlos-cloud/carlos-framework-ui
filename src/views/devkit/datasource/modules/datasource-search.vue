<script setup lang="ts">
import { computed } from 'vue';
import { enumDictNameOptions, enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'DevkitDatasourceSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Devkit.DataSourceSearchParams>('model', { required: true });

/** 数据库类型下拉：承载字段是 Java 枚举，JSON 下发常量名，故按名取值 */
const dbTypeOptions = enumDictNameOptions('devkit', 'DevkitDbType');

/** 状态下拉：承载字段是 Integer，JSON 下发数字码 */
const statusOptions = enumDictOptions('devkit', 'DevkitStatus');

/**
 * 状态双向桥接
 *
 * 字典选项的 value 是字符串，而 `status` 是数字码，antd Select 按严格相等匹配 ——
 * 不归一的话预填与选中都会失效。
 */
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
          <AFormItem :label="$t('page.devkit.datasource.dsName')" name="dsName" class="m-0">
            <AInput v-model:value="model.dsName" :placeholder="$t('page.devkit.datasource.form.dsName')" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.devkit.datasource.dbType')" name="dbType" class="m-0">
            <ASelect
              v-model:value="model.dbType"
              :placeholder="$t('page.devkit.datasource.form.dbType')"
              :options="dbTypeOptions"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.devkit.datasource.status')" name="status" class="m-0">
            <ASelect
              v-model:value="statusValue"
              :placeholder="$t('page.devkit.datasource.form.status')"
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
