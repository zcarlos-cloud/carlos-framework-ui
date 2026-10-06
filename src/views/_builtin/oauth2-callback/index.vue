<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { fetchExchangeToken } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import { $t } from '@/locales';

const router = useRouter();
const authStore = useAuthStore();

/**
 * 失败后统一收尾：先弹提示，再延迟重置登录态
 *
 * 重置必须延迟 —— `resetStore` 会把当前路由切到登录页，立刻调用的话用户看不到这条提示。
 */
function fail(message: string) {
  window.$message?.error(message);
  setTimeout(() => authStore.resetStore(), 1500);
}

onMounted(async () => {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) {
    // error_description 是 IdP 给的原文，拿不到时才回退到本地文案
    fail(params.get('error_description') || $t('page.login.oauth2Callback.authFailed'));

    return;
  }

  if (!code) {
    fail($t('page.login.oauth2Callback.noCode'));

    return;
  }

  // 校验 state 防 CSRF
  const savedState = sessionStorage.getItem('oauth_state');
  if (!state || state !== savedState) {
    fail($t('page.login.oauth2Callback.stateMismatch'));

    return;
  }

  // 取出 PKCE verifier
  const verifier = sessionStorage.getItem('pkce_verifier') || '';
  const redirectUri = `${location.origin}/oauth2/callback`;

  try {
    const { data, error: err } = await fetchExchangeToken({
      code,
      verifier,
      redirectUri
    });

    if (err || !data) {
      fail($t('page.login.oauth2Callback.tokenExchangeFailed'));

      return;
    }

    // 清理 PKCE 临时数据
    sessionStorage.removeItem('pkce_verifier');
    sessionStorage.removeItem('oauth_state');

    // 存储 Token，并同步 authStore 状态
    // 注意：必须走 loginByToken，它除了写 localStorage 还会同步响应式 token、
    // 拉取用户信息；只写 localStorage 会导致 authStore.isLogin 一直为 false
    const pass = await authStore.loginByToken(data);

    if (!pass) {
      fail($t('page.login.oauth2Callback.userInfoFailed'));

      return;
    }

    // 跳回登录前的页面
    const redirect = sessionStorage.getItem('login_redirect') || '/';
    sessionStorage.removeItem('login_redirect');
    router.replace(redirect);
  } catch {
    fail($t('page.login.oauth2Callback.unexpected'));
  }
});
</script>

<template>
  <div class="size-full flex-center">
    <ASpin size="large" :tip="$t('page.login.oauth2Callback.processing')" />
  </div>
</template>

<style scoped></style>
