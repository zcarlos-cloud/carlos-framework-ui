<script setup lang="tsx">
import { computed, onMounted, ref } from 'vue';
import { Button, Popconfirm, Tag, TypographyText } from 'ant-design-vue';
import { fetchDeleteI18nMessage, fetchGetI18nMessageList } from '@/service/api';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { downloadBlob } from '@/utils/common';
import { $t, OVERRIDABLE_NAMESPACES, flattenMessages } from '@/locales';
import enUS from '@/locales/langs/en-us';
import zhCN from '@/locales/langs/zh-cn';
import I18nOperateDrawer from './modules/i18n-operate-drawer.vue';
import I18nSearch from './modules/i18n-search.vue';

/**
 * 国际化管理：前端目录 + 后端覆盖
 *
 * 与其余列表页不同，这一页的数据源是**本地**的：
 * - key 目录与基线值来自前端语言文件（构建期已知，也是 $t() 的类型来源）
 * - 后端 sys_i18n_message 只存运营改过的那些 key 的覆盖值
 *
 * 所以下面这个 apiFn 不请求网络，只在内存里做过滤与分页。
 * 仍然走 useTable 是为了与其余 12 个列表页保持一致（搜索栏、列设置、分页器同款）。
 */
type I18nManageRow = {
  /** 消息键 */
  msgKey: string;
  /** 前端语言文件里的基线值（只读） */
  baseline: string;
  /** 后端覆盖值，未覆盖时为空 */
  override?: string;
  /** 覆盖行 id，用于编辑与还原 */
  overrideId?: string;
};

/** 前端语言文件 = 完整的 key 目录 + 基线值 */
const CATALOGS: Record<string, Record<string, string>> = {
  zh_CN: flattenMessages(zhCN),
  en_US: flattenMessages(enUS)
};

const OVERRIDABLE = new Set<string>(OVERRIDABLE_NAMESPACES);

/** 覆盖值缓存：语言 → (msgKey → { id, value }) */
const overridesByLang = ref<Record<string, Map<string, { id: string; value: string }>>>({});
const overridesLoading = ref(false);

/** 拉取两种语言的全部覆盖行（量很小：只有被改过的 key） */
async function loadOverrides() {
  overridesLoading.value = true;
  try {
    const langs: Api.SystemManage.I18nLang[] = ['zh_CN', 'en_US'];
    const responses = await Promise.all(langs.map(lang => fetchGetI18nMessageList({ lang, current: 1, size: 999 })));

    const next: Record<string, Map<string, { id: string; value: string }>> = {};
    langs.forEach((lang, index) => {
      const records = responses[index].data?.records ?? [];
      next[lang] = new Map(records.map(record => [record.msgKey, { id: record.id, value: record.msgValue }]));
    });

    overridesByLang.value = next;
  } finally {
    overridesLoading.value = false;
  }
}

/**
 * 按搜索条件过滤出**全部**命中行（不分页）
 *
 * 抽成独立函数是为了让**列表与导出共用同一份条件** —— 本计划里已经修过好几处
 * 「列表一套条件、导出另一套」的缺陷（config / region / app-client），
 * 只要两边各写一遍就一定会在某次改动后漂移。
 */
function collectFilteredRows(params?: Api.SystemManage.I18nManageSearchParams): I18nManageRow[] {
  const { lang = 'zh_CN', keyword, namespace, onlyOverridden } = params ?? {};

  const catalog = CATALOGS[lang] ?? {};
  const overrides = overridesByLang.value[lang] ?? new Map();

  let rows: I18nManageRow[] = Object.entries(catalog)
    // 只暴露允许覆盖的命名空间 —— 与 loadBackendMessages 的过滤规则一致
    .filter(([msgKey]) => OVERRIDABLE.has(msgKey.split('.')[0]))
    .map(([msgKey, baseline]) => {
      const override = overrides.get(msgKey);
      return { msgKey, baseline, override: override?.value, overrideId: override?.id };
    })
    .sort((a, b) => a.msgKey.localeCompare(b.msgKey));

  if (keyword) {
    const kw = keyword.trim().toLowerCase();
    rows = rows.filter(
      row =>
        row.msgKey.toLowerCase().includes(kw) ||
        row.baseline.toLowerCase().includes(kw) ||
        (row.override ?? '').toLowerCase().includes(kw)
    );
  }

  if (namespace) {
    rows = rows.filter(row => row.msgKey.startsWith(`${namespace}.`));
  }

  if (onlyOverridden === 'Y') {
    rows = rows.filter(row => row.override !== undefined);
  }

  return rows;
}

