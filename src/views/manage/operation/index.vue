<script setup lang="tsx">
import { computed, onMounted, ref, watch } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import type { TablePaginationConfig } from 'ant-design-vue';
import type { DataNode } from 'ant-design-vue/es/tree';
import type { TableRowSelection } from 'ant-design-vue/es/table/interface';
import { jsonClone } from '@sa/utils';
import {
  operationStatusRecord,
  operationStatusTagColor,
  operationTypeRecord,
  operationTypeTagColor
} from '@/constants/business';
import { fetchDeleteOperation, fetchGetMenuTree, fetchGetOperationTree, fetchMoveOperation } from '@/service/api';
import { useAppStore } from '@/store/modules/app';
import { useTableScroll } from '@/hooks/common/table';
import { useAuth } from '@/hooks/business/auth';
import { enumTagColor, enumText } from '@/utils/common';
import { $t } from '@/locales';
import OperationOperateDrawer from './modules/operation-operate-drawer.vue';

defineOptions({
  name: 'OperationManage'
});

const { hasAuth } = useAuth();

/** 树虚拟节点 key：全部操作 */
const ALL_KEY = 'all';
/** 树虚拟节点 key：未挂菜单的独立接口（对应后端分组 menuId=0） */
const INDEPENDENT_KEY = 'independent';
/** 后端独立接口分组的 menuId 值 */
const INDEPENDENT_MENU_ID = '0';

const appStore = useAppStore();

/**
 * 列宽：定宽列合计 64+140+180+160+100+100+100+130 = 974，apiPath 吃剩余宽度。
 * 默认 702 装不下，给到 1100 让路径列剩约 126px。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1100);

// ── 数据加载 ────────────────────────────────────────────────────────────────

const loading = ref(false);
const tableLoading = ref(false);
const menuTreeData = ref<Api.SystemManage.MenuTree[]>([]);
const operationGroups = ref<Api.SystemManage.OperationTree[]>([]);

async function loadMenuTree() {
  const { error, data } = await fetchGetMenuTree();

  if (!error && data) {
    menuTreeData.value = data;
  }
}

async function loadOperations() {
  tableLoading.value = true;
  try {
    const { error, data } = await fetchGetOperationTree();

    if (!error && data) {
      operationGroups.value = data;
    }
  } finally {
    tableLoading.value = false;
  }
}

async function loadAll() {
  loading.value = true;
  try {
    // 菜单树与操作分组互不依赖，并行拉取；请求层 onError 已统一弹错误提示
    await Promise.all([loadMenuTree(), loadOperations()]);
  } finally {
    loading.value = false;
  }
}

// ── 树数据组装 ──────────────────────────────────────────────────────────────

interface OperationTreeNode extends DataNode {
  key: string;
  title: string;
  /** 该节点（含所有子孙菜单）下的操作数量 */
  count: number;
  children?: OperationTreeNode[];
}

/** menuId → 操作列表（含 '0' 独立接口组）；key 统一转字符串，与菜单树节点 key 对齐 */
const operationsByMenuId = computed(() => {
  const map = new Map<string, Api.SystemManage.Operation[]>();

  operationGroups.value.forEach(group => {
    map.set(String(group.menuId), group.operations ?? []);
  });

  return map;
});

/** 全部操作（含独立接口组），「全部操作」节点与行内编辑的数据源 */
const allOperations = computed(() => operationGroups.value.flatMap(group => group.operations ?? []));

/** menuId → 菜单名，用于在列表里显示操作所属菜单 */
const menuNameById = computed(() => {
  const map = new Map<string, string>();

  const walk = (nodes: Api.SystemManage.MenuTree[]) => {
    nodes.forEach(node => {
      map.set(String(node.id), node.menuName);

      if (node.children?.length) {
        walk(node.children);
      }
    });
  };

  walk(menuTreeData.value);

  return map;
});

/**
 * 菜单树节点 + 每个节点所含（自身与全部子孙）菜单 id 列表。
 * 计数与子树过滤都依赖这份 id 列表，一次递归同时产出，避免重复遍历。
 */
