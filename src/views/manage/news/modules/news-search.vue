<script setup lang="ts">
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'NewsSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.SystemManage.NewsSearchParams>('model', { required: true });

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
          <AFormItem :label="$t('page.manage.news.newsTitle')" name="title" class="m-0">
            <AInput v-model:value="model.title" :placeholder="$t('page.manage.news.form.newsTitle')" />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.news.newsType')" name="newsType" class="m-0">
            <ASelect v-model:value="model.newsType" :placeholder="$t('page.manage.news.form.newsType')" allow-clear>
              <ASelectOption
                v-for="option in enumDictOptions('sys', 'SysNewsType')"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </ASelectOption>
            </ASelect>
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.news.status')" name="status" class="m-0">
            <ASelect v-model:value="model.status" :placeholder="$t('page.manage.news.status')" allow-clear>
              <ASelectOption
                v-for="option in enumDictOptions('sys', 'SysNewsStatus')"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </ASelectOption>
            </ASelect>
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
