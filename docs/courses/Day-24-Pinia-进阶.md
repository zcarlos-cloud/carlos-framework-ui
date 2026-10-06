# 今日前端课程 — 第24天：Pinia 进阶 — 组合式 Store、持久化、跨 Store 通信与副作用管理

> **学习目标**
> - **能读**：看懂 `carlos-framework-ui` 中所有 Store 的相互调用关系、持久化逻辑和副作用管理
> - **能用**：能用 Composition API 风格（Setup Store）定义一个可持久化、可跨 Store 调用的 Pinia Store
> - **规范**：导入顺序正确（Vue 内置 → Pinia → VueUse → 内部模块 → 同目录），零 `any`，返回状态时正确使用 `toRefs` 或 `storeToRefs`
> - **精进**：理解 `effectScope` 为何是 Store 副作用管理的最佳实践，对比 Options API 与 Setup Store 的编译差异
    > ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + Pinia 3 + VueUse + `@sa/hooks`

---

## 阶段过渡提示

昨天（Day 23）我们完成了 **Pinia 基础**，深入阅读了 `useAuthStore` 和 `useRouteStore`，理解了 `state`/`getters`/`actions` 三件套和 Options API 风格（`useEnumStore`）。

今天进入 Pinia 的**进阶 territory**：

- **Setup Store**（Composition API 风格，已写、未懂）
- **Store 间通信**（`useAuthStore` 在 `useRouteStore` 中初始化）
- **持久化**（`localStorage` + `beforeunload` 双保险）
- **副作用管理**（`effectScope` + `onScopeDispose`）
- **解构响应式**（`storeToRefs` vs `toRefs` 的坑）

**Java 工程师视角**：昨天的 Pinia 像 Spring 的 `@Service` 单例。今天你会发现，它更像**Spring 的 `@Service` + `@PostConstruct` + `@PreDestroy` + 跨 Service 依赖注入** 的完整组合。

---

## 理论学习

### 核心知识点

#### 1. Setup Store vs Options Store — 为什么 carlos-framework-ui 选择了两种风格？

`carlos-framework-ui` 中同时存在两种 Pinia Store 定义方式：

| 风格              | 文件示例                              | 语法                                 | 适用场景                  |
|-----------------|-----------------------------------|------------------------------------|-----------------------|
| **Options API** | `src/store/modules/enum.ts`       | `state`, `getters`, `actions`      | 简单 CRUD、纯数据缓存（如枚举缓存）  |
| **Setup Store** | `src/store/modules/auth/index.ts` | `ref`/`reactive`/`computed` + 函数返回 | 复杂逻辑、跨 Store 依赖、副作用管理 |

**为什么 carlos-framework-ui 的 `useEnumStore` 用 Options API？**

```typescript
// src/store/modules/enum.ts
export const useEnumStore = defineStore(SetupStoreId.Enum, {
  state: () => ({
    cache: {} as Record<string, Enum.EnumItem[]>
  }),
  getters: { /* ... */ },
  actions: { /* ... */ }
});
```

- 枚举数据是**纯数据缓存**，无跨 Store 依赖、无副作用、无持久化 → Options API 更简洁。

**为什么其他 Store 都用 Setup Store？**

```typescript
// src/store/modules/auth/index.ts
export const useAuthStore = defineStore(SetupStoreId.Auth, () => {
  // 依赖其他 Store
  const routeStore = useRouteStore();
  const tabStore = useTabStore();
  // 使用 VueUse 的 Hook
  const { loading, startLoading, endLoading } = useLoading();
  // 副作用管理
  // ...
  return { /* ... */ };
});
```

- 需要**组合式函数**（`useLoading`, `useRouterPush`）
- 需要**跨 Store 调用**（`routeStore.resetStore()`）
- 需要**副作用管理**（`watch`, `useEventListener`）
- 类型推导更友好（`ref`/`computed` 类型自动推导）

> **类比**：Options API 像 Java 的 `POJO + getter/setter`，Setup Store 像 `ServiceImpl` 中注入其他 Service 并写 `@PostConstruct` 初始化逻辑。

---

#### 2. `storeToRefs` — 解构 Store 而不丢失响应式

**问题**：直接解构 Store 的属性会失去响应式。

