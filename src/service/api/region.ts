import { request } from '../request';

/** get region page list */
export function fetchGetRegionList(params?: Api.SystemManage.RegionSearchParams) {
  return request<Api.SystemManage.RegionList>({
    url: '/sys/region/page',
    method: 'get',
    params
  });
}

/**
 * get region tree list
 *
 * 注意：只有这个接口用 parentId，分页接口与实体/VO 用的都是 parentCode
 * （存的是上级区域的**编码**，不是 id），后端本身的不一致，勿混用
 */
export function fetchGetRegionTreeList(params?: {
  parentId?: string;
  regionName?: string;
  regionCode?: string;
  codeTop?: boolean;
}) {
  return request<Api.SystemManage.Region[]>({
    url: '/sys/region/tree/list',
    method: 'get',
    params
  });
}

/** get region detail */
export function fetchGetRegionDetail(id: string) {
  return request<Api.SystemManage.Region>({
    url: `/sys/region/${id}`,
    method: 'get'
  });
}

/** add region */
export function fetchAddRegion(data: Api.SystemManage.RegionOperateParams) {
  return request({
    url: '/sys/region',
    method: 'post',
    data
  });
}

/** update region */
export function fetchUpdateRegion(data: Api.SystemManage.RegionOperateParams & { id: string }) {
  return request({
    url: '/sys/region/update',
    method: 'post',
    data
  });
}

/** delete region */
export function fetchDeleteRegion(ids: string[]) {
  return request({
    url: '/sys/region/delete',
    method: 'post',
    data: { ids }
  });
}

/** load region step by step */
export function fetchGetRegionLoadStep(regionCode?: string) {
  return request<Api.SystemManage.Region[]>({
    url: '/sys/region/loadStep',
    method: 'get',
    params: { regionCode }
  });
}

/** get all parent regions */
export function fetchGetAllParentRegions(regionCode?: string) {
  return request<Api.SystemManage.Region[]>({
    url: '/sys/region/getAllParentRegions',
    method: 'get',
    params: { regionCode }
  });
}

/** export region */
export function fetchExportRegion() {
  return request({
    url: '/sys/region/export',
    method: 'get',
    responseType: 'blob'
  });
}

/** export region template */
export function fetchExportRegionTemplate() {
  return request({
    url: '/sys/region/export/template',
    method: 'get',
    responseType: 'blob'
  });
}

/** import region */
export function fetchImportRegion(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request({
    url: '/sys/region/import',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}

/** reset region parents */
export function fetchResetRegionParents() {
  return request({
    url: '/sys/region/parents/reset',
    method: 'post'
  });
}

/** init region cache */
export function fetchInitRegionCache() {
  return request({
    url: '/sys/region/cache/init',
    method: 'post'
  });
}

/** clear region cache */
export function fetchClearRegionCache() {
  return request({
    url: '/sys/region/cache/clear',
    method: 'post'
  });
}
