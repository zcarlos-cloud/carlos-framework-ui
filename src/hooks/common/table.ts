import type { MaybeRef, Ref } from 'vue';
import { computed, effectScope, onScopeDispose, reactive, ref, shallowRef, toValue, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import type { TablePaginationConfig } from 'ant-design-vue';
import type { TableRowSelection } from 'ant-design-vue/es/table/interface';
import { useBoolean, useHookTable } from '@sa/hooks';
import { jsonClone } from '@sa/utils';
import { useAppStore } from '@/store/modules/app';
import { $t } from '@/locales';

type TableData = AntDesign.TableData;
type GetTableData<A extends AntDesign.TableApiFn> = AntDesign.GetTableData<A>;
type TableColumn<T> = AntDesign.TableColumn<T>;
type TableColumnOf<A extends AntDesign.TableApiFn> = TableColumn<AntDesign.TableDataWithIndex<GetTableData<A>>>;

/** 操作列专用 key（Soybean 约定操作列 key 为 operate，位于最后一列） */
const OPERATION_COLUMN_KEYS = ['operate', 'action'];

/**
 * 定位操作列下标：优先从后往前匹配操作列专用 key（Soybean 约定 action 列 key 为 operate，
 * 且恒为最后一列）；否则回退为「最后一列且未绑定 dataIndex」的纯渲染列（无操作列时不固定，
 * 避免把普通数据列误钉到右侧，如审计日志的"操作描述"列）。
 */
function findOperationColumnIndex<A extends AntDesign.TableApiFn>(columns: TableColumnOf<A>[]): number {
  for (let i = columns.length - 1; i > 0; i -= 1) {
    if (OPERATION_COLUMN_KEYS.includes(String(columns[i].key))) {
      return i;
    }
  }

  const lastIndex = columns.length - 1;
  if (lastIndex > 0) {
    const dataIndex = (columns[lastIndex] as { dataIndex?: unknown }).dataIndex;
    if (dataIndex === undefined || dataIndex === null) {
      return lastIndex;
    }
  }

  return -1;
}

/**
 * 为横向滚动的列表固定首列（左）与操作列（右）
 *
 * <p>AntDV 仅在表格设置 scroll.x 时生效固定列；框架内 useTable 列表均带 scroll.x，
 * 未出现横向滚动时固定列无副作用。已显式设置 fixed 的列不会被覆盖。</p>
 */
function withFixedColumns<A extends AntDesign.TableApiFn>(columns: TableColumnOf<A>[]): TableColumnOf<A>[] {
  if (!columns || columns.length < 2) {
    return columns;
  }

  const patched = columns.map(column => ({ ...column }));

  if (!patched[0].fixed) {
    patched[0].fixed = 'left';
  }

  const operationIndex = findOperationColumnIndex(patched);
  if (operationIndex > 0 && !patched[operationIndex].fixed) {
    patched[operationIndex].fixed = 'right';
  }

  return patched;
}

export function useTable<A extends AntDesign.TableApiFn>(config: AntDesign.AntDesignTableConfig<A>) {
  const scope = effectScope();
  const appStore = useAppStore();

  const { apiFn, apiParams, immediate } = config;

  const {
    loading,
    empty,
    data,
    columns,
    columnChecks,
    reloadColumns,
    getData,
    searchParams,
    updateSearchParams,
    resetSearchParams
  } = useHookTable<A, GetTableData<A>, TableColumn<AntDesign.TableDataWithIndex<GetTableData<A>>>>({
    apiFn,
    apiParams,
    columns: () => withFixedColumns<A>(config.columns()),
    transformer: res => {
      const { records = [], current = 1, size = 10, total = 0 } = res.data || {};

      // Ensure that the size is greater than 0, If it is less than 0, it will cause paging calculation errors.
      const pageSize = size <= 0 ? 10 : size;

      const recordsWithIndex = records.map((item, index) => {
        return {
          ...item,
          index: (current - 1) * pageSize + index + 1
        };
      });

      return {
        data: recordsWithIndex,
        pageNum: current,
        pageSize,
        total
      };
    },
    getColumnChecks: cols => {
      const checks: AntDesign.TableColumnCheck[] = [];

      cols.forEach(column => {
        if (column.key) {
          checks.push({
            key: column.key as string,
            title: column.title as string,
            checked: true
          });
        }
      });

      return checks;
    },
    getColumns: (cols, checks) => {
      const columnMap = new Map<string, TableColumn<GetTableData<A>>>();

      cols.forEach(column => {
        if (column.key) {
          columnMap.set(column.key as string, column);
        }
      });

      const filteredColumns = checks
        .filter(item => item.checked)
        .map(check => columnMap.get(check.key) as TableColumn<GetTableData<A>>);

      return filteredColumns;
    },
    onFetched: async transformed => {
      const { pageNum, pageSize, total } = transformed;

      updatePagination({
        current: pageNum,
        pageSize,
        total
      });
    },
    immediate
  });

  const pagination: TablePaginationConfig = reactive({
    current: 1,
    pageSize: 10,
    showSizeChanger: true,
    showTotal: total => $t('common.totalItems', { total }),
    pageSizeOptions: ['10', '15', '20', '25', '30'],
    total: 0,
    onChange: async (current: number, size: number) => {
      pagination.current = current;

      updateSearchParams({
        current,
        size
      });

      getData();
    }
  });

  // this is for mobile, if the system does not support mobile, you can use `pagination` directly
  const mobilePagination = computed(() => {
    const p: TablePaginationConfig = {
      ...pagination,
      simple: appStore.isMobile
    };

    return p;
  });

  function updatePagination(update: Partial<TablePaginationConfig>) {
    Object.assign(pagination, update);
  }

  /**
   * get data by page number
   *
   * @param pageNum the page number. default is 1
   */
  async function getDataByPage(pageNum: number = 1) {
    updatePagination({
      current: pageNum
    });

    updateSearchParams({
      current: pageNum,
      size: pagination.pageSize!
    });

    await getData();
  }

  scope.run(() => {
    watch(
      () => appStore.locale,
      () => {
        reloadColumns();
      }
    );
  });

  onScopeDispose(() => {
    scope.stop();
  });

  return {
    loading,
    empty,
    data,
    columns,
    columnChecks,
    reloadColumns,
    pagination,
    mobilePagination,
    updatePagination,
    getData,
    getDataByPage,
    searchParams,
    updateSearchParams,
    resetSearchParams
  };
}

export function useTableOperate<T extends TableData = TableData>(data: Ref<T[]>, getData: () => Promise<void>) {
  const { bool: drawerVisible, setTrue: openDrawer, setFalse: closeDrawer } = useBoolean();

  const operateType = ref<AntDesign.TableOperateType>('add');

  function handleAdd() {
    operateType.value = 'add';
    openDrawer();
  }

  /** the editing row data */
  const editingData: Ref<T | null> = ref(null);

  function handleEdit(id: T['id']) {
    operateType.value = 'edit';
    const findItem = data.value.find(item => item.id === id) || null;
    editingData.value = jsonClone(findItem);

    openDrawer();
  }

  /** the checked row keys of table */
  const checkedRowKeys: Ref<T['id'][]> = ref([]);

  function onSelectChange(keys: (string | number)[]) {
    checkedRowKeys.value = keys as T['id'][];
  }

  const rowSelection = computed<TableRowSelection<T>>(() => {
    return {
      columnWidth: 48,
      type: 'checkbox',
      selectedRowKeys: checkedRowKeys.value,
      onChange: onSelectChange
    };
  });

  /** the hook after the batch delete operation is completed */
  async function onBatchDeleted() {
    window.$message?.success($t('common.deleteSuccess'));

    checkedRowKeys.value = [];

    await getData();
  }

  /** the hook after the delete operation is completed */
  async function onDeleted() {
    window.$message?.success($t('common.deleteSuccess'));

    await getData();
  }

  return {
    drawerVisible,
    openDrawer,
    closeDrawer,
    operateType,
    handleAdd,
    editingData,
    handleEdit,
    checkedRowKeys,
    onSelectChange,
    rowSelection,
    onBatchDeleted,
    onDeleted
  };
}

export function useTableScroll(scrollX: MaybeRef<number> = 702) {
  const tableWrapperRef = shallowRef<HTMLElement | null>(null);
  const { height: wrapperElHeight } = useElementSize(tableWrapperRef);

  const scrollConfig = computed(() => {
    return {
      y: wrapperElHeight.value - 72,
      x: toValue(scrollX)
    };
  });

  return {
    tableWrapperRef,
    scrollConfig
  };
}
