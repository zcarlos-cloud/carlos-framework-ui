# 今日前端课程 — 第22天：Vue Router 4 — 前端路由管理

> **阶段过渡**：第二阶段（Vue 3 核心深入）已收官。从今天开始，我们进入**第三阶段 — 项目核心库深入**。今天的主角是 Vue Router 4：前端路由系统。作为 Java 架构师，你一定熟悉后端路由映射（`@RequestMapping`），但前端路由是一个截然不同的世界 — URL 变化不触发页面刷新，路由守卫是运行在前端浏览器中的拦截器，组件切换由 JavaScript 驱动而非服务器重新渲染。
>
> **学习目标**
> - **能读**：理解 Vue Router 4 的路由配置、导航守卫、懒加载、路由元信息
> - **能用**：能在 carlos-ui 中新增路由并配置权限守卫
> - **规范**：理解 `@elegant-router/vue` 约定式路由生成机制，遵循项目目录规范
> - **精进**：掌握路由守卫的执行顺序、动态路由加载时机、路由与 Pinia 状态联动
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue Router 4 + Vite + TS + Pinia + @elegant-router

---

## 理论学习

### 核心知识点

#### 1. Vue Router 4 核心概念

| 概念 | 说明 | Java 类比 |
|------|------|-----------|
| `createRouter()` | 创建路由器实例 | `new SpringRouter()` |
| `history` 模式 | `history` / `hash` / `memory` | URL 重写策略 |
| `routes` | 路由配置表 | `@RequestMapping` 配置 |
| `router-view` | 路由出口组件，显示匹配的组件 | `JSP <jsp:include>` / Thymeleaf `th:replace` |
| `router-link` | 声明式导航链接 | `<a href>` 标签 |
| `useRoute()` | 获取当前路由信息 | `@RequestParam` 获取请求参数 |
| `useRouter()` | 获取路由器实例，执行编程式导航 | `response.sendRedirect()` |

#### 2. 三种 History 模式

```typescript
// src/router/index.ts — 真实源码
import {createMemoryHistory, createRouter, createWebHashHistory, createWebHistory, type RouterHistory} from 'vue-router';

const {VITE_ROUTER_HISTORY_MODE = 'history', VITE_BASE_URL} = import.meta.env;

const historyCreatorMap: Record<Env.RouterHistoryMode, (base?: string) => RouterHistory> = {
  hash: createWebHashHistory,      // URL 带 #/，兼容旧浏览器，无需服务端配置
  history: createWebHistory,       // 标准 History API，需要服务端支持 fallback
  memory: createMemoryHistory      // SSR / 测试环境使用，无 URL 变化
};

export const router = createRouter({
  history: historyCreatorMap[VITE_ROUTER_HISTORY_MODE](VITE_BASE_URL),
  routes: createBuiltinVueRoutes()
});
```

**Java 思维类比**：
- `createWebHistory()` ≈ 标准 REST URL（`/users/123`），需要 Nginx/后端配置 `try_files` 回退到 `index.html`
- `createWebHashHistory()` ≈ 带锚点的 URL（`/#/users/123`），兼容性好但 URL 不够美观
- `createMemoryHistory()` ≈ 内存中的请求分发器，无真实 URL 变化，用于服务端渲染

**超越类比 — 前端独有**：
> 前端路由的本质是**欺骗浏览器**。URL 变化后，浏览器不会真正发送 HTTP 请求，而是 JavaScript 拦截 `popstate` 事件，动态切换 DOM。这是 SPA（单页应用）的核心魔法，也是前端与 Java 后端路由最根本的区别 — 后端路由是**请求分发**，前端路由是**视图切换**。

#### 3. 路由守卫（Navigation Guards）

Vue Router 4 提供三种守卫钩子，执行顺序如下：

```
导航触发
  → 全局 beforeEach（路由切换前）
    → 组件内 beforeRouteEnter（组件复用时跳过）
      → 全局 beforeResolve（组件解析后）
        → 全局 afterEach（导航完成后）
```

carlos-ui 中的守卫实现（真实源码）：

```typescript
// src/router/guard/index.ts — 守卫注册入口
export function createRouterGuard(router: Router) {
  createProgressGuard(router);       // 1. 进度条守卫
  createRouteGuard(router);          // 2. 路由权限守卫（核心）
  createDocumentTitleGuard(router);  // 3. 文档标题守卫
}
```

