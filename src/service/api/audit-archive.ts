import { request } from '../request';

/**
 * 分页查询归档记录
 *
 * 后端 `AuditLogArchiveRecordPageParam` 的时间范围为 `start` / `end`，
 * 页面侧的区间字段命名不同，由调用方映射后传入。
 */
export function fetchGetArchiveRecordList(params?: Api.Audit.ArchiveSearchParams) {
  return request<Api.Audit.ArchiveList>({
    url: '/audit/log/archive/record/page',
    method: 'get',
    params
  });
}

/** 查询归档记录详情 */
export function fetchGetArchiveRecordDetail(id: string) {
  return request<Api.Audit.ArchiveRecord>({
    url: '/audit/log/archive/record/detail',
    method: 'get',
    params: { id }
  });
}

/**
 * 删除归档记录
 *
 * 后端入参为 `ParamIdSet<Long>`，即 `{ ids: [...] }`
 */
export function fetchDeleteArchiveRecord(ids: string[]) {
  return request({ url: '/audit/log/archive/record/delete', method: 'post', data: { ids } });
}

/**
 * 恢复归档数据至 ClickHouse
 *
 * 后端签名为 `@PostMapping("restore") @RequestParam String archiveId`，
 * 故走查询串而非请求体。
 */
export function fetchRestoreArchive(archiveId: string) {
  return request({
    url: '/audit/log/archive/record/restore',
    method: 'post',
    params: { archiveId }
  });
}
