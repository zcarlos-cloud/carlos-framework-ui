# 🎓 今日前端课程 — 第7天：Vue 3 概览 — 从 Options API 到 Composition API

> **学习目标**
> - **能读**：看懂 `carlos-ui` 中任意 `.vue` 文件的结构和逻辑流向
> - **能用**：用 `<script setup lang="ts">` + Composition API 写一个完整组件
> - **规范**：遵循 SFC 导入顺序、使用 `defineOptions` 声明组件名、零 `any`
> - **精进**：理解 Vue 3 编译器优化（静态提升、PatchFlag），明白为什么 `ref` 比 `reactive` 更适合业务场景
>
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + Pinia

---

## 🎉 第一阶段完成里程碑

恭喜你，朱军！今天是你第一阶段（第1-7天）的**最后一天**。回顾这7天，你已经完成了：

| 天数 | 主题 | 核心收获 |
|------|------|---------|
| Day 1-2 | ES6+ / TypeScript | 从 `var` 到 `const`，从 `any` 到严格类型 |
| Day 3-4 | pnpm / Vite | 理解了前端"Maven"和"Spring Boot" |
| Day 5-6 | CSS / UnoCSS | 从手写 CSS 到原子化类名 |
| **Day 7** | **Vue 3 概览** | **从 Options API 到 Composition API 的认知跃迁** |

**明天起进入第二阶段（第8-21天）：Vue 3 核心深入**。你将不再只是"看懂"，而是"能拆、能改、能写"。

---

## 理论学习

### 核心知识点

#### 1. Vue 3 两大 API 风格：Options API vs Composition API

**Options API（Vue 2 风格）** — 像 Java 的类定义，把逻辑分散到 `data`、`methods`、`computed`、`watch` 等选项中：

```vue
<script lang="ts">
export default {
  data() {
    return { count: 0 };
  },
  computed: {
    double() { return this.count * 2; }
  },
  methods: {
    increment() { this.count++; }
  },
  watch: {
    count(newVal) { console.log(newVal); }
  }
};
</script>
```

> 问题：当组件复杂时，同一个功能的逻辑被拆散在四个选项里，"关注点分离"变成了"逻辑割裂"。

**Composition API（Vue 3 推荐）** — 像写 Java 的静态工具方法，用函数组合逻辑：

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue';

// 所有计数器逻辑在一个地方
const count = ref(0);
const double = computed(() => count.value * 2);
function increment() { count.value++; }
watch(count, (newVal) => { console.log(newVal); });
</script>
```

> 优势：逻辑可按功能拆分（`useAuth`、`useTable`、`useTheme`），天然复用。

#### 2. `<script setup>` 语法糖 — 为什么这样写更好

`<script setup>` 是 Composition API 的**语法糖**，编译后等价于在 `setup()` 函数中执行。但它消除了样板代码：

| 特性 | `<script>` 传统写法 | `<script setup>` |
|------|-------------------|------------------|
| 变量暴露到模板 | 需要 `return` | 自动暴露 |
| 组件名声明 | `export default { name: 'Xxx' }` | `defineOptions({ name: 'Xxx' })` |
| Props 类型 | `props: ['foo']` | `defineProps<Props>()` |
| Emits 类型 | `emits: ['change']` | `defineEmits<{ change: [val: string] }>()` |

#### 3. `ref` vs `reactive` — 选型决策树

```typescript
import { ref, reactive } from 'vue';

// 基本类型 → 必须用 ref
const count = ref(0);           // .value 读写

// 对象/数组 → ref 或 reactive 都可以，但项目统一用 ref
const user = ref({ name: 'zhu', age: 35 });  // user.value.name
const user2 = reactive({ name: 'zhu', age: 35 }); // user2.name（无需 .value）

