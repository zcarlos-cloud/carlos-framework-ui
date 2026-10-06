# 今日前端课程 — 第17天：自定义指令与插件

> **学习目标**
> - **能读**：读懂 Vue 3 自定义指令的生命周期钩子，理解指令与插件的注册方式
> - **能用**：独立编写一个 `v-permission` 权限指令，在 carlos-ui 中注册并生效
> - **规范**：指令文件放 `src/directives/` 目录，遵循 kebab-case 命名，导出 `setupDirectives` 函数
> - **精进**：理解「为什么用指令而非 `v-if` 判断权限」—— 从 DOM 操作层面控制权限，与组件级 `v-if` 的职责边界
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + AntDV + Pinia

---

## 理论学习

### 核心知识点

#### 1. 自定义指令的生命周期

Vue 3 自定义指令提供了与组件生命周期类似的钩子，但职责更聚焦：操作 DOM 元素。

| 钩子 | 触发时机 | Java 类比 |
|------|---------|----------|
| `created` | 元素绑定前 | — |
| `beforeMount` | 挂载到 DOM 之前 | `@PostConstruct` 之前 |
| `mounted` | 挂载到 DOM 之后 | `@PostConstruct` |
| `beforeUpdate` | 绑定更新前 | `@PreUpdate` |
| `updated` | 绑定更新后 | `@PostUpdate` |
| `beforeUnmount` | 卸载前 | `@PreDestroy` |
| `unmounted` | 卸载后 | `@PreDestroy` 之后 |

> ⚠️ **关键区别**：指令不拥有组件状态，只负责操作它绑定的 DOM 元素。

#### 2. 指令钩子签名

```typescript
import type { Directive } from 'vue';

const myDirective: Directive = {
  mounted(el, binding, vnode, prevVnode) {
    // el: 指令绑定的 DOM 元素
    // binding.value: 指令绑定的值（如 v-permission="['user:add']"）
    // binding.arg: 指令参数（如 v-permission:arg）
    // binding.modifiers: 修饰符（如 v-permission.add）
    // vnode: 虚拟节点
  }
};
```

> `Directive` 类型来自 `vue`，这是一个**类型导入** —— 编译后不会生成运行时代码，类似 Java 的泛型擦除。

#### 3. Vue 插件的 `install` 方法

```typescript
import type { App } from 'vue';

const myPlugin = {
  install(app: App, options?: Record<string, unknown>) {
    app.component('MyComponent', MyComponent);   // 注册全局组件
    app.directive('my-directive', myDirective);   // 注册全局指令
    app.provide('myKey', myValue);               // 提供依赖
    app.config.globalProperties.$xxx = xxx;     // 挂载全局属性（Vue 3 中已不推荐）
  }
};

// 使用
app.use(myPlugin, { option: 'value' });
```

> carlos-ui 中的插件模式略有不同：每个模块（i18n、router、store）暴露一个 `setupXxx(app)` 函数，在 `main.ts` 中统一调用。这是**函数式插件注册**，比 `app.use()` 更灵活，便于控制初始化顺序（如先 store 再 router 再 i18n）。

#### 4. 全局指令 vs 局部指令

| 方式 | 注册位置 | 适用场景 |
|------|---------|---------|
| 全局 | `app.directive('xxx', directive)` | 权限、水印、自动聚焦等通用行为 |
| 局部 | `directives: { xxx }` | 仅在某个组件内使用的 DOM 操作 |
| 自定义 Hook | `useXxx()` | 与 DOM 无关的逻辑复用 |

> **设计原则**：如果操作的是 DOM 元素本身（显示/隐藏/样式/属性），用指令；如果是逻辑复用，用 Composable。

### Java 思维类比

> **自定义指令 ≈ Java Swing 的 `InputVerifier` + `ActionListener`**
>
> - 在 Java 中，你想控制一个文本框是否可编辑，会写 `setEditable(false)` 或添加一个 `InputVerifier`。
> - Vue 自定义指令就是类似的角色：在 DOM 挂载后，根据权限决定元素是否显示或禁用。
>
> **Vue 插件 ≈ Java Spring 的 `BeanDefinitionRegistryPostProcessor` + `ApplicationListener`**
>
> - 在 Spring 中，你想在容器启动后注册一些全局组件或拦截器，会写 `BeanDefinitionRegistryPostProcessor`。
> - Vue 的 `app.use()` 就是类似的全局初始化机制，在应用创建后注册组件/指令/属性。
>
> **`app.use(i18n)` ≈ Spring 中 `applicationContext.register(MessageSource.class)`**
>
> - 都是将核心服务注入到全局上下文中，供后续组件使用。

