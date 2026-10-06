<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchDeleteSysModule, fetchGetAllModules } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { type TreeNode, collectWithAncestors, listToTree } from '@/utils/tree';
import { $t } from '@/locales';
import ModuleOperateDrawer from './modules/module-operate-drawer.vue';
import ModuleSearch from './modules/module-search.vue';

/**
 * 默认的 702 是按 2 个按钮的简单表格估的；本页 5 列，且首列要容纳「展开箭头 + 层级缩进」
 */
const TABLE_SCROLL_X = 900;

/** 层级缩进的像素基数，与模板里的 :indent-size 保持一致 */
const INDENT_SIZE = 15;

const { tableWrapperRef, scrollConfig } = useTableScroll(TABLE_SCROLL_X);

/**
 * 全量模块（**含禁用**），既是树形列表的数据源，也供抽屉选择「上级模块」
 *
 * 用 `/sys/module/all` 而不是 `/sys/module/list`：后者走 `listEnabled()`，
 * 只返回启用中的模块 —— 禁用一个模块后它会从这里消失，连改回来都做不到。
 */
const moduleList = ref<Api.SystemManage.SysModule[]>([]);

/**
 * 把「全量模块」端点适配成 useTable 期望的分页结构
 *
 * 模块树不分页、后端也没有关键词过滤参数，故一次拉全后由页面做客户端过滤 + 重新建树
 * （与「部门管理」「菜单管理」同样的取舍，见 SKILL.md 的树形列表例外条款）。
 *
 * 失败分支直接透传原结果：FlatResponseFailData 要求同时带 error 与 response，手工构造容易漏字段。
 */
async function fetchModuleListAsPage() {
  const result = await fetchGetAllModules();

  if (result.error) {
    return result;
  }

  const records = result.data ?? [];
  moduleList.value = records;

  return {
    ...result,
    data: { records, current: 1, size: records.length, total: records.length }
  };
}

