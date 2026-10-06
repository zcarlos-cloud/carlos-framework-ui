# 今日前端课程 — 第19天：性能优化 — keep-alive、Suspense、异步组件、虚拟列表

> **学习目标**
> - **能读**：能读懂 carlos-ui 中 KeepAlive、defineAsyncComponent、shallowRef 的真实用法，理解为什么这样设计
> - **能用**：能用 KeepAlive 缓存页面状态、用 defineAsyncComponent 拆分大组件、用 shallowRef 优化大数据响应式开销
> - **规范**：符合《前端开发规范.md》中性能优化章节的要求（命名、目录、导入顺序、类型完整）
> - **精进**：理解 effectScope 生命周期管理、对比深/浅响应式的边界场景，能在代码审查中识别性能反模式
> 
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + AntDV + Pinia + UnoCSS

---

## 理论学习

### 核心知识点

#### 1. KeepAlive — 组件级缓存（组件级"Session 缓存"）

**是什么**：`KeepAlive` 是 Vue 内置的抽象组件，包裹动态组件后，被切换走的组件不会被销毁，而是被缓存到内存中。再次切换回来时，直接复用缓存实例，保留内部状态（表单值、滚动位置、子组件状态等）。

**Java 类比**：
> 类似 Java 的 **对象池（Object Pool）** 或 **Session 缓存**。Spring 中的 `@Scope("session")` Bean 在会话期间保持状态；KeepAlive 在路由/Tab 切换期间保持组件状态。区别在于：KeepAlive 是**组件粒度**、**内存驻留**、**显式控制缓存名单**。

**前端独有的设计哲学**：
> 前端页面切换是高频操作，如果每次切走都销毁重建，表单数据、表格筛选条件、滚动位置都会丢失，用户体验极差。KeepAlive 是"用内存换体验"的典型策略。但前端内存是**有限且共享的**（浏览器给每个标签页的内存是受限的），所以必须精确控制 `include` / `exclude`，不像 Java Session 可以相对粗放地存。

**carlos-ui 中的真实用法**（`src/layouts/modules/global-content/index.vue`）：

```vue
<RouterView v-slot="{ Component, route }">
  <Transition :name="transitionName" mode="out-in">
    <KeepAlive :include="routeStore.cacheRoutes" :exclude="routeStore.excludeCacheRoutes">
      <component
        :is="Component"
        v-if="appStore.reloadFlag"
        :key="tabStore.getTabIdByRoute(route)"
      />
    </KeepAlive>
  </Transition>
</RouterView>
```

**关键设计点**：
- `include` 使用 `routeStore.cacheRoutes`（`RouteKey[]`），由菜单配置的 `keepAlive` 字段决定哪些页面需要缓存
- `exclude` 使用 `routeStore.excludeCacheRoutes`，用于动态排除（比如用户手动刷新某个页面时）
- `v-if="appStore.reloadFlag"` 是全局刷新机制：将 `reloadFlag` 先置 false 再 true，强制重新挂载（绕过 KeepAlive）
- `:key` 使用 `tabStore.getTabIdByRoute(route)`，同一页面不同参数会生成不同 key，避免错误复用缓存

#### 2. defineAsyncComponent — 异步组件拆分（"按需加载类"）

**是什么**：将组件的定义延迟到真正需要渲染时才执行。Vue 内部会自动处理加载状态、错误状态、占位内容。

**Java 类比**：
> 类似 Java 的 **动态类加载（Class.forName + newInstance）** 或 **Spring 的 Lazy-Init Bean**。在 Spring 中，`@Lazy` 注解让 Bean 在首次注入时才实例化；`defineAsyncComponent` 让组件在首次渲染时才加载 JS 文件。区别：前端是**网络加载**（HTTP 请求），不是纯内存操作，所以需要考虑加载状态和错误边界。

**前端独有的设计哲学**：
> 前端应用的所有代码都需要通过 HTTP 下载到浏览器。如果不拆分，一个 admin 系统的 JS 可能达到数 MB，首屏加载时间爆炸。异步组件是"用网络延迟换首屏速度"的策略。配合 Vite 的 Rollup 构建，每个 `import()` 都会生成一个独立的 chunk 文件，浏览器按需下载。