```typescript
// src/router/guard/progress.ts — 进度条守卫
export function createProgressGuard(router: Router) {
  router.beforeEach((_to, _from, next) => {
    window.NProgress?.start?.();     // 开始进度条
    next();                           // 放行，必须调用 next()！
  });
  router.afterEach(_to => {
    window.NProgress?.done?.();      // 结束进度条
  });
}
```

```typescript
// src/router/guard/route.ts — 路由权限守卫（核心逻辑）
router.beforeEach(async (to, from, next) => {
  const location = await initRoute(to);  // 初始化路由（动态加载）
  if (location) { next(location); return; }

  const isLogin = Boolean(localStg.get('token'));
  const needLogin = !to.meta.constant;    // 是否需登录：看路由 meta.constant
  const routeRoles = to.meta.roles || [];
  const hasAuth = !routeRoles.length || authStore.userInfo.roles.some(r => routeRoles.includes(r));

  // 守卫逻辑：
  // 1. 已登录访问登录页 → 跳首页
  if (to.name === 'login' && isLogin) { next({name: 'root'}); return; }
  // 2. 无需登录的路由 → 直接放行
  if (!needLogin) { next(); return; }
  // 3. 需登录但未登录 → 跳登录页（带 redirect 参数）
  if (!isLogin) { next({name: 'login', query: {redirect: to.fullPath}}); return; }
  // 4. 已登录但无权限 → 403
  if (!hasAuth) { next({name: '403'}); return; }
  // 5. 正常放行
  next();
});
```

**Java 思维类比**：
- `router.beforeEach` ≈ Java Servlet `Filter.doFilter()` — 链式拦截，必须调用 `next()` 放行
- `to.meta` ≈ Java 注解 `@PreAuthorize("hasRole('ADMIN')")` — 路由元信息承载权限配置
- `next({name: 'login'})` ≈ `response.sendRedirect("/login")` — 编程式重定向

**超越类比 — 前端独有**：
> 前端守卫是**异步的**！`initRoute()` 可以 `await fetchGetUserRoutes()` 动态加载后端返回的路由表。这是 Java 过滤器做不到的 — 过滤器在请求到达 Controller 前执行，但路由表是静态的。而前端路由可以在用户登录后，**异步拉取后端路由配置**，动态添加路由（`router.addRoute()`），实现真正的权限驱动路由。

#### 4. @elegant-router 约定式路由

carlos-ui 使用 `@elegant-router/vue` 插件，根据 `src/views/` 目录结构自动生成路由配置。

**路由生成规则**：
| 目录/文件 | 生成的路由 | 说明 |
|-----------|-----------|------|
| `views/home/index.vue` | `/home` | 单级路由，默认使用 `layout.base` |
| `views/manage/user/index.vue` | `/manage/user` | 多级路由，继承上级布局 |
| `views/manage/user-detail/[id].vue` | `/manage/user-detail/:id` | 动态参数，方括号转为 `:` 前缀 |
| `views/multi-menu/first/child/index.vue` | `/multi-menu/first/child` | 嵌套菜单 |

自定义路由（在 `src/router/routes/index.ts` 中补充）：

```typescript
const customRoutes: CustomRoute[] = [
  {
    name: 'exception',
    path: '/exception',
    component: 'layout.base',         // 使用 base 布局
    meta: { title: 'exception', order: 7 },
    children: [
      {
        name: 'exception_403',
        path: '/exception/403',
        component: 'view.403',        // 映射到 views/_builtin/403/index.vue
        meta: { title: 'exception_403' }
      }
    ]
  }
];
```

**Java 思维类比**：
- `@elegant-router` ≈ Spring Boot 的 `@RestController` + 包扫描自动注册 — 约定优于配置
- `views/` 目录结构 ≈ Java Controller 包路径（`com.example.controller.user`）

