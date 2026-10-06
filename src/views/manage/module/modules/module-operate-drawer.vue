<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddSysModule, fetchUpdateSysModule } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { type TreeNode, listToTree } from '@/utils/tree';
import { $t } from '@/locales';

defineOptions({
  name: 'ModuleOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.SystemManage.SysModule | null;
  /**
   * 全量模块列表（不分页），用于选择上级模块
   *
   * 需要的是原始记录而不是 Option 列表：排除「自身及其子树」要按 parentId 判断父子关系。
   */
  moduleList?: Api.SystemManage.SysModule[];
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

/** 列宽取自 system_postgresql.sql：module_name / module_code 都是 VARCHAR(100) */
const MODULE_NAME_MAX = 100;
const MODULE_CODE_MAX = 100;

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.module.addModule'),
    edit: $t('page.manage.module.editModule')
  };
  return titles[props.operateType];
});

type Model = Pick<Api.SystemManage.SysModule, 'moduleName' | 'moduleCode' | 'orderNum' | 'moduleStatus'> & {
  /** 表单里统一用 undefined 表示空，避免 null 与 AInput 的 value 类型冲突 */
  parentId?: string;
};

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    parentId: undefined,
    moduleName: '',
    moduleCode: '',
    orderNum: 0,
    moduleStatus: true
  };
}

type RuleKey = Extract<keyof Model, 'moduleName' | 'moduleCode'>;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  moduleName: [defaultRequiredRule, createMaxLengthRule(MODULE_NAME_MAX)],
  moduleCode: [defaultRequiredRule, createMaxLengthRule(MODULE_CODE_MAX)]
};

interface ModuleOption {
  value: string;
  title: string;
  children?: ModuleOption[];
}

/**
 * 上级模块选项
 *
 * 排除**自身及其整个子树**，否则能把模块挂到自己的后代下形成环。
 *
 * 注意本模块的「顶级」是 `parent_id = NULL`（表里 5 行全是 NULL），**不是 '0'** ——
 * 所以这里刻意**不注入**合成的根节点，而是靠 `allow-clear`：清空即顶级。
 * 若照搬部门/岗位的 '0' 根节点，会把 parent_id 写成 0 而不是 NULL，与库中既有数据不一致。
 */
const parentTreeData = computed<ModuleOption[]>(() => {
  const list = props.moduleList ?? [];
  const excluded = collectSelfAndDescendants(list, props.rowData?.id);
  const kept = list.filter(item => !excluded.has(String(item.id)));

  const toOptions = (nodes: TreeNode<Api.SystemManage.SysModule>[]): ModuleOption[] =>
    nodes.map(node => ({
      value: node.id,
      title: node.moduleName,
      children: node.children?.length ? toOptions(node.children) : undefined
    }));

  return toOptions(listToTree(kept, (a, b) => (a.orderNum ?? 0) - (b.orderNum ?? 0)));
});

/**
 * 收集「自身 + 全部后代」的 id
 *
 * 此前这里是个**纯文本输入框**，让用户自己去别处找一个 19 位雪花 id 粘进来 ——
 * 既没有任何校验，也拦不住把模块选成自己的后代。
 */
function collectSelfAndDescendants(list: Api.SystemManage.SysModule[], selfId?: string) {
  const out = new Set<string>();

  if (!selfId) {
    return out;
  }

  out.add(String(selfId));

  let changed = true;
  while (changed) {
    changed = false;

    for (const item of list) {
      const pid = item.parentId ? String(item.parentId) : '';
      const id = String(item.id);

      if (pid && out.has(pid) && !out.has(id)) {
        out.add(id);
        changed = true;
      }
    }
  }

  return out;
}

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { parentId, moduleName, moduleCode, orderNum, moduleStatus } = props.rowData;

    // 显式挑选字段，避免把 id / createBy / createTime 等公共字段一并回传
    model.value = {
      parentId: parentId ?? undefined,
      moduleName: moduleName ?? '',
      moduleCode: moduleCode ?? '',
      orderNum: orderNum ?? 0,
      moduleStatus: moduleStatus ?? true
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
    const { error } = isEdit.value
      ? await fetchUpdateSysModule({ id: props.rowData?.id ?? '', ...model.value })
      : await fetchAddSysModule(model.value);

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
    resetFields();
  }
});
</script>

<template>
  <ADrawer v-model:open="visible" :title="title" :width="360">
    <AForm ref="formRef" :model="model" :rules="rules" layout="vertical">
      <AFormItem :label="$t('page.manage.module.moduleName')" name="moduleName">
        <AInput
          v-model:value="model.moduleName"
          :maxlength="MODULE_NAME_MAX"
          show-count
          :placeholder="$t('page.manage.module.form.moduleName')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.module.moduleCode')" name="moduleCode">
        <!-- moduleCode 是业务键，编辑态放开可改会打断所有按码引用它的地方 -->
        <AInput
          v-model:value="model.moduleCode"
          :disabled="isEdit"
          :maxlength="MODULE_CODE_MAX"
          show-count
          :placeholder="$t('page.manage.module.form.moduleCode')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.module.parentId')" name="parentId">
        <!-- 树形选择替代原先的裸文本框；选项已剔除自身及其子树，不会形成环 -->
        <ATreeSelect
          v-model:value="model.parentId"
          :tree-data="parentTreeData"
          show-search
          tree-node-filter-prop="title"
          tree-default-expand-all
          allow-clear
          :placeholder="$t('page.manage.module.form.parentId')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.module.orderNum')" name="orderNum">
        <AInputNumber
          v-model:value="model.orderNum"
          class="w-full"
          :min="0"
          :precision="0"
          :placeholder="$t('page.manage.module.form.orderNum')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.common.statusTitle')" name="moduleStatus">
        <ARadioGroup v-model:value="model.moduleStatus">
          <ARadio :value="true">{{ $t('page.manage.common.status.enable') }}</ARadio>
          <ARadio :value="false">{{ $t('page.manage.common.status.disable') }}</ARadio>
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
