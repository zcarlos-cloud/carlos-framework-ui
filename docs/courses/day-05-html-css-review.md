# 今日前端课程 — 第5天：HTML5 / CSS3 快速回顾 — 从 JSP/Thymeleaf 到现代布局

> **学习目标**
> - **能读**：看懂 carlos-ui 中 UnoCSS 原子类的含义，理解响应式断点 `md:` `lg:` 的作用
> - **能用**：用 Flexbox 和 Grid 完成常见布局，用 UnoCSS 原子类替代手写 CSS
> - **规范**：遵循"优先 UnoCSS、SCSS 仅全局变量"的项目约定，不用行内 style 写业务样式
> - **精进**：理解 CSS 层叠上下文、重排(reflow)与重绘(repaint)的差异，写出性能友好的布局
>
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + UnoCSS + Ant Design Vue

---

## 理论学习

### 核心知识点

#### 1. Flexbox — 一维布局之王

Flexbox 解决的是"单方向上元素如何排列和对齐"。在 carlos-ui 中，你看到的 `flex`、`items-center`、`justify-between` 都是 Flexbox 的缩写。

```
容器属性              对应 UnoCSS 类
─────────────────────────────────────────
display: flex        →  flex
flex-direction       →  flex-row / flex-col
justify-content      →  justify-start / center / between / end
align-items          →  items-start / center / end
flex-wrap            →  flex-wrap / flex-nowrap
```

**carlos-ui 真实示例**（`src/views/home/modules/card-data.vue`）：

```vue
<div class="flex justify-between pt-12px">
  <SvgIcon :icon="item.icon" class="text-32px" />
  <CountTo :end-value="item.value" class="text-30px text-white dark:text-dark" />
</div>
```

拆解：
- `flex` → `display: flex`
- `justify-between` → `justify-content: space-between`（两端对齐）
- `pt-12px` → `padding-top: 12px`
- `text-32px` → `font-size: 32px`（UnoCSS 对字体大小的特殊定义）

#### 2. CSS Grid — 二维布局利器

Grid 同时控制行和列。carlos-ui 的 Dashboard 首页（`src/views/home/index.vue`）使用了 Ant Design Vue 的 `ARow`/`ACol` 组件，其底层就是 Grid 思想：

```vue
<ARow :gutter="[16, 16]">
  <ACol :span="24" :lg="14">
    <LineChart />
  </ACol>
  <ACol :span="24" :lg="10">
    <PieChart />
  </ACol>
</ARow>
```

- `:span="24"` — 在 xs（手机）尺寸下占满 24 栅格
- `:lg="14"` — 在 lg（≥992px）尺寸下占 14 栅格
- `:gutter="[16, 16]"` — 行列间距均为 16px

这和 Java 中响应式布局库（如 JavaFX 的 `GridPane`）思路一致：先定义格子，再填入组件。

#### 3. CSS 变量 — 比 SCSS 变量更"运行时"

传统 CSS 预处理器（SCSS/Sass/Less）的变量在编译时就确定了。而 CSS 自定义属性（`--var`）是**运行时变量**，JavaScript 可以直接修改：

```css
:root {
  --primary-color: 24, 144, 255;  /* 注意：不带 rgb() 包装 */
}
```

在 carlos-ui 的 `src/theme/vars.ts` 中：

```typescript
export const themeVars = {
  colors: {
    primary: 'rgb(var(--primary-color))',
    'primary-500': 'rgb(var(--primary-500-color))',
    container: 'rgb(var(--container-bg-color))',
    layout: 'rgb(var(--layout-bg-color))',
  },
  boxShadow: {
    header: 'var(--header-box-shadow)',
  }
};
```

**为什么这样设计？** CSS 变量可以在运行时通过 JS 修改变量值，整个页面主题立即切换，不需要重新编译。这是 SCSS 变量做不到的。

#### 4. 响应式设计 — 媒体查询的 UnoCSS 写法

传统 CSS 媒体查询：

```css
@media (min-width: 768px) {
  .item { width: 50%; }
}
```

UnoCSS 的写法（直接在类名前加断点前缀）：

```vue
<ACol :span="24" :md="12" :lg="6">
```

