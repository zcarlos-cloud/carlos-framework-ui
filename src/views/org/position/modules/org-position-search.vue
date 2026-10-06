<script setup lang="ts">
import { useAntdForm } from '@/hooks/common/form';
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'OrgPositionSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, resetFields } = useAntdForm();

const model = defineModel<Api.Organization.PositionSearchParams>('model', { required: true });

async function reset() {
  await resetFields();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}
</script>

<template>
  <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
    <AForm ref="formRef" :model="model" :label-col="{ span: 5, md: 7 }">
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.organization.position.positionCode')" name="positionCode" class="m-0">
            <AInput
              v-model:value="model.positionCode"
              :placeholder="$t('page.organization.position.form.positionCode')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.organization.position.positionName')" name="positionName" class="m-0">
            <AInput
              v-model:value="model.positionName"
              :placeholder="$t('page.organization.position.form.positionName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.organization.position.positionType')" name="positionType" class="m-0">
            <!-- 选项由后端枚举字典驱动（父页 ensureEnumDict('org')），本组件不请求数据 -->
            <ASelect
              v-model:value="model.positionType"
              :placeholder="$t('page.organization.position.form.positionType')"
              :options="enumDictOptions('org', 'OrgPositionType')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.organization.position.positionNature')" name="positionNature" class="m-0">
            <ASelect
              v-model:value="model.positionNature"
              :placeholder="$t('page.organization.position.form.positionNature')"
              :options="enumDictOptions('org', 'OrgPositionNature')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.organization.position.positionStatus')" name="positionStatus" class="m-0">
            <ASelect
              v-model:value="model.positionStatus"
              :placeholder="$t('page.organization.position.form.positionStatus')"
              :options="enumDictOptions('org', 'OrgPositionStatus')"
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
