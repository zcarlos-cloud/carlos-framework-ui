<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddOperation, fetchGetMenuTree, fetchUpdateOperation } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'OperationOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.SystemManage.Operation | null;
  /**
   * 新增时的预设值（编辑态忽略）
   *
   * 由「新增按钮」/「新增 API」入口带入：opType 决定初始类型，
   * menuId 为当前树选中的叶子菜单；未传则由用户在抽屉里自行选择。
   */
  preset?: {
    opType?: Api.SystemManage.OperationType;
    menuId?: string;
  } | null;
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
const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.operation.addOperation'),
    edit: $t('page.manage.operation.editOperation')
  };
  return titles[props.operateType];
});

type Model = Pick<
  Api.SystemManage.Operation,
  'menuId' | 'opName' | 'permCode' | 'opType' | 'apiMethod' | 'apiPath' | 'opStatus'
>;

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    menuId: undefined,
    opName: '',
    permCode: '',
    opType: 'BUTTON',
    apiMethod: '',
    apiPath: '',
    opStatus: 'ENABLED'
  };
}

type RuleKey = Extract<keyof Model, 'opName' | 'permCode' | 'opType' | 'apiMethod' | 'apiPath'>;

/**
 * 列宽取自 system_postgresql.sql：op_name / perm_code 是 VARCHAR(100)、
 * api_method VARCHAR(10)、api_path VARCHAR(500)。
 *
 * apiMethod / apiPath 的「必填」是**条件性**的：只有 opType='API' 时才必填。
 * 此前这两个字段完全没有规则，于是能存下「方法空、路径空」的接口操作 ——
 * 这种记录在权限校验里毫无意义，却完全合法。
 */
const OP_NAME_MAX = 100;
const PERM_CODE_MAX = 100;
const API_METHOD_MAX = 10;
const API_PATH_MAX = 500;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => {
  const isApi = model.value.opType === 'API';

  return {
    opName: [defaultRequiredRule, createMaxLengthRule(OP_NAME_MAX)],
    permCode: [defaultRequiredRule, createMaxLengthRule(PERM_CODE_MAX)],
    opType: [defaultRequiredRule],
    apiMethod: isApi ? [defaultRequiredRule, createMaxLengthRule(API_METHOD_MAX)] : [],
    apiPath: isApi ? [defaultRequiredRule, createMaxLengthRule(API_PATH_MAX)] : []
  };
});

/** 切回「按钮」时清掉接口字段：那两个输入框会隐藏，但值还留在 model 里，不清就会跟着提交上去 */
watch(
  () => model.value.opType,
  type => {
    if (type !== 'API') {
      model.value.apiMethod = '';
      model.value.apiPath = '';
    }
  }
);

/** 所属菜单下拉数据源 */
const menuTree = ref<Api.SystemManage.MenuTree[]>([]);

async function loadMenuTree() {
  const { data, error } = await fetchGetMenuTree();

  if (!error && data) {
    menuTree.value = data;
  }
}

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { menuId, opName, permCode, opType, apiMethod, apiPath, opStatus } = props.rowData;

    // 显式挑选字段，避免把 id / createBy / createTime 等公共字段一并回传
    model.value = {
      menuId: menuId ?? undefined,
      opName: opName ?? '',
      permCode: permCode ?? '',
      opType: opType ?? 'BUTTON',
      apiMethod: apiMethod ?? '',
      apiPath: apiPath ?? '',
      opStatus: opStatus ?? 'ENABLED'
    };
    return;
  }

  // 新增态应用入口预设：「新增按钮」带入 BUTTON + 当前选中菜单，「新增 API」带入 API
  if (props.preset) {
    model.value.opType = props.preset.opType ?? model.value.opType;
    model.value.menuId = props.preset.menuId ?? undefined;
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const { error } = isEdit.value
      ? await fetchUpdateOperation({ id: props.rowData?.id ?? '', ...model.value })
      : await fetchAddOperation(model.value);

    if (error) {
      window.$message?.error?.(isEdit.value ? $t('common.updateFailed') : $t('common.addFailed'));
      return;
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
    loadMenuTree();
    resetFields();
  }
});
</script>

<template>
  <ADrawer v-model:open="visible" :title="title" :width="360">
    <AForm ref="formRef" :model="model" :rules="rules" layout="vertical">
      <AFormItem :label="$t('page.manage.operation.opName')" name="opName">
        <AInput
          v-model:value="model.opName"
          :maxlength="OP_NAME_MAX"
          show-count
          :placeholder="$t('page.manage.operation.form.opName')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.operation.permCode')" name="permCode">
        <AInput
          v-model:value="model.permCode"
          :maxlength="PERM_CODE_MAX"
          show-count
          :placeholder="$t('page.manage.operation.form.permCode')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.operation.menuId')" name="menuId">
        <ATreeSelect
          v-model:value="model.menuId"
          :tree-data="menuTree"
          :field-names="{ children: 'children', label: 'menuName', value: 'id' }"
          :placeholder="$t('page.manage.operation.form.menuId')"
          allow-clear
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.operation.opType')" name="opType">
        <ARadioGroup v-model:value="model.opType">
          <ARadio value="BUTTON">{{ $t('page.manage.operation.typeOptions.button') }}</ARadio>
          <ARadio value="API">{{ $t('page.manage.operation.typeOptions.api') }}</ARadio>
        </ARadioGroup>
      </AFormItem>

      <AFormItem v-if="model.opType === 'API'" :label="$t('page.manage.operation.apiMethod')" name="apiMethod">
        <ASelect v-model:value="model.apiMethod" :placeholder="$t('page.manage.operation.form.apiMethod')" allow-clear>
          <ASelectOption value="GET">GET</ASelectOption>
          <ASelectOption value="POST">POST</ASelectOption>
          <ASelectOption value="PUT">PUT</ASelectOption>
          <ASelectOption value="DELETE">DELETE</ASelectOption>
          <ASelectOption value="PATCH">PATCH</ASelectOption>
        </ASelect>
      </AFormItem>

      <AFormItem v-if="model.opType === 'API'" :label="$t('page.manage.operation.apiPath')" name="apiPath">
        <AInput
          v-model:value="model.apiPath"
          :maxlength="API_PATH_MAX"
          show-count
          :placeholder="$t('page.manage.operation.form.apiPath')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.common.statusTitle')" name="opStatus">
        <ARadioGroup v-model:value="model.opStatus">
          <ARadio value="ENABLED">{{ $t('page.manage.common.status.enable') }}</ARadio>
          <ARadio value="DISABLED">{{ $t('page.manage.common.status.disable') }}</ARadio>
        </ARadioGroup>
      </AFormItem>
    </AForm>
    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" @click="handleSubmit">{{ $t('common.confirm') }}</AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
