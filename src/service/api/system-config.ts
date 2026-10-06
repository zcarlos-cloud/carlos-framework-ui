import { request } from '../request';

/**
 * 查询参数里的 valueType 必须用枚举名，不能用 JSON 码
 *
 * 后端 ConfigValueType 带 @JsonValue getJsonCode()，所以：
 * - JSON body（新增/修改）走 Jackson → 收发 "1"/"2"
 * - GET 查询参数走 Spring 的 StringToEnumConverterFactory → Enum.valueOf() → 只认 "TEXT"/"FILE"
 * 传 "1"/"2" 会被参数校验拦下（错误码 10101）。
 * 实测：valueType=TEXT/FILE 通过，valueType=1/2 报「参数校验失败」。
 */
const VALUE_TYPE_QUERY_NAME: Record<Api.SystemManage.ConfigValueType, string> = {
  '1': 'TEXT',
  '2': 'FILE'
};

/**
 * 前端表达 → 后端查询参数
 *
 * 两处表达与后端不同，必须在这里统一转：
 * 1. antd 的 `SelectValue` 不接受布尔值（`ARadioGroup` 才收），所以搜索栏用 "Y"/"N"
 *    表达 `configStatus`，而后端 `SysConfigPageParam.configStatus` 是 `Boolean`。
 * 2. `valueType` 的查询参数只认枚举名，见上面的说明。
 *
 * 抽成独立函数是因为**列表查询和导出都要用** —— 两处各写一遍必歪，
 * 而这类「隐形转换」写歪后表现为「筛选条件静默不生效」，很难排查。
 */
function toQueryParams(params?: Api.SystemManage.SysConfigSearchParams) {
  const { configStatus, valueType, ...rest } = params ?? {};

  return {
    ...rest,
    valueType: valueType === undefined ? undefined : VALUE_TYPE_QUERY_NAME[valueType],
    configStatus: configStatus === undefined ? undefined : configStatus === 'Y'
  };
}

/** get config page list */
export function fetchGetConfigList(params?: Api.SystemManage.SysConfigSearchParams) {
  return request<Api.SystemManage.SysConfigList>({
    url: '/sys/config/page',
    method: 'get',
    params: toQueryParams(params)
  });
}

/** get config detail */
export function fetchGetConfigDetail(id: string | number) {
  return request<Api.SystemManage.SysConfig>({
    url: `/sys/config/${id}`,
    method: 'get'
  });
}

/** add config */
export function fetchAddConfig(data: Partial<Api.SystemManage.SysConfig>) {
  return request({ url: '/sys/config', method: 'post', data });
}

/** update config */
export function fetchUpdateConfig(data: Partial<Api.SystemManage.SysConfig>) {
  return request({ url: '/sys/config/update', method: 'post', data });
}

/** delete config */
export function fetchDeleteConfig(ids: (string | number)[]) {
  return request({ url: '/sys/config/delete', method: 'post', data: { ids } });
}

/** get all config */
export function fetchGetAllConfig() {
  return request<Record<string, Api.SystemManage.SysConfig>>({
    url: '/sys/config/all',
    method: 'get'
  });
}

/** get config by code */
export function fetchGetConfigByCode(code: string) {
  return request<Api.SystemManage.SysConfig>({
    url: '/sys/config/code',
    method: 'get',
    params: { code }
  });
}

/** get login page config */
export function fetchGetLoginPageConfig() {
  return request({
    url: '/sys/config/loginpage',
    method: 'get'
  });
}

/**
 * export config
 *
 * 后端 `/sys/config/export` 已改为接收与列表页相同的查询条件，导出**当前筛选结果**
 * （此前无论前端怎么筛选都导出整表）。分页字段要剥掉：导出不接受 current/size。
 */
export function fetchExportConfig(params?: Api.SystemManage.SysConfigSearchParams) {
  const { current: _current, size: _size, ...filters } = params ?? {};

  return request({
    url: '/sys/config/export',
    method: 'get',
    params: toQueryParams(filters),
    responseType: 'blob'
  });
}

/** export config template */
export function fetchExportConfigTemplate() {
  return request({
    url: '/sys/config/export/template',
    method: 'get',
    responseType: 'blob'
  });
}

/** import config */
export function fetchImportConfig(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request({
    url: '/sys/config/import',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}