等价语义：
- 手机（默认）：24 栅格（100% 宽度）
- ≥768px（md）：12 栅格（50% 宽度）
- ≥992px（lg）：6 栅格（25% 宽度）

这就是 **Mobile First** 设计哲学：先保证小屏幕可用，再逐步增强大屏幕体验。

---

### Java 思维类比

| 前端概念 | Java 类比 | 说明 |
|---------|---------|------|
| Flexbox/Grid | JavaFX `GridPane` / Swing `GridBagLayout` | 都是声明式布局，按格子放组件 |
| CSS 变量 `--var` | Spring `@Value("${prop}")` + 运行时刷新 | 运行时配置，支持动态切换 |
| 媒体查询 `@media` | Java `if (screenWidth > 768)` 的条件渲染 | 条件分支决定样式 |
| `gutter` 间距 | Java 布局的 `gap` / `padding` 参数 | 控制组件间留白 |
| `transition.css` | Java Swing 的 `Timer` + 渐变动画 | 状态变化的过渡效果 |

---

### 超越类比 — 前端独有的设计哲学

> **"样式即数据" — CSS 变量让主题切换零成本**

在 Java 中，切换主题通常意味着：读取配置文件 → 重新渲染 UI → 可能还要重启应用。而在前端，只需修改 `:root` 上的 CSS 变量值，整个应用的配色即时刷新，无需任何组件重渲染。

> **"原子类不是随意堆砌，而是设计系统的工程化表达"**

你可能会问：为什么不写 `.card { padding: 16px; border-radius: 8px; }`，而要用 `rd-8px px-16px pb-4px pt-8px`？

因为：
1. **原子类消除了命名负担** — 不需要给每个 div 起类名
2. **原子类杜绝了样式膨胀** — 不会写出 300 行没人敢删的 CSS
3. **原子类让修改可预测** — 改 `pt-12px` 只影响 padding-top，没有副作用
4. **Tree Shaking 友好** — 构建时只打包用到的类

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

1. `src/views/home/modules/card-data.vue` — UnoCSS 原子类密集使用示例
2. `src/views/home/index.vue` — 响应式 Grid 布局（ARow/ACol）
3. `uno.config.ts` — UnoCSS 配置与 shortcuts 定义
4. `src/styles/css/transition.css` — CSS 过渡动画

### 阅读指引

**card-data.vue 阅读顺序**：
1. 先看 `template` 中的 `class="..."` — 体会 UnoCSS 原子类的密集使用
2. 注意 `rd-8px`（`border-radius: 8px`）、`px-16px`（水平 padding 16px）的组合
3. 观察 `dark:text-dark` — 这是 UnoCSS 的 dark 模式变体，根据 `html.dark` 类自动切换
4. 思考：为什么这块样式不用 `style scoped`？因为全部用原子类解决了

**uno.config.ts 阅读重点**：

```typescript
shortcuts: {
  'card-wrapper': 'rd-8px shadow-sm'
}
```

这个 `card-wrapper` shortcut 在项目中哪里被用到？搜索一下——它把"圆角 + 阴影"封装成一个语义化名称。这比纯原子类更可读。

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件 kebab-case、组件 PascalCase | ✅ `card-data.vue` / `CardData` |
| 类型完整性 | 零 any | ✅ `cardData` 显式标注 `computed<CardData[]>` |
| 目录规范 | 页面子模块放 `modules/` | ✅ `home/modules/card-data.vue` |
| 导入顺序 | type → 第三方 → 内部 → 相对 | ✅ `import type` 无，但第三方 `@vueuse/core` 在内部 `@/locales` 之前 |
| 样式规范 | 优先 UnoCSS，不用行内 style 写业务样式 | ⚠️ `getGradientColor` 返回动态 `backgroundImage`，通过 `:style` 绑定。这里用行内 style 是合理的，因为渐变颜色是数据驱动的 |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ `item.title` 来自 `$t('page.home.xxx')` |
| 可测试性 | 纯函数可单测 | ✅ `getGradientColor` 是纯函数，输入颜色输出 CSS 字符串 |

**评审结论**：`card-data.vue` 整体达标。唯一注意点是 `:style` 的使用——当样式值来自运行时数据（如后端返回的颜色配置），用 `:style` 动态绑定是正确做法；但固定样式（如 padding、圆角）必须用 UnoCSS 原子类。

---