const menuTreeNodes = computed(() => {
  const menuIdsByKey = new Map<string, string[]>();

  const build = (list: Api.SystemManage.MenuTree[]): OperationTreeNode[] =>
    list.map(menu => {
      const key = String(menu.id);
      const children = menu.children?.length ? build(menu.children) : [];
      const menuIds = [key, ...children.flatMap(child => menuIdsByKey.get(child.key) ?? [])];

      menuIdsByKey.set(key, menuIds);

      const count = menuIds.reduce((sum, id) => sum + (operationsByMenuId.value.get(id)?.length ?? 0), 0);

      return { key, title: menu.menuName, count, children };
    });

  return { nodes: build(menuTreeData.value), menuIdsByKey };
});

const treeData = computed<OperationTreeNode[]>(() => {
  const data: OperationTreeNode[] = [
    { key: ALL_KEY, title: $t('page.manage.operation.allOperations'), count: allOperations.value.length }
  ];

  data.push(...menuTreeNodes.value.nodes);

  // 后端返回了 menuId=0 的组才显示「独立接口」节点
  if (operationsByMenuId.value.has(INDEPENDENT_MENU_ID)) {
    data.push({
      key: INDEPENDENT_KEY,
      title: $t('page.manage.operation.independentApi'),
      count: operationsByMenuId.value.get(INDEPENDENT_MENU_ID)?.length ?? 0
    });
  }

  return data;
});

// ── 树搜索 / 展开 / 选中 ─────────────────────────────────────────────────────

const treeSearchValue = ref('');

const filteredTreeData = computed<OperationTreeNode[]>(() => {
  const kw = treeSearchValue.value.trim().toLowerCase();

  if (!kw) {
    return treeData.value;
  }

  // 命中节点必须保留祖先链，否则搜索结果的层级会断掉（同 operation-auth-modal）
  const filterNodes = (nodes: OperationTreeNode[]): OperationTreeNode[] =>
    nodes.reduce<OperationTreeNode[]>((acc, node) => {
      const children = node.children?.length ? filterNodes(node.children) : [];

      if (node.title.toLowerCase().includes(kw) || children.length > 0) {
        acc.push({ ...node, children });
      }

      return acc;
    }, []);

  // 「全部操作」不参与过滤，固定置顶
  const [allNode, ...rest] = treeData.value;

  return [allNode, ...filterNodes(rest)];
});

const expandedKeys = ref<string[]>([]);

/** 收集所有「非叶子」节点的 key，用于展开 */
function collectBranchKeys(nodes: OperationTreeNode[]): string[] {
  const keys: string[] = [];

  const walk = (list: OperationTreeNode[]) => {
    list.forEach(node => {
      if (node.children?.length) {
        keys.push(node.key);
        walk(node.children);
      }
    });
  };

  walk(nodes);

  return keys;
}

/** 关键字变化时把命中链全部展开，否则用户看不到搜索结果 */
watch(treeSearchValue, () => {
  expandedKeys.value = collectBranchKeys(filteredTreeData.value);
});

const selectedKey = ref<string>(ALL_KEY);

const selectedKeys = computed<string[]>({
  get: () => [selectedKey.value],
  set: keys => {
    // 再次点击已选节点会取消选中，此时回退到「全部操作」，避免右侧列表失去上下文
    selectedKey.value = keys[0] ?? ALL_KEY;
  }
});

const selectedNodeName = computed(() => {
  const key = selectedKey.value;

  if (key === INDEPENDENT_KEY) {
    return $t('page.manage.operation.independentApi');
  }

  return menuNameById.value.get(key) ?? $t('page.manage.operation.allOperations');
});

// ── 右侧列表过滤 ────────────────────────────────────────────────────────────

type TypeFilter = Api.SystemManage.OperationType | 'ALL';

const typeFilter = ref<TypeFilter>('ALL');
const keyword = ref('');

const typeFilterOptions = computed(() => [
  { value: 'ALL', label: $t('page.manage.operation.typeFilterAll') },
  { value: 'BUTTON', label: $t('page.manage.operation.typeOptions.button') },
  { value: 'API', label: $t('page.manage.operation.typeOptions.api') }
]);

