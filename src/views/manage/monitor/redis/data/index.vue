<script setup lang="tsx">
import { computed, ref } from 'vue';
import type { VNode } from 'vue';
import { Button, Popconfirm } from 'ant-design-vue';
import {
  fetchBatchDeleteRedisKeys,
  fetchCreateRedisKey,
  fetchDeleteRedisKey,
  fetchGetRedisDatabases,
  fetchGetRedisKeyDetail,
  fetchGetRedisKeyTree,
  fetchUpdateRedisKey,
  issueConfirmToken
} from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import SvgIcon from '@/components/custom/svg-icon.vue';
import ConfirmDangerModal from '../../modules/confirm-danger-modal.vue';
import InstanceSelect from '../../modules/instance-select.vue';
import { formatBytes } from '../../shared';

defineOptions({
  name: 'MonitorRedisData'
});

const { hasAuth } = useAuth();

const REDIS_TYPES = ['REDIS_STANDALONE', 'REDIS_CLUSTER', 'REDIS_SENTINEL'] as Api.Monitor.InstanceType[];

const instanceId = ref<string>();
const instance = ref<Api.Monitor.Instance>();

const databases = ref<Api.Monitor.RedisDatabaseInfo[]>([]);
const dbIndex = ref<number>();
const isCluster = computed(() => instance.value?.instanceType === 'REDIS_CLUSTER');

/** 库选择器选项：db0 (193)；cluster 恒为 db0 不展示选择器 */
const dbOptions = computed(() =>
  databases.value.map(item => ({ label: `db${item.index} (${item.keyCount ?? 0})`, value: item.index }))
);

async function loadDatabases() {
  databases.value = [];
  dbIndex.value = undefined;
  if (!instanceId.value) {
    return;
  }
  const { data, error } = await fetchGetRedisDatabases(instanceId.value);
  if (error || !data) {
    return;
  }
  databases.value = data;
  dbIndex.value = instance.value?.dbIndex ?? 0;
}

function handleDbChange() {
  resetTree();
  clearDetail();
  loadChildren(null);
}

function handleInstanceChange(value?: string, item?: Api.Monitor.Instance) {
  instanceId.value = value;
  instance.value = item;
  resetTree();
  clearDetail();
  if (value) {
    loadDatabases().then(() => loadChildren(null));
  }
}

// ==================== 左侧 key 树（RedisInsight 风格分级展示） ====================

interface TreeNode {
  key: string;
  title: string;
  isLeaf?: boolean;
  /** 加载更多占位节点 */
  more?: boolean;
  /** folder 完整路径（含末尾分隔符，展示编码） */
  folderPath?: string;
  count?: number;
  /** folder 计数是否为近似值（扫描未完整） */
  approx?: boolean;
  type?: string;
  fullKey?: string;
  expanded?: boolean;
  children?: TreeNode[];
}

interface FolderState {
  cursor: string;
  finished: boolean;
  loading: boolean;
}

const separator = ref(':');
const pattern = ref('');
const keyType = ref<string>();
const treeData = ref<TreeNode[]>([]);
const rootState = ref<FolderState>({ cursor: '', finished: true, loading: false });
const expandedSignal = ref(0);
const selectedKey = ref('');
const rootApproximate = ref(false);

/** 子目录游标状态（key = folderPath） */
const folderStates = new Map<string, FolderState>();

const keyTypeOptions = ['string', 'hash', 'list', 'set', 'zset'].map(value => ({ label: value, value }));

function getFolderState(key: string): FolderState {
  let state = folderStates.get(key);
  if (!state) {
    state = { cursor: '', finished: true, loading: false };
    folderStates.set(key, state);
  }
  return state;
}

function triggerRender() {
  expandedSignal.value += 1;
}

function toTreeNodes(items: Api.Monitor.KeyTreeNode[], parentPath: string, approximate: boolean): TreeNode[] {
  return items.map(item => {
    if (item.leaf) {
      return {
        key: `key:${item.fullKey}`,
        title: item.name,
        isLeaf: true,
        type: item.type,
        fullKey: item.fullKey
      };
    }
    const folderPath = `${parentPath}${item.name}${separator.value}`;
    return {
      key: `dir:${folderPath}`,
      title: item.name,
      isLeaf: false,
      folderPath,
      count: item.keyCount ?? 0,
      approx: approximate
    };
  });
}

/** 把新加载的一层节点追加到树（根层或父目录 children 末尾） */
function appendTreeItems(folderPath: string | null, items: TreeNode[], approximate: boolean) {
  if (folderPath === null) {
    rootApproximate.value = approximate;
    treeData.value = [...treeData.value.filter(node => !node.more), ...items];
    return;
  }
  const parent = findFolder(treeData.value, folderPath);
  if (parent) {
    parent.children = [...(parent.children ?? []).filter(node => !node.more), ...items];
    triggerRender();
  }
}