```typescript
// ❌ 错误：失去响应式！
const { token, isLogin } = useAuthStore();
// token 是 ref 的原始值，不是响应式引用
// isLogin 是 computed 的值，不是响应式计算

// ✅ 正确：使用 storeToRefs 保持响应式
import { storeToRefs } from 'pinia';
const authStore = useAuthStore();
const { token, isLogin } = storeToRefs(authStore);
// token 是 Ref<string>，isLogin 是 ComputedRef<boolean>
```

**底层原理**：

- `storeToRefs` 会遍历 Store 的响应式属性（`ref`/`reactive`/`computed`），将每个属性包装成对应的 `ref`/`computed` 返回。
- 函数和静态值不会被 `storeToRefs` 提取。

**在 `useThemeStore` 中的实战**：

```typescript
// src/store/modules/theme/index.ts
import { toRefs } from 'vue';
// ...
return {
  ...toRefs(settings.value),  // 将 settings 的每个属性变成独立的 ref
  darkMode,
  themeColors,
  // ...
};
```

`toRefs` 在 Store 内部使用，将 `reactive` 对象拆分为独立的 `ref` 供外部使用。这是 `storeToRefs` 的**底层等价物**。

> **Java 类比**：`storeToRefs` 像 Spring 的 `BeanWrapper` 将对象属性暴露为可监听的 `PropertyDescriptor`。`toRefs` 像 `BeanUtils.copyProperties`，但保留响应式。

---

#### 3. 跨 Store 通信 — carlos-framework-ui 的依赖注入模式

**场景**：`useRouteStore` 需要 `useAuthStore` 的用户信息来过滤路由。

```typescript
// src/store/modules/route/index.ts
export const useRouteStore = defineStore(SetupStoreId.Route, () => {
  const authStore = useAuthStore();  // 在 Store 内部直接调用另一个 Store

  async function initAuthRoute() {
    if (!authStore.userInfo.userId) {
      await authStore.initUserInfo();  // 调用另一个 Store 的 action
    }
    // ...
  }

  async function resetStore() {
    const routeStore = useRouteStore();
    routeStore.$reset();  // 自己重置自己
    authStore.resetStore();  // 也可以调用其他 Store 的 reset
  }
});
```

**关键模式**：

| 模式              | 代码                                 | 说明                            |
|-----------------|------------------------------------|-------------------------------|
| **构造函数注入**      | `const authStore = useAuthStore()` | 在 Store 的 setup 函数中调用其他 Store |
| **Action 内部调用** | `await authStore.initUserInfo()`   | 在 action 中调用其他 Store 的 action |
| **循环依赖避免**      | 单向依赖（A → B）                        | 不要出现 A 依赖 B、B 也依赖 A           |

**carlos-framework-ui 的依赖图谱**（简化）：

```
useAuthStore ────→ useRouteStore
     │                │
     │                ├──→ useTabStore
     │                └──→ useThemeStore
     └──→ useTabStore

useAppStore ────→ useRouteStore, useTabStore, useThemeStore
```

> **注意**：`useAuthStore` 被 `useRouteStore` 和 `useTabStore` 依赖。Store 内部调用其他 Store 时，**不要在循环依赖中互相调用**。carlos-framework-ui 通过设计避免了这个问题（`useEnumStore` 完全不依赖其他 Store）。

> **Java 类比**：这像 Spring 的 `@Autowired` 依赖注入，但**没有循环依赖检测器**。你需要自己设计好依赖方向。

---

#### 4. 持久化 — 三种策略

**策略 1：即时写入（Store 内部 `watch`）**

```typescript
// src/store/modules/theme/index.ts
watch(
  themeColors,
  val => {
    setupThemeVarsToGlobal();
    localStg.set('themeColor', val.primary);  // 每次变化都写入
  },
  { immediate: true }
);
```

**策略 2：延迟写入（`beforeunload` 事件）**

```typescript
// src/store/modules/tab/index.ts
useEventListener(window, 'beforeunload', () => {
  cacheTabs();  // 页面关闭前批量写入
});

function cacheTabs() {
  if (!themeStore.tab.cache) return;
  localStg.set('globalTabs', tabs.value);
}
```

**策略 3：条件写入（仅生产环境）**