**超越类比 — 前端独有**：
> `@elegant-router` 不是运行时扫描，而是**构建时生成**。它在 `pnpm dev` 和 `pnpm build` 时扫描 `views/` 目录，生成 `src/router/elegant/routes.ts` 和 `imports.ts`。这是前端工程化的典型模式 — 开发时享受约定式便利，构建时产出静态配置，运行时零开销。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件
- `src/router/index.ts` — 路由器创建与初始化
- `src/router/guard/index.ts` — 守卫入口
- `src/router/guard/route.ts` — 核心路由权限守卫（150行，本日重点）
- `src/router/guard/progress.ts` — 进度条守卫
- `src/router/guard/title.ts` — 文档标题守卫
- `src/router/routes/builtin.ts` — 内置路由（根路由、404）
- `src/router/routes/index.ts` — 自定义路由 + 静态路由生成
- `src/router/elegant/transform.ts` — 路由转换器（生成代码）
- `src/hooks/common/router.ts` — 路由操作 Hook（编程式导航）
- `src/store/modules/route/index.ts` — 路由状态管理（Pinia）

### 阅读指引
1. 先看 `src/router/index.ts` 整体结构：三种 history 模式、如何挂载到 Vue 应用
2. 再看 `src/router/guard/index.ts` 守卫注册顺序：进度条 → 权限 → 标题
3. 精读 `src/router/guard/route.ts`：initRoute 的两阶段初始化（constant → auth），以及登录态判断的完整逻辑链
4. 看 `src/hooks/common/router.ts`：useRouterPush 封装了编程式导航，对比 `useRouter()` 和 `globalRouter` 的用法差异

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件 kebab-case（`route.ts`）、函数 camelCase（`createRouteGuard`）、守卫函数前缀 `create` | ✅ 达标 |
| 类型完整性 | 零 any，`to: RouteLocationNormalized`、`next: NavigationGuardNext` 均有类型 | ✅ 达标 |
| 目录规范 | 守卫统一放 `src/router/guard/`，路由配置放 `src/router/routes/` | ✅ 达标 |
| 导入顺序 | `import type` → 第三方库（vue-router）→ 内部模块（@/store/）→ 相对路径（./xxx） | ✅ 达标 |
| 错误处理 | `initRoute` 中 `await` 有 try/catch 吗？仔细看：路由初始化失败由 `routeStore` 内部处理，守卫层只负责 `next()` 调用 | ⚠️ 需理解：守卫层不直接处理 API 错误，而是委托给 Store |
| 可测试性 | 守卫函数纯依赖 `router` 参数，可注入 mock router 测试 | ✅ 达标 |
| 国际化 | 文档标题守卫使用 `$t(i18nKey)` | ✅ 达标 |

**⚠️ 注意**：`src/router/elegant/transform.ts` 顶部有 `/* eslint-disable */` 和 `/* prettier-ignore */` — 这是**生成代码**，不参与人工评审。评审重点应放在手写代码：`guard/`、`routes/`、`hooks/common/router.ts`。

---

## 功能实践 — 分三步

### 第一步：分析 — 新增一个"组织架构"页面路由

假设我们要新增一个 `org` 模块，包含：
- 部门列表页：`/org/department`
- 人员管理页：`/org/person`
- 岗位管理页：`/org/position`

**任务拆解**：
1. 创建目录：`src/views/org/department/index.vue`、`src/views/org/person/index.vue`、`src/views/org/position/index.vue`
2. 确认 `@elegant-router` 是否自动生成路由（是，因为目录符合约定）
3. 检查生成的路由是否需要补充 `meta` 信息（权限、标题、图标）
4. 如需自定义路由行为，在 `src/router/routes/index.ts` 中补充

### 第二步：小任务开发

#### 小任务 1：创建视图目录和页面入口

```vue
<!-- src/views/org/department/index.vue -->
<script setup lang="ts">
import { useRoute } from 'vue-router';

defineOptions({
  name: 'OrgDepartment'
});

const route = useRoute();
console.log('当前路由参数:', route.params);   // 动态参数
console.log('当前查询参数:', route.query);     // 查询参数
console.log('路由元信息:', route.meta);        // meta 信息
</script>

<template>
  <div class="p-4">
    <h1>部门管理</h1>
    <p>当前路径: {{ route.path }}</p>
  </div>
</template>
```

#### 小任务 2：使用 useRouterPush 进行编程式导航

