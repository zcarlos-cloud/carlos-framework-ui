import { request } from '../request';

/**
 * 系统监控中心 API（carlos-monitor，经网关访问，前缀 /monitor）
 *
 * 覆盖后端 carlos-monitor-bus 全部 controller：
 * DashboardController / MonitorInstanceController / MonitorGroupController /
 * RedisMetricsController / RedisDataController / DbMetricsController /
 * DbDataController / SqlConsoleController / ServiceMonitorController /
 * AlarmRuleController / AlarmRecordController。
 */

// ==================== 监控大盘 ====================

/** 大盘汇总：实例总数/健康/异常（按类型）、告警数（按级别）、采集状态 */
export function fetchGetDashboardSummary() {
  return request<Api.Monitor.DashboardSummary>({
    url: '/monitor/dashboard/summary',
    method: 'get'
  });
}

/** 跨实例关键指标趋势（Top N 实例小时聚合） */
export function fetchGetDashboardTrend(params: { metric: string; range?: string; topN?: number }) {
  return request<Api.Monitor.DashboardTrend>({
    url: '/monitor/dashboard/trend',
    method: 'get',
    params
  });
}

/** 异常滚动：异常实例 + 最新未恢复告警 */
export function fetchGetDashboardAbnormal(alarmLimit?: number) {
  return request<Api.Monitor.DashboardAbnormal>({
    url: '/monitor/dashboard/abnormal',
    method: 'get',
    params: { alarmLimit }
  });
}

// ==================== 实例管理 ====================

/** 实例分页：类型/环境/分组/健康/关键字过滤 */
export function fetchGetInstanceList(params?: Api.Monitor.InstanceSearchParams) {
  return request<Api.Monitor.InstanceList>({
    url: '/monitor/instances/page',
    method: 'get',
    params
  });
}

/** 实例下拉列表（InstanceSelect 用，一次拉取前 500 条） */
export function fetchGetInstanceOptions(params?: Omit<Api.Monitor.InstanceSearchParams, 'current' | 'size'>) {
  return request<Api.Monitor.InstanceList>({
    url: '/monitor/instances/page',
    method: 'get',
    params: { current: 1, size: 500, ...params }
  });
}

/** 实例详情（不含密码） */
export function fetchGetInstanceDetail(id: string) {
  return request<Api.Monitor.Instance>({
    url: `/monitor/instances/${id}`,
    method: 'get'
  });
}

/** 新增实例（保存前服务端强制一次连接测试） */
export function fetchAddInstance(data: Api.Monitor.InstanceOperateParams) {
  return request<string>({
    url: '/monitor/instances',
    method: 'post',
    data
  });
}

/** 编辑实例 */
export function fetchUpdateInstance(data: Api.Monitor.InstanceOperateParams) {
  return request<boolean>({
    url: '/monitor/instances',
    method: 'put',
    data
  });
}

/** 删除实例（逻辑删除 + 停采） */
export function fetchDeleteInstance(id: string) {
  return request<boolean>({
    url: `/monitor/instances/${id}`,
    method: 'delete'
  });
}

/** 测试连接：返回版本/角色/节点/耗时 */
export function fetchTestConnection(data: Api.Monitor.TestConnectionParams) {
  return request<Api.Monitor.TestConnectionResult>({
    url: '/monitor/instances/test-connection',
    method: 'post',
    data
  });
}

/** 启停采集/数据管理/SQL 写 */
export function fetchUpdateInstanceStatus(id: string, data: Api.Monitor.InstanceStatusParams) {
  return request<boolean>({
    url: `/monitor/instances/${id}/status`,
    method: 'put',
    data
  });
}

/** Nacos 配置自动发现实例草稿 */
export function fetchDiscoverInstances(data: { appName: string; group?: string }) {
  return request<Api.Monitor.InstanceDraft[]>({
    url: '/monitor/instances/discover',
    method: 'post',
    data
  });
}

// ==================== 分组管理 ====================

/** 分组分页 */
export function fetchGetGroupList(params?: Api.Monitor.InstanceGroupSearchParams) {
  return request<Api.Monitor.InstanceGroupList>({
    url: '/monitor/groups/page',
    method: 'get',
    params
  });
}

