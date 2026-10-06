import { request } from '../request';

/** Get i18n message page list */
export function fetchGetI18nMessageList(params?: Api.SystemManage.I18nMessageSearchParams) {
  // antd 的 SelectValue 不接受布尔值，前端以 "Y"/"N" 表达 msgStatus，
  // 而后端 SysI18nPageParam.msgStatus 是 Boolean，故在此转换
  const { msgStatus, ...rest } = params ?? {};

  return request<Api.SystemManage.I18nMessageList>({
    url: '/sys/i18n/page',
    method: 'get',
    params: {
      ...rest,
      msgStatus: msgStatus === undefined ? undefined : msgStatus === 'Y'
    }
  });
}

/** Add i18n message */
export function fetchAddI18nMessage(data: Api.SystemManage.I18nMessageOperateParams) {
  return request<boolean>({
    url: '/sys/i18n',
    method: 'post',
    data
  });
}

/** Update i18n message */
export function fetchUpdateI18nMessage(data: Api.SystemManage.I18nMessageOperateParams & { id: string }) {
  return request<boolean>({
    url: '/sys/i18n/update',
    method: 'post',
    data
  });
}

/** Delete i18n message */
export function fetchDeleteI18nMessage(ids: string[]) {
  return request<boolean>({
    url: '/sys/i18n/delete',
    method: 'post',
    data: { ids }
  });
}
