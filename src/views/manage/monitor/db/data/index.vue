<script setup lang="tsx">
import { computed, nextTick, ref, watch } from 'vue';
import { useEventListener, useResizeObserver } from '@vueuse/core';
import { Tooltip } from 'ant-design-vue';
import {
  fetchExecuteReadonlySql,
  fetchExecuteWriteSql,
  fetchGetDbColumns,
  fetchGetDbSchemas,
  fetchGetDbTableData,
  fetchGetDbTableDdl,
  fetchGetDbTables,
  fetchGetSqlHistoryPage,
  fetchIssueSqlConfirmToken
} from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { formatDateTime } from '@/utils/common';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { $t } from '@/locales';
import ConfirmDangerModal from '../../modules/confirm-danger-modal.vue';
import InstanceSelect from '../../modules/instance-select.vue';

defineOptions({
  name: 'MonitorDbData'
});

const { hasAuth } = useAuth();

const DB_TYPES: Api.Monitor.InstanceType[] = ['POSTGRESQL', 'MYSQL', 'DM', 'CLICKHOUSE'];

const instanceId = ref<string>();
const instance = ref<Api.Monitor.Instance>();

/** 动态结果集无主键，用行号做 row-key */
function sqlRowKey(_record: Record<string, unknown>, index?: number) {
  return String(index);
}

// ==================== 左侧库表树 ====================

interface TableNode {
  schema: string;
  table: Api.Monitor.DbTable;
}

const metadataLoading = ref(false);
const tableNodes = ref<TableNode[]>([]);
const treeKeyword = ref('');
const activeSchema = ref('');
const activeTable = ref('');

const filteredNodes = computed(() => {
  const keyword = treeKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return tableNodes.value;
  }
  return tableNodes.value.filter(item => item.table.tableName.toLowerCase().includes(keyword));
});

const groupedNodes = computed(() => {
  const groups = new Map<string, Api.Monitor.DbTable[]>();
  filteredNodes.value.forEach(item => {
    const list = groups.get(item.schema) ?? [];
    list.push(item.table);
    groups.set(item.schema, list);
  });
  return Array.from(groups.entries());
});

async function loadMetadata() {
  if (!instanceId.value) {
    tableNodes.value = [];
    return;
  }
  metadataLoading.value = true;
  try {
    const { data: schemas, error } = await fetchGetDbSchemas(instanceId.value);
    if (error || !schemas) {
      return;
    }
    const nodes: TableNode[] = [];
    await Promise.all(
      schemas.map(async schema => {
        const { data: tables } = await fetchGetDbTables(instanceId.value!, schema);
        (tables ?? []).forEach(table => nodes.push({ schema, table }));
      })
    );
    tableNodes.value = nodes;
  } finally {
    metadataLoading.value = false;
  }
}

/** 右侧数据卡片容器，切换表时滚动回顶部，避免左侧列表很长时选中后看不到数据 */
const rightCardRef = ref<HTMLElement | null>(null);

/** 左侧表列表折叠状态（折叠后右侧数据区占满整行） */
const leftCollapsed = ref(false);

/** 当前选中表的基本信息（注释/类型/估算行数），展示在右侧卡片标题区 */
const activeTableInfo = ref<Api.Monitor.DbTable | null>(null);

