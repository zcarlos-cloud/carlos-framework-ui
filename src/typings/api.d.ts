/**
 * Namespace Api
 *
 * All backend api type
 */
declare namespace Api {
  namespace Common {
    /** common params of paginating */
    interface PaginatingCommonParams {
      /** current page number */
      current: number;
      /** page size */
      size: number;
      /** total count */
      total: number;
    }

    /** common params of paginating query list data */
    interface PaginatingQueryRecord<T = any> extends PaginatingCommonParams {
      records: T[];
    }

    /** common search params of table */
    type CommonSearchParams = Pick<Common.PaginatingCommonParams, 'current' | 'size'>;

    /**
     * enable status
     *
     * - "1": enabled
     * - "2": disabled
     */
    type EnableStatus = '1' | '2';

    /** common record */
    type CommonRecord<T = any> = {
      /**
       * record id
       *
       * 后端 Long 经全局 `LongJsonComponent` 序列化为字符串，
       * 避免 19 位雪花 ID 超出 Number.MAX_SAFE_INTEGER 后丢失精度
       */
      id: string;
      /** record creator */
      createBy: string;
      /** record create time */
      createTime: string;
      /** record updater */
      updateBy: string;
      /** record update time */
      updateTime: string;
      /** record status */
      status: EnableStatus;
    } & T;
  }

  /**
   * Namespace Auth
   *
   * Backend api module: "auth"
   */
  namespace Auth {
    /** 登录响应（兼容 MFA 两步流程） */
    interface LoginToken {
      /** 访问令牌（mfaRequired=true 时为 null） */
      token: string;
      /** 刷新令牌 */
      refreshToken: string;
      /**
       * 过期时间（秒）
       *
       * ⚠️ 类型是 `number | string` 不是笔误：`/auth/user/login` 与 `/auth/user/refreshToken` 返回的
       * 是后端的 `Long`，而框架给 `Long` 全局注册了 `ToStringSerializer`（`JacksonJsonService:100-102`，
       * 防雪花 id 精度丢失），所以**实际到前端是字符串** `"900"`；
       * 而 `/oauth2/token` 那条路径上的 `expires_in` 是 OAuth2 规范里的数字。
       * 使用方一律用 `Number(...)` 归一化，不要写 `typeof === 'number'`。
       */
      expiresIn?: number | string;
      /** 令牌类型 */
      tokenType?: string;
      /** 是否需要 MFA 验证 */
      mfaRequired?: boolean;
      /** 是否建议启用 MFA */
      mfaRecommended?: boolean;
      /** MFA 临时令牌（mfaRequired=true 时返回） */
      mfaToken?: string;
    }

    /** 登录预校验响应 */
    interface PreCheckResponse {
      /** 风险等级 */
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      /** 是否需要验证码 */
      needCaptcha: boolean;
      /** 验证码类型 */
      captchaType: 'slider' | 'behavior' | null;
      /** 是否需要 MFA */
      mfaRequired: boolean;
      /** 是否阻断 */
      blocked: boolean;
      /** 阻断原因 */
      blockReason: string | null;
      /** 是否建议启用 MFA */
      mfaRecommended: boolean;
    }

    /** 扫码登录二维码信息 */
    interface QrCodeInfo {
      qrcodeId: string;
      qrcodeUrl: string;
      expiresAt: string;
      ttl: number;
    }

    interface UserInfo {
      userId: string;
      userName: string;
      roles: string[];
      buttons: string[];
    }

    /**
     * 登录日志状态（S4）
     *
     * 与审计日志同源，但登录事件只会产生 SUCCESS/FAIL
     * （AuditLogUtil.resolveStatus：非 SUCCESS 一律记 FAIL），故收窄为独立类型，
     * 不引用 Api.Audit.LogStatus（避免审计侧增删枚举时语义外溢到登录场景）
     */
    type LoginLogStatus = 'SUCCESS' | 'FAIL';

    /**
     * 登录日志（S4，数据来自 carlos-audit ClickHouse，logType=USER_LOGIN）
     */
    type LoginLog = {
      /** 日志ID（雪花 Long 序列化为字符串） */
      id: string;
      /** 用户名 */
      username: string;
      /** 登录结果 */
      logStatus: LoginLogStatus;
      /** 登录时间（LocalDateTime 原样 ISO 下发） */
      loginTime: string;
      /** 客户端IP */
      ip: string;
      /** 登录地点（后端拼接，可能为空） */
      location: string | null;
      /** User-Agent */
      userAgent: string;
      /** 认证方式（PASSWORD/SMS/OAUTH2 等） */
      authType: string;
      /** 结果描述 */
      resultMessage: string | null;
      /** 耗时（毫秒） */
      durationMs: number | null;
    };

    type LoginLogSearchParams = Partial<Pick<LoginLog, 'username' | 'logStatus' | 'ip' | 'authType'>> & {
      /** 开始时间（ISO-8601） */
      startTime?: string;
      /** 结束时间（ISO-8601） */
      endTime?: string;
    } & Common.CommonSearchParams;

    type LoginLogList = Common.PaginatingQueryRecord<LoginLog>;

    /**
     * 登录日志详情（在列表字段基础上扩展客户端/认证/链路上下文，后端 LoginLogDetailVO）
     */
    type LoginLogDetail = LoginLog & {
      /** 用户ID */
      principalId: string | null;
      /** 主体类型：USER/SERVICE/SYSTEM/ANONYMOUS */
      principalType: string | null;
      /** 认证源：LOCAL/WECHAT/DINGTALK 等 */
      authProvider: string | null;
      /** 登录渠道：WEB/APP/MINI_PROGRAM 等 */
      bizChannel: string | null;
      /** 客户端端口 */
      clientPort: number | null;
      /** 处理服务器IP */
      serverIp: string | null;
      /** 设备指纹 */
      deviceFingerprint: string | null;
      /** 风险等级 0-100 */
      riskLevel: number | null;
      /** 业务结果码 */
      resultCode: string | null;
      /** 客户端时间 */
      clientTime: string | null;
      /** 服务器时间 */
      serverTime: string | null;
      /** 部门名称 */
      deptName: string | null;
      /** 租户ID */
      tenantId: string | null;
      /** 全链路追踪ID */
      traceId: string | null;
      /** 应用名 */
      appName: string | null;
    };

    /**
     * 在线用户会话（S4，来自 Redis 授权存储）
     *
     * ip/userAgent 为签发时写入的会话元数据，存量会话可能为空
     */
    type OnlineUser = {
      /** 会话ID（授权ID，踢下线用） */
      sessionId: string;
      /** 用户名 */
      username: string;
      /** 用户ID（Long 序列化为字符串，可能为空） */
      userId: string | null;
      /** 登录客户端 */
      clientId: string;
      /** 授权类型 */
      grantType: string;
      /** 登录IP */
      ip: string | null;
      /** User-Agent */
      userAgent: string | null;
      /** 登录时间 */
      loginTime: string;
      /** 会话过期时间 */
      expireTime: string;
    };

    type OnlineUserSearchParams = Partial<Pick<OnlineUser, 'username'>> & Common.CommonSearchParams;

    type OnlineUserList = Common.PaginatingQueryRecord<OnlineUser>;

    /** 踢下线参数：sessionIds 与 username 至少传一个 */
    type OnlineUserKickParams = {
      /** 会话ID列表（踢指定会话） */
      sessionIds?: string[];
      /** 用户名（踢该用户全部会话） */
      username?: string;
    };
  }

  /**
   * Namespace Route
   *
   * Backend api module: "route"
   */
  namespace Route {
    type ElegantConstRoute = import('@elegant-router/types').ElegantConstRoute;

    interface MenuRoute extends ElegantConstRoute {
      id: string;
    }

    interface UserRoute {
      routes: MenuRoute[];
      home: import('@elegant-router/types').LastLevelRouteKey;
    }
  }

  /**
   * namespace SystemManage
   *
   * backend api module: "systemManage"
   */
  namespace SystemManage {
    /** menu operate params（新增/修改菜单，对应后端 SysMenuCreateParam / SysMenuUpdateParam） */
    type MenuOperateParams = Partial<
      Pick<
        Api.SystemManage.Menu,
        | 'parentId'
        | 'menuCategory'
        | 'menuName'
        | 'routeName'
        | 'routePath'
        | 'component'
        | 'url'
        | 'clientType'
        | 'routeQuery'
        | 'remark'
        | 'icon'
        | 'iconType'
        | 'i18nKey'
        | 'keepAlive'
        | 'constant'
        | 'href'
        | 'hideInMenu'
        | 'activeMenu'
        | 'multiTab'
        | 'fixedIndexInTab'
      >
    > & {
      /** 菜单状态 */
      menuStatus?: MenuStatus;
      /** 排序 */
      orderNum?: number;
      /** 菜单层级 */
      menuLevel?: number;
      /** 按钮权限列表 */
      buttons?: MenuButton[];
    };

    /**
     * menu category
     *
     * 对应后端 MenuCategory。注意后端 SysMenuVO 直接暴露 Java 枚举，
     * JSON 中序列化为枚举名而非数字码（与 userStatus / roleStatus 的整型码不同）
     *
     * - "DIRECTORY": directory
     * - "MENU": menu
     */
    type MenuCategory = 'DIRECTORY' | 'MENU';

    /**
     * menu status
     *
     * 对应后端 MenuStatus，同样以枚举名序列化
     *
     * - "ENABLED": enabled
     * - "DISABLED": disabled
     */
    type MenuStatus = 'ENABLED' | 'DISABLED';

    /**
     * client type
     *
     * 对应后端 MenuType（字符串枚举，勿与 MenuCategory 混淆）
     */
    type ClientType = 'PC' | 'MOBILE' | 'MANAGE' | 'ALL';

    type MenuButton = {
      /**
       * button code
       *
       * it can be used to control the button permission
       */
      code: string;
      /** button description */
      desc: string;
    };

    /**
     * icon type
     *
     * 对应后端 IconType，同样以枚举名序列化
     *
     * - "ICONIFY": iconify icon
     * - "LOCAL": local icon
     */
    type IconType = 'ICONIFY' | 'LOCAL';

    type MenuPropsOfRoute = Pick<
      import('vue-router').RouteMeta,
      | 'i18nKey'
      | 'keepAlive'
      | 'constant'
      | 'order'
      | 'href'
      | 'hideInMenu'
      | 'activeMenu'
      | 'multiTab'
      | 'fixedIndexInTab'
      | 'query'
    >;

    type Menu = Common.CommonRecord<{
      /** 父级菜单 id，顶层菜单为 null（后端 @JsonInclude(NON_NULL) 下表现为字段缺失） */
      parentId?: string | null;
      /** 菜单排序（后端字段为 orderNum） */
      orderNum?: number;
      /** 菜单类别（对应后端 menuCategory） */
      menuCategory: MenuCategory;
      /** 菜单状态（对应后端 menuStatus） */
      menuStatus: MenuStatus;
      /** menu name */
      menuName: string;
      /** route name */
      routeName: string;
      /** route path */
      routePath: string;
      /** component */
      component?: string;
      /** 请求地址（后端字段 url） */
      url?: string;
      /** 客户端类型 */
      clientType?: ClientType;
      /** 路由 query 参数（后端以 JSON 字符串收发） */
      routeQuery?: string;
      /** 备注 */
      remark?: string;
      /** iconify icon name or local icon name */
      icon: string;
      /** icon type */
      iconType: IconType;
      /** buttons */
      buttons?: MenuButton[] | null;
      /** children menu */
      children?: Menu[];
    }> &
      MenuPropsOfRoute;

    /** menu list */
    type MenuList = Common.PaginatingQueryRecord<Menu>;

    /**
     * 菜单分页查询参数（对应后端 SysMenuPageParam）
     *
     * 后端仅在显式传入 parentId 时按父级过滤，缺省查询全部层级的菜单。
     *
     * hideInMenu 在后端为 Boolean，但 antd 的 SelectValue 不接受布尔值，
     * 故前端以 "Y"/"N" 表达，由 fetchGetMenuList 提交前转换。
     */
    type MenuSearchParams = Partial<Common.CommonSearchParams> & {
      /** 关键词：模糊匹配菜单名称 / 路由名称 */
      keyword?: string;
      /** 菜单类别 */
      menuCategory?: MenuCategory;
      /** 菜单状态 */
      menuStatus?: MenuStatus;
      /** 是否隐藏菜单（提交时转换为后端的 hideInMenu 布尔值） */
      hideInMenu?: CommonType.YesOrNo;
      /** 客户端类型 */
      clientType?: ClientType;
      /** 父级菜单 id */
      parentId?: string;
    };

    /**
     * 菜单树形下拉数据（对应后端 SysMenuTreeVO）
     *
     * 后端返回的是**已嵌套**的结构（children 里带子孙），且只有 menuName 没有 label，
     * 也没有 pId —— 层级完全由 children 表达。
     */
    type MenuTree = {
      id: string;
      menuName: string;
      /** 路由 name，后端可能不返回 */
      routeName?: string;
      children?: MenuTree[];
    };

    /**
     * config value type
     *
     * 对应后端 ConfigValueType。该枚举带 @JsonValue，以数字码的字符串形式
     * 收发（"1"/"2"），与 MenuStatus / DictTypeEnum 的枚举名序列化不同
     *
     * - "1": "text"
     * - "2": "file"
     */
    type ConfigValueType = '1' | '2';

    /** system config */
    type SysConfig = Common.CommonRecord<{
      /** 配置名称（后端字段 configName） */
      configName: string;
      /** 配置编码（后端字段 configCode） */
      configCode: string;
      /** config value */
      configValue: string;
      /** value type */
      valueType: ConfigValueType;
      /** 启用状态：后端为 Boolean，而非 EnableStatus */
      configStatus?: boolean;
      /** remark */
      remark?: string;
    }>;

    /**
     * sys config search params（对应后端 SysConfigPageParam）
     *
     * configStatus 在后端为 Boolean，但 antd 的 SelectValue 不接受布尔值，
     * 故前端以 "Y"/"N" 表达，由 fetchGetConfigList 提交前转换。
     */
    type SysConfigSearchParams = Partial<
      Pick<SysConfig, 'configName' | 'configCode' | 'valueType'> & Common.CommonSearchParams
    > & {
      /** 启用状态（提交时转换为后端的 configStatus 布尔值） */
      configStatus?: CommonType.YesOrNo;
    };

    /** sys config list */
    type SysConfigList = Common.PaginatingQueryRecord<SysConfig>;

    /** storage config */
    type StorageConfig = Common.CommonRecord<{
      /** config name */
      configName: string;
      /** storage type: S3/LOCAL */
      storageType: 'S3' | 'LOCAL';
      /** endpoint */
      endpoint?: string;
      /** access key */
      accessKey?: string;
      /** secret key */
      secretKey?: string;
      /** bucket name */
      bucketName?: string;
      /** region */
      region?: string;
      /** path style access */
      pathStyleAccess?: boolean;
      /** local base path */
      localBasePath?: string;
      /** public endpoint */
      publicEndpoint?: string;
      /** is default */
      isDefault: boolean;
      /** config status: 1 enabled, 0 disabled */
      configStatus: 0 | 1;
      /** remark */
      remark?: string;
    }>;

    /** storage config search params */
    type StorageConfigSearchParams = Partial<
      Pick<StorageConfig, 'configName' | 'storageType' | 'configStatus'> & Common.CommonSearchParams
    >;

    /** storage config list */
    type StorageConfigList = Common.PaginatingQueryRecord<StorageConfig>;

    /** i18n messages response */
    type I18nMessages = {
      /** language code */
      lang: string;
      /** message map */
      messages: Record<string, string>;
    };

    /** i18n message record */
    /**
     * i18n message（对应后端 SysI18nMessageVO）
     *
     * 所属模块以 moduleCode 下发（后端另有 moduleId）；此前前端写的是
     * moduleName，该字段后端并不存在，导致「所属模块」列恒为空。
     */
    type I18nMessage = Common.CommonRecord<{
      /** language（后端用下划线格式：zh_CN / en_US） */
      lang: I18nLang;
      /** module id */
      moduleId: string;
      /** 模块编码（后端字段 moduleCode） */
      moduleCode?: string;
      /** message key */
      msgKey: string;
      /** message value */
      msgValue: string;
      /** description */
      description?: string;
      /** message status */
      msgStatus: boolean;
    }>;

    /**
     * 国际化语言标识
     *
     * 后端 sys_i18n_message.lang 用下划线格式存储，与前端 locale 的
     * `zh-CN` 连字符格式不同，勿混用
     */
    type I18nLang = 'zh_CN' | 'en_US';

    /** i18n message search params */
    /**
     * i18n message search params（对应后端 SysI18nPageParam）
     *
     * msgStatus 在后端为 Boolean，但 antd 的 SelectValue 不接受布尔值，
     * 故前端以 "Y"/"N" 表达，由 fetchGetI18nMessageList 提交前转换。
     */
    type I18nMessageSearchParams = Partial<
      Pick<I18nMessage, 'lang' | 'moduleId' | 'msgKey'> & Common.CommonSearchParams
    > & {
      /** 状态（提交时转换为后端的 msgStatus 布尔值） */
      msgStatus?: CommonType.YesOrNo;
    };

    /** i18n message operate params（新增/修改覆盖） */
    type I18nMessageOperateParams = Partial<
      Pick<I18nMessage, 'lang' | 'msgKey' | 'msgValue' | 'description' | 'msgStatus'>
    > & {
      /**
       * 所属模块
       *
       * 覆盖模型下唯一性是 (lang, msgKey)，模块不参与，前端一律传 null。
       * 字段保留仅为兼容后端参数（SysI18nCreateParam.moduleId 可选）。
       */
      moduleId?: string | null;
    };