**carlos-ui 中的真实用法**（`src/layouts/base-layout/index.vue`）：

```typescript
import { computed, defineAsyncComponent } from 'vue';

const GlobalMenu = defineAsyncComponent(() => import('../modules/global-menu/index.vue'));
```

**为什么 GlobalMenu 要用异步加载？**
> `GlobalMenu` 只在 mix 布局模式下（`vertical-mix` / `horizontal-mix`）才会渲染。对于更常用的 `vertical` / `horizontal` 布局，`GlobalMenu` 永远不会被用到。异步加载避免了在不需要的场景下加载和解析这段代码，减少主 bundle 体积。

**注意**：不是所有组件都适合异步加载。如果一个组件在 90% 的场景下都会被使用，异步加载反而会增加一次 HTTP 请求开销。异步组件适合**条件渲染**、**低频使用**、**体积大**的组件。

#### 3. shallowRef — 浅层响应式（"只监听引用变化，不深追"）

**是什么**：`shallowRef` 创建的响应式引用，只追踪 `.value` 的赋值操作，不递归追踪内部属性的变化。换句话说，只有**替换整个对象**时才会触发更新，修改对象内部属性不会触发。

**Java 类比**：
> 类似 Java 的 `AtomicReference<T>` — 你通过 `set(newValue)` 替换整个引用时，观察者收到通知；但修改 `get()` 返回对象的内部字段，不会触发任何通知。这是"引用级原子性" vs "深监听级"的区别。

**前端独有的设计哲学**：
> Vue 的 `ref` 和 `reactive` 默认是**深度响应式**的（递归 Proxy 监听所有嵌套属性）。对于复杂对象（如路由配置数组、ECharts 图表配置对象、大型表格数据），深度响应式的开销巨大：每次修改都会触发大量依赖追踪和更新。`shallowRef` 是**性能优化利器** — 你明确告诉 Vue："这个对象内部变化我不关心，只在我替换整个对象时通知我。

**carlos-ui 中的真实用法**：

**① 路由配置数组**（`src/store/modules/route/index.ts`）：

```typescript
import { shallowRef } from 'vue';

const constantRoutes = shallowRef<ElegantConstRoute[]>([]);
const authRoutes = shallowRef<ElegantConstRoute[]>([]);

function addConstantRoutes(routes: ElegantConstRoute[]) {
  const constantRoutesMap = new Map<string, ElegantConstRoute>([]);
  routes.forEach(route => {
    constantRoutesMap.set(route.name, route);
  });
  constantRoutes.value = Array.from(constantRoutesMap.values()); // 替换整个数组，触发更新
}
```

**为什么用 shallowRef？** 路由配置数组通常很大（数十到数百个路由对象），且路由配置是**只读引用**（从后端/静态配置加载后，不会在运行时被逐个修改）。用 `shallowRef` 避免 Vue 对深层路由对象进行无意义的 Proxy 监听，大幅降低内存和运行时开销。

**② 树形数据**（`src/views/manage/role/modules/button-auth-modal.vue`）：

```typescript
import { shallowRef } from 'vue';
import type { DataNode } from 'ant-design-vue/es/tree';

const tree = shallowRef<DataNode[]>([]);
const checks = shallowRef<number[]>([]);
```

**为什么用 shallowRef？** `DataNode` 是 Ant Design Vue 的树节点类型，内部结构复杂（可能有 children 嵌套）。树节点数据来自 API 响应，加载后整体替换，不需要监听每个节点的 label/value 变化。`shallowRef` 既保证数据响应式，又避免深度 Proxy 开销。

**③ DOM 元素引用**（`src/hooks/common/table.ts`）：

```typescript
import { shallowRef } from 'vue';

const tableWrapperRef = shallowRef<HTMLElement | null>(null);
```

DOM 元素是**原生对象**，Vue 不需要对 DOM 元素的属性进行响应式监听。`shallowRef` 只追踪引用变化（元素挂载/卸载时），不尝试 Proxy 原生 DOM 对象。

#### 4. effectScope — 副作用作用域管理（"批量清理资源"）

**是什么**：`effectScope` 创建一个作用域，收集内部所有的 `watch`、`computed`、`effect` 等副作用。当调用 `scope.stop()` 时，一次性清理所有副作用。`onScopeDispose` 在作用域销毁时执行回调。

