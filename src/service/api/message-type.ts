import { request } from '../request';

/**
 * 消息类型列表
 *
 * 后端 MessageTypePageParam：typeCode / typeName 为 like，enabled 为 eq，
 * start / end 作用于 create_time。
 */
export function fetchGetMessageTypeList(params?: Api.Message.TypeSearchParams) {
  return request<Api.Message.TypeList>({
    url: '/message/type/page',
    method: 'get',
    params
  });
}

/** 新增消息类型 */
export function fetchAddMessageType(data: Api.Message.TypeOperateParams) {
  return request({
    url: '/message/type/add',
    method: 'post',
    data
  });
}

/** 修改消息类型 */
export function fetchUpdateMessageType(data: Api.Message.TypeOperateParams & { id: string }) {
  return request({
    url: '/message/type/update',
    method: 'post',
    data
  });
}

/** 删除消息类型（后端为按 id 集合批量删除） */
export function fetchDeleteMessageType(ids: string[]) {
  return request({
    url: '/message/type/delete',
    method: 'post',
    data: { ids }
  });
}

/** 消息类型详情 */
export function fetchGetMessageTypeDetail(id: string) {
  return request<Api.Message.MessageType>({
    url: '/message/type/detail',
    method: 'get',
    params: { id }
  });
}

/**
 * 启用 / 禁用消息类型
 *
 * 后端 enable / disable 只接收 `@RequestParam Long id`，没有请求体。
 */
export function fetchChangeMessageTypeEnabled(id: string, enabled: boolean) {
  return request({
    url: enabled ? '/message/type/enable' : '/message/type/disable',
    method: 'post',
    params: { id }
  });
}