    /**
     * 国际化管理页的查询条件
     *
     * 注意这一页的数据源是「前端语言文件（基线）+ 后端覆盖」，不是后端分页接口，
     * 因此这些条件只在客户端生效。
     */
    type I18nManageSearchParams = Partial<Common.CommonSearchParams> & {
      /** 语言 */
      lang?: I18nLang;
      /** 关键词：匹配消息键或值 */
      keyword?: string;
      /** 命名空间（system / common / route / page） */
      namespace?: string;
      /** 只看已覆盖 */
      onlyOverridden?: CommonType.YesOrNo;
    };

    /** i18n message list */
    type I18nMessageList = Common.PaginatingQueryRecord<I18nMessage>;

    /** sys module record */
    /**
     * sys module（对应后端 SysModuleVO）
     *
     * 字段名以**后端为准**：排序是 orderNum（不是 sort）、
     * 状态是 moduleStatus（不是 state）。此前前端两者都写错，
     * 导致列表的排序/状态列恒为空。
     */
    type SysModule = Common.CommonRecord<{
      /** parent id（Long 经 LongJsonComponent 序列化为字符串） */
      parentId?: string | null;
      /** module name */
      moduleName: string;
      /** module code */
      moduleCode: string;
      /** sort order（后端字段 orderNum） */
      orderNum?: number;
      /** 状态（后端字段 moduleStatus） */
      moduleStatus?: boolean;
    }>;

    /**
     * sys module search params（对应后端 SysModulePageParam）
     *
     * moduleStatus 在后端为 Boolean，但 antd 的 SelectValue 不接受布尔值，
     * 故前端以 "Y"/"N" 表达，由 fetchGetSysModuleList 提交前转换。
     */
    type SysModuleSearchParams = Partial<Pick<SysModule, 'moduleName' | 'moduleCode'> & Common.CommonSearchParams> & {
      /** 状态（提交时转换为后端的 moduleStatus 布尔值） */
      moduleStatus?: CommonType.YesOrNo;
    };

    /** sys module operate params（新增/修改模块） */
    type SysModuleOperateParams = Partial<
      Pick<Api.SystemManage.SysModule, 'parentId' | 'moduleName' | 'moduleCode' | 'orderNum' | 'moduleStatus'>
    >;

    /** sys module list */
    type SysModuleList = Common.PaginatingQueryRecord<SysModule>;

    /** dict */
    type Dict = Common.CommonRecord<{
      /** dict code */
      dictCode: string;
      /** dict name */
      dictName: string;
      /** 字典类型（后端字段为 type） */
      type: DictTypeEnum;
      /** description */
      description?: string;
    }>;

    /**
     * dict type
     *
     * 对应后端 DictTypeEnum，JSON 中以枚举名序列化
     *
     * - "NUMBER": 数值类型
     * - "STRING": 字符串类型
     */
    type DictTypeEnum = 'NUMBER' | 'STRING';

    /** dict search params（后端 SysDictPageParam：dictName / description / type） */
    type DictSearchParams = Partial<Pick<Dict, 'dictName' | 'description' | 'type'> & Common.CommonSearchParams>;

    /** dict list */
    type DictList = Common.PaginatingQueryRecord<Dict>;

    /** dict item */
    type DictItem = Common.CommonRecord<{
      /** 所属字典 id */
      dictId: string;
      /** 字典项名称（后端字段 itemName） */
      itemName: string;
      /** 字典项编码（后端字段 itemCode） */
      itemCode: string;
      /** 排序（后端字段 orderNum） */
      orderNum?: number;
      /** 是否启用：后端为 Boolean，而非 EnableStatus */
      enable?: boolean;
      /** description */
      description?: string;
    }>;

    /** dict item search params（后端 SysDictItemPageParam：dictId / itemName / description） */
    type DictItemSearchParams = Partial<
      Pick<DictItem, 'dictId' | 'itemName' | 'description'> & Common.CommonSearchParams
    >;

    /** dict item list */
    type DictItemList = Common.PaginatingQueryRecord<DictItem>;

    /** region */
    /**
     * region（对应后端 SysRegionVO）
     *
     * 注意：行政区域**没有 status 字段**（后端 VO / CreateParam / PageParam 均无），
     * 此前前端的 status 列与筛选器是虚构的，必然渲染为空。
     * 层级关系用 parentCode（区域编码）而非 parentId。
     */
    type Region = Common.CommonRecord<{
      /** 区域编码 */
      regionCode: string;
      /** 区域名称 */
      regionName: string;
      /** 上级区域编码 */
      parentCode?: string;
      /**
       * 上级区域名称
       *
       * 非表字段，后端 `SysRegionManagerImpl#getPage` 按当前页的 parentCode 批量回填。
       * 顶级区域的 parentCode 是哨兵 "0"，此处为空，由页面显示为「顶级区域」。
       */
      parentName?: string;
      /** 上级链路（逗号分隔的区域编码） */
      parents?: string;
      /** 备注 */
      remark?: string;
      /** 区域类型 */
      regionType?: string;
      /** 区域面积（NUMERIC(20,6)，非 Long，按数字下发） */
      regionArea?: number;
      /** 区域人口（Long，经 LongJsonComponent 序列化为字符串） */
      regionPeopleNumber?: string;
      /** 区域层级 */
      regionLevel?: number;
      /** 区域负责人 */
      regionLeader?: string;
      /** 扩展字段（Long，经 LongJsonComponent 序列化为字符串） */
      extend?: string;
      /** 经度 */
      longitude?: number;
      /** 纬度 */
      latitude?: number;
      /** 边界：左/右/下/上 */
      boundLeft?: number;
      boundRight?: number;
      boundBottom?: number;
      boundTop?: number;
      /** GIS 对象 id（Long，经 LongJsonComponent 序列化为字符串） */
      gisOid?: string;
      /** 排序 */
      orderNum?: number;
      /** 子节点数量 */
      subNum?: number;
      /**
       * 子区域
       *
       * 只有 `/sys/region/tree/list` 会下发（后端 `SysRegionVO.children`，
       * 且 `@JsonInclude(NON_NULL)` 下空集合仍会序列化成 `[]`）；
       * 分页接口 `/sys/region/page` 不带该字段。
       */
      children?: Region[];
    }>;

    /** region search params（对应后端 SysRegionPageParam） */
    type RegionSearchParams = Partial<
      Pick<Region, 'regionCode' | 'regionName' | 'parentCode' | 'parents' | 'regionType' | 'regionLeader'> &
        Common.CommonSearchParams
    >;

    /** region operate params（新增/修改区域） */
    type RegionOperateParams = Partial<
      Pick<
        Region,
        | 'regionCode'
        | 'regionName'
        | 'parentCode'
        | 'parents'
        | 'remark'
        | 'regionType'
        | 'regionArea'
        | 'regionPeopleNumber'
        | 'regionLevel'
        | 'regionLeader'
        | 'extend'
        | 'longitude'
        | 'latitude'
        | 'boundLeft'
        | 'boundRight'
        | 'boundBottom'
        | 'boundTop'
        | 'gisOid'
        | 'orderNum'
      >
    >;

    /** region list */
    type RegionList = Common.PaginatingQueryRecord<Region>;

    /** operation */
    /**
     * operation（对应后端 SysOperationVO）
     *
     * 注意：后端 VO 不提供菜单名（只有 menuId），故不设 menuName 列；
     * 若需要展示菜单名，需后端在分页查询里 join sys_menu。
     *
     * opType / opStatus 对应的后端枚举均未标注 @JsonValue，
     * 因此 JSON 与查询参数都按**枚举名**收发（BUTTON / ENABLED），不是数字码。
     */
    type Operation = Common.CommonRecord<{
      /** operation name */
      opName: string;
      /** permission code */
      permCode: string;
      /** 所属菜单 id（Long 经 LongJsonComponent 序列化为字符串） */
      menuId?: string | null;
      /** 操作类型 */
      opType: OperationType;
      /** api method */
      apiMethod?: string;
      /** api path */
      apiPath?: string;
      /** icon (button only) */
      icon?: string;
      /** sort order */
      orderNum?: number;
      /** auto scan */
      autoScan?: boolean;
      /** 状态 */
      opStatus: OperationStatus;
    }>;

    /**
     * 操作类型
     *
     * 对应后端 OperationType（BUTTON / API），按枚举名序列化
     */
    type OperationType = 'BUTTON' | 'API';

    /**
     * 操作状态
     *
     * 对应后端 OperationStatus（DISABLED / ENABLED），按枚举名序列化。
     * 注意与 {@link Common.EnableStatus} 不同：此处 0 为禁用，而 EnableStatus 以 2 表示禁用
     */
    type OperationStatus = 'ENABLED' | 'DISABLED';

    /** operation search params（对应后端 SysOperationPageParam） */
    type OperationSearchParams = Partial<
      Pick<Operation, 'opName' | 'permCode' | 'menuId' | 'opType' | 'apiPath' | 'opStatus'> & Common.CommonSearchParams
    >;

    /** operation operate params（新增/修改操作） */
    type OperationOperateParams = Partial<
      Pick<
        Operation,
        | 'menuId'
        | 'opName'
        | 'permCode'
        | 'opType'
        | 'apiMethod'
        | 'apiPath'
        | 'icon'
        | 'orderNum'
        | 'autoScan'
        | 'opStatus'
      >
    >;

    /** operation list */
    type OperationList = Common.PaginatingQueryRecord<Operation>;

    /**
     * 移动操作所属菜单的入参（POST /sys/operation/move）
     *
     * menuId 省略或 null 表示移到「独立接口」（DB 中 menu_id 置 NULL）
     */
    type OperationMoveParams = { id: string } & Pick<OperationOperateParams, 'menuId'>;

    /**
     * 操作树（对应后端 SysOperationTreeVO，GET /sys/operation/tree）
     *
     * 按 menuId 分组返回全部操作（扁平不分页）。menuId 为 "0" 的组是未挂菜单的
     * 独立接口，其 menuName 固定为「独立接口」；其余组的 menuName 为 null，
     * 菜单名由前端菜单树提供。
     */
    type OperationTree = {
      /** 所属菜单 id（Long 序列化为字符串，"0" 表示独立接口组） */
      menuId: string;
      /** 菜单名（仅独立接口组有值） */
      menuName?: string | null;
      /** 该菜单下的操作 */
      operations: Operation[];
    };

    /**
     * 上传记录（对应后端 UploadRecordVO，即 /sys/file/page 的行）
     *
     * 字段名以**后端为准**。此前前端用的是 fileName / fileType / fileUrl /
     * namespace 等，这些字段后端一个都没有，整个表格除 fileSize 外全部渲染为空。
     */
    type UploadRecord = Common.CommonRecord<{
      /** 分组 id（同一批上传的文件共享） */
      groupId?: string;
      /** 存储库名称（S3 bucket 或本地目录） */
      repositoryName?: string;
      /** 存储库地址 */
      repositoryUrl?: string;
      /** 原文件名 */
      originalName?: string;
      /** 用途 */
      uses?: string;
      /** 上传状态 */
      uploadStatus?: string;
      /** 文件大小（字节） */
      fileSize?: number;
      /** MIME 类型 */
      contentType?: string;
      /** 文件扩展名 */
      fileExtension?: string;
      /** 存储类型：S3 / LOCAL */
      storageType?: string;
    }>;

    /**
     * 文件信息（对应后端 FileInfoVO）
     *
     * 注意与 {@link UploadRecord} 是两个不同的 VO：这个用于上传返回值与详情接口
     */
    type FileInfo = Common.CommonRecord<{
      /** 分组 id */
      groupId?: string;
      /**
       * 文件名
       *
       * 后端两条路径填的都是**原始文件名**（FileService#uploadMultipartFile 取 MultipartFile#getOriginalFilename，
       * getFileInfo 取 upload_record.original_name），不是存储对象名 —— 可直接用于列表展示与下载命名
       */
      name?: string;
      /** 访问地址 */
      url?: string;
      /** base64（部分场景返回） */
      base64?: string;
      /** 文件大小（字节） */
      fileSize?: number;
      /** MIME 类型 */
      contentType?: string;
      /** 文件扩展名 */
      fileExtension?: string;
    }>;

    /** file search params（对应后端 UploadRecordPageParam） */
    type FileSearchParams = Partial<
      Pick<UploadRecord, 'originalName' | 'uses' | 'fileExtension' | 'storageType'> & Common.CommonSearchParams
    >;

    /** file list */
    type FileList = Common.PaginatingQueryRecord<UploadRecord>;

    /** upload result（对应后端 UploadResultVO） */
    type UploadResult = {
      /** 分组 id */
      groupId?: string;
      /** 本次上传的文件 */
      files?: FileInfo[];
    };

    /** file statistics */
    type FileStatistics = {
      /** total files */
      totalFiles: number;
      /** total size */
      totalSize: number;
      /** today uploads */
      todayUploads: number;
    };

    /**
     * 公告类型
     *
     * 对应后端 SysNewsTypeEnum（@EnumValue Integer），JSON 下发为数字
     */
    type NewsType = '1' | '2' | '3';

    /**
     * 公告发布范围
     *
     * 对应后端 SysNewsScopeEnum：1-全员 2-指定角色
     */
    type NewsScope = '1' | '2';

    /**
     * 公告状态
     *
     * 对应后端 SysNewsStatusEnum：1-草稿 2-已发布 3-已下线
     */
    type NewsStatus = '1' | '2' | '3';

    /**
     * 公告（对应后端 SysNewsVO）
     *
     * 注意：列表接口不下发 content 大字段（后端 select 白名单排除），
     * 编辑/查看详情走 /sys/news/detail。
     */
    type News = Common.CommonRecord<{
      /** 标题 */
      title: string;
      /** 类型 */
      newsType: NewsType;
      /** 类型名称（后端枚举 desc 下发） */
      newsTypeName?: string;
      /** 内容（仅详情接口返回） */
      content?: string;
      /** 发布范围 */
      publishScope: NewsScope;
      /** 发布范围名称 */
      publishScopeName?: string;
      /** 指定角色的角色ID JSON 数组字符串（publishScope=2 时有效） */
      scopeRoleIds?: string;
      /** 是否置顶 */
      isTop?: boolean;
      /** 状态 */
      status: NewsStatus;
      /** 状态名称 */
      statusName?: string;
      /** 发布时间（LocalDateTime 原样 ISO 下发） */
      publishTime?: string;
      /** 过期时间 */
      expireTime?: string;
      /** 是否已读（仅用户端 my/page 填充） */
      isRead?: boolean;
    }>;

    /** news search params（对应后端 SysNewsPageParam） */
    type NewsSearchParams = Partial<Pick<News, 'title' | 'newsType' | 'status'>> & Common.CommonSearchParams;

    /** news list */
    type NewsList = Common.PaginatingQueryRecord<News>;

    /**
     * 通用收藏（对应后端 SysFavoriteVO）
     *
     * 按用户隔离；targetType 为业务类型（约定小写字母/数字/中划线，如 quick-nav、sys-news），
     * targetId 为业务侧不透明字符串（路由 key、公告 id 等）。
     */
    type Favorite = {
      id: string;
      targetType: string;
      targetId: string;
      sortNo: number;
      /** 收藏时间（yyyy-MM-dd HH:mm:ss） */
      createTime: string;
    };

    /** favorite search params（收藏管理页查询条件，前端本地过滤） */
    type FavoriteSearchParams = {
      targetType?: string;
      keyword?: string;
    };

    /** news operate params（新增/修改公告，对应后端 SysNewsCreateParam/SysNewsUpdateParam） */
    type NewsOperateParams = {
      /** 公告 id（修改时必传，Long 字符串） */
      id?: string;
      title: string;
      newsType: NewsType;
      content: string;
      publishScope: NewsScope;
      /** 指定角色的角色ID 数组（publishScope=2 时必填；注意是数组，后端负责序列化为 JSON） */
      scopeRoleIds?: string[];
      isTop?: boolean;
      expireTime?: string;
    };

    /** my news search params（用户端，对应后端 SysNewsMyPageParam） */
    type NewsMySearchParams = {
      current?: number;
      size?: number;
      newsType?: NewsType;
      /** 仅看未读 */
      onlyUnread?: boolean;
    };

    // ============================================================
    // 编码规则  /sys/sequence（S5 序列号生成器）
    // ============================================================

    /**
     * 重置周期
     *
     * 对应后端 SequenceResetCycleEnum（@EnumValue Integer），JSON 下发为数字。
     * 注意：是数字编码，不能用 transformRecordToOption 生成选项（会把键转成字符串导致失配）。
     */
    type SequenceResetCycle = 1 | 2 | 3 | 4;

    /**
     * 日期段格式
     *
     * 对应后端 SequenceDatePatternEnum（BaseEnum&lt;String&gt;），JSON 下发为字符串。
     * 空串 / 不传表示编码中不含日期段（此时 resetCycle 只能是 1）。
     */
    type SequenceDatePattern = 'yyyy' | 'yyyyMM' | 'yyyyMMdd' | 'yyyyMMddHH' | 'yyyyMMddHHmmss';

    /** 编码规则（对应后端 SysSequenceRuleVO） */
    type SequenceRule = Common.CommonRecord<{
      /** 规则编码（业务标识，如 order_no；创建后不可修改） */
      ruleCode: string;
      /** 规则名称 */
      ruleName: string;
      /** 编码前缀（列可空，且 VO 带 @JsonInclude(NON_NULL) ⇒ 为空时该 key 直接消失） */
      prefix?: string | null;
      /** 日期段格式（空串 / 缺省表示不含日期段） */
      datePattern?: SequenceDatePattern | null;
      /** 日期段与流水之间的分隔符（DDL NOT NULL DEFAULT ''，恒存在） */
      separator: string | null;
      /** 流水位数（左补零） */
      seqLength: number;
      /** 单次自增步长 */
      step: number;
      /** 重置周期（数字编码） */
      resetCycle: SequenceResetCycle;
      /** 重置周期名称（后端下发；前端优先走本地 i18n 字典，此字段未使用） */
      resetCycleName: string;
      /**
       * 数据库兜底计数水位（真相源在 Redis，展示可能滞后一次生成）
       *
       * ⚠️ 后端类型是 `Long`，框架全局 `longToString = true` ⇒ JSON 里是**字符串**
       * （与 `CommonRecord.id` 同一约定），不要当数字用。
       */
      currentValue?: string;
      /** 兜底计数所属日期段 */
      currentPeriod: string | null;
    }>;

