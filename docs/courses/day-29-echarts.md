# 今日前端课程 — 第29天：ECharts 图表 — 数据可视化

> **学习目标**
> - **能读**：理解 ECharts 的声明式配置（option）、系列（series）、组件（component）三层概念
> - **能用**：使用 `useEcharts` hook 封装一个响应式图表组件，支持暗色模式切换
> - **规范**：图表数据类型完整、国际化 key 使用 `$t()`、暗色模式与主题系统联动
> - **精进**：理解 ECharts 按需加载机制（tree-shaking）、响应式重绘策略、dispose 内存管理
>
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + ECharts 5.x + Pinia + UnoCSS

---

## 理论学习

### 核心知识点

#### 1. ECharts 声明式配置哲学

ECharts 的核心设计是"数据驱动 + 配置即视图"。你不需要操作 DOM 绘图，只需要描述"我想要什么"：

```typescript
const option: ECOption = {
  xAxis: { type: 'category', data: ['Mon', 'Tue'] },
  yAxis: { type: 'value' },
  series: [{ type: 'line', data: [120, 200] }]
};
```

> 对比 Java：类似 Java Swing 的 `JTable` 使用 `TableModel` 描述数据，ECharts 使用 `option` 对象描述整个图表。但 ECharts 更进一层 —— 你只需要描述最终状态，ECharts 内部自动 diff 并最小化更新 DOM。

#### 2. 按需加载（Tree Shaking）

ECharts 5 采用**模块化 + 按需注册**设计，避免全量打包：

```typescript
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// 按需注册 — 只用到的才打包
echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);
```

> 对比 Java：类似于 Maven 的 `<dependency>` 粒度控制，但前端是**编译时 tree-shaking** —— 未引用的模块不会被打包到产物中。`echarts.use()` 是运行时注册，但 TypeScript 的 `import` 决定了编译时哪些模块会被包含。

#### 3. 响应式更新策略

ECharts 图表需要处理三种变化：

| 变化类型 | 处理方式 | 代码示例 |
|---------|---------|---------|
| 数据变化 | `setOption` 增量更新 | `chart.setOption({ series: [{ data: newData }] })` |
| 容器尺寸变化 | `chart.resize()` | 监听容器尺寸变化，调用 `resize()` |
| 主题变化 | `dispose()` + `init()` | 销毁旧实例，用新主题重新初始化 |

#### 4. 暗色模式适配

ECharts 内置 `light` / `dark` 两种主题，通过 `echarts.init(dom, theme)` 切换。但 carlos-ui 更进一步：

- 使用 `backgroundColor: 'transparent'` 让图表背景透明，继承容器主题
- loading 样式根据 `darkMode` 计算 `textColor` / `maskColor`
- 图表颜色（如 `color: '#8e9dff'`）为固定色，但容器背景由 UnoCSS 变量控制

### Java 思维类比

> ECharts 的 `option` 对象 ≈ Java 的 `JTable` + `TableModel` + `TableColumnModel` 的合体配置
>
> `echarts.use()` 注册组件 ≈ Java SPI 机制 `ServiceLoader.load()` 注册服务
>
> `chart.setOption()` ≈ Java Swing 的 `fireTableDataChanged()` 通知视图刷新
>
> `dispose()` + `init()` 切换主题 ≈ Java 中重新创建 `JFrame` 并设置 `LookAndFeel`

### 超越类比 — 前端独有的设计哲学

> **为什么前端图表库用"声明式配置"而不是"命令式 API"？**
>
> 在 Java Swing 中，你要写 `JTable table = new JTable(); table.setModel(...)` 命令式地组装组件。而 ECharts 的 `option` 是**纯数据** —— 它可以：
> - 序列化到 JSON 存储到后端数据库
> - 前后端共享同一份配置契约
> - 被 Vue 的响应式系统直接驱动
> - 支持主题化时只替换主题层，不改动业务配置
>
> 这是**数据驱动 UI** 的核心体现：图表即数据，配置即视图。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

1. **`src/hooks/common/echarts.ts`** — `useEcharts` 封装 Hook
2. **`src/views/home/modules/line-chart.vue`** — 折线图组件（使用示例）
3. **`src/views/home/modules/pie-chart.vue`** — 饼图组件（使用示例）
4. **`src/views/home/index.vue`** — 首页布局（组件编排）

### 阅读指引

