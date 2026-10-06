# Day 28: Vue I18n 国际化 — 多语言支持

> **日期**: 2026-06-19
> **阶段**: 第三阶段 — 项目核心库深入
> **学习目标**: 掌握 Vue I18n 在 carlos-ui 中的完整实践，从配置到业务使用，从类型安全到后端动态加载

---

## 课前思考

作为 Java 工程师，你早已熟悉 `MessageSource` 和 `ResourceBundle`。前端国际化与之本质相同：
- **键值对映射**（message key → 翻译文本）
- **占位符替换**（`{userName}` → 实际值）
- **运行时切换**（Locale 改变 → 界面刷新）

但前端国际化有其独特挑战：
- **组件级插值**：模板中直接写 `{{ $t('key') }}`，编译时无法像 Java 那样做静态类型检查
- **多源合并**：前端静态翻译 + 后端动态翻译（数据库管理）需要合并
- **第三方库联动**：Ant Design Vue、dayjs 的 locale 需要同步切换

carlos-ui 的国际化方案是如何优雅解决这些问题的？今天的课程会给你答案。

---

## 一、三层目标

### 能用（今天学完就能用）
- 理解 Vue I18n 在 carlos-ui 中的初始化流程
- 能在模板和逻辑中正确使用 `$t` 翻译消息
- 能切换语言并同步更新 Ant Design Vue 和 dayjs 的 locale
- 理解后端消息加载和合并机制

### 规范（符合 carlos-ui 代码标准）
- 使用类型安全的 `$t`（`App.I18n.I18nKey` 类型约束）
- 遵循 `page.{module}.{page}.{field}` 的 Key 命名规范
- 所有翻译文本集中管理在 `src/locales/langs/` 目录
- 通过 `setupI18n` 初始化，不直接操作 `createI18n` 实例

### 精进（知其所以然）
- 理解 `flatToNested` 扁平键到嵌套对象的转换逻辑（后端数据 → 前端 i18n 格式）
- 理解 `App.I18n.Schema` 类型驱动开发：如何做到"新增翻译必须同步类型定义"
- 分析 `loadBackendMessages` 的异步加载 + 合并策略，理解其设计意图

---

## 二、Vue I18n 在 carlos-ui 中的架构全景

```
┌─────────────────────────────────────────────────────────────────┐
│                          Vue 应用层                              │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────────┐          │
│  │ 模板 $t  │  │ 逻辑 $t()   │  │  changeLocale()  │          │
│  └────┬─────┘  └──────┬──────┘  └────────┬─────────┘          │
│       │               │                  │                    │
│  ┌────▼───────────────▼──────────────────▼──────────┐        │
│  │           vue-i18n (createI18n)                    │        │
│  │  ┌────────────┐  ┌──────────────────┐            │        │
│  │  │ 前端静态消息 │  │ 后端动态消息      │            │        │
│  │  │ zh-cn.ts   │  │ (API 加载 + 合并) │            │        │
│  │  │ en-us.ts   │  │                  │            │        │
│  │  └────────────┘  └──────────────────┘            │        │
│  └─────────────────────────────────────────────────────┘        │
│       │                                                        │
│  ┌────▼──────────────────┐  ┌──────────────────┐             │
│  │  Ant Design Vue Locale │  │  dayjs locale    │             │
│  │  (antdLocales)         │  │  (setDayjsLocale)│             │
│  └───────────────────────┘  └──────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、核心文件阅读

### 3.1 初始化入口：`src/locales/index.ts`

这是 Vue I18n 在 carlos-ui 中的核心配置入口：

```typescript
import type { App } from 'vue';
import { createI18n } from 'vue-i18n';
import { localStg } from '@/utils/storage';
import { fetchGetI18nMessages } from '@/service/api';
import messages from './locale';

const i18n = createI18n({
  locale: localStg.get('lang') || 'zh-CN',  // 从 localStorage 读取语言偏好
  fallbackLocale: 'en',                      // 回退语言：找不到翻译时显示英文
  messages,                                  // 前端静态翻译消息（本地 TS 文件）
  legacy: false                              // 使用 Composition API 模式
});
```

**关键设计点**：

1. **`legacy: false`** — 强制使用 Vue I18n 9.x 的 Composition API 模式。carlos-ui 全项目使用 Composition API，所以必须关闭 legacy。

2. **`messages` 来自本地文件** — 初始加载时只包含前端硬编码的翻译。后端动态翻译通过 `loadBackendMessages` 在运行时追加。

3. **`localStg.get('lang')`** — 语言偏好持久化到 localStorage，刷新页面后记忆上次选择。

### 3.2 后端消息加载与合并

```typescript
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
      // 关键：后端返回的是扁平键值对，需要转换为嵌套结构
      const nestedMessages = flatToNested(backendMessages);
      i18n.global.mergeLocaleMessage(locale, nestedMessages);
    }
  } catch (e) {
    console.warn('Failed to load backend i18n messages:', e);
  }
}
```

**Java 类比**：`mergeLocaleMessage` 类似于 Spring `MessageSource` 的 `addMessage()` 动态添加消息，或者 Java 的 `ResourceBundle` 加载多个 properties 文件后合并。

**`flatToNested` 函数的设计意图**：

```typescript
function flatToNested(flatMessages: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flatMessages)) {
    const keys = key.split('.');           // "system.title" -> ["system", "title"]
    let current: Record<string, unknown> = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        current[k] = {};                  // 创建中间层级
      }
      current = current[k] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;  // 在最深层级赋值
  }
  return result;
}