function handleSelectTable(schema: string, table: Api.Monitor.DbTable) {
  activeSchema.value = schema;
  activeTable.value = table.tableName;
  activeTableInfo.value = table;
  loadColumns();
  loadTableData();
  loadDdl();
  rightCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==================== 表结构 ====================

const columnsLoading = ref(false);
const columns = ref<Api.Monitor.DbColumn[]>([]);
const ddl = ref('');

const columnColumns = computed(() => [
  { key: 'index', dataIndex: 'index', title: $t('common.index'), width: 64 },
  { key: 'columnName', dataIndex: 'columnName', title: $t('page.manage.monitor.dbData.columnName'), ellipsis: true },
  { key: 'dataType', dataIndex: 'dataType', title: $t('page.manage.monitor.dbData.dataType'), width: 140 },
  {
    key: 'nullable',
    dataIndex: 'nullable',
    title: $t('page.manage.monitor.dbData.nullable'),
    width: 90,
    customRender: ({ record }: { record: Api.Monitor.DbColumn }) => (record.nullable ? 'Y' : 'N')
  },
  {
    key: 'primaryKey',
    dataIndex: 'primaryKey',
    title: 'PK',
    width: 70,
    customRender: ({ record }: { record: Api.Monitor.DbColumn }) => (record.primaryKey ? 'Y' : '')
  },
  {
    key: 'defaultValue',
    dataIndex: 'defaultValue',
    title: $t('page.manage.monitor.dbData.defaultValue'),
    width: 130,
    ellipsis: true
  },
  { key: 'comment', dataIndex: 'comment', title: $t('page.manage.monitor.dbData.comment'), ellipsis: true }
]);

async function loadColumns() {
  if (!instanceId.value || !activeTable.value) {
    return;
  }
  columnsLoading.value = true;
  try {
    const { data, error } = await fetchGetDbColumns(instanceId.value, activeSchema.value, activeTable.value);
    columns.value = error || !data ? [] : data;
  } finally {
    columnsLoading.value = false;
  }
}

async function loadDdl() {
  if (!instanceId.value || !activeTable.value) {
    ddl.value = '';
    return;
  }
  const { data, error } = await fetchGetDbTableDdl(instanceId.value, activeSchema.value, activeTable.value);
  ddl.value = error || !data ? '' : data;
}

// ==================== 表数据 ====================

const dataLoading = ref(false);
const tableData = ref<Api.Monitor.SqlExecResult | null>(null);
const dataPage = ref(1);
const dataSize = ref(100);
const filterColumn = ref<string>();
const filterOp = ref<'eq' | 'like'>('like');
const filterValue = ref('');

/** 每页条数可选项（默认 100） */
const DATA_SIZE_OPTIONS = [20, 50, 100, 200, 500];

function handleDataSizeChange() {
  dataPage.value = 1;
  loadTableData();
}

/** 字段元数据映射（小写列名 -> 注释/类型），表数据表头悬停展示 */
const columnMetaMap = computed(() => {
  const map = new Map<string, { comment: string; dataType: string }>();
  columns.value.forEach(item => {
    if (item.comment) {
      map.set(item.columnName.toLowerCase(), { comment: item.comment, dataType: item.dataType });
    }
  });
  return map;
});

const COLUMN_MIN_WIDTH = 100;
const COLUMN_MAX_WIDTH = 360;

/** 按字符估算文本宽度，CJK 字符按 2 个单位计 */
function estimateTextWidth(text: string): number {
  let units = 0;
  for (const ch of text) {
    units += /[\u2E80-\u9FFF\uFF00-\uFFEF]/.test(ch) ? 2 : 1;
  }
  return units * 7 + 32;
}

/** 估算列宽：取表头（含 ⓘ 图标）与当前页前 50 行抽样值的最大宽度，限制在 [100, 360] */
function estimateColumnWidth(column: string, rows: Record<string, unknown>[]): number {
  let width = estimateTextWidth(column) + 18;
  for (const row of rows.slice(0, 50)) {
    const value = row[column];
    const text = value === null || value === undefined ? 'NULL' : String(value);
    width = Math.max(width, estimateTextWidth(text.slice(0, 60)));
    if (width >= COLUMN_MAX_WIDTH) {
      break;
    }
  }
  return Math.min(Math.max(width, COLUMN_MIN_WIDTH), COLUMN_MAX_WIDTH);
}

const dataColumns = computed(() => {
  const rows = tableData.value?.rows ?? [];
  return (tableData.value?.columns ?? []).map(column => {
    const meta = columnMetaMap.value.get(column.toLowerCase());
    return {
      key: column,
      dataIndex: column,
      width: estimateColumnWidth(column, rows),
      // 有字段注释时表头渲染为悬浮提示，提示内容顺带展示字段类型
      title: meta
        ? () => (
            <Tooltip
              placement="topLeft"
              title={
                <div>
                  <div>
                    {column} · {meta.dataType}
                  </div>
                  <div>{meta.comment}</div>
                </div>
              }
            >
              <span class="inline-flex items-center gap-4px">
                {column}
                <SvgIcon icon="ant-design:info-circle-outlined" class="text-12px text-#bbb" />
              </span>
            </Tooltip>
          )
        : column,
      ellipsis: true
    };
  });
});

/** 表数据横向滚动宽度（列宽之和），列多/内容长时横向滚动而不是压缩列 */
const dataTableScrollX = computed(() => dataColumns.value.reduce((sum, column) => sum + (column.width ?? 0), 0));

/** 表数据区域高度：表格体内部纵向滚动（固定表头与搜索区），随容器尺寸自适应；40px 为固定表头高度 */
const dataTableWrapRef = ref<HTMLElement | null>(null);
const dataTableY = ref(360);

/** 读取容器高度并更新表格体滚动高度（减固定表头），供初始化/兜底路径调用 */
async function syncTableHeight() {
  await nextTick();
  const height = dataTableWrapRef.value?.clientHeight ?? 0;
  if (height > 160) {
    dataTableY.value = Math.floor(height - 40);
  }
}

useResizeObserver(dataTableWrapRef, entries => {
  const height = entries[0]?.contentRect.height ?? 0;
  if (height > 160) {
    dataTableY.value = Math.floor(height - 40);
  }
});

// 后台页签 ResizeObserver 不触发，选表/数据加载/窗口尺寸变化后同步量一次
watch([activeTable, () => tableData.value?.rows?.length], () => syncTableHeight());
useEventListener(window, 'resize', () => syncTableHeight());

async function loadTableData() {
  if (!instanceId.value || !activeTable.value) {
    tableData.value = null;
    return;
  }
  dataLoading.value = true;
  try {
    const conditions =
      filterColumn.value && filterValue.value
        ? JSON.stringify([{ column: filterColumn.value, op: filterOp.value, value: filterValue.value }])
        : undefined;
    const { data, error } = await fetchGetDbTableData(instanceId.value, {
      schema: activeSchema.value,
      table: activeTable.value,
      conditions,
      page: dataPage.value,
      size: dataSize.value
    });
    tableData.value = error || !data ? null : data;
  } finally {
    dataLoading.value = false;
  }
}

function handleSearchData() {
  dataPage.value = 1;
  loadTableData();
}

// ==================== SQL 控制台 ====================

const sqlText = ref('');
const executing = ref(false);
const sqlResult = ref<Api.Monitor.SqlExecResult | null>(null);
const sqlElapsedMs = ref<number | null>(null);

function handleInstanceChange(value?: string, item?: Api.Monitor.Instance) {
  instanceId.value = value;
  instance.value = item;
  activeSchema.value = '';
  activeTable.value = '';
  activeTableInfo.value = null;
  columns.value = [];
  tableData.value = null;
  sqlResult.value = null;
  loadMetadata();
}

const sqlColumns = computed(() => {
  const rows = sqlResult.value?.rows ?? [];
  return (sqlResult.value?.columns ?? []).map(column => ({
    key: column,
    dataIndex: column,
    title: column,
    width: estimateColumnWidth(column, rows),
    ellipsis: true
  }));
});

/** SQL 结果横向滚动宽度 */
const sqlTableScrollX = computed(() => sqlColumns.value.reduce((sum, column) => sum + (column.width ?? 0), 0));

const canWrite = computed(() => hasAuth('monitor:db:sql:write') && Boolean(instance.value?.sqlWriteEnabled));

async function handleExecute() {
  if (!instanceId.value || !sqlText.value.trim()) {
    window.$message?.warning?.($t('page.manage.monitor.dbData.sqlEmpty'));
    return;
  }
  executing.value = true;
  sqlElapsedMs.value = null;
  const start = Date.now();
  try {
    const { data, error } = await fetchExecuteReadonlySql(instanceId.value, sqlText.value.trim());
    sqlElapsedMs.value = Date.now() - start;
    if (error) {
      return;
    }
    sqlResult.value = data ?? null;
  } finally {
    executing.value = false;
  }
}

// 写执行（高危）
const writeVisible = ref(false);

async function issueWriteToken(): Promise<string | null> {
  if (!instanceId.value) {
    return null;
  }
  const { data, error } = await fetchIssueSqlConfirmToken(instanceId.value, sqlText.value.trim());
  if (error || !data) {
    return null;
  }
  return data.token;
}

async function submitWrite(token: string): Promise<boolean> {
  if (!instanceId.value) {
    return false;
  }
  const { data, error } = await fetchExecuteWriteSql(instanceId.value, sqlText.value.trim(), token);
  if (error) {
    window.$message?.error?.($t('page.manage.monitor.dbData.execFailed'));
    return false;
  }
  window.$message?.success?.($t('page.manage.monitor.dbData.writeSuccess', { count: data?.affectedRows ?? 0 }));
  sqlResult.value = data ?? null;
  return true;
}

function openWriteModal() {
  if (!sqlText.value.trim()) {
    window.$message?.warning?.($t('page.manage.monitor.dbData.sqlEmpty'));
    return;
  }
  writeVisible.value = true;
}

// ==================== 执行历史 ====================

const historyVisible = ref(false);
const historyLoading = ref(false);
const historyRecords = ref<Api.Monitor.SqlHistory[]>([]);
const historyCurrent = ref(1);
const historySize = ref(10);
const historyTotal = ref(0);

const historyColumns = computed(() => [
  { key: 'sqlText', dataIndex: 'sqlText', title: 'SQL', ellipsis: true },
  { key: 'sqlType', dataIndex: 'sqlType', title: $t('page.manage.monitor.dbData.sqlType'), width: 100 },
  {
    key: 'execStatus',
    dataIndex: 'execStatus',
    title: $t('page.manage.monitor.dbData.execStatus'),
    width: 110
  },
  { key: 'affectedRows', dataIndex: 'affectedRows', title: $t('page.manage.monitor.dbData.affectedRows'), width: 100 },
  { key: 'durationMs', dataIndex: 'durationMs', title: 'ms', width: 90 },
  {
    key: 'executeTime',
    dataIndex: 'executeTime',
    title: $t('page.manage.monitor.dbData.executeTime'),
    width: 170,
    customRender: ({ record }: { record: Api.Monitor.SqlHistory }) => formatDateTime(record.executeTime)
  }
]);

async function loadHistory() {
  if (!instanceId.value) {
    return;
  }
  historyLoading.value = true;
  try {
    const { data, error } = await fetchGetSqlHistoryPage({
      instanceId: instanceId.value,
      current: historyCurrent.value,
      size: historySize.value
    });
    if (error || !data) {
      return;
    }
    historyRecords.value = data.records ?? [];
    historyTotal.value = Number(data.total ?? 0);
  } finally {
    historyLoading.value = false;
  }
}

function openHistory() {
  historyVisible.value = true;
  historyCurrent.value = 1;
  loadHistory();
}

function handleHistoryPageChange(page: number, pageSize: number) {
  historyCurrent.value = page;
  historySize.value = pageSize;
  loadHistory();
}
</script>

<template>
  <div class="flex-col-stretch gap-16px overflow-auto lg:overflow-hidden">
    <ACard :bordered="false" class="shrink-0 card-wrapper">
      <div class="flex-y-center flex-wrap gap-16px">
        <span>{{ $t('page.manage.monitor.common.instance') }}</span>
        <InstanceSelect v-model="instanceId" :instance-type="DB_TYPES" class="w-320px" @change="handleInstanceChange" />
        <ATag v-if="instance?.dbName" color="blue">{{ instance.dbName }}</ATag>
        <ATag v-if="instance?.sqlWriteEnabled" color="orange">{{ $t('page.manage.monitor.dbData.writeEnabled') }}</ATag>
      </div>
    </ACard>

    <div class="min-h-0 flex-col flex-1 gap-12px lg:flex-row">
      <div v-if="!leftCollapsed" class="h-auto min-h-0 min-w-0 lg:h-full lg:w-1/4">
        <ACard
          :bordered="false"
          class="meta-card card-wrapper"
          :title="$t('page.manage.monitor.dbData.metadata')"
          :body-style="{ padding: '8px' }"
        >
          <AInput
            v-model:value="treeKeyword"
            :placeholder="$t('page.manage.monitor.dbData.form.tableSearch')"
            class="mb-8px shrink-0"
            allow-clear
          />
          <ASpin :spinning="metadataLoading" class="min-h-0 flex-1">
            <!-- 表列表在卡片内独立滚动，不再撑高页面 -->
            <div class="h-full overflow-y-auto">
              <AEmpty v-if="groupedNodes.length === 0 && !metadataLoading" :description="$t('common.noData')" />
              <div v-for="[schema, tables] in groupedNodes" :key="schema" class="mb-8px">
                <div v-if="groupedNodes.length > 1" class="px-8px py-4px text-12px text-#999">
                  {{ schema }}（{{ tables.length }}）
                </div>
                <div
                  v-for="table in tables"
                  :key="table.tableName"
                  class="cursor-pointer rounded px-16px py-4px hover:bg-#f5f5f5"
                  :class="{ 'bg-#e6f4ff': activeSchema === schema && activeTable === table.tableName }"
                  @click="handleSelectTable(schema, table)"
                >
                  <span>{{ table.tableName }}</span>
                  <span v-if="table.comment" class="ml-8px text-12px text-#999">{{ table.comment }}</span>
                </div>
              </div>
            </div>
          </ASpin>
        </ACard>
      </div>
      <!-- 左右分区间把手：点击收起/展开表列表 -->
      <div class="collapse-sash hidden lg:flex" @click="leftCollapsed = !leftCollapsed">
        <ATooltip
          :title="
            leftCollapsed ? $t('page.manage.monitor.dbData.expandList') : $t('page.manage.monitor.dbData.collapseList')
          "
          placement="right"
        >
          <div class="sash-handle">
            <SvgIcon :icon="leftCollapsed ? 'line-md:menu-fold-right' : 'line-md:menu-fold-left'" class="text-14px" />
          </div>
        </ATooltip>
      </div>
      <div class="h-auto min-h-0 min-w-0 flex-1 lg:h-full">
        <div ref="rightCardRef" class="h-full">
          <ACard :bordered="false" class="data-card card-wrapper">
            <template #title>
              <div v-if="activeTable" class="flex-y-center flex-wrap gap-8px">
                <span>{{ activeTable }}</span>
                <ATag color="blue" class="ml-4px">{{ activeSchema }}</ATag>
                <ATag v-if="activeTableInfo?.tableType && activeTableInfo.tableType !== 'BASE TABLE'" color="purple">
                  {{ activeTableInfo.tableType }}
                </ATag>
                <span v-if="activeTableInfo?.comment" class="text-12px text-#999">{{ activeTableInfo.comment }}</span>
                <span class="text-12px text-#999">
                  {{ $t('page.manage.monitor.dbData.fieldCount', { count: columns.length }) }}
                </span>
                <span v-if="activeTableInfo?.estimatedRows" class="text-12px text-#999">
                  {{ $t('page.manage.monitor.dbData.estimatedRows', { count: activeTableInfo.estimatedRows }) }}
                </span>
              </div>
              <span v-else>{{ $t('page.manage.monitor.dbData.selectTableHint') }}</span>
            </template>
            <ATabs v-if="activeTable">
              <ATabPane key="data" class="data-pane" :tab="$t('page.manage.monitor.dbData.tabData')">
                <div class="mb-12px flex-y-center flex-wrap gap-12px">
                  <ASelect
                    v-model:value="filterColumn"
                    :options="columns.map(item => ({ label: item.columnName, value: item.columnName }))"
                    :placeholder="$t('page.manage.monitor.dbData.form.filterColumn')"
                    class="w-200px"
                    allow-clear
                  />
                  <ASelect
                    v-model:value="filterOp"
                    :options="[
                      { label: '=', value: 'eq' },
                      { label: 'LIKE', value: 'like' }
                    ]"
                    class="w-100px"
                  />
                  <AInput
                    v-model:value="filterValue"
                    :placeholder="$t('page.manage.monitor.dbData.form.filterValue')"
                    class="w-240px"
                    @press-enter="handleSearchData"
                  />
                  <AButton type="primary" ghost :loading="dataLoading" @click="handleSearchData">
                    {{ $t('common.search') }}
                  </AButton>
                  <div class="flex-1" />
                  <span v-if="tableData?.truncated" class="text-#faad14">
                    {{ $t('page.manage.monitor.dbData.truncated') }}
                  </span>
                  <span class="text-12px text-#999">
                    {{ $t('page.manage.monitor.dbData.pageInfo', { page: dataPage }) }}
                  </span>
                  <ASelect
                    v-model:value="dataSize"
                    :options="
                      DATA_SIZE_OPTIONS.map(size => ({
                        label: $t('page.manage.monitor.dbData.pageSize', { size }),
                        value: size
                      }))
                    "
                    class="w-110px"
                    size="small"
                    @change="handleDataSizeChange"
                  />
                  <AButton
                    size="small"
                    :disabled="dataPage <= 1 || dataLoading"
                    @click="
                      dataPage -= 1;
                      loadTableData();
                    "
                  >
                    {{ $t('page.manage.monitor.common.prevPage') }}
                  </AButton>
                  <AButton
                    size="small"
                    :disabled="(tableData?.rows?.length ?? 0) < dataSize || dataLoading"
                    @click="
                      dataPage += 1;
                      loadTableData();
                    "
                  >
                    {{ $t('page.manage.monitor.common.nextPage') }}
                  </AButton>
                </div>
                <!-- 表格区域内部滚动：搜索区与表头固定，仅数据行滚动 -->
                <div
                  ref="dataTableWrapRef"
                  class="data-table-wrap min-h-0 flex-1"
                  :style="{ '--table-y': `${dataTableY}px` }"
                >
                  <ATable
                    :columns="dataColumns"
                    :data-source="tableData?.rows ?? []"
                    size="small"
                    :loading="dataLoading"
                    :row-key="sqlRowKey"
                    :scroll="{ x: dataTableScrollX, y: dataTableY }"
                    :pagination="false"
                  />
                </div>
              </ATabPane>
              <ATabPane key="structure" class="pane-scroll" :tab="$t('page.manage.monitor.dbData.tabStructure')">
                <ATable
                  :columns="columnColumns"
                  :data-source="columns"
                  size="small"
                  :loading="columnsLoading"
                  row-key="columnName"
                  :scroll="{ x: 900 }"
                  :pagination="false"
                />
                <ADivider>{{ $t('page.manage.monitor.dbData.ddl') }}</ADivider>
                <pre class="max-h-360px overflow-auto rounded bg-#f5f5f5 p-12px text-12px">{{ ddl }}</pre>
              </ATabPane>
              <ATabPane key="console" class="pane-scroll" :tab="$t('page.manage.monitor.dbData.tabConsole')">
                <ATextarea
                  v-model:value="sqlText"
                  :rows="5"
                  :maxlength="10000"
                  :placeholder="$t('page.manage.monitor.dbData.form.sql')"
                />
                <div class="my-12px flex-y-center gap-12px">
                  <AButton type="primary" :loading="executing" @click="handleExecute">
                    {{ $t('page.manage.monitor.dbData.execute') }}
                  </AButton>
                  <AButton v-if="canWrite" danger @click="openWriteModal">
                    {{ $t('page.manage.monitor.dbData.executeWrite') }}
                  </AButton>
                  <AButton @click="openHistory">{{ $t('page.manage.monitor.dbData.history') }}</AButton>
                  <span v-if="sqlElapsedMs !== null" class="text-12px text-#999">
                    {{ sqlElapsedMs }} ms ·
                    {{ $t('page.manage.monitor.dbData.resultRows', { count: sqlResult?.rows?.length ?? 0 }) }}
                    <template v-if="sqlResult?.affectedRows !== undefined && sqlResult?.affectedRows !== null">
                      · {{ $t('page.manage.monitor.dbData.affectedRows') }}: {{ sqlResult.affectedRows }}
                    </template>
                  </span>
                </div>
                <ATable
                  v-if="sqlResult?.columns?.length"
                  :columns="sqlColumns"
                  :data-source="sqlResult.rows ?? []"
                  size="small"
                  :row-key="sqlRowKey"
                  :scroll="{ x: sqlTableScrollX, y: 420 }"
                  :pagination="false"
                />
                <AEmpty v-else :description="$t('common.noData')" />
              </ATabPane>
            </ATabs>
            <AEmpty v-else :description="$t('page.manage.monitor.dbData.selectTableHint')" class="py-48px" />
          </ACard>
        </div>
      </div>
    </div>

    <ADrawer v-model:open="historyVisible" :title="$t('page.manage.monitor.dbData.history')" :width="860">
      <ATable
        :columns="historyColumns"
        :data-source="historyRecords"
        size="small"
        :loading="historyLoading"
        row-key="id"
        :scroll="{ x: 800 }"
        :pagination="{
          current: historyCurrent,
          pageSize: historySize,
          total: historyTotal,
          showSizeChanger: true,
          onChange: handleHistoryPageChange
        }"
      />
    </ADrawer>

    <ConfirmDangerModal
      v-model:visible="writeVisible"
      :title="$t('page.manage.monitor.dbData.executeWrite')"
      :description="sqlText.trim().slice(0, 200)"
      :issue-token="issueWriteToken"
      :submit="submitWrite"
    />
  </div>
