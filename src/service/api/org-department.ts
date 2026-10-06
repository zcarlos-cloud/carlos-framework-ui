import { request } from '../request';

/**
 * 部门管理（carlos-org，/org/department/**）
 *
 * 注意：后端 `tree` 端点返回全量部门树、不分页；`page` 端点返回扁平分页列表。
 * 树形页面用前者，需要分页筛选时用后者。
 */

/** 部门树（全量，后端不分页） */
export function fetchGetDepartmentTree() {
  return request<Api.Organization.DepartmentTree[]>({
    url: '/org/department/tree',
    method: 'get'
  });
}

/** 部门分页列表（扁平结构） */
export function fetchGetDepartmentList(params?: Api.Organization.DepartmentSearchParams) {
  return request<Api.Organization.DepartmentList>({
    url: '/org/department/page',
    method: 'get',
    params
  });
}

/** add department */
export function fetchAddDepartment(data: Api.Organization.DepartmentOperateParams) {
  return request({
    url: '/org/department/add',
    method: 'post',
    data
  });
}

/** update department */
export function fetchUpdateDepartment(data: Api.Organization.DepartmentOperateParams & { id: string }) {
  return request({
    url: '/org/department/update',
    method: 'post',
    data
  });
}

/** delete departments */
export function fetchDeleteDepartment(ids: string[]) {
  return request({
    url: '/org/department/delete',
    method: 'post',
    data: { ids }
  });
}

/** 移动部门到新的上级 */
export function fetchMoveDepartment(id: string, parentId: string) {
  return request({
    url: '/org/department/move',
    method: 'post',
    data: { id, parentId }
  });
}

/** 调整同级排序 */
export function fetchSortDepartment(id: string, orderNum: number) {
  return request({
    url: '/org/department/sort',
    method: 'post',
    data: { id, orderNum }
  });
}

/** 设置部门负责人 */
export function fetchSetDepartmentLeader(deptId: string, leaderId: string) {
  return request({
    url: '/org/department/setLeader',
    method: 'post',
    data: { deptId, leaderId }
  });
}

/**
 * 启用 / 禁用部门
 *
 * 对应后端 OrgDepartmentChangeStateParam（deptStatus 为 Integer 数字码）
 */
export function fetchChangeDepartmentState(id: string, deptStatus: Extract<Api.Organization.DeptStatus, '0' | '1'>) {
  return request({
    url: '/org/department/changeState',
    method: 'post',
    data: { id, deptStatus: Number(deptStatus) }
  });
}

/** 部门下的用户分页列表 */
export function fetchGetDepartmentUsers(deptId: string, params?: Api.Common.PaginatingCommonParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.Organization.DepartmentUser>>({
    url: '/org/department/users',
    method: 'get',
    params: { deptId, ...params }
  });
}
