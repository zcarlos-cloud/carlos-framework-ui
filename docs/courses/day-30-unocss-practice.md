# 今日前端课程 — 第30天：UnoCSS 实战 — 从配置到自定义规则

> **学习目标**
> - **能读**：理解 UnoCSS 的三层配置体系（preset → shortcuts → rules）、暗色模式适配原理、transformer 机制
> - **能用**：在 `uno.config.ts` 中新增项目专属 shorcuts 和 rules，为现有页面组件用原子类替换传统 CSS
> - **规范**：shorcuts 命名遵循项目约定（连字符小写、语义化前缀），暗色模式使用 `dark:` 变体，不使用 `!important` 强行覆盖
> - **精进**：理解 JIT（Just-In-Time）编译原理、UnoCSS 的 `presetSoybeanAdmin` 设计哲学、CSS 变量与主题系统的深度集成
>
> ⏱️ 预计用时：2-2.5小时 | 🔧 技术栈：UnoCSS 66 + Vue3 + TypeScript + VueUse + Pinia + Dark Mode

---

## 理论学习

### 核心知识点

#### 1. UnoCSS 配置架构的三层设计

carlos-framework-ui 的 UnoCSS 配置是**分层组合式设计**，每层有明确的职责边界：

```
uno.config.ts                    ← 项目级配置（theme、shortcuts、transformers）
  ├── presetUno({dark: 'class'}) ← 官方预设（Tailwind/Windi 兼容规则）
  └── presetSoybeanAdmin()       ← 业务预设（carlos-framework-ui 专用 shortcuts）
        └── packages/uno-preset/src/index.ts
```

> **Java 思维类比**：就像 Spring Boot 的 `@Configuration` 分层 —— 基础配置（`presetUno`）≈ Spring Boot AutoConfiguration，业务配置（`presetSoybeanAdmin`）≈ 项目自定义 `@Configuration`，全局变量（`themeVars`）≈ `application.yml` 中的属性定义。

**carlos-framework-ui 真实配置**（`uno.config.ts`）：

```typescript
import { defineConfig } from '@unocss/vite';
import transformerDirectives from '@unocss/transformer-directives';
import transformerVariantGroup from '@unocss/transformer-variant-group';
import type { Theme } from '@unocss/preset-uno';
import presetUno from '@unocss/preset-uno';
import { presetSoybeanAdmin } from '@sa/uno-preset';
import { themeVars } from './src/theme/vars';

export default defineConfig<Theme>({
  content: {
    pipeline: {
      exclude: ['node_modules', 'dist']   // 扫描排除，减少构建时间
    }
  },
  theme: {
    ...themeVars,                          // CSS 变量驱动的颜色体系
    fontSize: {
      'icon-xs': '0.875rem',
      'icon-small': '1rem',
      icon: '1.125rem',
      'icon-large': '1.5rem',
      'icon-xl': '2rem'
    }
  },
  shortcuts: {
    'card-wrapper': 'rd-8px shadow-sm'    // 项目级通用 shortcut
  },
  transformers: [
    transformerDirectives(),               // 支持 @apply 指令
    transformerVariantGroup()              // 支持 hover:(xxx yyy) 分组语法
  ],
  presets: [
    presetUno({ dark: 'class' }),          // 暗色模式基于 class 切换
    presetSoybeanAdmin()                   // carlos-framework-ui 业务预设
  ]
});
```

#### 2. `presetSoybeanAdmin` 的业务级 shortcuts 设计

这是 carlos-framework-ui 的**核心竞争力**之一 —— 将高频布局模式封装为语义化 shortcut，大幅减少重复代码。

**真实源码**（`packages/uno-preset/src/index.ts`）：

