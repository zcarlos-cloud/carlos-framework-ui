<script setup lang="tsx">
import { computed, onMounted, ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import type { RouteKey } from '@elegant-router/types';
import { fetchGetAllFavorites, fetchGetNewsDetail, fetchRemoveFavorite } from '@/service/api';
import { useRouteStore } from '@/store/modules/route';
import { useNewsDetailModal } from '@/hooks/business/news-detail';
import { useRouterPush } from '@/hooks/common/router';
import { useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import FavoriteSearch from './modules/favorite-search.vue';

defineOptions({
  name: 'ManageFavorite'
});

/** 表格行类型：Favorite + 虚拟列字段（index 序号列、targetName 解析列，仅渲染用） */
type FavoriteRow = Api.SystemManage.Favorite & { index: number; targetName: string };

/**
 * 列宽：定宽列合计 48(selection)+64+110+170+190 = 582，弹性列 targetName 不封顶。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(900);

const routeStore = useRouteStore();
const { routerPushByKey } = useRouterPush();

/** 公告详情弹窗（查看收藏的 sys-news 内容，与管理端公告页共用 composable） */
const { contentVisible, contentLoading, contentTitle, contentBody, viewNewsDetail } = useNewsDetailModal();

/** 全部收藏（/sys/favorite/all 按登录用户隔离，跨类型） */
const favorites = ref<Api.SystemManage.Favorite[]>([]);
const loading = ref(false);

/** 公告标题缓存（targetId → 标题），收藏数有限，按 id 逐个解析 */
const newsTitleMap = ref<Record<string, string>>({});

/**
 * 已知收藏类型的展示元数据；未注册类型按原始 targetType 展示，保证前端不丢数据
 *
 * label 用函数包 $t，切换语言时标签跟随更新。
 */
const TYPE_META: Record<string, { label: () => string; color: string }> = {
  'quick-nav': { label: () => $t('page.manage.favorite.type.quickNav'), color: 'processing' },
  'sys-news': { label: () => $t('page.manage.favorite.type.sysNews'), color: 'purple' }
};

/** 菜单拍平（复用首页快捷入口的解析思路）：routeKey → 菜单信息 */
const menuMap = computed(() => {
  const map = new Map<RouteKey, { label: string; icon?: App.Global.Menu['icon']; parentLabel?: string }>();

  const walk = (items: App.Global.Menu[], parent?: App.Global.Menu) => {
    items.forEach(item => {
      if (item.children?.length) {
        walk(item.children, item);
      } else if (item.routeKey) {
        map.set(item.routeKey, { label: item.label, icon: item.icon, parentLabel: parent?.label });
      }
    });
  };

  walk(routeStore.menus);

  return map;
});

interface ResolvedName {
  label: string;
  /** 额外说明：菜单父级 / 下线提示 */
  extra?: string;
  icon?: App.Global.Menu['icon'];
  /** 内容是否已不可访问（菜单下线/公告删除） */
  unavailable?: boolean;
}

/**
 * 收藏内容解析：targetId 为不透明字符串，名称渲染时按类型解析
 *
 * quick-nav → 动态菜单；sys-news → 公告标题；未知类型 → 原始 targetId。
 * 已保存但当前无权访问/已下线的内容标记 unavailable，仅展示不可跳转。
 */
/** 正在解析中的公告 id（解析失败前不标下线，避免闪烁） */
const newsPending = new Set<string>();

function resolveName(favorite: Api.SystemManage.Favorite): ResolvedName {
  if (favorite.targetType === 'quick-nav') {
    const menu = menuMap.value.get(favorite.targetId as RouteKey);

    if (menu) {
      return { label: menu.label, extra: menu.parentLabel, icon: menu.icon };
    }

    return {
      label: favorite.targetId,
      extra: $t('page.manage.favorite.unavailable'),
      unavailable: true
    };
  }

  if (favorite.targetType === 'sys-news') {
    const title = newsTitleMap.value[favorite.targetId];

    if (title) {
      return { label: title };
    }

    return {
      label: favorite.targetId,
      extra: $t('page.manage.favorite.unavailable'),
      unavailable: !newsPending.has(favorite.targetId)
    };
  }

  return { label: favorite.targetId };
}

async function loadNewsTitles(items: Api.SystemManage.Favorite[]) {
  const ids = items.filter(item => item.targetType === 'sys-news').map(item => item.targetId);

  await Promise.all(
    ids.map(async id => {
      if (newsTitleMap.value[id] || newsPending.has(id)) {
        return;
      }

      newsPending.add(id);
      try {
        const { data, error } = await fetchGetNewsDetail(id);

        if (!error && data?.title) {
          newsTitleMap.value = { ...newsTitleMap.value, [id]: data.title };
        }
      } finally {
        newsPending.delete(id);
      }
    })
  );
}

async function getData() {
  loading.value = true;
  try {
    const { data, error } = await fetchGetAllFavorites();

    if (!error && data) {
      favorites.value = data;
      loadNewsTitles(data);
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  getData();
});

/** 查询条件（点「搜索」提交）与搜索草稿（表单直接编辑） */
const searchParams = ref<Required<Api.SystemManage.FavoriteSearchParams>>({ targetType: '', keyword: '' });
const searchState = ref<Api.SystemManage.FavoriteSearchParams>({ ...searchParams.value });

function resetSearch() {
  searchState.value = { targetType: '', keyword: '' };
  searchParams.value = { targetType: '', keyword: '' };
}

function searchFavorites() {
  searchParams.value = { targetType: searchState.value.targetType ?? '', keyword: searchState.value.keyword ?? '' };
}

/** 类型筛选选项由数据中出现过的类型动态派生，未知类型也能筛 */
const typeOptions = computed(() => {
  const types = [...new Set(favorites.value.map(item => item.targetType))];

  return types.map(type => ({
    value: type,
    label: TYPE_META[type]?.label() ?? type
  }));
});

/** 关键字按解析后的名称过滤 */
const filteredData = computed(() => {
  const kw = searchParams.value.keyword.trim().toLowerCase();

  return favorites.value.filter(item => {
    if (searchParams.value.targetType && item.targetType !== searchParams.value.targetType) {
      return false;
    }

    if (!kw) {
      return true;
    }

    const resolved = resolveName(item);

    return resolved.label.toLowerCase().includes(kw);
  });
});

/** 批量取消收藏 */
const selectedKeys = ref<string[]>([]);
const removing = ref(false);

async function doRemove(items: Api.SystemManage.Favorite[]) {
  removing.value = true;
  try {
    await Promise.all(items.map(item => fetchRemoveFavorite(item.targetType, item.targetId)));
    window.$message?.success?.($t('page.manage.favorite.removeSuccess'));
    selectedKeys.value = [];
    await getData();
  } finally {
    removing.value = false;
  }
}

function handleBatchRemove() {
  const targets = favorites.value.filter(item => selectedKeys.value.includes(item.id));

  doRemove(targets);
}

/** 跳转/查看 */
function jumpOrView(favorite: Api.SystemManage.Favorite) {
  if (favorite.targetType === 'quick-nav') {
    routerPushByKey(favorite.targetId as RouteKey);
    return;
  }

  if (favorite.targetType === 'sys-news') {
    viewNewsDetail(favorite.targetId, newsTitleMap.value[favorite.targetId] ?? favorite.targetId);
  }
}

function buildColumns(): AntDesign.TableColumn<FavoriteRow>[] {
  return [
    {
      key: 'index',
      dataIndex: 'index',
      title: $t('common.index'),
      width: 64,
      align: 'center',
      customRender: ({ index }) => index + 1
    },
    {
      key: 'targetType',
      dataIndex: 'targetType',
      title: $t('page.manage.favorite.targetType'),
      width: 110,
      align: 'center',
      customRender: ({ record }) => {
        const meta = TYPE_META[record.targetType];

        return <Tag color={meta?.color}>{meta?.label() ?? record.targetType}</Tag>;
      }
    },
    {
      key: 'targetName',
      dataIndex: 'targetId',
      title: $t('page.manage.favorite.targetName'),
      align: 'center',
      customRender: ({ record }) => {
        const resolved = resolveName(record);

        return (
          <div class="flex items-center gap-8px text-left">
            {resolved.icon ? (
              <span class="flex-center shrink-0 text-18px text-icon">
                <resolved.icon />
              </span>
            ) : null}
            <div class="min-w-0">
              <p class="truncate">{resolved.label}</p>
              {resolved.extra ? <p class="text-12px text-#999 dark:text-#64748b">{resolved.extra}</p> : null}
            </div>
          </div>
        );
      }
    },
    {
      key: 'createTime',
      dataIndex: 'createTime',
      title: $t('page.manage.favorite.favoriteTime'),
      width: 170,
      align: 'center',
      customRender: ({ record }) => formatDateTime(record.createTime)
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      width: 190,
      align: 'center',
      customRender: ({ record }) => {
        const resolved = resolveName(record);
        const jumpable =
          !resolved.unavailable && (record.targetType === 'quick-nav' || record.targetType === 'sys-news');

        return (
          <div class="flex-center gap-8px">
            <Button size="small" type="link" disabled={!jumpable} onClick={() => jumpOrView(record)}>
              {record.targetType === 'sys-news' ? $t('page.manage.favorite.view') : $t('page.manage.favorite.jump')}
            </Button>
            <Popconfirm title={$t('page.manage.favorite.removeConfirm')} onConfirm={() => doRemove([record])}>
              <Button danger type="text" size="small" disabled={removing.value}>
                {$t('page.manage.favorite.remove')}
              </Button>
            </Popconfirm>
          </div>
        );
      }
    }
  ];
}

/** 列显示勾选（TableHeaderOperation 的列设置）；列标题随语言初始化一次 */
const allColumns = computed(buildColumns);

const columnChecks = ref<AntDesign.TableColumnCheck[]>(
  allColumns.value
    .filter(column => column.key)
    .map(column => ({ key: column.key as string, title: column.title as string, checked: true }))
);

const columns = computed(() => {
  const checkedKeys = new Set(columnChecks.value.filter(item => item.checked).map(item => item.key));

  return allColumns.value.filter(column => !column.key || checkedKeys.has(column.key as string));
});

const rowSelection = computed(() => ({
  selectedRowKeys: selectedKeys.value,
  onChange: (keys: Array<string | number>) => {
    selectedKeys.value = keys.map(String);
  }
}));
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FavoriteSearch
      v-model:model="searchState"
      :type-options="typeOptions"
      @reset="resetSearch"
      @search="searchFavorites"
    />
    <ACard
      :title="$t('page.manage.favorite.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :show-add="false"
          :show-delete="false"
          :loading="loading"
          @refresh="getData"
        >
          <template #prefix>
            <APopconfirm
              :title="$t('page.manage.favorite.batchRemoveConfirm', { count: selectedKeys.length })"
              @confirm="handleBatchRemove"
            >
              <AButton size="small" danger :disabled="selectedKeys.length === 0 || removing">
                <template #icon>
                  <icon-ic-round-delete class="align-sub text-icon" />
                </template>
                <span class="ml-8px">{{ $t('page.manage.favorite.batchRemove') }}</span>
              </AButton>
            </APopconfirm>
          </template>
        </TableHeaderOperation>
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="filteredData"
        :loading="loading"
        :row-selection="rowSelection"
        row-key="id"
        size="small"
        :pagination="false"
        :scroll="scrollConfig"
        class="h-full"
      />
    </ACard>

    <AModal v-model:open="contentVisible" :title="contentTitle" :footer="null" :width="640">
      <ASpin :spinning="contentLoading">
        <div class="max-h-60vh overflow-y-auto" v-html="contentBody"></div>
      </ASpin>
    </AModal>
  </div>
</template>

<style scoped></style>
