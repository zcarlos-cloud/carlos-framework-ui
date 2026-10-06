import { shallowReactive } from 'vue';
import { fetchModuleEnums } from '@/service/api';
import { localStg } from '@/utils/storage';

/**
 * 枚举字典直驱 —— 目标是「后端加一个枚举值，前端零改动」。
 *
 * <p>与 `utils/common.ts` 里的 `enumText(record, value)` 是**并存**的两条路：</p>
 * <ul>
 *   <li><b>record 查表（旧）</b>：前端持有「码值 → i18n key」的表，加一个枚举值就要动前端；</li>
 *   <li><b>字典直驱（本文件）</b>：读后端 `/{module}/app/enums` 下发的字典（含中英文与语义色），
 *       前端不持有任何枚举表。</li>
 * </ul>
 *
 * <p><b>为什么不用 `sys_i18n_message`</b>：那条通道的 key 必须存在于前端
 * `locales/langs/*.ts` —— `$t()` 的签名是 `(key: I18nKey)`，而 `I18nKey` 由语言文件推导，
 * key 不在前端就编译不过（见 `carlos-system/docs/02-design/i18n-design.md` §7.4）。
 * 所以它结构上做不到「前端零改动」；枚举字典没有这个约束。</p>
 *
 * <p><b>module 取的是网关路径前缀</b>（`sys` / `org` / `auth` / `message` / `audit` / `job` / `workflow`），
 * 不是 `@AppEnum` 的 code，也不是服务名。</p>
 *
 * <p>样板模块：`carlos-message`（`ChannelType` / `MessageReceiverStatus`）。</p>
 *
 * @see utils/common.ts 的 enumText / enumTagColor（旧路，其他模块迁移前继续使用）
 */

/**
 * 语义色档位 → antd Tag 颜色
 *
 * 后端只下发这 5 档（`com.carlos.core.enums.EnumColor`），语义集合是稳定的，
 * 因此这张表**永远不需要改** —— 这正是颜色也放进枚举的目的。
 */
const COLOR_MAP: Record<string, string> = {
  PRIMARY: 'processing',
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER: 'error',
  MUTED: 'default'
};

/** 单个枚举常量 */
interface EnumEntry {
  /** 码值（转成字符串，兼容后端下发 number 的枚举） */
  code: string;
  /** 常量名（后端 JSON 有可能下发它而不是码值） */
  name: string;
  desc: string;
  descEn: string;
  color: string;
}

/** 单个枚举：`list` 保序供下拉用，`byKey` 供按值查文案 */
interface EnumBucket {
  list: EnumEntry[];
  byKey: Record<string, EnumEntry>;
}

type EnumDict = Record<string, Record<string, EnumBucket>>;

/**
 * `shallowReactive` 就够了：整块 module 字典是一次性整体赋值的，
 * 组件在 render 期间读到 `dict[module]` 即被追踪，字典到达后会自动重渲染。
 */
const dict = shallowReactive<EnumDict>({});

/** 在途请求，避免同一 module 并发重复拉取 */
const pending = new Map<string, Promise<void>>();

/**
 * 拉取并缓存某模块的枚举字典（重复调用无副作用）
 *
 * @param module 网关路径前缀，如 `message`
 */
export function loadEnumDict(module: string): Promise<void> {
  if (dict[module]) return Promise.resolve();

  const inflight = pending.get(module);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const { data, error } = await fetchModuleEnums(module);
      if (error || !data) return;

      const built: Record<string, EnumBucket> = {};
      Object.entries(data).forEach(([enumCode, items]) => {
        const list: EnumEntry[] = [];
        const byKey: Record<string, EnumEntry> = {};

        (items || []).forEach(item => {
          const entry: EnumEntry = {
            code: String(item.code),
            name: item.name,
            desc: item.desc,
            descEn: item.descEn || item.desc,
            color: item.color || 'MUTED'
          };
          list.push(entry);
          // 码值与常量名**都登记**：后端 JSON 的下发形态取决于承载字段的类型而非枚举本身
          // （carlos-message 的 status 是 Integer ⇒ 下发数字码；audit 的 DTO 用 Java 枚举 ⇒ 下发枚举名），
          // 两个键都放进去，查询时 `String(value)` 才能都命中。
          byKey[entry.code] = entry;
          byKey[entry.name] = entry;
        });

        built[enumCode] = { list, byKey };
      });

      dict[module] = built;
    } catch {
      // 网络异常静默降级：取词器查不到会回落显示原值，不阻塞页面
    }
  })().finally(() => pending.delete(module));

  pending.set(module, task);
  return task;
}

