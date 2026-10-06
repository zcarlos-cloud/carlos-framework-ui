import { localStg } from '@/utils/storage';
import { clearWarmFlowToken, syncWarmFlowToken } from '@/utils/warm-flow';

/** Get token */
export function getToken() {
  return localStg.get('token') || '';
}

/**
 * 访问令牌的到期时间戳（毫秒）
 *
 * 缺失表示**未知**（老会话，或后端没返回 `expiresIn`）—— 调用方必须把「未知」当成
 * 「不确定还有效」，不能当成「还有很久」。见 `@/hooks/business/warm-flow-token`。
 *
 * @returns 到期时间戳；未知时为 0
 */
export function getTokenExpiresAt() {
  return localStg.get('tokenExpiresAt') || 0;
}

/**
 * Save token
 *
 * 访问令牌的唯一写入口：登录、刷新都必须走这里，
 * 这样「Warm-Flow 设计器的 token 副本」才不会漏同步。
 */
export function saveAuthStorage(loginToken: Api.Auth.LoginToken) {
  localStg.set('token', loginToken.token);
  localStg.set('refreshToken', loginToken.refreshToken);

  // 记下到期时间：设计器宿主页靠它决定「现在要不要提前续期」。
  //
  // ⚠️ 必须用 `Number()` 归一化，不能写 `typeof expiresIn === 'number'`：
  // 后端 `LoginResponse.expiresIn` 是 `Long`，而框架给 `Long` 注册了 `ToStringSerializer`
  // （`JacksonJsonService:100-102`），**实际到达前端的是字符串 `"900"`**。
  // 按 `typeof` 判断会永远落进 else 分支 → 到期时间永远未知 → 心跳退化成每 30 秒刷一次令牌
  // （已在网关 access.log 上实测到这个现象）。
  const expiresInSeconds = Number(loginToken.expiresIn);

  if (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
    localStg.set('tokenExpiresAt', Date.now() + expiresInSeconds * 1000);
  } else {
    localStg.remove('tokenExpiresAt');
  }

  syncWarmFlowToken(loginToken.token);
}

/** Clear auth storage */
export function clearAuthStorage() {
  localStg.remove('token');
  localStg.remove('refreshToken');
  localStg.remove('tokenExpiresAt');

  clearWarmFlowToken();
}