## 功能实践 — 分三步

### 第一步：需求分析与拆解

**任务**：参照 `card-data.vue` 的设计，实现一个"系统监控卡片"面板，展示 4 个指标：

| 指标 | 数值 | 颜色 |
|------|------|------|
| 在线用户数 | 1280 | 绿色渐变 |
| API 请求量/分 | 3420 | 蓝色渐变 |
| 错误率 | 0.3% | 红色渐变（<1% 绿色，1-5% 黄色，>5% 红色） |
| 平均响应时间 | 45ms | 紫色渐变 |

**拆解小任务**：
1. 定义指标数据结构（TS interface）
2. 根据错误率动态计算颜色
3. 用 UnoCSS 原子类实现卡片容器（圆角、阴影、padding）
4. 用 ARow/ACol 实现响应式 1×4 → 2×2 → 4×1 布局
5. 为卡片添加 hover 放大过渡动画（使用 `src/styles/css/transition.css` 中的 fade-scale 思路）

---

### 第二步：小任务开发

#### 小任务 1：定义数据结构与类型

```typescript
// src/views/dashboard/modules/monitor-cards.vue
<script setup lang="ts">
import { computed } from 'vue';
import { $t } from '@/locales';

interface MonitorMetric {
  key: string;
  title: string;
  value: number;
  unit: string;
  // 错误率指标需要动态颜色，其他固定
  type: 'normal' | 'errorRate';
}

const metrics = computed<MonitorMetric[]>(() => [
  { key: 'onlineUsers', title: $t('page.dashboard.onlineUsers'), value: 1280, unit: '', type: 'normal' },
  { key: 'apiQps', title: $t('page.dashboard.apiQps'), value: 3420, unit: '/min', type: 'normal' },
  { key: 'errorRate', title: $t('page.dashboard.errorRate'), value: 0.3, unit: '%', type: 'errorRate' },
  { key: 'avgLatency', title: $t('page.dashboard.avgLatency'), value: 45, unit: 'ms', type: 'normal' }
]);

function getErrorColor(rate: number): { start: string; end: string } {
  if (rate < 1) return { start: '#22c55e', end: '#16a34a' };   // 绿色
  if (rate < 5) return { start: '#f59e0b', end: '#d97706' };   // 黄色
  return { start: '#ef4444', end: '#dc2626' };               // 红色
}

function getGradientColor(metric: MonitorMetric): string {
  const color = metric.type === 'errorRate'
    ? getErrorColor(metric.value)
    : { start: '#6366f1', end: '#4f46e5' }; // 默认紫色
  return `linear-gradient(to bottom right, ${color.start}, ${color.end})`;
}
</script>
```

**技术要点**：
- `interface` 定义数据形状，类似 Java 的 POJO
- `getErrorColor` 是纯函数，输入相同输出一定相同，易于单元测试
- 用 `$t()` 包裹用户可见字符串，符合国际化规范

---

#### 小任务 2：UnoCSS 原子类实现卡片容器

```vue
<template>
  <ARow :gutter="[16, 16]">
    <ACol
      v-for="item in metrics"
      :key="item.key"
      :span="24"
      :md="12"
      :lg="6"
    >
      <div
        class="rd-8px px-16px py-12px text-white transition-all duration-300 hover:scale-105"
        :style="{ backgroundImage: getGradientColor(item) }"
      >
        <h3 class="text-14px opacity-80">{{ item.title }}</h3>
        <div class="flex items-end justify-between pt-8px">
          <span class="text-28px font-bold">{{ item.value }}</span>
          <span class="text-12px opacity-70">{{ item.unit }}</span>
        </div>
      </div>
    </ACol>
  </ARow>
</template>
```

**原子类拆解**：

| 类名 | CSS 含义 | 为什么这样写 |
|------|---------|------------|
| `rd-8px` | `border-radius: 8px` | 统一圆角，与 `card-wrapper` shortcut 一致 |
| `px-16px py-12px` | 水平 16px / 垂直 12px padding | 四边 padding 不同时，分开写比 `p-16px` 更精确 |
| `text-white` | 白色文字 | 深色渐变背景上的高对比度文字 |
| `transition-all duration-300` | 所有属性过渡，300ms | 为 hover 效果铺垫 |
| `hover:scale-105` | hover 时缩放到 1.05 | UnoCSS 的 hover 变体，无需手写 `:hover` 规则 |
| `text-14px opacity-80` | 小字号 + 80% 不透明度 | 标题次要化处理 |
| `flex items-end justify-between` | Flex 底部对齐 + 两端分布 | 数值左对齐，单位右对齐 |

