import { request } from '../request';

/** 分页查询审计配置 */
export function fetchGetAuditConfigList(params?: Api.Audit.ConfigSearchParams) {
  return request<Api.Audit.ConfigList>({
    url: '/audit/log/config/page',
    method: 'get',
    params
  });
}

/** 查询审计配置详情 */
export function fetchGetAuditConfigDetail(id: string) {
  return request<Api.Audit.Config>({
    url: '/audit/log/config/detail',
    method: 'get',
    params: { id }
  });
}

/** 新增审计配置 */
export function fetchAddAuditConfig(data: Api.Audit.ConfigOperateParams) {
  return request({ url: '/audit/log/config/add', method: 'post', data });
}

/** 更新审计配置 */
export function fetchUpdateAuditConfig(data: Api.Audit.ConfigOperateParams & { id: string }) {
  return request({ url: '/audit/log/config/update', method: 'post', data });
}

/**
 * 删除审计配置
 *
 * 后端入参为 `ParamIdSet<Long>`，即 `{ ids: [...] }`
 */
export function fetchDeleteAuditConfig(ids: string[]) {
  return request({ url: '/audit/log/config/delete', method: 'post', data: { ids } });
}
