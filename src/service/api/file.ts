import { request } from '../request';

/*
 * ⚠️ 本文件里有三个函数**目前没有任何调用方**：
 * `fetchGetFileDetail` / `fetchUpdateFile` / `fetchGetFileStatistics`。
 *
 * 保留而非删除的理由：三个都指向后端**真实存在**的端点
 * （`/sys/file/detail`、`/sys/file/update`、`/sys/file/statistics`），
 * 只是 UI 还没做（文件详情页、编辑、统计卡片）。B5 批次点名了它们「零引用」，
 * 但这个状态是「功能未建」而不是「写错了地址」—— 后者本文件此前确实有过
 * （`/sys/file/{id}` 与 `DELETE /sys/file/{id}` 都必然 404），已经修掉了。
 *
 * 若确认这些功能短期内不会做，可以整段删掉；删之前请先确认后端端点也要一并下线。
 */

/** get file page list（行类型为 UploadRecord，对应后端 UploadRecordVO） */
export function fetchGetFileList(params?: Api.SystemManage.FileSearchParams) {
  return request<Api.SystemManage.FileList>({
    url: '/sys/file/page',
    method: 'get',
    params
  });
}

/**
 * get file detail
 *
 * 后端是 @GetMapping("detail") + @RequestParam id，
 * 此前前端调的是 /sys/file/{id}（RESTful 风格），必然 404
 */
export function fetchGetFileDetail(id: string) {
  return request<Api.SystemManage.FileInfo>({
    url: '/sys/file/detail',
    method: 'get',
    params: { id }
  });
}

/**
 * delete file
 *
 * 后端是 @PostMapping("delete") + @RequestParam id，
 * 此前前端调的是 DELETE /sys/file/{id}，必然 404
 */
export function fetchDeleteFile(id: string) {
  return request({
    url: '/sys/file/delete',
    method: 'post',
    params: { id }
  });
}

/**
 * batch delete files
 *
 * 后端是 @PostMapping("deleteBatch") + @RequestBody Set<Long>，
 * 即 body 直接是 id 数组，不是 { ids } 包装对象
 */
export function fetchDeleteFileBatch(ids: string[]) {
  return request({
    url: '/sys/file/deleteBatch',
    method: 'post',
    data: ids
  });
}

/** update file info（后端：@RequestParam id + @RequestBody dto） */
export function fetchUpdateFile(id: string, data: Partial<Api.SystemManage.UploadRecord>) {
  return request({
    url: '/sys/file/update',
    method: 'post',
    params: { id },
    data
  });
}

/** get file statistics */
export function fetchGetFileStatistics() {
  return request<Api.SystemManage.FileStatistics>({
    url: '/sys/file/statistics',
    method: 'get'
  });
}

/** upload file */
export function fetchUploadFile(file: File, namespace: string = 'default') {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('namespace', namespace);
  return request<Api.SystemManage.UploadResult>({
    url: '/sys/file/upload',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}

/**
 * download file
 *
 * 注意泛型是两个：<数据类型, ResponseType>。只写 request<Blob> 会让 R 仍默认
 * 'json'，于是 responseType: 'blob' 类型不匹配（这是此前就存在的类型错误）
 */
export function fetchDownloadFile(id: string) {
  return request<Blob, 'blob'>({
    url: '/sys/file/load',
    method: 'get',
    params: { id },
    responseType: 'blob'
  });
}