```typescript
// src/store/modules/theme/index.ts
function cacheThemeSettings() {
  const isProd = import.meta.env.PROD;
  if (!isProd) return;  // 开发环境不缓存，方便调试
  localStg.set('themeSettings', settings.value);
}
```

| 策略   | 优点        | 缺点        | 适用场景            |
|------|-----------|-----------|-----------------|
| 即时写入 | 数据不会丢失    | 频繁写入，性能开销 | 关键单值（如 token）   |
| 延迟写入 | 批量写入，性能友好 | 崩溃时可能丢失   | 非关键批量数据（如 tabs） |
| 条件写入 | 开发环境不污染   | 需要区分环境    | 主题配置（开发时希望重置）   |

> **Java 类比**：即时写入像 `JPA @Transactional` 的 `flush()`，延迟写入像 `Hibernate` 的 Session 缓存，条件写入像 `application.yml` 的 `spring.profiles.active` 条件配置。

---

#### 5. `effectScope` — Store 副作用的"生命周期管理器"

**问题**：Store 中的 `watch` 和 `useEventListener` 会在组件卸载时自动清理。但 Store 是**全局单例**，不会随组件卸载。如果不手动清理，副作用会累积。

**解决方案**：`effectScope`（Vue 3.2+ 引入）。

```typescript
// src/store/modules/theme/index.ts
import { effectScope, onScopeDispose } from 'vue';

export const useThemeStore = defineStore(SetupStoreId.Theme, () => {
  const scope = effectScope();  // 创建一个副作用作用域

  // 所有 watch 放在 scope.run 中
  scope.run(() => {
    watch(darkMode, val => { /* ... */ }, { immediate: true });
    watch([grayscaleMode, colourWeaknessMode], val => { /* ... */ }, { immediate: true });
    watch(themeColors, val => { /* ... */ }, { immediate: true });
  });

  // 当 Store 被重置时，清理所有副作用
  onScopeDispose(() => {
    scope.stop();
  });

  return { /* ... */ };
});
```

**为什么不用 `onUnmounted`？**

- `onUnmounted` 是组件生命周期钩子，Store 不是组件。
- `onScopeDispose` 是 `effectScope` 的清理钩子，专门用于**作用域销毁**。
- `scope.stop()` 会停止该作用域内的所有 `watch`/`computed`/`effect`，防止内存泄漏。

> **Java 类比**：`effectScope` 像 Java 的 `try-with-resources` 或 Spring 的 `@PreDestroy` + `DisposableBean`。`scope.run()` 像 `try { ... }`，`scope.stop()` 像 `finally { close() }`。

---

#### 6. `useBoolean` / `useLoading` — 可复用的状态组合

```typescript
// packages/hooks/src/use-boolean.ts
export default function useBoolean(initValue = false) {
  const bool = ref(initValue);
  function setBool(value: boolean) { bool.value = value; }
  function setTrue() { setBool(true); }
  function setFalse() { setBool(false); }
  function toggle() { setBool(!bool.value); }
  return { bool, setBool, setTrue, setFalse, toggle };
}
```

在 Store 中的使用：

```typescript
// src/store/modules/auth/index.ts
const { loading: loginLoading, startLoading, endLoading } = useLoading();

// 在 action 中
async function login(userName: string, password: string) {
  startLoading();  // 开始加载
  const { data, error } = await fetchLogin(userName, password);
  if (!error) { /* ... */ }
  endLoading();  // 结束加载
}
```

**为什么把 `useBoolean` 封装到 `@sa/hooks`？**

- 因为 `ref(false)` + 5 个操作方法在 10 个 Store 中会重复 10 次。
- 提取为 Hook 后，逻辑复用 + 类型一致 + 测试方便。

> **Java 类比**：`useBoolean` 像 Java 的 `AtomicBoolean` 包装器 + 工具方法。`useLoading` 像 `LoadingStateManager` 辅助类。

---

### Java 思维类比

