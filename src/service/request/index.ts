import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { BACKEND_ERROR_CODE, createFlatRequest, createRequest } from '@sa/axios';
import { useAuthStore } from '@/store/modules/auth';
import { localStg } from '@/utils/storage';
import { getServiceBaseURL } from '@/utils/service';
import { $t } from '@/locales';
import {
  getAuthorization,
  handleExpiredRequest,
  isAuthSessionEndpoint,
  isRefreshTokenRequest,
  showErrorMsg
} from './shared';
import type { RequestInstanceState } from './type';

const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
const { baseURL, otherBaseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);

/** 后端统一错误响应体 */
interface BackendErrorPayload {
  code?: string | number;
  msg?: string;
}

/**
 * 解析后端错误响应体
 *
 * - 普通接口：body 就是 `{ code, msg }` 对象
 * - `responseType: 'blob'` 的导出接口：同一份 JSON 被包成 Blob，需读回文本再解析
 * - 其它（HTML 错误页、纯字符串等）：返回 null，调用方回退到 axios 自带 message
 *
 * @param data `error.response.data`
 */
async function resolveErrorPayload(data: unknown): Promise<BackendErrorPayload | null> {
  if (!data) {
    return null;
  }

  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()) as BackendErrorPayload;
    } catch {
      return null;
    }
  }

  if (typeof data === 'object') {
    return data as BackendErrorPayload;
  }

  return null;
}

export const request = createFlatRequest<App.Service.Response, RequestInstanceState>(
  {
    baseURL
  },
  {
    async onRequest(config) {
      const Authorization = getAuthorization();
      Object.assign(config.headers, { Authorization });

      return config;
    },
    isBackendSuccess(response) {
      // when the backend response code is "0000"(default), it means the request is success
      // to change this logic by yourself, you can modify the `VITE_SERVICE_SUCCESS_CODE` in `.env` file
      return String(response.data.code) === import.meta.env.VITE_SERVICE_SUCCESS_CODE;
    },
    async onBackendFail(response, instance) {
      const authStore = useAuthStore();
      const responseCode = String(response.data.code);

      function handleLogout() {
        authStore.resetStore();
      }

      function logoutAndCleanup() {
        handleLogout();
        window.removeEventListener('beforeunload', handleLogout);

        request.state.errMsgStack = request.state.errMsgStack.filter(msg => msg !== response.data.msg);
      }

      // when the backend response code is in `logoutCodes`, it means the user will be logged out and redirected to login page
      const logoutCodes = import.meta.env.VITE_SERVICE_LOGOUT_CODES?.split(',') || [];
      if (logoutCodes.includes(responseCode)) {
        handleLogout();
        return null;
      }

      // when the backend response code is in `modalLogoutCodes`, it means the user will be logged out by displaying a modal
      const modalLogoutCodes = import.meta.env.VITE_SERVICE_MODAL_LOGOUT_CODES?.split(',') || [];
      if (modalLogoutCodes.includes(responseCode) && !request.state.errMsgStack?.includes(responseCode)) {
        request.state.errMsgStack = [...(request.state.errMsgStack || []), response.data.msg];

        // prevent the user from refreshing the page
        window.addEventListener('beforeunload', handleLogout);

        window.$modal?.error({
          title: $t('common.error'),
          content: response.data.msg,
          okText: $t('common.confirm'),
          maskClosable: false,
          onOk() {
            logoutAndCleanup();
          },
          onCancel() {
            logoutAndCleanup();
          }
        });

        return null;
      }

      // when the backend response code is in `expiredTokenCodes`, it means the token is expired, and refresh token
      // the api `refreshToken` can not return error code in `expiredTokenCodes`, otherwise it will be a dead loop, should return `logoutCodes` or `modalLogoutCodes`
      // (刷新端点自身的响应也不能进这里，否则共享单 Promise 会等待自己形成死锁；其失败由 handleRefreshToken 走 resetStore)
      const expiredTokenCodes = import.meta.env.VITE_SERVICE_EXPIRED_TOKEN_CODES?.split(',') || [];
      if (expiredTokenCodes.includes(responseCode) && !isRefreshTokenRequest(response.config)) {
        const success = await handleExpiredRequest(request.state);
        if (success) {
          const Authorization = getAuthorization();
          Object.assign(response.config.headers, { Authorization });

          return instance.request(response.config) as Promise<AxiosResponse>;
        }
      }

      return null;
    },
    transformBackendResponse(response) {
      return response.data.data;
    },
    onError: handleRequestError
  }
);

/**
 * 请求错误的统一分派
 *
 * - modalLogoutCodes / expiredTokenCodes：已有专门处理，静默
 * - HTTP 401：会话端点按业务失败处理；其余刷新令牌并重放原请求
 * - 其余：弹出后端错误消息
 *
 * @returns 恢复重放成功的响应；否则返回 null（按场景已提示或静默）
 */
