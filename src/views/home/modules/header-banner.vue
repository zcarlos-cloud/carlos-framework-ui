<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchGetUserDetail, fetchGetUserRoles } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import { useAuthedImageUrl } from '@/hooks/common/authed-image-url';
import { useRouterPush } from '@/hooks/common/router';
import { $t } from '@/locales';

defineOptions({
  name: 'HeaderBanner'
});

const authStore = useAuthStore();
const { routerPushByKey } = useRouterPush();

/** 当前登录用户的完整资料（/auth/user/me 只给 userId/userName/roles，头像要另拉） */
const profile = ref<Api.Organization.User | null>(null);

/** 角色名列表；/org/user/roles 返回的是名称，且会带过期的临时授权，需要过滤 */
const roleNames = ref<string[]>([]);

const avatarSrc = useAuthedImageUrl(() => profile.value?.avatar);

const greeting = computed(() => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return $t('page.home.greetingMorning', { userName: authStore.userInfo.userName });
  }

  if (hour < 18) {
    return $t('page.home.greetingAfternoon', { userName: authStore.userInfo.userName });
  }

  return $t('page.home.greetingEvening', { userName: authStore.userInfo.userName });
});

// 角色名拉取失败时退回 authStore 里的编码，避免整行空白
const displayRoles = computed(() =>
  (roleNames.value.length > 0 ? roleNames.value : authStore.userInfo.roles).slice(0, 3)
);

async function getProfile() {
  const userId = authStore.userInfo.userId;

  if (!userId) {
    return;
  }

  const { data, error } = await fetchGetUserDetail(userId);

  if (!error && data) {
    profile.value = data;
  }
}

async function getRoleNames(userId: string) {
  const { data, error } = await fetchGetUserRoles(userId);

  if (error || !data) {
    return;
  }

  const now = Date.now();

  roleNames.value = data
    .filter(item => !item.expireTime || new Date(item.expireTime).getTime() > now)
    .map(item => item.roleName || item.roleCode || item.roleId);
}

onMounted(() => {
  const { userId } = authStore.userInfo;

  getProfile();

  if (userId) {
    getRoleNames(userId);
  }
});
</script>

<template>
  <ACard :bordered="false" class="card-wrapper" :body-style="{ padding: 0 }">
    <div class="home-banner relative overflow-hidden px-24px py-30px text-white sm:px-32px">
      <div class="banner-deco" aria-hidden="true" />
      <div class="relative flex flex-wrap items-center justify-between gap-16px">
        <div class="min-w-0 flex items-center gap-16px">
          <AAvatar :size="56" :src="avatarSrc" class="banner-avatar shrink-0">
            <template #icon>
              <SvgIcon icon="ph:user-circle" class="text-30px" />
            </template>
          </AAvatar>
          <div class="min-w-0">
            <h3 class="text-20px font-semibold sm:text-24px">{{ greeting }}</h3>
            <p class="mt-8px text-13px text-white/75 sm:text-14px">
              {{ $t('page.home.bannerSubtitle') }}
            </p>
            <div v-if="displayRoles.length" class="mt-14px flex flex-wrap gap-8px">
              <span v-for="role in displayRoles" :key="role" class="banner-role">{{ role }}</span>
            </div>
          </div>
        </div>
        <div class="flex shrink-0 gap-12px">
          <AButton class="banner-btn" @click="routerPushByKey('user-center')">
            {{ $t('page.home.bannerProfile') }}
          </AButton>
          <AButton class="banner-btn" @click="routerPushByKey('manage_monitor_dashboard')">
            {{ $t('page.home.bannerMonitor') }}
          </AButton>
        </div>
      </div>
    </div>
  </ACard>
</template>

<style scoped>
.home-banner {
  background: linear-gradient(120deg, #2563eb 0%, #4f46e5 55%, #7c3aed 115%);
}

.dark .home-banner {
  background: linear-gradient(120deg, #1e3a8a 0%, #4338ca 55%, #5b21b6 115%);
}

.banner-deco {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 85% 15%, rgb(255 255 255 / 16%), transparent 42%),
    linear-gradient(rgb(255 255 255 / 7%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 7%) 1px, transparent 1px);
  background-size:
    100% 100%,
    36px 36px,
    36px 36px;
  mask-image: linear-gradient(120deg, #000 30%, transparent 90%);
  -webkit-mask-image: linear-gradient(120deg, #000 30%, transparent 90%);
}

.banner-avatar {
  background: rgb(255 255 255 / 18%);
  border: 2px solid rgb(255 255 255 / 55%);
  box-shadow: 0 4px 14px rgb(0 0 0 / 18%);
}

.banner-role {
  padding: 2px 10px;
  font-size: 12px;
  color: rgb(255 255 255 / 88%);
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 999px;
  background: rgb(255 255 255 / 12%);
}

.banner-btn {
  color: #fff;
  background: rgb(255 255 255 / 14%);
  border-color: rgb(255 255 255 / 35%);
}

.banner-btn:hover {
  color: #fff !important;
  background: rgb(255 255 255 / 24%) !important;
  border-color: rgb(255 255 255 / 55%) !important;
}
</style>
