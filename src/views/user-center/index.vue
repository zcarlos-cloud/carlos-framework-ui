<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchGetUserDepartments, fetchGetUserDetail, fetchGetUserRoles } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import { $t } from '@/locales';
import UserAccount from './modules/user-account.vue';
import UserPassword from './modules/user-password.vue';
import UserProfile from './modules/user-profile.vue';

defineOptions({
  name: 'UserCenter'
});

const authStore = useAuthStore();

/** 当前登录用户的完整资料（/auth/user/me 只给 userId/userName/roles，资料要另拉） */
const profile = ref<Api.Organization.User | null>(null);
const loading = ref(false);

/** 主部门名称；取不到时留空，由展示层回退为短横线 */
const mainDeptName = ref('');

/** 已绑定角色的**名称**（不是角色编码） */
const roleNames = ref<string[]>([]);

const activeTab = ref('profile');

async function getProfile() {
  const userId = authStore.userInfo.userId;

  if (!userId) {
    return;
  }

  loading.value = true;
  try {
    const { data, error } = await fetchGetUserDetail(userId);

    if (!error && data) {
      profile.value = data;
    }
  } finally {
    loading.value = false;
  }
}

/**
 * 角色与部门
 *
 * 此前这里拉的是**整棵部门树**，再在前端遍历建 id → 名称的映射，只为了显示一个主部门名。
 * 改成按 userId 各查一次，理由有三：
 * 1. 需要的是「这个用户的部门」，不是「全部部门」，全树遍历是为一个值付全量的代价；
 * 2. 页面注释原先担心「普通用户未必有部门树的读取权限」—— 按 userId 查不需要树读取权限，
 *    这个顾虑从根上消失（不必依赖请求层是否有「静默失败」开关）；
 * 3. `/org/user/departments` 会带上 `isMain`，主部门由后端标好，前端不用猜；
 *    同理角色直接用 `/org/user/roles` 的 `roleName`，不必拿 `authStore.userInfo.roles`
 *    里的裸编码（如 `ROLE_SUPER_ADMIN`）去反查。
 */
async function getRolesAndDepts(userId: string) {
  const [deptRes, roleRes] = await Promise.all([fetchGetUserDepartments(userId), fetchGetUserRoles(userId)]);

  if (!deptRes.error && deptRes.data) {
    // 没有任何部门标 isMain 时退回第一个，避免整行空白
    const mainDept = deptRes.data.find(item => item.isMain) ?? deptRes.data[0];

    mainDeptName.value = mainDept?.departmentName ?? '';
  }

  if (!roleRes.error && roleRes.data) {
    // 角色被删除后 roleName / roleCode 都会是 null，退回 roleId 至少能让人认出是哪一条
    roleNames.value = roleRes.data.map(item => item.roleName || item.roleCode || item.roleId);
  }
}

onMounted(() => {
  const { userId } = authStore.userInfo;

  getProfile();

  if (userId) {
    getRolesAndDepts(userId);
  }
});
</script>

<template>
  <div class="min-h-500px">
    <ACard :title="$t('page.userCenter.title')" :bordered="false" class="card-wrapper">
      <ASpin :spinning="loading">
        <ATabs v-model:active-key="activeTab" tab-position="left">
          <ATabPane key="profile" :tab="$t('page.userCenter.tabs.profile')">
            <UserProfile :profile="profile" @updated="getProfile" />
          </ATabPane>
          <ATabPane key="password" :tab="$t('page.userCenter.tabs.password')">
            <UserPassword :user-id="authStore.userInfo.userId" />
          </ATabPane>
          <ATabPane key="account" :tab="$t('page.userCenter.tabs.account')">
            <UserAccount :profile="profile" :main-dept-name="mainDeptName" :role-names="roleNames" />
          </ATabPane>
        </ATabs>
      </ASpin>
    </ACard>
  </div>
</template>

<style scoped></style>
