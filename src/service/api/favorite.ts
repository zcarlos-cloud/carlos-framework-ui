import { request } from '../request';

/**
 * 通用用户收藏（后端 /sys/favorite，按登录用户隔离）
 *
 * targetType 为业务类型（小写字母/数字/中划线，如 quick-nav、sys-news），
 * targetId 为业务侧不透明字符串（路由 key、公告 id 等）。
 */

/** 我的收藏列表（按 sort_no 排序，对应后端 SysFavoriteVO） */
export function fetchGetFavorites(targetType: string) {
  return request<Api.SystemManage.Favorite[]>({
    url: '/sys/favorite/list',
    method: 'get',
    params: { targetType }
  });
}

/** 我的全部收藏（跨类型，按类型+排序，收藏管理页用） */
export function fetchGetAllFavorites() {
  return request<Api.SystemManage.Favorite[]>({
    url: '/sys/favorite/all',
    method: 'get'
  });
}

/** 批量校验收藏状态，返回已收藏的 targetId 数组 */
export function fetchCheckFavorites(targetType: string, targetIds: string[]) {
  return request<string[]>({
    url: '/sys/favorite/check',
    method: 'get',
    params: { targetType, targetIds: targetIds.join(',') }
  });
}

/** 覆盖保存某类型的全部收藏（整体排序，幂等，replace 语义） */
export function fetchReplaceFavorites(targetType: string, targetIds: string[]) {
  return request<boolean>({
    url: '/sys/favorite/replace',
    method: 'post',
    data: { targetType, targetIds }
  });
}

/** 添加收藏（幂等，重复添加静默成功） */
export function fetchAddFavorite(targetType: string, targetId: string) {
  return request<boolean>({
    url: '/sys/favorite/add',
    method: 'post',
    data: { targetType, targetId }
  });
}

/** 取消收藏（不存在时静默成功） */
export function fetchRemoveFavorite(targetType: string, targetId: string) {
  return request<boolean>({
    url: '/sys/favorite/remove',
    method: 'post',
    data: { targetType, targetId }
  });
}