    /** sequence rule search params（对应后端 SysSequenceRulePageParam） */
    type SequenceRuleSearchParams = Partial<Pick<SequenceRule, 'ruleCode' | 'ruleName'>> & Common.CommonSearchParams;

    /** sequence rule list（对应后端 Paging&lt;SysSequenceRuleVO&gt;） */
    type SequenceRuleList = Common.PaginatingQueryRecord<SequenceRule>;

    /** sequence rule operate params（新增/修改编码规则） */
    type SequenceRuleOperateParams = {
      /** 规则 id（修改时必传，Long 字符串） */
      id?: string;
      /** 规则编码（修改时后端忽略该字段，前端应只读） */
      ruleCode: string;
      ruleName: string;
      /** 前缀；修改时传空串表示清空（null 会被后端忽略） */
      prefix?: string;
      /** 日期段格式；传空串表示不含日期段 */
      datePattern?: SequenceDatePattern | '';
      /** 分隔符；修改时传空串表示清空 */
      separator?: string;
      seqLength: number;
      step: number;
      resetCycle: SequenceResetCycle;
    };
  }

  /**
   * namespace Organization
   *
   * backend api module: "carlos-org"
   * 网关路由 /org/** -> lb://carlos-org，外部访问路径为 /manage-api/org/**
   */
  namespace Organization {
    // ============================================================
    // 角色  /org/role
    // ============================================================

    /** role */
    type Role = Common.CommonRecord<{
      /** role name */
      roleName: string;
      /** role code */
      roleCode: string;
      /** role description */
      description?: string;
      /** 角色状态，0：禁用，1：启用（对应后端 OrgRoleStateEnum） */
      roleStatus: OrgRoleState;
      /** 角色状态名称，由后端下发 */
      roleStatusName?: string;
    }>;

    /**
     * role status
     *
     * 对应后端 OrgRoleStateEnum，注意与 {@link Common.EnableStatus} 不同：
     * 此处 0 为禁用，而 EnableStatus 以 2 表示禁用
     *
     * - "0": disabled
     * - "1": enabled
     */
    type OrgRoleState = '0' | '1';

    /** role search params */
    type RoleSearchParams = Partial<Pick<Role, 'roleName' | 'roleCode' | 'roleStatus'> & Common.CommonSearchParams>;

    /** role list */
    type RoleList = Common.PaginatingQueryRecord<Role>;

    // ============================================================
    // 用户  /org/user
    // ============================================================

    /**
     * user gender
     *
     * 对应后端 OrgUserGenderEnum
     *
     * - "0": "unknown"
     * - "1": "male"
     * - "2": "female"
     */
    type UserGender = '0' | '1' | '2';

    /**
     * user status
     *
     * 对应后端 OrgUserStateEnum，注意与 {@link Common.EnableStatus} 不同：
     * 此处 0 为禁用、2 为锁定，而 EnableStatus 以 2 表示禁用
     *
     * - "0": disabled
     * - "1": enabled
     * - "2": locked
     */
    type UserStatus = '0' | '1' | '2';

    /** user（对应后端 OrgUserVO） */
    type User = Common.CommonRecord<{
      /** 用户名（后端字段为 account） */
      account: string;
      /** 昵称（后端字段为 nickname） */
      nickname: string;
      /** 身份证号（后端字段为 identify） */
      identify?: string;
      /** 手机号（后端字段为 phone） */
      phone?: string;
      /** 联系地址（后端字段为 address） */
      address?: string;
      /** user gender */
      gender?: UserGender;
      /** 邮箱（后端字段为 email） */
      email?: string;
      /** 头像访问地址（后端字段为 avatar，存的是上传后返回的 url） */
      avatar?: string;
      /** 个人简介（后端字段为 description） */
      description?: string;
      /** 用户状态（后端字段为 userStatus） */
      userStatus?: UserStatus;
      /** 用户状态名称，由后端下发 */
      userStatusName?: string;
      /** 主部门 id */
      mainDeptId?: string;
      /** 最后登录时间（ISO-8601，后端 LocalDateTime 无全局格式器） */
      loginTime?: string;
      /** 最后登录 ip */
      loginIp?: string;
      /** 登录次数 */
      loginCount?: number;
      /** 密码最后修改时间 */
      pwdLastModify?: string;
      /** 用户角色编码集合 */
      userRoles?: string[];
    }>;

    /**
     * 个人中心 —— 修改本人资料
     *
     * 与 {@link UserOperateParams}（管理端新增/修改用户）刻意分开：
     * 管理端参数含 account / userStatus / mainDeptId / pwd 等，普通用户自助修改时
     * **不得**提交这些字段（改自己的登录名或状态是越权面）。
     * 两者最终都打同一个 `/org/user/update`，但载荷字段集必须不同。
     */
    type ProfileOperateParams = Pick<
      User,
      'nickname' | 'phone' | 'email' | 'gender' | 'address' | 'avatar' | 'description'
    >;

    /** user search params */
    type UserSearchParams = Partial<
      Pick<User, 'account' | 'gender' | 'nickname' | 'phone' | 'email' | 'userStatus'> & Common.CommonSearchParams
    >;

    /** user list */
    type UserList = Common.PaginatingQueryRecord<User>;

    /**
     * 用户导入 Excel 行（对应后端 `OrgUserExcel`）
     *
     * 字段与 Excel 列一一对应；`error` 由后端在预览校验后回填（多条用「；」分隔），
     * 为空即代表该行可导入。
     *
     * ⚠️ `department` / `role` 两列在导入模板里存在，但后端 `confirmImportUser`
     * **完全不读取它们**（只取 account / nickname / phone / email）——
     * 用户填了会被静默丢弃。若要支持，需要后端补角色/部门解析逻辑。
     */
    type UserExcel = {
      account?: string;
      nickname?: string;
      phone?: string;
      gender?: string;
      email?: string;
      department?: string;
      role?: string;
      /** 校验失败原因，空串/未设即通过 */
      error?: string;
    };

    /** user operate params（新增/修改用户） */
    type UserOperateParams = Partial<
      Pick<User, 'account' | 'nickname' | 'phone' | 'email' | 'gender' | 'mainDeptId'>
    > & {
      /** 密码（新增时必填，SM2 加密后） */
      pwd?: string;
      /** 用户状态 */
      userStatus?: UserStatus;
    };

    /**
     * 用户已绑定角色（对应后端 OrgUserRoleVO）
     *
     * 后端 `/org/user/roles` 走管理面语义（`listAllByUserId`)，**会返回已过期的授权**,
     * 前端必须用 expireTime 区分展示,不能把过期授权和有效授权渲染成一样。
     */
    type UserRole = {
      roleId: string;
      roleName: string;
      roleCode: string;
      /** 授权失效时间（日期时间字符串），空表示长期有效 */
      expireTime?: string;
      /** 授权生效的部门范围（ADR-002 作用域），空表示全局 */
      deptId?: string;
    };

    /**
     * 用户已分配部门（对应后端 OrgUserDeptVO）
     *
     * ⚠️ 字段名是 `departmentId`，而不是关联表 DTO 里的 `deptId` —— 后端这两个类用了不同的名字，别混用。
     */
    type UserDept = {
      departmentId: string;
      departmentName: string;
      /** 是否主部门 */
      isMain?: boolean;
    };

    /**
     * 用户已分配岗位（对应后端 OrgUserPositionVO）
     *
     * 该 VO 有 26 个字段（任命日期、试用期、成本比例、汇报关系、薪级…），
     * 此处收敛为用户详情实际展示的几个。后端 `getUserPositions` 会补全
     * `positionName` / `positionCode` / `levelName` / `departmentName`。
     */
    type UserPosition = {
      /** 岗位名称 */
      positionName?: string;
      /** 岗位编码 */
      positionCode?: string;
      /** 职级名称 */
      levelName?: string;
      /** 所属部门名称 */
      departmentName?: string;
      /** 是否主岗 */
      main?: boolean;
    };

    /**
     * 任职变更类型（对应后端 org_position_history.change_type）
     *
     * 1 入职 / 2 晋升 / 3 降职 / 4 转岗 / 5 兼职 / 6 卸任 / 7 离职
     */
    type PositionChangeType = '1' | '2' | '3' | '4' | '5' | '6' | '7';

    /**
     * 任职变更历史（对应后端 OrgPositionHistoryVO）
     *
     * 此处只收敛展示用字段。VO 里 old/new 岗位/职级/部门均为 **ID**（未补全名称），
     * 前端不展示原始 ID；changeReason / operatorName 自 2026-09-22 后端 R-3 修复后
     * 才有值，更早的历史记录这两个字段可能为空（旧数据写入时未赋值）。
     */
    type PositionHistory = {
      id: string;
      /** 变更类型 */
      changeType: PositionChangeType;
      /** 变更原因 */
      changeReason?: string;
      /** 变更生效日期（yyyy-MM-dd） */
      changeDate?: string;
      /** 操作人姓名（无登录上下文写入时为 "system"） */
      operatorName?: string;
    };

    type PositionHistoryList = Common.PaginatingQueryRecord<PositionHistory>;

    // ============================================================
    // 部门  /org/department
    // ============================================================

    /**
     * 部门状态
     *
     * 对应后端 OrgDepartmentStateEnum
     *
     * - "0": disabled
     * - "1": enabled
     */
    type DeptStatus = '0' | '1';

    /** 部门（对应后端 OrgDepartmentVO，扁平结构） */
    type Department = Common.CommonRecord<{
      /** 上级部门 id，顶级为 0（后端类型为 Serializable） */
      parentId?: string;
      /** 部门名称 */
      deptName: string;
      /** 部门编码 */
      deptCode: string;
      /** 层级路径，如 1/12/156/ */
      path?: string;
      /** 负责人用户 id */
      leaderId?: string;
      /** 部门状态 */
      deptStatus?: DeptStatus;
      /** 排序号，同级升序 */
      orderNum?: number;
      /** 层级，从 1 开始 */
      level?: number;
      /** 部门描述 */
      description?: string;
    }>;

    /**
     * 部门树节点（对应后端 OrgDepartmentTreeVO）
     *
     * ⚠️ 树端点**不返回** createBy / createTime 等公共字段，但 useTable /
     * useTableOperate 要求行类型是 CommonRecord，故此处仍按 CommonRecord 声明
     * （与 Menu 一致）。这些字段在树数据上恒为 undefined，不要用来排序或展示。
     *
     * 同理，OrgDepartmentTreeVO 也没有 description，且部门模块没有 detail 端点，
     * 因此树页面无法回填描述 —— 描述字段只在「扁平分页」数据里存在。
     */
    type DepartmentTree = Common.CommonRecord<{
      /** 上级部门 id，顶级为 0（后端类型为 Serializable） */
      parentId?: string;
      /** 部门名称 */
      deptName: string;
      /** 部门编码 */
      deptCode: string;
      /** 层级路径，如 1/12/156/ */
      path?: string;
      /** 负责人用户 id */
      leaderId?: string;
      /** 部门状态 */
      deptStatus?: DeptStatus;
      /** 排序号，同级升序 */
      orderNum?: number;
      /** 层级，从 1 开始 */
      level?: number;
      children?: DepartmentTree[];
    }>;

    /** 部门查询参数（对应后端 OrgDepartmentPageParam） */
    type DepartmentSearchParams = Partial<Common.PaginatingCommonParams> & {
      /** 部门名称 / 编码关键词 */
      deptName?: string;
      /** 部门状态 */
      deptStatus?: DeptStatus;
      /** 指定上级部门 */
      parentId?: string;
    };

    /** 部门列表 */
    type DepartmentList = Common.PaginatingQueryRecord<Department>;

    /**
     * 部门新增/修改参数（对应后端 OrgDepartmentCreateParam / OrgDepartmentUpdateParam）
     *
     * 独立定义而不从 Department 上 Pick：后端入参与 OrgDepartmentVO 的字段集并不一致
     */
    type DepartmentOperateParams = {
      /** 上级部门 id，'0' 表示顶级 */
      parentId?: string;
      deptName: string;
      deptCode: string;
      leaderId?: string;
      orderNum?: number;
      description?: string;
    };

    /** 部门下用户（对应后端 OrgDepartmentUserVO） */
    type DepartmentUser = {
      userId: string;
      account: string;
      name?: string;
      gender?: UserGender;
      phone?: string;
      email?: string;
      userStatus?: UserStatus;
      /** 是否主部门 */
      mainDept?: boolean;
      /** 加入时间 */
      joinTime?: string;
    };

    // ============================================================
    // 岗位  /org/position
    // ============================================================

    /**
     * 岗位类别（对应后端 OrgPositionVO.positionType，后端为 Integer 数字码）
     *
     * - "1": 标准岗
     * - "2": 虚拟岗
     * - "3": 兼职岗
     */
    type PositionType = '1' | '2' | '3';

    /**
     * 岗位性质
     *
     * - "1": 全职
     * - "2": 兼职
     * - "3": 实习
     * - "4": 外包
     */
    type PositionNature = '1' | '2' | '3' | '4';

    /**
     * 岗位状态
     *
     * 注意与 {@link Common.EnableStatus} 不同：此处 0 为禁用、2 为冻结
     *
     * - "0": 禁用
     * - "1": 启用
     * - "2": 冻结
     */
    type PositionStatus = '0' | '1' | '2';

    /** 岗位（对应后端 OrgPositionVO） */
    type Position = Common.CommonRecord<{
      /** 岗位编码 */
      positionCode: string;
      /** 岗位名称 */
      positionName: string;
      /** 岗位简称 */
      positionShort?: string;
      /** 所属职系 id */
      categoryId?: string;
      /** 默认职级 id */
      defaultLevelId?: string;
      /** 职级范围描述 */
      levelRange?: string;
      /** 岗位类别 */
      positionType?: PositionType;
      /** 岗位性质 */
      positionNature?: PositionNature;
      /** 所属部门 id */
      departmentId?: string;
      /** 上级岗位 id，0 表示无上级 */
      parentId?: string;
      /** 编制人数 */
      headcount?: number;
      /** 当前在岗人数，后端计算下发 */
      currentCount?: number;
      /** 空缺人数，后端计算下发 */
      vacancyCount?: number;
      /** 岗位职责 */
      duty?: string;
      /** 任职要求 */
      requirement?: string;
      /** 任职资格 */
      qualification?: string;
      /** KPI 指标 */
      kpiIndicator?: string;
      /** 成本中心 */
      costCenter?: string;
      /** 工作地点 */
      location?: string;
      /** 薪酬等级 */
      salaryGrade?: string;
      /** 岗位状态 */
      positionStatus?: PositionStatus;
    }>;

    /** 岗位查询参数（对应后端 OrgPositionPageParam） */
    type PositionSearchParams = Partial<
      Pick<
        Position,
        | 'positionCode'
        | 'positionName'
        | 'categoryId'
        | 'departmentId'
        | 'positionType'
        | 'positionNature'
        | 'positionStatus'
      > &
        Common.CommonSearchParams
    > & {
      /** 创建时间区间起止 */
      start?: string;
      end?: string;
    };

    /** 岗位列表 */
    type PositionList = Common.PaginatingQueryRecord<Position>;

    /** 岗位新增/修改参数（对应后端 OrgPositionCreateParam / OrgPositionUpdateParam） */
    type PositionOperateParams = Partial<
      Pick<
        Position,
        | 'positionCode'
        | 'positionName'
        | 'positionShort'
        | 'categoryId'
        | 'defaultLevelId'
        | 'levelRange'
        | 'positionType'
        | 'positionNature'
        | 'departmentId'
        | 'parentId'
        | 'headcount'
        | 'duty'
        | 'requirement'
        | 'qualification'
        | 'kpiIndicator'
        | 'costCenter'
        | 'location'
        | 'salaryGrade'
        | 'positionStatus'
      >
    >;

    /** 职系（对应后端 OrgPositionCategoryVO，/org/position/category） */
    type PositionCategory = Common.CommonRecord<{
      /** 职系编码 */
      categoryCode: string;
      /** 职系名称 */
      categoryName: string;
      /** 职系类型（后端 Integer 数字码） */
      categoryType?: number;
      /** 职系描述 */
      description?: string;
      /** 排序号 */
      orderNum?: number;
      /** 职系状态（后端 Integer 数字码） */
      positionCategoryStatus?: number;
    }>;

    /** 职系列表 */
    type PositionCategoryList = Common.PaginatingQueryRecord<PositionCategory>;

    /** 职级（对应后端 OrgPositionLevelVO，/org/position/level） */
    type PositionLevel = Common.CommonRecord<{
      /** 所属职系 id */
      categoryId?: string;
      /** 职级编码 */
      levelCode: string;
      /** 职级名称 */
      levelName: string;
      /** 职级序号 */
      levelSeq?: number;
      /** 职级分组 */
      levelGroup?: string;
      /** 职级描述 */
      description?: string;
      /** 职级状态（后端 Integer 数字码） */
      positionLevelStatus?: number;
    }>;

    /** 职级列表 */
    type PositionLevelList = Common.PaginatingQueryRecord<PositionLevel>;

    // ============================================================
    // 租户  /org/tenant（S2 租户管理）
    // ============================================================

    /**
     * tenant status
     *
     * 对应后端 OrgTenantStateEnum
     *
     * - "1": normal
     * - "2": disabled
     */
    type OrgTenantState = '1' | '2';