| Java 概念          | Pinia 对应                                              | 类比说明                         |
|------------------|-------------------------------------------------------|------------------------------|
| `@Service` 单例    | `defineStore`                                         | 全局唯一实例，通过 `useXxxStore()` 获取 |
| `@Autowired`     | `const otherStore = useOtherStore()`                  | 构造函数/方法内注入其他 Service         |
| `@PostConstruct` | `init()` 函数 + `scope.run()`                           | 初始化逻辑在 Store 定义时执行           |
| `@PreDestroy`    | `onScopeDispose(() => scope.stop())`                  | 清理副作用，防止内存泄漏                 |
| `BeanWrapper`    | `storeToRefs` / `toRefs`                              | 将对象属性暴露为独立可监听引用              |
| `Session` 持久化    | `localStg.set()` / `useEventListener('beforeunload')` | 浏览器存储 + 页面关闭前写入              |
| `Environment`    | `import.meta.env`                                     | 读取环境变量（开发/生产）                |

### 超越类比 — 前端独有的设计哲学

> **为什么前端用 `ref` + `computed` 而不是直接 `get/set`？**
>
> Java 的 `getter/setter` 需要显式调用：`user.getName()` / `user.setName("xxx")`。
> 前端的 `ref` 在模板中自动解包（`{{ userName }}` 不需要 `.value`），在 JS 中需要显式 `.value`。
> 这种设计是为了**模板和 JS 的语义统一**：在模板中写 `{{ userName }}` 和 `{{ count }}` 是无感的，但在 JS 中必须知道它是响应式引用。
>
> **Vue 的妥协**：模板自动解包降低心智负担，JS 中显式 `.value` 保证类型安全。这是 Java 中不存在的"编译时魔法"。

> **为什么 `effectScope` 比 Spring 的 `@PreDestroy` 更强大？**
>
> Spring 的 `@PreDestroy` 是 Bean 级别的。Vue 的 `effectScope` 是**任意副作用作用域**级别的。
> 你可以在一个组件内创建多个 `effectScope`，分别管理不同模块的副作用。
> 这是前端"细粒度响应式"的必然要求——一个组件可能有多个独立的响应式数据流，每个都需要独立的生命周期管理。

> **为什么 Pinia 的 Store 可以"循环调用自身"？**
>
> ```typescript
> const authStore = useAuthStore();  // 在 useAuthStore 内部！
> ```
> 在 Java 中，构造函数里调用 `this` 的其它方法（未完全初始化）是危险的。
> 在 Pinia 的 Setup Store 中，`useAuthStore()` 在 setup 函数内部调用时，返回的是**已经初始化完成的 store 实例**（因为 Pinia 内部会缓存）。
> 但注意：如果 `resetStore` 中调用 `authStore.$reset()`，会重置状态但不会重新执行 setup 函数。这是 Pinia 的设计：`$reset` 只重置 `ref`/`reactive` 的值，不重新创建作用域。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

#### 文件 1：`src/store/modules/auth/index.ts` — Setup Store 的标杆

**阅读指引**：

1. 先看 Store 如何依赖其他 Store（`useRouteStore`, `useTabStore`）
2. 再看 `useLoading` 和 `useRouterPush` 的组合式函数注入
3. 最后看 `resetStore` 中如何调用自身和其他 Store

#### 文件 2：`src/store/modules/theme/index.ts` — 副作用管理的典范

**阅读指引**：

1. 先看 `effectScope` 的创建和使用（`scope.run()` 包裹 `watch`）
2. 再看 `onScopeDispose` 清理副作用
3. 最后看 `toRefs` 如何将 `settings` 拆分为独立响应式属性

#### 文件 3：`src/store/modules/enum.ts` — Options API 风格的对比

**阅读指引**：

1. 对比 `getters` 和 `computed` 的语法差异
2. 对比 `actions` 和 普通函数的差异
3. 思考：为什么枚举 Store 不需要 Setup Store 的复杂度？

### 规范评审清单