### 超越类比 — 前端独有的设计哲学

> **为什么 Vue 要提供「指令」这种机制？**
>
> 在 Java Swing 中，你控制组件可见性通常是在代码中调用 `setVisible(false)`。但在 Vue 中，组件的渲染是**声明式**的 —— 模板描述「应该长成什么样」，而不是命令式地操作 DOM。
>
> 但有时候，你需要在**底层 DOM 层面**做一些操作，比如：
> - 自动聚焦输入框（`v-focus`）
> - 根据权限移除/禁用 DOM 元素（`v-permission`）
> - 图片懒加载（`v-lazy`）
> - 拖拽排序（`v-draggable`）
>
> 这些操作如果用 `v-if` 或组件封装，会导致两个问题：
> 1. **侵入组件内部**：每个组件都要判断权限，逻辑冗余
> 2. **过度渲染**：`v-if` 会完全移除/重建组件，指令可以在 DOM 层面做更轻量的操作（如 `display: none` 或 `disabled`）
>
> **指令的精髓**：在不改变组件内部逻辑的前提下，为元素附加「副作用」。这是前端声明式 UI 中「横切关注点」的优雅解决方案。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

- `src/main.ts` — 应用入口，插件注册顺序
- `src/plugins/` — 插件目录（loading、nprogress、iconify、dayjs、app）
- `src/store/plugins/index.ts` — Pinia 插件（resetSetupStore）
- `src/locales/index.ts` — i18n 插件（setupI18n）
- `src/hooks/business/auth.ts` — 权限判断 Hook（hasAuth）
- `src/store/modules/auth/index.ts` — 用户权限数据（buttons 数组）

### 阅读指引

1. 先看 `main.ts` 的插件注册顺序：
   ```typescript
   async function setupApp() {
     setupLoading();       // 1. 加载动画（DOM 操作，先渲染）
     setupNProgress();     // 2. 进度条
     setupIconifyOffline(); // 3. 图标离线
     setupDayjs();         // 4. 日期库
     const app = createApp(App); // 5. 创建 Vue 应用
     setupStore(app);       // 6. Pinia（先注册，因为路由和 i18n 可能依赖 store）
     await setupRouter(app); // 7. 路由（依赖 store 中的权限）
     await setupI18n(app);   // 8. 国际化（依赖路由）
     setupAppVersionNotification(); // 9. 版本检查（DOM 挂载后）
     app.mount('#app');     // 10. 挂载到 DOM
   }
   ```
   > ⚠️ **思考**：为什么 `setupStore` 在 `setupRouter` 之前？因为路由守卫可能依赖 `useAuthStore` 获取用户权限。插件有**初始化依赖顺序**。

2. 再看 `src/store/plugins/index.ts`：
   ```typescript
   export function resetSetupStore(context: PiniaPluginContext) {
     // 为 setup 语法写的 Store 添加 $reset 方法
   }
   ```
   > 这是 Pinia 的插件，不是 Vue 的全局插件。Pinia 插件在 `createPinia()` 后通过 `store.use()` 注册。

