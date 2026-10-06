import { request } from '../request';

/** get storage config page list */
export function fetchGetStorageConfigList(params?: Api.SystemManage.StorageConfigSearchParams) {
  return request<Api.SystemManage.StorageConfigList>({
    url: '/sys/storage-config/page',
    method: 'get',
    params
  });
}

/**
 * get storage config detail
 *
 * ⚠️ 后端是 `@GetMapping("/detail")` + `@RequestParam Long id`，
 * 不是 `/sys/storage-config/{id}` —— 路径变量形式会落到静态资源处理器，
 * 返回 500 `No static resource ...`。
 */
export function fetchGetStorageConfigDetail(id: string | number) {
  return request<Api.SystemManage.StorageConfig>({
    url: '/sys/storage-config/detail',
    method: 'get',
    params: { id }
  });
}

/** add storage config */
export function fetchAddStorageConfig(data: Partial<Api.SystemManage.StorageConfig>) {
  return request({
    url: '/sys/storage-config',
    method: 'post',
    data
  });
}

/** update storage config */
export function fetchUpdateStorageConfig(data: Partial<Api.SystemManage.StorageConfig>) {
  return request({
    url: '/sys/storage-config/update',
    method: 'post',
    data
  });
}

/** delete storage config */
export function fetchDeleteStorageConfig(ids: (string | number)[]) {
  return request({
    url: '/sys/storage-config/delete',
    method: 'post',
    data: { ids }
  });
}

/**
 * set default storage config
 *
 * ⚠️ 同 `fetchGetStorageConfigDetail`：后端是 `@PostMapping("/default")` + `@RequestParam`，
 * 路径变量形式返回 500。此前「设为默认」按钮点下去就是 500，且**它的副作用是重载 OssUtil**，
 * 所以必须打对地址。
 */
export function fetchSetDefaultStorageConfig(id: string | number) {
  return request({
    url: '/sys/storage-config/default',
    method: 'post',
    params: { id }
  });
}

/** get default storage config */
export function fetchGetDefaultStorageConfig() {
  return request<Api.SystemManage.StorageConfig>({
    url: '/sys/storage-config/default',
    method: 'get'
  });
}

/** test storage config connection */
export function fetchTestStorageConfig(id: string | number) {
  return request<boolean>({
    url: '/sys/storage-config/test',
    method: 'post',
    params: { id }
  });
}
