import { request } from '../request';

/**
 * Get one service's whole enum dictionary
 *
 * @param module 网关路径前缀（`sys` / `org` / `auth` / `message` / `audit` / `job` / `workflow`），
 * 不是 `@AppEnum` 的 code，也不是服务名 —— 网关会把这一层剥掉再转发到各服务的 `/app/enums`
 * @see utils/enum-dict.ts
 */
export function fetchModuleEnums(module: string) {
  return request<Record<string, Enum.EnumItem[]>>({
    url: `/${module}/app/enums`,
    method: 'get'
  });
}

/** Get i18n messages by lang and module codes */
export function fetchGetI18nMessages(lang: string, moduleCodes?: string) {
  return request<Api.SystemManage.I18nMessages>({
    url: '/sys/i18n/messages',
    method: 'get',
    params: { lang, moduleCodes }
  });
}
