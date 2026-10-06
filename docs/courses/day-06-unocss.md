# 今日前端课程 — 第6天：CSS 原子化与 UnoCSS — 不写 CSS 文件也能写样式

> **学习目标**
> - 能读：看懂 carlos-ui 中任意组件的 `class="..."` 写法，理解每个原子类的含义
> - 能用：用 UnoCSS 原子类快速还原一个设计稿布局，不再写传统 CSS
> - 规范：遵循项目 `uno.config.ts` 的 shortcuts 和 theme 配置，自定义类名有规则
> - 精进：理解 JIT 即时编译原理，能诊断"类名写了但样式不生效"的问题
>
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + UnoCSS 66 + @sa/uno-preset

---

## 理论学习

### 核心知识点

#### 1. 什么是原子化 CSS（Atomic CSS）？

传统 CSS 写法：
```css
/* 一个类负责一堆样式 */
.card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

原子化 CSS 写法：
```html
<!-- 每个类只负责一个属性 -->
<div class="flex justify-between items-center p-4 rd-8px shadow-sm">
```

**核心思想**：一个工具类 = 一个 CSS 声明。组合使用，不再写自定义 CSS。

#### 2. UnoCSS 与传统方案的区别

| 方案 | 原理 | 特点 | 类比 |
|------|------|------|------|
| **Tailwind** | 预生成大量工具类（3MB+） | 类名固定，PurgeCSS 移除未使用 | Java 的完整依赖库 |
| **Windicss** | JIT 即时编译（按需生成） | 扫描模板，动态生成 | Java 的按需依赖加载 |
| **UnoCSS** | **引擎化**：即时编译 + 预设 + 自定义规则 | 零预生成、极速、可定制 | Java 的 **SPI 机制** — 只加载你声明的 |

> **关键理解**：UnoCSS 不是"一个 CSS 文件"，而是一个**编译时引擎**。你在 HTML/JSX/Vue 模板中写的 `class="flex items-center"`，Vite 构建时会被 UnoCSS 扫描到，即时生成对应的 CSS 规则注入到产物中。

#### 3. UnoCSS 核心配置项（看 `uno.config.ts`）

```typescript
// uno.config.ts — carlos-ui 真实配置
import {defineConfig} from '@unocss/vite';
import presetUno from '@unocss/preset-uno';
import {presetSoybeanAdmin} from '@sa/uno-preset';
import {themeVars} from './src/theme/vars';

export default defineConfig({
  theme: {
    ...themeVars,          // 主题变量：颜色、阴影
    fontSize: { ... }      // 自定义字号：icon-xs ~ icon-xl
  },
  shortcuts: {
    'card-wrapper': 'rd-8px shadow-sm'  // 自定义组合类
  },
  presets: [
    presetUno({dark: 'class'}),         // 基础预设（类 Tailwind）
    presetSoybeanAdmin()                 // 项目专属预设
  ],
  transformers: [
    transformerDirectives(),    // 支持 @apply 指令
    transformerVariantGroup()   // 支持 hover:(bg-red text-white) 简写
  ]
});
```

#### 4. 项目 shortcuts 速查（来自 `@sa/uno-preset`）

| Shortcut | 展开后 |
|---------|--------|
| `flex-center` | `flex justify-center items-center` |
| `flex-x-center` | `flex justify-center` |
| `flex-y-center` | `flex items-center` |
| `flex-col` | `flex flex-col` |
| `flex-col-center` | `flex flex-col justify-center items-center` |
| `absolute-lt` | `absolute left-0 top-0` |
| `absolute-center` | `absolute left-0 top-0 flex justify-center items-center w-full h-full` |
| `fixed-center` | `fixed left-0 top-0 ...` |
| `ellipsis-text` | `overflow-hidden whitespace-nowrap text-ellipsis` |
| `card-wrapper`（项目级） | `rd-8px shadow-sm` |

#### 5. 常用原子类速查表

| 类名 | 含义 | CSS 等价 |
|------|------|---------|
| `flex` | Flex 布局 | `display: flex` |
| `items-center` | 垂直居中 | `align-items: center` |
| `justify-between` | 两端对齐 | `justify-content: space-between` |
| `justify-center` | 水平居中 | `justify-content: center` |
| `px-4` | 水平内边距 1rem | `padding-left/right: 1rem` |
| `py-3` | 垂直内边距 0.75rem | `padding-top/bottom: 0.75rem` |
| `p-4` | 四边内边距 1rem | `padding: 1rem` |
| `m-2` | 四边外边距 0.5rem | `margin: 0.5rem` |
| `bg-white` | 白色背景 | `background-color: white` |
| `rd-8px` / `rounded-lg` | 圆角 | `border-radius: 8px` / `0.5rem` |
| `shadow-sm` | 小阴影 | `box-shadow: ...` |
| `text-red-500` | 红色文字 | `color: #ef4444` |
| `text-16px` | 16px 字号 | `font-size: 16px` |
| `text-white` | 白色文字 | `color: white` |
| `dark:text-dark` | dark 模式下文字色 | CSS 变量切换 |
| `w-full` | 宽度 100% | `width: 100%` |
| `h-full` | 高度 100% | `height: 100%` |
| `h-360px` | 高度 360px | `height: 360px` |
| `size-full` | 宽高 100% | `width: 100%; height: 100%` |
| `overflow-hidden` | 隐藏溢出 | `overflow: hidden` |
| `relative` | 相对定位 | `position: relative` |
| `absolute` | 绝对定位 | `position: absolute` |