// 示例：
// 输入: { "system.title": "Soybean管理系统", "common.add": "新增" }
// 输出: { system: { title: "Soybean管理系统" }, common: { add: "新增" } }
```

**为什么后端用扁平键？** 数据库中存储 `{ key: "system.title", value: "..." }` 更直观，易于通过 SQL 查询和更新。但 Vue I18n 的 `messages` 结构需要嵌套对象，所以用 `flatToNested` 转换。这是**前后端数据模型不一致**的经典适配场景。

### 3.3 类型安全的 `$t` 函数

```typescript
export const $t = i18n.global.t as App.I18n.$T;
```

这里不是简单导出 `i18n.global.t`，而是**将其断言为 `App.I18n.$T` 类型**。这个类型定义在 `src/typings/app.d.ts` 中：

```typescript
interface $T {
  // 基础用法：直接翻译
  (key: I18nKey): string;

  // 复数形式
  (key: I18nKey, plural: number, options?: TranslateOptions<LangType>): string;

  // 带默认值
  (key: I18nKey, defaultMsg: string, options?: TranslateOptions<LangType>): string;

  // 数组插值：$t('welcomeBack', ['张三'])
  (key: I18nKey, list: unknown[], options?: TranslateOptions<LangType>): string;

  // 命名插值：$t('welcomeBack', { userName: '张三' })
  (key: I18nKey, named: Record<string, unknown>, options?: TranslateOptions<LangType>): string;
}
```

**关键设计点**：`I18nKey` 是一个**类型级字符串字面量联合**，由 `GetI18nKey<Schema>` 递归生成：

```typescript
type GetI18nKey<T extends Record<string, unknown>, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, unknown>
    ? `${K}.${GetI18nKey<T[K]>}`    // 递归：system -> system.title
    : K                              // 叶子节点：system.title
  : never;

// 生成的 I18nKey 类型形如：
// 'system.title' | 'common.add' | 'page.manage.menu.title' | ...
```

这意味着：**如果你写 `$t('system.titl')`（拼写错误），TypeScript 编译器会报错！** 这是前端国际化相比 Java `MessageSource.getMessage()` 的巨大优势——**编译时类型安全**。

---

## 四、在组件中使用国际化

### 4.1 模板中使用 `$t`

```vue
<script setup lang="tsx">
import { $t } from '@/locales';

// 在 TSX 中直接使用 $t
const columns = () => [
  {
    key: 'menuName',
    title: $t('page.manage.menu.menuName'),  // 类型安全的 key
    align: 'center',
    minWidth: 120
  },
  {
    key: 'operate',
    title: $t('common.operate'),
    align: 'center',
    width: 130
  }
];
</script>
```

**注意**：carlos-ui 中很多组件使用 TSX 写法（`<script setup lang="tsx">`），在 `customRender` 中直接调用 `$t()`。如果是在纯模板中，可以用 `{{ $t('key') }}`，但 carlos-ui 的项目规范是：**在逻辑中通过 `$t` 函数获取翻译文本，然后绑定到模板中**。

### 4.2 插值用法：命名插值与数组插值

```typescript
// 命名插值（推荐）
const greeting = $t('page.home.greeting', { userName: '张三' });
// 翻译文本: '早安，{userName}, 今天又是充满活力的一天!'
// 输出: '早安，张三, 今天又是充满活力的一天!'