| 检查项         | 标准                                | `auth/index.ts` 是否达标？                        | `theme/index.ts` 是否达标？                 | `enum.ts` 是否达标？                        |
|-------------|-----------------------------------|----------------------------------------------|----------------------------------------|----------------------------------------|
| 命名规范        | 文件 kebab-case，Store `useXxxStore` | ✅ `useAuthStore`                             | ✅ `useThemeStore`                      | ✅ `useEnumStore`                       |
| 类型完整性       | 零 `any`，所有参数/返回值有类型               | ✅ `Api.Auth.UserInfo`, `Api.Auth.LoginToken` | ✅ `Ref<App.Theme.ThemeSetting>`        | ✅ `Record<string, Enum.EnumItem[]>`    |
| 目录规范        | 文件放在 `store/modules/` 下           | ✅                                            | ✅                                      | ✅                                      |
| 导入顺序        | type → 第三方 → 内部 → 相对路径            | ✅ 第1行 `import type` 在 `import` 之前            | ✅                                      | ⚠️ 无 `import type`，但顺序正确               |
| 错误处理        | 所有异步有 `try/catch` 或统一拦截           | ✅ `if (!error) { ... }`                      | ✅ 路由错误触发 `authStore.resetStore()`      | ✅ `if (!error && data)`                |
| 可测试性        | 纯函数可单测，副作用可 mock                  | ✅ `loginByToken` 纯逻辑                         | ✅ `setThemeScheme` 纯函数                 | ✅ `loadEnum` 可 mock `fetchGetEnumInfo` |
| 国际化         | 用户可见字符串使用 `$t()`                  | ✅ `$t('page.login.common.loginSuccess')`     | ❌ 无用户可见字符串                             | ✅ 无用户可见字符串                             |
| 副作用管理       | `watch` 放入 `effectScope`          | N/A（无 `watch`）                               | ✅ `scope.run()` + `onScopeDispose`     | N/A                                    |
| 持久化         | 敏感数据用 `localStg`/`sessionStg`     | ✅ `localStg.set('token', ...)`               | ✅ `localStg.set('themeSettings', ...)` | ❌ 无持久化（设计如此）                           |
| Store ID 枚举 | 使用 `SetupStoreId` 枚举              | ✅ `SetupStoreId.Auth`                        | ✅ `SetupStoreId.Theme`                 | ✅ `SetupStoreId.Enum`                  |

**评审结论**：

- `auth/index.ts`：标杆级 Store，展示了完整的跨 Store 通信、异步 action、错误处理、持久化。
- `theme/index.ts`：副作用管理典范，`effectScope` + `toRefs` 的组合值得学习。
- `enum.ts`：简单场景用 Options API 是正确的选择，但注意 `actions` 中 `this.cache` 的类型推断不如 Setup Store 强。

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**目标**：实现一个 `useUserSettingsStore`，包含以下功能：

1. 用户偏好设置（主题、语言、侧边栏折叠状态）
2. 设置持久化（`localStorage`，仅生产环境）
3. 跨 Store 通信：当语言变化时，通知 `useRouteStore` 更新菜单
4. 副作用管理：监听窗口大小变化，自动折叠侧边栏

**拆解为 4 个小任务**：

1. 定义状态结构（`ref` + `reactive`）
2. 实现 `effectScope` 管理副作用（窗口大小监听 + 自动折叠）
3. 实现持久化逻辑（即时写入 + `beforeunload` 双保险）
4. 实现跨 Store 通信（语言变化时更新路由菜单）

### 第二步：小任务开发

#### 任务 1：状态结构定义

```typescript
// src/store/modules/user-settings/index.ts
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { SetupStoreId } from '@/enum';
import { localStg } from '@/utils/storage';

export const useUserSettingsStore = defineStore(SetupStoreId.UserSettings, () => {
  // 状态定义
  const locale = ref<App.I18n.LangType>(localStg.get('userLocale') || 'zh-CN');
  const sidebarCollapsed = ref<boolean>(localStg.get('sidebarCollapsed') || false);
  const theme = ref<'light' | 'dark' | 'auto'>('auto');

  // 派生状态
  const isDarkMode = computed(() => {
    if (theme.value === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme.value === 'dark';
  });

  return {
    locale,
    sidebarCollapsed,
    theme,
    isDarkMode
  };
});
```

**技术要点**：

- 初始值从 `localStg` 读取，实现**初始化即恢复**
- 使用 `ref` 而非 `reactive`：因为状态是分散的，不需要整体替换

#### 任务 2：`effectScope` 管理副作用

