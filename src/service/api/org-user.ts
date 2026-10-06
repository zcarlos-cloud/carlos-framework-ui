import { request } from '../request';

/** get user list */
export function fetchGetUserList(params?: Api.Organization.UserSearchParams) {
  return request<Api.Organization.UserList>({
    url: '/org/user/page',
    method: 'get',
    params
  });
}

/**
 * 用户状态码 → 后端 OrgUserStateEnum 枚举名
 *
 * 仅 changeState 使用（其入参为 OrgUserStateEnum，未标注 @JsonValue，
 * Jackson 按枚举名反序列化）。add / update 的 userStatus 形态不同，
 * 见下方两个 payload 构造函数。
 */
const USER_STATE_NAME: Record<Api.Organization.UserStatus, string> = {
  '0': 'DISABLE',
  '1': 'ENABLE',
  '2': 'LOCK'
};

/** 性别码 → 后端 OrgUserGenderEnum 枚举名（仅新增接口使用） */
const USER_GENDER_NAME: Record<Api.Organization.UserGender, string> = {
  '0': 'UNKNOWN',
  '1': 'MALE',
  '2': 'FEMALE'
};

/**
 * 新增用户 payload
 *
 * OrgUserCreateParam 的性别为 OrgUserGenderEnum（按枚举名接收），
 * 且该 Param 不含 userStatus 字段（新增后由后端默认置为启用），
 * 因此这里剔除 userStatus，并把性别转成枚举名。
 */
function toCreateUserPayload(data: Api.Organization.UserOperateParams) {
  const { account, nickname, phone, email, gender, pwd } = data;

  return {
    account,
    nickname,
    phone,
    email,
    pwd,
    gender: gender ? USER_GENDER_NAME[gender] : undefined
  };
}

/** 修改用户 payload：OrgUserUpdateParam 的 gender / userStatus 均为 Integer 数字码 */
function toUpdateUserPayload(data: Api.Organization.UserOperateParams) {
  return {
    ...data,
    gender: data.gender === undefined ? undefined : Number(data.gender),
    userStatus: data.userStatus === undefined ? undefined : Number(data.userStatus)
  };
}

/** add user */
export function fetchAddUser(data: Api.Organization.UserOperateParams) {
  return request({
    url: '/org/user/add',
    method: 'post',
    data: toCreateUserPayload(data)
  });
}

/**
 * 导出用户（按当前筛选条件）
 *
 * 后端 `/org/user/export` 接收 `OrgUserPageParam`，导出的正是列表页看到的那批 ——
 * 它与列表**共用同一份过滤条件**（`OrgUserManagerImpl#buildQueryWrapper`），
 * 所以这里同样要剥掉分页字段、保留筛选字段。
 */
export function fetchExportUser(params?: Api.Organization.UserSearchParams) {
  const { current: _current, size: _size, ...filters } = params ?? {};

  return request({
    url: '/org/user/export',
    method: 'get',
    params: filters,
    responseType: 'blob'
  });
}

/** 下载用户导入模板 */
export function fetchExportUserTemplate() {
  return request({
    url: '/org/user/import-template',
    method: 'get',
    responseType: 'blob'
  });
}

/**
 * 用户导入预览（两阶段导入第一步）
 *
 * 返回**每一行**及其校验结果（不是「通过/失败」两个列表）：`error` 为空即通过。
 * 后端校验账号非空/账号唯一/手机号唯一，失败原因合并在 `error` 里用「；」分隔。
 */
