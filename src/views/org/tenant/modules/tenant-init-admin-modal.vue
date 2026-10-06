<script setup lang="ts">
import { ref, watch } from 'vue';
import { fetchInitTenantAdmin } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'TenantInitAdminModal'
});

interface Props {
  /** 目标租户 id（Long 字符串） */
  tenantId: string;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { formRef, validate, resetFields } = useAntdForm();
const { defaultRequiredRule, createMaxLengthRule } = useFormRules();
const submitLoading = ref(false);

interface Model {
  account: string;
  nickname: string;
  password: string;
  phone: string;
}

const model = ref<Model>(createDefaultModel());

function createDefaultModel(): Model {
  return {
    account: '',
    nickname: '',
    password: '',
    phone: ''
  };
}

type RuleKey = keyof Model;

/** 与后端 OrgTenantInitAdminParam 的 @Pattern/@Size 逐字对齐 */
const ACCOUNT_PATTERN = /^[a-zA-Z0-9_]{4,32}$/;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  account: [
    defaultRequiredRule,
    {
      pattern: ACCOUNT_PATTERN,
      message: $t('page.organization.tenant.form.accountRule'),
      trigger: 'change'
    }
  ],
  nickname: [defaultRequiredRule, createMaxLengthRule(64)],
  password: [
    defaultRequiredRule,
    {
      min: 8,
      max: 64,
      message: $t('page.organization.tenant.form.passwordRule'),
      trigger: 'change'
    }
  ],
  phone: [createMaxLengthRule(32)]
};

function closeModal() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;
  try {
    const { error } = await fetchInitTenantAdmin({
      tenantId: props.tenantId,
      account: model.value.account,
      nickname: model.value.nickname,
      password: model.value.password,
      phone: model.value.phone || undefined
    });
    if (error) {
      window.$message?.error?.($t('page.organization.tenant.initAdminFailed'));
      return;
    }
    window.$message?.success?.($t('page.organization.tenant.initAdminSuccess'));
    closeModal();
  } finally {
    submitLoading.value = false;
  }
}

watch(visible, () => {
  if (visible.value) {
    model.value = createDefaultModel();
    resetFields();
  }
});
</script>

<template>
  <AModal
    v-model:open="visible"
    :title="$t('page.organization.tenant.initAdmin')"
    :width="420"
    :confirm-loading="submitLoading"
    @ok="handleSubmit"
  >
    <AAlert type="info" show-icon class="mb-16px">
      <template #message>{{ $t('page.organization.tenant.initAdminTip') }}</template>
    </AAlert>
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.organization.tenant.adminAccount')" name="account">
        <AInput
          v-model:value="model.account"
          :maxlength="32"
          show-count
          :placeholder="$t('page.organization.tenant.form.account')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.tenant.adminNickname')" name="nickname">
        <AInput
          v-model:value="model.nickname"
          :maxlength="64"
          show-count
          :placeholder="$t('page.organization.tenant.form.nickname')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.tenant.adminPassword')" name="password">
        <AInputPassword
          v-model:value="model.password"
          :maxlength="64"
          :placeholder="$t('page.organization.tenant.form.password')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.tenant.adminPhone')" name="phone">
        <AInput
          v-model:value="model.phone"
          :maxlength="32"
          show-count
          :placeholder="$t('page.organization.tenant.form.phone')"
        />
      </AFormItem>
    </AForm>
  </AModal>
</template>

<style scoped></style>
