import { request } from '../request';

/** get app client page list */
export function fetchGetAppClientPage(params?: Api.AppClient.AppClientSearchParams) {
  return request<Api.AppClient.AppClientList>({
    url: '/auth/app/client/page',
    method: 'get',
    params
  });
}

/** get app client detail */
export function fetchGetClientDetail(id: string) {
  return request<Api.AppClient.AppClientDetail>({
    url: '/auth/app/client/detail',
    method: 'get',
    params: { id }
  });
}

/** get app client list */
export function fetchGetAppClientList(keyword?: string) {
  return request<Api.AppClient.AppClientSimple[]>({
    url: '/auth/app/client/list',
    method: 'get',
    params: { keyword }
  });
}

/** add app client */
export function fetchAddAppClient(data: Api.AppClient.AppClientCreateParams) {
  return request<Api.AppClient.AppClientDetail>({ url: '/auth/app/client/add', method: 'post', data });
}

/** update app client */
export function fetchUpdateAppClient(data: Api.AppClient.AppClientUpdateParams) {
  return request({ url: '/auth/app/client/update', method: 'post', data });
}

/** delete app client */
export function fetchDeleteAppClient(ids: (string | number)[]) {
  return request({ url: '/auth/app/client/delete', method: 'post', data: { ids } });
}

/** reset app client secret, returns the new plain secret */
export function fetchResetClientSecret(id: string) {
  return request<string>({ url: '/auth/app/client/resetSecret', method: 'post', data: { id } });
}

/** export app client */
export function fetchExportAppClient() {
  return request({
    url: '/auth/app/client/export',
    method: 'get',
    responseType: 'blob'
  });
}

/** export app client template */
export function fetchExportAppClientTemplate() {
  return request({
    url: '/auth/app/client/export/template',
    method: 'get',
    responseType: 'blob'
  });
}

/** import app client */
export function fetchImportAppClient(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request({
    url: '/auth/app/client/import',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}

/** get app visible role codes */
export function fetchGetAppRoles(appId: string) {
  return request<string[]>({
    url: `/auth/app/client/roles/${appId}`,
    method: 'get'
  });
}

/** set app visible role codes */
export function fetchSetAppRoles(appId: string, roleCodes: string[]) {
  return request({
    url: '/auth/app/client/roles',
    method: 'post',
    data: { appId, roleCodes }
  });
}

/** get app category list */
export function fetchAppCategoryList() {
  return request<Api.AppCategory.AppCategory[]>({
    url: '/auth/app/category/list',
    method: 'get'
  });
}

/** add app category */
export function fetchAddAppCategory(data: Api.AppCategory.AppCategoryCreateParams) {
  return request({ url: '/auth/app/category/add', method: 'post', data });
}

/** update app category */
export function fetchUpdateAppCategory(data: Api.AppCategory.AppCategoryUpdateParams) {
  return request({ url: '/auth/app/category/update', method: 'post', data });
}

/** delete app category */
export function fetchDeleteAppCategory(id: string) {
  return request({ url: '/auth/app/category/delete', method: 'post', data: { id } });
}