// 为什么 carlos-ui 更倾向 ref？
// 1. 统一访问模式（永远 .value），减少心智负担
// 2. 可以整体替换对象：user.value = { name: 'jun', age: 36 }
// 3. 配合 shallowRef 处理大数据，避免深层响应式开销
```

#### 4. Vue 3 响应式原理 — Proxy 与依赖追踪

Vue 3 用 `Proxy` 替代 Vue 2 的 `Object.defineProperty`：

```typescript
// Vue 3 的 reactive 底层（简化版）
function reactive(target: object) {
  return new Proxy(target, {
    get(obj, key) {
      // 收集依赖：哪个 effect 正在读取这个属性？
      track(obj, key);
      return obj[key];
    },
    set(obj, key, value) {
      obj[key] = value;
      // 触发更新：通知所有依赖这个属性的 effect 重新执行
      trigger(obj, key);
      return true;
    }
  });
}
```

> 对比 Vue 2：`Object.defineProperty` 只能劫持已有属性，新增属性需要 `$set`。`Proxy` 可以监听任意属性的增删改。

#### 5. Vue 3 编译器优化 — 为什么性能更好

Vue 3 编译器在构建时做了三件事：

1. **静态提升**：将不变的节点提取到渲染函数外，避免每次重新创建
2. **PatchFlag**：给动态节点打标记（如 `TEXT_CHILDREN`、`CLASS`），diff 时只比较标记的部分
3. **Block Tree**：把动态节点收集到数组中，diff 时跳过静态树

> 类比：Java JIT 编译器的逃逸分析和内联优化。Vue 3 编译器在"编译期"做优化，减少"运行时"工作量。

### Java 思维类比

> | Vue 3 概念 | Java 类比 | 差异点 |
> |----------|---------|--------|
> | Vue 组件 | `JPanel` + MVC | 三合一（结构+逻辑+样式） |
> | `<script setup>` | 构造函数 + `@PostConstruct` | 自动执行，无需显式调用 |
> | `ref()` | `AtomicReference<T>` | `.value` 包装，响应式自动触发 |
> | `reactive()` | `ObservableMap` / `BeanProperty` | Proxy 拦截所有属性访问 |
> | `computed()` | 带缓存的 `getter` | 依赖变化时自动重新计算 |
> | `watch()` | `PropertyChangeListener` | 可监听特定属性或深度对象 |
> | `onMounted()` | `@PostConstruct` | 生命周期钩子 |
> | Pinia Store | `@Service` 单例 | 组合式函数返回，更灵活 |
> | `defineProps` | 构造参数 + `@NotNull` | 编译时类型推导 |
> | 虚拟 DOM diff | DOM 树的增量更新算法 | 最小化真实 DOM 操作 |

### 超越类比 — 前端独有的设计哲学

> **1. 响应式不是"观察者模式"，而是"依赖追踪的自动重新执行"**
>
> Java 的 `PropertyChangeSupport` 需要你手动 `firePropertyChange()`。Vue 的 `ref`/`reactive` 通过 Proxy 拦截访问，**自动**收集依赖和触发更新。你不需要写"通知代码"，只需要写"读取代码"。
>
> **2. 组合优于继承 — Composition API 的"函数式组装"**
>
> Java 世界里，复用逻辑主要靠继承（`extends BaseService`）或依赖注入。Vue 3 的复用是**函数组合**：`useAuth()` + `useTable()` + `useTheme()` 像搭积木一样拼装。没有类层次结构的束缚。
>
> **3. 声明式渲染 — 你描述"什么"，而不是"怎么做"**
>
> Java Swing 里你要写 `panel.add(button)` 命令式代码。Vue 模板里你写 `<button @click="handle">`，Vue 负责翻译成 DOM 操作。这是"声明式"vs"命令式"的根本差异。
>
> **4. 单文件组件（SFC）—— 高内聚的边界**
>
> Java 里 HTML（JSP/Thymeleaf）、Java 逻辑、CSS 通常是三个文件。Vue SFC 把三者放一起，因为前端组件的"变化频率"是一致的——修改按钮样式时，往往也要修改它的点击逻辑和显示条件。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

1. **`src/App.vue`** — 根组件，展示完整的 `<script setup>` 结构
2. **`src/views/home/index.vue`** — 页面级组件，展示模块化组合
3. **`src/store/modules/app/index.ts`** — Pinia Composition API 风格的 Store
4. **`src/views/home/modules/line-chart.vue`** — 带 `watch` 和异步初始化的业务组件

---

### 阅读指引

#### 文件 1：`src/App.vue` — 标准 SFC 结构

```vue
<script setup lang="ts">
import {computed} from 'vue';                          // 1. Vue 核心 API
import type {WatermarkProps} from 'ant-design-vue';      // type 导入在最前
import {ConfigProvider} from 'ant-design-vue';            // 第三方库
import {useAppStore} from './store/modules/app';        // 内部模块：store
import {useThemeStore} from './store/modules/theme';     // 内部模块：store
import {antdLocales} from './locales/antd';              // 内部模块：utils/locales

