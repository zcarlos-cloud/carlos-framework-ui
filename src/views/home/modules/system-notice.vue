<script setup lang="ts">
import { onMounted, ref } from 'vue';
import dayjs from 'dayjs';
import { fetchAddFavorite, fetchCheckFavorites, fetchGetNewsList, fetchRemoveFavorite } from '@/service/api';
import { useNewsDetailModal } from '@/hooks/business/news-detail';
import { useRouterPush } from '@/hooks/common/router';
import { $t } from '@/locales';

defineOptions({
  name: 'SystemNotice'
});

const { routerPushByKey } = useRouterPush();

/** 收藏业务类型（后端 /sys/favorite 的 targetType） */
const FAVORITE_TYPE = 'sys-news';

const notices = ref<Api.SystemManage.News[]>([]);
const loading = ref(false);

/** 已收藏的公告 id 集合（targetId 存公告 id 字符串） */
const favoriteIds = ref<Set<string>>(new Set());

const { contentVisible, contentLoading, contentTitle, contentBody, viewNewsDetail } = useNewsDetailModal();

async function loadNotices() {
  loading.value = true;
  try {
    const { data, error } = await fetchGetNewsList({ current: 1, size: 5, status: '2' });

    if (!error && data?.records) {
      notices.value = data.records;

      const ids = data.records.map(item => String(item.id));
      const checkRes = await fetchCheckFavorites(FAVORITE_TYPE, ids);

      if (!checkRes.error && checkRes.data) {
        favoriteIds.value = new Set(checkRes.data);
      }
    }
  } finally {
    loading.value = false;
  }
}

/** 收藏/取消收藏（乐观更新，失败回滚并提示） */
async function toggleFavorite(item: Api.SystemManage.News) {
  const id = String(item.id);
  const favorited = favoriteIds.value.has(id);
  const next = new Set(favoriteIds.value);

  if (favorited) {
    next.delete(id);
  } else {
    next.add(id);
  }

  favoriteIds.value = next;

  const { error } = favorited
    ? await fetchRemoveFavorite(FAVORITE_TYPE, id)
    : await fetchAddFavorite(FAVORITE_TYPE, id);

  if (error) {
    // 回滚乐观更新：取消收藏失败 → 恢复收藏位；添加失败 → 移除收藏位
    const rollback = new Set(next);

    if (favorited) {
      rollback.add(id);
    } else {
      rollback.delete(id);
    }

    favoriteIds.value = rollback;
    window.$message?.error?.($t('page.home.noticeFavoriteFailed'));
  }
}

function formatTime(time?: string) {
  return time ? dayjs(time).format('YYYY-MM-DD') : '';
}

onMounted(() => {
  loadNotices();
});
</script>

<template>
  <ACard :title="$t('page.home.notice')" :bordered="false" class="h-full card-wrapper">
    <template #extra>
      <AButton type="link" size="small" @click="routerPushByKey('manage_news')">
        {{ $t('page.home.noticeMore') }}
      </AButton>
    </template>
    <ASpin :spinning="loading">
      <div v-if="notices.length" class="flex-col gap-4px">
        <div
          v-for="item in notices"
          :key="item.id"
          class="notice-item flex items-center gap-8px rd-8px px-8px py-10px"
          @click="viewNewsDetail(item.id, item.title)"
        >
          <ATag v-if="item.isTop" color="red" class="shrink-0">{{ $t('page.home.noticeTop') }}</ATag>
          <span class="min-w-0 flex-1 truncate text-13px">{{ item.title }}</span>
          <button
            type="button"
            class="notice-star shrink-0"
            :title="
              favoriteIds.has(String(item.id)) ? $t('page.home.noticeFavoriteCancel') : $t('page.home.noticeFavorite')
            "
            @click.stop="toggleFavorite(item)"
          >
            <SvgIcon
              :icon="favoriteIds.has(String(item.id)) ? 'ant-design:star-filled' : 'ant-design:star-outlined'"
              :class="favoriteIds.has(String(item.id)) ? 'text-15px text-#f59e0b' : 'text-15px'"
            />
          </button>
          <span class="shrink-0 text-12px text-#999 dark:text-#64748b">{{ formatTime(item.publishTime) }}</span>
        </div>
      </div>
      <AEmpty v-else :description="$t('page.home.noticeEmpty')" :image-style="{ height: '72px' }" class="py-24px" />
    </ASpin>
    <AModal v-model:open="contentVisible" :title="contentTitle" :footer="null" :width="640">
      <ASpin :spinning="contentLoading">
        <div class="min-h-120px whitespace-pre-wrap">{{ contentBody }}</div>
      </ASpin>
    </AModal>
  </ACard>
</template>

<style scoped>
.notice-item {
  cursor: pointer;
  transition: background-color 0.16s ease;
}

.notice-item:hover {
  background: rgb(37 99 235 / 6%);
}

.dark .notice-item:hover {
  background: rgb(96 165 250 / 10%);
}

.notice-star {
  display: flex;
  padding: 2px;
  color: #94a3b8;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  transition:
    color 0.15s ease,
    transform 0.15s ease;
}

.notice-star:hover {
  color: #f59e0b;
  transform: scale(1.15);
}
</style>
