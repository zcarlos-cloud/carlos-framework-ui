<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import type { TableRowSelection } from 'ant-design-vue/es/table/interface';
import { yesOrNoRecord } from '@/constants/common';
import { fetchDeleteMenu, fetchGetAllMenus, fetchGetAllPages } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { type TreeNode, collectWithAncestors, listToTree } from '@/utils/tree';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import SvgIcon from '@/components/custom/svg-icon.vue';
import MenuOperateDrawer, { type OperateType } from './modules/menu-operate-drawer.vue';
import MenuSearch from './modules/menu-search.vue';

// 菜单类别/状态改由后端枚举字典驱动（sys 模块）；常量名仍是下发与回传的承载值
ensureEnumDict('sys');

/**
 * 树形表格的横向宽度需显式指定
 *
 * 默认的 702 是按 2 个按钮的简单表格估的；本页 9 列，且首列要容纳
 * 「展开箭头 + 层级缩进」，故显式传更宽的值
 */
const TABLE_SCROLL_X = 1100;

/** 层级缩进的像素基数，与模板里的 :indent-size 保持一致 */
const INDENT_SIZE = 15;

const { tableWrapperRef, scrollConfig } = useTableScroll(TABLE_SCROLL_X);

/** 全量菜单（含按钮权限），同时供抽屉选择「上级菜单」 */
const menuList = ref<Api.SystemManage.Menu[]>([]);

/**
 * 把「全量菜单」端点适配成 useTable 期望的分页结构
 *
 * 本页是树形 + 客户端过滤，需要**全量**菜单才能建出完整层级并补出祖先链，分页接口不适用。
 * 此前走的是 `/sys/menu/pageWithButtons?size=50`，而库中菜单早已超过 50 条 ——
 * 第 51 条起静默消失，既不在树上也搜不到。现改用 `/sys/menu/all`。
 *
 * 失败分支直接透传原结果：FlatResponseFailData 要求同时带 error 与 response，手工构造容易漏字段。
 */
async function fetchMenuListAsPage() {
  const result = await fetchGetAllMenus();

  if (result.error) {
    return result;
  }

  const records = result.data ?? [];
  menuList.value = records;

  return {
    ...result,
    data: { records, current: 1, size: records.length, total: records.length }
  };
}

