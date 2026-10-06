<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import type { DataNode } from 'ant-design-vue/es/tree';
import { fetchGetMenuTree, fetchGetRoleOperationIds, fetchSaveRoleOperations } from '@/service/api';
import { fetchGetOperationsByMenuId } from '@/service/api/operation';
import { $t } from '@/locales';

defineOptions({
  name: 'OperationAuthModal'
});

interface Props {
  /** the roleId */
  roleId: string;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

function closeModal() {
  visible.value = false;
}

/** 直接用「操作权限」做标题，不再拼接 $t('common.edit') —— 拼接在英文下语序会错（Edit + Operation Permission） */
const title = computed(() => $t('page.organization.role.operationAuth'));

const loading = shallowRef(false);

interface OpNode extends DataNode {
  opType?: Api.SystemManage.OperationType;
  permCode?: string;
}

const tree = shallowRef<OpNode[]>([]);

/** 树内搜索关键字：菜单树有几十个节点，没有筛选框基本没法用 */
const searchValue = ref('');

/** 收集所有「非叶子」节点的 key，用于展开 */
function collectBranchKeys(nodes: OpNode[]): string[] {
  const keys: string[] = [];

  const walk = (list: OpNode[]) => {
    list.forEach(node => {
      if (node.children?.length) {
        keys.push(String(node.key));
        walk(node.children);
      }
    });
  };

  walk(nodes);

  return keys;
}

const expandedKeys = ref<string[]>([]);

function nodeMatches(node: OpNode, kw: string) {
  return (
    String(node.title ?? '')
      .toLowerCase()
      .includes(kw) ||
    String(node.permCode ?? '')
      .toLowerCase()
      .includes(kw)
  );
}

/** 过滤后的树：命中节点 + 其**祖先链**（否则命中项会变成孤儿、层级断掉） */
const filteredTree = computed<OpNode[]>(() => {
  const kw = searchValue.value.trim().toLowerCase();

  if (!kw) {
    return tree.value;
  }

  const filterNodes = (nodes: OpNode[]): OpNode[] =>
    nodes.reduce<OpNode[]>((acc, node) => {
      const children = node.children?.length ? filterNodes(node.children) : [];

      if (nodeMatches(node, kw) || children.length > 0) {
        acc.push({ ...node, children });
      }

      return acc;
    }, []);

  return filterNodes(tree.value);
});

/** 关键字变化时把命中链全部展开，否则用户看不到搜索结果 */
watch(searchValue, () => {
  expandedKeys.value = collectBranchKeys(filteredTree.value);
});

/** 菜单父节点的 key 前缀，用于提交时剔除 */
const MENU_KEY_PREFIX = 'menu_';

/** Build operation tree: menus as parent nodes, operations as leaf nodes */
async function buildTree() {
  loading.value = true;
  try {
    // 1. Get menu tree
    const { error: menuErr, data: menuData } = await fetchGetMenuTree();
    if (menuErr || !menuData) {
      tree.value = [];
      return;
    }

    // 2. Recursively process menu tree, attach operations
    async function processMenu(menus: Api.SystemManage.MenuTree[]): Promise<OpNode[]> {
      const nodes: OpNode[] = [];
      for (const menu of menus) {
        const menuNode: OpNode = {
          key: `${MENU_KEY_PREFIX}${menu.id}`,
          title: menu.menuName,
          children: []
        };

        // Fetch operations under this menu
        try {
          // 刻意串行：本接口是 N+1（后端没有批量端点），菜单树有几十个节点，
          // 改成并发会一次性向同一服务打几十个请求。等后端补批量接口后再收敛。
          // eslint-disable-next-line no-await-in-loop
          const { error: opErr, data: opData } = await fetchGetOperationsByMenuId(menu.id);
          if (!opErr && opData) {
            const opChildren: OpNode[] = opData.map(op => ({
              key: op.id,
              title: `${op.opName || op.permCode} [${
                op.opType === 'BUTTON' ? $t('page.organization.role.buttonAuth') : 'API'
              }]`,
              opType: op.opType,
              permCode: op.permCode
            }));
            menuNode.children!.push(...opChildren);
          }
        } catch {
          // menu has no operations, continue
        }

        // Process sub-menus
        if (menu.children?.length) {
          // 与上面的逐菜单请求同一步调，串行下探，理由同上
          // eslint-disable-next-line no-await-in-loop
          const subNodes = await processMenu(menu.children);
          menuNode.children!.push(...subNodes);
        }

        // Only include menu node if it has children
        if (menuNode.children!.length > 0) {
          nodes.push(menuNode);
        }
      }
      return nodes;
    }

    tree.value = await processMenu(menuData);
    // 首次加载默认展开全部，替代原先的 default-expand-all
    // （改用受控 expanded-keys 后，搜索才能按需展开命中链）
    expandedKeys.value = collectBranchKeys(tree.value);
  } finally {
    loading.value = false;
  }
}

const checks = shallowRef<string[]>([]);

/** Load role's currently checked operations */
async function loadChecks() {
  if (!props.roleId) return;
  try {
    const { error, data } = await fetchGetRoleOperationIds(props.roleId);
    if (!error && data) {
      // 后端 Long 经全局 LongJsonComponent 序列化为字符串，统一转 string
      checks.value = data.map(String);
    }
  } catch {
    checks.value = [];
  }
}

async function handleSubmit() {
  // checkStrictly 为 false 时，勾选父菜单会把 menu_<id> 一并写入 checkedKeys，
  // 而后端只接受操作 id，故提交前剔除非操作节点
  const operationIds = checks.value.filter(key => !key.startsWith(MENU_KEY_PREFIX));

  loading.value = true;
  try {
    const { error } = await fetchSaveRoleOperations(props.roleId, operationIds);
    if (error) {
      window.$message?.error?.($t('common.updateFailed'));
      return;
    }
    window.$message?.success?.($t('common.modifySuccess'));
    closeModal();
  } finally {
    loading.value = false;
  }
}

async function init() {
  await buildTree();
  await loadChecks();
}

watch(visible, val => {
  if (val) {
    init();
  }
});
</script>

<template>
  <!--
    注意：这里**不要**再写 :confirm-loading —— 它只在用默认 footer 时生效，
    而下面覆盖了 #footer，所以那个属性原本是死的，确认按钮可以连点重复提交。
    改为在按钮上直接读 loading。
  -->
  <AModal v-model:open="visible" :title="title" class="w-560px">
    <AInput v-model:value="searchValue" allow-clear :placeholder="$t('common.keywordSearch')" class="mb-8px" />
    <ASpin :spinning="loading">
      <ATree
        v-model:checked-keys="checks"
        :tree-data="filteredTree"
        :expanded-keys="expandedKeys"
        checkable
        :height="360"
        class="h-360px"
      />
    </ASpin>
    <template #footer>
      <AButton size="small" class="mt-16px" :disabled="loading" @click="closeModal">
        {{ $t('common.cancel') }}
      </AButton>
      <AButton type="primary" size="small" class="mt-16px" :loading="loading" @click="handleSubmit">
        {{ $t('common.confirm') }}
      </AButton>
    </template>
  </AModal>
</template>

<style scoped></style>
