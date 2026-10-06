# 今日前端课程 — 第23天：Pinia 状态管理 — 新一代的 Vuex

> **学习目标**
> - **能读**：读懂 `carlos-framework-ui` 中 5 个 Store 的职责划分和交互关系，理解为什么 auth store 要持有 route store 和 tab store 的引用
> - **能用**：用 Composition API 风格定义一个 Pinia Store，包含 `ref` 状态、`computed` 派生状态和 `async` Action
> - **规范**：Store ID 使用枚举、`useXxxStore` 命名、`import type` 在前、在 `defineStore` 返回中显式导出所有状态和方法
> - **精进**：理解 `effectScope` 管理 Store 副作用生命周期，理解 `$reset()` 的实现原理，理解跨 Store 依赖的循环引用风险
    > ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + Pinia 3 + VueUse

---

## 理论学习

### 核心知识点

#### 1. 为什么 Vue 3 用 Pinia 而不是 Vuex？

| 对比维度   | Vuex 4                                         | Pinia 3                                  |
|--------|------------------------------------------------|------------------------------------------|
| API 风格 | Options API（`state/getters/mutations/actions`） | Composition API（`ref/computed/function`） |
| 类型支持   | 需要复杂类型封装                                       | 原生 TypeScript 友好                         |
| 模块化    | `modules` + `namespaced`                       | 每个 Store 天然独立                            |
| 体积     | ~1.5KB                                         | ~1KB                                     |
| 开发体验   | 需要 `mapState/mapActions`                       | 直接 `useXxxStore()` 调用                    |

> **一句话**：Pinia 就是 Vuex 的 Composition API 重写版。它取消了 `mutations`（直接修改 `state`），取消了 `modules` 嵌套（每个 Store 一个文件），类型系统开箱即用。

#### 2. Pinia 的两种定义风格

```typescript
// 风格 A：Options API（Vuex 老用户熟悉）
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: {
    double: (state) => state.count * 2
  },
  actions: {
    increment() {
      this.count++;  // 有 this，像 Vuex
    }
  }
});

// 风格 B：Composition API（carlos-framework-ui 统一使用）
export const useCounterStore = defineStore('counter', () => {
  // State
  const count = ref(0);

  // Getter
  const double = computed(() => count.value * 2);

  // Action
  function increment() {
    count.value++;
  }

  return { count, double, increment };
});
```

**carlos-framework-ui 强制使用风格 B**，原因：

1. 与 Vue 3 `<script setup>` 语法一致，心智负担最小
2. 类型推导最自然，无需额外类型标注
3. 可以在 Store 内使用 `watch`、`onScopeDispose` 等 Vue 生命周期

#### 3. 跨 Store 依赖 — 如何在 Store A 中调用 Store B？

```typescript
// src/store/modules/auth/index.ts（真实代码）
export const useAuthStore = defineStore(SetupStoreId.Auth, () => {
  // 在 Store 内部直接实例化其他 Store
  const routeStore = useRouteStore();
  const tabStore = useTabStore();

  async function resetStore() {
    // 登出时：清理 auth → 清理 tab → 清理 route
    tabStore.cacheTabs();
    routeStore.resetStore();
  }

  return { resetStore };
});
```

> ⚠️ **注意**：在 Store 内部调用 `useXxxStore()` 是合法的，但要避免循环依赖（A 依赖 B，B 又依赖 A）。
> carlos-framework-ui 中 auth → route → tab 的依赖链是单向的，这是刻意设计。

#### 4. `effectScope` — Store 的副作用管理器

```typescript
// src/store/modules/app/index.ts（真实代码）
export const useAppStore = defineStore(SetupStoreId.App, () => {
  const scope = effectScope();

  scope.run(() => {
    watch(isMobile, newValue => {
      // 移动端自动折叠侧边栏
      if (newValue) {
        setSiderCollapse(true);
      }
    }, { immediate: true });
  });

  onScopeDispose(() => {
    scope.stop();  // Store 被销毁时自动停止所有 watch
  });

  return { ... };
});
```

