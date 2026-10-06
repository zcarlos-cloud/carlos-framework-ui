import { request } from '../request';

/**
 * 分页查询登录日志
 *
 * 后端 `GET /auth/login-log/page`（carlos-auth），数据来自 carlos-audit（ClickHouse，
 * logType 固定 USER_LOGIN）。本机无 ClickHouse 时恒为空页（与审计日志页同）。
 * 分页字段沿用框架 `ParamPage` 约定（`current` / `size`）。
 */
export function fetchGetLoginLogList(params?: Api.Auth.LoginLogSearchParams) {
  return request<Api.Auth.LoginLogList>({
    url: '/auth/login-log/page',
    method: 'get',
    params
  });
}

/**
 * 查询登录日志详情
 *
 * 后端 `GET /auth/login-log/{id}`（carlos-auth），透传 carlos-audit 审计详情。
 */
export function fetchGetLoginLogDetail(id: string) {
  return request<Api.Auth.LoginLogDetail>({
    url: `/auth/login-log/${id}`,
    method: 'get'
  });
}