    /** tenant（对应后端 OrgTenantVO） */
    type Tenant = Common.CommonRecord<{
      /** 租户编码（登录时输入，创建后不可改） */
      tenantCode: string;
      /** 租户名称 */
      tenantName: string;
      /** 联系人 */
      contactName?: string;
      /** 联系电话 */
      contactPhone?: string;
      /** 租户状态（后端字段为 tenantStatus） */
      tenantStatus: OrgTenantState;
      /** 租户状态名称，由后端下发 */
      tenantStatusName?: string;
      /** 过期时间（ISO-8601，空表示永不过期） */
      expireTime?: string;
      /** 备注 */
      remark?: string;
    }>;

    /** tenant search params */
    type TenantSearchParams = Partial<
      Pick<Tenant, 'tenantCode' | 'tenantName' | 'tenantStatus'> & Common.CommonSearchParams
    >;

    /** tenant list */
    type TenantList = Common.PaginatingQueryRecord<Tenant>;

    /** tenant change status params */
    type TenantChangeStatusParams = {
      /** 租户 id（Long 字符串） */
      id: string;
      /** 目标状态 */
      tenantStatus: OrgTenantState;
    };

    /** tenant init admin params（为新租户初始化管理员账号） */
    type TenantInitAdminParams = {
      /** 租户 id（Long 字符串） */
      tenantId: string;
      /** 管理员账号 */
      account: string;
      /** 管理员昵称 */
      nickname: string;
      /** 初始密码（明文，服务端编码存储） */
      password: string;
      /** 手机号 */
      phone?: string;
    };
  }

  /**
   * namespace AppClient
   *
   * backend api module: "appClient"
   */
  namespace AppClient {
    /** oauth2 client settings */
    interface Oauth2ClientSettings {
      /** require proof key (PKCE) */
      requireProofKey?: boolean;
      /** require authorization consent */
      requireAuthorizationConsent?: boolean;
      /** jwk set url */
      jwkSetUrl?: string;
    }

    /** oauth2 token settings */
    interface Oauth2TokenSettings {
      /** authorization code time to live (minutes) */
      authorizationCodeTimeToLive?: number;
      /** access token time to live (minutes) */
      accessTokenTimeToLive?: number;
      /** access token format */
      accessTokenFormat?: 'self-contained' | 'reference';
      /** reuse refresh tokens */
      reuseRefreshTokens?: boolean;
      /** refresh token time to live (minutes) */
      refreshTokenTimeToLive?: number;
    }

    /** app client page record (collection fields are comma-joined strings) */
    type AppClientPageRecord = Common.CommonRecord<{
      /** app key */
      appKey: string;
      /** app name */
      appName: string;
      /** app logo */
      appLogo: string;
      /** client secret expires at */
      clientSecretExpiresAt?: string;
      /** client issued at */
      clientIssuedAt?: string;
      /** authentication methods, comma-joined */
      authenticationMethods?: string;
      /** authorization grant types, comma-joined */
      authorizationGrantTypes?: string;
      /** scopes, comma-joined */
      scopes?: string;
      /** redirect uris, comma-joined */
      redirectUris?: string;
      /** client status: 1 enabled, 2 disabled, 3 logged out */
      clientStatus?: string;
    }>;

    /** app client detail (collection fields are string arrays) */
    interface AppClientDetail {
      /** record id */
      id: string;
      /** app key */
      appKey: string;
      /** app name */
      appName: string;
      /** app logo */
      appLogo: string;
      /** app secret */
      appSecret?: string;
      /** client secret expires at */
      clientSecretExpiresAt?: string;
      /** client issued at */
      clientIssuedAt?: string;
      /** authentication methods */
      authenticationMethods?: string[];
      /** authorization grant types */
      authorizationGrantTypes?: string[];
      /** scopes */
      scopes?: string[];
      /** redirect uris */
      redirectUris?: string[];
      /** oauth2 client settings */
      clientSettings?: Oauth2ClientSettings;
      /** oauth2 token settings */
      tokenSettings?: Oauth2TokenSettings;
      /** client status: 1 enabled, 2 disabled, 3 logged out */
      clientStatus?: string | number;
      /** record creator */
      createBy?: string;
      /** record create time */
      createTime?: string;
      /** record updater */
      updateBy?: string;
      /** record update time */
      updateTime?: string;
    }

    /** app client simple record */
    interface AppClientSimple {
      /** record id */
      id: string;
      /** app key */
      appKey: string;
      /** app name */
      appName: string;
      /** app logo */
      appLogo?: string;
      /** app secret */
      appSecret?: string;
    }

    /** app client search params */
    type AppClientSearchParams = Partial<
      Pick<AppClientPageRecord, 'appKey' | 'appName' | 'clientSecretExpiresAt' | 'clientIssuedAt' | 'clientStatus'> &
        Common.CommonSearchParams
    >;

    /** app client page list */
    type AppClientList = Common.PaginatingQueryRecord<AppClientPageRecord>;

    /** app client create params */
    interface AppClientCreateParams {
      /** app name */
      appName: string;
      /** app logo */
      appLogo: string;
      /** app description */
      appDesc?: string;
      /** app type: 1 inner, 2 outer, 3 mobile */
      appType?: number;
      /** app category id */
      appCategoryId?: number;
      /** homepage url */
      homepageUrl?: string;
      /** display order */
      displayOrder?: number;
      /** portal visible */
      portalVisible?: boolean;
      /** client secret expires at */
      clientSecretExpiresAt?: string;
      /** client issued at */
      clientIssuedAt?: string;
      /** authentication methods */
      authenticationMethods: string[];
      /** authorization grant types */
      authorizationGrantTypes: string[];
      /** scopes */
      scopes?: string[];
      /** redirect uris */
      redirectUris?: string[];
      /** oauth2 client settings */
      clientSettings?: Oauth2ClientSettings;
      /** oauth2 token settings */
      tokenSettings?: Oauth2TokenSettings;
    }

    /** app client update params */
    interface AppClientUpdateParams extends AppClientCreateParams {
      /** record id */
      id: string;
      /** client status: 1 enabled, 2 disabled, 3 logged out */
      clientStatus?: string;
    }
  }

  /**
   * namespace AppCategory
   *
   * backend api module: "appCategory"
   */
  namespace AppCategory {
    /** app category */
    interface AppCategory {
      /** record id */
      id: string;
      /** category code */
      categoryCode: string;
      /** category name */
      categoryName: string;
      /** category icon */
      categoryIcon?: string;
      /** sort order */
      sortOrder?: number;
    }

    /** app category create params */
    type AppCategoryCreateParams = Pick<AppCategory, 'categoryCode' | 'categoryName'> &
      Partial<Pick<AppCategory, 'categoryIcon' | 'sortOrder'>>;

    /** app category update params */
    type AppCategoryUpdateParams = Partial<AppCategoryCreateParams> & Pick<AppCategory, 'id'>;
  }

  /**
   * Namespace Audit
   *
   * Backend api module: "audit" (carlos-audit)
   *
   * 数据源说明：
   * - 日志检索走 `/audit/log/query/**`，底层是 ClickHouse 热数据表 `audit_log_main_local`
   *   （不是 `/audit/log/main/page` 的 MyBatis 路径）
   * - 配置与归档记录走 `/audit/log/config/**`、`/audit/log/archive/record/**`
   *
   * 序列化约定（与后端 LongJsonComponent / 无全局 LocalDateTime 格式器相关）：
   * - 所有后端 `Long` 字段（含 id、统计计数、文件大小）序列化为 **字符串**
   * - 所有后端 `Integer` 字段（风险等级、耗时、批次序号等）序列化为 **数字**
   * - `LocalDateTime` 使用 Jackson 默认 ISO-8601（如 `2026-09-17T10:00:00`）
   * - 枚举字段（category / logStatus / principalType / authType / authProvider / bizChannel）
   *   在后端 DTO 中为 Java 枚举且无 `@JsonValue`，JSON 中以**枚举名**下发
   */
  namespace Audit {
    /** 日志大类，对应后端 AuditLogCategoryEnum */
    type LogCategory = 'SECURITY' | 'BUSINESS' | 'SYSTEM' | 'AUDIT';

    /** 日志状态，对应后端 AuditLogStatusEnum */
    type LogStatus = 'SUCCESS' | 'FAIL' | 'PENDING' | 'TIMEOUT' | 'PARTIAL_SUCCESS';

    /** 操作主体类型，对应后端 AuditLogPrincipalTypeEnum */
    type PrincipalType = 'USER' | 'SERVICE' | 'SYSTEM' | 'ANONYMOUS';

    /** 认证方式，对应后端 AuditLogAuthTypeEnum */
    type AuthType = 'PASSWORD' | 'SMS' | 'OAUTH2' | 'LDAP' | 'CERT' | 'QR_CODE' | 'FACE' | 'FINGERPRINT';

    /** 认证提供方，对应后端 AuditLogAuthProviderEnum */
    type AuthProvider = 'LOCAL' | 'WECHAT' | 'DINGTALK' | 'WECHAT_WORK' | 'FEISHU' | 'GITHUB' | 'GITLAB' | 'OTHER';

    /** 业务渠道，对应后端 AuditLogBizChannelEnum */
    type BizChannel = 'WEB' | 'APP' | 'MINI_PROGRAM' | 'OPEN_API' | 'DESKTOP' | 'H5' | 'BACKGROUND';

    /** 归档状态，对应后端 AuditLogArchiveStateEnum */
    type ArchiveState = 'ARCHIVING' | 'COMPLETED' | 'FAILED' | 'DELETED' | 'RESTORED';

    /** 归档存储类型，对应后端 AuditLogStorageTypeEnum */
    type ArchiveStorageType = 'OSS' | 'S3' | 'MINIO' | 'GRIDFS' | 'LOCAL' | 'DB';

    /**
     * 审计日志记录
     *
     * 对应后端 AuditLogMainDTO（约 89 个宽表字段），此处收敛为详情抽屉实际分组展示的字段。
     */
    interface LogRecord {
      id: string;
      /** 服务器时间，毫秒精度，ClickHouse 分区依据 */
      serverTime: string;
      /** 事件日期（冗余字段，用于分区） */
      eventDate: string;
      /** 客户端时间 */
      clientTime?: string;
      /** 事件实际发生时间 */
      eventTime?: string;
      /** 操作耗时(ms) */
      durationMs?: number;
      /** 日志大类 */
      category?: LogCategory;
      /** 日志类型，如 USER_LOGIN / ORDER_PAY / DATA_EXPORT */
      logType?: string;
      /** 风险等级 0-100 */
      riskLevel?: number;
      /** 日志状态 */
      logStatus?: LogStatus;
      /** 操作描述 */
      operation?: string;
      /** 操作主体ID */
      principalId?: string;
      /** 操作主体名称 */
      principalName?: string;
      /** 操作主体类型 */
      principalType?: PrincipalType;
      /** 租户ID */
      tenantId?: string;
      /** 部门ID */
      deptId?: string;
      /** 部门名称 */
      deptName?: string;
      /** 部门层级路径，如 1/12/156/ */
      deptPath?: string;
      /** 目标对象类型，如 ORDER/USER/CONFIG/DATA */
      targetType?: string;
      /** 目标对象ID */
      targetId?: string;
      /** 目标对象名称 */
      targetName?: string;
      /** 目标对象关键信息摘要(JSON) */
      targetSnapshot?: string;
      /** 业务结果码 */
      resultCode?: string;
      /** 结果描述 */
      resultMessage?: string;
      /** 客户端IP */
      clientIp?: string;
      /** 客户端端口 */
      clientPort?: number;
      /** 处理服务器IP */
      serverIp?: string;
      /** 浏览器 UA */
      userAgent?: string;
      /** 设备指纹 */
      deviceFingerprint?: string;
      /** 国家 */
      locationCountry?: string;
      /** 省份 */
      locationProvince?: string;
      /** 城市 */
      locationCity?: string;
      /** 认证方式 */
      authType?: AuthType;
      /** 认证提供方 */
      authProvider?: AuthProvider;
      /** 当前角色列表(JSON 数组) */
      roles?: string;
      /** 当前权限列表(JSON 数组) */
      permissions?: string;
      /** 业务渠道 */
      bizChannel?: BizChannel;
      /** 业务场景 */
      bizScene?: string;
      /** 业务订单号 */
      bizOrderNo?: string;
      /** 关联业务ID列表(JSON 数组) */
      relatedBizIds?: string;
      /** 涉及金额，精确到分 */
      monetaryAmount?: number;
      /** 流程实例ID */
      processId?: string;
      /** 批量操作批次号 */
      batchId?: string;
      /** 批次内序号，从 0 开始 */
      batchIndex?: number;
      /** 批次总数 */
      batchTotal?: number;
      /** 任务ID */
      taskId?: string;
      /** 审批人ID */
      approverId?: string;
      /** 审批意见 */
      approvalComment?: string;
      /** 是否有数据变更详情 */
      hasDataChange?: boolean;
      /** 实体类名 */
      entityClass?: string;
      /** 数据库表名 */
      tableName?: string;
      /** 变更摘要 */
      changeSummary?: string;
      /** 变更字段数量 */
      changedFieldCount?: number;
      /** 变更前完整数据(JSON) */
      oldData?: string;
      /** 变更后完整数据(JSON) */
      newData?: string;
      /** 全链路追踪ID */
      traceId?: string;
      /** 当前 Span ID */
      spanId?: string;
      /** 父 Span ID */
      parentSpanId?: string;
      /** 调用链路节点(JSON 数组) */
      tracePath?: string;
      /** 数据库查询次数 */
      dbQueryCount?: number;
      /** 数据库查询耗时(ms) */
      dbQueryTimeMs?: number;
      /** 外部接口调用次数 */
      externalCallCount?: number;
      /** 外部接口耗时(ms) */
      externalCallTimeMs?: number;
      /** 自定义指标(JSON) */
      customMetrics?: string;
      /** 应用名 */
      appName?: string;
      /** 应用版本 */
      appVersion?: string;
      /** 集群标识 */
      cluster?: string;
      /** 主机名 */
      hostName?: string;
      /** 附件数量 */
      attachmentCount?: number;
      /** 业务标签(JSON) */
      dynamicTags?: string;
      /** 业务扩展字段(JSON) */
      dynamicExtras?: string;
      /** 记录创建时间 */
      createdTime?: string;
    }

    /**
     * 审计日志查询参数
     *
     * 对应后端 AuditLogQueryPageParam（extends ParamPage，故分页字段为 current/size）。
     * 租户ID 由后端从登录上下文解析，前端不传。
     */
    type LogSearchParams = Common.CommonSearchParams & {
      category?: LogCategory;
      logType?: string;
      logStatus?: LogStatus;
      principalId?: string;
      /** 主体名称，后端做 positionCaseInsensitive 模糊匹配 */
      principalName?: string;
      principalType?: PrincipalType;
      targetId?: string;
      targetType?: string;
      /** 风险等级下限（含） */
      riskLevelMin?: number;
      /** 风险等级上限（含） */
      riskLevelMax?: number;
      bizChannel?: BizChannel;
      clientIp?: string;
      resultCode?: string;
      /** ISO-8601，如 2026-09-17T00:00:00 */
      startTime?: string;
      /** ISO-8601，如 2026-09-17T23:59:59 */
      endTime?: string;
    };

    type LogList = Common.PaginatingQueryRecord<LogRecord>;

    /** 实时统计，对应后端 AuditLogStatsVO（计数字段为 Long，序列化为字符串） */
    interface Stats {
      date?: string;
      hour?: number;
      totalCount?: string;
      successCount?: string;
      failCount?: string;
      uniqueUsers?: string;
      uniqueTargets?: string;
      totalDuration?: string;
      /** 平均耗时(ms)，BigDecimal */
      avgDuration?: number;
      maxRiskLevel?: number;
      totalAttachments?: string;
      /** 涉及金额，BigDecimal */
      totalAmount?: number;
    }

    /** 按天聚合统计，对应后端 AuditLogDailyStatsVO（计数字段为 Long，序列化为字符串） */
    interface DailyStats {
      date?: string;
      totalCount?: string;
      successCount?: string;
      failCount?: string;
      uniqueUsers?: string;
      /** 平均耗时(ms)，BigDecimal */
      avgDuration?: number;
      maxRiskLevel?: number;
    }

    /** 审计配置，对应后端 AuditLogConfigVO */
    type Config = Common.CommonRecord<{
      /** 日志类型，如 USER_LOGIN */
      logType: string;
      /** 保留天数 */
      retentionDays: number;
      /** 采样率 0.00-1.00 */
      samplingRate: number;
      /** 是否异步写入 */
      asyncWrite: boolean;
      /** 是否存储数据变更详情 */
      storeDataChange: boolean;
      /** 是否存储技术上下文 */
      storeTechnical: boolean;
      /** 租户ID，0 表示系统级配置 */
      tenantId: string;
    }>;

    /** 审计配置查询参数（后端 AuditLogConfigPageParam 的 logType / tenantId） */
    type ConfigSearchParams = Partial<Pick<Config, 'logType' | 'tenantId'>> & Common.CommonSearchParams;

    type ConfigList = Common.PaginatingQueryRecord<Config>;

    /** 审计配置新增/编辑参数，对应后端 AuditLogConfigCreateParam / AuditLogConfigUpdateParam */
    type ConfigOperateParams = Pick<
      Config,
      'logType' | 'retentionDays' | 'samplingRate' | 'asyncWrite' | 'storeDataChange' | 'storeTechnical' | 'tenantId'
    >;