#### 第一步：看 `useEcharts` 整体架构（`src/hooks/common/echarts.ts`）

```typescript
// 导入顺序：1. type → 2. 第三方库 → 3. 内部模块
import type { ... } from 'echarts/charts';
import { ... } from 'echarts/charts';
import type { ... } from 'echarts/components';
import { ... } from 'echarts/components';
import { useElementSize } from '@vueuse/core';
import { useThemeStore } from '@/store/modules/theme';
```

**关键设计模式**：

1. **ECOption 类型组合**：用 `echarts.ComposeOption<...>` 把用到的 series 和 component 类型组合成一个统一的 option 类型。这是 TypeScript 条件类型和联合类型的高级应用。

2. **effectScope 管理副作用**：`const scope = effectScope()` 创建副作用作用域，在组件卸载时 `scope.stop()` 统一清理所有 watch。这相当于 Java 的 `try-finally` 资源管理，但粒度更细。

3. **useElementSize 响应式监听**：从 `@vueuse/core` 获取容器尺寸，自动触发 resize。这比手动 `window.addEventListener('resize')` 更精确 —— 它监听的是容器本身，不是窗口。

4. **三个生命周期 hooks**：`onRender` / `onUpdated` / `onDestroy` 通过参数注入，让使用者可以定制 loading 行为。

#### 第二步：看 `line-chart.vue` 如何使用

```typescript
const {domRef, updateOptions} = useEcharts(() => ({
  tooltip: { trigger: 'axis', ... },
  legend: { data: [$t('page.home.downloadCount'), ...] },
  series: [...]
}));
```

**关键观察点**：
- `useEcharts` 接收一个 **optionsFactory**（工厂函数），不是直接传 option 对象。为什么？
  - 工厂函数在每次调用时生成新对象，用于 `updateLocale` 时重新获取原始配置
  - 避免闭包引用过期的 `$t` 翻译结果
- `updateOptions` 接收回调函数 `(opts, factory) => opts`，不是直接赋值。这是函数式更新模式，保证不可变性。

#### 第三步：看 `home/index.vue` 的组件编排

```vue
<template>
  <ASpace direction="vertical" :size="16">
    <HeaderBanner/>
    <CardData/>
    <ARow :gutter="[16, 16]">
      <ACol :span="24" :lg="14"><LineChart/></ACol>
      <ACol :span="24" :lg="10"><PieChart/></ACol>
    </ARow>
    ...
  </ASpace>
</template>
```

**布局设计**：使用 Ant Design Vue 的 `ARow` / `ACol` 栅格系统实现响应式布局。大屏 14:10 比例，移动端自动堆叠。

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件kebab-case、函数camelCase、组件PascalCase | ✅ `line-chart.vue` / `useEcharts` / `LineChart` |
| 类型完整性 | 零any，所有参数/返回值有类型 | ✅ `ECOption` 类型组合完整，`useEcharts<T extends ECOption>` 泛型约束 |
| 目录规范 | 文件放在正确的目录 | ✅ `hooks/common/` 放通用 hook，`views/home/modules/` 放页面子模块 |
| 导入顺序 | type导入 → 第三方库 → 内部模块 | ✅ `echarts.ts` 严格遵循：type → echarts → vueuse → 内部store |
| 错误处理 | 所有异步有try/catch或统一拦截 | ⚠️ `mockData` 的 `setTimeout` 没有错误处理，但这是模拟数据可接受；真实 API 应当处理 |
| 可测试性 | 纯函数可单测，副作用可mock | ✅ `optionsFactory` 是纯函数；`useElementSize` / `useThemeStore` 可 mock |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ `legend.data` 和 `series.name` 都使用 `$t()` |
| 暗色模式 | 图表主题与系统主题联动 | ✅ `darkMode` computed 驱动 `changeTheme()` |

### 发现的问题与改进建议

1. **line-chart.vue 中 `series` 的 `data` 类型声明不一致**：
   - `series[0].data: [] as string[]` 声明了类型，但 `series[1].data` 没有类型声明
   - **建议**：统一添加类型：`data: [] as number[]`

2. **mockData 的硬编码**：
   - 数据是写死的 mock 数据，真实项目中应当替换为 API 调用
   - 但这是首页展示组件，mock 数据是合理的设计

3. **销毁时序**：
   - `destroy()` 方法中 `await onDestroy?.(chart)` 在 `chart.dispose()` 之前，如果 `onDestroy` 抛出异常，chart 不会被销毁
   - **建议**：使用 `try-finally` 保证 dispose 一定执行