/** 分组全量列表（下拉用，含授权角色ID） */
export function fetchGetAllGroups() {
  return request<Api.Monitor.InstanceGroup[]>({
    url: '/monitor/groups/list',
    method: 'get'
  });
}

/** 新增分组 */
export function fetchAddGroup(data: Api.Monitor.InstanceGroupOperateParams) {
  return request<string>({
    url: '/monitor/groups',
    method: 'post',
    data
  });
}

/** 编辑分组 */
export function fetchUpdateGroup(data: Api.Monitor.InstanceGroupOperateParams) {
  return request<boolean>({
    url: '/monitor/groups',
    method: 'put',
    data
  });
}

/** 删除分组 */
export function fetchDeleteGroup(id: string) {
  return request<boolean>({
    url: `/monitor/groups/${id}`,
    method: 'delete'
  });
}

/** 分组授权（全量替换分组-角色） */
export function fetchUpdateGroupAuth(id: string, roleIds: string[]) {
  return request<boolean>({
    url: `/monitor/groups/${id}/auth`,
    method: 'put',
    data: { roleIds }
  });
}

// ==================== Redis 监控 ====================

/** Redis 当前指标快照 */
export function fetchGetRedisMetricCurrent(id: string) {
  return request<Api.Monitor.MetricCurrent>({
    url: `/monitor/redis/${id}/metrics/current`,
    method: 'get'
  });
}

/** Redis 指标时序 */
export function fetchGetRedisMetricHistory(id: string, params: { metric: string; range?: string; node?: string }) {
  return request<Api.Monitor.HistoryPoint[]>({
    url: `/monitor/redis/${id}/metrics/history`,
    method: 'get',
    params
  });
}

/** Redis 节点与拓扑（cluster/sentinel） */
export function fetchGetRedisNodes(id: string) {
  return request<Api.Monitor.RedisNode[]>({
    url: `/monitor/redis/${id}/nodes`,
    method: 'get'
  });
}

/** Redis 慢日志分页（offset 分页） */
export function fetchGetRedisSlowlogPage(
  id: string,
  params: { hours?: number; minDurationUs?: number; node?: string; offset?: number; size?: number }
) {
  return request<Api.Monitor.SlowlogPage>({
    url: `/monitor/redis/${id}/slowlog/page`,
    method: 'get',
    params
  });
}

/** 手动触发大 key 扫描（异步，返回报告ID） */
export function fetchTriggerBigkeyScan(id: string, reportType: string = 'BIGKEY') {
  return request<string>({
    url: `/monitor/redis/${id}/analysis/bigkey`,
    method: 'post',
    params: { reportType }
  });
}

/** 分析报告分页 */
export function fetchGetBigkeyReportPage(params: {
  instanceId: string;
  reportType?: string;
  scanStatus?: string;
  start?: string;
  end?: string;
  current?: number;
  size?: number;
}) {
  return request<Api.Monitor.BigkeyReportList>({
    url: `/monitor/redis/${params.instanceId}/analysis/reports/page`,
    method: 'get',
    params
  });
}

/** 分析报告明细（按 memory_bytes 倒序） */
export function fetchGetBigkeyReportItems(id: string, reportId: string, params?: { current?: number; size?: number }) {
  return request<Api.Monitor.BigkeyReportItemList>({
    url: `/monitor/redis/${id}/analysis/reports/${reportId}`,
    method: 'get',
    params
  });
}

// ==================== Redis 数据管理 ====================

/** Redis 逻辑库列表（库总数 + 各库键数，参考 RedisInsight 库选择器） */
export function fetchGetRedisDatabases(id: string) {
  return request<Api.Monitor.RedisDatabaseInfo[]>({
    url: `/monitor/redis/${id}/databases`,
    method: 'get'
  });
}

/** SCAN 分页浏览 key */
export function fetchScanRedisKeys(
  id: string,
  params: { cursor?: string; pattern?: string; type?: string; count?: number; db?: number }
) {
  return request<Api.Monitor.KeyScanResult>({
    url: `/monitor/redis/${id}/keys`,
    method: 'get',
    params
  });
}

