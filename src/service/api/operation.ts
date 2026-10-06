import { request } from '../request';

/** get operation page list */
export function fetchGetOperationList(params?: Api.SystemManage.OperationSearchParams) {
  return request<Api.SystemManage.OperationList>({
    url: '/sys/operation/page',
    method: 'get',
    params
  });
}

/** get operation detail */
export function fetchGetOperationDetail(id: string) {
  return request<Api.SystemManage.Operation>({
    url: `/sys/operation/${id}`,
    method: 'get'
  });
}

/** add operation */
export function fetchAddOperation(data: Api.SystemManage.OperationOperateParams) {
  return request({
    url: '/sys/operation/add',
    method: 'post',
    data
  });
}

/** update operation */
export function fetchUpdateOperation(data: Api.SystemManage.OperationOperateParams & { id: string }) {
  return request({
    url: '/sys/operation/update',
    method: 'post',
    data
  });
}

/** move operation to another menu (menuId omitted or null = independent api) */
export function fetchMoveOperation(data: Api.SystemManage.OperationMoveParams) {
  return request<boolean>({
    url: '/sys/operation/move',
    method: 'post',
    data
  });
}

/** delete operation */
export function fetchDeleteOperation(ids: string[]) {
  return request({
    url: '/sys/operation/delete',
    method: 'post',
    data: { ids }
  });
}

/** get operation tree grouped by menu id (flat, unpaginated) */
export function fetchGetOperationTree() {
  return request<Api.SystemManage.OperationTree[]>({
    url: '/sys/operation/tree',
    method: 'get'
  });
}

/** get operations by menu id */
export function fetchGetOperationsByMenuId(menuId: string) {
  return request<Api.SystemManage.Operation[]>({
    url: '/sys/operation/listByMenuId',
    method: 'get',
    params: { menuId }
  });
}
