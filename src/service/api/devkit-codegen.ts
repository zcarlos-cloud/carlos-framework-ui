import { request } from '../request';

/** 目标实例下的库 / schema 清单 */
export function fetchGetDevkitCodegenSchemas(dsId: string) {
  return request<string[]>({
    url: '/devkit/codegen/schemas',
    method: 'get',
    params: { dsId }
  });
}

/** 目标库下的表清单 */
export function fetchGetDevkitCodegenTables(params: { dsId: string; schema?: string; keyword?: string }) {
  return request<Api.Devkit.TableMeta[]>({
    url: '/devkit/codegen/tables',
    method: 'get',
    params
  });
}

/** 目标表的列元数据 */
export function fetchGetDevkitCodegenColumns(params: { dsId: string; schema?: string; tableName: string }) {
  return request<Api.Devkit.ColumnMeta[]>({
    url: '/devkit/codegen/columns',
    method: 'get',
    params
  });
}

/** 代码生成预览（产物在内存中返回） */
export function fetchPreviewDevkitCodegen(data: Api.Devkit.CodeGenRunParams) {
  return request<Api.Devkit.GeneratedResult>({
    url: '/devkit/codegen/preview',
    method: 'post',
    data
  });
}

/**
 * 代码生成并下载 zip
 *
 * `responseType: 'blob'` 跳过信封校验；后端端点带 `@NoWrap`，直接把 zip 字节写下响应体。
 */
export function fetchGenerateDevkitCodegen(data: Api.Devkit.CodeGenRunParams) {
  return request({
    url: '/devkit/codegen/generate',
    method: 'post',
    data,
    responseType: 'blob'
  });
}

/** 单模板渲染预览（用样例表渲染模板正文） */
export function fetchPreviewDevkitTemplate(data: Api.Devkit.TemplateRenderPreviewParams) {
  return request<Api.Devkit.TemplateRenderPreview>({
    url: '/devkit/codegen/template-preview',
    method: 'post',
    data
  });
}