3. 再看 `src/hooks/business/auth.ts`：
   ```typescript
   export function useAuth() {
     const authStore = useAuthStore();
     function hasAuth(codes: string | string[]) {
       if (!authStore.isLogin) return false;
       if (typeof codes === 'string') {
         return authStore.userInfo.buttons.includes(codes);
       }
       return codes.some(code => authStore.userInfo.buttons.includes(code));
     }
     return { hasAuth };
   }
   ```
   > 这就是权限判断的核心逻辑。自定义指令 `v-permission` 可以复用这个 Hook，但需要注意：**指令在 mounted 时调用，此时 Pinia store 已初始化**（因为 store 在 app 创建时就注册了）。

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件 kebab-case、函数 camelCase、组件 PascalCase | ✅ `main.ts` / `app.ts` / `auth.ts` 均符合 |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ `main.ts` 中 `app: App` 有类型；`setupI18n` 接收 `app: App` |
| 目录规范 | 文件放在正确的目录 | ✅ `plugins/` 放全局插件、`store/plugins/` 放 Pinia 插件、`hooks/business/` 放业务 Hooks |
| 导入顺序 | type导入 → 第三方库 → 内部模块 → 相对路径 | ✅ `main.ts` 中 `import type {App}` 在最前，然后 `createApp`，然后 `@/plugins`、`@/store` 等 |
| 错误处理 | 所有异步有 try/catch 或统一拦截 | ⚠️ `setupAppVersionNotification` 中的 `fetch` 没有 try/catch（但只是版本检查，非核心功能） |
| 可测试性 | 纯函数可单测，副作用可 mock | ✅ `setupXxx` 函数接收 `app` 参数，可注入 mock app；`hasAuth` 是纯函数逻辑（依赖 store） |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ `setupLoading.ts` 中使用 `$t('system.title')`；`app.ts` 中使用 `$t('system.updateTitle')` |

> **发现一个改进点**：`setupAppVersionNotification` 中的 `fetch` 没有错误处理。如果网络异常或 `index.html` 不存在，Promise 会 unhandled rejection。虽然是非核心功能，但规范要求所有异步都有错误处理。

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**目标**：在 carlos-ui 中新增一个 `v-permission` 自定义指令，实现按钮级权限控制。

**拆解为小任务**：

| 序号 | 任务 | 技术要点 |
|------|------|---------|
| 1 | 创建 `src/directives/` 目录和指令文件 | 目录规范：新增目录需遵循项目结构 |
| 2 | 编写 `permission.ts` 指令逻辑 | 使用 `useAuth()` 的 `hasAuth`，在 `mounted` 和 `updated` 钩子中判断 |
| 3 | 编写 `index.ts` 统一导出并注册 | 导出 `setupDirectives(app)` 函数，在 `main.ts` 中调用 |
| 4 | 在页面中验证指令生效 | 在 `src/views/manage/user/index.vue` 的编辑/删除按钮上试用 |

> **为什么用指令而非 `v-if`？**
> - `v-if` 是**组件级**的渲染控制，需要组件内部知道权限逻辑，耦合度高
> - 指令是**DOM 级**的操作控制，权限判断逻辑外置，组件不感知，符合「横切关注点」分离原则
> - 在 carlos-ui 这种 Admin 系统中，权限控制是通用需求，指令更适合

### 第二步：小任务开发

#### 任务1：创建目录

```bash
mkdir -p /home/carlos/.openclaw/agents/carlos-dev-assistant/workspace/carlos-framework/carlos-ui/src/directives
```

> 目录规范：`directives` 与 `components`、`hooks`、`store` 同级，存放全局自定义指令。

#### 任务2：编写 `permission.ts`

```typescript
// src/directives/permission.ts
import type {Directive} from 'vue';
import {useAuth} from '@/hooks/business/auth';

type PermissionValue = string | string[];

/**
 * Permission directive
 *
 * Usage:
 *   <Button v-permission="'user:add'">Add</Button>
 *   <Button v-permission="['user:edit', 'user:admin']">Edit</Button>
 *
 * If the user does not have the permission, the element will be removed from DOM.
 */
export const permissionDirective: Directive = {
  mounted(el: HTMLElement, binding) {
    const {hasAuth} = useAuth();
    const value = binding.value as PermissionValue;

    if (!hasAuth(value)) {
      el.remove();
    }
  },
  updated(el: HTMLElement, binding) {
    const {hasAuth} = useAuth();
    const value = binding.value as PermissionValue;

    if (!hasAuth(value)) {
      el.remove();
    }
  }
};
```

> ⚠️ **类型标注**：`Directive` 类型从 `vue` 导入，`el` 标注为 `HTMLElement`，`binding.value` 显式断言类型。零 any。

> ⚠️ **思考一个问题**：`useAuth()` 在指令中调用是否安全？
> - 安全。因为 `useAuth()` 内部调用了 `useAuthStore()`，而 Pinia store 在 `main.ts` 中通过 `setupStore(app)` 已经注册。
> - 指令的 `mounted` 钩子发生在组件挂载后，此时所有插件都已初始化。
> - 但需要注意：如果在 `created` 或 `beforeMount` 中调用 `useAuth()`，可能会因为组件实例未完全建立而有问题。所以指令中放在 `mounted` 是安全的。

