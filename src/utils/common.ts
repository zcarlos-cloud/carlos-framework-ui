import dayjs from 'dayjs';
import { $t } from '@/locales';

/**
 * Transform record to option
 *
 * @example
 *   ```ts
 *   const record = {
 *     key1: 'label1',
 *     key2: 'label2'
 *   };
 *   const options = transformRecordToOption(record);
 *   // [
 *   //   { value: 'key1', label: 'label1' },
 *   //   { value: 'key2', label: 'label2' }
 *   // ]
 *   ```;
 *
 * @param record
 */
export function transformRecordToOption<T extends Record<string, string>>(record: T) {
  return Object.entries(record).map(([value, label]) => ({
    value,
    label
  })) as CommonType.Option<keyof T, T[keyof T]>[];
}

/**
 * Translate options
 *
 * @param options
 */
export function translateOptions(options: CommonType.Option<string>[]) {
  return options.map(option => ({
    ...option,
    label: $t(option.label as App.I18n.I18nKey)
  }));
}

/**
 * Format an ISO-8601 datetime string produced by the backend into `yyyy-MM-dd HH:mm:ss`
 *
 * 后端 LocalDateTime 走 Jackson 默认的 ISO-8601（如 `2026-09-17T10:00:00`），
 * 直接展示可读性差；空值返回空串，解析失败时原样返回，避免表格出现 `Invalid Date`。
 *
 * @param value ISO-8601 datetime string
 */
export function formatDateTime(value?: string | null) {
  if (!value) {
    return '';
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
}

/**
 * Pretty-print a JSON string for read-only display
 *
 * 后端把 `oldData` / `newData` / `targetSnapshot` 等宽表字段以 JSON 字符串下发，
 * 原文可能为空或非 JSON，此时原样返回。
 *
 * @param value JSON string
 */
export function formatJson(value?: string | null) {
  if (!value) {
    return '';
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

/**
 * Format a byte count into a human readable size
 *
 * 后端 `fileSizeBytes` 为 Long（序列化为字符串），归档文件可达 GB 级，直接展示字节数不可读。
 *
 * @param bytes byte count, may be a numeric string
 */
export function formatFileSize(bytes?: number | string | null) {
  const size = Number(bytes ?? 0);

  if (!Number.isFinite(size) || size <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exponent;

  return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
}

/**
 * Toggle html class
 *
 * @param className
 */
export function toggleHtmlClass(className: string) {
  function add() {
    document.documentElement.classList.add(className);
  }

  function remove() {
    document.documentElement.classList.remove(className);
  }

  return {
    add,
    remove
  };
}

/** 详情类展示中空值的统一占位 */
export const EMPTY_TEXT = '-';

/**
 * 枚举码 → 本地化文案，**查不到就回退原值**
 *
 * 仓库里此前有三种写法，只有第三种是对的：
 *
 * 1. `$t(record[value])` —— 码值缺失或字典里没有时 `$t(undefined)` 会抛异常，
 *    进而让整个表格卡在 loading（`SKILL.md` 规则 9 警告的正是这个故障模式）。
 * 2. `value ? $t(record[value]) : ''` —— 只挡住了「字段缺失」，挡不住「码值不认识」，
 *    后端新增枚举值而前端还没发版时照样抛异常。
 * 3. **本函数** —— 先查字典，查不到就把码值原样显示出来。
 *
 * 第 3 种的价值：后端加了枚举值而前端还没跟上时，用户看到的是 `PARTIAL_REFUND`，
 * 而不是一片空白或者白屏。
 *
 * @param record 共享常量里的 `xxxRecord`（码 → i18n key）
 * @param value 后端下发的枚举码，可以是字符串码（`'0'|'1'`）也可以是数字码
 * @param fallback 空值（`null`/`undefined`/空串）时的占位
 */
export function enumText(
  record: Record<string, App.I18n.I18nKey>,
  value?: string | number | null,
  fallback = EMPTY_TEXT
) {
  // 注意不能写成 `if (!value)`：数字码 0 是合法值，会被误判为空
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const code = String(value);
  const key = record[code];

  return key ? $t(key) : code;
}

/**
 * 枚举码 → Tag 颜色
 *
 * `enumText` 的对称搭档：把「先判空再查表」这段模板代码收进函数里。
 * 缺失或未收录时返回 `undefined`（antd 的 `Tag` 会退化成默认灰色），
 * 因此调用方**不再需要**手写 `if (value === null || value === undefined) return null;`
 * —— 那段守卫原本是必需的（`$t(undefined)` 会抛异常、拿 undefined 索引也过不了类型检查），
 * 现在由这两个函数统一承担。
 *
 * @param record 共享常量里的 `xxxTagColor`
 * @param value 后端下发的枚举码（数字码也可以，内部会转字符串）
 */
export function enumTagColor(record: Record<string, string>, value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  return record[String(value)];
}

/**
 * 触发浏览器下载一个 Blob
 *
 * 导出接口统一走「后端生成 xlsx → blob」，此前每个页面都要手抄一遍
 * `createObjectURL` / `createElement('a')` / `revokeObjectURL`，且写法各异
 * （`audit/log` 忘了把 `<a>` 挂进 DOM，`app-client` 忘了 `revokeObjectURL`）。
 * 集中到这里后，`useExport()` 是唯一入口。
 *
 * @param blob 响应体
 * @param filename 带扩展名的文件名
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  // 必须先挂进 DOM 再 click：部分浏览器对游离节点不触发下载，且不报错
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