const { columns, columnChecks, data, getData, loading } = useTable({
  apiFn: fetchMenuListAsPage,
  // 不传 apiParams：数据一次拉全，过滤在客户端完成，
  // searchParams 由本页自建（见下方 createDefaultSearchParams）
  columns: () => [
    {
      // menuName 放在首列：antd 把展开箭头渲染在首个数据列内，
      // 缩进也是加在这一列上，故不能再让 index 序号列占位
      key: 'menuName',
      dataIndex: 'menuName',
      title: $t('page.manage.menu.menuName'),
      align: 'left',
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      ellipsis: true,
      customRender: ({ record }) => {
        const { i18nKey, menuName } = record;

        return <span>{i18nKey ? $t(i18nKey) : menuName}</span>;
      }
    },
    {
      key: 'menuCategory',
      title: $t('page.manage.menu.menuType'),
      align: 'center',
      width: 80,
      customRender: ({ record }) => {
        const { menuCategory } = record;

        if (!menuCategory) {
          return null;
        }

        return (
          <Tag color={enumDictColor('sys', 'MenuCategory', menuCategory)}>
            {enumDictText('sys', 'MenuCategory', menuCategory)}
          </Tag>
        );
      }
    },
    {
      key: 'icon',
      title: $t('page.manage.menu.icon'),
      align: 'center',
      width: 60,
      customRender: ({ record }) => {
        const icon = record.iconType === 'ICONIFY' ? record.icon : undefined;

        const localIcon = record.iconType === 'LOCAL' ? record.icon : undefined;

        return (
          <div class="flex-center">
            <SvgIcon icon={icon} localIcon={localIcon} class="text-icon" />
          </div>
        );
      }
    },
    {
      key: 'routeName',
      dataIndex: 'routeName',
      title: $t('page.manage.menu.routeName'),
      align: 'center',
      width: 140,
      ellipsis: true
    },
    {
      key: 'routePath',
      dataIndex: 'routePath',
      title: $t('page.manage.menu.routePath'),
      align: 'center',
      width: 140,
      ellipsis: true
    },
    {
      key: 'menuStatus',
      title: $t('page.manage.menu.menuStatus'),
      align: 'center',
      width: 80,
      customRender: ({ record }) => {
        const { menuStatus } = record;

        if (!menuStatus) {
          return null;
        }

        return (
          <Tag color={enumDictColor('sys', 'MenuStatus', menuStatus)}>
            {enumDictText('sys', 'MenuStatus', menuStatus)}
          </Tag>
        );
      }
    },
    {
      key: 'hideInMenu',
      dataIndex: 'hideInMenu',
      title: $t('page.manage.menu.hideInMenu'),
      align: 'center',
      width: 80,
      customRender: ({ record }) => {
        const hide: CommonType.YesOrNo = record.hideInMenu ? 'Y' : 'N';

        const tagMap: Record<CommonType.YesOrNo, string> = {
          Y: 'error',
          N: 'default'
        };

        return <Tag color={tagMap[hide]}>{$t(yesOrNoRecord[hide])}</Tag>;
      }
    },
    {
      key: 'orderNum',
      dataIndex: 'orderNum',
      title: $t('page.manage.menu.order'),
      align: 'center',
      width: 60
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 230,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          {record.menuCategory === 'DIRECTORY' && (
            <Button type="primary" ghost size="small" onClick={() => handleAddChildMenu(record)}>
              {$t('page.manage.menu.addChildMenu')}
            </Button>
          )}
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
  openDrawer,
  handleEdit,
  editingData,
  checkedRowKeys,
  rowSelection: baseRowSelection,
  onBatchDeleted,
  onDeleted
} = useTableOperate(data, getData);

/** 菜单比其他模块多一种操作类型 addChild（新增子菜单），故 operateType 由本页自己维护 */
const operateType = ref<OperateType>('add');

const deleting = ref(false);

/**
 * 搜索模型：做成客户端过滤后，它不再由 useTable 的 apiParams 派生
 * （useHookTable 的 searchParams 是用 apiParams 初始化的，字段不写进 apiParams
 * 就不会出现在 model 上，输入框会失去响应式）
 */
function createDefaultSearchParams(): Api.SystemManage.MenuSearchParams {
  return {
    keyword: undefined,
    menuCategory: undefined,
    menuStatus: undefined,
    hideInMenu: undefined,
    clientType: undefined
  };
}

const searchParams = ref<Api.SystemManage.MenuSearchParams>(createDefaultSearchParams());

/** 过滤是响应式的 computed，按下「搜索」无需额外动作，保留按钮仅为符合页面习惯 */
function handleSearch() {
  // no-op：输入即过滤
}

function handleResetSearchParams() {
  searchParams.value = createDefaultSearchParams();
}

/** 兄弟节点按 orderNum 升序；相同则按 createTime 倒序（与后端 getMenuTree 一致） */
function compareMenu(a: Api.SystemManage.Menu, b: Api.SystemManage.Menu): number {
  const orderA = a.orderNum ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.orderNum ?? Number.MAX_SAFE_INTEGER;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return String(b.createTime ?? '').localeCompare(String(a.createTime ?? ''));
}

/**
 * 树形数据：客户端过滤 + 补全祖先链 + 建树
 *
 * 为什么过滤放在客户端：后端 keyword 过滤只返回**命中行**，父级不在结果里，
 * 而树形必须保留祖先链才能表达层级 —— 也就是说无论如何都需要全量数据。
 * 既然如此就只留一条代码路径（一次拉全 + 客户端过滤），
 * 增删改后重新拉取即为最新，不存在缓存失效问题。
 *
 * 代价：本页不再消费后端 SysMenuPageParam 的过滤参数（那些能力本身是正确的），
 * 这一点已在 SKILL.md 的「树形列表」例外条款中记录。
 */
const treeData = computed<TreeNode<Api.SystemManage.Menu>[]>(() => {
  const all = data.value as unknown as Api.SystemManage.Menu[];
  const { keyword, menuCategory, menuStatus, hideInMenu, clientType } = searchParams.value;

  const matched = all.filter(item => {
    if (keyword) {
      const kw = keyword.trim().toLowerCase();
      const hitName = (item.menuName ?? '').toLowerCase().includes(kw);
      const hitRoute = (item.routeName ?? '').toLowerCase().includes(kw);

      if (!hitName && !hitRoute) {
        return false;
      }
    }

    if (menuCategory && item.menuCategory !== menuCategory) {
      return false;
    }

    if (menuStatus && item.menuStatus !== menuStatus) {
      return false;
    }

    if (hideInMenu !== undefined && Boolean(item.hideInMenu) !== (hideInMenu === 'Y')) {
      return false;
    }

    if (clientType && item.clientType !== clientType) {
      return false;
    }

    return true;
  });

  // 命中节点不足以构成完整层级，必须把它们的所有祖先一并纳入
  const keptIds = collectWithAncestors(all, new Set(matched.map(item => item.id)));
  const kept = all.filter(item => keptIds.has(item.id));

  return listToTree(kept, compareMenu);
});

/** 展开的行：默认只展开顶层 */
const expandedRowKeys = ref<string[]>([]);

/** 全部展开 / 收起 */
const allExpanded = ref(false);

/** 全量菜单 id（含被客户端过滤掉的），供「全部展开」用 */
const allRowKeys = computed(() => (data.value as unknown as Api.SystemManage.Menu[]).map(item => String(item.id)));

function toggleExpandAll() {
  allExpanded.value = !allExpanded.value;
  expandedRowKeys.value = allExpanded.value ? allRowKeys.value : [];
}

/**
 * 首次拿到数据时只铺开顶层
 *
 * ⚠️ 必须等到**非空**的树再初始化：`immediate: true` 会先以空数组执行一次，
 * 若那次就把 `expandedInitialized` 置真，之后真正的数据到达时会被直接跳过，
 * 结果就是「从来不展开」。菜单页此前正是漏了 `tree.length === 0` 这个条件。
 */
const expandedInitialized = ref(false);

watch(
  treeData,
  tree => {
    // 只在首次拿到数据时铺开顶层；之后保留用户的展开状态，
    // 否则每次增删改重新拉取都会把树折叠回去
    if (expandedInitialized.value || tree.length === 0) {
      return;
    }

    expandedRowKeys.value = tree.map(node => String(node.id));
    expandedInitialized.value = true;
  },
  { immediate: true }
);

function handleExpandedRowsChange(keys: readonly (string | number)[]) {
  expandedRowKeys.value = keys.map(String);
}

/**
 * 树形下的行选择必须覆盖 useTableOperate 的默认行为
 *
 * 后端 deleteMenu 对「存在子菜单」的节点直接抛 SYS_MENU_HAS_CHILDREN，
 * 而 antd 默认是**级联勾选**：勾父节点会带上全部子节点。若子节点在 id 集合里
 * 排在前，就会出现「子节点已删、父节点报错」的部分删除。
 *
 * 处理：checkStrictly 断掉级联 + 禁用有子节点行的勾选框（反正也删不掉）。
 */
const rowSelection = computed<TableRowSelection<Api.SystemManage.Menu>>(() => ({
  // useTableOperate 返回的是 TableRowSelection<TableDataWithIndex<Menu>>，
  // 与这里的 <Menu> 只差一个不参与运行时的 index 字段；onChange 是函数属性、
  // 在 strictFunctionTypes 下参数逆变，故必须经 unknown 才能收窄
  ...(baseRowSelection.value as unknown as TableRowSelection<Api.SystemManage.Menu>),
  checkStrictly: true,
  getCheckboxProps: (record: Api.SystemManage.Menu) => ({
    disabled: Array.isArray(record.children) && record.children.length > 0
  })
}));

/**
 * 列定义在 useTableOperate 之前，而它解构出的是 const（不提升），
 * 直接引用会触发 @typescript-eslint/no-use-before-define。
 * 用函数声明（会提升）包一层即可，调用发生在点击时，必然已就绪。
 */
function edit(id: string) {
  operateType.value = 'edit';
  handleEdit(id);
}

function handleAddChildMenu(parent: AntDesign.TableDataWithIndex<Api.SystemManage.Menu>) {
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
    const { error } = await fetchDeleteMenu(ids);

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
    const { error } = await fetchDeleteMenu([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    deleting.value = false;
  }
}

const allPages = ref<string[]>([]);

async function getAllPages() {
  const { data: pages } = await fetchGetAllPages();
  allPages.value = pages || [];
}

function init() {
  getAllPages();
}

// init
init();
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <MenuSearch v-model:model="searchParams" @reset="handleResetSearchParams" @search="handleSearch" />
    <ACard
      :title="$t('page.manage.menu.title')"
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
              {{ allExpanded ? $t('page.manage.menu.collapseAll') : $t('page.manage.menu.expandAll') }}
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

      <MenuOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        :all-pages="allPages"
        :menu-list="menuList"
        @submitted="getData"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