/** 本地数据源的列表函数：不过网络，只做过滤 + 分页 */
const localApiFn = (async (params: Api.SystemManage.I18nManageSearchParams) => {
  const { current = 1, size = 20 } = params ?? {};
  const rows = collectFilteredRows(params);
  const start = (current - 1) * size;

  return {
    data: {
      records: rows.slice(start, start + size),
      current,
      size,
      total: rows.length
    },
    error: null,
    // response 只是类型占位：数据是本地算出来的，没有任何地方会读它
    response: {}
  };
  // 本地数据源不是「分页服务函数」，这里收口一次断言，避免为了凑类型去伪造 AxiosResponse
}) as unknown as AntDesign.TableApiFn<I18nManageRow, Api.SystemManage.I18nManageSearchParams>;

const { columns, columnChecks, data, getData, loading, mobilePagination, searchParams, resetSearchParams } = useTable({
  apiFn: localApiFn,
  apiParams: {
    current: 1,
    size: 20,
    lang: 'zh_CN',
    keyword: undefined,
    namespace: undefined,
    onlyOverridden: undefined
  },
  // 覆盖值要先拉回来才有得算，故关掉自动请求，由 onMounted 串起来
  immediate: false,
  columns: () => [
    {
      key: 'msgKey',
      dataIndex: 'msgKey',
      title: $t('page.manage.i18n.msgKey'),
      align: 'left',
      width: 340,
      ellipsis: true,
      customRender: ({ record }) => <TypographyText copyable={{ text: record.msgKey }}>{record.msgKey}</TypographyText>
    },
    {
      key: 'baseline',
      dataIndex: 'baseline',
      title: $t('page.manage.i18n.baseline'),
      align: 'left',
      // 不写宽度：与 override 列平分剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      ellipsis: true
    },
    {
      key: 'override',
      dataIndex: 'override',
      title: $t('page.manage.i18n.overrideValue'),
      align: 'left',
      ellipsis: true,
      customRender: ({ record }) => {
        if (record.override === undefined) {
          return <span class="text-gray-400">-</span>;
        }

        return (
          <span class="flex-y-center gap-8px">
            <Tag color="processing">{$t('page.manage.i18n.overriddenTag')}</Tag>
            <span class="ellipsis">{record.override}</span>
          </span>
        );
      }
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 180,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => openOverride(record)}>
            {$t('common.edit')}
          </Button>
          {record.overrideId !== undefined && (
            <Popconfirm
              title={$t('page.manage.i18n.confirmReset')}
              onConfirm={() => handleReset(record.overrideId as string)}
            >
              <Button danger size="small">
                {$t('page.manage.i18n.resetOverride')}
              </Button>
            </Popconfirm>
          )}
        </div>
      )
    }
  ]
});

/**
 * 列宽：定宽列合计 340+180 = 520，baseline / override 两列平分剩余宽度。
 * 默认的 702 装不下 4 列，给到 1100 让这两列各剩约 290px。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1100);

/** 选中行（用于批量还原） */
const checkedKeys = ref<string[]>([]);

const rowSelection = computed(() => ({
  selectedRowKeys: checkedKeys.value,
  onChange: (keys: (string | number)[]) => {
    checkedKeys.value = keys.map(String);
  }
}));

const resetting = ref(false);

/** 抽屉：设置某条 key 的覆盖值 */
const drawerVisible = ref(false);
const currentRow = ref<I18nManageRow | null>(null);

function openOverride(row: I18nManageRow) {
  currentRow.value = row;
  drawerVisible.value = true;
}

async function refreshAll() {
  await loadOverrides();
  checkedKeys.value = [];
  await getData();
}

