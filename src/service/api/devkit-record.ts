import { request } from '../request';

/** 生成记录分页 */
export function fetchGetDevkitRecordList(params?: Api.Devkit.GenerateRecordSearchParams) {
  return request<Api.Devkit.GenerateRecordList>({
    url: '/devkit/record/page',
    method: 'get',
    params
  });
}

/** 批量删除生成记录 */
export function fetchDeleteDevkitRecord(ids: string[]) {
  return request({
    url: '/devkit/record/delete',
    method: 'post',
    data: { ids }
  });
}
