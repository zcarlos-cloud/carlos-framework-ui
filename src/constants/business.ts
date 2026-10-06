import { transformRecordToOption } from '@/utils/common';

/**
 * 配置值类型
 *
 * 对应后端 ConfigValueType，该枚举带 @JsonValue，以数字码字符串收发
 */
export const configValueTypeRecord: Record<Api.SystemManage.ConfigValueType, App.I18n.I18nKey> = {
  '1': 'page.manage.config.valueTypeOptions.text',
  '2': 'page.manage.config.valueTypeOptions.file'
};

export const configValueTypeOptions = transformRecordToOption(configValueTypeRecord);

/** 配置值类型对应的 Tag 颜色 */
export const configValueTypeTagColor: Record<Api.SystemManage.ConfigValueType, string> = {
  '1': 'blue',
  '2': 'orange'
};

/**
 * 字典类型
 *
 * 对应后端 DictTypeEnum，JSON 中以枚举名序列化
 */
export const dictTypeRecord: Record<Api.SystemManage.DictTypeEnum, App.I18n.I18nKey> = {
  NUMBER: 'page.manage.dict.typeOptions.number',
  STRING: 'page.manage.dict.typeOptions.string'
};

export const dictTypeOptions = transformRecordToOption(dictTypeRecord);

/** 字典类型对应的 Tag 颜色 */
export const dictTypeTagColor: Record<Api.SystemManage.DictTypeEnum, string> = {
  NUMBER: 'blue',
  STRING: 'green'
};

/**
 * 国际化语言标识
 *
 * 对应后端 sys_i18n_message.lang，用下划线格式存储（zh_CN / en_US），
 * 与前端 locale 的连字符格式（zh-CN）不同，勿混用
 */
export const i18nLangRecord: Record<Api.SystemManage.I18nLang, App.I18n.I18nKey> = {
  zh_CN: 'page.manage.i18n.langOptions.zhCN',
  en_US: 'page.manage.i18n.langOptions.enUS'
};

export const i18nLangOptions = transformRecordToOption(i18nLangRecord);

/**
 * 操作类型
 *
 * 对应后端 OperationType，JSON 中以枚举名序列化（不是 1/2 数字码）
 */
export const operationTypeRecord: Record<Api.SystemManage.OperationType, App.I18n.I18nKey> = {
  BUTTON: 'page.manage.operation.typeOptions.button',
  API: 'page.manage.operation.typeOptions.api'
};

export const operationTypeOptions = transformRecordToOption(operationTypeRecord);

/** 操作类型对应的 Tag 颜色 */
export const operationTypeTagColor: Record<Api.SystemManage.OperationType, string> = {
  BUTTON: 'blue',
  API: 'purple'
};

/**
 * 操作状态
 *
 * 对应后端 OperationStatus，同样以枚举名序列化
 */
export const operationStatusRecord: Record<Api.SystemManage.OperationStatus, App.I18n.I18nKey> = {
  ENABLED: 'page.manage.common.status.enable',
  DISABLED: 'page.manage.common.status.disable'
};

export const operationStatusOptions = transformRecordToOption(operationStatusRecord);

/** 操作状态对应的 Tag 颜色 */
export const operationStatusTagColor: Record<Api.SystemManage.OperationStatus, string> = {
  ENABLED: 'success',
  DISABLED: 'default'
};

/**
 * 文件存储类型
 *
 * 对应后端 FileStorageConfigVO.storageType（普通字符串，非枚举）
 */
export const storageTypeRecord: Record<Api.SystemManage.StorageConfig['storageType'], App.I18n.I18nKey> = {
  S3: 'page.manage.storageConfig.typeOptions.s3',
  LOCAL: 'page.manage.storageConfig.typeOptions.local'
};

export const storageTypeOptions = transformRecordToOption(storageTypeRecord);

/**
 * 客户端状态
 *
 * 对应后端 ClientStatusEnum（无 @JsonValue，code 为 1/2/3），
 * 但 AppClientPageVO.clientStatus 声明为 String，接口实测下发的是**枚举名**
 * （ENABLE / DISABLE / LOGGED_OUT）。此处按枚举名建表。
 */