```typescript
import { effectScope, onScopeDispose, watch } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useRouteStore } from '../route';

export const useUserSettingsStore = defineStore(SetupStoreId.UserSettings, () => {
  const scope = effectScope();
  const routeStore = useRouteStore();

  // ... 状态定义 ...

  // 副作用 1：监听窗口大小变化，自动折叠侧边栏
  scope.run(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');

    watch(
      () => mediaQuery.matches,
      isMobile => {
        sidebarCollapsed.value = isMobile;
      },
      { immediate: true }
    );
  });

  // 副作用 2：语言变化时更新菜单
  scope.run(() => {
    watch(locale, () => {
      routeStore.updateGlobalMenusByLocale();
    });
  });

  // 副作用 3：页面关闭前持久化
  useEventListener(window, 'beforeunload', () => {
    localStg.set('userLocale', locale.value);
    localStg.set('sidebarCollapsed', sidebarCollapsed.value);
  });

  // 清理
  onScopeDispose(() => {
    scope.stop();
  });

  return { /* ... */ };
});
```

**技术要点**：

- `scope.run()` 包裹所有 `watch`，确保它们可以被批量清理
- `useEventListener` 来自 VueUse，会自动清理，但也可以放在 `scope.run()` 中（VueUse 的 Hook 内部也使用 `effectScope`）
- `onScopeDispose` 是 Store 的"析构函数"，在 `$reset()` 或 Store 卸载时调用

#### 任务 3：持久化逻辑（条件写入）

```typescript
function persistSettings() {
  const isProd = import.meta.env.PROD;
  if (!isProd) return;  // 开发环境不缓存

  localStg.set('userSettings', {
    locale: locale.value,
    sidebarCollapsed: sidebarCollapsed.value,
    theme: theme.value
  });
}

// 在状态变化时即时写入
scope.run(() => {
  watch([locale, sidebarCollapsed, theme], persistSettings, { deep: true });
});
```

**技术要点**：

- 用 `watch` 监听数组，实现**多状态统一持久化**
- `{ deep: true }` 确保对象属性的嵌套变化也能触发
- 条件写入：开发环境不缓存，方便调试

#### 任务 4：跨 Store 通信（语言变化更新菜单）

```typescript
// 已在任务 2 中展示，这里补充另一种模式：直接调用 action
async function changeLocale(lang: App.I18n.LangType) {
  locale.value = lang;

  // 调用其他 Store 的 action
  const routeStore = useRouteStore();
  routeStore.updateGlobalMenusByLocale();

  // 调用其他 Store 的 action
  const tabStore = useTabStore();
  tabStore.updateTabsByLocale();
}
```

**技术要点**：

- 在 Store 的 action 中直接调用其他 Store 的 action
- 这是 Pinia 的**显式依赖**模式，比 Vuex 的 `dispatch`/`commit` 更直观

### 第三步：整合与功能测试

**完整 Store 代码**：

```typescript
// src/store/modules/user-settings/index.ts
import { computed, effectScope, onScopeDispose, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useEventListener } from '@vueuse/core';
import { SetupStoreId } from '@/enum';
import { localStg } from '@/utils/storage';
import { useRouteStore } from '../route';
import { useTabStore } from '../tab';

export const useUserSettingsStore = defineStore(SetupStoreId.UserSettings, () => {
  const scope = effectScope();
  const routeStore = useRouteStore();
  const tabStore = useTabStore();

  // State
  const locale = ref<App.I18n.LangType>(localStg.get('userLocale') || 'zh-CN');
  const sidebarCollapsed = ref<boolean>(localStg.get('sidebarCollapsed') || false);
  const theme = ref<'light' | 'dark' | 'auto'>('auto');

  // Getters
  const isDarkMode = computed(() => {
    if (theme.value === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme.value === 'dark';
  });

  // Actions
  function setLocale(lang: App.I18n.LangType) {
    locale.value = lang;
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  function setTheme(mode: 'light' | 'dark' | 'auto') {
    theme.value = mode;
  }

  // 持久化
  function persistSettings() {
    const isProd = import.meta.env.PROD;
    if (!isProd) return;

    localStg.set('userSettings', {
      locale: locale.value,
      sidebarCollapsed: sidebarCollapsed.value,
      theme: theme.value
    });
  }

  // 副作用管理
  scope.run(() => {
    // 监听多状态变化，统一持久化
    watch([locale, sidebarCollapsed, theme], persistSettings, { deep: true });

    // 语言变化时更新菜单和标签页
    watch(locale, () => {
      routeStore.updateGlobalMenusByLocale();
      tabStore.updateTabsByLocale();
    });
  });

  // 页面关闭前写入
  useEventListener(window, 'beforeunload', () => {
    localStg.set('userLocale', locale.value);
    localStg.set('sidebarCollapsed', sidebarCollapsed.value);
  });

  onScopeDispose(() => {
    scope.stop();
  });

  return {
    locale,
    sidebarCollapsed,
    theme,
    isDarkMode,
    setLocale,
    toggleSidebar,
    setTheme
  };
});
```

