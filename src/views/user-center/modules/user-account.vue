<script setup lang="ts">
import { Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'UserAccount'
});

// 状态字典由后端 /org/app/enums 下发（user-center 不在 org 路由下，自己保证加载）
ensureEnumDict('org');

interface Props {
  /** 当前登录用户的完整资料；null 表示尚未加载出来 */
  profile?: Api.Organization.User | null;
  /** 主部门名称；后端未标 isMain 或接口失败时为空 */
  mainDeptName?: string;
  /**
   * 已绑定角色的**名称**
   *
   * 由 `index.vue` 从 `/org/user/roles` 取回后传入。此前这里直接渲染
   * `authStore.userInfo.roles`，那是 `/auth/user/me` 下发的**角色编码**
   * （形如 `ROLE_SUPER_ADMIN`），对用户没有可读性。
   */
  roleNames?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  profile: null,
  mainDeptName: '',
  roleNames: () => []
});

/** 后端 LocalDateTime 无全局格式器，走 Jackson 默认 ISO-8601，此处统一格式化 */
function formatTime(value?: string | null): string {
  if (!value) {
    return '-';
  }

  const date = dayjs(value);

  return date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss') : '-';
}
</script>

<template>
  <ADescriptions :column="1" bordered size="middle" class="max-w-640px">
    <ADescriptionsItem :label="$t('page.userCenter.account')">
      {{ profile?.account ?? '-' }}
    </ADescriptionsItem>

    <ADescriptionsItem :label="$t('page.userCenter.nickname')">
      {{ profile?.nickname ?? '-' }}
    </ADescriptionsItem>

    <ADescriptionsItem :label="$t('page.userCenter.roles')">
      <template v-if="props.roleNames.length">
        <Tag v-for="role in props.roleNames" :key="role" color="processing">{{ role }}</Tag>
      </template>
      <template v-else>-</template>
    </ADescriptionsItem>

    <ADescriptionsItem :label="$t('page.userCenter.userStatus')">
      <Tag
        v-if="profile?.userStatus !== null && profile?.userStatus !== undefined"
        :color="enumDictColor('org', 'OrgUserState', profile.userStatus)"
      >
        {{ enumDictText('org', 'OrgUserState', profile.userStatus) }}
      </Tag>
      <template v-else>-</template>
    </ADescriptionsItem>

    <ADescriptionsItem :label="$t('page.userCenter.mainDept')">
      {{ props.mainDeptName || '-' }}
    </ADescriptionsItem>

    <ADescriptionsItem :label="$t('page.userCenter.lastLoginTime')">
      {{ formatTime(profile?.loginTime) }}
    </ADescriptionsItem>

    <ADescriptionsItem :label="$t('page.userCenter.lastLoginIp')">
      {{ profile?.loginIp || '-' }}
    </ADescriptionsItem>

    <ADescriptionsItem :label="$t('page.userCenter.loginCount')">
      {{ profile?.loginCount ?? '-' }}
    </ADescriptionsItem>

    <ADescriptionsItem :label="$t('page.userCenter.passwordLastModify')">
      {{ formatTime(profile?.pwdLastModify) }}
    </ADescriptionsItem>
  </ADescriptions>
</template>

<style scoped></style>