const { columns, columnChecks, data, getData, loading } = useTable({
  apiFn: fetchModuleListAsPage,
  // 不传 apiParams：数据由 fetchModuleListAsPage 一次拉全，过滤在客户端完成，
  // searchParams 由本页自建（见下方 createDefaultSearchParams）
  columns: () => [
    {
      // moduleName 放在首个数据列：antd 把展开箭头渲染在首个数据列内，
      // 缩进也是加在这一列上，故不能再让 index 序号列占位
      key: 'moduleName',
      dataIndex: 'moduleName',
      title: $t('page.manage.module.moduleName'),
      align: 'left',
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      ellipsis: true
    },
    {
      key: 'moduleCode',
      dataIndex: 'moduleCode',
      title: $t('page.manage.module.moduleCode'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      key: 'orderNum',
      dataIndex: 'orderNum',
      title: $t('page.manage.module.orderNum'),
      align: 'center',
      width: 90
    },
    {
      key: 'moduleStatus',
      dataIndex: 'moduleStatus',
      title: $t('page.manage.common.statusTitle'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => {
        const { moduleStatus } = record;

        if (moduleStatus === null || moduleStatus === undefined) {
          return null;
        }

        // 布尔字段不走 tagMap：后端就是 Boolean，没有码值可映射
        const labelKey = moduleStatus ? 'page.manage.common.status.enable' : 'page.manage.common.status.disable';

        return <Tag color={moduleStatus ? 'success' : 'default'}>{$t(labelKey)}</Tag>;
      }
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

/**
 * 列定义在 useTableOperate 之前，而 handleEdit 是解构出来的 const（不提升），
 * 直接引用会触发 @typescript-eslint/no-use-before-define。
 * 用函数声明（会提升）包一层即可，调用发生在点击时，handleEdit 必然已就绪。
 */
function edit(id: string) {
  handleEdit(id);
}

/**
 * 搜索模型：做成客户端过滤后，它不再由 useTable 的 apiParams 派生
 * （useTable 的 searchParams 是用 apiParams 初始化的，字段不写进 apiParams
 * 就不会出现在 model 上，输入框会失去响应式）
 */
function createDefaultSearchParams(): Api.SystemManage.SysModuleSearchParams {
  return {
    moduleName: undefined,
    moduleCode: undefined,
    moduleStatus: undefined
  };
}

const searchParams = ref<Api.SystemManage.SysModuleSearchParams>(createDefaultSearchParams());

/** 过滤是响应式的 computed，按下「搜索」无需额外动作，保留按钮仅为符合页面习惯 */
function handleSearch() {
  // no-op：输入即过滤
}

function handleResetSearchParams() {
  searchParams.value = createDefaultSearchParams();
}

/**
 * 树形数据：客户端过滤 + 补全祖先链 + 建树
 *
 * 命中节点不足以构成完整层级，必须把它们的所有祖先一并纳入，
 * 否则过滤后树形层级会断掉。
 */
const treeData = computed<TreeNode<Api.SystemManage.SysModule>[]>(() => {
  const all = data.value as unknown as Api.SystemManage.SysModule[];
  const { moduleName, moduleCode, moduleStatus } = searchParams.value;

  const matched = all.filter(item => {
    if (moduleName) {
      const kw = moduleName.trim().toLowerCase();

      if (
        !String(item.moduleName ?? '')
          .toLowerCase()
          .includes(kw)
      ) {
        return false;
      }
    }

    if (moduleCode) {
      const kw = moduleCode.trim().toLowerCase();

      if (
        !String(item.moduleCode ?? '')
          .toLowerCase()
          .includes(kw)
      ) {
        return false;
      }
    }

    if (moduleStatus) {
      // 搜索栏用 "Y"/"N" 表达布尔（antd 的 SelectValue 不接受布尔值），这里本地比较即可
      if (Boolean(item.moduleStatus) !== (moduleStatus === 'Y')) {
        return false;
      }
    }

    return true;
  });

  const keptIds = collectWithAncestors(all, new Set(matched.map(item => String(item.id))));
  const kept = all.filter(item => keptIds.has(String(item.id)));

  return listToTree(kept, (a, b) => (a.orderNum ?? 0) - (b.orderNum ?? 0));
});

/** 展开的行：默认只展开顶层 */
const expandedRowKeys = ref<string[]>([]);

/** 全部展开 / 收起 */
const allExpanded = ref(false);

const allRowKeys = computed(() => (data.value as unknown as Api.SystemManage.SysModule[]).map(i => String(i.id)));

function toggleExpandAll() {
  allExpanded.value = !allExpanded.value;
  expandedRowKeys.value = allExpanded.value ? allRowKeys.value : [];
}

async function handleBatchDelete() {
  const ids = checkedRowKeys.value as string[];

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteSysModule(ids);

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
    const { error } = await fetchDeleteSysModule([id]);

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
 * 首次拿到数据时只铺开顶层
 *
 * ⚠️ 必须等到**非空**的树再初始化：`immediate: true` 会先以空数组执行一次，
 * 若那次就把 `expandedInitialized` 置真，之后真正的数据到达时会被直接跳过，
 * 结果就是「从来不展开」。实测过：漏了 `tree.length === 0` 这个条件时，
 * 首次进入页面只看到 4 个根节点、子模块藏在收起的父节点里，必须手动点开。
 */
const expandedInitialized = ref(false);

watch(
  treeData,
  tree => {
    if (expandedInitialized.value || tree.length === 0) {
      return;
    }

    expandedRowKeys.value = tree.map(node => String(node.id));
    expandedInitialized.value = true;
  },
  { immediate: true }
);
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <ModuleSearch v-model:model="searchParams" @reset="handleResetSearchParams" @search="handleSearch" />
    <ACard
      :title="$t('page.manage.module.title')"
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
              {{ allExpanded ? $t('page.manage.module.collapseAll') : $t('page.manage.module.expandAll') }}
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
        :scroll="scrollConfig"
        :loading="loading"
        row-key="id"
        :pagination="false"
        class="h-full"
      />
      <ModuleOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        :module-list="moduleList"
        @submitted="getData"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