/** key 树形分级浏览（按分隔符聚合一层，参考 RedisInsight） */
export function fetchGetRedisKeyTree(
  id: string,
  params: {
    prefix?: string;
    separator?: string;
    pattern?: string;
    type?: string;
    cursor?: string;
    count?: number;
    db?: number;
  }
) {
  return request<Api.Monitor.KeyTreeResult>({
    url: `/monitor/redis/${id}/key-tree`,
    method: 'get',
    params
  });
}

/** key 详情（值按类型分页） */
export function fetchGetRedisKeyDetail(
  id: string,
  params: { key: string; subCursor?: string; subCount?: number; db?: number }
) {
  return request<Api.Monitor.KeyDetail>({
    url: `/monitor/redis/${id}/key`,
    method: 'get',
    params
  });
}

/** 新增 key */
export function fetchCreateRedisKey(id: string, data: Api.Monitor.KeyCreateParams, db?: number) {
  return request<boolean>({
    url: `/monitor/redis/${id}/key`,
    method: 'post',
    data,
    params: { db }
  });
}

/** 修改 key（值/元素/TTL，operation 区分操作） */
export function fetchUpdateRedisKey(id: string, data: Api.Monitor.KeyUpdateParams, db?: number) {
  return request<boolean>({
    url: `/monitor/redis/${id}/key`,
    method: 'put',
    data,
    params: { db }
  });
}

/** 删除 key（UNLINK 异步删除） */
export function fetchDeleteRedisKey(id: string, key: string, db?: number) {
  return request<number>({
    url: `/monitor/redis/${id}/key`,
    method: 'delete',
    params: { key, db }
  });
}

/**
 * 批量删除 key（高危：必须携带 X-Confirm-Token）
 *
 * token 先经 `issueConfirmToken` 签发（60s 一次性）。
 */
export function fetchBatchDeleteRedisKeys(
  id: string,
  data: Api.Monitor.BatchDeleteParams,
  options: { confirmToken: string; db?: number }
) {
  return request<number>({
    url: `/monitor/redis/${id}/keys/batch-delete`,
    method: 'post',
    data,
    params: { db: options.db },
    headers: { 'X-Confirm-Token': options.confirmToken }
  });
}

// ==================== 高危操作确认令牌 ====================

/**
 * 签发高危操作确认令牌（通用端点，60s 一次性，绑定 instanceId+operation）
 *
 * 后端 ConfirmTokenController（POST /monitor/confirm-tokens）仅要求已认证、
 * 不挂特定权限点——真正的高危校验在各自消费端（@PreAuthorize + 令牌绑定）。
 * 适用：Redis 批量删除 / DB 终止会话 / 服务日志级别调整。
 * SQL 写执行的摘要含 Druid 指纹，必须用服务端计算的专用端点
 * （fetchIssueSqlConfirmToken），不能走本端点。
 */
export function issueConfirmToken(instanceId: string, operation: string) {
  return request<Api.Monitor.ConfirmToken>({
    url: '/monitor/confirm-tokens',
    method: 'post',
    data: { instanceId, operation }
  });
}

// ==================== 数据库监控 ====================

/** 数据库当前指标快照 */
export function fetchGetDbMetricCurrent(id: string) {
  return request<Api.Monitor.MetricCurrent>({
    url: `/monitor/db/${id}/metrics/current`,
    method: 'get'
  });
}

/** 数据库指标时序 */
export function fetchGetDbMetricHistory(id: string, params: { metric: string; range?: string; node?: string }) {
  return request<Api.Monitor.HistoryPoint[]>({
    url: `/monitor/db/${id}/metrics/history`,
    method: 'get',
    params
  });
}

/** 慢 SQL 分页（不带指纹为聚合视图，带指纹为明细钻取） */
export function fetchGetSlowSqlPage(
  id: string,
  params: { fingerprint?: string; hours?: number; offset?: number; size?: number }
) {
  return request<Api.Monitor.SlowSqlPage>({
    url: `/monitor/db/${id}/slow-sql/page`,
    method: 'get',
    params
  });
}

/** 会话列表 */
export function fetchGetDbSessions(id: string) {
  return request<Api.Monitor.DbSession[]>({
    url: `/monitor/db/${id}/sessions`,
    method: 'get'
  });
}

