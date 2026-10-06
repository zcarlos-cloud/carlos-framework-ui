import { request } from '../request';

/**
 * 消息模板列表
 *
 * 后端 MessageTemplatePageParam：typeId 为 eq，templateCode / templateName / titleTemplate
 * 为 like，enabled 为 eq，start / end 作用于 create_time。
 */
export function fetchGetMessageTemplateList(params?: Api.Message.TemplateSearchParams) {
  return request<Api.Message.TemplateList>({
    url: '/message/template/page',
    method: 'get',
    params
  });
}

/** 新增消息模板 */
export function fetchAddMessageTemplate(data: Api.Message.TemplateOperateParams) {
  return request({
    url: '/message/template/add',
    method: 'post',
    data
  });
}

/** 修改消息模板 */
export function fetchUpdateMessageTemplate(data: Api.Message.TemplateOperateParams & { id: string }) {
  return request({
    url: '/message/template/update',
    method: 'post',
    data
  });
}

/** 删除消息模板（后端为按 id 集合批量删除） */
export function fetchDeleteMessageTemplate(ids: string[]) {
  return request({
    url: '/message/template/delete',
    method: 'post',
    data: { ids }
  });
}

/** 消息模板详情 */
export function fetchGetMessageTemplateDetail(id: string) {
  return request<Api.Message.MessageTemplate>({
    url: '/message/template/detail',
    method: 'get',
    params: { id }
  });
}

/** 按模板编码查询（唯一编码，用于业务侧核对） */
export function fetchGetMessageTemplateByCode(templateCode: string) {
  return request<Api.Message.MessageTemplate>({
    url: '/message/template/getByCode',
    method: 'get',
    params: { templateCode }
  });
}

/**
 * 发布模板（草稿 → 启用）
 *
 * ⚠️ 后端 `MessageTemplate.enabled` 实际是 Boolean，Swagger 注释里的「2-草稿」无法表达，
 * publish 的语义等同于置 enabled = true；对已启用的模板调用会被后端拒绝（返回 false）。
 */
export function fetchPublishMessageTemplate(id: string) {
  return request({
    url: '/message/template/publish',
    method: 'post',
    params: { id }
  });
}

/** 启用 / 禁用模板 */
export function fetchChangeMessageTemplateEnabled(id: string, enabled: boolean) {
  return request({
    url: enabled ? '/message/template/enable' : '/message/template/disable',
    method: 'post',
    params: { id }
  });
}
