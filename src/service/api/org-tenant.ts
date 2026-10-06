import { request } from '../request';

/**
 * get tenant list
 *
 * S2 租户管理：后端 carlos-org /org/tenant/page（网关 /manage-api/org/**）
 */
export function fetchGetTenantList(params?: Api.Organization.TenantSearchParams) {
  return request<Api.Organization.TenantList>({
    url: '/org/tenant/page',
    method: 'get',
    params
  });
}

/** add tenant */
export function fetchAddTenant(data: Partial<Api.Organization.Tenant>) {
  return request({
    url: '/org/tenant/add',
    method: 'post',
    data
  });
}

/** update tenant（tenantCode 创建后不可改，载荷不含它） */
export function fetchUpdateTenant(data: Partial<Api.Organization.Tenant>) {
  return request({
    url: '/org/tenant/update',
    method: 'post',
    data
  });
}

/** delete tenants */
export function fetchDeleteTenant(ids: (string | number)[]) {
  return request({
    url: '/org/tenant/delete',
    method: 'post',
    data: { ids }
  });
}

/** change tenant status（停用/启用） */
export function fetchChangeTenantStatus(data: Api.Organization.TenantChangeStatusParams) {
  return request({
    url: '/org/tenant/change-status',
    method: 'post',
    data
  });
}

/** init tenant admin（为新租户初始化管理员账号） */
export function fetchInitTenantAdmin(data: Api.Organization.TenantInitAdminParams) {
  return request({
    url: '/org/tenant/init-admin',
    method: 'post',
    data
  });
}