    /**
     * 归档记录，对应后端 AuditLogArchiveRecordVO
     *
     * 注意字段名与其它模块不同：用的是 `createdTime` 而非 `createTime`，且无 createBy/updateBy/status，
     * 因此不套用 {@link Common.CommonRecord}。
     */
    interface ArchiveRecord {
      id: string;
      /** 归档批次ID，UUID */
      archiveId: string;
      /** 归档日期 */
      archiveDate: string;
      /** 归档数据起始时间 */
      startTime: string;
      /** 归档数据结束时间 */
      endTime: string;
      /** 归档记录数（Long → 字符串） */
      recordCount: string;
      /** 归档文件大小，字节（Long → 字符串） */
      fileSizeBytes: string;
      /** 存储路径 */
      storagePath: string;
      /** 存储类型 */
      storageType: ArchiveStorageType;
      /** 校验和，MD5 或 SHA256 */
      verifyChecksum?: string;
      /** 归档状态 */
      archiveStatus: ArchiveState;
      /** 创建时间 */
      createdTime: string;
    }

    /** 归档记录查询参数（后端 AuditLogArchiveRecordPageParam） */
    type ArchiveSearchParams = Partial<Pick<ArchiveRecord, 'archiveId' | 'archiveStatus' | 'storageType'>> &
      Common.CommonSearchParams & {
        /** 记录创建时间区间起，ISO-8601，对应后端 start */
        start?: string;
        /** 记录创建时间区间止，ISO-8601，对应后端 end */
        end?: string;
      };

    type ArchiveList = Common.PaginatingQueryRecord<ArchiveRecord>;
  }

  /**
   * Namespace Message
   *
   * backend api module: "carlos-message"
   * 网关路由 /message/** -> lb://carlos-message，外部访问路径为 /manage-api/message/**
   *
   * 注意本模块的 `enabled` 有两种形态：
   * 渠道是 smallint 数字码（0/1/2），模板与类型是 Boolean（JSON 布尔），
   * 不可统一按一种方式渲染。
   */
  namespace Message {
    // ============================================================
    // 公共枚举
    // ============================================================

    /**
     * 渠道类型
     *
     * 对应后端 `ChannelType`（@AppEnum("ChannelType")，落库为 message_channel.channel_type smallint）。
     * 后端下发数字码，此处沿用本仓库对「smallint 码值」的既有写法（字符串字面量，
     * 见 Api.Organization.UserStatus 等），故比较与取值时需注意与 number 的转换。
     *
     * - "1": sms 短信
     * - "2": email 邮件
     * - "3": dingtalk 钉钉
     * - "4": wechatWork 企业微信
     * - "5": websocket 站内信
     */
    type ChannelType = '1' | '2' | '3' | '4' | '5';

    /**
     * 投递状态
     *
     * 对应后端 `MessageReceiverStatusEnum`（@AppEnum("MessageReceiverStatus")）。
     * 后端另有 `MessageStatus`（core 包）常量与之完全重复，但只有前者带 @EnumValue
     * 被持久化层使用，两个 @AppEnum 字典都会出现在 /app/enums，前端取本枚举即可。
     *
     * ⚠️ 该状态只存在于**接收人**记录上：`MessageRecordVO` 没有 status 字段，
     * 消息记录列表只能展示 total/success/fail 计数。
     *
     * - "0": 待发送 "1": 发送中 "2": 已发送 "3": 送达 "4": 已读 "5": 失败 "6": 撤回
     */
    type MessageStatus = '0' | '1' | '2' | '3' | '4' | '5' | '6';

    /**
     * 接收者类型
     *
     * - "1": 用户
     * - "2": 部门
     * - "3": 角色
     */
    type ReceiverType = '1' | '2' | '3';

    /**
     * 消息优先级
     *
     * - "1": 紧急
     * - "2": 高
     * - "3": 普通
     * - "4": 低
     */
    type MessagePriority = '1' | '2' | '3' | '4';

    /**
     * 渠道启用状态（message_channel.is_enabled 为 smallint）
     *
     * - "0": 禁用
     * - "1": 启用
     * - "2": 故障
     *
     * ⚠️ "2"（故障）由后端在发送失败时置位（ChannelService.markFaulted **没有** HTTP 端点），
     * 因此表单只允许在 0/1 之间切换；故障态只在列表里展示。
     */
    type ChannelEnabled = '0' | '1' | '2';

    // ============================================================
    // 消息类型  /message/type
    // ============================================================

    /** message type（对应后端 MessageTypeVO） */
    type MessageType = Common.CommonRecord<{
      /** 类型编码（唯一） */
      typeCode: string;
      /** 类型名称 */
      typeName: string;
      /** 是否启用（后端 is_enabled 为 Boolean） */
      enabled: boolean;
    }>;

    /** type search params（对应后端 MessageTypePageParam） */
    type TypeSearchParams = Partial<Pick<MessageType, 'typeCode' | 'typeName' | 'enabled'>> &
      Common.CommonSearchParams & {
        /** 创建时间区间起，ISO-8601，对应后端 start */
        start?: string;
        /** 创建时间区间止，ISO-8601，对应后端 end */
        end?: string;
      };

    /** type list */
    type TypeList = Common.PaginatingQueryRecord<MessageType>;

    /** type operate params（新增/修改） */
    type TypeOperateParams = Pick<MessageType, 'typeCode' | 'typeName' | 'enabled'>;

    // ============================================================
    // 消息渠道  /message/channel
    // ============================================================

    /** message channel（对应后端 MessageChannelVO） */
    type MessageChannel = Common.CommonRecord<{
      /** 渠道编码（唯一，业务主键） */
      channelCode: string;
      /** 渠道名称 */
      channelName: string;
      /** 渠道类型 */
      channelType: ChannelType;
      /** 服务商，如 aliyun / tencent */
      provider?: string;
      /**
       * 渠道配置，**JSON 字符串**（后端字段类型为 String，落库为 jsonb）。
       * 新增与修改时后端标注 @NotBlank，故必填。
       */
      channelConfig: string;
      /** 限流 QPS */
      rateLimitQps?: number;
      /** 限流突发容量 */
      rateLimitBurst?: number;
      /** 重试次数 */
      retryTimes?: number;
      /** 重试间隔（ms） */
      retryInterval?: number;
      /** 渠道权重 */
      weight?: number;
      /** 启用状态（后端 is_enabled 为 Integer 数字码） */
      enabled: ChannelEnabled;
    }>;

    /** channel search params（对应后端 MessageChannelPageParam） */
    type ChannelSearchParams = Partial<
      Pick<MessageChannel, 'channelCode' | 'channelName' | 'channelType' | 'provider' | 'enabled'>
    > &
      Common.CommonSearchParams & {
        start?: string;
        end?: string;
      };

    /** channel list */
    type ChannelList = Common.PaginatingQueryRecord<MessageChannel>;

    /** channel operate params（新增/修改；enabled 仅取 0/1，故障态不由前端设置） */
    type ChannelOperateParams = Pick<
      MessageChannel,
      | 'channelCode'
      | 'channelName'
      | 'channelType'
      | 'provider'
      | 'channelConfig'
      | 'rateLimitQps'
      | 'rateLimitBurst'
      | 'retryTimes'
      | 'retryInterval'
      | 'weight'
    > & {
      enabled?: Extract<ChannelEnabled, '0' | '1'>;
    };

    // ============================================================
    // 消息模板  /message/template
    // ============================================================

    /** message template（对应后端 MessageTemplateVO） */
    type MessageTemplate = Common.CommonRecord<{
      /** 所属消息类型 id（Long，字符串下发） */
      typeId: string;
      /** 模板编码（唯一） */
      templateCode: string;
      /** 模板名称 */
      templateName: string;
      /** 标题模板，支持占位符 */
      titleTemplate?: string;
      /** 内容模板，支持占位符 */
      contentTemplate: string;
      /** 参数定义，**JSON 字符串**（落库 jsonb） */
      paramSchema?: string;
      /** 渠道特殊配置，**JSON 字符串**（落库 jsonb） */
      channelConfig?: string;
      /**
       * 是否启用（后端 is_enabled 为 Boolean）
       *
       * ⚠️ 后端 Swagger 注释写的是「0-禁用 1-启用 2-草稿」，但字段类型是 Boolean，
       * 「草稿」这一态在库里根本无法表达，`publish()` 也只能把它置为 true。
       * 因此前端只呈现 启用/禁用 两态，不提供「草稿」。
       */
      enabled: boolean;
    }>;

    /** template search params（对应后端 MessageTemplatePageParam） */
    type TemplateSearchParams = Partial<Pick<MessageTemplate, 'typeId' | 'templateCode' | 'templateName' | 'enabled'>> &
      Common.CommonSearchParams & {
        start?: string;
        end?: string;
      };

    /** template list */
    type TemplateList = Common.PaginatingQueryRecord<MessageTemplate>;

    /** template operate params（新增/修改） */
    type TemplateOperateParams = Pick<
      MessageTemplate,
      | 'typeId'
      | 'templateCode'
      | 'templateName'
      | 'titleTemplate'
      | 'contentTemplate'
      | 'paramSchema'
      | 'channelConfig'
      | 'enabled'
    >;

    // ============================================================
    // 消息记录  /message/record 与 /message
    // ============================================================

    /**
     * message record（对应后端 MessageRecordVO）
     *
     * ⚠️ 没有 status 字段。消息记录只有 totalCount / successCount / failCount 聚合计数；
     * 单条投递状态在 {@link MessageReceiver} 上。
     */
    type MessageRecord = Common.CommonRecord<{
      /** 消息业务 id（唯一，非主键） */
      messageId: string;
      /** 模板编码 */
      templateCode: string;
      /** 模板参数，**JSON 字符串**（落库 jsonb） */
      templateParams?: string;
      /** 消息类型编码 */
      messageType: string;
      /** 消息标题 */
      messageTitle?: string;
      /** 消息内容 */
      messageContent: string;
      /** 发送人 id */
      senderId: string;
      /** 发送人名称 */
      senderName?: string;
      /** 发送系统标识 */
      senderSystem: string;
      /** 操作反馈类型 */
      feedbackType?: string;
      /** 操作反馈内容 */
      feedbackContent?: string;
      /** 优先级 */
      priority: MessagePriority;
      /** 消息有效期 */
      validUntil?: string;
      /** 总接收人数 */
      totalCount?: number;
      /** 成功发送数 */
      successCount?: number;
      /** 失败发送数 */
      failCount?: number;
      /** 扩展信息，**JSON 字符串**（落库 jsonb） */
      extras?: string;
    }>;

    /** record search params（对应后端 MessageRecordPageParam，注意时间字段为 start/end） */
    type RecordSearchParams = Partial<
      Pick<
        MessageRecord,
        'messageId' | 'templateCode' | 'messageType' | 'messageTitle' | 'senderId' | 'senderSystem' | 'priority'
      >
    > &
      Common.CommonSearchParams & {
        start?: string;
        end?: string;
      };

    /** record list */
    type RecordList = Common.PaginatingQueryRecord<MessageRecord>;

    // ============================================================
    // 消息接收人（记录详情内）  /message/receiver
    // ============================================================

    /** message receiver（对应后端 MessageReceiverVO） */
    type MessageReceiver = Common.CommonRecord<{
      /** 消息业务 id */
      messageId: string;
      /** 渠道编码 */
      channelCode: string;
      /** 接收者 id */
      receiverId: string;
      /** 接收者类型 */
      receiverType?: ReceiverType;
      /** 接收地址（手机号/邮箱等） */
      receiverNumber?: string;
      /** 接收者设备标识 */
      receiverAudience?: string;
      /** 渠道返回的消息 id */
      channelMessageId?: string;
      /** 投递状态 */
      status: MessageStatus;
      /** 失败次数 */
      failCount?: number;
      /** 失败原因 */
      failReason?: string;
      /** 定时发送时间 */
      scheduleTime?: string;
      /** 实际发送时间 */
      sendTime?: string;
      /** 送达时间 */
      deliverTime?: string;
      /** 阅读时间 */
      readTime?: string;
      /** 回调地址 */
      callbackUrl?: string;
      /** 扩展信息，JSON 字符串 */
      extras?: string;
    }>;

    /** receiver search params（对应后端 MessageReceiverPageParam；详情页按 messageId 过滤） */
    type ReceiverSearchParams = Partial<
      Pick<MessageReceiver, 'messageId' | 'channelCode' | 'receiverId' | 'receiverType' | 'status'>
    > &
      Common.CommonSearchParams;

    /** receiver list */
    type ReceiverList = Common.PaginatingQueryRecord<MessageReceiver>;

    // ============================================================
    // 消息发送日志（记录详情内）  /message/send/log
    // ============================================================

    /** message send log（对应后端 MessageSendLogVO，追加写、无更新审计字段） */
    type MessageSendLog = {
      /** 主键（Long，字符串下发） */
      id: string;
      /** 消息业务 id */
      messageId: string;
      /** 接收人记录 id（Long，字符串下发，指向 message_receiver.id） */
      receiverId: string;
      /** 渠道编码 */
      channelCode: string;
      /** 请求参数原文 */
      requestParam?: string;
      /** 响应数据原文 */
      responseData?: string;
      /** 是否成功 */
      success: boolean;
      /** 错误码 */
      errorCode?: string;
      /** 错误信息 */
      errorMessage?: string;
      /** 耗时（ms） */
      costTime?: number;
      /** 创建时间 */
      createTime: string;
    };

    /** send log search params（对应后端 MessageSendLogPageParam） */
    type SendLogSearchParams = Partial<
      Pick<MessageSendLog, 'messageId' | 'receiverId' | 'channelCode' | 'success' | 'errorCode'>
    > &
      Common.CommonSearchParams;

    /** send log list */
    type SendLogList = Common.PaginatingQueryRecord<MessageSendLog>;
  }

  /**
   * Namespace Job
   *
   * backend api module: "carlos-job"（定时任务调度中心）
   * 网关路由 /job/** -> lb://carlos-job，外部访问路径为 /manage-api/job/**
   *
   * 注意：任务没有数据库自增 id，唯一键是 (jobName, jobGroup)。
   * 前端列表行的 id 取 jobName（jobGroup 在 UI 一期固定为 DEFAULT，不在表单暴露）。
   */
  namespace Job {
    /**
     * 任务状态（Quartz Trigger 状态字符串，原样下发）
     *
     * - NORMAL: 正常
     * - PAUSED: 暂停
     * - ERROR / BLOCKED / COMPLETE / NONE: 其他 Quartz 内部状态
     */
    type JobStatus = 'NORMAL' | 'PAUSED' | 'ERROR' | 'BLOCKED' | 'COMPLETE' | 'NONE';

    /**
     * 调度类型（job_info.schedule_type smallint，Integer 下发为数字）
     *
     * - 1: CRON 表达式
     * - 2: 固定间隔（scheduleConf 为毫秒数）
     * - 3: 一次性（scheduleConf 为触发时间 ISO 字符串）
     */
    type ScheduleType = 1 | 2 | 3;

    /**
     * 错过触发策略（job_info.misfire_strategy smallint，Integer 下发为数字）
     *
     * - 0: 智能策略（Quartz 默认）
     * - 1: 忽略错过（立即补偿所有错过的触发）
     * - 2: 立即执行一次后按计划继续
     * - 3: 什么都不做，等下次触发
     */
    type MisfireStrategy = 0 | 1 | 2 | 3;

    /**
     * 并发模式（job_info.concurrent_mode smallint，Integer 下发为数字）
     *
     * - 1: 串行（@DisallowConcurrentExecution，集群内互斥）
     * - 2: 并行
     */
    type ConcurrentMode = 1 | 2;

    /** job（对应后端 JobVO） */
    type JobInfo = {
      /** 任务名称（唯一键之一，列表行 id 即 jobName） */
      jobName: string;
      /** 任务分组（一期 UI 固定 DEFAULT） */
      jobGroup: string;
      /** 目标服务名（Nacos 注册名） */
      serviceName: string;
      /** 任务处理器名称（JobHandler Bean 名称） */
      handlerName: string;
      /** 任务参数（JSON 字符串） */
      params?: string;
      /** cron 表达式（scheduleType=1 时与 scheduleConf 一致；老数据兜底字段） */
      cronExpression: string;
      /** 任务描述 */
      description?: string;
      /** 任务状态（Quartz Trigger 状态） */
      status?: JobStatus;
      /** 调度类型 */
      scheduleType?: ScheduleType;
      /** 调度配置（cron 表达式 / 间隔毫秒数 / 一次性触发时间） */
      scheduleConf?: string;
      /** 错过触发策略 */
      misfireStrategy?: MisfireStrategy;
      /** 并发模式 */
      concurrentMode?: ConcurrentMode;
      /** 超时时间（秒，0 表示不限制） */
      timeoutSeconds?: number;
      /** 失败重试次数（0 表示不重试） */
      failRetryCount?: number;
      /** 负责人 */
      author?: string;
      /** 报警接收人（多个用英文逗号分隔） */
      alarmReceivers?: string;
      /** 上次触发时间 */
      prevFireTime?: string;
      /** 下次触发时间 */
      nextFireTime?: string;
    };

    /** 列表行（useTableOperate 要求行上有 id，此处 id === jobName） */
    type JobRecord = JobInfo & { id: string };

    /** job search params（对应后端 JobPageParam，全部为精确/模糊筛选） */
    type JobSearchParams = Partial<Pick<JobInfo, 'jobName' | 'jobGroup' | 'serviceName' | 'handlerName' | 'status'>> &
      Common.CommonSearchParams;

    /** job operate params（对应后端 JobCreateParam / JobUpdateParam，新字段全部可选） */
    type JobOperateParams = Pick<JobInfo, 'jobName' | 'serviceName' | 'handlerName'> &
      Partial<
        Pick<
          JobInfo,
          | 'jobGroup'
          | 'params'
          | 'description'
          | 'cronExpression'
          | 'scheduleType'
          | 'scheduleConf'
          | 'misfireStrategy'
          | 'concurrentMode'
          | 'timeoutSeconds'
          | 'failRetryCount'
          | 'author'
          | 'alarmReceivers'
        >
      >;