**注意**：`hover:scale-105` 需要确保 `transform` 不会被其他样式覆盖，否则过渡可能失效。

---

#### 小任务 3：响应式布局断点验证

| 屏幕宽度 | ACol 实际宽度 | 一行显示几个卡片 |
|---------|-------------|----------------|
| <768px（默认） | span=24 → 100% | 1 个 |
| ≥768px（md） | md=12 → 50% | 2 个 |
| ≥992px（lg） | lg=6 → 25% | 4 个 |

在浏览器 DevTools 中切换设备尺寸，验证布局变化。这就是 **Mobile First**。

---

### 第三步：整合与验收

**完整文件结构**：

```
src/views/dashboard/
├── index.vue          # 页面入口
└── modules/
    └── monitor-cards.vue   # 本练习组件
```

**index.vue 入口**：

```vue
<script setup lang="ts">
defineOptions({ name: 'Dashboard' });

import MonitorCards from './modules/monitor-cards.vue';
</script>

<template>
  <div class="dashboard-container">
    <MonitorCards />
  </div>
</template>
```

**自检步骤**：
1. `pnpm dev` 打开页面，观察卡片布局
2. F12 → 切换手机/平板/桌面尺寸，确认 1→2→4 列变化
3. 修改 `errorRate.value` 为 3（黄色）、6（红色），观察颜色变化
4. 鼠标 hover 卡片，观察缩放过渡是否平滑

---

### 验收标准

- [ ] **能用**：4 个卡片正确显示，响应式布局在手机/平板/桌面下均正常
- [ ] **规范**：`pnpm typecheck` 通过（`MonitorMetric` 类型完备，无 `any`）
- [ ] **规范**：`pnpm lint` 通过（命名、导入顺序、组件名多词）
- [ ] **精进**：所有样式用 UnoCSS 原子类（除数据驱动的 `backgroundImage` 外，无行内 style）
- [ ] **精进**：`getErrorColor` 和 `getGradientColor` 是纯函数，可独立测试
- [ ] **精进**：用户可见文字通过 `$t()` 国际化

---

## 今日重点记忆卡

| 概念 | 一句话 | Java 类比 | 前端独有 |
|------|--------|---------|---------|
| **Flexbox** | 单方向上元素排列和对齐 | JavaFX `HBox`/`VBox` | CSS 的 `flex: 1` 自动填充剩余空间 |
| **CSS Grid** | 二维行列同时控制 | JavaFX `GridPane` | `grid-template-areas` 用命名区域布局 |
| **CSS 变量** | 运行时可通过 JS 修改的样式常量 | Spring `@Value` 但支持热更新 | 修改 `:root` 变量 = 全站主题即时切换 |
| **UnoCSS 原子类** | 一个类只干一件事 | 不可能精确类比，最接近的是 Builder 模式链式调用 | JIT 编译 + 智能提示 + 绝不膨胀 |
| **Mobile First** | 先写手机样式，再用断点增强 | 不是 Java 传统思维 | 从限制最多的设备开始设计 |
| **重排 vs 重绘** | 改变尺寸/位置 = 重排（代价高）；改颜色/透明度 = 重绘（代价低） | Swing 的 `repaint()` vs `revalidate()` | 前端有 `transform` 和 `opacity` 硬件加速 |

---

## 进阶思考题（选做）

1. 为什么 carlos-ui 不用 Tailwind CSS 而用 UnoCSS？提示：对比"预设配置"和"按需生成"的差异。
2. `transition-all` 有什么性能风险？在什么情况下应该改用 `transition-transform` 或 `transition-opacity`？
3. 如果后端返回的 `errorRate` 是字符串 `"0.3"` 而不是数字 `0.3`，你的 `getErrorColor` 函数会怎样？如何防御？

---

**明日预告**：第6天 — CSS 原子化与 UnoCSS 深入 — 不写 CSS 文件也能写样式（自定义 shortcuts、theme、dark 模式）