---

### Java 思维类比

> **Java 开发者的理解桥梁**
>
> | 前端概念 | Java 类比 | 连接说明 |
> |---------|----------|---------|
> | 原子化 CSS | **Builder 模式的方法链** | `new Builder().flex().center().padding(16).radius(8).build()` → `class="flex items-center p-4 rd-8px"` |
> | UnoCSS 预设 | **Spring 的 AutoConfiguration** | 引入 `preset-uno` 就自动有了大量工具类，像引入 Spring Boot Starter |
> | `shortcuts` | **常量定义 / 宏** | `public static final String CARD_WRAPPER = "rd-8px shadow-sm"` |
> | `theme.vars` | **application.yml 配置** | 颜色、阴影等设计 token 集中管理，像 Spring 的配置属性 |
> | `@apply` | **方法抽取（Extract Method）** | 把一堆原子类组合成一个语义化类名，类似重构 |
>
> 但是记住：**类比只是桥梁**。前端这样做是因为浏览器渲染机制与 JVM 完全不同。

---

### 超越类比 — 前端独有的设计哲学

> **为什么前端拥抱原子化 CSS，而 Java 世界没有"原子化样式"？**
>
> 1. **HTML/CSS 的分离是天然的，不是强制的**
>    - Java Swing/JavaFX 的样式是代码的一部分（`setBackground()`、`setFont()`）
>    - 前端 HTML + CSS 分离，导致传统写法要维护两份文件 → 原子化 CSS 把样式"内联"到 HTML，减少心智负担
>
> 2. **浏览器有缓存，但 CSS 文件大小影响首屏**
>    - 传统 CSS：写一个 `.card` 类，但 90% 的声明可能在当前页面用不到 → 体积浪费
>    - UnoCSS：只生成你**写过的类名**，产物体积趋近于最优
>
> 3. **团队协作：命名是最难的**
>    - Java 有包名、类名、方法名的强约束；CSS 类名是全局的，`.card` 在项目里可能有 10 种含义
>    - 原子化 CSS 消除了"命名 CSS 类"的问题 — 你不需要想名字，只需要描述样式
>
> 4. **响应式与 Dark 模式的天然支持**
>    - `sm:px-4`（移动端小屏）、`dark:bg-black`（暗色模式）—— 条件前缀在原子化体系里是一等公民
>    - Java GUI 要切换主题需要重写 Paint 方法，成本完全不同
>
> 5. **JIT 编译与浏览器的关系**
>    - Java 的 JIT（HotSpot）运行时优化字节码；UnoCSS 的 JIT 编译时优化 CSS
>    - 两者都是"按需生成"，但阶段不同：Java 在运行时，UnoCSS 在构建时

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

- `uno.config.ts` — UnoCSS 主配置，定义 theme、shortcuts、presets
- `packages/uno-preset/src/index.ts` — 项目专属预设，封装常用 shortcuts
- `src/theme/vars.ts` — 主题变量（颜色、阴影），注入到 UnoCSS theme
- `src/views/home/modules/card-data.vue` — 大量使用 UnoCSS 原子类的真实组件
- `src/views/home/modules/line-chart.vue` — 使用 `card-wrapper` shortcut 的组件

