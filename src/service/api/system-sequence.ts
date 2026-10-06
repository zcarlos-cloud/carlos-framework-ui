import { request } from '../request';

/** get sequence rule page list */
export function fetchGetSequenceRuleList(params?: Api.SystemManage.SequenceRuleSearchParams) {
  return request<Api.SystemManage.SequenceRuleList>({
    url: '/sys/sequence/page',
    method: 'get',
    params
  });
}

/** add sequence rule */
export function fetchAddSequenceRule(data: Api.SystemManage.SequenceRuleOperateParams) {
  return request({ url: '/sys/sequence', method: 'post', data });
}

/** update sequence rule（ruleCode 不可改，后端忽略该字段） */
export function fetchUpdateSequenceRule(data: Api.SystemManage.SequenceRuleOperateParams) {
  return request({ url: '/sys/sequence/update', method: 'post', data });
}

/** delete sequence rule（同时清理 Redis 计数键，编号从 1 重新开始） */
export function fetchDeleteSequenceRule(ids: string[]) {
  return request({ url: '/sys/sequence/delete', method: 'post', data: { ids } });
}

/**
 * 申请一个新的业务编码（表单「生成」按钮用）
 *
 * 刻意是 POST 而非 GET：调用一次就消耗一个号段、不满足幂等语义，
 * 用 GET 会被浏览器/代理缓存或预取，号段被无声烧掉。
 */
export function fetchNextSequenceCode(ruleCode: string) {
  return request<string>({ url: '/sys/sequence/next', method: 'post', params: { ruleCode } });
}