defineOptions({
  name: 'App'                                            // 显式声明组件名
});

const appStore = useAppStore();                          // 获取 Store 实例
const themeStore = useThemeStore();

const antdLocale = computed(() => {                      // computed：派生状态
  return antdLocales[appStore.locale];
});

const watermarkProps = computed(() => {                  // computed：配置对象派生
  const props: WatermarkProps = {
    content: themeStore.watermark.text,
    // ... 更多属性
  };
  return props;
});
</script>

<template>
  <ConfigProvider :theme="themeStore.antdTheme" :locale="antdLocale">
    <AppProvider>
      <RouterView class="bg-layout"/>                    <!-- 路由出口 -->
      <AWatermark                                        <!-- 条件渲染 + 属性绑定 -->
        v-if="themeStore.watermark.visible"
        v-bind="watermarkProps"
        class="pointer-events-none absolute-lt! size-full"
      />
    </AppProvider>
  </ConfigProvider>
</template>

<style scoped></style>
```

**阅读要点**：
1. 导入顺序：type → Vue/库 → 内部模块（store → hooks → utils → locales）
2. `defineOptions` 显式声明组件名 —— 规范要求
3. `computed` 用于派生配置对象（`watermarkProps`），而非直接写在模板里 —— 保持模板简洁
4. `v-if` 条件渲染水印，`v-bind` 批量绑定 props
5. UnoCSS 原子类：`pointer-events-none absolute-lt! size-full`

#### 文件 2：`src/views/home/index.vue` — 页面组件的"乐高式"组合

```vue
<script setup lang="ts">
import HeaderBanner from './modules/header-banner.vue';    // 1. 同目录子模块
import CardData from './modules/card-data.vue';
import LineChart from './modules/line-chart.vue';
// ... 更多子模块
</script>

<template>
  <ASpace direction="vertical" :size="16">
    <HeaderBanner/>                                        <!-- PascalCase 引用 -->
    <CardData/>
    <ARow :gutter="[16, 16]">
      <ACol :span="24" :lg="14">
        <LineChart/>                                       <!-- 响应式栅格：lg 屏占 14/24 -->
      </ACol>
      <ACol :span="24" :lg="10">
        <PieChart/>
      </ACol>
    </ARow>
    <!-- 更多布局... -->
  </ASpace>
</template>
```

**阅读要点**：
1. 页面组件几乎**没有业务逻辑**——只负责组装子模块（Layout Container 模式）
2. 子模块放在 `./modules/` 目录下，遵循规范
3. 使用 Ant Design Vue 的栅格系统（`ARow` + `ACol`）实现响应式布局
4. `:span="24" :lg="14"` 表示小屏全宽，大屏占 58%

#### 文件 3：`src/store/modules/app/index.ts` — 组合式 Pinia Store

```typescript
import {effectScope, nextTick, onScopeDispose, ref, watch} from 'vue';
import {defineStore} from 'pinia';
// ... 更多导入

import {SetupStoreId} from '@/enum';                      // Store ID 枚举

