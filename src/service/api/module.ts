import { request } from '../request';

/** Get sys module page list */
export function fetchGetSysModuleList(params?: Api.SystemManage.SysModuleSearchParams) {
  // antd 的 SelectValue 不接受布尔值，前端以 "Y"/"N" 表达 moduleStatus，
  // 而后端 SysModulePageParam.moduleStatus 是 Boolean，故在此转换
  const { moduleStatus, ...rest } = params ?? {};

  return request<Api.SystemManage.SysModuleList>({
    url: '/sys/module/page',
    method: 'get',
    params: {
      ...rest,
      moduleStatus: moduleStatus === undefined ? undefined : moduleStatus === 'Y'
    }
  });
}

/** Get all enabled sys modules */
export function fetchGetAllSysModules() {
  return request<Api.SystemManage.SysModule[]>({
    url: '/sys/module/list',
    method: 'get'
  });
}

/**
 * 获取**全部**模块（含已禁用）
 *
 * ⚠️ 与 {@link fetchGetAllSysModules} 的区别很重要：`/sys/module/list` 走的是
 * `listEnabled()`，**只返回启用中的模块**。管理后台的模块树与「上级模块」下拉
 * 都必须看到禁用模块 —— 否则禁用一个模块后它就彻底从界面上消失、连改回来都做不到；
 * 编辑子模块时其父模块若被禁用，也会从下拉里消失从而弄丢既有父子关系。
 */
export function fetchGetAllModules() {
  return request<Api.SystemManage.SysModule[]>({
    url: '/sys/module/all',
    method: 'get'
  });
}

/**
 * Add sys module
 *
 * 路径是 /sys/module/add：后端 SysModuleController 用 @PostMapping("add")，
 * 此前前端误调 POST /sys/module（无 add 后缀），必然 404。
 */
export function fetchAddSysModule(data: Api.SystemManage.SysModuleOperateParams) {
  return request<boolean>({
    url: '/sys/module/add',
    method: 'post',
    data
  });
}

/** Update sys module */
export function fetchUpdateSysModule(data: Api.SystemManage.SysModuleOperateParams & { id: string }) {
  return request<boolean>({
    url: '/sys/module/update',
    method: 'post',
    data
  });
}

/** Delete sys module */
export function fetchDeleteSysModule(ids: string[]) {
  return request<boolean>({
    url: '/sys/module/delete',
    method: 'post',
    data: { ids }
  });
}
