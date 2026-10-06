<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import type { TableRowSelection } from 'ant-design-vue/es/table/interface';
import {
  fetchChangeDepartmentState,
  fetchDeleteDepartment,
  fetchGetDepartmentTree,
  fetchGetUserList
} from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { type TreeNode, collectWithAncestors, listToTree } from '@/utils/tree';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import OrgDepartmentOperateDrawer, { type OperateType } from './modules/org-department-operate-drawer.vue';
import OrgDepartmentSearch from './modules/org-department-search.vue';

// 部门状态改由后端枚举字典驱动：搜索栏共用本页加载的字典
ensureEnumDict('org');

/**
 * 树形表格的横向宽度需显式指定
 *
 * 默认的 702 是按 2 个按钮的简单表格估的；本页 6 列，且首列要容纳
 * 「展开箭头 + 层级缩进」，故显式传更宽的值
 */
const TABLE_SCROLL_X = 1100;

/** 层级缩进的像素基数，与模板里的 :indent-size 保持一致 */
const INDENT_SIZE = 15;

const { tableWrapperRef, scrollConfig } = useTableScroll(TABLE_SCROLL_X);

/**
 * 后端 /org/department/tree 返回嵌套树，这里摊平成列表供 useTable 消费
 *
 * 摊平后仍用 DepartmentTree（**不带** audit 字段）而不是 Department：树端点的
 * OrgDepartmentTreeVO 本身就不返回 createBy/createTime 等公共字段，
 * 用扁平列表的 VO 类型去接会凭空多出并不存在的字段。
 */
function flattenDepartments(nodes: Api.Organization.DepartmentTree[]): Api.Organization.DepartmentTree[] {
  const result: Api.Organization.DepartmentTree[] = [];

  const walk = (list: Api.Organization.DepartmentTree[]) => {
    list.forEach(node => {
      const { children, ...rest } = node;

      result.push(rest);

      if (children?.length) {
        walk(children);
      }
    });
  };

  walk(nodes);

  return result;
}

/**
 * 把「全量部门树」端点适配成 useTable 期望的分页结构
 *
 * 部门树不分页，也没有后端过滤参数；一次拉全后由页面做客户端过滤 + 重新建树
 * （与「菜单管理」同样的取舍，见 SKILL.md 的树形列表例外条款）。
 *
 * 失败分支直接透传原结果：FlatResponseFailData 要求同时带 error 与 response，
 * 手工构造容易漏字段。
 */
async function fetchDepartmentTreeAsPage() {
  const result = await fetchGetDepartmentTree();

  if (result.error) {
    return result;
  }

  const records = flattenDepartments(result.data ?? []);

  return {
    ...result,
    data: { records, current: 1, size: records.length, total: records.length }
  };
}

/** 负责人候选项 + id → 昵称映射（列表列展示用，须定义在 useTable 之前） */
const userOptions = ref<CommonType.Option<string>[]>([]);
const userNameById = ref<Map<string, string>>(new Map());