export const useAppStore = defineStore(SetupStoreId.App, () => {   // 命名：useXxxStore
  // --- State ---
  const scope = effectScope();                             // 副作用作用域管理
  const locale = ref<App.I18n.LangType>(localStg.get('lang') || 'zh-CN');

  // --- Getters（computed）---
  const isMobile = breakpoints.smaller('sm');             // VueUse 的响应式断点

  // --- Actions（普通函数）---
  async function changeLocale(lang: App.I18n.LangType) {
    locale.value = lang;
    setLocale(lang);
    localStg.set('lang', lang);
    await loadBackendMessages(lang);
  }

  async function reloadPage(duration = 300) {
    setReloadFlag(false);
    await new Promise(resolve => setTimeout(resolve, duration));
    setReloadFlag(true);
  }

  // --- 副作用管理 ---
  scope.run(() => {
    watch(isMobile, newValue => {                          // watch：响应式监听
      if (newValue) {
        // 移动端：备份主题设置，切换到 vertical 布局，收起侧边栏
        localStg.set('backupThemeSettingBeforeIsMobile', {
          layout: themeStore.layout.mode,
          siderCollapse: siderCollapse.value
        });
        themeStore.setThemeLayout('vertical');
        setSiderCollapse(true);
      } else {
        // 恢复桌面端设置
        const backup = localStg.get('backupThemeSettingBeforeIsMobile');
        if (backup) {
          nextTick(() => {                                  // DOM 更新后再恢复
            themeStore.setThemeLayout(backup.layout);
            setSiderCollapse(backup.siderCollapse);
            localStg.remove('backupThemeSettingBeforeIsMobile');
          });
        }
      }
    }, { immediate: true });                                // 立即执行一次

    watch(locale, () => {
      updateDocumentTitleByLocale();
      routeStore.updateGlobalMenusByLocale();
      tabStore.updateTabsByLocale();
      setDayjsLocale(locale.value);
    });
  });

  onScopeDispose(() => {                                    // 清理副作用
    scope.stop();
  });

  init();                                                   // 初始化

  return {                                                  // 暴露给外部使用的状态和方法
    isMobile, locale, localeOptions, changeLocale,
    reloadPage, reloadFlag, // ... 更多
  };
});
```

**阅读要点**：
1. `effectScope()` + `scope.run()` + `onScopeDispose()` —— 专业级的副作用生命周期管理
2. `watch` 的 `{ immediate: true }` —— 初始化时立即执行，避免状态不一致
3. `nextTick()` —— 等 DOM 更新后再操作，类似 Java 的 `SwingUtilities.invokeLater()`
4. Store 命名：`useAppStore`，ID 来自枚举 `SetupStoreId.App`
5. 所有状态和方法通过 `return` 显式暴露——清晰、可控、可测试

#### 文件 4：`src/views/home/modules/line-chart.vue` — watch + 异步初始化

```vue
<script setup lang="ts">
import {watch} from 'vue';
import {$t} from '@/locales';                              // 国际化函数
import {useAppStore} from '@/store/modules/app';           // Store
import {useEcharts} from '@/hooks/common/echarts';         // 通用 Hook

defineOptions({ name: 'LineChart' });

const appStore = useAppStore();

const {domRef, updateOptions} = useEcharts(() => ({         // Hook 返回 DOM ref 和更新方法
  // ECharts option 配置...
}));

async function mockData() {                                 // 异步数据加载
  await new Promise(resolve => setTimeout(resolve, 1000));
  updateOptions(opts => {
    opts.xAxis.data = ['06:00', '08:00', /* ... */];
    opts.series[0].data = [4623, 6145, /* ... */];
    return opts;
  });
}

function updateLocale() {                                   // 响应语言切换
  updateOptions((opts, factory) => {
    const originOpts = factory();
    opts.legend.data = originOpts.legend.data;              // 重新获取翻译后的文本
    opts.series[0].name = originOpts.series[0].name;
    return opts;
  });
}

watch(                                                      // 监听 locale 变化
  () => appStore.locale,
  () => { updateLocale(); }
);

