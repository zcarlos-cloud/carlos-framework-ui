<script setup lang="tsx">
import { computed, onMounted, ref, watch } from 'vue';
import { Button, Popconfirm } from 'ant-design-vue';
import {
  fetchAddGroup,
  fetchDeleteGroup,
  fetchGetGroupList,
  fetchGetRoleOptions,
  fetchUpdateGroup,
  fetchUpdateGroupAuth
} from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { useTable } from '@/hooks/common/table';
import { $t } from '@/locales';

defineOptions({
  name: 'MonitorGroupManageModal'
});

/**
 * 分组管理弹窗：分组表格 + 新增/编辑内联表单 + 角色授权
 *
 * 非主流程列表页，承载在实例管理页之上，故用 AModal + 内嵌小表格，
 * 不套用 13 条列表页范式（数据量小、无批量操作）。
 */

interface Emits {
  (e: 'changed'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const { columns, data, getData, loading, searchParams } = useTable({
  apiFn: fetchGetGroupList,
  apiParams: {
    current: 1,
    size: 10,
    groupName: undefined
  },
  columns: () => [
    {
      key: 'index',
      dataIndex: 'index',
      title: $t('common.index'),
      align: 'center',
      width: 64
    },
    {
      key: 'groupName',
      dataIndex: 'groupName',
      title: $t('page.manage.monitor.group.groupName'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'orderNum',
      dataIndex: 'orderNum',
      title: $t('page.manage.monitor.group.orderNum'),
      align: 'center',
      width: 80
    },
    {
      key: 'roleIds',
      dataIndex: 'roleIds',
      title: $t('page.manage.monitor.group.roleIds'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => <span>{record.roleIds?.length ?? 0}</span>
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 220,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => handleEdit(record)}>
            {$t('common.edit')}
          </Button>
          <Button size="small" onClick={() => openAuth(record)}>
            {$t('page.manage.monitor.group.auth')}
          </Button>
          <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
            <Button danger size="small">
              {$t('common.delete')}
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ]
});

// ==================== 新增 / 编辑 ====================

const { formRef, validate, resetFields } = useAntdForm();
const { defaultRequiredRule, createMaxLengthRule } = useFormRules();

const GROUP_NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

const editVisible = ref(false);
const submitLoading = ref(false);
const editingId = ref<string | null>(null);

interface GroupModel {
  groupName: string;
  description?: string;
  orderNum: number;
  roleIds: string[];
}

const model = ref<GroupModel>({ groupName: '', description: undefined, orderNum: 0, roleIds: [] });

const isEdit = computed(() => editingId.value !== null);

const editTitle = computed(() =>
  isEdit.value ? $t('page.manage.monitor.group.editGroup') : $t('page.manage.monitor.group.addGroup')
);

const rules: Record<'groupName' | 'description', App.Global.FormRule[]> = {
  groupName: [{ ...defaultRequiredRule, whitespace: true }, createMaxLengthRule(GROUP_NAME_MAX)],
  description: [createMaxLengthRule(DESCRIPTION_MAX)]
};

function handleAdd() {
  editingId.value = null;
  model.value = { groupName: '', description: undefined, orderNum: 0, roleIds: [] };
  editVisible.value = true;
}

function handleEdit(record: Api.Monitor.InstanceGroup) {
  editingId.value = record.id;
  model.value = {
    groupName: record.groupName ?? '',
    description: record.description,
    orderNum: record.orderNum ?? 0,
    roleIds: record.roleIds ? [...record.roleIds] : []
  };
  editVisible.value = true;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;
  try {
    // 去除首尾空白，避免脏数据（后端 @NotBlank 只拦全空白，不拦首尾空格）
    const description = model.value.description?.trim();
    const params: Api.Monitor.InstanceGroupOperateParams = {
      id: editingId.value ?? undefined,
      groupName: model.value.groupName.trim(),
      description: description || undefined,
      orderNum: model.value.orderNum,
      roleIds: model.value.roleIds
    };
    const { error } = isEdit.value ? await fetchUpdateGroup(params) : await fetchAddGroup(params);
    if (error) {
      window.$message?.error?.(isEdit.value ? $t('common.updateFailed') : $t('common.addFailed'));
      return;
    }
    window.$message?.success?.(isEdit.value ? $t('common.updateSuccess') : $t('common.addSuccess'));
    editVisible.value = false;
    getData();
    emit('changed');
  } finally {
    submitLoading.value = false;
  }
}

const deleting = ref(false);

async function handleDelete(id: string) {
  deleting.value = true;
  try {
    const { error } = await fetchDeleteGroup(id);
    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }
    window.$message?.success?.($t('common.deleteSuccess'));
    getData();
    emit('changed');
  } finally {
    deleting.value = false;
  }
}

// ==================== 角色授权 ====================

const authVisible = ref(false);
const authLoading = ref(false);
const authGroup = ref<Api.Monitor.InstanceGroup | null>(null);
const authRoleIds = ref<string[]>([]);
const roleOptions = ref<{ label: string; value: string }[]>([]);

function openAuth(record: Api.Monitor.InstanceGroup) {
  authGroup.value = record;
  authRoleIds.value = record.roleIds ? [...record.roleIds] : [];
  authVisible.value = true;
}

async function handleAuthSubmit() {
  if (!authGroup.value) {
    return;
  }
  authLoading.value = true;
  try {
    const { error } = await fetchUpdateGroupAuth(authGroup.value.id, authRoleIds.value);
    if (error) {
      window.$message?.error?.($t('common.updateFailed'));
      return;
    }
    window.$message?.success?.($t('common.updateSuccess'));
    authVisible.value = false;
    getData();
  } finally {
    authLoading.value = false;
  }
}

async function loadRoles() {
  const { data: roles, error } = await fetchGetRoleOptions();
  if (error || !roles) {
    return;
  }
  roleOptions.value = roles.map(item => ({ label: item.roleName, value: item.id }));
}

watch(visible, val => {
  if (val) {
    getData();
  }
});

watch(editVisible, val => {
  if (val) {
    resetFields();
  }
});

onMounted(() => {
  loadRoles();
});
</script>

<template>
  <AModal v-model:open="visible" :title="$t('page.manage.monitor.group.title')" :width="820" :footer="null">
    <div class="mb-16px flex-y-center justify-end gap-12px">
      <AInput
        v-model:value="searchParams.groupName"
        :placeholder="$t('page.manage.monitor.group.form.groupName')"
        class="w-200px"
        allow-clear
        @press-enter="getData()"
      />
      <AButton @click="getData()">{{ $t('common.search') }}</AButton>
      <AButton type="primary" @click="handleAdd">{{ $t('page.manage.monitor.group.addGroup') }}</AButton>
    </div>
    <ATable
      :columns="columns"
      :data-source="data"
      size="small"
      :scroll="{ x: 480 }"
      :loading="loading"
      row-key="id"
      :pagination="{ pageSize: 10 }"
    />

    <AModal v-model:open="editVisible" :title="editTitle" :width="480" :mask-closable="false">
      <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
        <AFormItem :label="$t('page.manage.monitor.group.groupName')" name="groupName">
          <AInput
            v-model:value="model.groupName"
            :maxlength="GROUP_NAME_MAX"
            show-count
            :placeholder="$t('page.manage.monitor.group.form.groupName')"
          />
        </AFormItem>
        <AFormItem :label="$t('page.manage.monitor.group.description')" name="description">
          <ATextarea v-model:value="model.description" :maxlength="DESCRIPTION_MAX" show-count :rows="2" />
        </AFormItem>
        <AFormItem :label="$t('page.manage.monitor.group.orderNum')" name="orderNum">
          <AInputNumber v-model:value="model.orderNum" :min="0" class="w-full" />
        </AFormItem>
        <AFormItem :label="$t('page.manage.monitor.group.roleIds')" name="roleIds">
          <ASelect v-model:value="model.roleIds" :options="roleOptions" mode="multiple" allow-clear />
        </AFormItem>
      </AForm>
      <template #footer>
        <div class="flex-y-center justify-end gap-12px">
          <AButton @click="editVisible = false">{{ $t('common.cancel') }}</AButton>
          <AButton type="primary" :loading="submitLoading" @click="handleSubmit">{{ $t('common.confirm') }}</AButton>
        </div>
      </template>
    </AModal>

    <AModal
      v-model:open="authVisible"
      :title="$t('page.manage.monitor.group.authTitle', { name: authGroup?.groupName ?? '' })"
      :width="480"
    >
      <ASelect v-model:value="authRoleIds" :options="roleOptions" mode="multiple" class="w-full" />
      <template #footer>
        <div class="flex-y-center justify-end gap-12px">
          <AButton @click="authVisible = false">{{ $t('common.cancel') }}</AButton>
          <AButton type="primary" :loading="authLoading" @click="handleAuthSubmit">{{ $t('common.confirm') }}</AButton>
        </div>
      </template>
    </AModal>
  </AModal>
</template>

<style scoped></style>