```typescript
// @unocss-include  ← 告诉 UnoCSS 扫描此文件中的 class 字符串

import type { Preset } from '@unocss/core';
import type { Theme } from '@unocss/preset-uno';

export function presetSoybeanAdmin(): Preset<Theme> {
  const preset: Preset<Theme> = {
    name: 'preset-soybean-admin',
    shortcuts: [
      // 第一组：Flex 布局快捷方式
      {
        'flex-center': 'flex justify-center items-center',
        'flex-x-center': 'flex justify-center',
        'flex-y-center': 'flex items-center',
        'flex-col': 'flex flex-col',
        'flex-col-center': 'flex-center flex-col',
        'flex-col-stretch': 'flex-col items-stretch',
        'i-flex-center': 'inline-flex justify-center items-center',
        'i-flex-x-center': 'inline-flex justify-center',
        'i-flex-y-center': 'inline-flex items-center',
        'i-flex-col': 'flex-col inline-flex',
        'i-flex-col-stretch': 'i-flex-col items-stretch',
        'flex-1-hidden': 'flex-1 overflow-hidden'
      },
      // 第二组：定位快捷方式
      {
        'absolute-lt': 'absolute left-0 top-0',
        'absolute-lb': 'absolute left-0 bottom-0',
        'absolute-rt': 'absolute right-0 top-0',
        'absolute-rb': 'absolute right-0 bottom-0',
        'absolute-tl': 'absolute-lt',
        'absolute-tr': 'absolute-rt',
        'absolute-bl': 'absolute-lb',
        'absolute-br': 'absolute-rb',
        'absolute-center': 'absolute-lt flex-center size-full',
        'fixed-lt': 'fixed left-0 top-0',
        'fixed-lb': 'fixed left-0 bottom-0',
        'fixed-rt': 'fixed right-0 top-0',
        'fixed-rb': 'fixed right-0 bottom-0',
        'fixed-tl': 'fixed-lt',
        'fixed-tr': 'fixed-rt',
        'fixed-bl': 'fixed-lb',
        'fixed-br': 'fixed-rb',
        'fixed-center': 'fixed-lt flex-center size-full'
      },
      // 第三组：文本溢出省略
      {
        'nowrap-hidden': 'overflow-hidden whitespace-nowrap',
        'ellipsis-text': 'nowrap-hidden text-ellipsis'
      }
    ]
  };

  return preset;
}
```

> **前端独有设计哲学**：
>
> 1. **语义组合优于原子堆砌**：与其在每个组件里写 `flex justify-center items-center`（20个字符），不如定义 `flex-center`（11个字符），可读性和一致性都更高。
> 2. **别名体系降低心智负担**：`absolute-lt`（absolute left top）是常见模式缩写，老手一看就懂，新手查一次就记住。
> 3. **@unocss-include 注释**：让 UnoCSS 扫描 preset 文件中的类名字符串。UnoCSS 默认只扫描 `.vue` / `.tsx` / `.jsx` 文件，加上这个注释后 `.ts` 文件中的字符串字面量也会被提取为原子类。

#### 3. CSS 变量驱动的主题系统

carlos-framework-ui 的 UnoCSS 配置与主题系统**深度绑定**，通过 CSS 变量实现动态主题切换。

**真实源码**（`src/theme/vars.ts`）：

```typescript
/** Create color palette vars */
function createColorPaletteVars() {
  const colors: App.Theme.ThemeColorKey[] = ['primary', 'info', 'success', 'warning', 'error'];
  const colorPaletteNumbers: App.Theme.ColorPaletteNumber[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

  const colorPaletteVar = {} as App.Theme.ThemePaletteColor;

  colors.forEach(color => {
    colorPaletteVar[color] = `rgb(var(--${color}-color))`;
    colorPaletteNumbers.forEach(number => {
      colorPaletteVar[`${color}-${number}`] = `rgb(var(--${color}-${number}-color))`;
    });
  });

  return colorPaletteVar;
}

const colorPaletteVars = createColorPaletteVars();

/** Theme vars */
export const themeVars: App.Theme.ThemeTokenCSSVars = {
  colors: {
    ...colorPaletteVars,
    nprogress: 'rgb(var(--nprogress-color))',
    container: 'rgb(var(--container-bg-color))',
    layout: 'rgb(var(--layout-bg-color))',
    inverted: 'rgb(var(--inverted-bg-color))',
    'base-text': 'rgb(var(--base-text-color))'
  },
  boxShadow: {
    header: 'var(--header-box-shadow)',
    sider: 'var(--sider-box-shadow)',
    tab: 'var(--tab-box-shadow)'
  }
};
```