/** 终止会话（高危：X-Confirm-Token） */
export function fetchKillDbSession(id: string, sessionId: string, confirmToken: string) {
  return request<boolean>({
    url: `/monitor/db/${id}/sessions/kill`,
    method: 'post',
    params: { sessionId },
    headers: { 'X-Confirm-Token': confirmToken }
  });
}

/** 锁等待/阻塞链 */
export function fetchGetDbLocks(id: string) {
  return request<Api.Monitor.DbLock[]>({
    url: `/monitor/db/${id}/locks`,
    method: 'get'
  });
}

/** 容量快照 Top N */
export function fetchGetDbCapacity(id: string, params?: { date?: string; topN?: number }) {
  return request<Api.Monitor.CapacitySnapshot[]>({
    url: `/monitor/db/${id}/capacity`,
    method: 'get',
    params
  });
}

// ==================== 数据库数据浏览 ====================

/** schema 列表 */
export function fetchGetDbSchemas(id: string) {
  return request<string[]>({
    url: `/monitor/db/${id}/metadata/schemas`,
    method: 'get'
  });
}

/** 表列表 */
export function fetchGetDbTables(id: string, schema: string) {
  return request<Api.Monitor.DbTable[]>({
    url: `/monitor/db/${id}/metadata/${encodeURIComponent(schema)}/tables`,
    method: 'get'
  });
}

/** 列列表 */
export function fetchGetDbColumns(id: string, schema: string, table: string) {
  return request<Api.Monitor.DbColumn[]>({
    url: `/monitor/db/${id}/metadata/tables/${encodeURIComponent(table)}/columns`,
    method: 'get',
    params: { schema }
  });
}

/** 建表 DDL */
export function fetchGetDbTableDdl(id: string, schema: string, table: string) {
  return request<string>({
    url: `/monitor/db/${id}/metadata/tables/${encodeURIComponent(table)}/ddl`,
    method: 'get',
    params: { schema }
  });
}

/**
 * 表数据分页浏览
 *
 * conditions 为 JSON 数组字符串：`[{"column":"name","op":"eq|like","value":"x"}]`
 */
export function fetchGetDbTableData(
  id: string,
  params: {
    schema: string;
    table: string;
    conditions?: string;
    orderBy?: string;
    direction?: string;
    page?: number;
    size?: number;
  }
) {
  return request<Api.Monitor.SqlExecResult>({
    url: `/monitor/db/${id}/table-data`,
    method: 'get',
    params
  });
}

// ==================== SQL 控制台 ====================

/** 只读执行（SELECT/EXPLAIN，自动包裹 LIMIT） */
export function fetchExecuteReadonlySql(id: string, sql: string) {
  return request<Api.Monitor.SqlExecResult>({
    url: `/monitor/db/${id}/sql-console/execute`,
    method: 'post',
    data: { sql }
  });
}

/** 写执行（高危：X-Confirm-Token + 行数保护） */
export function fetchExecuteWriteSql(id: string, sql: string, confirmToken: string) {
  return request<Api.Monitor.SqlExecResult>({
    url: `/monitor/db/${id}/sql-console/execute-write`,
    method: 'post',
    data: { sql },
    headers: { 'X-Confirm-Token': confirmToken }
  });
}

/** 签发 SQL 写执行确认令牌（绑定实例与 SQL 指纹） */
export function fetchIssueSqlConfirmToken(id: string, sql: string) {
  return request<Api.Monitor.ConfirmToken>({
    url: `/monitor/db/${id}/sql-console/confirm-token`,
    method: 'post',
    data: { sql }
  });
}

/** SQL 执行历史分页 */
export function fetchGetSqlHistoryPage(params: Api.Monitor.SqlHistorySearchParams) {
  return request<Api.Monitor.SqlHistoryList>({
    url: `/monitor/db/${params.instanceId}/sql-history/page`,
    method: 'get',
    params
  });
}

// ==================== 微服务监控 ====================

/** 服务清单：服务名/实例数/健康实例数/最近采集时间 */
export function fetchGetServiceList() {
  return request<Api.Monitor.ServiceSummary[]>({
    url: '/monitor/services',
    method: 'get'
  });
}

