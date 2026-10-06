/**
 * 扁平列表 → 树的通用工具。
 *
 * 归属：列表页的树形展示（如「菜单管理」需要按 parentId 表达层级）。
 * 保持纯函数、不依赖任何业务类型，便于被其他模块复用。
 *
 * 设计取舍：
 * - 用 Map 一次遍历建索引，整体 O(n)；不做重复扫描
 * - 找不到父节点的行按**根节点**处理，而不是丢弃 —— 搜索场景下结果集是
 *   子集，若不兜底会导致节点凭空消失
 * - 排序在**每一层**递归生效，且未传 compare 时保持原有相对顺序（稳定）
 */

/** 树的节点类型：在原行类型上补一个必然存在的 children */
export type TreeNode<T> = T & { children: TreeNode<T>[] };

/** listToTree 对入参的最小约束 */
export interface TreeSource {
  id: string;
  parentId?: string | null;
}

/**
 * 把扁平数组组装成树
 *
 * @param list    扁平数据
 * @param compare 同级排序函数，返回负数表示 a 排在 b 前；不传则保持原有顺序
 * @returns 根节点数组
 */
export function listToTree<T extends TreeSource>(list: readonly T[], compare?: (a: T, b: T) => number): TreeNode<T>[] {
  const nodeById = new Map<string, TreeNode<T>>();
  const roots: TreeNode<T>[] = [];

  // 第一遍：建立 id → 节点 的索引，此时 children 一律为空
  for (const item of list) {
    nodeById.set(item.id, { ...item, children: [] });
  }

  // 第二遍：挂载到父节点；父节点不存在（或指向自身/空值）的作为根
  for (const item of list) {
    const node = nodeById.get(item.id)!;
    const parentKey = item.parentId;
    const parent = parentKey ? nodeById.get(String(parentKey)) : undefined;

    if (!parent || parent === node) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  // 第三遍：逐层排序
  if (compare) {
    const sortLevel = (nodes: TreeNode<T>[]) => {
      nodes.sort(compare);
      nodes.forEach(node => sortLevel(node.children));
    };
    sortLevel(roots);
  }

  return roots;
}

/**
 * 深度优先收集树上所有节点（用于断言、统计或全选）
 *
 * @param nodes 根节点数组
 * @returns 展平后的所有节点，顺序与原树一致
 */
export function flattenTree<T extends TreeSource>(nodes: readonly TreeNode<T>[]): TreeNode<T>[] {
  const result: TreeNode<T>[] = [];

  const walk = (list: readonly TreeNode<T>[]) => {
    list.forEach(node => {
      result.push(node);
      if (node.children.length > 0) {
        walk(node.children);
      }
    });
  };

  walk(nodes);

  return result;
}

/**
 * 收集一组节点及其**全部祖先**的 id
 *
 * 搜索场景的核心：后端只返回命中行，父级不在结果里，
 * 需要据此把祖先链补回来，否则树形层级会断掉。
 *
 * @param list      全量扁平数据（必须包含祖先，否则补不出来）
 * @param matchIds  命中节点的 id 集合
 * @returns 命中节点 + 其所有祖先的 id 集合
 */
export function collectWithAncestors<T extends TreeSource>(
  list: readonly T[],
  matchIds: ReadonlySet<string>
): Set<string> {
  const parentById = new Map<string, string>();
  list.forEach(item => {
    if (item.parentId) {
      parentById.set(item.id, String(item.parentId));
    }
  });

  const result = new Set<string>();

  for (const id of matchIds) {
    let current: string | undefined = id;
    // 沿 parentId 上溯；用 result 去重兼作环检测的终止条件
    while (current && !result.has(current)) {
      result.add(current);
      current = parentById.get(current);
    }
  }

  return result;
}