**Java 类比**：
> 类似 Java 的 **try-with-resources** 或 **Spring 的 Bean 生命周期（`@PreDestroy`）**。在 Spring 中，Bean 被销毁时，Spring 容器自动调用销毁方法释放资源；`effectScope` 让 Vue 的副作用也能被**批量、确定性地清理**，避免内存泄漏。

**前端独有的设计哲学**：
> Vue 组件有 `onUnmounted` 生命周期，但 Hooks/Composable 函数没有自己的生命周期。如果一个 composable 在多个组件中被使用，或者需要手动控制副作用的生命周期，`effectScope` 提供了**跨组件的副作用管理**。这是前端"函数式组件 + 组合式逻辑"架构下的必要工具。

**carlos-ui 中的真实用法**（`src/hooks/common/table.ts`）：

```typescript
import { effectScope, onScopeDispose, watch } from 'vue';

export function useTable<A extends AntDesign.TableApiFn>(config: AntDesign.AntDesignTableConfig<A>) {
  const scope = effectScope();
  
  // ... 初始化逻辑 ...

  scope.run(() => {
    watch(
      () => appStore.locale,
      () => {
        reloadColumns(); // 语言切换时重新加载列配置
      }
    );
  });

  onScopeDispose(() => {
    scope.stop(); // 组件卸载时，自动停止 scope 内所有 watch/computed
  });

  return { /* ... */ };
}
```

**为什么不用 `watch` 直接返回停止函数？** 因为 `useTable` 内部可能有**多个** `watch` / `computed`，逐个管理停止函数繁琐且容易遗漏。`effectScope` 提供了**一个停止点控制多个副作用**，类似 Java 的 `ExecutorService.shutdown()` 一次性关闭线程池。

#### 5. 虚拟列表 — 大数据渲染优化（只渲染可见区域）

**是什么**：当列表数据量巨大（千级/万级）时，不渲染全部 DOM 节点，只渲染视口可见区域 + 缓冲区的少量节点，配合滚动位置动态替换。这被称为"窗口化"（windowing）或"虚拟滚动"。

**Java 类比**：
> 类似 Java 的 **数据库分页查询** 或 **JTable 的自定义 TableModel**。在数据库中，你不会一次性 `SELECT * FROM table`，而是用 `LIMIT offset, size` 分页；虚拟列表是前端的"分页渲染"，只把当前页的数据渲染到 DOM 中。区别在于：前端虚拟列表是**滚动驱动的实时分页**，需要和滚动事件紧密配合，且要考虑滚动条的"视觉欺骗"（总高度要等于全部数据的高度，否则会跳）。

**前端独有的设计哲学**：
> 浏览器渲染 DOM 的成本远高于 Java 后端渲染内存对象。10000 个 DOM 节点的创建、布局、绘制，足以让页面卡顿数秒。虚拟列表是"用计算换渲染"：用 JS 计算滚动位置，只让少量节点参与布局绘制。这是前端特有的优化，因为 Java 后端没有"DOM 渲染"这个瓶颈。

**carlos-ui 中的实践方向**：
> 项目中目前没有直接使用虚拟列表组件（因为 Ant Design Vue 的 `Table` 自带分页，数据量通常可控）。但在以下场景需要考虑：
> - 菜单搜索（`searchMenus` 可能有几百条）
> - 日志/审计列表（数据量可能上万）
> - 下拉选择器（选项很多时）
> 
> 推荐方案：使用 `vue-virtual-scroller` 或 Ant Design Vue 的 `Table` 的 `scroll` 虚拟滚动属性。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

#### 文件 1：`src/layouts/modules/global-content/index.vue` — KeepAlive + Transition 组合

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { LAYOUT_SCROLL_EL_ID } from '@sa/materials';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import { useRouteStore } from '@/store/modules/route';
import { useTabStore } from '@/store/modules/tab';

defineOptions({ name: 'GlobalContent' });

interface Props {
  showPadding?: boolean;
}

withDefaults(defineProps<Props>(), { showPadding: true });

const appStore = useAppStore();
const themeStore = useThemeStore();
const routeStore = useRouteStore();
const tabStore = useTabStore();