/** 组装树接口参数：根层带全局 pattern/类型过滤，子目录按前缀扫描 */
function buildTreeParams(folderPath: string | null, state: FolderState) {
  return {
    prefix: folderPath ?? undefined,
    separator: separator.value,
    pattern: folderPath === null ? pattern.value || undefined : undefined,
    type: keyType.value || undefined,
    cursor: state.cursor || undefined,
    db: dbIndex.value
  };
}

/** 组装本次加载的一层节点（未完成时附「加载更多」占位） */
function buildLoadedNodes(folderPath: string | null, state: FolderState, data: Api.Monitor.KeyTreeResult): TreeNode[] {
  const items = toTreeNodes(data.nodes ?? [], folderPath ?? '', Boolean(data.approximate));
  if (!state.finished) {
    items.push({
      key: `more:${folderPath ?? ''}:${state.cursor}`,
      title: '',
      isLeaf: true,
      more: true,
      folderPath: folderPath ?? undefined
    });
  }
  return items;
}

/**
 * 加载一层：folderPath 为 null 表示根层
 * 追加模式（cursor 非空 / 点击「加载更多」）往已有兄弟节点后追加
 */
async function loadChildren(folderPath: string | null) {
  if (!instanceId.value) {
    return;
  }
  const state = folderPath === null ? rootState.value : getFolderState(folderPath);
  const loaded =
    folderPath === null ? treeData.value.length > 0 : Boolean(findFolder(treeData.value, folderPath)?.children);
  if (state.loading || (state.cursor === '' && state.finished && loaded)) {
    return;
  }
  state.loading = true;
  triggerRender();
  try {
    const { data, error } = await fetchGetRedisKeyTree(instanceId.value, buildTreeParams(folderPath, state));
    if (error || !data) {
      return;
    }
    state.cursor = data.nextCursor ?? '';
    state.finished = Boolean(data.finished);
    appendTreeItems(folderPath, buildLoadedNodes(folderPath, state, data), Boolean(data.approximate));
  } finally {
    state.loading = false;
    triggerRender();
  }
}