---

## 功能实践 — 分三步

### 第一步：分析目标功能

**目标**：在首页新增一个"用户增长趋势"柱状图，展示最近7天的注册用户和活跃用户数据。

功能拆解：
1. 创建 `bar-chart.vue` 组件文件
2. 使用 `useEcharts` 封装 ECharts 配置
3. 配置柱状图 option（xAxis: 日期, yAxis: 数量, series: 两组柱状图）
4. 添加 mock 数据（模拟7天数据）
5. 支持国际化（柱状图名称用 `$t()`）
6. 支持暗色模式切换
7. 将组件插入到 `home/index.vue` 的合适位置

### 第二步：小任务开发

#### 任务1：创建柱状图组件

```vue
<!-- src/views/home/modules/bar-chart.vue -->
<script setup lang="ts">
import {watch} from 'vue';
import {$t} from '@/locales';
import {useAppStore} from '@/store/modules/app';
import {useEcharts} from '@/hooks/common/echarts';

defineOptions({
  name: 'BarChart'
});

const appStore = useAppStore();

const {domRef, updateOptions} = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' }
  },
  legend: {
    data: [$t('page.home.registerCount'), $t('page.home.activeCount')]
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    data: [] as string[]
  },
  yAxis: {
    type: 'value'
  },
  series: [
    {
      name: $t('page.home.registerCount'),
      type: 'bar',
      color: '#8e9dff',
      data: [] as number[]
    },
    {
      name: $t('page.home.activeCount'),
      type: 'bar',
      color: '#26deca',
      data: [] as number[]
    }
  ]
}));

async function mockData() {
  await new Promise(resolve => setTimeout(resolve, 1000));

  updateOptions(opts => {
    opts.xAxis.data = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    opts.series[0].data = [120, 132, 101, 134, 90, 230, 210];
    opts.series[1].data = [220, 182, 191, 234, 290, 330, 310];
    return opts;
  });
}

function updateLocale() {
  updateOptions((opts, factory) => {
    const originOpts = factory();
    opts.legend.data = originOpts.legend.data;
    opts.series[0].name = originOpts.series[0].name;
    opts.series[1].name = originOpts.series[1].name;
    return opts;
  });
}

watch(
  () => appStore.locale,
  () => updateLocale()
);

// 初始化
mockData();
</script>

<template>
  <ACard :bordered="false" class="card-wrapper">
    <div ref="domRef" class="h-320px overflow-hidden"></div>
  </ACard>
</template>

<style scoped></style>
```

**技术要点**：
- `type: 'bar'` 声明为柱状图
- `axisPointer: { type: 'shadow' }` 鼠标悬停时显示阴影指示器
- `containLabel: true` 确保标签不被截断

#### 任务2：在 home/index.vue 中引入

```vue
<script setup lang="ts">
import HeaderBanner from './modules/header-banner.vue';
import CardData from './modules/card-data.vue';
import LineChart from './modules/line-chart.vue';
import PieChart from './modules/pie-chart.vue';
import BarChart from './modules/bar-chart.vue'; // 新增
import ProjectNews from './modules/project-news.vue';
import CreativityBanner from './modules/creativity-banner.vue';
</script>

<template>
  <ASpace direction="vertical" :size="16">
    <HeaderBanner/>
    <CardData/>
    <ARow :gutter="[16, 16]">
      <ACol :span="24" :lg="14"><LineChart/></ACol>
      <ACol :span="24" :lg="10"><PieChart/></ACol>
    </ARow>
    <!-- 新增柱状图行 -->
    <ARow :gutter="[16, 16]">
      <ACol :span="24"><BarChart/></ACol>
    </ARow>
    <ARow :gutter="[16, 16]">
      <ACol :span="24" :lg="14"><ProjectNews/></ACol>
      <ACol :span="24" :lg="10"><CreativityBanner/></ACol>
    </ARow>
  </ASpace>
</template>
```

#### 任务3：添加国际化 key

在 `src/locales/langs/zh-cn.ts` 的 `page.home` 下添加：

```typescript
home: {
  // ... 现有字段
  activeCount: '活跃用户数', // 新增
}
```

在 `src/locales/langs/en-us.ts` 的对应位置添加：

```typescript
home: {
  // ... 现有字段
  activeCount: 'Active Users', // 新增
}
```

