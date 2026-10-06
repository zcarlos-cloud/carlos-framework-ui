import { request } from '../request';

/**
 * 分页查询审计日志
 *
 * 后端 `/audit/log/query/logs/page` 为 **POST + JSON body**，
 * 分页字段沿用框架 `ParamPage` 约定（`current` / `size`），不是 `pageNum` / `pageSize`。
 * 数据源为 ClickHouse 热表 `audit_log_main_local`。
 */
export function fetchGetAuditLogList(params?: Api.Audit.LogSearchParams) {
  return request<Api.Audit.LogList>({
    url: '/audit/log/query/logs/page',
    method: 'post',
    data: params
  });
}

/** 查询审计日志详情 */
export function fetchGetAuditLogDetail(id: string) {
  return request<Api.Audit.LogRecord>({
    url: '/audit/log/query/logs/detail',
    method: 'get',
    params: { id }
  });
}

/** 获取指定日期的实时统计（后端 date 必填，ISO 日期格式） */
export function fetchGetAuditLogStats(date: string) {
  return request<Api.Audit.Stats>({
    url: '/audit/log/query/stats/realtime',
    method: 'get',
    params: { date }
  });
}

/** 获取日期区间的按天聚合统计（趋势图数据源，返回按日期升序的数组） */
export function fetchGetAuditLogDailyStats(startDate: string, endDate: string) {
  return request<Api.Audit.DailyStats[]>({
    url: '/audit/log/query/stats/daily',
    method: 'get',
    params: { startDate, endDate }
  });
}

/**
 * 按当前筛选条件导出审计日志 Excel
 *
 * `responseType: 'blob'` 会让请求层跳过 `isBackendSuccess` 的 `code === '00000'` 校验
 * （见 packages/axios/src/index.ts 对非 json 响应的分支），因此二进制响应不会被判定为失败。
 */
export function fetchExportAuditLog(params?: Api.Audit.LogSearchParams) {
  // 导出不接受分页字段，避免把 current/size 带给后端
  const { current: _current, size: _size, ...filters } = params ?? {};

  return request({
    url: '/audit/log/query/export',
    method: 'post',
    data: filters,
    responseType: 'blob'
  });
}
