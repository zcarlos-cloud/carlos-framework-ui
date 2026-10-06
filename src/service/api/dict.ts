import { request } from '../request';

/** get dict page list */
export function fetchGetDictList(params?: Api.SystemManage.DictSearchParams) {
  return request<Api.SystemManage.DictList>({
    url: '/sys/dict/page',
    method: 'get',
    params
  });
}

/** get dict detail */
export function fetchGetDictDetail(id: string | number) {
  return request<Api.SystemManage.Dict>({
    url: `/sys/dict/${id}`,
    method: 'get'
  });
}

/** add dict */
export function fetchAddDict(data: Partial<Api.SystemManage.Dict>) {
  return request({
    url: '/sys/dict',
    method: 'post',
    data
  });
}

/** update dict */
export function fetchUpdateDict(data: Partial<Api.SystemManage.Dict>) {
  return request({
    url: '/sys/dict/update',
    method: 'post',
    data
  });
}

/** delete dict */
export function fetchDeleteDict(ids: (string | number)[]) {
  return request({
    url: '/sys/dict/delete',
    method: 'post',
    data: { ids }
  });
}

/** get dict full list (with items) */
export function fetchGetDictFullList(name?: string) {
  return request<Api.SystemManage.Dict[]>({
    url: '/sys/dict/full/list',
    method: 'get',
    params: { name }
  });
}

/** refresh dict cache */
export function fetchRefreshDictCache() {
  return request<boolean>({
    url: '/sys/dict/cache/refresh',
    method: 'post'
  });
}

/** get dict item page list */
export function fetchGetDictItemList(params?: Api.SystemManage.DictItemSearchParams) {
  return request<Api.SystemManage.DictItemList>({
    url: '/sys/dict/item/page',
    method: 'get',
    params
  });
}

/** get dict items by dict id */
export function fetchGetDictItemsByDictId(dictId: string | number) {
  return request<Api.SystemManage.DictItem[]>({
    url: '/sys/dict/item/list',
    method: 'get',
    params: { dictId }
  });
}

/** get dict item detail */
export function fetchGetDictItemDetail(id: string | number) {
  return request<Api.SystemManage.DictItem>({
    url: `/sys/dict/item/info/${id}`,
    method: 'get'
  });
}

/** add dict item */
export function fetchAddDictItem(data: Partial<Api.SystemManage.DictItem>) {
  return request({
    url: '/sys/dict/item',
    method: 'post',
    data
  });
}

/** update dict item */
export function fetchUpdateDictItem(data: Partial<Api.SystemManage.DictItem>) {
  return request({
    url: '/sys/dict/item/update',
    method: 'post',
    data
  });
}

/** delete dict item */
export function fetchDeleteDictItem(ids: (string | number)[]) {
  return request({
    url: '/sys/dict/item/delete',
    method: 'post',
    data: { ids }
  });
}

/** get dict select options */
export function fetchGetDictSelect(code?: string, name?: string) {
  return request<Api.SystemManage.DictItem[]>({
    url: '/sys/dict/item/select',
    method: 'get',
    params: { code, name }
  });
}