/**
 * 确保若干模块的字典已加载（页面 setup 里调用即可，不需要 await）
 *
 * @param modules 网关路径前缀
 */
export function ensureEnumDict(...modules: string[]) {
  modules.forEach(module => {
    loadEnumDict(module);
  });
}

function currentLang(): string {
  return localStg.get('lang') || 'zh-CN';
}

function lookup(module: string, enumCode: string, value?: string | number | null): EnumEntry | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return dict[module]?.[enumCode]?.byKey[String(value)];
}

/**
 * 枚举值 → 文案
 *
 * <p>查不到就把码值原样显示（沿用 `enumText` 的降级设计）：后端加了枚举值而字典尚未刷新时，
 * 用户看到 `REVOKED` 或 `6`，而不是空白或异常。空值统一显示 `-`。</p>
 *
 * @param module 网关路径前缀，如 `message`
 * @param enumCode `@AppEnum` 的 code，如 `ChannelType`
 * @param value 后端下发的值（数字码或常量名都可以）
 */
export function enumDictText(module: string, enumCode: string, value?: string | number | null): string {
  // 注意不能写成 `if (!value)`：数字码 0 是合法值，会被误判为空
  if (value === null || value === undefined || value === '') return '-';

  const entry = lookup(module, enumCode, value);
  if (!entry) return String(value);

  const text = currentLang() === 'en-US' ? entry.descEn : entry.desc;
  return text || String(value);
}

/**
 * 枚举值 → antd Tag 颜色
 *
 * <p>缺失或未收录时返回 `undefined`（antd 的 `Tag` 会退化成默认灰色），
 * 调用方因此不需要自己写空值守卫。</p>
 */
export function enumDictColor(module: string, enumCode: string, value?: string | number | null): string | undefined {
  const entry = lookup(module, enumCode, value);
  if (!entry) return undefined;
  return COLOR_MAP[entry.color];
}

/**
 * 枚举 → 下拉选项（按后端下发顺序，label 已完成本地化）
 *
 * <p>只输出码值一条：字典里每个常量同时登记了码值和常量名两个键，
 * 直接遍历 `byKey` 会重复。</p>
 */
export function enumDictOptions(module: string, enumCode: string): { value: string; label: string }[] {
  const bucket = dict[module]?.[enumCode];
  if (!bucket) return [];

  const lang = currentLang();
  return bucket.list.map(entry => ({
    value: entry.code,
    label: (lang === 'en-US' ? entry.descEn : entry.desc) || entry.code
  }));
}

/**
 * 编辑表单预填用：后端 Integer 码 JSON 下发为**数字**，而字典选项 value 是字符串，
 * antd Select/Radio 按严格相等匹配 —— 不归一的话预填时匹配不到、控件显示原始码值。
 * 空值（null/undefined）原样返回 undefined，由调用方决定兜底值。
 */
export function enumDictCodeString(value: string | number | null | undefined): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

/**
 * 枚举 → 下拉选项（value 取**常量名**而不是码值）
 *
 * <p>菜单类枚举（MenuCategory / MenuStatus / IconType）的 JSON 承载字段是 Java 枚举类型，
 * 下发与回传的都是常量名（DIRECTORY / ENABLED / …），表单模型、筛选比较、提交载荷
 * 全链路都是名字 —— 这类枚举的下拉必须按名取值，用 {@link enumDictOptions} 的码值
 * 会打穿筛选比较和提交载荷。MenuType（clientType）的码值即常量名，两个助手等价。</p>
 */
export function enumDictNameOptions(module: string, enumCode: string): { value: string; label: string }[] {
  const bucket = dict[module]?.[enumCode];
  if (!bucket) return [];

  const lang = currentLang();
  return bucket.list.map(entry => ({
    value: entry.name,
    label: (lang === 'en-US' ? entry.descEn : entry.desc) || entry.name
  }));
}
