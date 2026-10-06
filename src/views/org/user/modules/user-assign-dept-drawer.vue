<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAssignUserDepartments, fetchGetDepartmentTree, fetchGetUserDepartments } from '@/service/api';
import { useAntdForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'UserAssignDeptDrawer'
});

interface Props {
  /** 目标用户 id */
  userId: string;
  /** 目标用户账号，仅用于提示「正在为谁分配」 */
  account?: string;
}

const props = defineProps<Props>();

interface Emits {
  /** 分配成功，调用方据此刷新列表 */
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { formRef, validate, clearValidate } = useAntdForm();

const submitting = ref(false);
const loading = ref(false);

interface DeptTreeNode {
  value: string;
  title: string;
  children?: DeptTreeNode[];
}

const treeData = ref<DeptTreeNode[]>([]);

/** id → 部门名：给「主部门」下拉与回显用 */
const deptNameById = ref<Record<string, string>>({});

const departmentIds = ref<string[]>([]);
const mainDeptId = ref<string | undefined>(undefined);

const rules = computed(() => ({
  // 后端 OrgUserAssignDeptParam.departmentIds 带 @NotEmpty —— 空集合会被直接拒掉
  departmentIds: {
    required: true,
    type: 'array' as const,
    message: $t('page.organization.user.deptRequired')
  }
}));

/**
 * 主部门的可选项**只来自于已勾选的部门**
 *
 * 这样「主部门必须在所选部门列表中」这条后端约束在构造上就无法被违反，
 * 不需要等提交后再吃一个 UserOperationException。
 */
const mainDeptOptions = computed(() =>
  departmentIds.value.map(id => ({ value: id, label: deptNameById.value[id] ?? id }))
);

function toTreeData(nodes: Api.Organization.DepartmentTree[]): DeptTreeNode[] {
  return nodes.map(node => {
    deptNameById.value[node.id] = node.deptName;

    return {
      value: node.id,
      title: node.deptName,
      children: node.children?.length ? toTreeData(node.children) : undefined
    };
  });
}

async function loadAll() {
  loading.value = true;
  departmentIds.value = [];
  mainDeptId.value = undefined;

  try {
    const [treeRes, deptRes] = await Promise.all([fetchGetDepartmentTree(), fetchGetUserDepartments(props.userId)]);

    if (!treeRes.error && treeRes.data) {
      deptNameById.value = {};
      treeData.value = toTreeData(treeRes.data);
    }

    if (!deptRes.error && deptRes.data) {
      departmentIds.value = deptRes.data.map(item => item.departmentId);
      mainDeptId.value = deptRes.data.find(item => item.isMain)?.departmentId;
    }
  } finally {
    loading.value = false;
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitting.value = true;

  try {
    const { error } = await fetchAssignUserDepartments(
      props.userId,
      departmentIds.value,
      mainDeptId.value || undefined
    );

    if (error) {
      // 请求层已弹过提示，此处不得重复
      return;
    }

    window.$message?.success?.($t('page.organization.user.deptAssignSuccess'));
    closeDrawer();
    emit('submitted');
  } finally {
    submitting.value = false;
  }
}

watch(visible, value => {
  if (value) {
    clearValidate();
    loadAll();
  }
});

/** 取消勾选某部门后，若它正被当作主部门就一并清掉，避免提交时才被后端拒绝 */
watch(departmentIds, ids => {
  if (mainDeptId.value && !ids.includes(mainDeptId.value)) {
    mainDeptId.value = undefined;
  }
});
</script>

<template>
  <ADrawer v-model:open="visible" :title="$t('page.organization.user.assignDept')" :width="480">
    <AAlert
      v-if="account"
      type="warning"
      show-icon
      class="mb-16px"
      :message="$t('page.organization.user.deptAssignHint', { account })"
    />

    <AForm ref="formRef" layout="vertical" :model="{ departmentIds, mainDeptId }" :rules="rules">
      <AFormItem :label="$t('page.organization.user.userDept')" name="departmentIds">
        <ATreeSelect
          v-model:value="departmentIds"
          :tree-data="treeData"
          :loading="loading"
          multiple
          tree-checkable
          show-search
          :tree-default-expand-all="false"
          :max-tag-count="6"
          :placeholder="$t('page.organization.user.deptRequired')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.user.mainDept')" name="mainDeptId">
        <ASelect
          v-model:value="mainDeptId"
          :options="mainDeptOptions"
          :disabled="mainDeptOptions.length === 0"
          allow-clear
        />
      </AFormItem>
    </AForm>

    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <!-- loading 期间禁止提交：本操作是「先删光再重建」，必须在拿到用户现有部门之后才能提交 -->
        <AButton type="primary" :loading="submitting" :disabled="loading" @click="handleSubmit">
          {{ $t('common.confirm') }}
        </AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