**调试及错误排查思路**：

1. **响应式丢失**：如果组件中 `const { locale } = useUserSettingsStore()` 不更新，检查是否使用了 `storeToRefs`
2. **副作用未清理**：如果 `$reset()` 后 `watch` 还在触发，检查 `scope.stop()` 是否被正确调用
3. **循环依赖**：如果两个 Store 互相 `useXxxStore()`，会导致调用栈溢出。检查依赖方向是否单向
4. **持久化未生效**：检查 `import.meta.env.PROD` 是否正确，开发环境默认 `false`

### 验收标准

- [ ] **能用**：Store 定义成功，组件中可读取状态，语言变化时菜单和标签页更新
- [ ] **规范**：`pnpm typecheck` 通过（`App.I18n.LangType` 类型已定义），`pnpm lint` 通过
- [ ] **精进**：
    - [ ] 使用 `effectScope` 管理所有副作用
    - [ ] 使用 `storeToRefs` 在组件中解构 Store
    - [ ] 持久化区分开发/生产环境
    - [ ] 跨 Store 通信时检查对方 Store 是否存在

---

## 今日重点记忆卡

| 概念               | 一句话                                    | Java类比                         | 前端独有                                 |
|------------------|----------------------------------------|--------------------------------|--------------------------------------|
| `storeToRefs`    | 解构 Store 响应式属性不丢失响应性                   | `BeanWrapper` 属性暴露             | 自动区分 `ref`/`reactive`/`computed`     |
| `effectScope`    | 批量管理副作用的生命周期                           | `try-with-resources` 作用域       | 可嵌套、可手动 `stop()`，比组件生命周期更灵活          |
| `onScopeDispose` | 作用域销毁时的回调                              | `@PreDestroy`                  | 不仅用于组件，用于任意副作用作用域                    |
| `toRefs`         | 将 `reactive` 对象拆为独立 `ref`              | `BeanUtils.copyProperties`     | 保留深层响应性，修改任意 ref 都会触发原对象更新           |
| Setup Store      | 用 `ref`/`computed`/`watch` 定义 Store    | `@Service` + 构造函数注入            | 可直接使用 VueUse Hooks 和自定义 Composables  |
| Options Store    | 用 `state`/`getters`/`actions` 定义 Store | `@Service` + 注解配置              | 简单场景更简洁，但类型推导较弱                      |
| 跨 Store 调用       | 在 Store 中 `useOtherStore()` 获取实例       | `@Autowired` 跨 Service 调用      | 无循环依赖检测，需手动设计依赖方向                    |
| 持久化              | `localStorage` + `beforeunload` 双保险    | `Session` 持久化 + `ShutdownHook` | 浏览器提供 `beforeunload` 事件，是前端特有的"优雅关闭" |

---

## 明日预告

**第25天：Ant Design Vue 基础 — 表单组件与表格组件**

我们将进入第三阶段的核心库实战，从 Pinia 的状态管理转向 UI 组件的实际使用。明天会阅读 `src/views/manage/user/index.vue` 中的表格和分页实现，学习 `a-table` + `a-pagination` 的基础用法，并动手封装一个带分页的数据表格组件。

---

> **课后思考**：`useAuthStore` 的 `resetStore` 方法中调用了 `authStore.$reset()`，这会导致 `effectScope` 被清理吗？如果会，为什么 `theme` 的 `watch` 还能继续工作？（提示：Pinia 的 `$reset` 对 Setup Store 和 Options Store 的行为不同。）

> **朱军专属建议**：今天的内容是你从"会用 Pinia"到"精通 Pinia"的分水岭。`effectScope` 和 `storeToRefs` 是面试高频题，也是 carlos-ui 源码中最优雅的部分。建议你今晚花 10 分钟，在白纸上画出 `useAuthStore` → `useRouteStore` → `useTabStore` 的调用关系图，加深理解。
