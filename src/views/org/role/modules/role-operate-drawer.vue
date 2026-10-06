<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useBoolean } from '@sa/hooks';
import { fetchAddRole, fetchUpdateRole } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { enumDictCodeString, enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';
import OperationAuthModal from './operation-auth-modal.vue';

defineOptions({
  name: 'RoleOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.Organization.Role | null;
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
const { bool: operationAuthVisible, setTrue: openOperationAuthModal } = useBoolean();
const submitLoading = ref(false);

/**
 * 列宽取自 `carlos-org/docs/02-design/database/org_postgresql.sql`：
 * role_name 是 VARCHAR(40)、role_code VARCHAR(100)、description VARCHAR(200)。
 * 不设上限的话，超长输入会一路走到数据库，用户只拿到一句无信息量的「新增失败」。
 */
const ROLE_NAME_MAX = 40;
const ROLE_CODE_MAX = 100;
const ROLE_DESC_MAX = 200;

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.organization.role.addRole'),
    edit: $t('page.organization.role.editRole')
  };
  return titles[props.operateType];
});

type Model = Pick<Api.Organization.Role, 'roleName' | 'roleCode' | 'description' | 'roleStatus'>;

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    roleName: '',
    roleCode: '',
    description: '',
    roleStatus: '1'
  };
}

/**
 * 规则键必须与模板里 AFormItem 的 `name` 逐字一致
 * （反面教材见 SKILL.md 的 `RuleKey = Extract<...>` 一节：键写错会静默变成 `never`）
 */
type RuleKey = Extract<keyof Model, 'roleName' | 'roleCode' | 'roleStatus' | 'description'>;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  roleName: [defaultRequiredRule, createMaxLengthRule(ROLE_NAME_MAX)],
  roleCode: [defaultRequiredRule, createMaxLengthRule(ROLE_CODE_MAX)],
  roleStatus: [defaultRequiredRule],
  description: [createMaxLengthRule(ROLE_DESC_MAX)]
};

const roleId = computed(() => props.rowData?.id ?? '');

const isEdit = computed(() => props.operateType === 'edit');

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { roleName, roleCode, description, roleStatus } = props.rowData;

    // 显式逐字段赋值。此前用的是 `Object.assign(model.value, {...})` —— 那是把源对象的键
    // **整体铺上去**，一旦将来 rowData 多带一个字段（id / createBy / tenantId）就会一并回传后端
    // （SKILL 列表页范式第 13 条明确禁止这个写法，全仓也仅此一处）
    model.value = {
      roleName: roleName ?? '',
      roleCode: roleCode ?? '',
      description: description ?? '',
      // 后端是 Integer、JSON 下发为**数字**（TS 名义类型是字符串联合），必须 enumDictCodeString 归一，否则编辑预填不选中
      roleStatus: (enumDictCodeString(roleStatus) ?? '1') as Api.Organization.OrgRoleState
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
      const { error } = await fetchUpdateRole({ id: roleId.value, ...model.value });
      if (error) {
        window.$message?.error?.($t('common.updateFailed'));
        return;
      }
    } else {
      const { error } = await fetchAddRole(model.value);
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
  <ADrawer v-model:open="visible" :title="title" :width="360">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.organization.role.roleName')" name="roleName">
        <AInput
          v-model:value="model.roleName"
          :maxlength="ROLE_NAME_MAX"
          show-count
          :placeholder="$t('page.organization.role.form.roleName')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.role.roleCode')" name="roleCode">
        <!--
          roleCode 是业务键（权限码常按它引用，如 ROLE_SUPER_ADMIN），
          编辑态放开可改会静默打断所有按码引用它的地方，故锁定
        -->
        <AInput
          v-model:value="model.roleCode"
          :disabled="isEdit"
          :maxlength="ROLE_CODE_MAX"
          show-count
          :placeholder="$t('page.organization.role.form.roleCode')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.role.roleStatus')" name="roleStatus">
        <ARadioGroup v-model:value="model.roleStatus">
          <ARadio v-for="item in enumDictOptions('org', 'OrgRoleState')" :key="item.value" :value="item.value">
            {{ item.label }}
          </ARadio>
        </ARadioGroup>
      </AFormItem>
      <AFormItem :label="$t('page.organization.role.roleDesc')" name="description">
        <AInput
          v-model:value="model.description"
          :maxlength="ROLE_DESC_MAX"
          show-count
          :placeholder="$t('page.organization.role.form.roleDesc')"
        />
      </AFormItem>
    </AForm>
    <div v-if="isEdit" class="mb-16px">
      <AButton type="primary" ghost @click="openOperationAuthModal">
        {{ $t('page.organization.role.operationAuth') }}
      </AButton>
      <OperationAuthModal v-model:visible="operationAuthVisible" :role-id="roleId" />
    </div>
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