> **Java 思维类比**：
> - `createColorPaletteVars()` 像 Java 工厂模式 —— 输入 5 种颜色名 + 11 个色阶值，输出 55+N 个 CSS 变量引用。
> - `themeVars` 导出后合并到 `uno.config.ts` 的 `theme` 中 → 类似于 Spring 的 `@ConfigurationProperties` 将 YML 属性映射到 Java Bean 上。
> - 运行时切换暗色模式是通过**修改 CSS 自定义属性的值**实现的（`document.documentElement.style.setProperty('--primary-color', newValue)`），而不是替换整个样式表。这比 Swing 的 `UIManager.setLookAndFeel()` 轻量得多。

#### 4. 暗色模式适配机制

carlos-framework-ui 使用 `class-based` 暗色模式（`presetUno({ dark: 'class' })`）：

```html
<!-- 暗色模式时，最外层元素被添加 dark class -->
<html class="dark">
  <!-- UnoCSS 暗色变体自动生效 -->
  <div class="bg-white dark:bg-dark">内容</div>
</html>
```

**在 vue 组件中的实际使用**（`src/components/common/dark-mode-container.vue`）：

```vue
<script setup lang="ts">
defineOptions({ name: 'DarkModeContainer' });

interface Props {
  inverted?: boolean;
}

defineProps<Props>();
</script>

<template>
  <div
    class="bg-container text-base-text transition-300"
    :class="{ 'bg-inverted text-#1f1f1f': inverted }"
  >
    <slot></slot>
  </div>
</template>
```

> **关键设计解读**：
> - `bg-container` 使用 CSS 变量 `--container-bg-color`，主题切换时自动更新颜色
> - `bg-inverted` 使用 CSS 变量 `--inverted-bg-color`，覆盖背景色
> - `transition-300` 是 UnoCSS 内置工具类（300ms 过渡），使颜色切换有平滑动画
> - `inverted` prop 通过 `:class` 动态切换，比写 `dark:bg-inverted` 更灵活 —— 因为它允许在**亮色模式下也倒置**某些区域的颜色

#### 5. JIT（Just-In-Time）编译原理

UnoCSS 的扫描-生成流程：

```
1. Vite 启动/文件变化
2. UnoCSS 扫描源码中所有 class 字符串（支持正则匹配）
3. 匹配到的 class 在 preset 中查找规则
4. 只生成用到的那部分 CSS（按需生成）
5. 注入到页面 <style> 标签中
```

> **对比传统方案**：Tailwind CSS v2 预先生成全量 3MB+ CSS 然后 PurgeCSS 删除无用部分；UnoCSS 从一开始就**只生成用到的**，天然零浪费。

#### 6. Transformer 机制

carlos-framework-ui 使用两个关键 transformer：

| Transformer                 | 作用             | 示例                                                                |
|-----------------------------|----------------|-------------------------------------------------------------------|
| `transformerDirectives()`   | 支持 `@apply` 指令 | `.btn { @apply px-4 py-2 rd-2; }`                                 |
| `transformerVariantGroup()` | 支持变体分组语法       | `hover:(bg-blue text-white)` 等价于 `hover:bg-blue hover:text-white` |

---

## carlos-framework-ui 源码阅读 + 规范评审

### 源码阅读任务

**阅读顺序（按依赖关系）**：

