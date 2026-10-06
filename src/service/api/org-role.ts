import { request } from '../request';

/** get role list */
export function fetchGetRoleList(params?: Api.Organization.RoleSearchParams) {
  return request<Api.Organization.RoleList>({
    url: '/org/role/page',
    method: 'get',
    params
  });
}

/**
 * get all roles
 *
 * 后端没有「全部角色」专用端点，只能复用分页端点并取 records。
 * 这里显式带上分页参数（避免后端返回默认首页且无界），调用方读 `data.records`。
 */
export function fetchGetAllRoles() {
  return request<Api.Organization.RoleList>({
    url: '/org/role/page',
    method: 'get',
    params: { current: 1, size: 200 }
  });
}

/** add role */
export function fetchAddRole(data: Partial<Api.Organization.Role>) {
  return request({
    url: '/org/role/add',
    method: 'post',
    data
  });
}

/** update role */
export function fetchUpdateRole(data: Partial<Api.Organization.Role>) {
  return request({
    url: '/org/role/update',
    method: 'post',
    data
  });
}

/** delete roles */
export function fetchDeleteRole(ids: (string | number)[]) {
  return request({
    url: '/org/role/delete',
    method: 'post',
    data: { ids }
  });
}

/**
 * 启用 / 禁用角色
 *
 * 后端 changeState 入参 OrgRoleChangeStateParam.roleStatus 是 Integer，只接受 0（禁用）/ 1（启用）
 */
export function fetchChangeRoleState(id: string, roleStatus: 0 | 1) {
  return request({
    url: '/org/role/changeState',
    method: 'post',
    data: { id, roleStatus }
  });
}

/** get role operation ids */
export function fetchGetRoleOperationIds(roleId: number | string) {
  return request<number[]>({
    url: `/org/role/${roleId}/operation-ids`,
    method: 'get'
  });
}

/** save role operations (full override) */
export function fetchSaveRoleOperations(roleId: number | string, operationIds: (string | number)[]) {
  return request({
    url: `/org/role/${roleId}/operations`,
    method: 'put',
    data: { operationIds }
  });
}

/** get enabled role options（下拉选项，非分页避免截断；S3 公告发布范围等场景使用） */
export function fetchGetRoleOptions() {
  return request<Api.Organization.Role[]>({
    url: '/org/role/options',
    method: 'get'
  });
}