const transitionName = computed(() => (themeStore.page.animate ? themeStore.page.animateMode : ''));

function resetScroll() {
  const el = document.querySelector(`#${LAYOUT_SCROLL_EL_ID}`);
  el?.scrollTo({ left: 0, top: 0 });
}
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <Transition
      :name="transitionName"
      mode="out-in"
      @before-leave="appStore.setContentXScrollable(true)"
      @after-leave="resetScroll"
      @after-enter="appStore.setContentXScrollable(false)"
    >
      <KeepAlive :include="routeStore.cacheRoutes" :exclude="routeStore.excludeCacheRoutes">
        <component
          :is="Component"
          v-if="appStore.reloadFlag"
          :key="tabStore.getTabIdByRoute(route)"
          :class="{ 'p-16px': showPadding }"
          class="flex-grow bg-layout transition-300"
        />
      </KeepAlive>
    </Transition>
  </RouterView>
</template>
```

**阅读指引**：
1. 先看整体结构：`RouterView` → `Transition` → `KeepAlive` → `component`，三层嵌套，分工明确
2. `RouterView v-slot="{ Component, route }"`：Vue Router 的插槽 API，将当前匹配的组件和路由信息暴露出来
3. `Transition` 的 `mode="out-in"`：旧组件先离开，新组件再进入，避免两个组件同时存在导致的布局抖动
4. `KeepAlive` 的 `include` 绑定 `routeStore.cacheRoutes`：哪些页面需要缓存，由菜单配置决定
5. `v-if="appStore.reloadFlag"`：全局刷新开关，这是绕过 KeepAlive 缓存的巧妙机制

#### 文件 2：`src/store/modules/route/index.ts` — 缓存路由管理

```typescript
// Cache routes
const cacheRoutes = ref<RouteKey[]>([]);
const excludeCacheRoutes = ref<RouteKey[]>([]);

function getCacheRoutes(routes: RouteRecordRaw[]) {
  cacheRoutes.value = getCacheRouteNames(routes);
}

async function resetRouteCache(routeKey?: RouteKey) {
  const routeName = routeKey || (router.currentRoute.value.name as RouteKey);
  excludeCacheRoutes.value.push(routeName);
  await nextTick();
  excludeCacheRoutes.value = [];
}
```

**阅读指引**：
1. `cacheRoutes` 用 `ref` 而不是 `shallowRef`，因为数组本身不复杂，且 `getCacheRouteNames` 返回的是字符串数组
2. `resetRouteCache` 的巧妙设计：先 push 到 `excludeCacheRoutes`，触发 KeepAlive 排除；然后 `nextTick()` 等待 DOM 更新；再清空 `excludeCacheRoutes`，下次进入时重新缓存。这是"临时排除再恢复"的模式。

#### 文件 3：`src/store/modules/route/shared.ts` — 缓存路由名提取

```typescript
function getCacheRouteNames(routes: RouteRecordRaw[]) {
  const cacheNames: LastLevelRouteKey[] = [];

  routes.forEach(route => {
    route.children?.forEach(child => {
      if (child.component && child.meta?.keepAlive) {
        cacheNames.push(child.name as LastLevelRouteKey);
      }
    });
  });

  return cacheNames;
}
```

**阅读指引**：
- 只缓存**叶子节点**（`child.component` 存在）且 `meta.keepAlive === true` 的路由
- 一级路由（layout wrapper）不会被缓存，因为真正需要保留状态的是页面内容组件

### 规范评审清单

| 检查项 | 标准 | 文件 1 (global-content) | 文件 2 (route store) | 文件 3 (shared) |
|--------|------|------------------------|---------------------|----------------|
| 命名规范 | 文件 kebab-case、组件 PascalCase | ✅ `global-content/index.vue` / `GlobalContent` | ✅ `route/index.ts` / `useRouteStore` | ✅ `shared.ts` |
| 类型完整性 | 零 any | ✅ Props 接口完整 | ✅ `RouteKey[]`, `ElegantConstRoute[]` | ✅ `LastLevelRouteKey[]` |
| 目录规范 | 文件在正确目录 | ✅ `layouts/modules/` | ✅ `store/modules/` | ✅ `store/modules/route/` |
| 导入顺序 | type → 第三方 → 内部 → 相对 | ✅ 符合 | ✅ 符合 | ✅ 符合 |
| 错误处理 | 异步有 try/catch 或统一拦截 | N/A（无异步） | ✅ 路由初始化有 error 判断 | N/A（纯函数） |
| 可测试性 | 纯函数可单测 | ⚠️ 组件依赖 store | ⚠️ 依赖 router 实例 | ✅ 纯函数 `getCacheRouteNames` 可单测 |
| 国际化 | 用户可见字符串 `$t()` | N/A（无 UI 文本） | N/A | N/A |

**评审结论**：整体代码质量很高。`getCacheRouteNames` 是一个纯函数，非常易于测试。建议为 `shared.ts` 中的工具函数补充单元测试。

---

## 功能实践 — 分三步

### 第一步：功能分析

我们要实现一个**可缓存的页面管理面板**：
1. 一个页面列表，显示当前系统所有页面及其缓存状态
2. 可以手动切换某个页面的缓存开关
3. 提供"刷新当前页面"按钮，绕过 KeepAlive 重新加载
4. 列表数据量大时使用虚拟滚动优化

**小任务拆分**：
- 任务 A：读取 route store 中的 `cacheRoutes`，渲染页面列表
- 任务 B：实现页面缓存开关的切换（修改菜单配置中的 `keepAlive` 字段）
- 任务 C：实现"刷新当前页面"功能（调用 `resetRouteCache`）
- 任务 D：用 `shallowRef` 管理列表数据，用虚拟滚动优化大数据列表

### 第二步：小任务开发

#### 任务 A：读取缓存路由列表并渲染

```typescript
// src/views/dev/cache-management/index.vue
<script setup lang="ts">
import { computed } from 'vue';
import { useRouteStore } from '@/store/modules/route';
import { $t } from '@/locales';