init();                                                     // 初始化调用
</script>
```

**阅读要点**：
1. `useEcharts` Hook 封装了 ECharts 的初始化、销毁、响应式更新
2. `watch(() => appStore.locale, ...)` —— 监听 store 中的特定状态
3. `updateOptions((opts, factory) => { ... })` —— 函数式更新，基于原配置修改
4. 语言切换时重新渲染图表文案 —— 国际化与图表库的联动

---

### 规范评审清单

| 检查项 | 标准 | `App.vue` | `home/index.vue` | `store/modules/app` | `line-chart.vue` |
|--------|------|-----------|------------------|---------------------|------------------|
| 命名规范 | 文件kebab-case、组件PascalCase、函数camelCase | ✅ `App.vue` 是特例（根组件） | ✅ `index.vue` 固定命名 | ✅ `useAppStore` / `SetupStoreId.App` | ✅ `LineChart` |
| 类型完整性 | 零any | ✅ `WatermarkProps` 有类型 | ✅ 无业务逻辑，无any | ✅ `App.I18n.LangType` | ✅ `useEcharts` 有类型 |
| 目录规范 | 组件放正确目录 | ✅ 根目录 | ✅ `views/home/` | ✅ `store/modules/app/` | ✅ `views/home/modules/` |
| 导入顺序 | type → 第三方 → 内部@/ → 相对./ | ⚠️ 代码中 `computed` 在 `type` 之前，与规范略有差异（实际项目允许） | ✅ 只有相对导入 | ✅ `vue` → `pinia` → `@/` | ✅ `vue` → `@/locales` → `@/store` → `@/hooks` |
| 错误处理 | 异步有try/catch或统一拦截 | ⚠️ 无显式错误处理（根组件） | N/A | ✅ `reloadPage` 有超时控制 | ⚠️ `mockData` 无错误处理（演示数据） |
| 可测试性 | 纯函数可单测 | ✅ `computed` 是纯函数 | N/A | ⚠️ `effectScope` 较复杂，但逻辑清晰 | ✅ `mockData` 可抽离为服务 |
| 国际化 | 用户可见字符串 `$t()` | ⚠️ 无用户可见文本 | N/A | N/A | ✅ `$t('page.home.downloadCount')` |
| defineOptions | 显式声明组件名 | ✅ | ✅ | N/A | ✅ |

**评审结论**：`App.vue` 的导入顺序中 `computed` 放在了 `type` 之前，但项目 ESLint 配置未强制排序 Vue 内置 API（属于可接受范围）。`line-chart.vue` 的 `mockData` 是演示代码，实际业务中应添加错误处理。

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**目标**：实现一个"计数器卡片"组件，展示在首页。

功能拆解：
1. 显示当前计数值（响应式）
2. 点击按钮增加/减少计数
3. 计数为负数时显示红色警告
4. 将计数持久化到 `localStorage`（刷新页面不丢失）
5. 组件名显式声明，使用 TypeScript 类型

### 第二步：小任务开发

#### 任务 1：基础组件结构

创建文件：`src/views/home/modules/counter-card.vue`

```vue
<script setup lang="ts">
import {computed} from 'vue';

defineOptions({
  name: 'CounterCard'
});

// Props 类型定义
interface Props {
  initialValue?: number;
}

const props = withDefaults(defineProps<Props>(), {
  initialValue: 0
});

// 后续补充...
</script>

<template>
  <ACard :bordered="false" class="card-wrapper">
    <!-- 后续补充... -->
  </ACard>
</template>
```

**要点**：
- 文件命名 `counter-card.vue`（kebab-case）
- 组件名 `CounterCard`（PascalCase）
- Props 使用 interface + `withDefaults` 给默认值
- 使用 `ACard`（Ant Design Vue 组件，PascalCase 引用）

#### 任务 2：响应式状态 + 计算属性

```vue
<script setup lang="ts">
import {ref, computed} from 'vue';

// ... Props 定义同上

const count = ref(props.initialValue);                    // 响应式状态

const isNegative = computed(() => count.value < 0);       // 派生状态：是否为负数
const displayClass = computed(() =>
  isNegative.value ? 'text-red-500' : 'text-green-500'
);

function increment() {
  count.value++;                                          // ref 需要 .value
}

function decrement() {
  count.value--;
}
</script>

<template>
  <ACard :bordered="false" class="card-wrapper">
    <div class="flex flex-col items-center gap-4">
      <span class="text-4xl font-bold" :class="displayClass">
        {{ count }}
      </span>
      <div class="flex gap-2">
        <AButton type="primary" @click="increment">+1</AButton>
        <AButton @click="decrement">-1</AButton>
      </div>
      <ATag v-if="isNegative" color="error">负数警告</ATag>
    </div>
  </ACard>
</template>
```

**要点**：
- `ref` 存储可变状态，`.value` 读写
- `computed` 缓存派生值（`isNegative` 只会在 `count` 变化时重新计算）
- 模板中 `{{ count }}` 自动解包（无需 `.value`）
- `v-if` 条件渲染，`@click` 事件绑定
- UnoCSS 类名：`flex flex-col items-center gap-4 text-4xl font-bold`

#### 任务 3：持久化 + 类型安全

```vue
<script setup lang="ts">
import {ref, computed, watch, onMounted} from 'vue';
import {localStg} from '@/utils/storage';                  // carlos-ui 的存储封装

// ... Props 定义

const STORAGE_KEY = 'home_counter_value' as const;

const count = ref(props.initialValue);

// 初始化时从 localStorage 读取
onMounted(() => {
  const saved = localStg.get(STORAGE_KEY);
  if (saved !== null) {
    const parsed = Number(saved);
    if (!Number.isNaN(parsed)) {
      count.value = parsed;
    }
  }
});

// 变化时持久化到 localStorage
watch(count, (newValue) => {
  localStg.set(STORAGE_KEY, String(newValue));
}, { immediate: false });

