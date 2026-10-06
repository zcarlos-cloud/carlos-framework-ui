<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchGetMyNewsDetail, fetchGetMyNewsList, fetchGetNewsUnreadCount, fetchReadNews } from '@/service/api';
import { useNewsDetailModal } from '@/hooks/business/news-detail';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'NewsBell'
});

// 公告类型 Tag 改由后端枚举字典驱动；铃铛在顶栏独立挂载，自己保证加载
ensureEnumDict('sys');

/**
 * 公告铃铛（S3 用户端）：角标显示未读数，点开拉取我可见的公告列表，
 * 点击条目查看内容并自动标记已读。一期为纯拉取模式（无 WebSocket 推送），
 * 未读数在挂载与每次打开时刷新。
 */

const visible = ref(false);
const loading = ref(false);
const onlyUnread = ref(false);
const unreadCount = ref(0);
const list = ref<Api.SystemManage.News[]>([]);

// 用户端详情必须走 my/detail（带可见性校验），不能复用管理端 detail
const { contentVisible, contentLoading, contentTitle, contentBody, viewNewsDetail } =
  useNewsDetailModal(fetchGetMyNewsDetail);

async function loadUnreadCount() {
  const { data, error } = await fetchGetNewsUnreadCount();
  if (!error && data !== null && data !== undefined) {
    unreadCount.value = Number(data);
  }
}

async function loadList() {
  loading.value = true;
  try {
    const { data, error } = await fetchGetMyNewsList({
      current: 1,
      size: 10,
      onlyUnread: onlyUnread.value || undefined
    });
    if (!error && data) {
      list.value = data.records;
    }
  } finally {
    loading.value = false;
  }
}

function handleOpen(open: boolean) {
  visible.value = open;
  if (open) {
    loadUnreadCount();
    loadList();
  }
}

function toggleUnread(val: boolean | string | number) {
  onlyUnread.value = Boolean(val);
  loadList();
}

async function viewNews(record: Api.SystemManage.News) {
  // 列表接口不下发 content 大字段，点开才查详情
  await viewNewsDetail(String(record.id), record.title);

  // 未读则标记并刷新角标/行状态（后端幂等）；不可变更新，不直接改行对象
  if (!record.isRead) {
    const { error } = await fetchReadNews(String(record.id));
    if (!error) {
      list.value = list.value.map(item => (item.id === record.id ? { ...item, isRead: true } : item));
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }
  }
}

onMounted(loadUnreadCount);
</script>

<template>
  <APopover :open="visible" trigger="click" placement="bottomRight" @open-change="handleOpen">
    <ABadge :count="unreadCount" :offset="[-2, 2]" size="small">
      <ButtonIcon icon="carbon:notification" :tooltip-content="$t('page.manage.news.bell')" trigger-parent />
    </ABadge>
    <template #content>
      <div class="w-360px">
        <div class="mb-8px flex-y-center justify-between">
          <span class="font-medium">{{ $t('page.manage.news.bell') }}</span>
          <span class="flex-y-center gap-4px text-12px">
            {{ $t('page.manage.news.onlyUnread') }}
            <ASwitch :checked="onlyUnread" size="small" @change="toggleUnread" />
          </span>
        </div>
        <ASpin :spinning="loading">
          <div class="max-h-360px overflow-y-auto">
            <div v-if="!list.length" class="py-24px text-center text-12px opacity-60">
              {{ $t('page.manage.news.noNews') }}
            </div>
            <div
              v-for="item in list"
              :key="item.id"
              class="cursor-pointer rounded px-8px py-6px hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="viewNews(item)"
            >
              <div class="flex-y-center gap-6px">
                <ABadge v-if="!item.isRead" status="error" />
                <span class="flex-1 truncate text-13px">{{ item.title }}</span>
                <ATag :color="enumDictColor('sys', 'SysNewsType', item.newsType)" class="mr-0">
                  {{ enumDictText('sys', 'SysNewsType', item.newsType) }}
                </ATag>
              </div>
              <div class="mt-2px text-12px opacity-50">{{ item.publishTime || '' }}</div>
            </div>
          </div>
        </ASpin>
      </div>
    </template>
  </APopover>
  <AModal v-model:open="contentVisible" :title="contentTitle" :footer="null" :width="640">
    <ASpin :spinning="contentLoading">
      <div class="min-h-120px whitespace-pre-wrap">{{ contentBody }}</div>
    </ASpin>
  </AModal>
</template>

<style scoped></style>
