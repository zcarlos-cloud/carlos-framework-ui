import { computed, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { defineStore } from 'pinia';
import { useLoading } from '@sa/hooks';
import { fetchGetUserInfo, fetchLogout, fetchMfaStepUpVerify, fetchPreCheck } from '@/service/api';
import { useRouterPush } from '@/hooks/common/router';
import { syncWarmFlowToken } from '@/utils/warm-flow';
import { SetupStoreId } from '@/enum';
import { $t } from '@/locales';
import { useRouteStore } from '../route';
import { useTabStore } from '../tab';
import { clearAuthStorage, getToken, saveAuthStorage } from './shared';

export const useAuthStore = defineStore(SetupStoreId.Auth, () => {
  const route = useRoute();
  const routeStore = useRouteStore();
  const tabStore = useTabStore();
  const { toLogin, redirectFromLogin } = useRouterPush(false);
  const { loading: loginLoading, startLoading, endLoading } = useLoading();

  const token = ref(getToken());

  // 冷启动补同步：刷新页面/复用旧会话时，localStorage 里可能已有 token
  // 但还没有 Warm-Flow 设计器要的那份副本（见 @/utils/warm-flow）
  syncWarmFlowToken(token.value);

  const userInfo: Api.Auth.UserInfo = reactive({
    userId: '',
    userName: '',
    roles: [],
    buttons: []
  });

  /** MFA 相关状态 */
  const mfaRequired = ref(false);
  const mfaToken = ref('');

  /** 预校验结果 */
  const preCheckResult = ref<Api.Auth.PreCheckResponse | null>(null);

  /** is super role in static route */
  const isStaticSuper = computed(() => {
    const { VITE_AUTH_ROUTE_MODE, VITE_STATIC_SUPER_ROLE } = import.meta.env;

    return VITE_AUTH_ROUTE_MODE === 'static' && userInfo.roles.includes(VITE_STATIC_SUPER_ROLE);
  });

  /** Is login */
  const isLogin = computed(() => Boolean(token.value));

  /** Reset auth store */
  async function resetStore() {
    const authStore = useAuthStore();

    // 通知后端撤销 Token
    try {
      await fetchLogout();
    } catch {
      // 即使后端调用失败也继续清理本地状态
    }

    clearAuthStorage();
    mfaRequired.value = false;
    mfaToken.value = '';
    preCheckResult.value = null;

    authStore.$reset();

    if (!route.meta.constant) {
      await toLogin();
    }

    tabStore.cacheTabs();
    routeStore.resetStore();
  }

  /**
   * 登录预校验
   *
   * 调用后端风控引擎，获取登录挑战策略（验证码类型、是否需要MFA、是否阻断）
   */
  async function preCheck(userName: string) {
    const { data, error } = await fetchPreCheck(userName, getDeviceFingerprint());
    if (!error && data) {
      preCheckResult.value = data;
    }
    return data;
  }

  /**
   * SSO 模式：login 方法重定向到 IdP
   *
   * 兼容旧签名（pwd-login 调用），SSO 模式下直接跳转到 IdP 授权端点。
   * 实际认证在 IdP 统一登录页完成，回调到 /oauth2/callback 处理 Token。
   */
  async function login(_userName?: string, _password?: string, _redirect = true) {
    // SSO 模式下不处理密码登录，由 router hook 的 toLogin 触发跳转
    // 此方法保留仅为兼容性（如果有组件直接调用 authStore.login）
    window.$message?.info('正在跳转到统一认证中心...');
  }

  /**
   * MFA 验证（Step 3）
   *
   * 密码验证通过后，用户输入 TOTP 验证码完成第二因素认证。
   *
   * @param code TOTP 验证码或恢复码
   * @param trustDevice 是否标记为受信任设备
   */
  async function verifyMfa(code: string, trustDevice = false) {
    startLoading();

    const { data: loginToken, error } = await fetchMfaStepUpVerify({
      mfaToken: mfaToken.value,
      code,
      trustDevice,
      deviceFingerprint: getDeviceFingerprint(),
      deviceName: navigator.userAgent.substring(0, 50)
    });

    if (!error && loginToken) {
      mfaRequired.value = false;
      mfaToken.value = '';

      const pass = await loginByToken(loginToken);
      if (pass) {
        await redirectFromLogin(true);

        window.$notification?.success({
          message: $t('page.login.common.loginSuccess'),
          description: 'MFA 验证通过'
        });
      }
    } else {
      window.$message?.error('MFA 验证码错误，请重试');
    }

    endLoading();
  }

  async function loginByToken(loginToken: Api.Auth.LoginToken) {
    // 1. stored in the localStorage, the later requests need it in headers
    // （同时把 token 同步给 Warm-Flow 设计器，见 src/utils/warm-flow.ts）
    saveAuthStorage(loginToken);

    // 2. get user info
    const pass = await getUserInfo();

    if (pass) {
      token.value = loginToken.token;

      return true;
    }

    return false;
  }

  async function getUserInfo() {
    const { data: info, error } = await fetchGetUserInfo();

    if (!error) {
      // update store
      Object.assign(userInfo, info);

      return true;
    }

    return false;
  }

  async function initUserInfo() {
    const hasToken = getToken();

    if (hasToken) {
      const pass = await getUserInfo();

      if (!pass) {
        resetStore();
      }
    }
  }

  return {
    token,
    userInfo,
    isStaticSuper,
    isLogin,
    loginLoading,
    mfaRequired,
    mfaToken,
    preCheckResult,
    resetStore,
    preCheck,
    login,
    loginByToken,
    verifyMfa,
    initUserInfo
  };
});

/**
 * 获取设备指纹（简化版）
 *
 * 生产环境建议使用 FingerprintJS 等库采集更完整的设备特征。
 */
function getDeviceFingerprint(): string {
  const parts = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency || '')
  ];
  return `fp_${btoa(parts.join('|')).substring(0, 32)}`;
}