    /** job list */
    type JobList = Common.PaginatingQueryRecord<JobRecord>;

    /**
     * 执行状态（job_execution_log.status smallint，Integer 下发为数字）
     *
     * - 1: 成功
     * - 2: 失败
     * - 3: 执行中
     */
    type ExecutionStatus = 1 | 2 | 3;

    /**
     * 触发类型（job_execution_log.trigger_type smallint，Integer 下发为数字）
     *
     * - 1: cron 定时
     * - 2: 手动触发
     * - 3: 失败重试
     */
    type TriggerType = 1 | 2 | 3;

    /** job execution log（对应后端 JobExecutionLogVO，id 为 Long 字符串下发） */
    type ExecutionLog = {
      /** 主键（Long，字符串下发） */
      id: string;
      /** 任务名称 */
      jobName: string;
      /** 任务分组 */
      jobGroup: string;
      /** 目标服务名 */
      serviceName?: string;
      /** 任务处理器名称 */
      handlerName?: string;
      /** 触发类型 */
      triggerType: TriggerType;
      /** cron 表达式（手动触发时为空） */
      cronExpression?: string;
      /** 执行状态 */
      status: ExecutionStatus;
      /** 开始时间 */
      startTime: string;
      /** 结束时间（执行中为空） */
      endTime?: string;
      /** 耗时（毫秒，Long 序列化为字符串下发） */
      durationMs?: string;
      /** 失败原因/结果说明 */
      resultMessage?: string;
      /** 执行节点 */
      serverNode?: string;
    };

    /** job log search params（对应后端 JobLogPageParam：jobName/handlerName 为 like，jobGroup/serviceName/status 为 eq，start/end 作用于 start_time） */
    type LogSearchParams = Partial<Pick<ExecutionLog, 'jobName' | 'jobGroup' | 'serviceName' | 'handlerName'>> &
      Common.CommonSearchParams & {
        /** 执行状态 eq */
        status?: ExecutionStatus;
        /** 开始时间区间起，对应后端 start */
        start?: string;
        /** 开始时间区间止，对应后端 end */
        end?: string;
      };

    /** job log list */
    type LogList = Common.PaginatingQueryRecord<ExecutionLog>;

    /** 调度器元信息（对应后端 SchedulerMetaVO） */
    type SchedulerMeta = {
      /** 调度器名称 */
      schedulerName?: string;
      /** 本节点实例 ID */
      instanceId?: string;
      /** 是否集群模式 */
      clustered?: boolean;
      /** 是否待机中（standby 后不再触发） */
      standby?: boolean;
      /** 是否已关闭 */
      shutdown?: boolean;
      /** 启动时间 */
      runningSince?: string;
      /** 线程池大小 */
      threadPoolSize?: number;
      /** 累计执行任务数 */
      executedJobCount?: number;
      /** 当前在跑任务数 */
      runningJobCount?: number;
    };

    /**
     * 调度器集群节点（对应后端 SchedulerNodeVO，数据源 QRTZ_SCHEDULER_STATE）
     *
     * lastCheckinTime / checkinInterval 为毫秒时间戳，Long 序列化为字符串下发。
     */
    type SchedulerNode = {
      /** 调度器名称 */
      schedulerName?: string;
      /** 节点实例 ID */
      instanceId?: string;
      /** 上次心跳时间（毫秒时间戳，Long 字符串下发） */
      lastCheckinTime?: string;
      /** 心跳间隔（毫秒，Long 字符串下发） */
      checkinInterval?: string;
      /** 是否存活（now - lastCheckin <= interval × 2） */
      alive?: boolean;
    };

    /** 目标服务实例（对应后端 ServiceInstanceVO，数据源 Nacos DiscoveryClient） */
    type ServiceInstance = {
      /** 服务名 */
      serviceName?: string;
      /** 实例 ID */
      instanceId?: string;
      /** 主机 */
      host?: string;
      /** 端口 */
      port?: number;
      /** 是否健康 */
      healthy?: boolean;
      /** 地址（host:port） */
      address?: string;
    };

    /** 运行报表总览（对应后端 JobDashboardVO，Long 字段字符串下发） */
    type JobDashboard = {
      /** 任务总数（job_info） */
      jobCount?: string;
      /** 在线节点数 */
      onlineNodeCount?: string;
      /** 今日触发次数 */
      todayTriggerCount?: string;
      /** 今日成功次数 */
      todaySuccessCount?: string;
      /** 今日失败次数 */
      todayFailCount?: string;
      /** 今日成功率（百分比，0-100） */
      todaySuccessRate?: number;
      /** 当前在跑任务数 */
      runningJobCount?: number;
      /** 日期分布（近 N 天，含补零日期） */
      dateDistribution?: {
        /** 日期（YYYY-MM-DD） */
        date: string;
        /** 成功次数 */
        successCount: string;
        /** 失败次数 */
        failCount: string;
      }[];
      /** 状态分布（近 N 天） */
      statusDistribution?: {
        /** 执行状态码 */
        status: ExecutionStatus;
        /** 状态名 */
        statusName: string;
        /** 数量 */
        count: string;
      }[];
    };
  }

  /**
   * namespace Workflow
   *
   * backend api module: "carlos-workflow"
   * 网关路由 /workflow/** -> lb://carlos-workflow（外部访问路径 /manage-api/workflow/**）
   *
   * ⚠️ 只覆盖**我们自己的**业务接口（`Result` 信封，成功码 `00000`）。
   * 设计器 iframe 内部的 `/warm-flow/**`（信封是引擎的 `ApiResult`、成功码 200）**不属于这里**，
   * 前端任何地方都不应直接请求它们。
   */
  namespace Workflow {
    /**
     * 流程定义 id
     *
     * 后端 `Long`，框架全局 `longToString = true` ⇒ JSON 里是**字符串**，
     * 19 位雪花值超出 `Number.MAX_SAFE_INTEGER`，当数字用会静默丢精度。
     */
    type WorkflowDefinitionId = string;

    /**
     * 流程发布状态（对应 warm-flow `flow_definition.is_publish`）
     *
     * - `0`: 未发布（草稿，设计器可编辑）
     * - `1`: 已发布（**设计器自动只读**，要改只能「撤销发布」或「复制新版本」）
     * - `9`: 已失效（被新版本取代的历史版本）
     */
    type WorkflowPublishStatus = 0 | 1 | 9;

    /**
     * 流程定义的激活状态（对应 warm-flow `flow_definition.activity_status`）
     *
     * - `0`: 挂起
     * - `1`: 激活
     */
    type WorkflowActivityStatus = 0 | 1;

    /**
     * 设计器模型（对应后端 warm-flow `ModelEnum`，落在 `flow_definition.model_value`）
     *
     * - `CLASSICS`: 经典模型，新建时缺省即此值
     * - `MIMIC`: 仿钉钉模型
     *
     * **保存后不可修改**：两种模型的节点结构不同，后端 `updateBasic` 对
     * 「非空且与库中不一致」的取值直接拒绝（错误码 10701，文案「设计器模型保存后不可修改」）。
     * 前端对应的做法是编辑弹窗里禁用该单选、且提交时不回传它（留空 = 保持原值）。
     */
    type WorkflowModelType = 'CLASSICS' | 'MIMIC';

    /** 流程定义（对应后端 WorkflowDefinitionAO） */
    type WorkflowDefinition = {
      /** 流程定义 id（主键，非 `CommonRecord.id`：该 AO 不继承公共字段） */
      definitionId: WorkflowDefinitionId;
      /** 流程编码（业务标识） */
      flowCode: string;
      /** 流程名称 */
      flowName: string;
      /** 版本号（引擎按字符串下发，如 "1"） */
      version: string;
      /** 流程类别（依赖后端 CategoryService SPI；未实现时为空） */
      category?: string | null;
      /**
       * 设计器模型（`CLASSICS` / `MIMIC`），**不是**模型 JSON
       *
       * 模型 JSON 由设计器自己走 `/warm-flow/query-def/{id}` 取，不经本字段。
       */
      modelValue?: WorkflowModelType | null;
      /** 发布状态 */
      isPublish: WorkflowPublishStatus;
      /** 激活状态（挂起/激活） */
      activityStatus: WorkflowActivityStatus;
      /** 创建时间（ISO-8601） */
      createTime: string;
      /** 更新时间（ISO-8601） */
      updateTime: string;
    };

    /** workflow definition search params（对应后端分页参数） */
    type WorkflowDefinitionSearchParams = {
      /** 流程名称（模糊匹配） */
      flowName?: string;
      /** 流程编码（模糊匹配） */
      flowCode?: string;
      /**
       * 流程类别
       *
       * 刻意**不带 `null`**：搜索表单要把它直接绑进 `AInput`，而 antd 的绑定值不收 `null`；
       * `null` 是「详情接口返回值」的语义，请求侧用「不传」表达不过滤。
       */
      category?: string;
      /** 发布状态（精确匹配）；不传表示不过滤 */
      isPublish?: WorkflowPublishStatus;
    } & Common.CommonSearchParams;

    /** workflow definition list（对应后端 Paging&lt;WorkflowDefinitionAO&gt;） */
    type WorkflowDefinitionList = Common.PaginatingQueryRecord<WorkflowDefinition>;

    /**
     * 流程定义基础信息参数（对应后端 `ApiWorkflowDefinitionBasicParam`）
     *
     * 「先填基本信息、再进设计器画节点」的第一步：只写 `flow_definition` 主记录，
     * **不创建节点**（节点与跳转线由设计器后续 `/warm-flow/save-json` 写入）。
     *
     * 新建：省略 `definitionId`，`flowCode` / `flowName` 必填（空白会被后端拒），
     * `modelValue` 省略按 `CLASSICS`，`category` 省略落 NULL。
     *
     * 更新：传 `definitionId`。此时后端对「空值」的语义与新建**不同** ——
     * `flowCode` / `flowName` 留空 = **保持原值**（不是清空，主记录这两列非空）；
     * `category` 传 `null` = 保持原值、传 `''` = 清空；`modelValue` 留空 = 保持原值，
     * 非空则必须与库中一致，否则 10701。
     */
    type WorkflowDefinitionBasicParams = {
      /** 流程定义 id；为空/省略 = 新建，非空 = 更新 */
      definitionId?: WorkflowDefinitionId;
      /** 流程编码（新建必填；更新留空 = 保持原值） */
      flowCode?: string;
      /** 流程名称（新建必填；更新留空 = 保持原值） */
      flowName?: string;
      /** 设计器模型；新建省略按 `CLASSICS`，更新留空 = 保持原值 */
      modelValue?: WorkflowModelType;
      /** 流程类别；更新时 `null` 保持原值、`''` 清空 */
      category?: string | null;
    };

    /**
     * 待办任务 id / 历史任务 id / 流程实例 id
     *
     * 后端均为 `Long`，框架全局 `longToString = true` ⇒ JSON 里是**字符串**（理由同
     * {@link WorkflowDefinitionId}）。三者都是 19 位雪花值，混用或当数字用都会静默丢精度。
     */
    type WorkflowTaskId = string;

    type WorkflowHisTaskId = string;

    type WorkflowInstanceId = string;

    /**
     * 流程状态（对应 warm-flow `flow_status`，四张表上都是 `varchar(20)`）
     *
     * ⚠️ 是**字符串数字码**，不是枚举名（后端 `WorkflowTaskAO.flowStatus` 也是 `String`），
     * 字典键因此必须是字符串字面量。
     *
     * 老版 DDL 注释里还出现过 `5 作废`（新版引擎已移除）；若后端仍下发未收录的码值，
     * `enumText()` 会回退显示原码，不会抛异常。
     */
    type WorkflowFlowStatus = '0' | '1' | '2' | '3' | '4' | '6' | '8' | '9' | '10' | '11';

    /**
     * 协作类型（对应 warm-flow `flow_his_task.cooperate_type`）
     *
     * 后端 `Integer` ⇒ JSON 下发为**数字**（只有 Long 才被转成字符串）。
     */
    type WorkflowCooperateType = 1 | 2 | 3 | 4 | 5 | 6 | 7;

    /** 流转类型（对应 warm-flow `flow_his_task.skip_type`，字符串枚举名） */
    type WorkflowSkipType = 'PASS' | 'REJECT' | 'NONE';

    /**
     * 节点类型（对应 warm-flow `node_type`，后端 `Integer`）
     *
     * 码值取自引擎 1.8.9；老版 DDL 注释把 3/4 写作「互斥网关 / 并行网关」，
     * 与新版文档的「串行 / 并行」是同一批码值。
     */
    type WorkflowNodeType = 0 | 1 | 2 | 3 | 4 | 5;

    /**
     * 审批动作（对应后端 `WorkflowActionEnum`）
     *
     * ⚠️ **收发都用枚举名**（`"PASS"`），不是 code 1-9。依据：
     * 该枚举只带 MyBatis-Plus 的 `@EnumValue`（只影响 JDBC 读写），
     * Jackson 侧没有任何 `@JsonValue` / 自定义反序列化器，走默认的「按枚举名」处理；
     * 后端 `WorkflowControllerResultTest` 也正是以 `{"action":"ADD_SIGNATURE"}` 提交并断言回包 `"PASS"`。
     * 传数字会被 Jackson 当成 **ordinal**（0 起），与 code（1 起）整体错位一格。
     */
    type WorkflowAction =
      | 'PASS'
      | 'REJECT'
      | 'FREE_JUMP'
      | 'TRANSFER'
      | 'DEPUTE'
      | 'ADD_SIGNATURE'
      | 'REDUCTION_SIGNATURE'
      | 'REJECT_LAST'
      | 'TAKE_BACK';

    /** 待办任务（对应后端 WorkflowTaskAO） */
    type WorkflowTask = {
      taskId: WorkflowTaskId;
      instanceId: WorkflowInstanceId;
      definitionId: WorkflowDefinitionId;
      /** 流程名称 */
      flowName: string;
      /** 业务 id（由发起人传入，本前端不解析） */
      businessId: string;
      nodeCode: string;
      /** 任务（节点）名称 */
      nodeName: string;
      nodeType: WorkflowNodeType;
      flowStatus: WorkflowFlowStatus;
      activityStatus: WorkflowActivityStatus;
      /**
       * 以下三个是 warm-flow 的「业务表单」字段
       *
       * 本前端**不做业务表单**（不动态加载 `formPath` 组件、不渲染 `formCustom` 表单），
       * 写进契约只为兼容后端下发，页面不要使用。
       */
      formCustom?: string | null;
      formPath?: string | null;
      /** 节点办理人标识（未展开的表达式字面量），页面不使用 */
      permissionList?: string[] | null;
      /** 审批人姓名串（`;` 分隔，后端已解析成姓名，前端不得再查用户） */
      approver?: string | null;
      /** 转办人姓名串（`;` 分隔） */
      transferredBy?: string | null;
      /** 委派人姓名串（`;` 分隔） */
      delegate?: string | null;
      createTime: string;
      updateTime: string;
    };

    /** 历史任务（对应后端 WorkflowHisTaskAO） */
    type WorkflowHisTask = {
      hisTaskId: WorkflowHisTaskId;
      taskId: WorkflowTaskId;
      instanceId: WorkflowInstanceId;
      definitionId: WorkflowDefinitionId;
      flowName: string;
      businessId: string;
      nodeCode: string;
      /** 开始节点名称 */
      nodeName: string;
      nodeType: WorkflowNodeType;
      cooperateType: WorkflowCooperateType;
      skipType: WorkflowSkipType;
      flowStatus: WorkflowFlowStatus;
      /** 审批人姓名串（`;` 分隔） */
      approver?: string | null;
      /** 协作人姓名串（`,` 分隔，与 approver 的分隔符不同） */
      collaborator?: string | null;
      /** 审批意见 */
      message?: string | null;
      /** 目标（结束）节点编码与名称 */
      targetNodeCode?: string | null;
      targetNodeName?: string | null;
      /** 同 {@link WorkflowTask.formCustom}：业务表单字段，本前端不使用 */
      formCustom?: string | null;
      formPath?: string | null;
      createTime: string;
      updateTime: string;
    };

    /**
     * 待办 / 已办共用的分页查询参数（对应后端 `ApiWorkflowTaskPageParam`）
     *
     * 「当前用户」不由前端传入，服务端从登录上下文取。
     */
    type WorkflowTaskSearchParams = {
      /** 任务（节点）名称，模糊匹配 */
      nodeName?: string;
      /** 流程状态，等值匹配 */
      flowStatus?: WorkflowFlowStatus;
    } & Common.CommonSearchParams;

    /** workflow todo list（对应后端 Paging&lt;WorkflowTaskAO&gt;） */
    type WorkflowTaskList = Common.PaginatingQueryRecord<WorkflowTask>;

    /** workflow done list（对应后端 Paging&lt;WorkflowHisTaskAO&gt;） */
    type WorkflowHisTaskList = Common.PaginatingQueryRecord<WorkflowHisTask>;

    /** 候选办理人（对应后端 WorkflowCandidateAO，数据来自 carlos-org） */
    type WorkflowCandidate = {
      /** 用户 id（Long ⇒ 字符串），也是提交回 `targetHandlers` 的值 */
      userId: string;
      /** 登录账号 */
      code: string;
      /** 姓名（后端取 nickname，缺省回落 account） */
      name: string;
      deptId?: string | null;
      deptName?: string | null;
    };

    /** 候选办理人分页参数（对应后端 ApiWorkflowCandidatePageParam） */
    type WorkflowCandidateSearchParams = {
      /**
       * 审批动作，决定候选口径
       *
       * `REDUCTION_SIGNATURE`（减签）只列该任务**已有**的办理人；
       * 转办 / 委托 / 加签**排除**已有办理人。
       */
      action: WorkflowAction;
      /** 部门 id（Long ⇒ 字符串），可选过滤（含子部门）；不传表示不过滤 */
      deptId?: string;
    } & Common.CommonSearchParams;