// 数组插值（位置参数）
const welcome = $t('page.login.common.welcomeBack', ['张三']);
// 翻译文本: '欢迎回来，{userName} ！'
// 输出: '欢迎回来，张三 ！'
```

**Java 类比**：`$t('key', { userName: '张三' })` 等价于 Java `MessageSource.getMessage("key", new Object[]{"张三"}, locale)`。命名插值比位置参数更语义化，推荐优先使用。

### 4.3 路由中的 i18nKey

在 `src/views/manage/menu/index.vue` 中，有一个精妙的设计：

```typescript
{
  key: 'menuName',
  title: $t('page.manage.menu.menuName'),
  customRender: ({ record }) => {
    const { i18nKey, menuName } = record;
    const label = i18nKey ? $t(i18nKey) : menuName;  // 动态 key
    return <span>{label}</span>;
  }
}
```

这里 `i18nKey` 来自数据库（后端管理），可以是任意合法的 I18nKey。但由于 `$t` 的参数类型是 `I18nKey`，如果 `i18nKey` 的类型是 `string`（而非 `I18nKey`），TypeScript 会报错。在 carlos-ui 中，`Api.SystemManage.Menu` 接口的 `i18nKey` 字段类型是 `I18nKey | null`，保证了类型安全。

---

## 五、语言切换与第三方库联动

### 5.1 `changeLocale` 在 App Store 中

```typescript
// src/store/modules/app/index.ts
const locale = ref<App.I18n.LangType>(localStg.get('lang') || 'zh-CN');

const localeOptions: App.I18n.LangOption[] = [
  { label: '中文', key: 'zh-CN' },
  { label: 'English', key: 'en-US' }
];

async function changeLocale(lang: App.I18n.LangType) {
  locale.value = lang;
  setLocale(lang);                          // 更新 vue-i18n 的 locale
  localStg.set('lang', lang);               // 持久化到 localStorage
  await loadBackendMessages(lang);          // 重新加载后端消息
}
```

### 5.2 联动更新：监听 locale 变化

```typescript
// 在 App Store 的 effectScope 中
watch(locale, () => {
  // 1. 更新文档标题
  updateDocumentTitleByLocale();

  // 2. 更新全局菜单（菜单 label 通过 i18nKey 翻译）
  routeStore.updateGlobalMenusByLocale();

  // 3. 更新标签页标题
  tabStore.updateTabsByLocale();

  // 4. 更新 dayjs locale（日期格式化语言）
  setDayjsLocale(locale.value);
});
```

### 5.3 Ant Design Vue 的 locale 同步

```typescript
// src/App.vue
const antdLocale = computed(() => {
  return antdLocales[appStore.locale];  // 根据当前语言获取 Ant Design Vue 的语言包
});

// src/locales/antd.ts
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import enUS from 'ant-design-vue/es/locale/en_US';

export const antdLocales: Record<App.I18n.LangType, Locale> = {
  'zh-CN': zhCN,
  'en-US': enUS
};
```

`ConfigProvider` 组件将 `antdLocale` 注入到所有 Ant Design Vue 组件中，使得表格、表单、日期选择器等组件的提示文本自动切换语言。

---

## 六、翻译 Key 命名规范

```
page.{module}.{page}.{field}     // 页面级翻译
common.{action}                   // 通用操作翻译
route.{routeName}                 // 路由名称翻译
theme.{category}.{item}         // 主题配置翻译
system.{field}                    // 系统级翻译
form.{field}.required             // 表单验证翻译
form.{field}.invalid              // 表单验证错误翻译
```

**示例**：
- `page.manage.user.title` → "用户列表"
- `common.add` → "新增"
- `common.addSuccess` → "添加成功"
- `route.manage_user` → "用户管理"
- `theme.themeSchema.light` → "亮色模式"
- `form.userName.required` → "请输入用户名"

**为什么不用中文直接作为 key？** 比如 `page.用户管理.用户列表`？因为：
1. 键值对存储中，英文 key 更通用，无编码问题
2. 后端数据库可以按 key 查询，英文 key 更安全
3. 代码中 `$t('page.manage.user.title')` 比 `$t('page.用户管理.用户列表')` 更利于搜索和重构

---

## 七、练习任务

### 能用：为"用户管理"页面新增一个翻译 key

在 `src/locales/langs/zh-cn.ts` 和 `en-us.ts` 中，找到 `page.manage.user` 节点，新增一个 `importUser` 字段：

```typescript
// zh-cn.ts
page: {
  manage: {
    user: {
      // ... 已有字段 ...
      importUser: '导入用户',
      exportUser: '导出用户'
    }
  }
}

// en-us.ts
page: {
  manage: {
    user: {
      // ... 已有字段 ...
      importUser: 'Import User',
      exportUser: 'Export User'
    }
  }
}
```

然后在 `src/views/manage/user/index.vue` 中，在操作按钮区域使用：

```typescript
<Button onClick={() => handleImport()}>
  {$t('page.manage.user.importUser')}