| #  | 文件                                              | 重点                                                             | 预计时间  |
|----|-------------------------------------------------|----------------------------------------------------------------|-------|
| 1  | `packages/uno-preset/src/index.ts`              | preset 设计：shorcuts 分组、命名规范、alias 体系                            | 10min |
| 2  | `uno.config.ts`                                 | 配置分层：theme 合并、transformers、presets 注册顺序                        | 8min  |
| 3  | `src/theme/vars.ts`                             | CSS 变量生成：工厂函数、色阶遍历、类型安全                                        | 10min |
| 4  | `src/theme/settings.ts`                         | 主题 tokens：light/dark 颜色值、布局尺寸、水印配置                             | 10min |
| 5  | `src/components/common/dark-mode-container.vue` | 暗色容器：CSS 变量 + 动态 class 切换                                      | 5min  |
| 6  | `src/App.vue`                                   | 顶层使用：`bg-layout` + `absolute-lt!` + ConfigProvider 主题          | 5min  |
| 7  | `src/layouts/modules/global-header/index.vue`   | 布局组件：`flex-y-center` / `shadow-header` / `px-12px`             | 5min  |
| 8  | `src/layouts/base-layout/index.vue`             | 复杂布局：AdminLayout props + computed 派生 + SCSS 兜底                 | 8min  |
| 9  | `src/views/home/index.vue`                      | 页面编排：`ASpace` / `ARow/ACol` 响应式 + 子组件组合                        | 5min  |
| 10 | `src/views/home/modules/header-banner.vue`      | 卡片实战：`card-wrapper` / `flex-y-center` / `size-72px` / `rd-1/2` | 5min  |

### 规范评审清单

对照 `前端开发规范.md` 逐项检查：

| 检查项             | 规范要求                             | 实际代码表现                                                                                                                            | 评分    |
|-----------------|----------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|-------|
| UnoCSS 优先       | 优先使用原子类，SCSS 仅用于全局               | `dark-mode-container.vue`: class 全用 UnoCSS 原子/主题类，无 scoped CSS；`base-layout/index.vue`: 仅用 SCSS `@include scrollbar()` 处理浏览器滚动条样式 | ✅     |
| shortcuts 命名    | kebab-case，语义化                   | `flex-center`, `absolute-lt`, `ellipsis-text`, `card-wrapper` — 全部 kebab-case + 语义化                                               | ✅     |
| 暗色模式            | 使用 `dark:` 变体，与主题系统联动            | `presetUno({ dark: 'class' })` + CSS 变量体系 + Pinia theme store 联动                                                                  | ✅     |
| 避免 `!important` | 不使用 `!important` 强行覆盖            | `absolute-lt!` 在 App.vue 水印中使用 `!` 覆盖（属合理场景，水印需要最顶层）                                                                              | ⚠️ 可控 |
| 组件名声明           | `defineOptions({ name: 'Xxx' })` | 全部组件均声明                                                                                                                           | ✅     |
| Props 类型        | TypeScript interface + JSDoc     | `HeaderBanner` Props 有完整 interface 定义和行内注释                                                                                        | ✅     |
| 导入顺序            | type → 第三方 → 内部 → 相对             | `App.vue` 导入顺序完全符合规范（type → vue → store → locales → 相对）                                                                           | ✅     |
| 全局 SCSS         | 仅用于全局变量，不写组件样式                   | `global.scss` 仅 `@forward './scrollbar.scss'`，无冗余                                                                                 | ✅     |
| 主题变量            | CSS 变量 + TypeScript 类型安全         | `themeVars` 导出时类型为 `App.Theme.ThemeTokenCSSVars`，编译时类型安全                                                                          | ✅     |

---

## 功能实践三步

### 今天的目标

为 carlos-framework-ui 新增一个**项目专属的状态徽章 shortcut**，并在现有页面中使用它替换重复的 Tag 样式代码。

---

### 第一步：分解 — 分析需求，规划实现路径

**需求分析**：
当前 `src/views/manage/user/index.vue` 中，状态 Tag 的样式是通过 Ant Design Vue 的 `<Tag color="...">` 实现的：

```tsx
// 当前代码（src/views/manage/user/index.vue）
const tagMap: Record<Api.Common.EnableStatus, string> = {
  '1': 'success',   // 启用 → 绿色
  '2': 'warning'    // 禁用 → 橙色
};
return <Tag color={tagMap[record.status]}>{label}</Tag>;
```

**问题**：

1. Tag 颜色语义化不足 —— `success`/`warning` 是 Ant Design 的语义色，与业务含义（启用/禁用）不完全对应
2. 如果以后要自定义状态颜色，需要全局搜索所有 Tag 使用处

**设计方案**：

