import type { App } from 'vue';
import { createI18n } from 'vue-i18n';
import { fetchGetI18nMessages } from '@/service/api';
import { localStg } from '@/utils/storage';
import messages from './locale';

/**
 * 框架自有的命名空间，不由后端覆盖
 *
 * 这些是 UI 框架级文案（主题面板、表单校验、下拉、图标、请求提示），
 * 让后端覆盖它们容易把框架本身改坏，故始终以前端为准。
 * 后端若返回同命名空间的 key 会被跳过并告警。
 */
const LOCAL_ONLY_NAMESPACES = new Set(['theme', 'form', 'dropdown', 'icon', 'request']);

/**
 * 允许后端覆盖的命名空间
 *
 * 只有这几个会出现在「国际化管理」页面里供运营维护。
 * 与 LOCAL_ONLY_NAMESPACES 互补，两处需同步修改。
 */
export const OVERRIDABLE_NAMESPACES = ['system', 'common', 'route', 'page'] as const;

const i18n = createI18n({
  locale: localStg.get('lang') || 'zh-CN',
  fallbackLocale: 'en',
  messages,
  legacy: false
});

/**
 * 拉取后端**覆盖值**并合并进 vue-i18n
 *
 * 注意这里拉的是「覆盖」不是「全量」：
 * 前端 locales/langs/*.ts 才是完整的 key 目录与基线值（也是 $t() 的类型来源），
 * 后端 sys_i18n_message 只存运营真正改过的那部分 key。
 * mergeLocaleMessage 是深合并，同路径的后端值会覆盖前端基线值；
 * 没有覆盖的 key 自然回落到基线。
 *
 * @param locale locale code
 */
export async function loadBackendMessages(locale: App.I18n.LangType) {
  const langMap: Record<App.I18n.LangType, string> = {
    'zh-CN': 'zh_CN',
    'en-US': 'en_US'
  };
  const lang = langMap[locale];
  if (!lang) return;

  try {
    const { data, error } = await fetchGetI18nMessages(lang);
    if (!error && data && data.messages) {
      const backendMessages = data.messages;
      // 过滤掉与前端本地保留命名空间冲突的 key，避免 UI 框架文案被后端覆盖
      const filteredMessages: Record<string, string> = {};
      Object.entries(backendMessages).forEach(([key, value]) => {
        const namespace = key.split('.')[0];
        if (LOCAL_ONLY_NAMESPACES.has(namespace)) {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] backend key "${key}" conflicts with local-only namespace "${namespace}", skipped`);
          return;
        }
        filteredMessages[key] = value;
      });
      // Merge backend messages into vue-i18n using flat keys like "system.title"
      const nestedMessages = flatToNested(filteredMessages);
      i18n.global.mergeLocaleMessage(locale, nestedMessages);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Failed to load backend i18n messages:', e);
  }
}

/**
 * Convert flat key-value messages to nested object
 * e.g. {"system.title": "xxx", "common.add": "yyy"} -> {system: {title: "xxx"}, common: {add: "yyy"}}
 */
function flatToNested(flatMessages: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flatMessages)) {
    const keys = key.split('.');
    let current: Record<string, unknown> = result;
    for (let i = 0; i < keys.length - 1; i += 1) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  }
  return result;
}

/**
 * 把嵌套的语言对象拍平成 `{ key: value }`
 *
 * flatToNested 的逆操作，供「国际化管理」页面枚举本地 key 目录使用。
 * 只有叶子节点是字符串时才收集，非字符串叶子会被跳过（本项目的语言文件里不应出现）。
 *
 * @param nested 语言文件导出的嵌套对象
 * @param prefix 内部递归用的前缀
 */
export function flattenMessages(nested: object, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  Object.entries(nested).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenMessages(value, fullKey));
    } else if (typeof value === 'string') {
      result[fullKey] = value;
    }
  });

  return result;
}

/**
 * Setup plugin i18n
 *
 * @param app
 */
export async function setupI18n(app: App) {
  app.use(i18n);
  // Load backend messages for current locale after login
  const currentLocale = i18n.global.locale.value as App.I18n.LangType;
  await loadBackendMessages(currentLocale);
}

export const $t = i18n.global.t as App.I18n.$T;

export function setLocale(locale: App.I18n.LangType) {
  i18n.global.locale.value = locale;
}