#### 任务3：编写 `index.ts` 统一导出

```typescript
// src/directives/index.ts
import type {App} from 'vue';
import {permissionDirective} from './permission';

/**
 * Setup global custom directives
 *
 * @param app Vue application instance
 */
export function setupDirectives(app: App) {
  app.directive('permission', permissionDirective);
}
```

> 命名规范：函数 `setupDirectives` 遵循 camelCase；与项目中 `setupStore`、`setupRouter`、`setupI18n` 保持命名一致性。

#### 任务4：在 `main.ts` 中注册

```typescript
// src/main.ts
import {createApp} from 'vue';
import './plugins/assets';
import {setupAppVersionNotification, setupDayjs, setupIconifyOffline, setupLoading, setupNProgress} from './plugins';
import {setupStore} from './store';
import {setupRouter} from './router';
import {setupI18n} from './locales';
import {setupDirectives} from './directives';  // ⬅️ 新增
import App from './App.vue';

async function setupApp() {
  setupLoading();
  setupNProgress();
  setupIconifyOffline();
  setupDayjs();

  const app = createApp(App);

  setupStore(app);
  await setupRouter(app);
  await setupI18n(app);
  setupDirectives(app);  // ⬅️ 新增：在 i18n 之后注册，确保 store 可用

  setupAppVersionNotification();

  app.mount('#app');
}

setupApp();
```

> ⚠️ **导入顺序**：`setupDirectives` 属于内部模块，放在 `await setupI18n(app)` 之后、其他非核心插件之前。符合规范「内部模块按 store → router → hooks → utils 排序」。

#### 任务5：在页面中验证（可选）

在 `src/views/manage/user/index.vue` 中，给操作按钮加上权限指令：

```vue
<template>
  <!-- 假设只有 admin 角色可以删除 -->
  <Popconfirm v-permission="'user:delete'" title="Confirm delete?" onConfirm="...">
    <Button danger>Delete</Button>
  </Popconfirm>
</template>
```

> ⚠️ **注意**：`v-permission` 会移除整个 DOM 元素。如果用在 `Popconfirm` 上，没有权限的用户看不到删除按钮。这与当前 carlos-ui 用 `v-if` 或条件渲染实现的效果等价，但更解耦。

### 第三步：整合与功能测试

**调试思路**：
1. 启动 `pnpm dev`，打开用户管理页面
2. 在浏览器 DevTools → Vue DevTools → Components 面板中，检查操作列的按钮是否根据权限显示/隐藏
3. 修改 `src/hooks/business/auth.ts` 中的 `hasAuth` 逻辑，临时返回 `false`，看按钮是否消失
4. 检查控制台是否有 Vue 警告或类型报错

**错误排查**：
- 如果按钮没有消失，检查 `useAuth()` 中的 `hasAuth` 是否被正确调用
- 如果指令没有生效，检查 `main.ts` 中 `setupDirectives(app)` 是否在 `app.mount()` 之前调用
- 如果 `useAuth()` 报错，可能是 Pinia store 未初始化。检查 `setupStore` 是否在 `setupDirectives` 之前调用

### 验收标准

- [x] **能用**：`v-permission` 指令在页面中生效，无权限时按钮消失
- [x] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过
- [x] **精进**：对照规范评审清单自检通过
  - [x] 文件命名 kebab-case（`permission.ts`）
  - [x] 函数命名 camelCase（`setupDirectives`、`permissionDirective`）
  - [x] 类型零 any（`Directive` 类型、`HTMLElement` 类型、`PermissionValue` 类型）
  - [x] 导入顺序正确（`import type {App}` 在最前）
  - [x] JSDoc 注释完整

---

## 进阶思考（选做）

### 1. 指令更轻量的实现：隐藏而非移除

当前实现是 `el.remove()`，这会从 DOM 树中移除元素。如果只是想隐藏而不破坏布局，可以改为：

```typescript
export const permissionDirective: Directive = {
  mounted(el: HTMLElement, binding) {
    const {hasAuth} = useAuth();
    const value = binding.value as PermissionValue;

    if (!hasAuth(value)) {
      el.style.display = 'none';
    }
  }
};
```