export const clientStatusRecord: Record<string, App.I18n.I18nKey> = {
  ENABLE: 'page.manage.appClient.statusOptions.enable',
  DISABLE: 'page.manage.appClient.statusOptions.disable',
  LOGGED_OUT: 'page.manage.appClient.statusOptions.loggedOut'
};

export const clientStatusOptions = transformRecordToOption(clientStatusRecord);

/**
 * 风险等级分档
 *
 * 后端 riskLevel 为 0-100 的整数（四维度加权：操作类型 0-60 + 状态 0-20 + 主体 0-10 + 渠道 0-10），
 * 此处按分档映射为可读标签与 Tag 颜色。
 */
export type AuditRiskLevelKey = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const auditRiskLevelRecord: Record<AuditRiskLevelKey, App.I18n.I18nKey> = {
  LOW: 'page.audit.log.riskLevelOptions.low',
  MEDIUM: 'page.audit.log.riskLevelOptions.medium',
  HIGH: 'page.audit.log.riskLevelOptions.high',
  CRITICAL: 'page.audit.log.riskLevelOptions.critical'
};

/** 风险等级分档对应的 Tag 颜色 */
export const auditRiskLevelTagColor: Record<AuditRiskLevelKey, string> = {
  LOW: 'success',
  MEDIUM: 'processing',
  HIGH: 'warning',
  CRITICAL: 'error'
};

/**
 * 将 0-100 的风险分值归入分档
 *
 * @param riskLevel 风险分值，越界或缺失时按 LOW 处理
 */
export function getAuditRiskLevelKey(riskLevel?: number | null): AuditRiskLevelKey {
  if (riskLevel === null || riskLevel === undefined) {
    return 'LOW';
  }

  if (riskLevel >= 80) {
    return 'CRITICAL';
  }

  if (riskLevel >= 60) {
    return 'HIGH';
  }

  if (riskLevel >= 30) {
    return 'MEDIUM';
  }

  return 'LOW';
}

/**
 * 渠道配置（`channel_config`，jsonb）的形状**取决于 channelType**
 *
 * 这些键不是猜的，是从实际读取它的适配器源码里逐个抄出来的：
 * - 短信 `channel/sms/SmsChannelAdapter`：不调 `getConfigValue`，不读任何键
 * - 邮件 `channel/email/EmailChannelAdapter`：读 `from`
 * - 钉钉 `channel/dingtalk/DingtalkChannelAdapter`：读 `appKey` / `appSecret` / `agentId`
 * - 企业微信：**没有对应的适配器实现**（全仓 `WECHAT_WORK` 只出现在枚举里），配置项不会被读取
 * - 站内信 `channel/websocket/WebSocketChannelAdapter`：不读任何键
 *
 * 因为 `channel_config` 是 `jsonb NOT NULL` 且新增/修改都标了 `@NotBlank`，
 * 所以「不需要配置」的类型也**必须**填一个合法的 JSON —— 填 `{}`。
 * 原先表单对五种类型渲染同一个空文本域，既没样例也没提示，
 * 键名写错时发送链路只是静默失败（`getConfigValue` 拿不到值会走异常分支），
 * 而表单这一侧完全看不出来。
 */
export const channelConfigSampleRecord: Record<Api.Message.ChannelType, string> = {
  '1': '{}',
  '2': '{ "from": "noreply@example.com" }',
  '3': '{ "appKey": "xxx", "appSecret": "xxx", "agentId": "xxx" }',
  '4': '{}',
  '5': '{}'
};

/** 与 {@link channelConfigSampleRecord} 配套的说明文案（用 `:extra` 展示） */
export const channelConfigHintRecord: Record<Api.Message.ChannelType, App.I18n.I18nKey> = {
  '1': 'page.message.channel.configHint.sms',
  '2': 'page.message.channel.configHint.email',
  '3': 'page.message.channel.configHint.dingtalk',
  '4': 'page.message.channel.configHint.wechatWork',
  '5': 'page.message.channel.configHint.websocket'
};