function findFolder(nodes: TreeNode[], folderPath: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.folderPath === folderPath) {
      return node;
    }
    if (node.children) {
      const found = findFolder(node.children, folderPath);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function toggleFolder(node: TreeNode) {
  node.expanded = !node.expanded;
  if (node.expanded && !node.children) {
    loadChildren(node.folderPath ?? null);
  }
  triggerRender();
}

function handleLoadMore(node: TreeNode) {
  loadChildren(node.folderPath ?? null);
}

function resetTree() {
  treeData.value = [];
  folderStates.clear();
  rootState.value = { cursor: '', finished: true, loading: false };
  rootApproximate.value = false;
  selectedKey.value = '';
  triggerRender();
}

function handleSearchKeys() {
  resetTree();
  loadChildren(null);
}

function handleRefreshTree() {
  resetTree();
  loadChildren(null);
}

/** 删除分组（高危）：pattern = folderPath + '*' */
const batchDeleteVisible = ref(false);
const batchDeletePattern = ref('');

const batchDeleteDescription = computed(() =>
  $t('page.manage.monitor.redisData.batchDeletePatternDesc', { pattern: batchDeletePattern.value })
);

const batchDeleteOperation = computed(() => `batch-delete:pattern=${batchDeletePattern.value}`);

function openPatternBatchDelete() {
  if (!pattern.value) {
    window.$message?.warning?.($t('page.manage.monitor.redisData.batchDeleteNeedPattern'));
    return;
  }
  batchDeletePattern.value = pattern.value;
  batchDeleteVisible.value = true;
}

function openFolderBatchDelete(node: TreeNode, event: MouseEvent) {
  event.stopPropagation();
  batchDeletePattern.value = `${node.folderPath}*`;
  batchDeleteVisible.value = true;
}

async function issueBatchDeleteToken(): Promise<string | null> {
  if (!instanceId.value) {
    return null;
  }
  const { data, error } = await issueConfirmToken(instanceId.value, batchDeleteOperation.value);
  if (error || !data) {
    return null;
  }
  return data.token;
}

async function submitBatchDelete(token: string): Promise<boolean> {
  if (!instanceId.value) {
    return false;
  }
  const { data, error } = await fetchBatchDeleteRedisKeys(
    instanceId.value,
    { pattern: batchDeletePattern.value },
    {
      confirmToken: token,
      db: dbIndex.value
    }
  );
  if (error) {
    window.$message?.error?.($t('common.deleteFailed'));
    return false;
  }
  window.$message?.success?.($t('page.manage.monitor.redisData.batchDeleteSuccess', { count: data ?? 0 }));
  batchDeleteVisible.value = false;
  clearDetail();
  handleRefreshTree();
  return true;
}

// ==================== 树节点渲染（手写递归，完全掌控懒加载与徽标） ====================

const TYPE_BADGE_COLORS: Record<string, string> = {
  string: '#3b82f6',
  hash: '#f59e0b',
  list: '#8b5cf6',
  set: '#22c55e',
  zset: '#ec4899',
  stream: '#ef4444'
};

function typeBadge(type?: string) {
  const color = TYPE_BADGE_COLORS[type ?? ''] ?? '#9ca3af';
  return (
    <span
      class="h-18px w-18px inline-flex flex-shrink-0 items-center justify-center rounded-4px text-11px text-white font-bold"
      style={{ backgroundColor: color }}
    >
      {(type ?? '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

function renderNode(node: TreeNode, depth: number): (VNode | null)[] {
  const indent = { paddingLeft: `${10 + depth * 16}px` };
  if (node.more) {
    return [
      <div
        key={node.key}
        style={indent}
        class="flex-y-center cursor-pointer gap-4px py-3px text-12px text-#1677ff hover:bg-#f5f5f5"
        onClick={() => handleLoadMore(node)}
      >
        {$t('page.manage.monitor.common.loadMore')}
      </div>
    ];
  }
  if (node.isLeaf) {
    const active = selectedKey.value === node.fullKey;
    return [
      <div
        key={node.key}
        style={indent}
        class={`flex-y-center cursor-pointer gap-6px py-3px pr-8px hover:bg-#f5f5f5 ${active ? 'bg-#e6f4ff text-#1677ff' : ''}`}
        title={node.fullKey}
        onClick={() => handleSelectKey(node)}
      >
        {typeBadge(node.type)}
        <span class="overflow-hidden text-ellipsis whitespace-nowrap">{node.title}</span>
      </div>
    ];
  }
  return [
    <div
      key={node.key}
      style={indent}
      class="group flex-y-center cursor-pointer gap-4px py-3px pr-8px hover:bg-#f5f5f5"
      title={node.folderPath}
      onClick={() => toggleFolder(node)}
    >
      <span
        class="text-10px text-#999 transition-transform"
        style={node.expanded ? 'transform: rotate(90deg)' : undefined}
      >
        ▶
      </span>
      <SvgIcon icon="carbon:folder" class="flex-shrink-0 text-icon-small text-#faad14" />
      <span class="overflow-hidden text-ellipsis whitespace-nowrap">{node.title}</span>
      <span class="flex-shrink-0 rounded-10px bg-#f0f0f0 px-6px text-11px text-#666">
        {node.count ?? 0}
        {node.approx ? '+' : ''}
      </span>
      {hasAuth('monitor:redis:data:batch-delete') && (
        <span
          class="hidden flex-shrink-0 group-hover:inline-flex"
          title={$t('page.manage.monitor.redisData.folderDelete')}
          onClick={event => openFolderBatchDelete(node, event as MouseEvent)}
        >
          <SvgIcon icon="carbon:trash-can" class="text-icon-small text-#999 hover:text-#ff4d4f" />
        </span>
      )}
    </div>,
    ...(node.expanded && node.children ? node.children.map(child => renderNode(child, depth + 1)).flat() : []),
    node.expanded && getFolderState(node.folderPath ?? '').loading ? (
      <div
        key={`${node.key}-loading`}
        style={{ paddingLeft: `${26 + depth * 16}px` }}
        class="py-3px text-12px text-#999"
      >
        {$t('page.manage.monitor.redisData.loading')}
      </div>
    ) : null
  ];
}

function renderTree() {
  // 依赖 expandedSignal 触发重渲染（folderStates 等非响应式状态变更）
  const renderTick = expandedSignal.value;
  const state = rootState.value;
  const rows = treeData.value.map(node => renderNode(node, 0));
  if (state.loading && rows.length === 0) {
    return <div class="py-24px text-center text-12px text-#999">{$t('page.manage.monitor.redisData.loading')}</div>;
  }
  if (rows.length === 0) {
    return <AEmpty description={$t('page.manage.monitor.redisData.emptyTree')} class="py-24px" />;
  }
  return (
    <div class="h-600px overflow-auto" data-tick={renderTick}>
      {rows}
    </div>
  );
}

/** 函数式组件：自动追踪响应式依赖并重渲染树 */
const TreeView = () => renderTree();

// ==================== 右侧 key 详情 ====================

interface HashRow {
  field: string;
  value: string;
}

interface ZsetRow {
  member: string;
  score: number;
}

const detailLoading = ref(false);
const detail = ref<Api.Monitor.KeyDetail | null>(null);
const subCursor = ref('');
const subFinished = ref(true);

const stringValue = ref('');
const hashRows = ref<HashRow[]>([]);
const listRows = ref<string[]>([]);
const setRows = ref<string[]>([]);
const zsetRows = ref<ZsetRow[]>([]);
const rawJson = ref('');

function clearDetail() {
  detail.value = null;
  selectedKey.value = '';
  stringValue.value = '';
  hashRows.value = [];
  listRows.value = [];
  setRows.value = [];
  zsetRows.value = [];
  rawJson.value = '';
}

function applyDetail(data: Api.Monitor.KeyDetail, append: boolean) {
  detail.value = data;
  subCursor.value = data.subCursor ?? '';
  subFinished.value = Boolean(data.subFinished);

  const value = data.value;
  switch (data.type) {
    case 'string':
      stringValue.value = typeof value === 'string' ? value : JSON.stringify(value);
      break;
    case 'hash': {
      const rows = Object.entries((value as Record<string, string>) ?? {}).map(([field, val]) => ({
        field,
        value: val
      }));
      hashRows.value = append ? [...hashRows.value, ...rows] : rows;
      break;
    }
    case 'list':
      listRows.value = append ? [...listRows.value, ...((value as string[]) ?? [])] : ((value as string[]) ?? []);
      break;
    case 'set':
      setRows.value = append ? [...setRows.value, ...((value as string[]) ?? [])] : ((value as string[]) ?? []);
      break;
    case 'zset': {
      const rows = ((value as { value: string; score: number }[]) ?? []).map(item => ({
        member: item.value,
        score: item.score
      }));
      zsetRows.value = append ? [...zsetRows.value, ...rows] : rows;
      break;
    }
    default:
      rawJson.value = JSON.stringify(value, null, 2);
  }
}

async function loadDetail(key: string, append = false) {
  if (!instanceId.value) {
    return;
  }
  detailLoading.value = true;
  try {
    const { data, error } = await fetchGetRedisKeyDetail(instanceId.value, {
      key,
      subCursor: append ? subCursor.value : undefined,
      db: dbIndex.value
    });
    if (error || !data) {
      return;
    }
    applyDetail(data, append);
  } finally {
    detailLoading.value = false;
  }
}

function handleSelectKey(node: TreeNode) {
  selectedKey.value = node.fullKey ?? '';
  loadDetail(node.fullKey ?? '');
}

function handleCopyKey() {
  if (!detail.value) {
    return;
  }
  navigator.clipboard?.writeText(detail.value.key);
  window.$message?.success?.($t('page.manage.monitor.redisData.copied'));
}

// ==================== string 编辑 / JSON 美化 ====================

const stringEditing = ref(false);
const stringDraft = ref('');
const stringPretty = ref(false);

const stringDisplay = computed(() => {
  if (!stringPretty.value) {
    return stringValue.value;
  }
  try {
    return JSON.stringify(JSON.parse(stringValue.value), null, 2);
  } catch {
    return stringValue.value;
  }
});

function startEditString() {
  stringDraft.value = stringValue.value;
  stringEditing.value = true;
}

async function saveStringValue() {
  if (!instanceId.value || !detail.value) {
    return;
  }
  const { error } = await fetchUpdateRedisKey(
    instanceId.value,
    {
      key: detail.value.key,
      operation: 'set-value',
      value: stringDraft.value
    },
    dbIndex.value
  );
  if (error) {
    window.$message?.error?.($t('common.updateFailed'));
    return;
  }
  window.$message?.success?.($t('common.updateSuccess'));
  stringEditing.value = false;
  loadDetail(detail.value.key);
}

// ==================== 元素级增删改 ====================

const elementModalVisible = ref(false);
const elementSubmitting = ref(false);
const elementField = ref('');
const elementValue = ref('');
const elementScore = ref<number>();

const elementModalTitle = computed(() => $t('page.manage.monitor.redisData.addElement'));

function openAddElement() {
  elementField.value = '';
  elementValue.value = '';
  elementScore.value = undefined;
  elementModalVisible.value = true;
}

async function submitAddElement() {
  if (!instanceId.value || !detail.value) {
    return;
  }
  const type = detail.value.type;
  elementSubmitting.value = true;
  try {
    const { error } = await fetchUpdateRedisKey(
      instanceId.value,
      {
        key: detail.value.key,
        operation: 'add-element',
        type,
        field: type === 'hash' ? elementField.value : undefined,
        value: elementValue.value,
        score: type === 'zset' ? elementScore.value : undefined
      },
      dbIndex.value
    );
    if (error) {
      window.$message?.error?.($t('common.addFailed'));
      return;
    }
    window.$message?.success?.($t('common.addSuccess'));
    elementModalVisible.value = false;
    loadDetail(detail.value.key);
  } finally {
    elementSubmitting.value = false;
  }
}

async function removeElement(element: string) {
  if (!instanceId.value || !detail.value) {
    return;
  }
  const { error } = await fetchUpdateRedisKey(
    instanceId.value,
    {
      key: detail.value.key,
      operation: 'remove-element',
      type: detail.value.type,
      element
    },
    dbIndex.value
  );
  if (error) {
    window.$message?.error?.($t('common.deleteFailed'));
    return;
  }
  window.$message?.success?.($t('common.deleteSuccess'));
  loadDetail(detail.value.key);
}

const hashColumns = computed(() => [
  { key: 'field', dataIndex: 'field', title: $t('page.manage.monitor.redisData.field'), width: 200, ellipsis: true },
  { key: 'value', dataIndex: 'value', title: $t('page.manage.monitor.redisData.value'), ellipsis: true },
  {
    key: 'operate',
    title: $t('common.operate'),
    width: 90,
    customRender: ({ record }: { record: HashRow }) => (
      <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => removeElement(record.field)}>
        <Button danger type="link" size="small">
          {$t('common.delete')}
        </Button>
      </Popconfirm>
    )
  }
]);

const listColumns = computed(() => [
  { key: 'index', dataIndex: 'index', title: $t('common.index'), width: 80 },
  { key: 'value', dataIndex: 'value', title: $t('page.manage.monitor.redisData.value'), ellipsis: true },
  {
    key: 'operate',
    title: $t('common.operate'),
    width: 90,
    customRender: ({ record }: { record: { value: string } }) => (
      <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => removeElement(record.value)}>
        <Button danger type="link" size="small">
          {$t('common.delete')}
        </Button>
      </Popconfirm>
    )
  }
]);

const setColumns = computed(() => [
  { key: 'value', dataIndex: 'value', title: $t('page.manage.monitor.redisData.value'), ellipsis: true },
  {
    key: 'operate',
    title: $t('common.operate'),
    width: 90,
    customRender: ({ record }: { record: { value: string } }) => (
      <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => removeElement(record.value)}>
        <Button danger type="link" size="small">
          {$t('common.delete')}
        </Button>
      </Popconfirm>
    )
  }
]);

const zsetColumns = computed(() => [
  { key: 'member', dataIndex: 'member', title: $t('page.manage.monitor.redisData.member'), ellipsis: true },
  { key: 'score', dataIndex: 'score', title: $t('page.manage.monitor.redisData.score'), width: 120 },
  {
    key: 'operate',
    title: $t('common.operate'),
    width: 90,
    customRender: ({ record }: { record: ZsetRow }) => (
      <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => removeElement(record.member)}>
        <Button danger type="link" size="small">
          {$t('common.delete')}
        </Button>
      </Popconfirm>
    )
  }
]);

const listTableRows = computed(() => listRows.value.map((value, index) => ({ index, value })));
const setTableRows = computed(() => setRows.value.map(value => ({ value })));

// ==================== TTL / 重命名 / 删除 ====================

const ttlModalVisible = ref(false);
const ttlDraft = ref<number>();
const ttlSubmitting = ref(false);

function openTtlModal() {
  ttlDraft.value = detail.value?.ttlSeconds && detail.value.ttlSeconds > 0 ? detail.value.ttlSeconds : undefined;
  ttlModalVisible.value = true;
}

async function submitTtl() {
  if (!instanceId.value || !detail.value || !ttlDraft.value) {
    return;
  }
  ttlSubmitting.value = true;
  try {
    const { error } = await fetchUpdateRedisKey(
      instanceId.value,
      {
        key: detail.value.key,
        operation: 'expire',
        ttlSeconds: ttlDraft.value
      },
      dbIndex.value
    );
    if (error) {
      window.$message?.error?.($t('common.updateFailed'));
      return;
    }
    window.$message?.success?.($t('common.updateSuccess'));
    ttlModalVisible.value = false;
    loadDetail(detail.value.key);
  } finally {
    ttlSubmitting.value = false;
  }
}

async function handlePersist() {
  if (!instanceId.value || !detail.value) {
    return;
  }
  const { error } = await fetchUpdateRedisKey(
    instanceId.value,
    { key: detail.value.key, operation: 'persist' },
    dbIndex.value
  );
  if (error) {
    window.$message?.error?.($t('common.updateFailed'));
    return;
  }
  window.$message?.success?.($t('common.updateSuccess'));
  loadDetail(detail.value.key);
}

const renameModalVisible = ref(false);
const renameDraft = ref('');
const renameSubmitting = ref(false);

function openRenameModal() {
  renameDraft.value = detail.value?.key ?? '';
  renameModalVisible.value = true;
}

async function submitRename() {
  if (!instanceId.value || !detail.value || !renameDraft.value) {
    return;
  }
  renameSubmitting.value = true;
  try {
    const { error } = await fetchUpdateRedisKey(
      instanceId.value,
      {
        key: detail.value.key,
        operation: 'rename',
        newKey: renameDraft.value
      },
      dbIndex.value
    );
    if (error) {
      window.$message?.error?.($t('common.updateFailed'));
      return;
    }
    window.$message?.success?.($t('common.updateSuccess'));
    renameModalVisible.value = false;
    clearDetail();
    handleRefreshTree();
  } finally {
    renameSubmitting.value = false;
  }
}

async function handleDeleteKey() {
  if (!instanceId.value || !detail.value) {
    return;
  }
  const { error } = await fetchDeleteRedisKey(instanceId.value, detail.value.key, dbIndex.value);
  if (error) {
    window.$message?.error?.($t('common.deleteFailed'));
    return;
  }
  window.$message?.success?.($t('common.deleteSuccess'));
  clearDetail();
  handleRefreshTree();
}

// ==================== 新增 key ====================

const createVisible = ref(false);
const createSubmitting = ref(false);
const createModel = ref<Api.Monitor.KeyCreateParams>({
  key: '',
  type: 'string',
  value: '',
  field: undefined,
  score: undefined,
  ttlSeconds: undefined
});

function openCreateModal() {
  createModel.value = { key: '', type: 'string', value: '', field: undefined, score: undefined, ttlSeconds: undefined };
  createVisible.value = true;
}

async function submitCreate() {
  if (!instanceId.value || !createModel.value.key) {
    return;
  }
  createSubmitting.value = true;
  try {
    const { error } = await fetchCreateRedisKey(instanceId.value, createModel.value, dbIndex.value);
    if (error) {
      window.$message?.error?.($t('common.addFailed'));
      return;
    }
    window.$message?.success?.($t('common.addSuccess'));
    createVisible.value = false;
    handleRefreshTree();
  } finally {
    createSubmitting.value = false;
  }
}
</script>

<template>
  <div class="flex-col-stretch gap-16px overflow-auto">
    <ACard :bordered="false" class="card-wrapper">
      <div class="flex-y-center flex-wrap gap-16px">
        <span>{{ $t('page.manage.monitor.common.instance') }}</span>
        <InstanceSelect
          v-model="instanceId"
          :instance-type="REDIS_TYPES"
          class="w-320px"
          @change="handleInstanceChange"
        />
        <ASelect
          v-if="!isCluster"
          v-model:value="dbIndex"
          :options="dbOptions"
          :placeholder="$t('page.manage.monitor.redisData.dbLabel')"
          class="w-150px"
          :disabled="!instanceId || databases.length === 0"
          @change="handleDbChange"
        />
        <AInput
          v-model:value="separator"
          :placeholder="$t('page.manage.monitor.redisData.separator')"
          class="w-80px text-center"
          :maxlength="4"
          @change="handleRefreshTree"
        />
        <AInput
          v-model:value="pattern"
          :placeholder="$t('page.manage.monitor.redisData.form.pattern')"
          class="w-240px"
          allow-clear
          @press-enter="handleSearchKeys"
        />
        <ASelect
          v-model:value="keyType"
          :options="keyTypeOptions"
          :placeholder="$t('page.manage.monitor.redisData.keyType')"
          class="w-140px"
          allow-clear
          @change="handleSearchKeys"
        />
        <AButton type="primary" ghost :loading="rootState.loading" :disabled="!instanceId" @click="handleSearchKeys">
          {{ $t('common.search') }}
        </AButton>
        <AButton :disabled="!instanceId" @click="handleRefreshTree">
          {{ $t('page.manage.monitor.redisData.refreshTree') }}
        </AButton>
        <AButton v-if="hasAuth('monitor:redis:data:edit')" :disabled="!instanceId" @click="openCreateModal">
          {{ $t('page.manage.monitor.redisData.addKey') }}
        </AButton>
        <AButton
          v-if="hasAuth('monitor:redis:data:batch-delete')"
          danger
          :disabled="!instanceId || !pattern"
          @click="openPatternBatchDelete"
        >
          {{ $t('page.manage.monitor.redisData.batchDelete') }}
        </AButton>
      </div>
    </ACard>

    <ARow :gutter="16" class="flex-1">
      <ACol :xs="24" :lg="8">
        <ACard
          :bordered="false"
          class="card-wrapper"
          :title="$t('page.manage.monitor.redisData.keyTree')"
          :body-style="{ padding: '8px 0' }"
        >
          <template #extra>
            <span v-if="treeData.length > 0" class="text-12px text-gray-400">
              {{ treeData.length }}
              <template v-if="rootApproximate">+</template>
            </span>
          </template>
          <TreeView />
        </ACard>
      </ACol>
      <ACol :xs="24" :lg="16">
        <ACard :bordered="false" class="card-wrapper">
          <template #title>
            <div v-if="detail" class="flex-y-center gap-8px">
              <span class="max-w-520px overflow-hidden text-ellipsis whitespace-nowrap" :title="detail.key">
                {{ detail.key }}
              </span>
              <AButton type="link" size="small" class="p-0" @click="handleCopyKey">
                <SvgIcon icon="carbon:copy" class="text-icon-small" />
              </AButton>
            </div>
            <span v-else>{{ $t('page.manage.monitor.redisData.keyDetail') }}</span>
          </template>
          <template v-if="detail" #extra>
            <div class="flex-y-center gap-8px">
              <ATag :color="TYPE_BADGE_COLORS[detail.type] ?? 'default'">{{ detail.type }}</ATag>
              <ATag>TTL: {{ Number(detail.ttlSeconds) === -1 ? '∞' : detail.ttlSeconds }}</ATag>
              <ATag>{{ formatBytes(detail.memoryBytes) }}</ATag>
              <ATag>{{ $t('page.manage.monitor.redisData.elementCount') }}: {{ detail.elementCount ?? '-' }}</ATag>
            </div>
          </template>
          <AEmpty v-if="!detail" :description="$t('page.manage.monitor.redisData.selectKeyHint')" class="py-48px" />
          <ASpin v-else :spinning="detailLoading">
            <div v-if="hasAuth('monitor:redis:data:edit')" class="mb-12px flex-y-center flex-wrap gap-8px">
              <AButton v-if="detail.type === 'string'" size="small" @click="startEditString">
                {{ $t('common.edit') }}
              </AButton>
              <AButton v-if="detail.type === 'string'" size="small" @click="stringPretty = !stringPretty">
                {{ $t('page.manage.monitor.redisData.jsonPretty') }}
              </AButton>
              <AButton v-if="detail.type !== 'string' && detail.type !== 'stream'" size="small" @click="openAddElement">
                {{ $t('page.manage.monitor.redisData.addElement') }}
              </AButton>
              <AButton size="small" @click="openTtlModal">{{ $t('page.manage.monitor.redisData.setTtl') }}</AButton>
              <AButton size="small" :disabled="Number(detail.ttlSeconds) === -1" @click="handlePersist">
                {{ $t('page.manage.monitor.redisData.persist') }}
              </AButton>
              <AButton size="small" @click="openRenameModal">{{ $t('page.manage.monitor.redisData.rename') }}</AButton>
              <Popconfirm
                v-if="hasAuth('monitor:redis:data:delete')"
                :title="$t('common.confirmDelete')"
                @confirm="handleDeleteKey"
              >
                <AButton danger size="small">{{ $t('common.delete') }}</AButton>
              </Popconfirm>
            </div>

            <template v-if="detail.type === 'string'">
              <div v-if="stringEditing" class="flex-col-stretch gap-8px">
                <ATextarea v-model:value="stringDraft" :rows="8" />
                <div class="flex-y-center gap-8px">
                  <AButton type="primary" size="small" @click="saveStringValue">{{ $t('common.confirm') }}</AButton>
                  <AButton size="small" @click="stringEditing = false">{{ $t('common.cancel') }}</AButton>
                </div>
              </div>
              <pre v-else class="max-h-420px overflow-auto rounded bg-#f5f5f5 p-12px text-12px">{{
                stringDisplay
              }}</pre>
            </template>

            <ATable
              v-else-if="detail.type === 'hash'"
              :columns="hashColumns"
              :data-source="hashRows"
              size="small"
              row-key="field"
              :pagination="false"
              :scroll="{ y: 420 }"
            />
            <ATable
              v-else-if="detail.type === 'list'"
              :columns="listColumns"
              :data-source="listTableRows"
              size="small"
              row-key="index"
              :pagination="false"
              :scroll="{ y: 420 }"
            />
            <ATable
              v-else-if="detail.type === 'set'"
              :columns="setColumns"
              :data-source="setTableRows"
              size="small"
              row-key="value"
              :pagination="false"
              :scroll="{ y: 420 }"
            />
            <ATable
              v-else-if="detail.type === 'zset'"
              :columns="zsetColumns"
              :data-source="zsetRows"
              size="small"
              row-key="member"
              :pagination="false"
              :scroll="{ y: 420 }"
            />
            <pre v-else class="max-h-420px overflow-auto rounded bg-#f5f5f5 p-12px text-12px">{{ rawJson }}</pre>

            <div v-if="!subFinished && detail.type !== 'string'" class="mt-12px text-center">
              <AButton size="small" :loading="detailLoading" @click="loadDetail(detail.key, true)">
                {{ $t('page.manage.monitor.common.loadMore') }}
              </AButton>
            </div>
          </ASpin>
        </ACard>
      </ACol>
    </ARow>

    <AModal v-model:open="elementModalVisible" :title="elementModalTitle" :width="480" :mask-closable="false">
      <AForm layout="vertical">
        <AFormItem v-if="detail?.type === 'hash'" :label="$t('page.manage.monitor.redisData.field')" required>
          <AInput v-model:value="elementField" />
        </AFormItem>
        <AFormItem
          :label="
            detail?.type === 'zset'
              ? $t('page.manage.monitor.redisData.member')
              : $t('page.manage.monitor.redisData.value')
          "
          required
        >
          <ATextarea v-model:value="elementValue" :rows="3" />
        </AFormItem>
        <AFormItem v-if="detail?.type === 'zset'" :label="$t('page.manage.monitor.redisData.score')" required>
          <AInputNumber v-model:value="elementScore" class="w-full" />
        </AFormItem>
      </AForm>
      <template #footer>
        <div class="flex-y-center justify-end gap-12px">
          <AButton @click="elementModalVisible = false">{{ $t('common.cancel') }}</AButton>
          <AButton type="primary" :loading="elementSubmitting" @click="submitAddElement">
            {{ $t('common.confirm') }}
          </AButton>
        </div>
      </template>
    </AModal>

    <AModal v-model:open="ttlModalVisible" :title="$t('page.manage.monitor.redisData.setTtl')" :width="400">
      <AInputNumber
        v-model:value="ttlDraft"
        :min="1"
        class="w-full"
        :placeholder="$t('page.manage.monitor.redisData.form.ttlSeconds')"
      />
      <template #footer>
        <div class="flex-y-center justify-end gap-12px">
          <AButton @click="ttlModalVisible = false">{{ $t('common.cancel') }}</AButton>
          <AButton type="primary" :loading="ttlSubmitting" :disabled="!ttlDraft" @click="submitTtl">
            {{ $t('common.confirm') }}
          </AButton>
        </div>
      </template>
    </AModal>

    <AModal v-model:open="renameModalVisible" :title="$t('page.manage.monitor.redisData.rename')" :width="480">
      <AInput v-model:value="renameDraft" :placeholder="$t('page.manage.monitor.redisData.form.newKey')" />
      <template #footer>
        <div class="flex-y-center justify-end gap-12px">
          <AButton @click="renameModalVisible = false">{{ $t('common.cancel') }}</AButton>
          <AButton type="primary" :loading="renameSubmitting" :disabled="!renameDraft" @click="submitRename">
            {{ $t('common.confirm') }}
          </AButton>
        </div>
      </template>
    </AModal>

    <AModal
      v-model:open="createVisible"
      :title="$t('page.manage.monitor.redisData.addKey')"
      :width="520"
      :mask-closable="false"
    >
      <AForm layout="vertical">
        <AFormItem label="Key" required>
          <AInput v-model:value="createModel.key" :maxlength="500" />
        </AFormItem>
        <AFormItem :label="$t('page.manage.monitor.redisData.keyType')" required>
          <ASelect v-model:value="createModel.type" :options="keyTypeOptions" />
        </AFormItem>
        <AFormItem v-if="createModel.type === 'hash'" :label="$t('page.manage.monitor.redisData.field')" required>
          <AInput v-model:value="createModel.field" :maxlength="500" />
        </AFormItem>
        <AFormItem
          :label="
            createModel.type === 'zset'
              ? $t('page.manage.monitor.redisData.member')
              : $t('page.manage.monitor.redisData.value')
          "
        >
          <ATextarea v-model:value="createModel.value" :rows="3" :maxlength="10000" />
        </AFormItem>
        <AFormItem v-if="createModel.type === 'zset'" :label="$t('page.manage.monitor.redisData.score')" required>
          <AInputNumber v-model:value="createModel.score" class="w-full" />
        </AFormItem>
        <AFormItem label="TTL(s)">
          <AInputNumber
            v-model:value="createModel.ttlSeconds"
            :min="0"
            class="w-full"
            :placeholder="$t('page.manage.monitor.redisData.form.ttlNoExpire')"
          />
        </AFormItem>
      </AForm>
      <template #footer>
        <div class="flex-y-center justify-end gap-12px">
          <AButton @click="createVisible = false">{{ $t('common.cancel') }}</AButton>
          <AButton type="primary" :loading="createSubmitting" :disabled="!createModel.key" @click="submitCreate">
            {{ $t('common.confirm') }}
          </AButton>
        </div>
      </template>
    </AModal>

    <ConfirmDangerModal
      v-model:visible="batchDeleteVisible"
      :title="$t('page.manage.monitor.redisData.batchDelete')"
      :description="batchDeleteDescription"
      :confirm-text="instance?.instanceName ?? ''"
      :issue-token="issueBatchDeleteToken"
      :submit="submitBatchDelete"
    />
  </div>
</template>

<style scoped></style>