- 在 `uno.config.ts` 的 `shortcuts` 中新增 `status-badge-{state}` 系列 shortcut
- shortcuts 内部使用 UnoCSS 原子类，而非 Ant Design 的固定颜色

**实现路径**：

```
Step 1: 在 uno.config.ts 中定义 4 个状态 shortcut
Step 2: 在 src/views/manage/user/index.vue 中替换 Tag 为自定义 badge
Step 3: 在 src/views/home/modules/card-data.vue 中展示新 badge
Step 4: 验证暗色模式自动适配
```

---

### 第二步：开发 — 编写配置与组件代码

#### Step 1: 在 `uno.config.ts` 中新增状态 badge shortcuts

编辑文件：`uno.config.ts`

```typescript
// 在 shortcuts 对象中新增状态徽章快捷方式
shortcuts: {
  'card-wrapper': 'rd-8px shadow-sm',

  // 新增：状态徽章（Status Badge）
  'status-badge': 'inline-flex items-center px-8px py-2px rd-4px text-12px font-medium whitespace-nowrap',
  'status-badge-active': 'status-badge bg-primary-50 text-primary-500 dark:bg-primary-900 dark:text-primary-200',
  'status-badge-inactive': 'status-badge bg-warning-50 text-warning-500 dark:bg-warning-900 dark:text-warning-200',
  'status-badge-success': 'status-badge bg-success-50 text-success-500 dark:bg-success-900 dark:text-success-200',
  'status-badge-error': 'status-badge bg-error-50 text-error-500 dark:bg-error-900 dark:text-error-200',
  'status-badge-info': 'status-badge bg-info-50 text-info-500 dark:bg-info-900 dark:text-info-200',
}
```

> **设计要点**：
> - `status-badge` 作为**基类**定义通用样式（尺寸、圆角、字体）
> - 各状态变体使用 UnoCSS 主题色系统（`primary-50` 等来自 `themeVars`）
> - 暗色模式自动适配：`dark:bg-primary-900 dark:text-primary-200`
> - 这种**基类 + 变体**模式类似 Java 的**模板方法模式**：基类定义骨架，子类（变体）填充颜色

#### Step 2: 创建 status-badge 组件

创建文件：`src/components/common/status-badge.vue`

```vue
<script setup lang="ts">
defineOptions({ name: 'StatusBadge' });

interface Props {
  /** Status type */
  type?: 'active' | 'inactive' | 'success' | 'error' | 'info';
  /** Display text */
  text?: string;
}

withDefaults(defineProps<Props>(), {
  type: 'info'
});
</script>

<template>
  <span :class="`status-badge-${type}`">{{ text }}</span>
</template>

<style scoped></style>
```

#### Step 3: 在 `src/views/manage/user/index.vue` 中替换 Tag

找到 `customRender` 中的 Tag 渲染部分，替换为 StatusBadge：

```vue
<!-- 在 script setup 顶部添加导入 -->
import StatusBadge from '@/components/common/status-badge.vue';

<!-- 将 Tag 替换为 StatusBadge（以 status 列为例） -->
{
  key: 'status',
  dataIndex: 'status',
  title: $t('page.manage.user.userStatus'),
  align: 'center',
  width: 100,
  customRender: ({ record }) => {
    if (record.status === null) return null;
    const label = $t(enableStatusRecord[record.status]);
    // 使用 status-badge 系列 shortcut
    const type = record.status === '1' ? 'success' : 'inactive';
    return <StatusBadge type={type} text={label} />;
  }
}
```

#### Step 4: 在 `src/views/home/modules/header-banner.vue` 中展示（验证）

在 HeaderBanner 组件中添加示例使用：

```vue
<script setup lang="ts">
import StatusBadge from '@/components/common/status-badge.vue';
// ... 其他导入
</script>

<template>
  <ACard :bordered="false" class="card-wrapper">
    <!-- 现有内容 ... -->
    <div class="mt-8px flex gap-8px">
      <StatusBadge type="success" text="系统正常" />
      <StatusBadge type="info" text="12条消息" />
    </div>
  </ACard>
</template>
```

---