defineOptions({ name: 'CacheManagement' });

const routeStore = useRouteStore();

// 从 menus 中提取带 keepAlive 配置的页面信息
const pageList = computed(() => {
  const pages: { name: string; path: string; cached: boolean }[] = [];

  function traverse(menus: App.Global.Menu[]) {
    menus.forEach(menu => {
      if (menu.routeName) {
        pages.push({
          name: menu.routeName,
          path: menu.routePath,
          cached: routeStore.cacheRoutes.includes(menu.routeName as RouteKey)
        });
      }
      if (menu.children?.length) {
        traverse(menu.children);
      }
    });
  }

  traverse(routeStore.menus);
  return pages;
});
</script>

<template>
  <div class="p-16px">
    <ACard :title="$t('page.dev.cacheManagement.title')">
      <ATable :data-source="pageList" :columns="columns" row-key="name" />
    </ACard>
  </div>
</template>
```

**技术要点**：
- 使用 `routeStore.menus` 而非原始路由，因为 menus 是扁平化后的菜单树，更贴近用户看到的页面结构
- `cached` 通过 `routeStore.cacheRoutes.includes()` 判断，这是响应式计算属性，store 变化时自动重新计算

#### 任务 B：切换缓存开关

```typescript
// 在 menu 配置中修改 keepAlive（需要后端支持或本地 mock）
// 更现实的方案：在页面中提供本地覆盖，存入 localStorage

import { useStorage } from '@vueuse/core';

// 本地缓存覆盖表：routeName -> boolean
const localCacheOverrides = useStorage<Record<string, boolean>>('cache-overrides', {});

const effectiveCacheRoutes = computed(() => {
  return routeStore.cacheRoutes.filter(name => {
    // 如果本地有覆盖，使用本地值；否则使用默认值
    return localCacheOverrides.value[name] !== false;
  });
});

function toggleCache(name: string) {
  const current = localCacheOverrides.value[name];
  localCacheOverrides.value[name] = current === false ? true : false;
}
```

**技术要点**：
- `useStorage` 是 VueUse 的 hook，自动同步 localStorage 和响应式 ref
- 真实项目中，缓存配置通常由后端菜单管理接口控制（`src/views/manage/menu/modules/menu-operate-modal.vue` 中的 `keepAlive` 字段）

#### 任务 C：刷新当前页面（绕过 KeepAlive）

```typescript
import { useRouteStore } from '@/store/modules/route';
import { useAppStore } from '@/store/modules/app';