---

### 阅读指引

**第一步：看配置串联关系**

```
theme/vars.ts ──→ uno.config.ts ──→ @sa/uno-preset
      ↓                ↓                  ↓
  颜色/阴影定义     主配置入口           项目 shortcuts
```

理解这个链条：为什么颜色不直接写在 `uno.config.ts` 里？

> **答案**：`vars.ts` 不只给 UnoCSS 用，还给 SCSS 变量、Ant Design Vue 的 `ConfigProvider` 主题、JS 运行时动态切换主题用。一处定义，多处消费 —— 这就是**设计 Token** 模式。

**第二步：看 `card-data.vue` 中的 class 用法**

```vue
<template>
  <ACard :bordered="false" size="small" class="card-wrapper">
    <GradientBg :gradient-color="..." class="flex-1">
      <h3 class="text-16px">{{ item.title }}</h3>
      <div class="flex justify-between pt-12px">
        <SvgIcon :icon="item.icon" class="text-32px"/>
        <CountTo :prefix="item.unit" class="text-30px text-white dark:text-dark"/>
      </div>
    </GradientBg>
  </ACard>
</template>
```

逐行解析：
- `card-wrapper` → `rd-8px shadow-sm`（圆角 + 阴影，来自 `uno.config.ts` shortcuts）
- `flex-1` → `flex: 1 1 0%`（弹性项占满剩余空间）
- `text-16px` → `font-size: 16px`
- `flex justify-between` → `display: flex; justify-content: space-between`
- `pt-12px` → `padding-top: 12px`
- `text-32px` / `text-30px` → 字体大小
- `text-white` → 白色文字
- `dark:text-dark` → **Dark 模式前缀**：当父元素有 `.dark` 类时生效

**第三步：思考"如果不用原子化 CSS，这段代码会怎样？"**

```vue
<!-- 传统写法：需要额外写 <style> -->
<template>
  <ACard class="home-card">
    <div class="gradient-bg">
      <h3 class="card-title">...</h3>
      <div class="card-body">
        <SvgIcon class="card-icon"/>
        <CountTo class="card-value"/>
      </div>
    </div>
  </ACard>
</template>

<style scoped>
.home-card { border-radius: 8px; box-shadow: ...; }
.gradient-bg { flex: 1; }
.card-title { font-size: 16px; }
.card-body { display: flex; justify-content: space-between; padding-top: 12px; }
.card-icon { font-size: 32px; }
.card-value { font-size: 30px; color: white; }
.dark .card-value { color: dark; }
</style>
```

对比结论：
- 传统写法：18 行 CSS + 6 个命名 → **需要命名，容易冲突**
- 原子化写法：0 行 CSS + 直接语义 → **无命名负担，所见即所得**

---

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ | 说明 |
|--------|------|---------------|------|
| 命名规范 | 文件 kebab-case、函数 camelCase、组件 PascalCase | ✅ | `card-data.vue` 正确；`LineChart` 正确 |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ | `CardData` 接口完整定义；`computed<CardData[]>` 有泛型 |
| 目录规范 | 文件放在正确目录 | ✅ | `views/home/modules/` 是页面子模块目录 |
| 导入顺序 | type → 第三方 → 内部 → 相对 | ✅ | `createReusableTemplate`（第三方）→ `$t`、`useAppStore`（内部）→ `./xxx`（相对） |
| 错误处理 | 异步有 try/catch | ⚠️ N/A | 本组件无异步操作 |
| 可测试性 | 纯函数可单测 | ✅ | `getGradientColor` 是纯函数，可单测 |
| 国际化 | 用户可见字符串用 `$t()` | ✅ | `item.title` 来自 `$t()` |
| UnoCSS 使用 | 优先原子类，少用 scoped CSS | ✅ | 两个文件的 `<style scoped>` 均为空！ |

> **重点发现**：`card-data.vue` 和 `line-chart.vue` 的 `<style scoped>` 都是空的！这说明它们**完全依赖 UnoCSS 原子类**，没有写一行自定义 CSS —— 这是项目的最佳实践。

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**目标**：复刻 carlos-ui Dashboard 首页中的"数据卡片"组件，用纯 UnoCSS 原子类实现。