/** 当前树节点范围内的操作（不含 opType / 关键字过滤），同时也是统计 Tag 的口径 */
const scopedOperations = computed<Api.SystemManage.Operation[]>(() => {
  const key = selectedKey.value;

  if (key === ALL_KEY) {
    return allOperations.value;
  }

  const menuIds = key === INDEPENDENT_KEY ? [INDEPENDENT_MENU_ID] : (menuTreeNodes.value.menuIdsByKey.get(key) ?? []);

  const result: Api.SystemManage.Operation[] = [];

  menuIds.forEach(id => {
    const ops = operationsByMenuId.value.get(id);

    if (ops?.length) {
      result.push(...ops);
    }
  });

  return result;
});

const stats = computed(() => ({
  button: scopedOperations.value.filter(op => op.opType === 'BUTTON').length,
  api: scopedOperations.value.filter(op => op.opType === 'API').length,
  disabled: scopedOperations.value.filter(op => op.opStatus === 'DISABLED').length
}));

const filteredOperations = computed(() => {
  let list = scopedOperations.value;

  if (typeFilter.value !== 'ALL') {
    list = list.filter(op => op.opType === typeFilter.value);
  }

  const kw = keyword.value.trim().toLowerCase();

  if (kw) {
    list = list.filter(op => [op.opName, op.permCode, op.apiPath].some(field => field?.toLowerCase().includes(kw)));
  }

  return list;
});

// ── 分页（客户端） ───────────────────────────────────────────────────────────

const paginationCurrent = ref(1);
const paginationPageSize = ref(10);

/** 表格行勾选（声明在筛选 watch 之前，供其清空） */
const checkedRowKeys = ref<string[]>([]);

/** 筛选条件变化时回到第 1 页并清空勾选，否则可能停在空页 / 残留已删除范围的勾选 */
watch([selectedKey, typeFilter, keyword], () => {
  paginationCurrent.value = 1;
  checkedRowKeys.value = [];
});

const pagination = computed<TablePaginationConfig>(() => ({
  current: paginationCurrent.value,
  pageSize: paginationPageSize.value,
  total: filteredOperations.value.length,
  showSizeChanger: true,
  showTotal: total => $t('common.totalItems', { total }),
  simple: appStore.isMobile,
  onChange: (page, size) => {
    paginationCurrent.value = page;
    paginationPageSize.value = size;
  }
}));

// ── 抽屉（新增 / 编辑） ──────────────────────────────────────────────────────

const drawerVisible = ref(false);
const operateType = ref<AntDesign.TableOperateType>('add');
const editingData = ref<Api.SystemManage.Operation | null>(null);
const addPreset = ref<{ opType: Api.SystemManage.OperationType; menuId?: string } | null>(null);

/**
 * 新增预设的 menuId：仅当树选中叶子菜单（无子节点）时带入；
 * 「全部操作」/「独立接口」/目录节点不预设，按钮必须挂菜单，留给用户在抽屉里选
 */
function presetMenuId(): string | undefined {
  const key = selectedKey.value;

  if (key === ALL_KEY || key === INDEPENDENT_KEY) {
    return undefined;
  }

  const findNode = (nodes: OperationTreeNode[]): OperationTreeNode | undefined => {
    for (const node of nodes) {
      if (node.key === key) {
        return node;
      }

      const found = node.children?.length ? findNode(node.children) : undefined;

      if (found) {
        return found;
      }
    }

    return undefined;
  };

  const node = findNode(treeData.value);

  return node && !node.children?.length ? key : undefined;
}

function handleAdd(opType: Api.SystemManage.OperationType) {
  operateType.value = 'add';
  editingData.value = null;
  addPreset.value = { opType, menuId: presetMenuId() };
  drawerVisible.value = true;
}

function handleEdit(id: string) {
  operateType.value = 'edit';
  editingData.value = jsonClone(allOperations.value.find(item => item.id === id) ?? null);
  addPreset.value = null;
  drawerVisible.value = true;
}

// ── 删除 ────────────────────────────────────────────────────────────────────

const deleting = ref(false);

async function handleBatchDelete() {
  const ids = checkedRowKeys.value;

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteOperation(ids);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    // 成功提示在此统一发出（替代 useTableOperate.onBatchDeleted），页面其他地方不再重复弹
    window.$message?.success?.($t('common.deleteSuccess'));
    checkedRowKeys.value = [];
    await loadOperations();
  } finally {
    deleting.value = false;
  }
}