| 概念                 | 说明                                      |
|--------------------|-----------------------------------------|
| `effectScope`      | 创建一个副作用作用域，可以批量管理 `watch`、`computed` 等  |
| `scope.run()`      | 在作用域内运行副作用，统一收集                         |
| `scope.stop()`     | 停止作用域内所有副作用，避免内存泄漏                      |
| `onScopeDispose()` | 当 Store 被销毁时回调，类似 Vue 组件的 `onUnmounted` |

> **Java 类比**：`effectScope` ≈ Java 的 `ExecutorService` + `shutdown()`，统一管理一组后台任务的生命周期。

#### 5. `$reset()` — 状态重置的实现

Pinia 的 `$reset()` 会将 `state` 恢复到初始值。在 Composition API 风格中，`$reset()` 只能重置 `ref` 和 `reactive` 的初始值，**不会重新执行 `setup` 函数**。

```typescript
// carlos-framework-ui 中的实际做法：手动 reset + 调用 $reset
async function resetStore() {
  const authStore = useAuthStore();

  clearAuthStorage();      // 手动清理 localStorage
  authStore.$reset();      // Pinia 重置 ref/reactive 到初始值

  // 额外清理其他 Store
  routeStore.resetStore();
}
```

> 关键发现：`$reset()` 不会触发 `onScopeDispose`，所以如果你手动分配了事件监听器，需要自己在 `resetStore()` 中清理。

### Java 思维类比

| 前端概念                      | Java 类比                        | 说明             |
|---------------------------|--------------------------------|----------------|
| Pinia Store               | Spring `@Service` 单例           | 全局唯一实例，跨组件共享状态 |
| `defineStore`             | `@Service` + `@PostConstruct`  | 定义 + 初始化逻辑     |
| `ref()` / `reactive()`    | 类的实例字段                         | Store 的数据状态    |
| `computed()`              | `getter` 方法                    | 派生状态，自动缓存      |
| `async function` in Store | `@Transactional` 业务方法          | 异步操作 + 状态变更    |
| `useXxxStore()`           | `ApplicationContext.getBean()` | 获取服务实例         |
| `effectScope`             | `ExecutorService`              | 副作用生命周期管理      |
| `$reset()`                | 对象重置为初始状态                      | 状态回滚           |

### 超越类比 — 前端独有的设计哲学

> **为什么前端 Store 不需要 "mutations"？**
>
> Vue 3 的响应式系统基于 `Proxy`，任何对 `ref.value` 或 `reactive` 属性的修改都会被自动追踪。所以 Pinia 不需要 Vuex 的 `mutations`（强制同步修改）——直接修改 `ref` 即可。
>
> 但这不意味着可以随意修改。carlos-framework-ui 的规范是：**只在 Store 的 Action 中修改状态**，组件中只读或通过 Action 修改。这是一种约定，不是框架强制。
>
> Java 中没有这种响应式追踪，所以必须用 `setter` 方法或 Builder 模式来封装状态变更。

> **为什么 Store 之间可以直接互相引用？**
>
> Pinia 的 `useXxxStore()` 在组件外调用时，返回的是全局单例。这类似于 Spring 的 Bean 互相 `@Autowired`。
> 但前端没有 Spring 的循环依赖检测，需要开发者自己保证依赖链是 DAG（有向无环图）。

> **为什么 `effectScope` 是必要的？**
>
> Vue 组件卸载时会自动清理组件内的 `watch` 和 `computed`。但 Store 是全局单例，不会自动卸载。
> 如果 Store 内部注册了 `watch`，当不再需要这个 Store 时（如用户登出），需要手动 `scope.stop()` 避免内存泄漏和重复执行。
> Java 中通常用 `@PreDestroy` 做类似清理，但前端没有 GC 保证的析构时机，所以 `effectScope` 是显式管理。

---

## carlos-framework-ui 源码阅读 + 规范评审

### 目标文件

- `src/store/modules/auth/index.ts` — 认证状态管理（登录、登出、用户信息）
- `src/store/modules/app/index.ts` — 应用级状态（移动端、语言、侧边栏、页面重载）
- `src/store/modules/theme/index.ts` — 主题状态（颜色、暗黑模式、布局）
- `src/store/modules/route/index.ts` — 路由状态（菜单、权限路由、缓存）
- `src/enum/index.ts` — Store ID 枚举定义
- `src/store/modules/auth/shared.ts` — Store 共享工具函数