const routeStore = useRouteStore();
const appStore = useAppStore();
const router = useRouter();

async function refreshCurrentPage() {
  const currentName = router.currentRoute.value.name as RouteKey;

  // 先排除当前路由的缓存
  await routeStore.resetRouteCache(currentName);

  // 同时触发全局 reloadFlag（v-if 先 false 再 true）
  await appStore.reloadPage();
}
```

**技术要点**：
- `resetRouteCache` 先排除缓存，再恢复，确保下一次进入时重新缓存
- `appStore.reloadPage()` 通常实现为：将 `reloadFlag` 置 false（`nextTick`）再置 true，强制 `v-if` 重新渲染
- 这两个操作组合，确保组件**完全重新创建**，而不是复用缓存

#### 任务 D：shallowRef + 虚拟滚动优化

```typescript
// 假设列表数据量很大（如审计日志），需要虚拟滚动
import { shallowRef, computed } from 'vue';

// 大数据列表用 shallowRef：我们只关心整体替换，不关心内部字段变化
const logList = shallowRef<Api.Audit.Log[]>([]);

async function fetchLogs() {
  const { data, error } = await fetchGetAuditLogs({ current: 1, size: 1000 });
  if (!error) {
    logList.value = data.records; // 整体替换，触发一次更新
  }
}

// 虚拟滚动：只渲染视口可见项
const viewportHeight = ref(600);
const itemHeight = 48;
const scrollTop = ref(0);

const visibleRange = computed(() => {
  const startIdx = Math.floor(scrollTop.value / itemHeight);
  const visibleCount = Math.ceil(viewportHeight.value / itemHeight);
  const endIdx = Math.min(startIdx + visibleCount + 2, logList.value.length); // +2 缓冲区
  return { startIdx, endIdx };
});

const visibleData = computed(() => {
  const { startIdx, endIdx } = visibleRange.value;
  return logList.value.slice(startIdx, endIdx).map((item, idx) => ({
    ...item,
    _virtualIndex: startIdx + idx
  }));
});

const totalHeight = computed(() => logList.value.length * itemHeight);

const offsetStyle = computed(() => ({
  paddingTop: `${visibleRange.value.startIdx * itemHeight}px`,
  paddingBottom: `${(logList.value.length - visibleRange.value.endIdx) * itemHeight}px`
}));
```

**技术要点**：
- `shallowRef` 用于日志数据：API 返回后整体替换，不会逐个修改日志字段
- 虚拟滚动核心：计算 `startIdx` / `endIdx`，只渲染可见项，用 `paddingTop` / `paddingBottom` 撑开总高度，保持滚动条视觉正确
- 这是前端特有的优化，Java 后端没有"DOM 渲染瓶颈"，不需要这种技巧

### 第三步：整合与功能测试

将四个任务整合为一个完整的"缓存管理"页面：

```vue
<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useRouteStore } from '@/store/modules/route';
import { useAppStore } from '@/store/modules/app';
import { useRouter } from 'vue-router';
import { useStorage } from '@vueuse/core';
import { $t } from '@/locales';

defineOptions({ name: 'CacheManagement' });

const routeStore = useRouteStore();
const appStore = useAppStore();
const router = useRouter();

const localOverrides = useStorage<Record<string, boolean>>('cache-overrides', {});

const pageList = computed(() => {
  const pages: { name: string; path: string; cached: boolean; overridable: boolean }[] = [];
  // ... 从 menus 遍历收集
  return pages;
});

async function refreshPage(name: string) {
  await routeStore.resetRouteCache(name as RouteKey);
  if (router.currentRoute.value.name === name) {
    await appStore.reloadPage();
  }
}

function toggleOverride(name: string) {
  localOverrides.value[name] = !localOverrides.value[name];
}
</script>