```typescript
// 在组件中跳转
import { useRouterPush } from '@/hooks/common/router';

const { routerPushByKey, toLogin } = useRouterPush();

// 跳转到指定路由（带参数）
await routerPushByKey('org_department', {
  query: { page: '1', size: '20' }
});

// 未登录时跳登录页
await toLogin('pwd-login', '/org/department');
```

#### 小任务 3：为路由添加权限控制（meta 信息）

如果自动生成的路由缺少权限配置，可在 `src/router/routes/index.ts` 中补充：

```typescript
const customRoutes: CustomRoute[] = [
  {
    name: 'org',
    path: '/org',
    component: 'layout.base',
    meta: {
      title: 'org',
      i18nKey: 'route.org',
      icon: 'ant-design:team-outlined',
      order: 10,
      roles: ['admin', 'org_manager']  // 权限控制
    },
    children: [
      {
        name: 'org_department',
        path: '/org/department',
        component: 'view.org_department',
        meta: {
          title: 'org_department',
          i18nKey: 'route.org_department',
          roles: ['admin', 'org_manager']
        }
      }
    ]
  }
];
```

### 第三步：整合与测试

1. 运行 `pnpm dev`，观察控制台是否自动生成路由
2. 检查 `src/router/elegant/routes.ts` 是否包含新路由
3. 浏览器访问 `/org/department`，验证页面渲染
4. 检查路由守卫：未登录时访问 `/org/department` 是否自动跳转到登录页（带 redirect 参数）
5. 检查权限：用无 `org_manager` 角色的账号登录，访问是否被重定向到 403

### 调试技巧

| 现象 | 排查方法 |
|------|---------|
| 访问 `/org/department` 白屏 | Vue DevTools → Router 面板，查看路由是否匹配 |
| 路由跳转无反应 | 检查 `next()` 是否被调用，是否有 `return` 漏写 |
| 守卫进入死循环 | 检查重定向目标是否也触发守卫，导致循环跳转 |
| 动态路由未加载 | 检查 `initAuthRoute()` 是否执行，网络面板看 `fetchGetUserRoutes` 请求 |
| 菜单未显示 | 检查 `routeStore.menus` 是否包含新路由，Pinia DevTools 面板 |

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| Vue Router | 前端路由管理器，管理 URL 与组件的映射 | Spring MVC `RequestMappingHandlerMapping` | 无刷新切换视图，History API 驱动 |
| beforeEach | 全局前置守卫，路由切换前执行 | Servlet `Filter.doFilter()` | 可异步等待，可 `next(false)` 取消导航 |
| meta | 路由元信息，承载权限、标题、图标等配置 | 注解 `@PreAuthorize`、`@RequestMapping` 的 `params` | 完全自定义，运行时动态读取 |
| @elegant-router | 扫描 `views/` 目录自动生成路由配置 | Spring 包扫描自动注册 Controller | **构建时**生成，零运行时开销 |
| addRoute | 动态添加路由到路由器 | 动态注册 Controller（不常见） | 登录后异步拉取后端路由表，动态挂载 |
| useRouterPush | 封装编程式导航的 Hook | 封装 `RedirectStrategy` | 响应式路由信息，支持 `query`/`params` 类型推导 |
| lazy loading | `() => import('./view.vue')` | 懒加载 Controller（无直接对应） | 按需加载组件代码，减少首屏 bundle |

---

## 课后思考（不进课程正文，次日揭晓）

1. `initRoute` 中为什么先初始化 `constantRoutes` 再初始化 `authRoutes`？如果顺序颠倒会怎样？
2. `handleUpdateRootRouteRedirect` 在动态路由模式下更新根路由重定向，为什么要先 `removeRoute` 再 `addRoute`？直接修改不行吗？
3. `useRouterPush` 中 `inSetup` 参数的作用是什么？什么时候用 `globalRouter` 而不是 `useRouter()`？

---

**明日预告**：第23天 — **Pinia 状态管理 — 新一代的 Vuex**
> 我们将深入 carlos-ui 的 Store 层，理解 `useAuthStore`、`useRouteStore`、`useTabStore` 的设计，掌握 Composition API 风格的 Pinia 状态管理。Java 架构师最容易犯的错：把 Pinia 当成全局变量 — 明天告诉你为什么不是。

---

*课程生成时间：2026-06-13 | 第三阶段第1天 | 第22天/90天*
