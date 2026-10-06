import { request } from '../request';

/**
 * 系统管理（carlos-system，/sys/**）
 *
 * 用户 / 角色相关接口已迁移至 `org-user.ts` / `org-role.ts`（carlos-org，/org/**），
 * 本文件仅保留菜单管理。
 */

/** add menu */
export function fetchAddMenu(data: Api.SystemManage.MenuOperateParams) {
  return request({
    url: '/sys/menu',
    method: 'post',
    data
  });
}

/** update menu */
export function fetchUpdateMenu(data: Api.SystemManage.MenuOperateParams & { id: string }) {
  return request({
    url: '/sys/menu/update',
    method: 'post',
    data
  });
}

/** delete menus */
export function fetchDeleteMenu(ids: string[]) {
  return request({
    url: '/sys/menu/delete',
    method: 'post',
    data: { ids }
  });
}

/** get menu detail */
export function fetchGetMenuDetail(id: string) {
  return request<Api.SystemManage.Menu>({
    url: '/sys/menu/detail',
    method: 'get',
    params: { id }
  });
}

/**
 * get menu list（分页）
 *
 * ⚠️ 菜单页已改用下方的 `fetchGetAllMenus()` —— 树形 + 客户端搜索要求一次拿到全量，
 * 分页接口在 `size` 上会静默截断。此处保留是因为后端 `/sys/menu/pageWithButtons`
 * 仍然健在，将来若有真正需要分页的调用方（例如菜单数量级变大）可直接复用。
 */
export function fetchGetMenuList(params?: Api.SystemManage.MenuSearchParams) {
  // antd 的 SelectValue 不接受布尔值，前端以 "Y"/"N" 表达 hideInMenu，
  // 而后端 SysMenuPageParam.hideInMenu 是 Boolean，故在此转换
  const { hideInMenu, ...rest } = params ?? {};

  return request<Api.SystemManage.MenuList>({
    url: '/sys/menu/pageWithButtons',
    method: 'get',
    params: {
      ...rest,
      hideInMenu: hideInMenu === undefined ? undefined : hideInMenu === 'Y'
    }
  });
}

/**
 * 全部菜单（含按钮权限）
 *
 * 菜单页是树形 + 客户端搜索，需要**全量**菜单才能建出完整层级并补出祖先链，
 * 分页接口不适用。此前用 `/sys/menu/pageWithButtons?size=50` 顶，而库中菜单
 * 早已超过 50 条 —— 第 51 条起静默消失，既不在树上也搜不到。
 */
export function fetchGetAllMenus() {
  return request<Api.SystemManage.Menu[]>({
    url: '/sys/menu/all',
    method: 'get'
  });
}

/** get all pages */
export function fetchGetAllPages() {
  return request<string[]>({
    url: '/sys/menu/allPages',
    method: 'get'
  });
}

/** get menu tree */
export function fetchGetMenuTree() {
  return request<Api.SystemManage.MenuTree[]>({
    url: '/sys/menu/tree/select',
    method: 'get'
  });
}
