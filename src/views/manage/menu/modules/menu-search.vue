<script setup lang="ts">
import { yesOrNoOptions } from '@/constants/common';
import { useAntdForm } from '@/hooks/common/form';
import { enumDictNameOptions, enumDictOptions } from '@/utils/enum-dict';
import { translateOptions } from '@/utils/common';
import { $t } from '@/locales';

defineOptions({
  name: 'MenuSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, resetFields } = useAntdForm();

const model = defineModel<Api.SystemManage.MenuSearchParams>('model', { required: true });

async function reset() {
  await resetFields();
  emit('reset');
}

function search() {
  emit('search');
}
</script>

<template>
  <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
    <AForm ref="formRef" :model="model" :label-width="90">
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.menu.keyword')" name="keyword" class="m-0">
            <AInput v-model:value="model.keyword" :placeholder="$t('page.manage.menu.form.keyword')" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.menu.menuType')" name="menuCategory" class="m-0">
            <ASelect
              v-model:value="model.menuCategory"
              :placeholder="$t('page.manage.menu.form.menuType')"
              :options="enumDictNameOptions('sys', 'MenuCategory')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.menu.menuStatus')" name="menuStatus" class="m-0">
            <ASelect
              v-model:value="model.menuStatus"
              :placeholder="$t('page.manage.menu.form.menuStatus')"
              :options="enumDictNameOptions('sys', 'MenuStatus')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.menu.hideInMenu')" name="hideInMenu" class="m-0">
            <ASelect
              v-model:value="model.hideInMenu"
              :placeholder="$t('page.manage.menu.form.hideInMenu')"
              :options="translateOptions(yesOrNoOptions)"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.menu.clientTypeTitle')" name="clientType" class="m-0">
            <ASelect
              v-model:value="model.clientType"
              :placeholder="$t('page.manage.menu.form.clientType')"
              :options="enumDictOptions('sys', 'MenuType')"
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