async function handleReset(overrideId: string) {
  const { error } = await fetchDeleteI18nMessage([overrideId]);

  if (error) {
    window.$message?.error?.($t('common.deleteFailed'));
    return;
  }

  window.$message?.success?.($t('common.deleteSuccess'));
  await refreshAll();
}

/**
 * 批量还原：把选中的 key 的覆盖行全部删掉，回落到前端基线
 *
 * ⚠️ 覆盖行 id 必须从 **overridesByLang**（全量覆盖缓存）里查，不能去 `data.value`
 * 里找 —— 后者只有**当前页**的行。勾选集是按 `msgKey` 存的、跨页保留，
 * 拿「当前页行」去和勾选集取交集，会让「翻到第 2 页再点全选 → 还原」
 * **静默少删**：用户以为清干净了，其实第 1 页选中的那些还在。
 */
async function handleBatchReset() {
  const overrides = overridesByLang.value[searchParams.lang ?? 'zh_CN'] ?? new Map();
  const ids = checkedKeys.value.map(msgKey => overrides.get(msgKey)?.id).filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    window.$message?.warning?.($t('page.manage.i18n.noOverrideSelected'));
    return;
  }

  resetting.value = true;
  try {
    const { error } = await fetchDeleteI18nMessage(ids);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    window.$message?.success?.($t('common.deleteSuccess'));
    await refreshAll();
  } finally {
    resetting.value = false;
  }
}

/** CSV 单元格转义：一律加引号，内部的引号翻倍 */
function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * 导出当前筛选结果（CSV）
 *
 * 这一页的数据源在前端内存里（前端语言文件 + 后端覆盖值），后端**没有**对应的导出端点，
 * 所以只能在浏览器侧生成 —— 也正因此不需要引入 xlsx 依赖（仓库里本来就没有）。
 *
 * 导出的是**全部筛选结果**而非当前页（与 Batch 0 的 F2 约定一致：导出先剥掉分页）；
 * 条件与列表共用 `collectFilteredRows`，不存在两边漂移的可能。
 *
 * 开头写 UTF-8 BOM：否则 Excel 在中文 Windows 上会按 GBK 解码，中文全变乱码 ——
 * 而这份文件的目标读者就是翻译，乱码等于没导出。
 */
function handleExport() {
  const lang = searchParams.lang ?? 'zh_CN';
  const rows = collectFilteredRows(searchParams);

  if (rows.length === 0) {
    window.$message?.warning?.($t('page.manage.i18n.nothingToExport'));
    return;
  }

  const header = [$t('page.manage.i18n.msgKey'), $t('page.manage.i18n.baseline'), $t('page.manage.i18n.overrideValue')];
  const lines = [header, ...rows.map(row => [row.msgKey, row.baseline, row.override ?? ''])];
  const csv = lines.map(cells => cells.map(escapeCsvCell).join(',')).join('\r\n');

  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `i18n_${lang}_${Date.now()}.csv`);
}

onMounted(refreshAll);
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <I18nSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getData" />
    <ACard
      :title="$t('page.manage.i18n.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedKeys.length === 0 || resetting"
          :loading="loading || overridesLoading"
          @delete="handleBatchReset"
          @refresh="refreshAll"
        >
          <!-- 本页没有「新增」：key 来自前端语言文件，不在这里创建 -->
          <template #default>
            <AButton size="small" @click="handleExport">
              {{ $t('page.manage.common.export') }}
            </AButton>
            <AButton size="small" danger :disabled="checkedKeys.length === 0 || resetting" @click="handleBatchReset">
              <template #icon>
                <icon-ic-round-delete class="align-sub text-icon" />
              </template>
              <span class="ml-8px">{{ $t('page.manage.i18n.batchReset') }}</span>
            </AButton>
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
        :loading="loading || overridesLoading"
        row-key="msgKey"
        :pagination="mobilePagination"
        class="h-full"
      />

      <I18nOperateDrawer
        v-if="currentRow"
        v-model:visible="drawerVisible"
        :lang="searchParams.lang ?? 'zh_CN'"
        :msg-key="currentRow.msgKey"
        :baseline="currentRow.baseline"
        :override-id="currentRow.overrideId"
        :override-value="currentRow.override"
        @submitted="refreshAll"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
