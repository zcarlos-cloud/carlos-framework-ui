<script setup lang="ts">
import { i18nLangOptions } from '@/constants/business';
import { yesOrNoOptions } from '@/constants/common';
import { translateOptions } from '@/utils/common';
import { $t, OVERRIDABLE_NAMESPACES } from '@/locales';

defineOptions({
  name: 'I18nSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.SystemManage.I18nManageSearchParams>('model', { required: true });

/** 命名空间的显示名 */
const namespaceLabelKey: Record<string, App.I18n.I18nKey> = {
  system: 'page.manage.i18n.namespaceOptions.system',
  common: 'page.manage.i18n.namespaceOptions.common',
  route: 'page.manage.i18n.namespaceOptions.route',
  page: 'page.manage.i18n.namespaceOptions.page'
};

const namespaceOptions = OVERRIDABLE_NAMESPACES.map(ns => ({ value: ns, label: namespaceLabelKey[ns] }));

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
          <AFormItem :label="$t('page.manage.i18n.lang')" name="lang" class="m-0">
            <ASelect
              v-model:value="model.lang"
              :placeholder="$t('page.manage.i18n.form.lang')"
              :options="translateOptions(i18nLangOptions)"
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.i18n.keyword')" name="keyword" class="m-0">
            <AInput
              v-model:value="model.keyword"
              :placeholder="$t('page.manage.i18n.form.keyword')"
              allow-clear
              @press-enter="search"
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.i18n.namespace')" name="namespace" class="m-0">
            <ASelect
              v-model:value="model.namespace"
              :placeholder="$t('page.manage.i18n.namespace')"
              :options="translateOptions(namespaceOptions)"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.i18n.onlyOverridden')" name="onlyOverridden" class="m-0">
            <ASelect
              v-model:value="model.onlyOverridden"
              :placeholder="$t('common.pleaseCheckValue')"
              :options="translateOptions(yesOrNoOptions)"
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
