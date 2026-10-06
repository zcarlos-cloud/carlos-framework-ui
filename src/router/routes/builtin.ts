import type { CustomRoute, ElegantConstRoute } from '@elegant-router/types';
import { layouts, views } from '../elegant/imports';
import { getRoutePath, transformElegantRoutesToVueRoutes } from '../elegant/transform';

export const ROOT_ROUTE: CustomRoute = {
  name: 'root',
  path: '/',
  redirect: getRoutePath(import.meta.env.VITE_ROUTE_HOME) || '/home',
  meta: {
    title: 'root',
    constant: true
  }
};

const NOT_FOUND_ROUTE: CustomRoute = {
  name: 'not-found',
  path: '/:pathMatch(.*)*',
  component: 'layout.blank$view.404',
  meta: {
    title: 'not-found',
    constant: true
  }
};

/**
 * OAuth2 回调路由（SSO 模式）
 *
 * IdP 登录后携带 code 重定向到此页面，由该页面用 code 换 Token。
 * 必须是 constant 路由，无需登录态即可访问。
 *
 * 类型用 ElegantConstRoute 而非 CustomRoute：elegant-router 的 CustomRouteKey 由
 * src/router/routes/index.ts 的 customRoutes 推导，不含本文件里的 oauth2-callback
 * （它由生成器按 src/views/_builtin/oauth2-callback/ 目录推导为 GeneratedRouteKey）。
 */
const OAUTH2_CALLBACK_ROUTE: ElegantConstRoute = {
  name: 'oauth2-callback',
  path: '/oauth2/callback',
  component: 'layout.blank$view.oauth2-callback',
  meta: {
    title: 'oauth2-callback',
    i18nKey: 'route.oauth2-callback',
    constant: true,
    single: true
  }
};

/** builtin routes, it must be constant and setup in vue-router */
const builtinRoutes: ElegantConstRoute[] = [ROOT_ROUTE, NOT_FOUND_ROUTE, OAUTH2_CALLBACK_ROUTE];

/** create builtin vue routes */
export function createBuiltinVueRoutes() {
  return transformElegantRoutesToVueRoutes(builtinRoutes, layouts, views);
}
