<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddDepartment, fetchUpdateDepartment } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'OrgDepartmentOperateDrawer'
});

/** 本页比其他模块多一种 addChild（新增下级部门），故 operateType 由页面自行维护 */
export type OperateType = AntDesign.TableOperateType | 'addChild';

interface Props {
  /** the type of operation */
  operateType: OperateType;
  /** the edit row data（树端点下发的是 OrgDepartmentTreeVO） */
  rowData?: Api.Organization.DepartmentTree | null;
  /** 全量部门树，用于选择上级部门 */
  deptTree?: Api.Organization.DepartmentTree[];
  /** 负责人候选项（部门负责人从用户中选） */
  userOptions?: CommonType.Option<string>[];
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
const { defaultRequiredRule, createMaxLengthRule, createNumberRangeRule } = useFormRules();

/** 列宽取自 org_postgresql.sql：dept_name 与 dept_code 都是 VARCHAR(64) */
const DEPT_NAME_MAX = 64;
const DEPT_CODE_MAX = 64;

const submitLoading = ref(false);

const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<OperateType, string> = {
    add: $t('page.organization.department.addDept'),
    addChild: $t('page.organization.department.childDept'),
    edit: $t('page.organization.department.editDept')
  };

  return titles[props.operateType];
});

interface Model {
  parentId: string;
  deptName: string;
  deptCode: string;
  leaderId?: string;
  orderNum?: number;
}

/** 后端以 parentId = '0' 表示顶级部门 */
const ROOT_PARENT_ID = '0';

function createDefaultModel(): Model {
  return {
    parentId: ROOT_PARENT_ID,
    deptName: '',
    deptCode: '',
    leaderId: undefined,
    orderNum: undefined
  };
}

const model = ref(createDefaultModel());

/** 排序号上限：库列是 INTEGER 且后端无 @Max，给个业务上足够大的上界防止误输天文数字 */
const ORDER_NUM_MAX = 9999;

type RuleKey = Extract<keyof Model, 'deptName' | 'deptCode' | 'orderNum'>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  deptName: [defaultRequiredRule, createMaxLengthRule(DEPT_NAME_MAX)],
  deptCode: [defaultRequiredRule, createMaxLengthRule(DEPT_CODE_MAX)],
  orderNum: [createNumberRangeRule(0, ORDER_NUM_MAX)]
}));

interface ParentOption {
  value: string;
  title: string;
  children?: ParentOption[];
}

/**
 * 上级部门选项
 *
 * 编辑时必须排除**自身及其整个子树**，否则可以把部门挂到自己的后代下形成环。
 * 过滤掉自身节点即等于剪掉其子树（子节点只出现在该分支里）。
 */
const parentTreeData = computed<ParentOption[]>(() => {
  const excludedId = isEdit.value ? props.rowData?.id : undefined;

  function toOptions(nodes: Api.Organization.DepartmentTree[]): ParentOption[] {
    return nodes
      .filter(node => node.id !== excludedId)
      .map(node => {
        const children = node.children?.length ? toOptions(node.children) : undefined;

        return { value: node.id, title: node.deptName, children };
      });
  }

  return [
    {
      value: ROOT_PARENT_ID,
      title: $t('page.organization.department.topLevel'),
      children: toOptions(props.deptTree ?? [])
    }
  ];
});

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { parentId, deptName, deptCode, leaderId, orderNum } = props.rowData;

    // 显式挑选字段，避免把 createBy / path 等后端返回的公共字段一并回传
    //
    // 不含 description：树端点下发的 OrgDepartmentTreeVO 没有该字段，
    // 且部门模块没有 detail 端点可回填，强行提交空值会覆盖既有描述。
    model.value = {
      parentId: parentId ?? ROOT_PARENT_ID,
      deptName: deptName ?? '',
      deptCode: deptCode ?? '',
      leaderId: leaderId ?? undefined,
      orderNum: orderNum ?? undefined
    };
  } else if (props.operateType === 'addChild' && props.rowData) {
    // 新增下级时预置上级部门
    model.value = { ...model.value, parentId: props.rowData.id };
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const payload: Api.Organization.DepartmentOperateParams = {
      parentId: model.value.parentId,
      deptName: model.value.deptName,
      deptCode: model.value.deptCode,
      leaderId: model.value.leaderId,
      orderNum: model.value.orderNum
    };

    const { error } = isEdit.value
      ? await fetchUpdateDepartment({ ...payload, id: props.rowData?.id ?? '' })
      : await fetchAddDepartment(payload);

    if (error) {
      window.$message?.error?.($t(isEdit.value ? 'common.updateFailed' : 'common.addFailed'));
      return;
    }

    window.$message?.success?.($t(isEdit.value ? 'common.updateSuccess' : 'common.addSuccess'));
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
  <ADrawer v-model:open="visible" :title="title" :width="400">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.organization.department.parentId')" name="parentId">
        <ATreeSelect
          v-model:value="model.parentId"
          :tree-data="parentTreeData"
          tree-default-expand-all
          :placeholder="$t('page.organization.department.form.parentId')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.department.deptName')" name="deptName">
        <AInput
          v-model:value="model.deptName"
          :maxlength="DEPT_NAME_MAX"
          show-count
          :placeholder="$t('page.organization.department.form.deptName')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.department.deptCode')" name="deptCode">
        <!-- deptCode 是部门业务键，编辑态放开可改会打断所有按码引用它的地方，故锁定 -->
        <AInput
          v-model:value="model.deptCode"
          :disabled="isEdit"
          :maxlength="DEPT_CODE_MAX"
          show-count
          :placeholder="$t('page.organization.department.form.deptCode')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.department.leaderId')" name="leaderId">
        <ASelect
          v-model:value="model.leaderId"
          :options="userOptions"
          :placeholder="$t('page.organization.department.form.leaderId')"
          show-search
          option-filter-prop="label"
          allow-clear
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.department.orderNum')" name="orderNum">
        <AInputNumber
          v-model:value="model.orderNum"
          class="w-full"
          :min="0"
          :max="ORDER_NUM_MAX"
          :placeholder="$t('page.organization.department.form.orderNum')"
        />
      </AFormItem>
    </AForm>
    <template #footer>
      <ASpace :size="16">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" @click="handleSubmit">{{ $t('common.confirm') }}</AButton>
      </ASpace>
    </template>
  </ADrawer>
</template>

<style scoped></style>