/**
 * 行政区域类型
 *
 * 对应后端 `SysRegionCreateParam.regionType` 的说明：
 * 0 村下级 / 1 社区·村 / 2 街道·乡镇 / 3 区·县 / 4 市 / 5 省·直辖市
 *
 * ⚠️ 这是**派生字段**：后端 `SysRegionService#setRegionType` 在新增与修改时
 * 都会按上级区域重新推导（顶级 → "5"，否则 → 上级 type - 1），调用方传什么都会被覆盖。
 * 故表单里只读展示，仅搜索栏与列表用它。
 */

/*
 * 以下三组是 OAuth2 的**协议字面量**，刻意不本地化：它们要原样落库、并与 IdP 侧注册的信息
 * 逐字对齐，翻译成中文运维就对不上了。因此 label 直接用字面量，也不走 `translateOptions`。
 */

/**
 * 客户端认证方式
 *
 * ⚠️ 此前 `none` 的标签是 `` `none - ${$t('...statusOptions.enable')}` ``，渲染出来是
 * **「none - 启用」** —— 这把一个安全语义说反了：`none` 的含义是**不做客户端认证**，
 * 即公开客户端，任何拿到 `client_id` 的人都能冒充该应用。把最不安全的选项标成「启用」，
 * 等于诱导管理员去选它。现在标签只保留协议名，具体含义由表单的提示文案说明。
 */
export const appClientAuthMethodOptions: CommonType.Option<string, string>[] = [
  { value: 'none', label: 'none' },
  { value: 'client_secret_basic', label: 'client_secret_basic' },
  { value: 'client_secret_post', label: 'client_secret_post' }
];

/** 授权类型 */
export const appClientGrantTypeOptions: CommonType.Option<string, string>[] = [
  { value: 'authorization_code', label: 'authorization_code' },
  { value: 'refresh_token', label: 'refresh_token' },
  { value: 'client_credentials', label: 'client_credentials' }
];

/** 授权范围（tags 模式，可自由输入，这里只是常见值） */
export const appClientScopeOptions: CommonType.Option<string, string>[] = [
  { value: 'openid', label: 'openid' },
  { value: 'profile', label: 'profile' }
];

/**
 * 登录日志状态（S4）
 *
 * 与审计日志同源同值（SUCCESS/FAIL），但文案键独立落在 page.manage.loginLog 下：
 * 审计页改状态文案/增删枚举时不应静默改变登录日志页（vue-reviewer S4 MEDIUM#3）。
 */
export const loginLogStatusRecord: Record<Api.Auth.LoginLogStatus, App.I18n.I18nKey> = {
  SUCCESS: 'page.manage.loginLog.statusOptions.success',
  FAIL: 'page.manage.loginLog.statusOptions.fail'
};

export const loginLogStatusOptions = transformRecordToOption(loginLogStatusRecord);

/** 登录日志状态对应的 Tag 颜色 */
export const loginLogStatusTagColor: Record<Api.Auth.LoginLogStatus, string> = {
  SUCCESS: 'success',
  FAIL: 'error'
};

/**
 * 登录日志认证方式（S4）
 *
 * 与审计日志同源同值（对应后端 AuditLogAuthTypeEnum），但文案键独立落在
 * page.manage.loginLog 下：审计页调整认证方式文案/增删枚举时不应静默改变登录日志页。
 */
export const loginLogAuthTypeRecord: Record<Api.Audit.AuthType, App.I18n.I18nKey> = {
  PASSWORD: 'page.manage.loginLog.authTypeOptions.password',
  SMS: 'page.manage.loginLog.authTypeOptions.sms',
  OAUTH2: 'page.manage.loginLog.authTypeOptions.oauth2',
  LDAP: 'page.manage.loginLog.authTypeOptions.ldap',
  CERT: 'page.manage.loginLog.authTypeOptions.cert',
  QR_CODE: 'page.manage.loginLog.authTypeOptions.qrCode',
  FACE: 'page.manage.loginLog.authTypeOptions.face',
  FINGERPRINT: 'page.manage.loginLog.authTypeOptions.fingerprint'
};

export const loginLogAuthTypeOptions = transformRecordToOption(loginLogAuthTypeRecord);