    /** 候选办理人分页结果（对应后端 Paging&lt;WorkflowCandidateAO&gt;） */
    type WorkflowCandidateList = Common.PaginatingQueryRecord<WorkflowCandidate>;

    /** 可选跳转节点（对应后端 WorkflowNodeAO），自由跳转与指定退回目标共用 */
    type WorkflowNode = {
      nodeCode: string;
      nodeName: string;
    };

    /** 流程实例（对应后端 WorkflowInstanceAO） */
    type WorkflowInstance = {
      instanceId: WorkflowInstanceId;
      definitionId: WorkflowDefinitionId;
      flowName: string;
      /**
       * 业务单号
       *
       * 由发起人传入，**可能为空**（不是所有发起入口都会带），页面须把空值显示成 `-`。
       */
      businessId?: string | null;
      nodeCode: string;
      nodeName: string;
      nodeType: WorkflowNodeType;
      flowStatus: WorkflowFlowStatus;
      activityStatus: WorkflowActivityStatus;
      /** 流程变量（引擎侧为 `Map<String, Object>`） */
      variable?: Record<string, unknown> | null;
      /** 发起人（当前登录用户 id，Long ⇒ 字符串；「我发起的」列表里恒为当前用户） */
      createBy?: string | null;
      createTime: string;
      updateTime: string;
    };

    /**
     * 「我发起的」分页查询参数（对应后端 `ApiWorkflowInstancePageParam`）
     *
     * 「当前用户」不由前端传入，服务端从登录上下文取（`flow_instance.create_by`），
     * 因此本页只是「实例分页 + 三个过滤器」，没有任何用户参数。
     */
    type WorkflowInstanceSearchParams = {
      /** 流程名称（模糊匹配，取自流程定义） */
      flowName?: string;
      /** 流程状态（等值匹配） */
      flowStatus?: WorkflowFlowStatus;
      /** 业务单号（等值匹配） */
      businessId?: string;
    } & Common.CommonSearchParams;

    /** workflow instance list（对应后端 Paging&lt;WorkflowInstanceAO&gt;） */
    type WorkflowInstanceList = Common.PaginatingQueryRecord<WorkflowInstance>;

    /**
     * 实例级动作入参（对应后端 `ApiWorkflowInstanceActionParam`）
     *
     * 撤回 / 终止 / 拿回**共用同一个对象**，三个接口的 body 结构一致。
     * `message` 为空时后端不会补默认值（直接写进历史任务），兜底文案由页面给。
     */
    type WorkflowInstanceActionParams = {
      instanceId: WorkflowInstanceId;
      /** 审批意见（撤回 / 终止原因）；不传表示「没填」 */
      message?: string;
    };

    /**
     * 统一审批动作入参（对应后端 `ApiWorkflowHandleParam`）
     *
     * 页面实际只发 `taskId` / `action` / `message` / `nodeCode` / `targetHandlers`：
     * - `handler` 留空时后端取登录用户，前端不得传；
     * - `variable` 是引擎条件表达式的变量，本前端不使用；
     * - ⚠️ 后端**没有** `flowStatus` 字段（引擎 `FlowParams#flowStatus` 未被映射），
     *   所以参考项目里的「自定义流程状态」在前端无处可去，未实现。
     */
    type WorkflowHandleParams = {
      taskId: WorkflowTaskId;
      /**
       * 动作（枚举名）
       *
       * - `FREE_JUMP` 必须带 `nodeCode`；
       * - `PASS` / `REJECT` 带 `nodeCode` 即为「任意通过 / 任意驳回」；
       * - `TRANSFER` / `DEPUTE` / `ADD_SIGNATURE` / `REDUCTION_SIGNATURE` 必须带 `targetHandlers`。
       */
      action: WorkflowAction;
      handler?: string;
      /** 审批意见 */
      message?: string;
      /** 目标节点编码 */
      nodeCode?: string;
      /** 目标办理人（用户 id 字符串数组） */
      targetHandlers?: string[];
      variable?: Record<string, unknown>;
    };

    /** 审批动作执行结果（对应后端 WorkflowHandleResultAO） */
    type WorkflowHandleResult = {
      /** 实际执行的动作，同样是枚举名 */
      action: WorkflowAction;
      taskId: WorkflowTaskId;
      /** 引擎是否真的改动了数据 */
      operated: boolean;
      /** 流转动作会带上流转后的实例；办理人调整动作不带 */
      instance?: WorkflowInstance | null;
    };
  }

  /**
   * 系统监控中心（carlos-monitor，接口前缀 /monitor）
   *
   * 对应后端 `carlos-monitor-bus` 各 controller。所有雪花 Long ID 经
   * `LongJsonComponent` 序列化为字符串下发，故 id 类字段一律 `string`。
   */
  namespace Monitor {
    /** 实例类型（字典 monitor_instance_type） */
    type InstanceType =
      | 'REDIS_STANDALONE'
      | 'REDIS_CLUSTER'
      | 'REDIS_SENTINEL'
      | 'POSTGRESQL'
      | 'MYSQL'
      | 'DM'
      | 'CLICKHOUSE'
      | 'MICROSERVICE';

    /** 环境（字典 monitor_env） */
    type MonitorEnv = 'dev' | 'test' | 'prod';

    /** 健康状态 */
    type HealthStatus = 'UNKNOWN' | 'UP' | 'DOWN';

    /** 告警级别 */
    type AlarmLevel = 'INFO' | 'WARN' | 'CRITICAL';

    /** 告警状态 */
    type AlarmStatus = 'FIRING' | 'CONFIRMED' | 'RECOVERED';

    /** 指标来源 */
    type MetricSource = 'REDIS' | 'DB' | 'SERVICE';

    // ==================== 监控大盘（DashboardController） ====================

    /** 大盘汇总（DashboardSummaryVO） */
    interface DashboardSummary {
      totalInstances: number;
      upCount: number;
      downCount: number;
      unknownCount: number;
      typeStats: DashboardTypeStat[];
      alarmStats: DashboardLevelStat[];
      collectedLastHour: number;
      staleCount: number;
    }

    interface DashboardTypeStat {
      instanceType: string;
      total: number;
      up: number;
      down: number;
    }

    interface DashboardLevelStat {
      alarmLevel: string;
      count: number;
    }

    /** 跨实例趋势（DashboardTrendVO） */
    interface DashboardTrend {
      metricName: string;
      range: string;
      series: DashboardTrendSeries[];
    }

    interface DashboardTrendSeries {
      instanceId: string;
      instanceName: string;
      points: DashboardTrendPoint[];
    }

    interface DashboardTrendPoint {
      ts: string;
      value: number;
    }

    /** 异常滚动（AbnormalVO） */
    interface DashboardAbnormal {
      abnormalInstances: AbnormalInstance[];
      alarms: AlarmRecord[];
    }

    interface AbnormalInstance {
      instanceId: string;
      instanceName: string;
      instanceType: string;
      env: string;
      healthStatus: string;
      lastCollectTime?: string;
    }

    // ==================== 实例管理（MonitorInstanceController） ====================

    /** 监控实例（InstanceVO） */
    interface Instance {
      id: string;
      instanceName: string;
      instanceType: InstanceType;
      env: MonitorEnv;
      groupId?: string;
      groupName?: string;
      addresses: string;
      dbName?: string;
      dbIndex?: number;
      username?: string;
      hasPassword?: boolean;
      extConfig?: string;
      collectEnabled?: boolean;
      collectInterval?: number;
      connectTimeout?: number;
      socketTimeout?: number;
      manageEnabled?: boolean;
      sqlWriteEnabled?: boolean;
      healthStatus?: HealthStatus;
      lastCollectTime?: string;
      remark?: string;
      appNames?: string[];
      createTime?: string;
      updateTime?: string;
    }

    type InstanceList = Common.PaginatingQueryRecord<Instance>;

    type InstanceSearchParams = Partial<
      Pick<Instance, 'instanceName' | 'instanceType' | 'env' | 'groupId' | 'healthStatus'> & {
        keyword?: string;
      } & Common.CommonSearchParams
    >;

    /** 新增/编辑实例入参（InstanceCreateParam / InstanceUpdateParam） */
    interface InstanceOperateParams {
      id?: string;
      instanceName: string;
      instanceType: InstanceType;
      env: MonitorEnv;
      groupId?: string;
      addresses: string;
      dbName?: string;
      dbIndex?: number;
      username?: string;
      /** 明文密码；编辑时留空表示不修改 */
      password?: string;
      extConfig?: string;
      collectEnabled?: boolean;
      collectInterval?: number;
      connectTimeout?: number;
      socketTimeout?: number;
      manageEnabled?: boolean;
      sqlWriteEnabled?: boolean;
      remark?: string;
      appNames?: string[];
    }

    /** 启停状态入参（InstanceStatusParam） */
    interface InstanceStatusParams {
      collectEnabled?: boolean;
      manageEnabled?: boolean;
      sqlWriteEnabled?: boolean;
    }

    /** 测试连接入参（TestConnectionParam） */
    interface TestConnectionParams {
      instanceId?: string;
      instanceType?: InstanceType;
      addresses?: string;
      dbName?: string;
      dbIndex?: number;
      username?: string;
      password?: string;
      extConfig?: string;
      connectTimeout?: number;
      socketTimeout?: number;
    }

    /** 测试连接结果（TestConnectionVO） */
    interface TestConnectionResult {
      success: boolean;
      version?: string;
      role?: string;
      elapsedMs?: number;
      nodes?: TestConnectionNode[];
      errorMsg?: string;
    }

    interface TestConnectionNode {
      address: string;
      role: string;
      status: string;
    }

    /** Nacos 自动发现草稿（InstanceDraftVO） */
    interface InstanceDraft {
      instanceName?: string;
      instanceType?: InstanceType;
      addresses?: string;
      dbName?: string;
      dbIndex?: number;
      username?: string;
      sourceConfig?: string;
    }

    // ==================== 分组管理（MonitorGroupController） ====================

    /** 实例分组（InstanceGroupVO） */
    interface InstanceGroup {
      id: string;
      groupName: string;
      description?: string;
      orderNum?: number;
      roleIds?: string[];
      createTime?: string;
      updateTime?: string;
    }

    type InstanceGroupList = Common.PaginatingQueryRecord<InstanceGroup>;

    type InstanceGroupSearchParams = Partial<Pick<InstanceGroup, 'groupName'> & Common.CommonSearchParams>;

    interface InstanceGroupOperateParams {
      id?: string;
      groupName: string;
      description?: string;
      orderNum?: number;
      roleIds?: string[];
    }

    // ==================== Redis 监控（RedisMetricsController） ====================

    /** 当前指标快照（MetricCurrentVO）：指标名 → {v, ts} 快照值（JSON 字符串或直接值） */
    interface MetricCurrent {
      metrics: Record<string, string>;
    }

    /** 指标时序点（HistoryPointVO） */
    interface HistoryPoint {
      ts: string;
      value?: number;
      avgValue?: number;
      maxValue?: number;
      minValue?: number;
      p95Value?: number;
      pointCount?: number;
    }

    /** Redis 节点（RedisNodeVO） */
    interface RedisNode {
      address: string;
      role: string;
      status?: string;
      slots?: string;
      masterAddress?: string;
    }

    /** 慢日志分页（SlowlogPageVO） */
    interface SlowlogPage {
      records: SlowlogRecord[];
      nextOffset?: number;
      hasMore?: boolean;
    }

    interface SlowlogRecord {
      node?: string;
      slowlogId?: number;
      ts?: string;
      durationUs?: number;
      command?: string;
      clientAddr?: string;
    }

    /** 大 key / 热 key 报告（BigkeyReportVO） */
    interface BigkeyReport {
      id: string;
      instanceId: string;
      reportType?: string;
      triggerType?: string;
      scanStatus?: string;
      scannedKeys?: number;
      sampleRate?: number;
      startTime?: string;
      endTime?: string;
      errorMsg?: string;
      createTime?: string;
    }

    type BigkeyReportList = Common.PaginatingQueryRecord<BigkeyReport>;

    /** 大 key / 热 key 明细（BigkeyReportItemVO） */
    interface BigkeyReportItem {
      id: string;
      reportId: string;
      nodeAddress?: string;
      redisKey?: string;
      keyType?: string;
      memoryBytes?: number;
      elementCount?: number;
      ttlSeconds?: number;
      accessFreq?: number;
      estimated?: boolean;
    }

    type BigkeyReportItemList = Common.PaginatingQueryRecord<BigkeyReportItem>;

    // ==================== Redis 数据管理（RedisDataController） ====================

    /** SCAN 结果（KeyScanVO） */
    interface KeyScanResult {
      keys: string[];
      nextCursor?: string;
      scannedCount?: number;
      finished?: boolean;
    }

    /** key 树形节点（KeyTreeNodeVO） */
    interface KeyTreeNode {
      name: string;
      fullKey?: string;
      type?: string;
      leaf?: boolean;
      keyCount?: number;
    }

    /** key 树形分级浏览结果（KeyTreeVO） */
    interface KeyTreeResult {
      nodes: KeyTreeNode[];
      nextCursor?: string;
      scannedCount?: number;
      finished?: boolean;
      /** folder 计数是否为近似值（扫描未完整时为 true） */
      approximate?: boolean;
    }

    /** Redis 逻辑库信息（RedisDatabaseVO） */
    interface RedisDatabaseInfo {
      index: number;
      keyCount?: number;
      expires?: number;
      avgTtl?: number;
      totalDbs?: number;
    }

    /** key 详情（KeyDetailVO） */
    interface KeyDetail {
      key: string;
      type: string;
      ttlSeconds?: number;
      memoryBytes?: number;
      elementCount?: number;
      value?: unknown;
      subCursor?: string;
      subFinished?: boolean;
    }

    /** 新增 key 入参（KeyCreateParam） */
    interface KeyCreateParams {
      key: string;
      type: string;
      value?: string;
      field?: string;
      score?: number;
      ttlSeconds?: number;
    }

    /** 修改 key 入参（KeyUpdateParam） */
    interface KeyUpdateParams {
      key: string;
      operation: 'set-value' | 'hash-put' | 'add-element' | 'remove-element' | 'expire' | 'persist' | 'rename';
      type?: string;
      value?: string;
      field?: string;
      element?: string;
      score?: number;
      ttlSeconds?: number;
      newKey?: string;
    }

    /** 批量删除入参（BatchDeleteParam） */
    interface BatchDeleteParams {
      pattern?: string;
      keys?: string[];
    }

    /** 确认令牌（ConfirmTokenVO） */
    interface ConfirmToken {
      token: string;
      ttlSeconds?: number;
    }

    // ==================== 数据库监控（DbMetricsController） ====================

    /** 慢 SQL 分页（SlowSqlPageVO） */
    interface SlowSqlPage {
      records: SlowSqlRecord[];
      nextOffset?: number;
      hasMore?: boolean;
    }

    interface SlowSqlRecord {
      fingerprint?: string;
      sampleSql?: string;
      dbName?: string;
      execCount?: number;
      avgMs?: number;
      maxMs?: number;
      lastExecTime?: string;
      collectTime?: string;
    }

    /** 数据库会话（DbSessionRow） */
    interface DbSession {
      sessionId: string;
      username?: string;
      dbName?: string;
      state?: string;
      query?: string;
      durationSec?: number;
      clientAddr?: string;
      backendStart?: string;
    }

    /** 数据库锁（DbLockRow） */
    interface DbLock {
      lockType?: string;
      mode?: string;
      relation?: string;
      sessionId?: string;
      granted?: boolean;
      blockingSessionId?: string;
      query?: string;
    }

    /** 容量快照（CapacitySnapshotVO） */
    interface CapacitySnapshot {
      snapshotDate?: string;
      schemaName?: string;
      tableName?: string;
      tableRows?: number;
      tableSizeBytes?: number;
      indexSizeBytes?: number;
      createTime?: string;
    }

    // ==================== 数据库数据（DbDataController / SqlConsoleController） ====================

    /** 表信息（DbTableRow） */
    interface DbTable {
      schemaName: string;
      tableName: string;
      tableType?: string;
      comment?: string;
      estimatedRows?: number;
    }

    /** 列信息（DbColumnRow） */
    interface DbColumn {
      columnName: string;
      dataType: string;
      nullable?: boolean;
      defaultValue?: string;
      comment?: string;
      primaryKey?: boolean;
    }

    /** SQL 执行结果（SqlExecResultVO） */
    interface SqlExecResult {
      columns?: string[];
      rows?: Record<string, unknown>[];
      affectedRows?: number;
      truncated?: boolean;
    }

    /** SQL 执行历史（SqlHistoryVO） */
    interface SqlHistory {
      id: string;
      instanceId: string;
      executeBy?: string;
      sqlText?: string;
      sqlType?: string;
      execStatus?: string;
      blockReason?: string;
      affectedRows?: number;
      resultRows?: number;
      durationMs?: number;
      clientIp?: string;
      executeTime?: string;
    }

    type SqlHistoryList = Common.PaginatingQueryRecord<SqlHistory>;

    type SqlHistorySearchParams = {
      instanceId: string;
      sqlType?: string;
      execStatus?: string;
      executeBy?: string;
      start?: string;
      end?: string;
    } & Common.CommonSearchParams;

    // ==================== 微服务监控（ServiceMonitorController） ====================

    /** 服务清单项（ServiceSummaryVO） */
    interface ServiceSummary {
      serviceName: string;
      instanceId?: string;
      instanceCount?: number;
      healthyCount?: number;
      healthStatus?: HealthStatus;
      lastCollectTime?: string;
      disabled?: boolean;
    }

    /** 服务实例明细（ServiceInstanceVO） */
    interface ServiceInstance {
      ip: string;
      port: number;
      healthy?: boolean;
      weight?: number;
      metadata?: Record<string, string>;
      actuatorHealth?: string;
    }