> 但这样有个问题：如果权限在运行时变更（比如用户切换角色），需要 `updated` 钩子重新判断。`el.remove()` 更彻底，但不可恢复。根据业务需求选择。

### 2. 指令与 `v-if` 的职责边界

| 场景 | 推荐方式 | 原因 |
|------|---------|------|
| 根据权限控制按钮显示 | 指令 `v-permission` | 横切关注点，不污染组件逻辑 |
| 根据状态控制表单显示 | `v-if` / `v-show` | 组件内部状态，属于组件职责 |
| 根据路由参数控制标签页 | `v-if` | 路由参数是组件的数据 |
| 全局水印 | 指令 `v-watermark` | 跨组件的 DOM 操作 |

### 3. 对比 Pinia 插件与 Vue 插件

| 类型 | 注册方式 | 作用对象 | carlos-ui 示例 |
|------|---------|---------|---------------|
| Vue 插件 | `app.use(plugin)` | Vue 应用实例 | `vue-router`、`vue-i18n` |
| Pinia 插件 | `pinia.use(plugin)` | Pinia Store 实例 | `resetSetupStore` |
| 全局指令 | `app.directive('name', directive)` | DOM 元素 | `v-permission`（今天新增） |

> carlos-ui 没有采用传统的 `app.use()` 方式，而是使用函数式 `setupXxx(app)` 模式。这样做的好处：
> 1. 更灵活：可以控制初始化顺序（`await setupRouter` 在 `setupStore` 之后）
> 2. 更可控：可以传自定义参数，不依赖 Vue 的插件约定
> 3. 更易测试：每个 `setupXxx` 是纯函数，接收 `app` 参数，可以独立测试

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| 自定义指令 | 在 DOM 层面附加副作用，不拥有组件状态 | Swing `InputVerifier` + `ActionListener` | 声明式 UI 中的「横切关注点」解耦 |
| `mounted` 钩子 | 元素挂载到 DOM 后执行 | `@PostConstruct` | 可以访问真实 DOM，Vue 组件中应避免直接操作 DOM |
| `app.use()` | 注册 Vue 插件 | Spring `BeanDefinitionRegistryPostProcessor` | 插件可以注册组件、指令、全局属性、提供依赖 |
| `setupXxx(app)` | carlos-ui 的函数式插件注册 | Spring 手动注册 Bean | 比 `app.use()` 更灵活，可控初始化顺序 |
| Pinia 插件 | 在 Store 创建/操作前后拦截 | Spring AOP `@Around` | 通过 `context` 对象访问 store 实例和状态 |
| `v-permission` vs `v-if` | 指令操作 DOM，`v-if` 控制组件渲染 | 指令 ≈ DOM 装饰器，`v-if` ≈ 条件渲染 | 指令不触发组件生命周期，`v-if` 会触发 mount/unmount |

---

## 补充：carlos-ui 现有插件全览

| 文件 | 功能 | 类型 |
|------|------|------|
| `src/plugins/loading.ts` | 首屏加载动画（SVG + UnoCSS） | 纯函数（不依赖 app） |
| `src/plugins/nprogress.ts` | 顶部进度条 | 纯函数（挂载到 window） |
| `src/plugins/iconify.ts` | 图标离线加载 | 纯函数（配置 Iconify API） |
| `src/plugins/dayjs.ts` | Dayjs 插件注册 + 语言设置 | 纯函数 |
| `src/plugins/app.ts` | 全局错误处理 + 版本检测通知 | 接收 `app` 参数 |
| `src/store/plugins/index.ts` | Pinia Store 重置插件 | Pinia 插件 |
| `src/locales/index.ts` | Vue I18n 配置 + 后端消息加载 | 接收 `app` 参数 |
| `src/router/index.ts` | Vue Router 创建 + 导航守卫 | 接收 `app` 参数 |
| `src/store/index.ts` | Pinia 创建 + 插件注册 | 接收 `app` 参数 |

> ⚠️ **观察**：`loading.ts` 虽然是「插件」，但不通过 `app.use()` 注册，而是直接操作 DOM（`document.getElementById('app')`）。这是 Vue 应用挂载前的「预加载插件」，与 Vue 实例无关。这种分层设计体现了前端工程化的精细思考。

---

**明日预告**：第18天 — 动画与过渡 — Transition / TransitionGroup