### 第三步：整合测试 — 验证与验收

#### 验证清单

| 验证项       | 操作                    | 预期结果                                                 |
|-----------|-----------------------|------------------------------------------------------|
| 组件渲染      | `pnpm dev` 启动，打开用户管理页 | StatusBadge 正常显示，样式与原 Tag 一致                         |
| 亮色模式      | 在亮色模式下观察              | 背景色为浅色（如 `bg-primary-50`），文字颜色深色                     |
| 暗色模式      | 切换到暗色模式               | 背景色自动切换为深色（如 `bg-primary-900`），文字颜色浅色                |
| 类型检查      | `pnpm typecheck`      | 无 TypeScript 错误                                      |
| Lint 检查   | `pnpm lint`           | 无 ESLint 错误                                          |
| 组件命名      | 查看 Vue DevTools       | 组件树中显示 `StatusBadge`                                 |
| 文件命名      | 检查文件路径                | `src/components/common/status-badge.vue`（kebab-case） |
| UnoCSS 扫描 | 检查构建产物中是否包含 shortcut  | `.status-badge-active` 等 class 在 CSS 中               |
| 响应式       | 缩小浏览器窗口至移动端           | badge 不溢出，布局正常                                       |

#### 验收标准

- [ ] **能用**：StatusBadge 在页面中正确渲染，亮色/暗色模式切换正常
- [ ] **规范**：
    - `pnpm typecheck` 通过（类型无报错）
    - `pnpm lint` 通过（无 ESLint 报错）
    - 组件文件名 `kebab-case`
    - 组件代码名 `PascalCase`（通过 `defineOptions` 声明）
    - Props 有 JSDoc 注释和完整 TypeScript 类型
    - 导入顺序：type → vue → store → components → 相对路径
- [ ] **精进**：
    - 零 `any`（所有 Props 类型明确）
    - 暗色模式适配（shortcut 中包含 `dark:` 变体）
    - 使用 CSS 变量颜色（非硬编码色值）
    - 基类抽取公共样式（`status-badge` 复用）
    - 短路求值处理 null 状态（`record.status === null ? null : ...`）

---

## 今日重点记忆卡

| 概念                        | 一句话                                                | Java 类比                                  | 前端独有                     |
|---------------------------|----------------------------------------------------|------------------------------------------|--------------------------|
| UnoCSS preset             | 可复用的规则集合，像 Maven 的 BOM 一样管理样式依赖                    | Maven BOM（Bill of Materials）依赖管理         | 纯 JS 函数，可编程生成规则；支持按需加载   |
| shortcut                  | 将多个原子类组合为一个语义化类名                                   | Java 工具方法封装多个操作一步完成                      | 编译时展开为原子类，无运行时性能损失       |
| theme.vars                | CSS 变量生成器，工厂函数批量创建色阶引用                             | Spring `@ConfigurationProperties` 注入 YML | CSS 变量 = 运行时可变主题，无需重新编译  |
| `dark:` 变体                | 条件样式：仅当父元素有 `dark` class 时生效                       | Java `if (Theme.isDark())` 条件分支          | 纯 CSS 驱动，浏览器原生支持，0 JS 开销 |
| `transformerDirectives`   | 支持 `@apply` 指令，在 SCSS 中使用原子类                       | Java `@Import` 注解导入其他配置                  | 将原子类"编译"到传统 CSS 规则中      |
| `transformerVariantGroup` | 分组语法 `hover:(a b c)` 等价于 `hover:a hover:b hover:c` | `Arrays.asList()` 批量操作                   | 编译时展开，无运行时开销             |
| JIT 编译                    | 扫描源码 → 匹配规则 → 仅生成用到的 CSS                           | Java JIT 编译器（热点代码编译）                     | 构建产物极小，开发时 HMR 极快        |
| CSS 变量颜色                  | `rgb(var(--primary-color))` 运行时动态切换                | Java `System.getProperty("color")`       | 属性级变更，无需 DOM 遍历/样式表替换    |

---

## 扩展思考（进阶）

### 1. 为什么 `presetSoybeanAdmin` 用多个 `shortcuts` 数组而非一个？