/** 服务实例明细（Nacos 实时实例 + actuator health） */
export function fetchGetServiceInstances(name: string) {
  return request<Api.Monitor.ServiceInstance[]>({
    url: `/monitor/services/${encodeURIComponent(name)}/instances`,
    method: 'get'
  });
}

/** 服务指标时序（支持 node 维度多实例对比） */
export function fetchGetServiceMetricHistory(name: string, params: { metric: string; range?: string; node?: string }) {
  return request<Api.Monitor.HistoryPoint[]>({
    url: `/monitor/services/${encodeURIComponent(name)}/metrics/history`,
    method: 'get',
    params
  });
}

/** 日志级别调整（高危：X-Confirm-Token；TTL 到期自动恢复） */
export function fetchUpdateServiceLogger(name: string, data: Api.Monitor.LoggerUpdateParams, confirmToken: string) {
  return request<boolean>({
    url: `/monitor/services/${encodeURIComponent(name)}/loggers`,
    method: 'put',
    data,
    headers: { 'X-Confirm-Token': confirmToken }
  });
}

/** SkyWalking 跳转链接（未配置返回空串） */
export function fetchGetSkywalkingUrl(name: string) {
  return request<string>({
    url: `/monitor/services/${encodeURIComponent(name)}/skywalking-url`,
    method: 'get'
  });
}

// ==================== 告警中心 ====================

/** 告警记录分页：状态/级别/时间/实例过滤 */
export function fetchGetAlarmRecordList(params?: Api.Monitor.AlarmRecordSearchParams) {
  return request<Api.Monitor.AlarmRecordList>({
    url: '/monitor/alarms/records/page',
    method: 'get',
    params
  });
}

/** 确认告警（FIRING → CONFIRMED） */
export function fetchConfirmAlarmRecord(id: string, handleRemark?: string) {
  return request<boolean>({
    url: `/monitor/alarms/records/${id}/confirm`,
    method: 'put',
    data: { handleRemark }
  });
}

/** 新增静默 */
export function fetchAddAlarmSilence(data: Api.Monitor.AlarmSilenceCreateParams) {
  return request<string>({
    url: '/monitor/alarms/silences',
    method: 'post',
    data
  });
}

/** 删除静默 */
export function fetchDeleteAlarmSilence(id: string) {
  return request<boolean>({
    url: `/monitor/alarms/silences/${id}`,
    method: 'delete'
  });
}

/** 告警规则分页 */
export function fetchGetAlarmRuleList(params?: Api.Monitor.AlarmRuleSearchParams) {
  return request<Api.Monitor.AlarmRuleList>({
    url: '/monitor/alarms/rules/page',
    method: 'get',
    params
  });
}

/** 内置规则模板（一键选用） */
export function fetchGetAlarmRuleTemplates() {
  return request<Api.Monitor.AlarmRuleTemplate[]>({
    url: '/monitor/alarms/rules/templates',
    method: 'get'
  });
}

/** 规则详情 */
export function fetchGetAlarmRuleDetail(id: string) {
  return request<Api.Monitor.AlarmRule>({
    url: `/monitor/alarms/rules/${id}`,
    method: 'get'
  });
}

/** 新增规则 */
export function fetchAddAlarmRule(data: Api.Monitor.AlarmRuleOperateParams) {
  return request<string>({
    url: '/monitor/alarms/rules',
    method: 'post',
    data
  });
}

/** 编辑规则 */
export function fetchUpdateAlarmRule(data: Api.Monitor.AlarmRuleOperateParams) {
  return request<boolean>({
    url: '/monitor/alarms/rules',
    method: 'put',
    data
  });
}

/** 删除规则 */
export function fetchDeleteAlarmRule(id: string) {
  return request<boolean>({
    url: `/monitor/alarms/rules/${id}`,
    method: 'delete'
  });
}

/** 启停规则 */
export function fetchUpdateAlarmRuleEnabled(id: string, enabled: boolean) {
  return request<boolean>({
    url: `/monitor/alarms/rules/${id}/enabled`,
    method: 'put',
    params: { enabled }
  });
}