const { columns, columnChecks, data, getData, loading } = useTable({
  apiFn: fetchDepartmentTreeAsPage,
  // 不传 apiParams：数据由 fetchDepartmentTreeAsPage 一次拉全，过滤在客户端完成，
  // searchParams 由本页自建（见下方 createDefaultSearchParams）
  columns: () => [
    {
      // deptName 放在首列：antd 把展开箭头渲染在首个数据列内，
      // 缩进也是加在这一列上，故不能再让 index 序号列占位
      key: 'deptName',
      dataIndex: 'deptName',
      title: $t('page.organization.department.deptName'),
      align: 'left',
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      ellipsis: true
    },
    {
      key: 'deptCode',
      dataIndex: 'deptCode',
      title: $t('page.organization.department.deptCode'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'leaderId',
      title: $t('page.organization.department.leaderId'),
      align: 'center',
      width: 120,
      customRender: ({ record }) => {
        const { leaderId } = record;

        if (!leaderId) {
          return null;
        }

        // 候选人只拉首页 200 条，超出范围的负责人回退展示原始 id
        return <span>{userNameById.value.get(String(leaderId)) ?? leaderId}</span>;
      }
    },
    {
      key: 'orderNum',
      dataIndex: 'orderNum',
      title: $t('page.organization.department.orderNum'),
      align: 'center',
      width: 80
    },
    {
      key: 'deptStatus',
      title: $t('page.organization.department.deptStatus'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('org', 'OrgDepartmentState', record.deptStatus)}>
          {enumDictText('org', 'OrgDepartmentState', record.deptStatus)}
        </Tag>
      )
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      // 四个按钮平铺：新增下级 / 编辑 / 启用-禁用 / 删除
      width: 260,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => handleAddChildDepartment(record)}>
            {$t('page.organization.department.childDept')}
          </Button>
          <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
            {$t('common.edit')}
          </Button>
          {/*
            部门状态只能通过专用的 changeState 端点修改 ——
            OrgDepartmentCreateParam / UpdateParam 里**没有** deptStatus 字段，
            所以此前这个状态在界面上只能看、不能改（fetchChangeDepartmentState 一直零引用）。
          */}
          <Button
            danger
            ghost
            size="small"
            loading={isPending(record.id)}
            onClick={() => handleToggleState(record.id, String(record.deptStatus) === '1' ? '0' : '1')}
          >
            {String(record.deptStatus) === '1'
              ? $t('page.manage.common.status.disable')
              : $t('page.manage.common.status.enable')}
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
  openDrawer,
  handleEdit,
  editingData,
  checkedRowKeys,
  rowSelection: baseRowSelection,
  onBatchDeleted,
  onDeleted
} = useTableOperate(data, getData);

/** 本页多一种 addChild（新增下级部门），故 operateType 由本页自己维护 */
const operateType = ref<OperateType>('add');

const deleting = ref(false);

/**
 * 搜索模型：做成客户端过滤后，它不再由 useTable 的 apiParams 派生
 * （useHookTable 的 searchParams 是用 apiParams 初始化的，字段不写进 apiParams
 * 就不会出现在 model 上，输入框会失去响应式）
 */
function createDefaultSearchParams(): Api.Organization.DepartmentSearchParams {
  return {
    deptName: undefined,
    deptStatus: undefined
  };
}

const searchParams = ref<Api.Organization.DepartmentSearchParams>(createDefaultSearchParams());

/** 过滤是响应式的 computed，按下「搜索」无需额外动作，保留按钮仅为符合页面习惯 */
function handleSearch() {
  // no-op：输入即过滤
}

function handleResetSearchParams() {
  searchParams.value = createDefaultSearchParams();
}

/** 同级按 orderNum 升序；相同则按部门名称升序（树 VO 不含 createTime） */
function compareDepartment(a: Api.Organization.DepartmentTree, b: Api.Organization.DepartmentTree): number {
  const orderA = a.orderNum ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.orderNum ?? Number.MAX_SAFE_INTEGER;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return String(a.deptName ?? '').localeCompare(String(b.deptName ?? ''));
}

/**
 * 树形数据：客户端过滤 + 补全祖先链 + 建树
 *
 * 命中节点不足以构成完整层级，必须把它们的所有祖先一并纳入，
 * 否则过滤后树形层级会断掉。
 */
const treeData = computed<TreeNode<Api.Organization.DepartmentTree>[]>(() => {
  const all = data.value as unknown as Api.Organization.DepartmentTree[];
  const { deptName, deptStatus } = searchParams.value;

  const matched = all.filter(item => {
    if (deptName) {
      const kw = deptName.trim().toLowerCase();
      const hitName = (item.deptName ?? '').toLowerCase().includes(kw);
      const hitCode = (item.deptCode ?? '').toLowerCase().includes(kw);

      if (!hitName && !hitCode) {
        return false;
      }
    }

    if (deptStatus && item.deptStatus !== deptStatus) {
      return false;
    }

    return true;
  });

  const keptIds = collectWithAncestors(all, new Set(matched.map(item => item.id)));
  const kept = all.filter(item => keptIds.has(item.id));

  return listToTree(kept, compareDepartment);
});

/** 展开的行：默认只展开顶层 */
const expandedRowKeys = ref<string[]>([]);
const expandedInitialized = ref(false);

watch(
  treeData,
  tree => {
    // 只在首次拿到**非空**数据时铺开顶层；之后保留用户的展开状态，
    // 否则每次增删改重新拉取都会把树折叠回去。
    //
    // ⚠️ `tree.length === 0` 这个条件不能省：`immediate: true` 会先以空数组执行一次，
    // 若那次就置了 expandedInitialized，真正数据到达时会被跳过 —— 表现为「从来不展开」。
    if (expandedInitialized.value || tree.length === 0) {
      return;
    }

    expandedRowKeys.value = tree.map(node => node.id);
    expandedInitialized.value = true;
  },
  { immediate: true }
);

function handleExpandedRowsChange(keys: readonly (string | number)[]) {
  expandedRowKeys.value = keys.map(String);
}

/**
 * 行内操作的 in-flight 标记（按行记录，避免所有行的按钮一起转圈）
 *
 * 本页只有一个行内动作（启用/禁用），所以用 id 一个维度就够，不必再带动作名。
 */
const pendingAction = ref('');

function isPending(id: string) {
  return pendingAction.value === id;
}

/**
 * 启用 / 禁用部门
 *
 * 必须走后端专用的 `/org/department/changeState` ——
 * `OrgDepartmentCreateParam` / `OrgDepartmentUpdateParam` 里都**没有** deptStatus 字段，
 * 状态无法通过新增/编辑接口改变。该端点入参是 Integer 数字码（0 禁用 / 1 启用）。
 */
async function handleToggleState(id: string, next: Extract<Api.Organization.DeptStatus, '0' | '1'>) {
  pendingAction.value = id;

  try {
    const { error } = await fetchChangeDepartmentState(id, next);

    if (error) {
      // 请求层已弹过提示，此处不得重复
      return;
    }

    window.$message?.success?.($t('page.organization.department.stateChanged'));
    await getData();
  } finally {
    pendingAction.value = '';
  }
}

/**
 * 树形下的行选择必须覆盖 useTableOperate 的默认行为
 *
 * 后端 deleteOrgDepartment 对「存在子部门」的节点直接抛 DepartmentHasChildrenException，
 * 而 antd 默认是**级联勾选**：勾父节点会带上全部子节点。若子节点在 id 集合里
 * 排在前，就会出现「子部门已删、父部门报错」的部分删除。
 *
 * 处理：checkStrictly 断掉级联 + 禁用有子节点行的勾选框（反正也删不掉）。
 */
const rowSelection = computed<TableRowSelection<Api.Organization.DepartmentTree>>(() => ({
  ...(baseRowSelection.value as unknown as TableRowSelection<Api.Organization.DepartmentTree>),
  checkStrictly: true,
  getCheckboxProps: (record: Api.Organization.DepartmentTree) => ({
    disabled:
      Array.isArray((record as TreeNode<Api.Organization.DepartmentTree>).children) &&
      (record as TreeNode<Api.Organization.DepartmentTree>).children.length > 0
  })
}));

/** 负责人候选项 + id → 昵称映射（列表列展示用） */
async function getUserOptions() {
  const { data: users, error } = await fetchGetUserList({ current: 1, size: 200 });

  if (error) {
    return;
  }

  userOptions.value = users.records.map(item => ({
    label: item.nickname || item.account,
    value: item.id
  }));

  userNameById.value = new Map(users.records.map(item => [String(item.id), item.nickname || item.account]));
}

/**
 * 列定义在 useTableOperate 之前，而它解构出的是 const（不提升），
 * 直接引用会触发 @typescript-eslint/no-use-before-define。
 * 用函数声明（会提升）包一层即可，调用发生在点击时，必然已就绪。
 */
function edit(id: string) {
  operateType.value = 'edit';
  handleEdit(id);
}

function handleAddChildDepartment(parent: AntDesign.TableDataWithIndex<Api.Organization.DepartmentTree>) {
  operateType.value = 'addChild';
  // 抽屉只读取行数据构建表单模型，不会写回，故无需拷贝
  editingData.value = parent;
  openDrawer();
}

function handleAdd() {
  operateType.value = 'add';
  editingData.value = null;
  openDrawer();
}

async function handleBatchDelete() {
  const ids = checkedRowKeys.value as string[];

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteDepartment(ids);

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
    const { error } = await fetchDeleteDepartment([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    deleting.value = false;
  }
}

/**
 * 全部展开 / 折叠
 *
 * 树形页的常规诉求：此前只在首次拿到数据时铺开顶层，之后就只剩逐行点箭头。
 * `expandedRowKeys` 是受控的，所以整体设置即可（叶子节点的 key 传进去也无害）。
 */
const allExpanded = ref(false);

const allRowKeys = computed(() =>
  (data.value as unknown as Api.Organization.DepartmentTree[]).map(item => String(item.id))
);

function toggleExpandAll() {
  allExpanded.value = !allExpanded.value;
  expandedRowKeys.value = allExpanded.value ? allRowKeys.value : [];
}

function init() {
  getUserOptions();
}

// init
init();
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <OrgDepartmentSearch v-model:model="searchParams" @reset="handleResetSearchParams" @search="handleSearch" />
    <ACard
      :title="$t('page.organization.department.title')"
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
        >
          <template #suffix>
            <AButton size="small" @click="toggleExpandAll">
              {{
                allExpanded
                  ? $t('page.organization.department.collapseAll')
                  : $t('page.organization.department.expandAll')
              }}
            </AButton>
          </template>
        </TableHeaderOperation>
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="treeData"
        :row-selection="rowSelection"
        :expanded-row-keys="expandedRowKeys"
        :indent-size="INDENT_SIZE"
        size="small"
        :loading="loading"
        row-key="id"
        :scroll="scrollConfig"
        :pagination="false"
        class="h-full"
        @expanded-rows-change="handleExpandedRowsChange"
      />

      <OrgDepartmentOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        :dept-tree="treeData"
        :user-options="userOptions"
        @submitted="getData"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