### 阅读指引

1. **先看 `src/enum/index.ts`** — 理解所有 Store 的 ID 集中管理，避免字符串魔法值
2. **再看 `auth/index.ts`** — 最经典的 Store 结构：ref + computed + async action + 跨 Store 调用
3. **对比 `app/index.ts` 和 `theme/index.ts`** — 两者都用了 `effectScope`，观察 `scope.run()` 和 `onScopeDispose()` 的用法
4. **看 `route/index.ts`** — 最复杂的 Store，理解 `shallowRef` 用于大数据量路由列表的性能优化

### 规范评审清单

| 检查项         | 标准                                                    | 该文件是否达标？                                                                                                                         |
|-------------|-------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| 命名规范        | Store 文件 `index.ts` 在 kebab-case 目录下，导出 `useXxxStore` | ✅ `auth/index.ts` → `useAuthStore`                                                                                               |
| 类型完整性       | 零 any，所有参数/返回值有类型                                     | ✅ `token: ref<string>()` 有类型，函数参数有类型                                                                                             |
| 目录规范        | Store 放在 `store/modules/[name]/index.ts`              | ✅ 每个 Store 一个目录，可扩展 `shared.ts`                                                                                                  |
| 导入顺序        | type 导入 → 第三方库 → 内部模块 → 相对路径                          | ✅ 如 `auth/index.ts`：`import type` 无，`import {computed} from 'vue'` → `import {defineStore} from 'pinia'` → `@/enum` → `./shared` |
| 错误处理        | 所有异步有 try/catch 或错误返回值检查                              | ✅ `if (!error)` 检查，但**注意**：没有 try/catch，依赖 `request` 封装的错误处理                                                                     |
| 可测试性        | 纯函数可单测，副作用可 mock                                      | ⚠️ `localStg` 直接调用，需要 mock `localStg` 才能单测                                                                                       |
| 国际化         | 用户可见字符串使用 `$t()`                                      | ✅ `window.$notification?.success({ message: $t(...) })`                                                                          |
| Store ID 枚举 | 所有 ID 定义在 `SetupStoreId` 枚举中                          | ✅ `SetupStoreId.Auth`, `SetupStoreId.App` 等                                                                                      |
| 副作用管理       | 使用 `effectScope` 管理 watch                             | ✅ `app` 和 `theme` Store 达标，`auth` 无 watch 所以不需要                                                                                  |
| 跨 Store 依赖  | 单向依赖，无循环引用                                            | ✅ auth → route → tab，单向链                                                                                                         |

### 评审发现 — 亮点与可改进点

**亮点**：

1. `auth/index.ts` 的 `login` Action 完整封装了登录流程：请求 → 存 token → 获取用户信息 → 跳转 → 通知，这是"Fat Action"设计，组件层只调用 `login()` 即可
2. `theme/index.ts` 用 `toRefs(settings.value)` 将嵌套对象的属性展开为顶层响应式引用，便于组件解构使用
3. `route/index.ts` 使用 `shallowRef` 存储路由数组，避免深层响应式带来的性能损耗（路由对象很大且不需要深层追踪）

**可改进点**：

1. `auth/index.ts` 中 `Object.assign(userInfo, info)` 直接修改 reactive 对象，虽然有效但不如解构赋值清晰：`userInfo = reactive(info)` 会丢失响应式连接，所以 `Object.assign` 是正确的做法，但应该加注释说明原因
2. `app/index.ts` 中的 `scope.run()` 内有多个 `watch`，如果其中一个 watch 出错，其他 watch 也会受影响，建议拆分为多个 `scope` 或加错误处理

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**目标**：为 carlos-framework-ui 新增一个 `useNotificationStore`，管理全局消息通知的状态（未读数、消息列表、最后阅读时间）。

**拆解任务**：

1. 定义 Store ID 枚举常量
2. 定义消息类型接口（TypeScript 类型）
3. 创建 Store：状态 + 派生状态 + Actions
4. 在 `app/index.ts` 中初始化时加载未读消息
5. 在页面中消费 Store（显示消息徽章）

### 第二步：小任务开发

#### 任务 1：定义枚举和类型

