<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddTenant, fetchUpdateTenant } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'TenantOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.Organization.Tenant | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { formRef, validate, resetFields } = useAntdForm();
const { defaultRequiredRule, createMaxLengthRule } = useFormRules();
const submitLoading = ref(false);

/**
 * 列宽取自 `carlos-org/docs/sql/org_tenant.sql`：
 * tenant_code VARCHAR(32)、tenant_name VARCHAR(128)、contact_name VARCHAR(64)、
 * contact_phone VARCHAR(32)、remark VARCHAR(512)。
 */
const TENANT_NAME_MAX = 128;
const CONTACT_NAME_MAX = 64;
const CONTACT_PHONE_MAX = 32;
const REMARK_MAX = 512;

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.organization.tenant.addTenant'),
    edit: $t('page.organization.tenant.editTenant')
  };
  return titles[props.operateType];
});

type Model = Pick<
  Api.Organization.Tenant,
  'tenantCode' | 'tenantName' | 'contactName' | 'contactPhone' | 'expireTime' | 'remark'
>;

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    tenantCode: '',
    tenantName: '',
    contactName: '',
    contactPhone: '',
    expireTime: undefined,
    remark: ''
  };
}

/**
 * 规则键必须与模板里 AFormItem 的 `name` 逐字一致
 * （反面教材见 SKILL.md 的 `RuleKey = Extract<...>` 一节：键写错会静默变成 `never`）
 */
type RuleKey = Extract<keyof Model, 'tenantCode' | 'tenantName' | 'contactName' | 'contactPhone' | 'remark'>;

const TENANT_CODE_PATTERN = /^[a-zA-Z0-9_-]{1,32}$/;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  tenantCode: [
    defaultRequiredRule,
    {
      pattern: TENANT_CODE_PATTERN,
      message: $t('page.organization.tenant.form.tenantCodeRule'),
      trigger: 'change'
    }
  ],
  tenantName: [defaultRequiredRule, createMaxLengthRule(TENANT_NAME_MAX)],
  contactName: [createMaxLengthRule(CONTACT_NAME_MAX)],
  contactPhone: [createMaxLengthRule(CONTACT_PHONE_MAX)],
  remark: [createMaxLengthRule(REMARK_MAX)]
};

const tenantId = computed(() => props.rowData?.id ?? '');

const isEdit = computed(() => props.operateType === 'edit');

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { tenantCode, tenantName, contactName, contactPhone, expireTime, remark } = props.rowData;

    // 显式逐字段赋值，禁止 Object.assign 整体铺开（SKILL 列表页范式第 13 条）
    model.value = {
      tenantCode: tenantCode ?? '',
      tenantName: tenantName ?? '',
      contactName: contactName ?? '',
      contactPhone: contactPhone ?? '',
      expireTime: expireTime ?? undefined,
      remark: remark ?? ''
    };
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;
  try {
    if (isEdit.value) {
      // 编辑态不含 tenantCode（业务键，创建后不可改，与后端 OrgTenantUpdateParam 对齐）
      const { tenantCode: _tenantCode, ...rest } = model.value;
      const { error } = await fetchUpdateTenant({ id: tenantId.value, ...rest });
      if (error) {
        window.$message?.error?.($t('common.updateFailed'));
        return;
      }
    } else {
      const { error } = await fetchAddTenant(model.value);
      if (error) {
        window.$message?.error?.($t('common.addFailed'));
        return;
      }
    }
    window.$message?.success?.(isEdit.value ? $t('common.updateSuccess') : $t('common.addSuccess'));
    closeDrawer();
    emit('submitted');
  } finally {
    submitLoading.value = false;
  }
}

watch(visible, () => {
  if (visible.value) {
    handleInitModel();
    resetFields();
  }
});
</script>

<template>
  <!-- 宽度 420 偏离规范默认 360/480：竖排表单含带时间的日期选择器，360 下 show-time 面板换行难看，480 又留白过多 -->
  <ADrawer v-model:open="visible" :title="title" :width="420">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.organization.tenant.tenantCode')" name="tenantCode">
        <!--
          tenantCode 是登录时输入的业务键（org_tenant 部分唯一索引），
          编辑态放开可改会让存量用户无法用原编码登录，故锁定
        -->
        <AInput
          v-model:value="model.tenantCode"
          :disabled="isEdit"
          :maxlength="32"
          show-count
          :placeholder="$t('page.organization.tenant.form.tenantCode')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.tenant.tenantName')" name="tenantName">
        <AInput
          v-model:value="model.tenantName"
          :maxlength="TENANT_NAME_MAX"
          show-count
          :placeholder="$t('page.organization.tenant.form.tenantName')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.tenant.contactName')" name="contactName">
        <AInput
          v-model:value="model.contactName"
          :maxlength="CONTACT_NAME_MAX"
          show-count
          :placeholder="$t('page.organization.tenant.form.contactName')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.tenant.contactPhone')" name="contactPhone">
        <AInput
          v-model:value="model.contactPhone"
          :maxlength="CONTACT_PHONE_MAX"
          show-count
          :placeholder="$t('page.organization.tenant.form.contactPhone')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.tenant.expireTime')" name="expireTime">
        <!-- 后端 LocalDateTime 无全局格式器，ISO-8601 原样下发/回传 -->
        <ADatePicker
          v-model:value="model.expireTime"
          show-time
          value-format="YYYY-MM-DDTHH:mm:ss"
          class="w-full"
          :placeholder="$t('page.organization.tenant.form.expireTime')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.tenant.remark')" name="remark">
        <AInput
          v-model:value="model.remark"
          :maxlength="REMARK_MAX"
          show-count
          :placeholder="$t('page.organization.tenant.form.remark')"
        />
      </AFormItem>
    </AForm>
    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" @click="handleSubmit">
          {{ $t('common.confirm') }}
        </AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
