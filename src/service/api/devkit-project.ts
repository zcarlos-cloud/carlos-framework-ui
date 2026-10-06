import { request } from '../request';

/** 可用的工程模板组 */
export function fetchGetDevkitProjectTemplates() {
  return request<Api.Devkit.TemplateGroup[]>({
    url: '/devkit/projectgen/template/list',
    method: 'get'
  });
}

/** 工程生成预览 */
export function fetchPreviewDevkitProject(data: Api.Devkit.ProjectGenRunParams) {
  return request<Api.Devkit.GeneratedResult>({
    url: '/devkit/projectgen/preview',
    method: 'post',
    data
  });
}

/**
 * 工程生成并下载 zip
 *
 * `responseType: 'blob'` 跳过信封校验；后端端点带 `@NoWrap`。
 */
export function fetchGenerateDevkitProject(data: Api.Devkit.ProjectGenRunParams) {
  return request({
    url: '/devkit/projectgen/generate',
    method: 'post',
    data,
    responseType: 'blob'
  });
}