async function handleRequestError(error: AxiosError<App.Service.Response>): Promise<AxiosResponse | null> {
  let message = error.message;
  let backendErrorCode = '';

  // 二进制响应（Excel 导出等）出错时，后端的 { code, msg } 会包在 Blob 里，
  // 直接读 data.code 只能拿到 undefined；这里统一读回文本再解析。
  const backendPayload = await resolveErrorPayload(error.response?.data);

  // get backend error message and code
  if (error.code === BACKEND_ERROR_CODE || backendPayload) {
    message = backendPayload?.msg || message;
    backendErrorCode = String(backendPayload?.code) || '';
  }

  // the error message is displayed in the modal
  const modalLogoutCodes = import.meta.env.VITE_SERVICE_MODAL_LOGOUT_CODES?.split(',') || [];
  if (modalLogoutCodes.includes(backendErrorCode)) {
    return null;
  }

  // HTTP 200 + 过期业务码：onBackendFail 已处理刷新重放，这里静默
  const expiredTokenCodes = import.meta.env.VITE_SERVICE_EXPIRED_TOKEN_CODES?.split(',') || [];
  if (expiredTokenCodes.includes(backendErrorCode)) {
    return null;
  }

  // HTTP 401：网关/后端对缺失/过期/无效凭证返回真实 401（无统一响应包装），axios 走 error 分支，
  // 必须在这里刷新 + 重放，否则普通页面令牌过期后会话静默死亡，用户被迫重新登录
  if (error.response?.status === 401) {
    if (isAuthSessionEndpoint(error.config)) {
      showSessionEndpointError(error, message);
      return null;
    }

    return tryRefreshAndReplay(error);
  }

  showErrorMsg(request.state, message);
  return null;
}

/**
 * 会话业务端点的 401 提示
 *
 * 登录/换票失败要给出业务提示（如「用户名或密码错误」）；刷新端点失败已由 handleRefreshToken 走 resetStore，登出是清理动作，二者静默
 */
function showSessionEndpointError(error: AxiosError<App.Service.Response>, message: string) {
  if (!isRefreshTokenRequest(error.config) && !error.config?.url?.includes('/auth/user/logout')) {
    showErrorMsg(request.state, message);
  }
}

/** 重放标记：打在本次请求的 config 上，保证 401 只刷新重放一次，防止异常情况下循环 */
const REPLAY_ONCE_KEY = '__carlosReplayOnce';

type ReplayableConfig = InternalAxiosRequestConfig & { [REPLAY_ONCE_KEY]?: boolean };

/**
 * 401 后的刷新 + 单次重放
 *
 * - 并发 401 的刷新去重由 handleExpiredRequest 的单 Promise 保证
 * - 无刷新令牌时会话已终结，直接 resetStore 跳登录（此前是静默卡住无任何反馈）
 * - 刷新失败时 handleRefreshToken 内部已 resetStore
 *
 * @returns 重放成功的响应；未重放返回 null（调用方应静默，不再弹错）
 */
async function tryRefreshAndReplay(error: AxiosError<App.Service.Response>): Promise<AxiosResponse | null> {
  const config = error.config as ReplayableConfig | undefined;

  if (!config || config[REPLAY_ONCE_KEY]) {
    return null;
  }

  if (!localStg.get('refreshToken')) {
    await useAuthStore().resetStore();
    return null;
  }

  config[REPLAY_ONCE_KEY] = true;

  const success = await handleExpiredRequest(request.state);
  if (!success) {
    return null;
  }

  const Authorization = getAuthorization();
  Object.assign(config.headers, { Authorization });

  return request.instance.request(config) as Promise<AxiosResponse>;
}

export const demoRequest = createRequest<App.Service.DemoResponse>(
  {
    baseURL: otherBaseURL.demo
  },
  {
    async onRequest(config) {
      const { headers } = config;

      // set token
      const token = localStg.get('token');
      const Authorization = token ? `Bearer ${token}` : null;
      Object.assign(headers, { Authorization });

      return config;
    },
    isBackendSuccess(response) {
      // when the backend response code is "200", it means the request is success
      // you can change this logic by yourself
      return response.data.status === '200';
    },
    async onBackendFail(_response) {
      // when the backend response code is not "200", it means the request is fail
      // for example: the token is expired, refresh token and retry request
    },
    transformBackendResponse(response) {
      return response.data.result;
    },
    onError(error) {
      // when the request is fail, you can show error message

      let message = error.message;

      // show backend error message
      if (error.code === BACKEND_ERROR_CODE) {
        message = error.response?.data?.message || message;
      }

      window.$message?.error(message);
    }
  }
);