功能拆解：
1. **卡片容器**：圆角、阴影、背景、内边距
2. **渐变背景**：从左上到右下的线性渐变
3. **标题区**：字体大小、颜色、位置
4. **内容区**：Flex 布局，图标 + 数值两端对齐
5. **响应式**：移动端一列，平板两列，桌面四列
6. **Dark 模式适配**：暗色模式下文字颜色切换

---

### 第二步：小任务开发

#### 任务 1：卡片容器（使用 `card-wrapper` shortcut）

```vue
<template>
  <!-- card-wrapper = rd-8px shadow-sm -->
  <div class="card-wrapper bg-white dark:bg-dark p-16px">
    <!-- 内容 -->
  </div>
</template>
```

> **要点**：`dark:bg-dark` 是 UnoCSS 的 **dark 模式变体前缀**，当 HTML 根元素有 `.dark` 类时自动切换背景色。

#### 任务 2：渐变背景卡片（仿 `GradientBg`）

```vue
<template>
  <div
    class="rd-8px px-16px pb-4px pt-8px text-white"
    :style="{ backgroundImage: 'linear-gradient(to bottom right, #ec4786, #b955a4)' }"
  >
    <h3 class="text-16px">访问量</h3>
    <div class="flex justify-between pt-12px">
      <span class="text-32px">📊</span>
      <span class="text-30px">9,725</span>
    </div>
  </div>
</template>
```

> **要点**：内联样式用于动态渐变（每个卡片颜色不同），原子类用于固定布局属性。两者**共存**，不是"二选一"。

#### 任务 3：响应式四列布局

```vue
<template>
  <ARow :gutter="[16, 16]">
    <!-- :span="24" = 独占一行（移动端） -->
    <!-- :md="12" = 平板端占一半（2列） -->
    <!-- :lg="6" = 桌面端占 1/4（4列） -->
    <ACol :span="24" :md="12" :lg="6">
      <Card1 />
    </ACol>
    <ACol :span="24" :md="12" :lg="6">
      <Card2 />
    </ACol>
    <ACol :span="24" :md="12" :lg="6">
      <Card3 />
    </ACol>
    <ACol :span="24" :md="12" :lg="6">
      <Card4 />
    </ACol>
  </ARow>
</template>
```

> **要点**：Ant Design Vue 的栅格系统（`ARow`/`ACol`）负责**布局框架**，UnoCSS 负责**视觉样式**。两者**协作**，不是"谁替代谁"。

#### 任务 4：纯 UnoCSS 实现响应式（不用 AntDV 栅格）

```vue
<template>
  <!-- 纯 UnoCSS 的 Grid 布局方案 -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16px">
    <div v-for="i in 4" :key="i" class="card-wrapper p-16px">
      Card {{ i }}
    </div>
  </div>
</template>
```

> **要点**：`grid-cols-1 md:grid-cols-2 lg:grid-cols-4` —— `md:` 和 `lg:` 是 **响应式前缀**，与 Tailwind 完全一致。
>
> **Java 类比**：这像是 Java 的媒体查询 `if (screenWidth >= 768) { gridCols = 2; }` —— 但前端是用声明式类名实现的。

---

### 第三步：整合与调试

**完整组件代码**：

```vue
<script setup lang="ts">
import {computed} from 'vue';

interface DataCard {
  title: string;
  value: number;
  icon: string;
  gradient: [string, string];
}

const cards = computed<DataCard[]>(() => [
  { title: '访问量', value: 9725, icon: '📊', gradient: ['#ec4786', '#b955a4'] },
  { title: '成交额', value: 1026, icon: '💰', gradient: ['#865ec0', '#5144b4'] },
  { title: '下载量', value: 970925, icon: '📥', gradient: ['#56cdf3', '#719de3'] },
  { title: '成交量', value: 9527, icon: '🤝', gradient: ['#fcbc25', '#f68057'] }
]);

function getGradient(color: [string, string]) {
  return `linear-gradient(to bottom right, ${color[0]}, ${color[1]})`;
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16px">
    <div
      v-for="card in cards"
      :key="card.title"
      class="rd-8px px-16px pb-4px pt-8px text-white shadow-sm"
      :style="{ backgroundImage: getGradient(card.gradient) }"
    >
      <h3 class="text-16px">{{ card.title }}</h3>
      <div class="flex justify-between pt-12px">
        <span class="text-32px">{{ card.icon }}</span>
        <span class="text-30px">{{ card.value.toLocaleString() }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
```