### 第三步：整合测试与调试

**调试步骤**：

1. 运行 `pnpm dev`，查看首页是否出现柱状图
2. 检查 Console 是否有 ECharts 报错（如未注册 BarChart 组件）
3. 切换暗色模式（如果项目支持），验证图表是否正确切换主题
4. 检查响应式：缩小浏览器窗口，验证图表是否自适应 resize

**常见错误排查**：

| 错误现象 | 原因 | 解决 |
|---------|------|------|
| 图表不显示，空白区域 | 未注册 `BarChart` 组件 | 确认 `useEcharts` 的 `echarts.use([...])` 中已包含 `BarChart` |
| 图表显示但数据不更新 | `updateOptions` 回调未返回 opts | 确保 `return opts` |
| 切换语言后图表文字不更新 | 未实现 `updateLocale` | 参照 `line-chart.vue` 实现 `updateLocale` |
| 控制台 warning：组件尺寸为 0 | 容器未设置高度 | 确保容器有 `h-320px` 或明确的 CSS 高度 |

### 验收标准

- [ ] **能用**：柱状图正确显示，有数据、有图例、有 tooltip
- [ ] **规范**：`pnpm typecheck` 通过（类型无报错），`pnpm lint` 通过（无 ESLint 报错）
- [ ] **精进**：
  - 零 `any`（所有数据有类型）
  - 国际化 key 已添加（中英双语）
  - 暗色模式切换正常
  - 组件销毁时无内存泄漏（`onScopeDispose` 正确清理）

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| ECharts Option | 声明式配置对象，描述图表最终状态 | JTable 的 TableModel + ColumnModel 合体 | 纯数据驱动，可序列化、可主题化、可响应式 |
| echarts.use() | 按需注册图表组件和渲染器 | SPI ServiceLoader 注册服务 | 编译时 tree-shaking，未使用模块不打包 |
| setOption | 更新图表配置，内部自动 diff 最小化更新 | fireTableDataChanged() 通知刷新 | 支持增量更新，不重建整个图表实例 |
| dispose | 销毁图表实例，释放 Canvas 内存 | 关闭 JFrame 释放资源 | Canvas 是 GPU 资源，必须显式释放 |
| effectScope | Vue 3 副作用作用域，批量管理 watch | try-with-resources 自动关闭资源 | 可嵌套、可暂停、可批量停止，粒度更细 |
| 暗色模式 | 通过 `echarts.init(dom, 'dark')` 切换 | Swing 切换 LookAndFeel | 与 Pinia store 联动，响应式自动切换 |

---

## 扩展思考（进阶）

### 为什么 `useEcharts` 用 `optionsFactory` 而不是直接传 `options`？

如果直接传对象：`useEcharts({ legend: { data: [$t('key')] } })`，`

> $t('key')` 在组件初始化时执行一次，如果之后切换语言，`$t` 返回的字符串已经固化在 option 对象中，无法更新。
>
> 使用工厂函数 `() => ({ legend: { data: [$t('key')] } })`，每次调用 `factory()` 都会重新执行 `$t`，获取最新的翻译结果。
>
> 这就是**延迟求值（Lazy Evaluation）**在前端的应用。

### 如何优化大量图表的内存占用？

如果页面同时渲染 10+ 个图表：
1. 使用 `shallowRef` 存储 option 对象（避免深层响应式追踪）
2. 使用 `IntersectionObserver` 懒加载屏幕外的图表
3. 离开页面时确保所有图表 `dispose()`（已在 `useEcharts` 中通过 `onScopeDispose` 自动处理）

---

**明日预告**：第30天 — UnoCSS 实战：从配置到自定义规则，在 `uno.config.ts` 中新增项目专属的颜色 shortcut，支持 dark 模式适配。

---

> 📚 阅读索引：
> - `src/hooks/common/echarts.ts` — `useEcharts` 封装（重点：effectScope + 生命周期 hooks）
> - `src/views/home/modules/line-chart.vue` — 折线图使用示例（重点：updateLocale + updateOptions）
> - `src/views/home/modules/pie-chart.vue` — 饼图使用示例（重点：series.data 类型声明）
> - `src/views/home/index.vue` — 组件布局编排（重点：ARow/ACol 响应式栅格）
> - ECharts 官方文档：[https://echarts.apache.org/](https://echarts.apache.org/)