async function handleDelete(id: string) {
  deleting.value = true;
  try {
    const { error } = await fetchDeleteOperation([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    window.$message?.success?.($t('common.deleteSuccess'));
    await loadOperations();
  } finally {
    deleting.value = false;
  }
}

// ── 拖拽移动所属菜单 ──────────────────────────────────────────────────────────

/** 正在拖拽的操作（dragover 阶段读不到 dataTransfer 的数据，只能靠 ref 传递） */
const draggingOperation = ref<Api.SystemManage.Operation | null>(null);
/** 当前 dragover 悬停的树节点 key，用于高亮 */
const dragOverKey = ref<string | null>(null);
const moving = ref(false);

type DropCheck = { ok: true } | { ok: false; reason: 'all' | 'buttonNeedsMenu' };

function checkDropTarget(nodeKey: string): DropCheck {
  const op = draggingOperation.value;

  // 没有拖拽来源时不该走到这里；按非法处理
  if (!op) {
    return { ok: false, reason: 'all' };
  }

  if (nodeKey === ALL_KEY) {
    return { ok: false, reason: 'all' };
  }

  if (nodeKey === INDEPENDENT_KEY && op.opType !== 'API') {
    // 按钮必须挂在菜单下（后端 /sys/operation/move 同样会校验，此处是前端双保险）
    return { ok: false, reason: 'buttonNeedsMenu' };
  }

  return { ok: true };
}

/** 归一化所属菜单：null / undefined / '0' 都视为「独立接口」（与 /sys/operation/tree 的分组语义一致） */
function normalizeMenuId(menuId?: string | null): string {
  return menuId && menuId !== INDEPENDENT_MENU_ID ? menuId : INDEPENDENT_KEY;
}

function customRow(record: Api.SystemManage.Operation) {
  return {
    draggable: hasAuth('manage:operation:update'),
    onDragstart: (event: DragEvent) => {
      draggingOperation.value = record;

      // Firefox 必须 setData 才会启动拖拽；数据本体走 ref，这里只是占位
      event.dataTransfer?.setData('text/plain', record.id);

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
    },
    onDragend: () => {
      draggingOperation.value = null;
      dragOverKey.value = null;
    }
  };
}

function handleNodeDragover(nodeKey: string, event: DragEvent) {
  // 没有行在拖拽时不接管，避免影响页面上其他拖放
  if (!draggingOperation.value) {
    return;
  }

  // 非法目标也 preventDefault：否则 drop 事件不触发，给不出具体的拒绝原因
  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = checkDropTarget(nodeKey).ok ? 'move' : 'none';
  }

  dragOverKey.value = nodeKey;
}

function handleNodeDragleave(nodeKey: string) {
  if (dragOverKey.value === nodeKey) {
    dragOverKey.value = null;
  }
}

async function handleNodeDrop(nodeKey: string, nodeTitle: string) {
  const op = draggingOperation.value;

  dragOverKey.value = null;

  if (!op) {
    return;
  }

  const check = checkDropTarget(nodeKey);

  if (!check.ok) {
    const messages: Record<Exclude<DropCheck, { ok: true }>['reason'], string> = {
      all: $t('page.manage.operation.dropToAll'),
      buttonNeedsMenu: $t('page.manage.operation.buttonNeedsMenu')
    };

    window.$message?.warning?.(messages[check.reason]);
    return;
  }

  // 目标与当前所属相同：静默跳过（归一化后 'independent' 覆盖 null/undefined/'0' 三种来源值）
  if (normalizeMenuId(op.menuId) === nodeKey) {
    return;
  }

  moving.value = true;
  try {
    // 专用移动接口：menuId 传 null 表示摘除菜单、移到「独立接口」（DB 中 menu_id 置 NULL）
    const { error } = await fetchMoveOperation({
      id: op.id,
      menuId: nodeKey === INDEPENDENT_KEY ? null : nodeKey
    });

    if (error) {
      window.$message?.error?.($t('common.updateFailed'));
      return;
    }

    window.$message?.success?.($t('page.manage.operation.movedTo', { name: nodeTitle }));
    await loadOperations();
  } finally {
    moving.value = false;
  }
}

// ── 表格列 ──────────────────────────────────────────────────────────────────

const allColumns = computed<AntDesign.TableColumn<AntDesign.TableDataWithIndex<Api.SystemManage.Operation>>[]>(() => [
  {
    key: 'index',
    title: $t('common.index'),
    align: 'center',
    width: 64,
    fixed: 'left',
    customRender: ({ index }) => (paginationCurrent.value - 1) * paginationPageSize.value + index + 1
  },
  {
    key: 'opName',
    dataIndex: 'opName',
    title: $t('page.manage.operation.opName'),
    align: 'center',
    width: 140,
    ellipsis: true
  },
  {
    key: 'permCode',
    dataIndex: 'permCode',
    title: $t('page.manage.operation.permCode'),
    align: 'center',
    width: 180,
    ellipsis: true
  },
  {
    key: 'menuId',
    dataIndex: 'menuId',
    title: $t('page.manage.operation.menuId'),
    align: 'center',
    width: 160,
    ellipsis: true,
    customRender: ({ record }) => {
      const { menuId } = record;

      if (!menuId) {
        return null;
      }

      // menuId 为 "0" 表示未挂菜单的独立接口（/sys/operation/tree 的分组约定）
      if (String(menuId) === INDEPENDENT_MENU_ID) {
        return <span>{$t('page.manage.operation.independentApi')}</span>;
      }

      // 菜单树一次拉全；超出范围时回退展示原始 id
      return <span>{menuNameById.value.get(String(menuId)) ?? menuId}</span>;
    }
  },
  {
    key: 'opType',
    dataIndex: 'opType',
    title: $t('page.manage.operation.opType'),
    align: 'center',
    width: 100,
    customRender: ({ record }) => (
      <Tag color={enumTagColor(operationTypeTagColor, record.opType)}>
        {enumText(operationTypeRecord, record.opType)}
      </Tag>
    )
  },
  {
    key: 'apiMethod',
    dataIndex: 'apiMethod',
    title: $t('page.manage.operation.apiMethod'),
    align: 'center',
    width: 100
  },
  {
    // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
    key: 'apiPath',
    dataIndex: 'apiPath',
    title: $t('page.manage.operation.apiPath'),
    align: 'center',
    ellipsis: true
  },
  {
    key: 'opStatus',
    dataIndex: 'opStatus',
    title: $t('page.manage.common.statusTitle'),
    align: 'center',
    width: 100,
    customRender: ({ record }) => (
      <Tag color={enumTagColor(operationStatusTagColor, record.opStatus)}>
        {enumText(operationStatusRecord, record.opStatus)}
      </Tag>
    )
  },
  {
    key: 'operate',
    title: $t('common.operate'),
    align: 'center',
    width: 130,
    fixed: 'right',
    customRender: ({ record }) => (
      <div class="flex-center gap-8px">
        {hasAuth('manage:operation:update') && (
          <Button type="primary" ghost size="small" onClick={() => handleEdit(record.id)}>
            {$t('common.edit')}
          </Button>
        )}
        {hasAuth('manage:operation:delete') && (
          <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
            <Button danger size="small">
              {$t('common.delete')}
            </Button>
          </Popconfirm>
        )}
      </div>
    )
  }
]);

const columnChecks = ref<AntDesign.TableColumnCheck[]>([]);

function buildColumnChecks() {
  const checkedByKey = new Map(columnChecks.value.map(item => [item.key, item.checked]));

  columnChecks.value = allColumns.value
    .filter(column => column.key)
    .map(column => ({
      key: String(column.key),
      title: column.title as string,
      checked: checkedByKey.get(String(column.key)) ?? true
    }));
}

buildColumnChecks();

// 列标题跟随语言切换重建，同时保留用户的显隐勾选
watch(() => appStore.locale, buildColumnChecks);

const columns = computed(() => {
  const columnByKey = new Map(allColumns.value.map(column => [String(column.key), column]));

  return columnChecks.value
    .filter(item => item.checked)
    .map(item => columnByKey.get(item.key))
    .filter((column): column is AntDesign.TableColumn<AntDesign.TableDataWithIndex<Api.SystemManage.Operation>> =>
      Boolean(column)
    );
});

// ── 行勾选 ───────────────────────────────────────────────────────────────────

const rowSelection = computed<TableRowSelection<Api.SystemManage.Operation>>(() => ({
  columnWidth: 48,
  type: 'checkbox',
  selectedRowKeys: checkedRowKeys.value,
  onChange: keys => {
    checkedRowKeys.value = keys.map(String);
  }
}));

onMounted(async () => {
  await loadAll();
  // 初始展开全部菜单节点，与 operation-auth-modal 的默认行为一致
  expandedKeys.value = collectBranchKeys(treeData.value);
});
</script>

<template>
  <div class="min-h-500px flex gap-16px overflow-hidden lt-sm:(flex-col overflow-auto)">
    <ACard
      :title="$t('page.manage.operation.menuTree')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'auto' }"
      class="w-280px flex-col-stretch shrink-0 card-wrapper lt-sm:w-full"
    >
      <template #extra>
        <AButton size="small" @click="loadAll">
          <template #icon>
            <icon-mdi-refresh class="align-sub text-icon" :class="{ 'animate-spin': loading }" />
          </template>
        </AButton>
      </template>
      <AInput v-model:value="treeSearchValue" :placeholder="$t('common.keywordSearch')" allow-clear class="mb-8px" />
      <ASpin :spinning="loading">
        <ATree v-model:expanded-keys="expandedKeys" v-model:selected-keys="selectedKeys" :tree-data="filteredTreeData">
          <template #title="{ title, count, key }">
            <span
              class="inline-block rd-4px px-4px"
              :class="{
                'border border-dashed border-primary': draggingOperation !== null && String(key) !== ALL_KEY,
                'bg-primary bg-opacity-20': dragOverKey === String(key)
              }"
              @dragover="handleNodeDragover(String(key), $event)"
              @dragleave="handleNodeDragleave(String(key))"
              @drop="handleNodeDrop(String(key), title)"
            >
              <span>{{ title }}</span>
              <span class="ml-4px text-12px text-gray-400">({{ count }})</span>
            </span>
          </template>
        </ATree>
      </ASpin>
    </ACard>

    <ACard
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="min-w-0 flex-col-stretch flex-1 card-wrapper sm:flex-1-hidden"
    >
      <template #title>
        <div class="flex-y-center flex-wrap gap-8px">
          <span>{{ selectedNodeName }}</span>
          <ATag color="blue">{{ $t('page.manage.operation.buttonCount') }} {{ stats.button }}</ATag>
          <ATag color="purple">{{ $t('page.manage.operation.apiCount') }} {{ stats.api }}</ATag>
          <ATag v-if="stats.disabled > 0">{{ $t('page.manage.operation.disabledCount') }} {{ stats.disabled }}</ATag>
        </div>
      </template>
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :show-add="false"
          :show-delete="hasAuth('manage:operation:delete')"
          :disabled-delete="checkedRowKeys.length === 0 || deleting"
          :loading="tableLoading"
          @delete="handleBatchDelete"
          @refresh="loadOperations"
        >
          <template v-if="hasAuth('manage:operation:create')" #prefix>
            <AButton size="small" ghost type="primary" @click="handleAdd('BUTTON')">
              <template #icon>
                <icon-ic-round-plus class="align-sub text-icon" />
              </template>
              <span class="ml-8px">{{ $t('page.manage.operation.addButton') }}</span>
            </AButton>
            <AButton size="small" ghost type="primary" @click="handleAdd('API')">
              <template #icon>
                <icon-ic-round-plus class="align-sub text-icon" />
              </template>
              <span class="ml-8px">{{ $t('page.manage.operation.addApi') }}</span>
            </AButton>
          </template>
        </TableHeaderOperation>
      </template>

      <div class="mb-12px flex flex-wrap items-center justify-between gap-12px">
        <ARadioGroup
          v-model:value="typeFilter"
          option-type="button"
          button-style="solid"
          :options="typeFilterOptions"
        />
        <AInput
          v-model:value="keyword"
          :placeholder="$t('page.manage.operation.searchKeyword')"
          allow-clear
          class="w-240px"
        />
      </div>

      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="filteredOperations"
        size="small"
        :row-selection="rowSelection"
        :custom-row="customRow"
        :scroll="scrollConfig"
        :loading="tableLoading || moving"
        row-key="id"
        :pagination="pagination"
        class="h-full"
      />

      <OperationOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        :preset="addPreset"
        @submitted="loadOperations"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
