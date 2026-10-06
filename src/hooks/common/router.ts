import type { RouteLocationRaw } from 'vue-router';
import { useRouter } from 'vue-router';
import type { RouteKey } from '@elegant-router/types';
import { router as globalRouter } from '@/router';

/**
 * Router push
 *
 * Jump to the specified route, it can replace function router.push
 *
 * @param inSetup Whether is in vue script setup
 */
export function useRouterPush(inSetup = true) {
  const router = inSetup ? useRouter() : globalRouter;
  const route = globalRouter.currentRoute;

  const routerPush = router.push;

  const routerBack = router.back;

  interface RouterPushOptions {
    query?: Record<string, string>;
    params?: Record<string, string>;
  }

  async function routerPushByKey(key: RouteKey, options?: RouterPushOptions) {
    const { query, params } = options || {};

    const routeLocation: RouteLocationRaw = {
      name: key
    };

    if (Object.keys(query || {}).length) {
      routeLocation.query = query;
    }

    if (Object.keys(params || {}).length) {
      routeLocation.params = params;
    }

    return routerPush(routeLocation);
  }

  function routerPushByKeyWithMetaQuery(key: RouteKey) {
    const allRoutes = router.getRoutes();
    const meta = allRoutes.find(item => item.name === key)?.meta || null;

    const query: Record<string, string> = {};

    meta?.query?.forEach(item => {
      query[item.key] = item.value;
    });

    return routerPushByKey(key, { query });
  }

  async function toHome() {
    return routerPushByKey('root');
  }

  /**
   * Navigate to login — 统一认证方案未完全实现前，先回本地登录页
   *
   * <p>登录入口暂时收口到本地 /login（密码/验证码等模块）；
   * 需要走 IdP 统一认证时，由登录页的「统一认证登录」按钮显式发起
   * （见 redirectToIdpAuthorize）。</p>
   *
   * @param loginModule 登录模块（默认密码登录）
   * @param redirectUrl 登录后回到业务应用的路径
   */
  async function toLogin(loginModule: UnionKey.LoginModule = 'pwd-login', redirectUrl?: string) {
    const redirect = redirectUrl || route.value.fullPath;
    await routerPushByKey('login', {
      query: { redirect },
      params: { module: loginModule }
    });
  }

  /**
   * Redirect to IdP /oauth2/authorize with PKCE
   *
   * <p>生成 code_verifier 和 code_challenge，verifier 存 sessionStorage，
   * challenge 随授权请求发送。IdP 登录后回调 /oauth2/callback?code=xxx，
   * 由回调页用 code + verifier 换 Token。</p>
   */
  async function redirectToIdpAuthorize(redirect?: string) {
    const idpBaseUrl = import.meta.env.VITE_AUTH_IDP_URL || '';
    const clientId = import.meta.env.VITE_AUTH_CLIENT_ID || 'carlos-client';
    const redirectUri = `${location.origin}/oauth2/callback`;
    const scope = 'openid profile';
    const state = generateRandomString(32);
    const verifier = generateRandomString(64);
    const challenge = await pkceS256Challenge(verifier);

    // 暂存 PKCE verifier 和 state，回调时校验
    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('oauth_state', state);
    if (redirect) {
      sessionStorage.setItem('login_redirect', redirect);
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });

    window.location.href = `${idpBaseUrl}/oauth2/authorize?${params}`;
  }

  /** 生成随机字符串（PKCE/state 用） */
  function generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const values = crypto.getRandomValues(new Uint8Array(length));
    for (let i = 0; i < length; i += 1) {
      result += chars[values[i] % chars.length];
    }
    return result;
  }

  /** PKCE S256 code_challenge = base64url(SHA256(code_verifier)) */
  async function pkceS256Challenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64url(hash);
  }

  /** ArrayBuffer → base64url */
  function base64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]+$/, '');
  }

  /**
   * Toggle login module
   *
   * @param module
   */
  async function toggleLoginModule(module: UnionKey.LoginModule) {
    const query = route.value.query as Record<string, string>;

    return routerPushByKey('login', { query, params: { module } });
  }

  /**
   * Redirect from login
   *
   * @param [needRedirect=true] Whether to redirect after login. Default is `true`
   */
  async function redirectFromLogin(needRedirect = true) {
    const redirect = route.value.query?.redirect as string;

    if (needRedirect && redirect) {
      await routerPush(redirect);
    } else {
      await toHome();
    }
  }

  return {
    routerPush,
    routerBack,
    routerPushByKey,
    routerPushByKeyWithMetaQuery,
    toLogin,
    toggleLoginModule,
    redirectFromLogin,
    redirectToIdpAuthorize
  };
}