</template>

<style scoped>
/* 卡片占满列高，内容区内部滚动，避免页面整体出现滚动条 */
:deep(.meta-card.ant-card),
:deep(.data-card.ant-card) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

:deep(.meta-card > .ant-card-body),
:deep(.data-card > .ant-card-body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

/* 左侧表列表：搜索框固定，列表体内部滚动 */
:deep(.meta-card .ant-spin-nested-loading) {
  display: flex;
  flex: 1;
  min-height: 0;
}

:deep(.meta-card .ant-spin-container) {
  height: 100%;
}

/* 右侧 Tabs 占满卡片内容区 */
:deep(.data-card .ant-tabs) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

:deep(.data-card .ant-tabs-content-holder) {
  flex: 1;
  min-height: 0;
}

:deep(.data-card .ant-tabs-content) {
  height: 100%;
}

:deep(.data-card .ant-tabs-tabpane) {
  height: 100%;
}

/* 表数据 pane：搜索区固定，表格体内部滚动 */
:deep(.data-card .ant-tabs-tabpane.data-pane) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 表结构 / SQL 控制台 pane：内容超高时在 pane 内滚动 */
:deep(.data-card .ant-tabs-tabpane.pane-scroll) {
  overflow-y: auto;
}

/* 表数据表格体占满容器高度（行数少时留出空白网格区，而不是表格缩成一截） */
.data-table-wrap :deep(.ant-table-body) {
  min-height: var(--table-y, 360px);
}

/* 左右分区间把手：竖线 + 居中圆形按钮，点击收起/展开表列表 */
.collapse-sash {
  position: relative;
  width: 18px;
  flex-shrink: 0;
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

.collapse-sash::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: #e5e7eb;
  content: '';
  transition: background-color 0.2s;
}

.collapse-sash:hover::before {
  background: #91caff;
}

.sash-handle {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: #666;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
  transition: all 0.2s;
}

.collapse-sash:hover .sash-handle {
  color: #1677ff;
  border-color: #91caff;
}
</style>
