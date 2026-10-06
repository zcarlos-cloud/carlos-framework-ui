import { request } from '../request';

/** 数据源分页 */
export function fetchGetDevkitDataSourceList(params?: Api.Devkit.DataSourceSearchParams) {
  return request<Api.Devkit.DataSourceList>({
    url: '/devkit/datasource/page',
    method: 'get',
    params
  });
}

/** 启用中的数据源（下拉用） */
export function fetchGetDevkitDataSourceOptions() {
  return request<Api.Devkit.DataSource[]>({
    url: '/devkit/datasource/list',
    method: 'get'
  });
}

/**
 * 数据源详情
 *
 * ⚠️ 后端**不回发密码**，只回 `hasPassword` —— 编辑抽屉里不要试图回填 password。
 */
export function fetchGetDevkitDataSourceDetail(id: string) {
  return request<Api.Devkit.DataSource>({
    url: `/devkit/datasource/${id}`,
    method: 'get'
  });
}

/** 新增数据源 */
export function fetchAddDevkitDataSource(data: Api.Devkit.DataSourceCreateParams) {
  return request({
    url: '/devkit/datasource/add',
    method: 'post',
    data
  });
}

/** 编辑数据源（password 留空 = 保持原值） */
export function fetchUpdateDevkitDataSource(data: Api.Devkit.DataSourceUpdateParams) {
  return request({
    url: '/devkit/datasource/update',
    method: 'post',
    data
  });
}

/** 批量删除数据源 */
export function fetchDeleteDevkitDataSource(ids: string[]) {
  return request({
    url: '/devkit/datasource/delete',
    method: 'post',
    data: { ids }
  });
}

/** 测试连接（传 id 且密码留空时使用库中已存密码） */
export function fetchTestDevkitDataSource(data: Api.Devkit.DataSourceTestParams) {
  return request<Api.Devkit.TestConnectionResult>({
    url: '/devkit/datasource/test',
    method: 'post',
    data
  });
}