```typescript
// 当前设计：多组分离
shortcuts: [
  { /* flex 类 */ },
  { /* 定位类 */ },
  { /* 文本类 */ }
]
```

> **设计理由**：UnoCSS 的 shortcuts 合并逻辑是**后者覆盖前者**。分组建模有以下好处：
> - **可维护性**：新增一种定位方式时，只需在第二组中添加，不影响 flex 组
> - **依赖清晰**：`absolute-tl` → `absolute-lt`（别名关系在同一组内）
> - **覆盖安全**：如果两组都定义了同名 shortcut，后者覆盖前者（符合 programmer expectation）

### 2. 为什么不直接用 Tailwind CSS？

| 对比维度    | Tailwind CSS                       | UnoCSS (carlos-framework-ui)    |
|---------|------------------------------------|---------------------------------|
| 原子类来源   | 预设固定类名（3MB+）                       | 按需扫描生成                          |
| 自定义规则   | 需写 `tailwind.config.js` 的 `extend` | 直接写 JS/TS 函数生成规则                |
| 预设系统    | 插件机制（Plugin API）                   | preset 函数（更灵活）                  |
| 图标支持    | 需额外配置                              | 内置 `presetIcons`，与 Iconify 深度集成 |
| Vite 集成 | `@tailwindcss/vite`                | 原生 Vite 插件                      |
| 暗色模式    | `darkMode: 'class'`                | `presetUno({ dark: 'class' })`  |

### 3. CSS 变量 vs SCSS 变量：何时用哪个？

| 场景                | 推荐方案                   | 原因                   |
|-------------------|------------------------|----------------------|
| 运行时动态切换（主题）       | CSS 变量                 | SCSS 编译后是静态值，无法运行时修改 |
| 编译时常量（断点、z-index） | SCSS 变量                | 更轻量，无需运行时解析          |
| 组件级样式             | UnoCSS 原子类             | 按需生成，无冗余             |
| 浏览器滚动条样式          | SCSS（`scrollbar.scss`） | UnoCSS 不覆盖伪元素选择器     |

---

## 完整文件变更摘要

| 操作     | 文件                                         | 说明                                           |
|--------|--------------------------------------------|----------------------------------------------|
| **修改** | `uno.config.ts`                            | 新增 6 个 `status-badge*` shortcut              |
| **新建** | `src/components/common/status-badge.vue`   | StatusBadge 通用组件                             |
| **修改** | `src/views/manage/user/index.vue`          | Tag 替换为 StatusBadge（status 列 + userGender 列） |
| **修改** | `src/views/home/modules/header-banner.vue` | 新增 StatusBadge 展示区                           |

---

**明日预告**：第31天 — 图标系统：Iconify、unplugin-icons、SVG 组件化，深入理解 `svg-icon.vue` 的设计与 Iconify 按需加载机制。

---

> 📚 阅读索引：
> - `packages/uno-preset/src/index.ts` — `presetSoybeanAdmin` 设计（重点：shorcuts 三分组、别名体系）
> - `uno.config.ts` — 项目 UnoCSS 配置（重点：theme 合并、transformers）
> - `src/theme/vars.ts` — CSS 变量生成器（重点：createColorPaletteVars 工厂模式）
> - `src/theme/settings.ts` — 主题默认值（重点：light/dark tokens）
> - `src/components/common/dark-mode-container.vue` — 暗色容器（重点：bg-container + inverted）
> - `src/layouts/modules/global-header/index.vue` — Header 布局（重点：flex-y-center / shadow-header）
> - `src/App.vue` — 顶层入口（重点：ConfigProvider + bg-layout + absolute-lt!）
> - `src/views/home/index.vue` — 首页编排（重点：ARow/ACol 响应式栅格）
> - `src/views/home/modules/header-banner.vue` — Banner 卡片（重点：card-wrapper + rd-1/2）
> - `src/views/manage/user/index.vue` — 用户管理页（重点：TSX 中的 class 使用）
> - UnoCSS 官方文档：[https://unocss.dev/](https://unocss.dev/)
