import { request } from '../request';

/**
 * 分页查询在线用户
 *
 * 后端 `GET /auth/online-user/page`（carlos-auth），数据源为 Redis 授权存储
 * （`oauth2:user_sessions:*` 索引聚合），用户名模糊过滤 + 登录时间倒序，内存分页。
 */
export function fetchGetOnlineUserList(params?: Api.Auth.OnlineUserSearchParams) {
  return request<Api.Auth.OnlineUserList>({
    url: '/auth/online-user/page',
    method: 'get',
    params
  });
}

/**
 * 踢下线（返回实际踢掉的会话数）
 *
 * 后端删除授权记录并同步清网关内省缓存（否则最长延迟一个内省缓存周期才生效）。
 */
export function fetchKickOnlineUser(data: Api.Auth.OnlineUserKickParams) {
  return request<number>({ url: '/auth/online-user/kick', method: 'post', data });
}