/**
 * 编码规则-重置周期（S5，对应后端 SequenceResetCycleEnum）
 *
 * 后端 `@EnumValue Integer`，JSON 下发为**数字**，故不能走 `transformRecordToOption`
 * （Object.entries 会把数字键转成字符串，与 model 中的数字严格不相等）。
 */
export const sequenceResetCycleOptions: CommonType.Option<Api.SystemManage.SequenceResetCycle, App.I18n.I18nKey>[] = [
  { value: 1, label: 'page.manage.sequence.resetNever' },
  { value: 2, label: 'page.manage.sequence.resetDaily' },
  { value: 3, label: 'page.manage.sequence.resetMonthly' },
  { value: 4, label: 'page.manage.sequence.resetYearly' }
];

/**
 * 编码规则-重置周期文案
 *
 * 列表列与表单下拉都走这份本地字典；后端下发的 `resetCycleName`（中文）前端不使用 ——
 * i18n 优先，切英文时后端那串中文不会跟着变。
 */
export const sequenceResetCycleRecord: Record<Api.SystemManage.SequenceResetCycle, App.I18n.I18nKey> = {
  1: 'page.manage.sequence.resetNever',
  2: 'page.manage.sequence.resetDaily',
  3: 'page.manage.sequence.resetMonthly',
  4: 'page.manage.sequence.resetYearly'
};

/** 编码规则-重置周期 Tag 颜色 */
export const sequenceResetCycleTagColor: Record<Api.SystemManage.SequenceResetCycle, string> = {
  1: 'default',
  2: 'blue',
  3: 'purple',
  4: 'gold'
};

/**
 * 编码规则-日期段格式（对应后端 SequenceDatePatternEnum，字符串白名单）
 *
 * 首项空串表示「编码中不含日期段」——此时重置周期只能是「永不重置」，
 * 否则跨周期流水归零会产生重复编码（后端会以 20984 拒绝）。
 */
export const sequenceDatePatternOptions: CommonType.Option<
  Api.SystemManage.SequenceDatePattern | '',
  App.I18n.I18nKey
>[] = [
  { value: '', label: 'page.manage.sequence.datePatternNone' },
  { value: 'yyyy', label: 'page.manage.sequence.datePatternYear' },
  { value: 'yyyyMM', label: 'page.manage.sequence.datePatternMonth' },
  { value: 'yyyyMMdd', label: 'page.manage.sequence.datePatternDay' },
  { value: 'yyyyMMddHH', label: 'page.manage.sequence.datePatternHour' },
  { value: 'yyyyMMddHHmmss', label: 'page.manage.sequence.datePatternSecond' }
];

/**
 * 编码规则-「日期段格式 → 允许的重置周期」白名单（S5）
 *
 * 这是后端 `SysSequenceRuleService#validateRule` 中「重置周期不得短于日期段粒度」
 * 这条不变式的前端镜像（违反时后端以 20986 拒绝）。两个字段是**独立下拉**，
 * 可以任意组合，所以必须在前端收敛可选项，否则用户能拼出「按月日期段 + 按日重置」——
 * 编码里只有月份段，重置其实发生在月切换时，配置与意图不符。
 *
 * 口径与后端 `SequenceCodeFormatter.isCycleCompatible` 一致（比较的是**语义时长**：周期 vs 粒度，
 * 不是 TTL）：按日/按月/按年 = 1 天/31 天/366 天；yyyy 段 = 366 天、yyyyMM = 31 天、
 * yyyyMMdd = 1 天、yyyyMMddHH = 1 小时、yyyyMMddHHmmss = 1 秒。
 * ⚠️ 改这里必须同步改后端（两处口径一变，这张表的边界就会漂移）。
 */
export const sequenceDatePatternResetCycles: Record<
  Api.SystemManage.SequenceDatePattern | '',
  Api.SystemManage.SequenceResetCycle[]
> = {
  '': [1],
  yyyy: [1, 4],
  yyyyMM: [1, 3, 4],
  yyyyMMdd: [1, 2, 3, 4],
  yyyyMMddHH: [1, 2, 3, 4],
  yyyyMMddHHmmss: [1, 2, 3, 4]
};
