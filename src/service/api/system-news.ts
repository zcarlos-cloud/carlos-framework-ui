import { request } from '../request';

/** get news page list（管理端） */
export function fetchGetNewsList(params?: Api.SystemManage.NewsSearchParams) {
  return request<Api.SystemManage.NewsList>({
    url: '/sys/news/page',
    method: 'get',
    params
  });
}

/** get news detail（含 content 大字段） */
export function fetchGetNewsDetail(id: string) {
  return request<Api.SystemManage.News>({
    url: '/sys/news/detail',
    method: 'get',
    params: { id }
  });
}

/** add news */
export function fetchAddNews(data: Api.SystemManage.NewsOperateParams) {
  return request({ url: '/sys/news', method: 'post', data });
}

/** update news */
export function fetchUpdateNews(data: Api.SystemManage.NewsOperateParams) {
  return request({ url: '/sys/news/update', method: 'post', data });
}

/** delete news */
export function fetchDeleteNews(ids: string[]) {
  return request({ url: '/sys/news/delete', method: 'post', data: { ids } });
}

/** publish news（草稿/已下线 → 已发布） */
export function fetchPublishNews(id: string) {
  return request({ url: '/sys/news/publish', method: 'post', data: { id } });
}

/** offline news（已发布 → 已下线） */
export function fetchOfflineNews(id: string) {
  return request({ url: '/sys/news/offline', method: 'post', data: { id } });
}

/** get my news page（用户端，含已读标记） */
export function fetchGetMyNewsList(params?: Api.SystemManage.NewsMySearchParams) {
  return request<Api.SystemManage.NewsList>({
    url: '/sys/news/my/page',
    method: 'get',
    params
  });
}

/** get my news detail（用户端，带可见性校验；管理端 detail 不校验可见性，铃铛必须走这里） */
export function fetchGetMyNewsDetail(id: string) {
  return request<Api.SystemManage.News>({
    url: '/sys/news/my/detail',
    method: 'get',
    params: { id }
  });
}

/** mark news read（幂等） */
export function fetchReadNews(id: string) {
  return request({ url: '/sys/news/read', method: 'post', params: { id } });
}

/** get unread news count（顶栏角标） */
export function fetchGetNewsUnreadCount() {
  return request<number>({ url: '/sys/news/unread-count', method: 'get' });
}