</Button>
```

### 规范：同步更新 `App.I18n.Schema` 类型

在 `src/typings/app.d.ts` 中，找到 `page.manage.user` 对应的类型定义，新增 `importUser` 和 `exportUser`：

```typescript
manage: {
  user: {
    title: string;
    userName: string;
    // ... 已有字段 ...
    importUser: string;   // 新增
    exportUser: string;   // 新增
    // ...
  }
}
```

现在如果你写 `$t('page.manage.user.importUsr')`（拼写错误），TypeScript 会立即报错。这就是**类型驱动开发**的力量。

### 精进：分析 `loadBackendMessages` 的异常处理

当前实现中，`loadBackendMessages` 如果失败，只是 `console.warn`。思考以下问题：

1. 如果后端消息加载失败，用户看到的是前端静态翻译还是空白？
2. 如果后端返回了和前端冲突的 key（比如 `common.add`），谁会覆盖谁？
3. 为什么使用 `mergeLocaleMessage` 而不是直接替换整个 messages 对象？

**答案**：
1. 会显示前端静态翻译，因为 `messages` 已经在初始化时加载了
2. 后端会覆盖前端（`mergeLocaleMessage` 的行为是深度合并，同 key 覆盖），这是设计意图——允许运营人员通过后端管理面板热更新翻译
3. `mergeLocaleMessage` 只更新目标 locale 的消息，不影响其他 locale，也不会重新创建整个 i18n 实例，性能更好

---

## 八、源码阅读清单

| 文件路径 | 阅读重点 |
|---------|---------|
| `src/locales/index.ts` | i18n 初始化、backend 消息加载、$t 导出 |
| `src/locales/locale.ts` | 本地静态消息汇总（zh-cn + en-us） |
| `src/locales/langs/zh-cn.ts` | 中文翻译文本的组织结构 |
| `src/locales/langs/en-us.ts` | 英文翻译文本的组织结构 |
| `src/locales/antd.ts` | Ant Design Vue 语言包映射 |
| `src/locales/dayjs.ts` | dayjs locale 同步 |
| `src/typings/app.d.ts` (I18n 部分) | Schema 类型定义、I18nKey 递归生成 |
| `src/store/modules/app/index.ts` | changeLocale、locale watch 联动 |
| `src/main.ts` | setupI18n 调用时机 |
| `src/App.vue` | ConfigProvider 绑定 antdLocale |
| `src/views/manage/i18n/index.vue` | 国际化管理页面（后端消息管理） |
| `src/views/manage/menu/index.vue` | i18nKey 动态翻译示例 |

---

## 九、常见错误与排查

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| `$t('xxx')` 返回 `xxx`（key 本身） | 该 key 在 messages 中不存在 | 检查 `zh-cn.ts` / `en-us.ts` 中是否定义了该 key |
| 切换语言后 Ant Design Vue 组件未切换 | `ConfigProvider` 未绑定 `locale` | 检查 `App.vue` 的 `:locale="antdLocale"` |
| 切换语言后日期格式未切换 | dayjs locale 未同步 | 检查 `setDayjsLocale` 是否在 `watch(locale)` 中调用 |
| TypeScript 报错 `$t` 参数类型不匹配 | `I18nKey` 类型未包含该字符串 | 检查 `app.d.ts` 的 `Schema` 定义，确认 key 路径正确 |
| 后端消息不生效 | `loadBackendMessages` 未调用 | 检查 `setupI18n` 中是否调用了 `loadBackendMessages` |
| 后端 key 层级错误 | 后端返回了嵌套对象而非扁平键 | 确认后端返回格式是 `{ "system.title": "xxx" }` |

---

## 十、今日收获

1. **Vue I18n 不是孤立的库**，它需要与 `ConfigProvider`（Ant Design Vue）、`dayjs`、路由、菜单、标签页等协同工作。carlos-ui 通过 `watch(locale)` 实现了统一的联动刷新。

2. **类型安全是前端国际化的优势**。Java 的 `MessageSource.getMessage()` 只能运行时检查 key 是否存在，而 Vue I18n + TypeScript 可以在编译时保证 key 的正确性。这是**用类型系统替代单元测试**的典范。

3. **前后端数据模型不一致时，用转换层适配**。`flatToNested` 是数据库扁平键与前端嵌套 messages 的桥梁，类似 Java 中 DTO 与 Entity 的转换。

4. **Key 命名规范是团队协作的基础**。`page.{module}.{page}.{field}` 的层级结构让 key 自解释，也便于在 IDE 中通过自动补全查找。

---

## 明日预告

**Day 29: ECharts 图表 — 数据可视化**
- 基础图表配置、响应式更新、事件交互、主题定制
- 重点阅读：`src/views/home/modules/line-chart.vue`

---

> **课后作业**：请完成"练习任务"中的三个层级任务，并将代码提交到个人分支。如果有疑问，对照 `src/views/manage/i18n/index.vue` 页面中的后端消息管理逻辑，理解国际化是如何在数据库层面管理的。