    /** 日志级别调整入参（LoggerUpdateParam） */
    interface LoggerUpdateParams {
      instanceAddr: string;
      loggerName: string;
      level: string;
      ttlSeconds: number;
    }

    // ==================== 告警中心（AlarmRecordController / AlarmRuleController） ====================

    /** 告警记录（AlarmRecordVO） */
    interface AlarmRecord {
      id: string;
      ruleId?: string;
      ruleName?: string;
      instanceId?: string;
      instanceName?: string;
      metricName?: string;
      metricValue?: number;
      thresholdValue?: number;
      alarmLevel?: AlarmLevel;
      alarmStatus?: AlarmStatus;
      alarmContent?: string;
      firstTriggerTime?: string;
      lastTriggerTime?: string;
      recoverTime?: string;
      notifyStatus?: string;
      confirmBy?: string;
      confirmTime?: string;
      handleRemark?: string;
    }

    type AlarmRecordList = Common.PaginatingQueryRecord<AlarmRecord>;

    type AlarmRecordSearchParams = {
      alarmStatus?: AlarmStatus;
      alarmLevel?: AlarmLevel;
      instanceId?: string;
      ruleId?: string;
      start?: string;
      end?: string;
    } & Common.CommonSearchParams;

    /** 告警规则（AlarmRuleVO） */
    interface AlarmRule {
      id: string;
      ruleName: string;
      metricSource: MetricSource;
      targetType: string;
      targetId?: string;
      metricName: string;
      conditionOp: string;
      thresholdValue: number;
      durationCount?: number;
      alarmLevel: AlarmLevel;
      notifyChannels?: string;
      notifyTargets?: { userIds?: string[]; roleIds?: string[] };
      enabled?: boolean;
      remark?: string;
      createTime?: string;
      updateTime?: string;
    }

    type AlarmRuleList = Common.PaginatingQueryRecord<AlarmRule>;

    type AlarmRuleSearchParams = Partial<
      Pick<AlarmRule, 'ruleName' | 'metricSource' | 'alarmLevel'> & {
        /** 启用开关（查询串传 'true'/'false'，后端 Boolean 绑定） */
        enabled?: string;
      } & Common.CommonSearchParams
    >;

    /** 新增/编辑规则入参（AlarmRuleCreateParam / AlarmRuleUpdateParam） */
    interface AlarmRuleOperateParams {
      id?: string;
      ruleName: string;
      metricSource: MetricSource;
      targetType: string;
      targetId?: string;
      metricName: string;
      conditionOp: string;
      thresholdValue: number;
      durationCount?: number;
      alarmLevel: AlarmLevel;
      notifyChannels?: string;
      userIds?: string[];
      roleIds?: string[];
      remark?: string;
    }

    /** 内置规则模板（AlarmRuleTemplateVO） */
    interface AlarmRuleTemplate {
      templateCode: string;
      ruleName: string;
      metricSource: MetricSource;
      metricName: string;
      conditionOp: string;
      thresholdValue: number;
      durationCount?: number;
      alarmLevel: AlarmLevel;
      description?: string;
    }

    /** 静默设置入参（AlarmSilenceCreateParam） */
    interface AlarmSilenceCreateParams {
      ruleId: string;
      instanceId?: string;
      silenceStart: string;
      silenceEnd: string;
      reason?: string;
    }
  }

  // ============================================================
  // 开发工具平台（carlos-devkit，网关前缀 /devkit）
  // ============================================================
  namespace Devkit {
    // ------------------------------------------------------------
    // 公共枚举
    // ------------------------------------------------------------

    /**
     * 模板类型 / 生成业务类型（对应后端 `TemplateTypeEnum`，@AppEnum("DevkitTemplateType")）
     *
     * 承载字段是 Integer（库表 SMALLINT），JSON 下发**数字码**。
     */
    type TemplateType = 1 | 2;

    /**
     * 启用状态（对应后端 `DevkitStatusEnum`，@AppEnum("DevkitStatus")）
     *
     * 承载字段是 Integer（库表 SMALLINT），JSON 下发**数字码**。
     *
     * - 1: 启用
     * - 0: 停用
     */
    type Status = 0 | 1;

    /**
     * 模板文件类型（对应后端 `TemplateFileTypeEnum`，@AppEnum("DevkitTemplateFileType")）
     *
     * - 1: 模板文件（.ftl，需渲染）
     * - 2: 静态资源（直接拷贝）
     */
    type TemplateFileType = 1 | 2;

    /**
     * 目标数据库类型（对应后端 `DbTypeEnum`，@AppEnum("DevkitDbType")）
     *
     * 承载字段是 **Java 枚举类型**（库表 VARCHAR），JSON 下发**常量名**，
     * 因此下拉必须走 `enumDictNameOptions`（按常量名取文案），不能按数字码。
     */
    type DbType = 'MYSQL' | 'POSTGRESQL';

    /**
     * 数据库字段 → Java 属性命名方式（对应后端 `FieldNameTypeEnum`，@AppEnum("DevkitFieldNameType")）
     *
     * 与 `DbType` 同理：JSON 下发常量名。
     */
    type FieldNameType =
      | 'NOT_PREFIX_AND_UNDERLINE'
      | 'NOT_PREFIX_AND_CAMEL'
      | 'PREFIX_AND_UNDERLINE'
      | 'PREFIX_AND_CAMEL'
      | 'ALL_UPPER';

    /** 模板文件树节点类型（后端自定义字符串，非 BaseEnum） */
    type TemplateNodeType = 'dir' | 'file';

    /**
     * devkit 公共审计字段
     *
     * ⚠️ **不能用 `Common.CommonRecord<T>`**：它自带 `status: EnableStatus`（`'1' | '2'`），
     * 与 devkit 的 `Status`（数字 `0 | 1`）相交后会塌成 `never`，整条记录类型报废。
     * 因此这里平铺一份等价的公共字段（后端 Long 经 `LongJsonComponent` 下发为字符串）。
     */
    interface BaseRecord {
      id: string;
      createBy: string;
      createTime: string;
      updateBy: string;
      updateTime: string;
    }

    // ------------------------------------------------------------
    // 模板组
    // ------------------------------------------------------------

    interface TemplateGroup extends BaseRecord {
      /** 模板组编码（全局唯一，创建后不可改） */
      groupCode: string;
      /** 模板组名称 */
      groupName: string;
      /** 描述 */
      description?: string;
      /** 模板类型：1=代码生成 2=工程生成 */
      templateType: TemplateType;
      /** 技术栈编码，如 MYBATIS / SPRINGBOOT */
      techStack?: string;
      /** 适用数据库：MYSQL/POSTGRESQL/ANY，工程生成为空 */
      dbType?: string;
      /** 物化时模板根目录名，默认 template */
      templateRoot?: string;
      /** 逻辑删除字段名清单（逗号分隔） */
      logicDeleteFields?: string;
      /** 乐观锁版本字段名清单（逗号分隔） */
      versionFields?: string;
      /** 通用字段名清单（逗号分隔） */
      commonFields?: string;
      /** 是否内置模板（内置不可删除，仅可停用） */
      builtIn?: boolean;
      /** 状态：1=启用 0=停用 */
      status: Status;
      /** 排序值 */
      sortNum?: number;
      /** 备注 */
      remark?: string;
      /** 模板文件数（列表回填） */
      fileCount?: number;
    }

    type TemplateGroupSearchParams = Partial<
      Pick<TemplateGroup, 'groupName' | 'groupCode' | 'templateType' | 'techStack' | 'status'>
    > &
      Common.CommonSearchParams;

    type TemplateGroupList = Common.PaginatingQueryRecord<TemplateGroup>;

    /** 模板组新增参数 */
    type TemplateGroupCreateParams = Pick<
      TemplateGroup,
      | 'groupCode'
      | 'groupName'
      | 'description'
      | 'templateType'
      | 'techStack'
      | 'dbType'
      | 'templateRoot'
      | 'logicDeleteFields'
      | 'versionFields'
      | 'commonFields'
      | 'sortNum'
      | 'remark'
    >;

    /**
     * 模板组编辑参数（不含 groupCode：编码创建后不可改）
     *
     * `status` 单独拎出来置为可选：`Pick` 会保留 `TemplateGroup.status` 的必填性，
     * 而编辑表单里它是可选的（不传表示不改状态）。
     */
    type TemplateGroupUpdateParams = Omit<
      Pick<
        TemplateGroup,
        | 'id'
        | 'groupName'
        | 'description'
        | 'techStack'
        | 'dbType'
        | 'templateRoot'
        | 'logicDeleteFields'
        | 'versionFields'
        | 'commonFields'
        | 'status'
        | 'sortNum'
        | 'remark'
      >,
      'status'
    > & { status?: Status };

    /** 模板组复制参数 */
    interface TemplateGroupCopyParams {
      id: string;
      newGroupCode: string;
      newGroupName: string;
      copyFiles?: boolean;
    }

    // ------------------------------------------------------------
    // 模板文件（树 / 在线编辑）
    // ------------------------------------------------------------

    /** 模板文件树节点（后端 TemplateFileNodeVO） */
    interface TemplateFileNode {
      /** 节点 key（目录=dir:路径，文件=file:ID） */
      key: string;
      /** 节点标题 */
      title: string;
      /** 节点类型 */
      nodeType: TemplateNodeType;
      /** 文件 ID（仅文件节点） */
      fileId?: string;
      /** 组内相对路径 */
      filePath?: string;
      /** 文件类型：1=模板 2=静态资源（仅文件节点） */
      fileType?: TemplateFileType;
      /** 是否循环渲染（仅文件节点） */
      loopFlag?: boolean;
      /** 文件大小（仅文件节点） */
      fileSize?: number;
      /** 状态（仅文件节点） */
      status?: Status;
      /** 子节点 */
      children?: TemplateFileNode[];
    }

    /** 模板文件详情（含正文，后端 TemplateFileVO） */
    interface TemplateFile {
      id: string;
      groupId: string;
      /** 模板组名称（仅详情接口回填） */
      groupName?: string;
      /** 组内相对路径 */
      filePath: string;
      /** 文件名 */
      fileName: string;
      /** 扩展名 */
      fileExt?: string;
      /** 文件类型 */
      fileType: TemplateFileType;
      /** 是否循环渲染（文件名含 [for]） */
      loopFlag?: boolean;
      /** 文件正文 */
      content?: string;
      /** 正文编码：TEXT / BASE64 */
      contentEncoding?: string;
      /** 正文大小（字节） */
      fileSize?: number;
      /** 正文 MD5 */
      md5?: string;
      /** 状态 */
      status?: Status;
      /** 备注 */
      remark?: string;
      /** 更新时间 */
      updateTime?: string;
    }

    /** 模板文件新增参数 */
    interface TemplateFileCreateParams {
      groupId: string;
      filePath: string;
      content?: string;
      fileType: TemplateFileType;
      remark?: string;
    }

    /** 模板文件保存参数 */
    interface TemplateFileSaveParams {
      id: string;
      content: string;
      changeLog?: string;
    }

    /** 模板文件重命名参数 */
    interface TemplateFileRenameParams {
      id: string;
      newPath: string;
    }

    // ------------------------------------------------------------
    // 模板版本历史
    // ------------------------------------------------------------

    interface TemplateVersion {
      id: string;
      templateId: string;
      versionNo: number;
      filePath: string;
      /** 正文快照（仅详情接口下发） */
      content?: string;
      fileSize?: number;
      md5?: string;
      changeLog?: string;
      createBy?: string;
      createTime?: string;
    }

    type TemplateVersionList = Common.PaginatingQueryRecord<TemplateVersion>;

    /** 单模板渲染预览结果（后端 TemplateRenderPreviewVO） */
    interface TemplateRenderPreview {
      success: boolean;
      content?: string;
      error?: string;
    }

    // ------------------------------------------------------------
    // 受管数据源
    // ------------------------------------------------------------

    interface DataSource extends BaseRecord {
      /** 数据源名称（全局唯一） */
      dsName: string;
      /** 数据源编码 */
      dsCode?: string;
      /** 数据库类型 */
      dbType: DbType;
      /** 主机地址 */
      host: string;
      /** 端口 */
      port: number;
      /** 库名 */
      databaseName?: string;
      /** 默认 schema（PostgreSQL 专用） */
      schemaName?: string;
      /** 用户名 */
      username?: string;
      /**
       * 是否已配置密码
       *
       * ⚠️ 后端**任何接口都不回发密码**，只回这个布尔标记。
       */
      hasPassword?: boolean;
      /** 额外 JDBC 参数 */
      jdbcParams?: string;
      /** 是否只读数据源 */
      readOnly?: boolean;
      /** 状态 */
      status: Status;
      /** 备注 */
      remark?: string;
    }

    type DataSourceSearchParams = Partial<Pick<DataSource, 'dsName' | 'dbType' | 'status'>> & Common.CommonSearchParams;

    type DataSourceList = Common.PaginatingQueryRecord<DataSource>;

    /** 数据源新增参数（password 为明文入参，后端 SM4 加密后落库） */
    interface DataSourceCreateParams {
      dsName: string;
      dsCode?: string;
      dbType: DbType;
      host: string;
      port: number;
      databaseName?: string;
      schemaName?: string;
      username?: string;
      password?: string;
      jdbcParams?: string;
      readOnly?: boolean;
      remark?: string;
    }

    /** 数据源编辑参数（password 留空表示保持原值） */
    type DataSourceUpdateParams = DataSourceCreateParams & { id: string; status?: Status };

    /** 数据源连接测试参数（传 id 且密码留空时用库中已存密码） */
    interface DataSourceTestParams {
      id?: string;
      dbType: DbType;
      host: string;
      port: number;
      databaseName?: string;
      schemaName?: string;
      username?: string;
      password?: string;
      jdbcParams?: string;
    }

    /** 连接测试结果（后端 TestConnectionVO） */
    interface TestConnectionResult {
      success: boolean;
      databaseName?: string;
      databaseVersion?: string;
      /** 响应耗时（毫秒；后端 long 经 LongJsonComponent 下发为字符串） */
      responseTimeMs?: string;
      errorMessage?: string;
    }

    // ------------------------------------------------------------
    // 代码生成 / 工程生成
    // ------------------------------------------------------------

    /** 目标库表清单项（后端 TableMetaVO） */
    interface TableMeta {
      name: string;
      comment?: string;
    }

    /** 目标库列元数据（后端 ColumnMetaVO） */
    interface ColumnMeta {
      columnName: string;
      columnDbType?: string;
      javaType?: string;
      columnComment?: string;
      primaryKey?: boolean;
      nullable?: boolean;
      autoIncrement?: boolean;
      logicField?: boolean;
      versionField?: boolean;
      commonField?: boolean;
      propertyName?: string;
    }

    /** 生成产物文件（后端 GeneratedFileVO；二进制文件不下发 content） */
    interface GeneratedFile {
      /** 相对产物根目录的路径（'/' 分隔） */
      path: string;
      /** 文件内容（仅文本文件下发，超长会截断） */
      content?: string;
      /** 是否文本文件 */
      text?: boolean;
      /** 字节数 */
      size?: number;
    }

    /** 生成产物预览结果（后端 GeneratedResultVO） */
    interface GeneratedResult {
      /** 产物根目录名 */
      rootName?: string;
      /** 产物文件数 */
      fileCount?: number;
      /** 产物总字节数（后端 long → 字符串） */
      totalSize?: string;
      /** 生成耗时毫秒（后端 long → 字符串） */
      durationMs?: string;
      /** 产物文件清单 */
      files: GeneratedFile[];
    }

    /** 代码生成参数（预览与下载共用，后端 CodeGenRunParam） */
    interface CodeGenRunParams {
      dsId: string;
      schema?: string;
      groupId: string;
      tableNames: string[];
      projectName: string;
      packageName: string;
      author?: string;
      useTablePrefix?: boolean;
      nameType?: FieldNameType;
    }

    /** 工程生成参数（预览与下载共用，后端 ProjectGenRunParam） */
    interface ProjectGenRunParams {
      /** 模板组 ID（后端字段名 templateGroupId） */
      templateGroupId: string;
      artifactId: string;
      projectName?: string;
      /** Maven groupId，同时作为包名（后端字段名 mavenGroupId） */
      mavenGroupId: string;
      version?: string;
      describe?: string;
      author?: string;
    }

    /** 单模板渲染预览参数（后端 TemplateRenderPreviewParam） */
    interface TemplateRenderPreviewParams {
      templateId: string;
      dsId: string;
      schema?: string;
      tableName: string;
      packageName?: string;
      author?: string;
      useTablePrefix?: boolean;
      nameType?: FieldNameType;
    }

    // ------------------------------------------------------------
    // 生成记录
    // ------------------------------------------------------------

    interface GenerateRecord extends BaseRecord {
      /** 业务类型：1=代码生成 2=工程生成 */
      bizType: TemplateType;
      templateGroupId?: string;
      templateGroupCode?: string;
      templateGroupName?: string;
      dsId?: string;
      dsName?: string;
      projectName?: string;
      packageName?: string;
      /** 生成参数 JSON 快照（列表接口不下发） */
      genParams?: string;
      /** 产物文件数 */
      fileCount?: number;
      /** 产物总字节数（后端 long → 字符串） */
      totalSize?: string;
      /** 生成耗时毫秒（后端 long → 字符串） */
      durationMs?: string;
      /** 状态：1=成功 0=失败 */
      status: Status;
      /** 失败原因 */
      errorMsg?: string;
    }

    type GenerateRecordSearchParams = Partial<
      Pick<GenerateRecord, 'bizType' | 'templateGroupCode' | 'projectName' | 'status'>
    > &
      Common.CommonSearchParams;

    type GenerateRecordList = Common.PaginatingQueryRecord<GenerateRecord>;
  }
}
