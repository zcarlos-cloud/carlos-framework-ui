import { request } from '../request';

/**
 * 消息记录列表
 *
 * 记录由发送链路产生，管理端只读：后端虽然生成了 add / update / delete 三个端点，
 * 但它们是 append-only 语义的数据，页面一律不暴露（见 Api.Message.MessageRecord 的说明）。
 *
 * 时间区间字段是 `start` / `end`（后端 MessageRecordPageParam），
 * 注意与 Feign 侧的 `MessagePageParam` 用 `startTime` / `endTime` 不同。
 */
export function fetchGetMessageRecordList(params?: Api.Message.RecordSearchParams) {
  return request<Api.Message.RecordList>({
    url: '/message/record/page',
    method: 'get',
    params
  });
}

/** 消息记录详情（按主键 id） */
export function fetchGetMessageRecordDetail(id: string) {
  return request<Api.Message.MessageRecord>({
    url: '/message/record/detail',
    method: 'get',
    params: { id }
  });
}

/**
 * 撤回消息
 *
 * 后端入参是**业务 messageId**（`@RequestParam("messageId") String`），不是主键 id。
 * 返回值是布尔：已发送/已送达的消息才可能撤回成功，失败时仍返回 200 + data=false。
 */
export function fetchRevokeMessage(messageId: string) {
  return request<boolean>({
    url: '/message/revoke',
    method: 'post',
    params: { messageId }
  });
}

/** 某条消息的接收人投递明细（详情抽屉用） */
export function fetchGetMessageReceiverList(params: Api.Message.ReceiverSearchParams) {
  return request<Api.Message.ReceiverList>({
    url: '/message/receiver/page',
    method: 'get',
    params
  });
}

/** 某条消息的发送日志（详情抽屉用，含请求/响应原文） */
export function fetchGetMessageSendLogList(params: Api.Message.SendLogSearchParams) {
  return request<Api.Message.SendLogList>({
    url: '/message/send/log/page',
    method: 'get',
    params
  });
}
