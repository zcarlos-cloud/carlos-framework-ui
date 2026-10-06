import { type PasswordPublicKey, encryptPassword } from '@/utils/crypto';
import { request } from '../request';

/** 从环境变量读取 OAuth2 客户端 ID */
const CLIENT_ID = import.meta.env.VITE_AUTH_CLIENT_ID || 'carlos-client';

/**
 * 将后端 LoginResponse 转换为前端 LoginToken
 *
 * 后端返回 { accessToken, refreshToken, ... }
 * 前端 Soybean Admin 期望 { token, refreshToken, ... }
 *
 * 三处调用点均已用 `if (res.data)` 守卫，故入参声明为不可空。
 */
function transformLoginToken(data: Api.Auth.LoginToken): Api.Auth.LoginToken {
  // 后端字段 accessToken → 前端 token（兼容后端已用 token 字段的情况）
  const token = (data as Api.Auth.LoginToken & { accessToken?: string }).accessToken || data.token;
  return {
    ...data,
    token,
    refreshToken: data.refreshToken
  };
}

/**
 * 获取密码加密公钥（SM2 动态密钥）
 *
 * 前端在提交登录前调用，用返回的公钥加密密码。
 */
export function fetchPublicKey() {
  return request<PasswordPublicKey>({
    url: '/auth/public-key',
    method: 'get'
  });
}

/**
 * 登录预校验（风控决策）
 *
 * 前端在提交登录前调用，决定是否需要验证码、MFA 等。
 */
export function fetchPreCheck(username: string, deviceFingerprint: string, loginType = 'password') {
  return request<Api.Auth.PreCheckResponse>({
    url: '/auth/user/pre-check',
    method: 'post',
    data: {
      username,
      deviceFingerprint,
      loginType
    }
  });
}

/**
 * SSO 授权码换 Token
 *
 * OIDC 回调页用 code + PKCE verifier 换取 Token。
 * 走标准 /oauth2/token 端点，grant_type=authorization_code。
 */
export function fetchExchangeToken(params: { code: string; verifier: string; redirectUri: string }) {
  return request<Api.Auth.LoginToken>({
    url: '/oauth2/token',
    method: 'post',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: `grant_type=authorization_code&code=${encodeURIComponent(params.code)}&redirect_uri=${encodeURIComponent(params.redirectUri)}&client_id=${CLIENT_ID}&code_verifier=${encodeURIComponent(params.verifier)}`
  }).then(res => {
    if (res.data) {
      // OAuth2 token 端点返回 { access_token, refresh_token, expires_in, token_type }
      const d = res.data as any;
      res.data = {
        token: d.access_token || d.token,
        refreshToken: d.refresh_token || d.refreshToken,
        expiresIn: d.expires_in,
        tokenType: d.token_type,
        mfaRequired: false
      };
    }
    return res;
  });
}

/**
 * 账号密码登录
 *
 * 响应可能是 Token（直接成功）或 mfaToken（需要 MFA step-up）。
 * 登录前会自动获取 SM2 公钥并加密密码。
 */
export async function fetchLogin(username: string, password: string, tenantCode?: string) {
  const { data: keyData, error: keyError } = await fetchPublicKey();
  if (keyError || !keyData) {
    throw new Error('获取加密公钥失败，请检查网络后重试');
  }

  const encryptedPassword = encryptPassword(password, keyData.publicKey);
  return request<Api.Auth.LoginToken>({
    url: '/auth/user/login',
    method: 'post',
    data: {
      username,
      password: encryptedPassword,
      keyId: keyData.keyId,
      clientId: CLIENT_ID,
      encrypted: true,
      // S2 租户管理：仅登录页开启租户输入时携带；后端未开启租户校验时忽略该字段
      tenantCode: tenantCode || undefined
    }
  }).then(res => {
    if (res.data) {
      res.data = transformLoginToken(res.data);
    }
    return res;
  });
}

/**
 * MFA Step-Up 验证
 *
 * 密码验证通过后，携带 mfaToken + TOTP code 完成二次验证。
 */
export function fetchMfaStepUpVerify(params: {
  mfaToken: string;
  code: string;
  trustDevice?: boolean;
  deviceFingerprint?: string;
  deviceName?: string;
}) {
  return request<Api.Auth.LoginToken>({
    url: '/auth/mfa/step-up-verify',
    method: 'post',
    data: params
  }).then(res => {
    if (res.data) {
      res.data = transformLoginToken(res.data);
    }
    return res;
  });
}

/**
 * 发送短信验证码
 */
export function fetchSendSmsCode(phone: string) {
  return request<string>({
    url: '/auth/captcha/sms/send',
    method: 'post',
    data: { phone }
  });
}

/**
 * 短信验证码登录（走标准 OAuth2 token 端点）
 *
 * 注意：client_secret 在前端硬编码仅适用于内部系统，
 * 生产环境应通过 BFF 后端代理避免暴露 secret。
 */
export function fetchSmsLogin(phone: string, code: string) {
  return request<Api.Auth.LoginToken>({
    url: '/oauth2/token',
    method: 'post',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: `grant_type=sms_code&phone=${encodeURIComponent(phone)}&sms_code=${encodeURIComponent(code)}&client_id=${CLIENT_ID}&client_secret=carlos-secret`
  }).then(res => {
    if (res.data) {
      // OAuth2 token 端点返回 { access_token, refresh_token, expires_in, token_type }
      const d = res.data as any;
      res.data = {
        token: d.access_token || d.token,
        refreshToken: d.refresh_token || d.refreshToken,
        expiresIn: d.expires_in,
        tokenType: d.token_type,
        mfaRequired: false
      };
    }
    return res;
  });
}

/**
 * 获取扫码登录二维码
 */
export function fetchQrCodeGenerate() {
  return request<Api.Auth.QrCodeInfo>({
    url: '/auth/qrcode/generate',
    method: 'post',
    params: { clientId: CLIENT_ID }
  });
}

/** 获取用户信息 */
export function fetchGetUserInfo() {
  return request<Api.Auth.UserInfo>({ url: '/auth/user/me' });
}

/**
 * 刷新 Token
 *
 * 公共客户端（无密钥、强制 PKCE）无法走标准 /oauth2/token 刷新，
 * 使用后端提供的 /auth/user/refreshToken 端点（refreshToken 即凭证）。
 * 每次刷新会签发新的 refreshToken，必须用新的替换旧的。
 */
export function fetchRefreshToken(refreshToken: string) {
  return request<Api.Auth.LoginToken>({
    url: '/auth/user/refreshToken',
    method: 'post',
    data: { refreshToken }
  }).then(res => {
    if (res.data) {
      res.data = transformLoginToken(res.data);
    }
    return res;
  });
}

/** 登出 */
export function fetchLogout() {
  return request({ url: '/auth/user/logout', method: 'post' });
}

/**
 * 返回自定义后端错误
 *
 * @param code error code
 * @param msg error message
 */
export function fetchCustomBackendError(code: string, msg: string) {
  return request({ url: '/auth/error', params: { code, msg } });
}