**调试检查清单**：

1. **类名是否生效？**
   - 打开浏览器 DevTools → Elements 面板 → 检查对应元素
   - 看 Computed 样式中是否有预期属性
   - 如果没有：检查 `uno.config.ts` 是否包含该 preset

2. **Dark 模式是否切换？**
   - 在 HTML 根元素上添加/移除 `.dark` 类
   - 观察 `dark:text-dark`、`dark:bg-dark` 是否生效

3. **响应式是否正常？**
   - DevTools → Toggle Device Toolbar → 切换不同屏幕宽度
   - 验证 `md:`、`lg:` 前缀是否按预期切换

4. **构建产物检查**：
   ```bash
   pnpm build
   # 查看 dist/assets/ 中的 CSS 文件大小
   # UnoCSS 产物应该很小（只包含你用过的类）
   ```

### 验收标准

- [ ] **能用**：组件渲染正常，四张卡片在桌面端一行四列，移动端一列
- [ ] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过
- [ ] **精进**：`<style scoped>` 为空（零自定义 CSS），所有样式由 UnoCSS 原子类提供

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| **原子化 CSS** | 一个类 = 一个 CSS 属性，组合使用 | Builder 模式的方法链 `.setXxx().setYyy()` | 不需要命名单个类名，消除命名冲突 |
| **UnoCSS** | 即时扫描类名并生成 CSS 的引擎 | Java SPI 机制 — 按需加载 | 零预生成体积，构建时才产出 CSS |
| **shortcut** | 自定义组合类，如 `card-wrapper` | 常量定义 `public static final String` | 用一行语义化名字替代多行原子类 |
| **dark:** 前缀 | 暗色模式条件样式 | `if (theme == DARK)` 条件分支 | 声明式前缀，HTML 加 `.dark` 类即切换 |
| **响应式前缀** | `sm:` `md:` `lg:` | `if (screenWidth >= breakpoint)` | 完全声明式，不写任何 JS 媒体查询代码 |
| **@apply** | 在 CSS 中用原子类 | 方法抽取重构 | 用于必须在 `<style>` 中写的情况（少用） |
| **设计 Token** | `vars.ts` 一处定义，多处消费 | `application.yml` 集中配置 | 给 UnoCSS、SCSS、AntDV ConfigProvider、JS 运行时共用 |

---

## 常见坑点与排查

### 坑 1：写了类名，样式不生效

**原因**：UnoCSS 是**编译时扫描**，它只扫描你源码中**字面量**写出的 class 字符串。动态拼接的类名无法识别。

```vue
<!-- ❌ 危险：动态拼接，UnoCSS 扫描不到 -->
<div :class="`text-${size}`">

<!-- ✅ 安全：完整写出所有可能 -->
<div :class="{ 'text-16px': size === '16', 'text-32px': size === '32' }">
```

**Java 类比**：这像 Java 的**反射无法被编译器优化** — 动态的东西在编译时不可知。

### 坑 2：Dark 模式不切换

**检查**：
1. `uno.config.ts` 中 `presetUno({dark: 'class'})` —— `'class'` 模式表示通过 HTML class 控制
2. HTML 根元素是否有 `class="dark"`？（由 `useDark()` 或手动切换）
3. 类名是否写了 `dark:` 前缀？如 `dark:bg-dark`

### 坑 3：与 Ant Design Vue 的样式冲突

**原则**：Ant Design Vue 的组件自带样式（如 `ACard`、`AButton`），UnoCSS 的原子类**覆盖**或**补充**这些样式。两者是**层叠关系**，不是互斥。

```vue
<!-- ACard 自带样式 + UnoCSS 补充圆角阴影 -->
<ACard class="card-wrapper">
```

---

**明日预告**：第7天 — Vue 3 概览：从 Options API 到 Composition API。我们将正式进入 Vue 3 核心学习，理解响应式系统的本质。

---

> 💡 **今日寄语**：UnoCSS 的本质是"用声明替代实现"。你在 class 中写的不是"样式名称"，而是"样式指令" —— 编译器帮你翻译成 CSS。这与 Java 的注解（`@Transactional`、`@Cacheable`）异曲同工：声明意图，框架实现。
