import { useAuthStore } from '@/store/modules/auth';
import { saveAuthStorage } from '@/store/modules/auth/shared';
import { localStg } from '@/utils/storage';
import { fetchRefreshToken } from '../api';
import type { RequestInstanceState } from './type';

export function getAuthorization() {
  const token = localStg.get('token');
  const Authorization = token ? `Bearer ${token}` : null;

  return Authorization;
}

/**
 * 是否为刷新令牌端点本身
 *
 * 刷新端点自身的失败绝不能再触发刷新逻辑，否则共享单 Promise 会等待自己，形成死锁
 */
export function isRefreshTokenRequest(config?: { url?: string } | null): boolean {
  return Boolean(config?.url?.includes('/auth/user/refreshToken'));
}

/**
 * 是否为会话业务端点（登录 / 换票 / 刷新 / 登出）
 *
 * 这些端点的 401 是业务结果（如密码错误）或清理动作，而非会话过期，不得触发刷新重放
 */
export function isAuthSessionEndpoint(config?: { url?: string } | null): boolean {
  const url = config?.url || '';
  return ['/auth/user/login', '/oauth2/token', '/auth/user/refreshToken', '/auth/user/logout'].some(endpoint =>
    url.includes(endpoint)
  );
}

/** refresh token */
async function handleRefreshToken() {
  const { resetStore } = useAuthStore();

  const rToken = localStg.get('refreshToken') || '';
  const { error, data } = await fetchRefreshToken(rToken);
  if (!error) {
    // 走统一写入口：刷新同样要把新 token 同步给 Warm-Flow 设计器
    saveAuthStorage(data);
    return true;
  }

  resetStore();

  return false;
}

export async function handleExpiredRequest(state: RequestInstanceState) {
  if (!state.refreshTokenFn) {
    state.refreshTokenFn = handleRefreshToken();
  }

  const success = await state.refreshTokenFn;

  setTimeout(() => {
    state.refreshTokenFn = null;
  }, 1000);

  return success;
}

export function showErrorMsg(state: RequestInstanceState, message: string) {
  if (!state.errMsgStack?.length) {
    state.errMsgStack = [];
  }

  const isExist = state.errMsgStack.includes(message);

  if (!isExist) {
    state.errMsgStack.push(message);

    window.$message?.error(message, 1.5, () => {
      state.errMsgStack = state.errMsgStack.filter(msg => msg !== message);

      setTimeout(() => {
        state.errMsgStack = [];
      }, 5000);
    });
  }
}