export function fetchPreviewImportUser(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return request<Api.Organization.UserExcel[]>({
    url: '/org/user/import-preview',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}

/**
 * 用户导入确认写入（两阶段导入第二步）
 *
 * 把预览结果整体回传即可：后端会**跳过** `error` 非空的行
 * （见 `OrgUserService#confirmImportUser`），前端不需要自己过滤。
 */
export function fetchConfirmImportUser(rows: Api.Organization.UserExcel[]) {
  return request({
    url: '/org/user/import-confirm',
    method: 'post',
    data: rows
  });
}

/** update user */
export function fetchUpdateUser(data: Api.Organization.UserOperateParams & { id: string }) {
  return request({
    url: '/org/user/update',
    method: 'post',
    data: toUpdateUserPayload(data)
  });
}

/** delete users */
export function fetchDeleteUser(ids: string[]) {
  return request({
    url: '/org/user/delete',
    method: 'post',
    data: { ids }
  });
}

/** get user detail */
export function fetchGetUserDetail(id: string) {
  return request<Api.Organization.User>({
    url: '/org/user/detail',
    method: 'get',
    params: { id }
  });
}

/** get roles bound to a user */
export function fetchGetUserRoles(userId: string) {
  return request<Api.Organization.UserRole[]>({
    url: '/org/user/roles',
    method: 'get',
    params: { userId }
  });
}

/** reset user password */
export function fetchResetUserPassword(id: string, newPwd: string) {
  return request({
    url: '/org/user/resetPassword',
    method: 'post',
    data: { id, newPwd }
  });
}

/**
 * 启用 / 禁用用户
 *
 * 后端 changeState 仅接受 0（禁用）与 1（启用），传入 2（锁定）会抛
 * InvalidUserStateException。锁定状态由系统自动设置（如登录失败次数超限），
 * 解锁请使用 {@link fetchUnlockUser}
 */
export function fetchChangeUserState(id: string, userStatus: Extract<Api.Organization.UserStatus, '0' | '1'>) {
  return request({
    url: '/org/user/changeState',
    method: 'post',
    data: { id, userStatus: USER_STATE_NAME[userStatus] }
  });
}

/** 解锁用户（状态由锁定 2 恢复为启用 1） */
export function fetchUnlockUser(id: string) {
  return request({
    url: '/org/user/unlock',
    method: 'post',
    data: { id }
  });
}

/**
 * assign roles to user
 *
 * 整表替换语义：后端先删光再重建（同 assignDepartments)。
 * expireTime 非空即**临时授权**——对本次 roleIds 统一生效（ADR-002);
 * 留空/不传表示长期有效。重新保存会覆盖原有失效时间。
 */
export function fetchAssignUserRoles(userId: string, roleIds: string[], expireTime?: string) {
  return request({
    url: '/org/user/assignRoles',
    method: 'post',
    data: { userId, roleIds, expireTime }
  });
}

/** 获取用户已分配部门（含 isMain 标记） */
export function fetchGetUserDepartments(userId: string) {
  return request<Api.Organization.UserDept[]>({
    url: '/org/user/departments',
    method: 'get',
    params: { userId }
  });
}

/**
 * 获取用户已分配岗位
 *
 * 后端 `getUserPositions` 会逐个补全 `positionName` / `positionCode` / `levelName`
 * （`OrgUserService:784-798`），所以详情抽屉可以直接展示名称而不必再查岗位表。
 */
export function fetchGetUserPositions(userId: string) {
  return request<Api.Organization.UserPosition[]>({
    url: '/org/user/positions',
    method: 'get',
    params: { userId }
  });
}

/**
 * 为用户分配部门
 *
 * ⚠️ 这是**整表替换**语义：后端先 `removeByUserId` 删光、再按 departmentIds 重建。
 * 因此调用方必须确保 departmentIds 是「完整的目标集合」——
 * 若因加载竞态提交了不完整（甚至为空）的集合，会把该用户原有部门关系清掉。
 *
 * 另外两条后端约束：
 * - `departmentIds` 带 `@NotEmpty`，**不能为空**（无法用这个接口清空部门）
 * - `mainDeptId` 若给值，**必须落在 departmentIds 之内**，否则抛
 *   `UserOperationException("主部门必须在所选部门列表中")`
 */
export function fetchAssignUserDepartments(userId: string, departmentIds: string[], mainDeptId?: string) {
  return request({
    url: '/org/user/assignDepartments',
    method: 'post',
    data: { userId, departmentIds, mainDeptId }
  });
}

/**
 * 修改本人密码（个人中心）
 *
 * ⚠️ 这三个密码必须提交**明文**：
 * 后端 `OrgUserService.changePassword` 直接把它当明文用
 * （`passwordEncoderProvider.matches(param.getOldPwd(), user.getPwd())`、
 * `encode(param.getNewPwd())`），carlos-org 内**没有任何解密逻辑**，也没有全局的
 * RequestBodyAdvice 解密器（全仓仅有 carlos-auth 的 `PublicKeyController.decryptPassword`，
 * 只在登录链路调用，且私钥用后即焚）。
 *
 * `OrgUserChangePwdParam` 上 `@Schema(description = "旧密码（SM2加密后）")` 是**错误注释** ——
 * 照它做 SM2 加密提交，必然得到「旧密码不正确」。
 *
 * 后端按入参 `id` 查找用户并校验旧密码，未强制绑定当前登录人，故前端恒传当前用户的 id。
 */
export function fetchChangeUserPassword(data: { id: string; oldPwd: string; newPwd: string; confirmPwd: string }) {
  return request({
    url: '/org/user/changePassword',
    method: 'post',
    data
  });
}

/**
 * 修改本人资料（个人中心）
 *
 * 只提交 {@link Api.Organization.ProfileOperateParams} 里的字段：后端 update 是全量覆盖语义，
 * 多传 account / userStatus / mainDeptId 会连带改掉本不该由用户自改的东西。
 */
export function fetchUpdateUserProfile(data: Api.Organization.ProfileOperateParams & { id: string }) {
  return request({
    url: '/org/user/update',
    method: 'post',
    data: {
      ...data,
      // OrgUserUpdateParam.gender 是 Integer 数字码（与 CreateParam 收枚举名不同）
      gender: data.gender === undefined ? undefined : Number(data.gender)
    }
  });
}