```typescript
// src/enum/index.ts（追加）
export enum SetupStoreId {
  // ... 已有 ...
  Notification = 'notification-store'
}

// src/typings/app.d.ts（追加，如果文件不存在则创建）
declare namespace App {
  namespace Notification {
    interface Message {
      id: string;
      title: string;
      content: string;
      type: 'info' | 'warning' | 'error' | 'success';
      createTime: string;
      read: boolean;
    }
  }
}
```

> **技术要点**：枚举成员值使用 kebab-case 字符串，与 carlos-framework-ui 已有风格一致。类型声明放在 `App.Notification` 命名空间下，与其他模块隔离。

#### 任务 2：创建 Notification Store

```typescript
// src/store/modules/notification/index.ts
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { SetupStoreId } from '@/enum';
import { localStg } from '@/utils/storage';

export const useNotificationStore = defineStore(SetupStoreId.Notification, () => {
  /** 消息列表 */
  const messages = ref<App.Notification.Message[]>([]);

  /** 未读消息数 */
  const unreadCount = computed(() => messages.value.filter(m => !m.read).length);

  /** 是否有未读消息 */
  const hasUnread = computed(() => unreadCount.value > 0);

  /** 最后阅读时间 */
  const lastReadTime = ref<string>(localStg.get('notificationLastRead') || '');

  /**
   * 添加消息
   * @param message 消息对象
   */
  function addMessage(message: App.Notification.Message) {
    messages.value.unshift(message);  // 新消息在前

    // 限制最大消息数，避免内存膨胀
    if (messages.value.length > 100) {
      messages.value = messages.value.slice(0, 100);
    }
  }

  /**
   * 标记消息为已读
   * @param id 消息 ID
   */
  function markAsRead(id: string) {
    const message = messages.value.find(m => m.id === id);
    if (message) {
      message.read = true;
    }
  }

  /**
   * 标记所有为已读
   */
  function markAllAsRead() {
    messages.value.forEach(m => {
      m.read = true;
    });
    lastReadTime.value = new Date().toISOString();
    localStg.set('notificationLastRead', lastReadTime.value);
  }

  /**
   * 清空消息
   */
  function clearMessages() {
    messages.value = [];
  }

  return {
    messages,
    unreadCount,
    hasUnread,
    lastReadTime,
    addMessage,
    markAsRead,
    markAllAsRead,
    clearMessages
  };
});
```

> **技术要点**：
> 1. `unreadCount` 用 `computed` 缓存，避免每次访问都重新过滤
> 2. 消息限制 100 条，防止内存泄漏——这是前端独有的考虑，Java 服务端通常由数据库分页控制
> 3. `localStg` 用于持久化最后阅读时间，页面刷新后仍能保持状态
> 4. 所有导出状态和方法都在 `return` 中显式列出，组件中才能解构获取

#### 任务 3：在 app Store 中初始化（跨 Store 调用）

```typescript
// src/store/modules/app/index.ts（在 init 函数中追加）
import { useNotificationStore } from '../notification';

export const useAppStore = defineStore(SetupStoreId.App, () => {
  // ... 已有代码 ...

  const notificationStore = useNotificationStore();

  function init() {
    setDayjsLocale(locale.value);
    // 初始化时加载未读消息（示例：从后端获取）
    // notificationStore.loadUnreadMessages();
  }

  return {
    // ... 已有导出 ...
  };
});
```

> **技术要点**：在 `app` Store 中引用 `notification` Store 是单向依赖，不会形成循环。注意导入顺序：相对路径 `./modules/notification` 放在最后。

#### 任务 4：在组件中消费 Store

```vue
<!-- 某个头部组件中 -->
<script setup lang="ts">
import { computed } from 'vue';
import { useNotificationStore } from '@/store/modules/notification';

defineOptions({
  name: 'NotificationBadge'
});

const notificationStore = useNotificationStore();

const badgeCount = computed(() => notificationStore.unreadCount);

function handleClick() {
  notificationStore.markAllAsRead();
}
</script>

<template>
  <ABadge :count="badgeCount" :offset="[-4, 4]">
    <AButton type="text" @click="handleClick">
      <template #icon>
        <SvgIcon icon="icon-notification" />
      </template>
    </AButton>
  </ABadge>
</template>
```

