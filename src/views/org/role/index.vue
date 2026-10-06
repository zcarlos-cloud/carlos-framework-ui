<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchChangeRoleState, fetchDeleteRole, fetchGetRoleList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import RoleOperateDrawer from './modules/role-operate-drawer.vue';
import RoleSearch from './modules/role-search.vue';

// 角色状态改由后端枚举字典驱动：搜索栏与抽屉共用本页加载的字典
ensureEnumDict('org');

/**
 * 列宽：定宽列合计 64+160+180+100+130 = 634，description 吃剩余宽度。
 * 默认 702 只给 description 留 68px，太窄，故给到 900。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(900);

const {
  columns,
  columnChecks,
  data,
  loading,
  getData,
  getDataByPage,
  mobilePagination,
  searchParams,
  resetSearchParams
} = useTable({
  apiFn: fetchGetRoleList,
  apiParams: {
    current: 1,
    size: 10,
    roleStatus: undefined,
    roleName: undefined,
    roleCode: undefined
  },
  columns: () => [
    {
      key: 'index',
      dataIndex: 'index',
      title: $t('common.index'),
      width: 64,
      align: 'center'
    },
    {
      key: 'roleName',
      dataIndex: 'roleName',
      title: $t('page.organization.role.roleName'),
      align: 'center',
      width: 160,
      ellipsis: true
    },
    {
      key: 'roleCode',
      dataIndex: 'roleCode',
      title: $t('page.organization.role.roleCode'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'description',
      dataIndex: 'description',
      title: $t('page.organization.role.roleDesc'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'roleStatus',
      dataIndex: 'roleStatus',
      title: $t('page.organization.role.roleStatus'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('org', 'OrgRoleState', record.roleStatus)}>
          {enumDictText('org', 'OrgRoleState', record.roleStatus)}
        </Tag>
      )
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      // 三个按钮：编辑 + 启用/禁用 + 删除，宽度按「不换行」取值
      width: 200,
      customRender: ({ record }) => {
        // 后端 OrgRoleVO.roleStatus 是 Integer，Jackson 下发数字；统一成字符串再严格比较
        const enabled = String(record.roleStatus) === '1';
        return (
          <div class="flex-center gap-8px">
            <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
              {$t('common.edit')}
            </Button>
            <Button danger={enabled} ghost size="small" onClick={() => handleToggleState(record.id, enabled ? 0 : 1)}>
              {enabled ? $t('page.manage.common.status.disable') : $t('page.manage.common.status.enable')}
            </Button>
            <Popconfirm onConfirm={() => handleDelete(record.id)} title={$t('common.confirmDelete')}>
              <Button danger size="small">
                {$t('common.delete')}
              </Button>
            </Popconfirm>
          </div>
        );
      }
    }
  ]
});

const {
  drawerVisible,
  operateType,
  editingData,
  handleAdd,
  handleEdit,
  checkedRowKeys,
  rowSelection,
  onBatchDeleted,
  onDeleted
  // closeDrawer
} = useTableOperate(data, getData);

const deleting = ref(false);

async function handleBatchDelete() {
  const ids = checkedRowKeys.value as string[];

  // 其余页面都有这道守卫，本页此前漏了 —— 目前只因按钮被禁用才走不到，
  // 但缺了它一旦按钮的禁用条件被改动就会发一个空 ids 的删除请求
  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteRole(ids);
    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }
    // success toast 由 onBatchDeleted 内部统一发出，此处不得重复
    await onBatchDeleted();
  } finally {
    deleting.value = false;
  }
}

async function handleDelete(id: string) {
  deleting.value = true;
  try {
    const { error } = await fetchDeleteRole([id]);
    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }
    await onDeleted();
  } finally {
    deleting.value = false;
  }
}

function edit(id: string) {
  handleEdit(id);
}

/** 启用 / 禁用角色（后端 changeState 只接受 0 禁用 / 1 启用） */
async function handleToggleState(id: string, next: 0 | 1) {
  const { error } = await fetchChangeRoleState(id, next);
  if (error) {
    // 请求层已弹过提示，此处不得重复
    return;
  }
  window.$message?.success?.($t('page.organization.role.stateChanged'));
  await getData();
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <RoleSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.organization.role.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0 || deleting"
          :loading="loading"
          @add="handleAdd"
          @delete="handleBatchDelete"
          @refresh="getData"
        />
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="data"
        :row-selection="rowSelection"
        :loading="loading"
        row-key="id"
        size="small"
        :pagination="mobilePagination"
        :scroll="scrollConfig"
        class="h-full"
      />
      <RoleOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