<template>
  <div class="p-16px">
    <ACard :title="$t('page.dev.cacheManagement.title')">
      <ATable :data-source="pageList" row-key="name">
        <ATableColumn :title="$t('page.dev.cacheManagement.pageName')" data-index="name" />
        <ATableColumn :title="$t('page.dev.cacheManagement.cached')">
          <template #default="{ record }">
            <ASwitch :checked="record.cached" @change="toggleOverride(record.name)" />
          </template>
        </ATableColumn>
        <ATableColumn :title="$t('common.action')">
          <template #default="{ record }">
            <AButton type="primary" @click="refreshPage(record.name)">
              {{ $t('common.refresh') }}
            </AButton>
          </template>
        </ATableColumn>
      </ATable>
    </ACard>
  </div>
</template>
```

**调试及错误排查思路**：
1. **页面切换后状态丢失**：检查 `KeepAlive` 的 `include` 是否包含该路由名，检查组件的 `name` 选项是否正确定义（必须与路由名匹配）
2. **刷新不生效**：检查 `appStore.reloadFlag` 是否先 false 再 true（确保 `v-if` 重新触发），检查 `excludeCacheRoutes` 是否先 push 再清空
3. **虚拟列表滚动跳变**：检查 `itemHeight` 是否固定，检查 `paddingTop` / `paddingBottom` 计算是否正确
4. **shallowRef 修改内部属性不更新**：这是预期行为！如果需要响应内部变化，要么用 `ref`，要么替换整个对象

### 验收标准

- [ ] **能用**：缓存管理页面能正确显示各页面缓存状态，刷新按钮能绕过 KeepAlive 重新加载
- [ ] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过，组件名 `CacheManagement` 使用 PascalCase，文件在 `views/dev/cache-management/index.vue`
- [ ] **精进**：
  - 列表数据用 `shallowRef` 管理（零深层响应式开销）
  - `effectScope` 管理副作用生命周期（如果封装为 hook）
  - 无 `any` 类型
  - 错误处理完备（API 调用有 error 判断）

---

## 今日重点记忆卡

| 概念 | 一句话 | Java 类比 | 前端独有 |
|------|--------|---------|---------|
| KeepAlive | 切换页面时缓存组件实例，下次切回不复建 | 对象池 / Session 缓存 | 组件粒度、内存驻留、显式名单控制 |
| defineAsyncComponent | 组件首次渲染时才加载对应 JS | 动态类加载 / @Lazy Bean | 网络加载（HTTP chunk）、需考虑加载态 |
| shallowRef | 只监听 `.value` 赋值，不 Proxy 内部属性 | AtomicReference | 避免深层响应式开销，适合大数据对象 |
| effectScope | 批量收集和清理副作用 | try-with-resources / @PreDestroy | 跨组件的副作用生命周期管理 |
| 虚拟列表 | 只渲染视口可见项，撑开总高度保持滚动 | 数据库分页查询 | 滚动驱动实时分页，DOM 渲染瓶颈特有优化 |
| Transition mode="out-in" | 旧组件先离开，新组件再进入 | 事务的串行执行 | 避免布局抖动，前端视觉体验优化 |

---

## 常见性能反模式（避免踩坑）

| 反模式 | 为什么不好 | 正确做法 |
|--------|---------|---------|
| 所有页面都 `keepAlive: true` | 内存爆炸，浏览器标签页崩溃 | 只缓存高频操作页面（表格、表单），列表页按需 |
| 大数据对象用 `ref` / `reactive` | 深层 Proxy 监听，内存和 CPU 双高 | 用 `shallowRef`，修改时替换整个对象 |
| 异步组件滥用 | 增加 HTTP 请求数，网络延迟反而降低体验 | 只在条件渲染、低频、大体积组件上使用 |
| 虚拟列表 `itemHeight` 不固定 | 滚动位置计算错误，跳变严重 | 固定高度或实现动态高度测量（`ResizeObserver`） |
| 忽略 `effectScope` 清理 | 组件卸载后 watch 仍在运行，内存泄漏 | 使用 `effectScope` + `onScopeDispose` 或 `watch` 返回停止函数 |

---

**明日预告**：第20天 — TypeScript 在 Vue 中的实践 — Props 类型、Emit 类型、泛型组件

> 明日将深入 `defineProps<{...}>()` 的类型推导、`$emit` 的类型安全、以及泛型组件的编写。我们会阅读 `src/components/` 下的真实组件，学习如何为一个 Table 组件添加完整的 TypeScript 类型定义（含泛型行数据）。