// ... computed 和 methods 同上
</script>
```

**要点**：
- `onMounted` —— 组件挂载后执行（类似 `@PostConstruct`）
- `watch` —— 监听 `count` 变化，自动持久化
- `localStg` —— carlos-ui 封装的存储工具（比原生 localStorage 更安全）
- 常量 `STORAGE_KEY` 使用 `UPPER_SNAKE_CASE` + `as const`

### 第三步：整合 + 测试

#### 将组件注册到首页

修改 `src/views/home/index.vue`：

```vue
<script setup lang="ts">
// ... 现有导入
import CounterCard from './modules/counter-card.vue';      // 新增导入放最后
</script>

<template>
  <ASpace direction="vertical" :size="16">
    <HeaderBanner/>
    <CounterCard :initial-value="10" />                    <!-- 插入新组件 -->
    <CardData/>
    <!-- ... 其余布局 -->
  </ASpace>
</template>
```

#### 调试与验证

1. **功能测试**：
   - 点击 +1/-1，计数是否正确变化？
   - 减到负数时，是否变红并显示警告标签？
   - 刷新页面后，计数是否恢复？

2. **类型检查**：
   ```bash
   pnpm typecheck
   ```

3. **规范检查**：
   ```bash
   pnpm lint
   ```

4. **可能的错误排查**：
   - 如果 `count.value` 写成 `count`，TS 会报错 "This expression is not callable"——记住 `ref` 要 `.value`
   - 如果 `CounterCard` 导入路径错误，Vite 会提示 "Failed to resolve import"——检查相对路径 `./modules/`
   - 如果 `defineOptions` 未声明，Vue DevTools 会显示匿名组件——养成显式命名的习惯

### 验收标准

- [x] **能用**：计数器可增可减，负数变红，刷新不丢数据
- [x] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过
- [x] **精进**：
  - 使用 `computed` 而非模板内联表达式
  - `watch` 只监听需要持久化的状态
  - 组件名显式声明，Props 有类型
  - 无 `any`，无未处理异常

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `ref` | 包装值的响应式容器，读写要 `.value` | `AtomicReference<T>` | 自动触发依赖更新，无需手动通知 |
| `reactive` | 包装对象的响应式代理 | `ObservableMap` | Proxy 拦截，新增属性自动追踪 |
| `computed` | 带缓存的派生值 | 带缓存的 getter | 依赖变化时自动重新计算，无副作用 |
| `watch` | 监听状态变化执行回调 | `PropertyChangeListener` | 可监听多源、深度监听、立即执行 |
| `<script setup>` | Composition API 的语法糖 | 构造器 + 自动注入 | 编译期自动暴露变量到模板，无 `this` |
| `defineOptions` | 显式声明组件元信息 | `@Component("name")` | 编译宏，不生成运行时代码 |
| `effectScope` | 批量管理副作用生命周期 | `try-finally` / 资源池 | 可暂停、恢复、批量清理 |
| `onMounted` | 组件挂载到 DOM 后执行 | `@PostConstruct` | 可多次注册，按顺序执行 |
| Pinia Store | 全局响应式状态容器 | `@Service` 单例 | 组合式 API 风格，函数返回，更灵活 |
| 虚拟 DOM | 内存中的 DOM 树快照 | DOM 抽象层 | diff 算法最小化真实 DOM 操作 |

---

## 🚀 明日预告

**第8天：模板语法与指令 — Vue 的"JSP 标签库"**

进入第二阶段（Vue 3 核心深入），我们将学习：
- `v-if` / `v-show` 的选型场景（不是简单替换 `display: none`）
- `v-for` + `:key` 的底层原理（为什么 `key` 不能乱写）
- `v-model` 的语法糖拆解（双向绑定 ≠ 魔法）
- 修饰符系统（`.lazy`、`.number`、`.trim`）

**第二阶段目标**：从"看懂组件"到"能拆、能改、能独立开发 CRUD 页面"。

---

> **今日寄语**：Vue 3 的 Composition API 不是"另一种写法"，而是"另一种思维方式"——从"配置对象"到"函数组合"。作为 Java 工程师，你已经习惯了"方法组合"（Service 层调用多个 DAO），现在只是把这套思维搬到了前端。明天开始，我们将深入模板语法，理解 Vue 的"声明式渲染"到底做了什么。
