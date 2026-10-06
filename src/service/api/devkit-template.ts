import { request } from '../request';

/** 模板组分页 */
export function fetchGetDevkitTemplateGroupList(params?: Api.Devkit.TemplateGroupSearchParams) {
  return request<Api.Devkit.TemplateGroupList>({
    url: '/devkit/template/group/page',
    method: 'get',
    params
  });
}

/** 模板组列表（下拉用，可按模板类型过滤） */
export function fetchGetDevkitTemplateGroupOptions(templateType?: Api.Devkit.TemplateType) {
  return request<Api.Devkit.TemplateGroup[]>({
    url: '/devkit/template/group/list',
    method: 'get',
    params: { templateType }
  });
}

/** 模板组详情 */
export function fetchGetDevkitTemplateGroupDetail(id: string) {
  return request<Api.Devkit.TemplateGroup>({
    url: `/devkit/template/group/${id}`,
    method: 'get'
  });
}

/** 新增模板组 */
export function fetchAddDevkitTemplateGroup(data: Api.Devkit.TemplateGroupCreateParams) {
  return request({
    url: '/devkit/template/group/add',
    method: 'post',
    data
  });
}

/** 编辑模板组 */
export function fetchUpdateDevkitTemplateGroup(data: Api.Devkit.TemplateGroupUpdateParams) {
  return request({
    url: '/devkit/template/group/update',
    method: 'post',
    data
  });
}

/** 批量删除模板组（内置模板组不可删除） */
export function fetchDeleteDevkitTemplateGroup(ids: string[]) {
  return request({
    url: '/devkit/template/group/delete',
    method: 'post',
    data: { ids }
  });
}

/** 复制模板组 */
export function fetchCopyDevkitTemplateGroup(data: Api.Devkit.TemplateGroupCopyParams) {
  return request({
    url: '/devkit/template/group/copy',
    method: 'post',
    data
  });
}

/** 切换模板组启用状态 */
export function fetchToggleDevkitTemplateGroupStatus(id: string, status: Api.Devkit.Status) {
  return request({
    url: '/devkit/template/group/toggle-status',
    method: 'post',
    data: { id, status }
  });
}

/** 模板文件树 */
export function fetchGetDevkitTemplateFileTree(groupId: string) {
  return request<Api.Devkit.TemplateFileNode[]>({
    url: '/devkit/template/file/tree',
    method: 'get',
    params: { groupId }
  });
}

/** 模板文件详情（含正文，供在线编辑） */
export function fetchGetDevkitTemplateFileDetail(id: string) {
  return request<Api.Devkit.TemplateFile>({
    url: `/devkit/template/file/${id}`,
    method: 'get'
  });
}

/** 新增模板文件 */
export function fetchAddDevkitTemplateFile(data: Api.Devkit.TemplateFileCreateParams) {
  return request({
    url: '/devkit/template/file/add',
    method: 'post',
    data
  });
}

/** 保存模板正文（保存前自动落一版历史） */
export function fetchSaveDevkitTemplateFile(data: Api.Devkit.TemplateFileSaveParams) {
  return request({
    url: '/devkit/template/file/save',
    method: 'post',
    data
  });
}

/** 重命名 / 移动模板文件 */
export function fetchRenameDevkitTemplateFile(data: Api.Devkit.TemplateFileRenameParams) {
  return request({
    url: '/devkit/template/file/rename',
    method: 'post',
    data
  });
}

/** 批量删除模板文件 */
export function fetchDeleteDevkitTemplateFile(ids: string[]) {
  return request({
    url: '/devkit/template/file/delete',
    method: 'post',
    data: { ids }
  });
}

/**
 * 导出模板组为 zip
 *
 * `responseType: 'blob'` 会让请求层跳过 `code === '00000'` 的信封校验，
 * 因此后端导出端点的 `@NoWrap` 是必需的（否则 zip 会被包成 JSON）。
 */
export function fetchExportDevkitTemplateGroup(groupId: string) {
  return request({
    url: '/devkit/template/file/download',
    method: 'get',
    params: { groupId },
    responseType: 'blob'
  });
}

/** 模板版本分页 */
export function fetchGetDevkitTemplateVersionList(params: { templateId: string; current: number; size: number }) {
  return request<Api.Devkit.TemplateVersionList>({
    url: '/devkit/template/version/page',
    method: 'get',
    params
  });
}

/** 模板版本详情（含正文快照，供 diff） */
export function fetchGetDevkitTemplateVersionDetail(id: string) {
  return request<Api.Devkit.TemplateVersion>({
    url: `/devkit/template/version/${id}`,
    method: 'get'
  });
}

/** 回滚到指定版本 */
export function fetchRollbackDevkitTemplateVersion(id: string) {
  return request({
    url: `/devkit/template/version/rollback/${id}`,
    method: 'post'
  });
}
