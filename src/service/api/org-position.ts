import { request } from '../request';

/**
 * 岗位管理（carlos-org，/org/position/**）
 *
 * 后端无岗位树端点，`OrgPositionVO.parentId` 只给上级 id；
 * 若需树形展示由前端自行组装。本模块按扁平分页列表实现。
 */

/** 岗位分页列表 */
export function fetchGetPositionList(params?: Api.Organization.PositionSearchParams) {
  return request<Api.Organization.PositionList>({
    url: '/org/position/page',
    method: 'get',
    params
  });
}

/** 岗位详情 */
export function fetchGetPositionDetail(id: string) {
  return request<Api.Organization.Position>({
    url: '/org/position/detail',
    method: 'get',
    params: { id }
  });
}

/** add position */
export function fetchAddPosition(data: Api.Organization.PositionOperateParams) {
  return request({
    url: '/org/position/add',
    method: 'post',
    data
  });
}

/** update position */
export function fetchUpdatePosition(data: Api.Organization.PositionOperateParams & { id: string }) {
  return request({
    url: '/org/position/update',
    method: 'post',
    data
  });
}

/** delete positions */
export function fetchDeletePosition(ids: string[]) {
  return request({
    url: '/org/position/delete',
    method: 'post',
    data: { ids }
  });
}

/** 职系列表（用于表单下拉与筛选） */
export function fetchGetPositionCategoryList(params?: Api.Common.CommonSearchParams) {
  return request<Api.Organization.PositionCategoryList>({
    url: '/org/position/category/page',
    method: 'get',
    params
  });
}

/** 职级列表（用于表单下拉与筛选） */
export function fetchGetPositionLevelList(params?: Api.Common.CommonSearchParams) {
  return request<Api.Organization.PositionLevelList>({
    url: '/org/position/level/page',
    method: 'get',
    params
  });
}

/**
 * 用户任职变更历史（用户详情抽屉用）
 *
 * 后端 `/org/position/history/page` 按 userId 过滤，记录按时间倒序返回。
 * 详情抽屉只做时间线展示，固定拉最近 50 条，不做分页交互。
 */
export function fetchGetUserPositionHistory(userId: string) {
  return request<Api.Organization.PositionHistoryList>({
    url: '/org/position/history/page',
    method: 'get',
    params: { userId, current: 1, size: 50 }
  });
}
