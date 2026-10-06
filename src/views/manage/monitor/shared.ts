import { $t } from '@/locales';

/**
 * 监控模块共享的枚举展示工具（供 monitor 各页面复用）
 *
 * 注意：函数每次调用实时取 $t，保证语言切换后文案跟随。
 */

/** 实例类型 → 文案 */
export function instanceTypeText(type?: string): string {
  const record: Record<string, () => string> = {
    REDIS_STANDALONE: () => $t('page.manage.monitor.common.typeRedisStandalone'),
    REDIS_CLUSTER: () => $t('page.manage.monitor.common.typeRedisCluster'),
    REDIS_SENTINEL: () => $t('page.manage.monitor.common.typeRedisSentinel'),
    POSTGRESQL: () => $t('page.manage.monitor.common.typePostgresql'),
    MYSQL: () => $t('page.manage.monitor.common.typeMysql'),
    DM: () => $t('page.manage.monitor.common.typeDm'),
    CLICKHOUSE: () => $t('page.manage.monitor.common.typeClickhouse'),
    MICROSERVICE: () => $t('page.manage.monitor.common.typeMicroservice')
  };
  return type && record[type] ? record[type]() : (type ?? '-');
}

/** 实例类型 → Tag 颜色 */
export function instanceTypeTagColor(type?: string): string {
  if (type?.startsWith('REDIS')) {
    return 'red';
  }
  if (type === 'MICROSERVICE') {
    return 'blue';
  }
  return 'geekblue';
}

/** 健康状态 → 文案 */
export function healthStatusText(status?: string): string {
  const record: Record<string, () => string> = {
    UP: () => $t('page.manage.monitor.common.healthUp'),
    DOWN: () => $t('page.manage.monitor.common.healthDown'),
    UNKNOWN: () => $t('page.manage.monitor.common.healthUnknown')
  };
  return status && record[status] ? record[status]() : (status ?? '-');
}

/** 健康状态 → Tag 颜色 */
export function healthStatusTagColor(status?: string): string {
  const record: Record<string, string> = {
    UP: 'success',
    DOWN: 'error',
    UNKNOWN: 'default'
  };
  return (status && record[status]) || 'default';
}

/** 告警级别 → Tag 颜色 */
export function alarmLevelTagColor(level?: string): string {
  const record: Record<string, string> = {
    INFO: 'blue',
    WARN: 'warning',
    CRITICAL: 'error'
  };
  return (level && record[level]) || 'default';
}

/** 告警状态 → 文案 */
export function alarmStatusText(status?: string): string {
  const record: Record<string, () => string> = {
    FIRING: () => $t('page.manage.monitor.common.alarmFiring'),
    CONFIRMED: () => $t('page.manage.monitor.common.alarmConfirmed'),
    RECOVERED: () => $t('page.manage.monitor.common.alarmRecovered')
  };
  return status && record[status] ? record[status]() : (status ?? '-');
}

/** 告警状态 → Tag 颜色 */
export function alarmStatusTagColor(status?: string): string {
  const record: Record<string, string> = {
    FIRING: 'error',
    CONFIRMED: 'warning',
    RECOVERED: 'success'
  };
  return (status && record[status]) || 'default';
}

/** 字节数 → 可读文本 */
export function formatBytes(value?: number | string | null): string {
  if (value === null || value === undefined) {
    return '-';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  // 后端 Long 序列化为字符串，先强转数字防 render 崩溃
  let size = Number(value);
  if (Number.isNaN(size)) {
    return '-';
  }
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * 解析指标当前值快照
 *
 * 后端快照值为 JSON 字符串 `{"v": <number>, "ts": <millis>}`（MonitorMetricEventHandler），
 * 指标键为 `metricName` 或 `metricName@node`。
 */
export function parseMetricValue(json?: string): number | null {
  if (!json) {
    return null;
  }
  try {
    const parsed = JSON.parse(json) as { v?: number };
    return typeof parsed.v === 'number' ? parsed.v : null;
  } catch {
    return null;
  }
}

/** 从快照 Map 取指标值（无节点后缀优先，集群取全部节点均值） */
export function metricValueOf(
  metrics: Record<string, string> | undefined,
  metricName: string,
  node?: string
): number | null {
  if (!metrics) {
    return null;
  }
  if (node) {
    return parseMetricValue(metrics[`${metricName}@${node}`]);
  }
  const direct = parseMetricValue(metrics[metricName]);
  if (direct !== null) {
    return direct;
  }
  const nodeValues = Object.keys(metrics)
    .filter(key => key.startsWith(`${metricName}@`))
    .map(key => parseMetricValue(metrics[key]))
    .filter((value): value is number => value !== null);
  if (nodeValues.length === 0) {
    return null;
  }
  return nodeValues.reduce((sum, value) => sum + value, 0) / nodeValues.length;
}

/** Redis 类型判断 */
export function isRedisType(type?: string): boolean {
  return Boolean(type?.startsWith('REDIS'));
}

/** DB 类型判断 */
export function isDbType(type?: string): boolean {
  return type === 'POSTGRESQL' || type === 'MYSQL' || type === 'DM' || type === 'CLICKHOUSE';
}
