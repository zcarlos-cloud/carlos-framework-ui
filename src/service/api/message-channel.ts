import { request } from '../request';

/**
 * MessageChannel*Param 里的 channelType / enabled 是 Integer 数字码，
 * 而前端按本仓库惯例把码值建模为字符串字面量，故提交前需转回数字。
 */
function toChannelPayload(data: Api.Message.ChannelOperateParams) {
  return {
    ...data,
    channelType: data.channelType === undefined ? undefined : Number(data.channelType),
    enabled: data.enabled === undefined ? undefined : Number(data.enabled)
  };
}

/**
 * 消息渠道列表
 *
 * 该接口的过滤条件是本模块唯一在修复前就生效的一组（manager 层有完整实现），
 * 其余列表接口的过滤条件属于 2026-09-18 补齐。
 */
export function fetchGetMessageChannelList(params?: Api.Message.ChannelSearchParams) {
  return request<Api.Message.ChannelList>({
    url: '/message/channel/page',
    method: 'get',
    params
  });
}

/** 新增消息渠道 */
export function fetchAddMessageChannel(data: Api.Message.ChannelOperateParams) {
  return request({
    url: '/message/channel/add',
    method: 'post',
    data: toChannelPayload(data)
  });
}

/** 修改消息渠道 */
export function fetchUpdateMessageChannel(data: Api.Message.ChannelOperateParams & { id: string }) {
  return request({
    url: '/message/channel/update',
    method: 'post',
    data: toChannelPayload(data)
  });
}

/** 删除消息渠道（后端为按 id 集合批量删除） */
export function fetchDeleteMessageChannel(ids: string[]) {
  return request({
    url: '/message/channel/delete',
    method: 'post',
    data: { ids }
  });
}

/** 消息渠道详情 */
export function fetchGetMessageChannelDetail(id: string) {
  return request<Api.Message.MessageChannel>({
    url: '/message/channel/detail',
    method: 'get',
    params: { id }
  });
}

/**
 * 启用 / 禁用消息渠道
 *
 * ⚠️ 只能设置 0（禁用）与 1（启用）。后端把渠道置为 2（故障）的
 * `ChannelService.markFaulted` 没有任何 HTTP 端点，故障态由发送失败自动进入。
 */
export function fetchChangeMessageChannelEnabled(id: string, enabled: boolean) {
  return request({
    url: enabled ? '/message/channel/enable' : '/message/channel/disable',
    method: 'post',
    params: { id }
  });
}
