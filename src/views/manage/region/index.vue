<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import {
  fetchClearRegionCache,
  fetchDeleteRegion,
  fetchExportRegion,
  fetchExportRegionTemplate,
  fetchGetRegionList,
  fetchImportRegion,
  fetchInitRegionCache
} from '@/service/api';
import { useExport } from '@/hooks/business/use-export';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { EMPTY_TEXT } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import RegionOperateDrawer from './modules/region-operate-drawer.vue';
import RegionSearch from './modules/region-search.vue';

// 区域类型改由后端枚举字典驱动（前端不再持有 RegionType 表）。
// 子组件（搜索栏 / 抽屉）依赖这里先发起加载，所以不要在 *-search.vue 里重复调用。
ensureEnumDict('sys');

/**
 * 列宽：定宽列合计 64+140+160+120+90+130+130+130 = 964，regionName 吃剩余宽度。
 * 默认的 702 是按 2 个按钮的简单表格估的，本页 9 列装不下，给到 1180。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1180);

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
  apiFn: fetchGetRegionList,
  apiParams: {
    current: 1,
    size: 10,
    // 后端 SysRegionPageParam：regionCode / regionName / parentCode / parents /
    // regionType / regionArea / regionPeopleNumber / regionLevel / regionLeader 等
    regionName: undefined,
    regionCode: undefined,
    regionType: undefined
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
      key: 'regionCode',
      dataIndex: 'regionCode',
      title: $t('page.manage.region.regionCode'),
      align: 'center',
      width: 140,
      ellipsis: true
    },
    {
      key: 'regionName',
      dataIndex: 'regionName',
      title: $t('page.manage.region.regionName'),
      align: 'left',
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      ellipsis: true
    },
    {
      key: 'parentName',
      title: $t('page.manage.region.parentName'),
      align: 'center',
      width: 160,
      ellipsis: true,
      customRender: ({ record }) => {
        const { parentName } = record;

        // 顶级区域的 parentCode 是后端哨兵 "0"，回填后 parentName 为空
        return parentName ? <span>{parentName}</span> : <Tag color="default">{$t('page.manage.region.topLevel')}</Tag>;
      }
    },
    {
      key: 'regionType',
      title: $t('page.manage.region.regionType'),
      align: 'center',
      width: 120,
      customRender: ({ record }) => {
        const { regionType } = record;

        return (
          <Tag color={enumDictColor('sys', 'SysRegionType', regionType)}>
            {enumDictText('sys', 'SysRegionType', regionType)}
          </Tag>
        );
      }
    },
    {
      key: 'regionLevel',
      title: $t('page.manage.region.regionLevel'),
      align: 'center',
      width: 90,
      customRender: ({ record }) => {
        const { regionLevel } = record;

        if (regionLevel === null || regionLevel === undefined) {
          return EMPTY_TEXT;
        }

        return $t('page.manage.region.levelN', { n: regionLevel });
      }
    },
    {
      key: 'longitude',
      dataIndex: 'longitude',
      title: $t('page.manage.region.longitude'),
      align: 'center',
      width: 130
    },
    {
      key: 'latitude',
      dataIndex: 'latitude',
      title: $t('page.manage.region.latitude'),
      align: 'center',
      width: 130
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

async function handleBatchDelete() {
  const ids = checkedRowKeys.value as string[];

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteRegion(ids);

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
    const { error } = await fetchDeleteRegion([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    deleting.value = false;
  }
}

const { exporting, exportFile } = useExport();

/**
 * 导出**整表**
 *
 * 与 config 页不同，区域导出刻意不带筛选条件：后端 `/sys/region/export` 只接
 * `HttpServletResponse`、没有查询参数，且它与 `import` 是一对**迁移用**的全量往返
 * （`RegionExcel` 的形状就是整表），筛选导出反而会产出一份不能被安全回灌的子集。
 * 走 useExport 是为了拿到导出中加载态、文件名时间戳，以及「200 + JSON 错误体」识别。
 */
function handleExport() {
  return exportFile(() => fetchExportRegion(), 'sys_region');
}

const importVisible = ref(false);

async function handleInitCache() {
  const { error } = await fetchInitRegionCache();

  if (error) {
    return;
  }

  window.$message?.success?.($t('page.manage.region.cacheInitSuccess'));
}

async function handleClearCache() {
  const { error } = await fetchClearRegionCache();

  if (error) {
    return;
  }

  window.$message?.success?.($t('page.manage.region.cacheClearSuccess'));
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <RegionSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.region.title')"
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
            <AButton size="small" :loading="exporting" @click="handleExport">
              {{ $t('page.manage.common.export') }}
            </AButton>
            <AButton size="small" @click="importVisible = true">{{ $t('page.manage.common.import') }}</AButton>
            <AButton size="small" @click="handleInitCache">{{ $t('page.manage.region.initCache') }}</AButton>
            <!-- 清缓存会让区域树与级联查询失效，破坏性与删除同级，故与删除一样加二次确认 -->
            <Popconfirm :title="$t('page.manage.region.clearCacheConfirm')" @confirm="handleClearCache">
              <AButton size="small" danger>{{ $t('page.manage.region.clearCache') }}</AButton>
            </Popconfirm>
          </template>
        </TableHeaderOperation>
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

      <RegionOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />

      <ImportDrawer
        v-model:visible="importVisible"
        :title="$t('page.manage.common.import')"
        :template-fn="fetchExportRegionTemplate"
        :import-fn="fetchImportRegion"
        template-name="sys_region_template"
        @imported="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
