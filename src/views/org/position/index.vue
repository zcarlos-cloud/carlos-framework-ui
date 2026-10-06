<script setup lang="tsx">
import { onMounted, ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import {
  fetchDeletePosition,
  fetchGetDepartmentTree,
  fetchGetPositionCategoryList,
  fetchGetPositionLevelList,
  fetchGetPositionList
} from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import OrgPositionOperateDrawer from './modules/org-position-operate-drawer.vue';
import OrgPositionSearch from './modules/org-position-search.vue';

// 类别/性质/状态改由后端枚举字典驱动：搜索栏与抽屉共用本页加载的字典
ensureEnumDict('org');

const TABLE_SCROLL_X = 1200;

const { tableWrapperRef, scrollConfig } = useTableScroll(TABLE_SCROLL_X);

/** 部门 id → 名称 / 部门树（列表列展示与表单下拉用，须定义在 useTable 之前） */
const deptNameById = ref<Map<string, string>>(new Map());
const deptTree = ref<Api.Organization.DepartmentTree[]>([]);

const {
  columns,
  columnChecks,
  data,
  getData,
  getDataByPage,
  loading,
  mobilePagination,
  searchParams,
  resetSearchParams
} = useTable({
  apiFn: fetchGetPositionList,
  apiParams: {
    current: 1,
    size: 10,
    // 搜索字段必须在此显式声明且初值为 undefined，否则表单不响应
    positionCode: undefined,
    positionName: undefined,
    positionType: undefined,
    positionNature: undefined,
    positionStatus: undefined
  },
  columns: () => [
    {
      key: 'index',
      title: $t('common.index'),
      dataIndex: 'index',
      align: 'center',
      width: 64
    },
    {
      key: 'positionCode',
      dataIndex: 'positionCode',
      title: $t('page.organization.position.positionCode'),
      align: 'center',
      width: 140,
      ellipsis: true
    },
    {
      key: 'positionName',
      dataIndex: 'positionName',
      title: $t('page.organization.position.positionName'),
      align: 'center',
      width: 160,
      ellipsis: true
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'departmentId',
      title: $t('page.organization.position.departmentId'),
      align: 'center',
      ellipsis: true,
      customRender: ({ record }) => {
        const { departmentId } = record;

        if (!departmentId) {
          return null;
        }

        // 部门树一次拉全，超出范围时回退展示原始 id
        return <span>{deptNameById.value.get(String(departmentId)) ?? departmentId}</span>;
      }
    },
    {
      key: 'positionType',
      title: $t('page.organization.position.positionType'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        // 字典查不到时 enumDictText 回落显示原码值，不会让表格卡死
        <Tag color={enumDictColor('org', 'OrgPositionType', record.positionType)}>
          {enumDictText('org', 'OrgPositionType', record.positionType)}
        </Tag>
      )
    },
    {
      key: 'positionNature',
      title: $t('page.organization.position.positionNature'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('org', 'OrgPositionNature', record.positionNature)}>
          {enumDictText('org', 'OrgPositionNature', record.positionNature)}
        </Tag>
      )
    },
    {
      key: 'headcount',
      dataIndex: 'headcount',
      title: $t('page.organization.position.headcount'),
      align: 'center',
      width: 90
    },
    {
      key: 'currentCount',
      dataIndex: 'currentCount',
      title: $t('page.organization.position.currentCount'),
      align: 'center',
      width: 90
    },
    {
      key: 'positionStatus',
      title: $t('page.organization.position.positionStatus'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('org', 'OrgPositionStatus', record.positionStatus)}>
          {enumDictText('org', 'OrgPositionStatus', record.positionStatus)}
        </Tag>
      )
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 130,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
            {$t('common.edit')}
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
} = useTableOperate(data, getData);

const deleting = ref(false);

/** 表单下拉候选项 */
const categoryOptions = ref<CommonType.Option<string>[]>([]);
const levelOptions = ref<CommonType.Option<string>[]>([]);
const positionList = ref<Api.Organization.Position[]>([]);

function flattenDepts(nodes: Api.Organization.DepartmentTree[]): Api.Organization.DepartmentTree[] {
  const result: Api.Organization.DepartmentTree[] = [];

  const walk = (list: Api.Organization.DepartmentTree[]) => {
    list.forEach(node => {
      result.push(node);

      if (node.children?.length) {
        walk(node.children);
      }
    });
  };

  walk(nodes);

  return result;
}

async function initOptions() {
  const [deptRes, categoryRes, levelRes, positionRes] = await Promise.all([
    fetchGetDepartmentTree(),
    fetchGetPositionCategoryList({ current: 1, size: 200 }),
    fetchGetPositionLevelList({ current: 1, size: 200 }),
    fetchGetPositionList({ current: 1, size: 200 })
  ]);

  if (!deptRes.error && deptRes.data) {
    deptTree.value = deptRes.data;
    deptNameById.value = new Map(flattenDepts(deptRes.data).map(node => [String(node.id), node.deptName]));
  }

  if (!categoryRes.error && categoryRes.data) {
    categoryOptions.value = categoryRes.data.records.map(item => ({
      label: item.categoryName,
      value: item.id
    }));
  }

  if (!levelRes.error && levelRes.data) {
    levelOptions.value = levelRes.data.records.map(item => ({
      label: item.levelName,
      value: item.id
    }));
  }

  if (!positionRes.error && positionRes.data) {
    // 传原始记录而不是 Option 列表：抽屉选上级岗位时要按 parentId 剔除自身及其子树
    positionList.value = positionRes.data.records;
  }
}

async function handleBatchDelete() {
  const ids = checkedRowKeys.value;

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeletePosition(ids);

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
    const { error } = await fetchDeletePosition([id]);

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

/** 新增/编辑后候选项可能变化，重新拉取 */
async function handleSubmitted() {
  await getDataByPage();
  await initOptions();
}

onMounted(() => {
  initOptions();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <OrgPositionSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.organization.position.title')"
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
        size="small"
        :row-selection="rowSelection"
        :scroll="scrollConfig"
        :loading="loading"
        row-key="id"
        :pagination="mobilePagination"
        class="h-full"
      />

      <OrgPositionOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        :dept-tree="deptTree"
        :category-options="categoryOptions"
        :level-options="levelOptions"
        :position-list="positionList"
        @submitted="handleSubmitted"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