> **技术要点**：
> 1. 组件中通过 `useNotificationStore()` 获取单例，所有组件共享同一状态
> 2. 使用 `computed` 从 Store 状态派生组件本地状态，保持响应式
> 3. 点击事件直接调用 Store Action，不通过 emit 或 props 层层传递

### 第三步：整合与测试

**整合关系分析**：

```
组件层 (NotificationBadge.vue)
  ↓ useNotificationStore()
Store 层 (useNotificationStore)
  ↓ ref / computed
  ↓ localStg (持久化)
  ↓ 未来：fetchGetUnreadMessages() (API 调用)
```

**调试思路**：

1. 在 Vue DevTools 的 Pinia 面板中查看 `notification-store` 的实时状态
2. 调用 `addMessage()` 后观察 `messages` 和 `unreadCount` 是否同步更新
3. 刷新页面后检查 `lastReadTime` 是否从 `localStorage` 恢复
4. 发送超过 100 条消息，验证截断逻辑是否生效

### 验收标准

- [ ] **能用**：`addMessage` / `markAsRead` / `markAllAsRead` 功能正确，Vue DevTools 中状态实时更新
- [ ] **规范**：`pnpm typecheck` 通过，无 `any` 类型；`pnpm lint` 通过；Store ID 在枚举中定义
- [ ] **精进**：`unreadCount` 使用 `computed` 缓存；消息列表限制 100 条；`localStg` 持久化最后阅读时间；所有导出显式声明在 `return` 中

---

## 今日重点记忆卡

| 概念                  | 一句话                         | Java类比                           | 前端独有                                          |
|---------------------|-----------------------------|----------------------------------|-----------------------------------------------|
| `defineStore`       | 定义一个全局状态容器                  | `@Service` + `@PostConstruct`    | 与 Vue 响应式系统深度绑定，状态变更自动触发 UI 更新                |
| `ref` in Store      | Store 中的响应式状态               | `private int count`              | 必须 `.value` 访问，组件中解构后仍保持响应式（通过 `storeToRefs`） |
| `computed` in Store | 派生状态，自动缓存                   | `getter` 方法                      | 依赖追踪自动失效，比手动缓存更精确                             |
| `effectScope`       | 批量管理副作用生命周期                 | `ExecutorService` + `shutdown()` | Store 级别的显式生命周期管理，组件卸载不自动触发                   |
| `$reset()`          | 将状态重置为初始值                   | 对象重置                             | 只重置 `ref/reactive`，不重新执行 `setup`，不清理副作用       |
| 跨 Store 依赖          | 在 Store 内直接 `useXxxStore()` | Bean 互相 `@Autowired`             | 前端无循环依赖检测，需开发者保证 DAG                          |
| `shallowRef`        | 浅层响应式引用                     | 浅拷贝对象                            | 大数据量对象（如路由列表）用 `shallowRef` 避免深层响应式性能损耗       |
| `storeToRefs`       | 从 Store 中提取响应式引用            | `BeanUtils.copyProperties`       | 解构 Store 时保持响应式，是 `toRefs` 的 Store 专用版        |

---

## 扩展思考（选做）

1. **如果 NotificationStore 需要 WebSocket 推送消息**，应该在 Store 内还是组件内建立 WebSocket 连接？为什么？
2. **如果消息列表需要从后端分页加载**，`messages` 用 `ref` 还是 `shallowRef`？为什么？
3. **对比 `auth/index.ts` 和 `theme/index.ts` 的 `resetStore` 实现**，为什么 `theme` 直接调 `$reset()`，而 `auth` 还要手动 `clearAuthStorage()`？

---

**明日预告**：第24天 — Pinia 进阶：组合式 Store、持久化、插件，以及 `storeToRefs` 的深入使用

> 📌 **课后作业**：阅读 `src/store/modules/tab/index.ts` 和 `src/store/modules/tab/shared.ts`，观察 tab store 如何与 route store 交互，以及 `shared.ts` 中纯函数的设计。思考：为什么 tab store 的某些逻辑放在 `shared.ts` 而不是直接写在 `index.ts` 中？
