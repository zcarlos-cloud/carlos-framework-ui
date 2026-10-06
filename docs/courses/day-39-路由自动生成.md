# 今日前端课程 — 第39天：路由自动生成 — 文件即路由

> **学习目标**
> - 能读：理解 `@elegant-router/vue` 如何从文件系统自动生成路由表，读懂 `elegant/` 目录下三个生成文件的设计意图
> - 能用：在 `src/views/` 下新增一个页面，运行 `pnpm gen-route` 生成路由，理解新增页面后整个路由链路的自动变化
> - 规范：遵循目录约定（kebab-case 目录名 → 下划线拼接 routeName），理解类型安全如何从文件结构自动推导
> - 精进：理解 `transformElegantRoutesToVueRoutes` 的三级路由转换逻辑（single-level / multi-level / component split），理解为什么这样设计比手写路由更安全
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + @elegant-router/vue + Vue Router 4

---

## 理论学习

### 核心知识点

#### 1. 什么是「文件即路由」？

传统 Vue Router 需要手动编写路由表：

```typescript
// 传统方式：手写每一条路由
const routes = [
  { path: '/manage/user', name: 'manage_user', component: () => import('@/views/manage/user/index.vue') },
  { path: '/manage/role', name: 'manage_role', component: () => import('@/views/manage/role/index.vue') },
  // ... 50+ 条路由，每条都要手写
];
```

而 `@elegant-router/vue` 通过 Vite 插件在**编译时**扫描 `src/views/` 目录，自动生成：
- 路由映射表（`routes.ts`）— 所有路由的 name/path/component/meta
- 组件导入表（`imports.ts`）— 所有页面组件的懒加载 `() => import()`
- 类型声明（`elegant-router.d.ts`）— 所有路由名的类型级约束

**一个页面文件的诞生 = 一条路由的诞生，零手写。**

#### 2. 目录到路由的映射规则

| 文件路径 | 路由 name | 路由 path |
|---------|----------|----------|
| `src/views/home/index.vue` | `home` | `/home` |
| `src/views/manage/user/index.vue` | `manage_user` | `/manage/user` |
| `src/views/manage/user-detail/[id].vue` | `manage_user-detail` | `/manage/user-detail/:id` |
| `src/views/function/hide-child/one/index.vue` | `function_hide-child_one` | `/function/hide-child/one` |

**关键规则**：
- 目录层级用 **下划线 `_`** 拼接为 routeName
- 目录名中的**连字符 `-`** 保留（如 `user-detail` → `manage_user-detail`）
- 文件名 `[id].vue` → 路径参数 `:id`
- 根级文件 `index.vue` 始终是页面入口

#### 3. 三级路由转换架构

Elegant Router 生成的是中间格式（`ElegantConstRoute`），不是直接给 Vue Router 用的。中间要经过 `transformElegantRoutesToVueRoutes` 转换为 `RouteRecordRaw[]`：

```
文件系统 → Vite 插件扫描 → ElegantConstRoute → transform → RouteRecordRaw[]
```

这个 transform 函数处理三种路由形态：

**① 单级路由（Single-level）**— 如 `home`、`about`
```typescript
// ElegantConstRoute 中表示为：
{ name: 'home', path: '/home', component: 'layout.base$view.home' }

// transform 后拆分为 layout + view：
// { path: '/home', component: BaseLayout, children: [{ name: 'home', path: '', component: homeView }] }
```

**② 多级路由（Multi-level）**— 如 `manage/manage_user`
```typescript
// 父路由只用 layout，子路由挂 view
{ name: 'manage', path: '/manage', component: 'layout.base', children: [
  { name: 'manage_user', path: '/manage/user', component: 'view.manage_user' }
]}
```

**③ 含布局的末级路由**— 通过 `layout.base$view.xxx` 语法表示同时需要 layout + view

**为什么要绕这一圈？** 因为中间格式 `ElegantConstRoute` 是**类型安全的纯数据**，不直接依赖 Vue API。这让：
- 路由可以在 Node 侧做权限过滤（不依赖浏览器）
- 类型推导可以提前在编译期完成
- 路由表是纯 JSON 可序列化结构

---

### Java 思维类比

| Java 概念 | 前端对应 | 类比说明 |
|----------|---------|---------|
| Spring `@ComponentScan` 自动发现 Controller | `@elegant-router/vue` 扫描 `src/views/` | 约定大于配置的组件发现 |
| `@RequestMapping("/user")` | 目录名 `user/` → path `/user` | 路径映射约定 |
| Spring `HandlerMapping` | `routeMap: RouteMap` | URL → 处理器的映射表 |
| Java 反射 `Class.forName()` | `() => import()` 懒加载 | 运行时按需加载类/模块 |
| Spring `@PathVariable("{id}")` | `[id].vue` → `:id` | 路径参数声明 |
| Spring `HandlerInterceptor` | Vue Router 导航守卫 `beforeEach` | 请求/路由拦截器 |
| Spring `RequestContextHolder` | `router.currentRoute` | 当前请求上下文 |
| Maven `pom.xml` 模块聚合 | `RouteMap` 统一类型声明 | 所有模块的注册中心 |

> **类比核心**：Spring 通过 `@ComponentScan` 自动发现所有带 `@Controller` 的 Bean 并注册到 `HandlerMapping`；Elegant Router 通过 Vite 插件扫描 `src/views/` 目录下的 `.vue` 文件，自动生成路由注册代码。两者的共同哲学——**约定优于配置**。

---

### 超越类比 — 前端独有的设计哲学

> Java 的 `@ComponentScan` 是**运行时反射**，在 JVM 启动时扫描 classpath。而 Elegant Router 是**编译时代码生成**——它在 Vite 构建阶段就产出 `.ts` 文件。这带来了三个 Java 生态难以实现的好处：

**1. 编译期类型安全，而非运行时反射**
手写路由时，`router.push({ name: 'mangae_user' })` 拼写错误只会在运行时暴露。Elegant Router 通过 `elegant-router.d.ts` 声明 `type RouteKey = 'home' | 'manage_user' | ...`，任何拼写错误都在 `pnpm typecheck` 阶段被拦截。这是 Spring 反射做不到的零成本类型校验。

**2. 路由拆分与 Tree Shaking**
每个页面通过 `() => import()` 懒加载，Vite/Rollup 能精确分析依赖图，只打包访问到的页面代码。这相当于 Java 的类延迟加载 + 死代码消除，但粒度更细——页面级而非类级。

**3. 中间格式的「纯数据」设计**
`ElegantConstRoute` 不依赖 Vue/Router，是一个纯 POJO 数组。这让路由数据可以被：Node.js 脚本预过滤、SSR 服务端预渲染、权限系统在渲染前裁剪——这些操作在 Spring MVC 中需要依赖 Servlet 容器，而在这里可以在任何 JS 运行时完成。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

| 文件 | 职责 | 生成/手写 |
|------|------|----------|
| `build/plugins/router.ts` | Vite 插件配置：声明 layouts、customRoutes、路径转换/元信息生成钩子 | 手写 |
| `src/router/elegant/routes.ts` | 生成的路由表（`generatedRoutes: GeneratedRoute[]`） | 自动生成 |
| `src/router/elegant/imports.ts` | 生成的组件导入表（`views` / `layouts` 映射） | 自动生成 |
| `src/router/elegant/transform.ts` | 中间格式 → Vue Router 格式的转换器 | 自动生成 |
| `src/typings/elegant-router.d.ts` | 路由类型声明：`RouteKey` / `RoutePath` / `RouteMap` | 自动生成 |
| `src/router/routes/index.ts` | 路由入口：合并 `customRoutes` + `generatedRoutes`，分拣 constant/auth | 手写 |
| `src/router/routes/builtin.ts` | 内置路由：`root`、`not-found` | 手写 |
| `src/store/modules/route/index.ts` | 路由 Store：初始化、权限过滤、菜单生成、缓存管理 | 手写 |
| `src/hooks/common/router.ts` | 路由 Hook：`useRouterPush` 封装所有跳转逻辑 | 手写 |

### 阅读指引

**第一步：从配置文件入手** — `build/plugins/router.ts`

```typescript
// 这是整个路由自动生成系统的「配置入口」
export function setupElegantRouter() {
  return ElegantVueRouter({
    layouts: {
      base: 'src/layouts/base-layout/index.vue',   // 主布局
      blank: 'src/layouts/blank-layout/index.vue'   // 空白布局（登录页等）
    },
    customRoutes: {
      names: ['exception_403', 'exception_404', ...] // 手写路由名列表
    },
    routePathTransformer(routeName, routePath) {
      // 特殊路由路径转换：login 路由支持多模块
      if (key === 'login') {
        const modules = ['pwd-login', 'code-login', 'register', 'reset-pwd', 'bind-wechat'];
        return `/login/:module(${modules.join('|')})?`;
      }
      return routePath;
    },
    onRouteMetaGen(routeName) {
      // 为每条路由自动注入 meta
      return {
        title: key,
        i18nKey: `route.${key}` as App.I18n.I18nKey
      };
    }
  });
}
```

**设计亮点**：
- `routePathTransformer` 允许对特殊路由做路径改写（login 有动态模块参数）
- `onRouteMetaGen` 统一注入 `i18nKey`，避免每条路由手写国际化 key
- `customRoutes.names` 声明哪些路由是手动定义的（不走文件系统生成）

**第二步：看生成产物** — `src/router/elegant/routes.ts`

这个文件是插件扫描 `src/views/` 后自动生成的。注意 `component` 字段使用了一种**领域特定语言（DSL）**：

```
'layout.base$view.home'    → 单级路由：base 布局 + home 视图
'layout.base'              → 中间路由：仅 base 布局，子路由挂视图
'view.manage_user'          → 末级路由：直接挂视图组件
```

**第三步：理解转换器** — `src/router/elegant/transform.ts`

核心函数 `transformElegantRouteToVueRoute` 的三个分支：

```typescript
// 分支1：单级路由（如 home、about）
// component = 'layout.base$view.home'
if (isSingleLevelRoute(route)) {
  const { layout, view } = getSingleLevelRouteComponent(component);
  return [{
    path,
    component: layouts[layout],          // BaseLayout
    children: [{
      name,
      path: '',
      component: views[view],            // home/index.vue
    }]
  }];
}

// 分支2：带 layout 的中间路由（如 manage、function）
if (isLayout(component)) {
  vueRoute.component = layouts[getLayoutName(component)];
}

// 分支3：末级视图路由
if (isView(component)) {
  vueRoute.component = views[getViewName(component)];
}
```

> **思考题**：为什么单级路由要拆成「layout parent + view child」两层？为什么不能直接 `component: homeView`？
>
> **答案**：因为单级路由也需要套在布局组件（侧边栏、顶栏、面包屑）里面。拆成两层后，布局组件通过 `<RouterView>` 渲染子路由，保持了布局的持久性（切换页面时布局不重新挂载）。

**第四步：权限与菜单** — `src/router/routes/index.ts`

```typescript
export function createStaticRoutes() {
  const constantRoutes: ElegantRoute[] = [];
  const authRoutes: ElegantRoute[] = [];

  [...customRoutes, ...generatedRoutes].forEach(item => {
    if (item.meta?.constant) {
      constantRoutes.push(item);    // 免登录路由
    } else {
      authRoutes.push(item);        // 需鉴权路由
    }
  });

  return { constantRoutes, authRoutes };
}
```

关键设计：**路由的「二分法」**。`meta.constant` 区分了两种路由：
- **constant 路由**：登录前就注册（login、403、404、500），不依赖用户信息
- **auth 路由**：登录后根据权限动态注册，需要先获取用户角色

这对应 Spring Security 的 `permitAll()` vs `authenticated()` 的配置哲学。

**第五步：路由 Store 的初始化时序** — `src/store/modules/route/index.ts`

```typescript
// 第1步：初始化 constant 路由（登录前）
async function initConstantRoute() {
  if (authRouteMode === 'static') {
    addConstantRoutes(staticRoute.constantRoutes);  // 静态模式：直接用代码中的路由
  } else {
    const { data } = await fetchGetConstantRoutes(); // 动态模式：从后端获取
    addConstantRoutes(data);
  }
  handleConstantAndAuthRoutes();  // → 注册到 Vue Router、生成菜单、缓存
}

// 第2步：初始化 auth 路由（登录后）
async function initAuthRoute() {
  await authStore.initUserInfo();  // 先获取用户信息（包含角色）

  if (authRouteMode === 'static') {
    initStaticAuthRoute();  // 按角色过滤
  } else {
    await initDynamicAuthRoute();  // 从后端获取用户可见路由
  }
}

// 第3步：统一处理 — 排序 → 转为 VueRouter 格式 → 注册 → 生成菜单 → 缓存
function handleConstantAndAuthRoutes() {
  const allRoutes = [...constantRoutes, ...authRoutes];
  const sortRoutes = sortRoutesByOrder(allRoutes);
  const vueRoutes = getAuthVueRoutes(sortRoutes);
  resetVueRoutes();
  addRoutesToVueRouter(vueRoutes);   // router.addRoute()
  getGlobalMenus(sortRoutes);        // → menus
  getCacheRoutes(vueRoutes);         // → cacheRoutes
}
```

---

### 规范评审清单

| 检查项 | 标准 | `build/plugins/router.ts` | `src/router/elegant/transform.ts` | `src/store/modules/route/index.ts` |
|--------|------|--------------------------|----------------------------------|-------------------------------------|
| 命名规范 | 文件kebab-case、函数camelCase、组件PascalCase、常量UPPER_SNAKE_CASE | ✅ `setupElegantRouter` 规范 | ✅ `transformElegantRoutesToVueRoutes` | ✅ `useRouteStore` 规范 |
| 类型完整性 | 零any，所有参数/返回值有类型 | ✅ 参数类型 `RouteMeta`、`RouteKey` | ✅ 所有函数有完整类型签名，用 `error: any` 仅 catch 块 | ✅ 所有 ref/computed 有类型标注 |
| 目录规范 | 文件放在正确的目录 | ✅ `build/plugins/` | ✅ `src/router/elegant/` | ✅ `src/store/modules/route/` |
| 导入顺序 | type导入 → 第三方库 → 内部模块 → 相对路径 | ✅ 先 `import type`，再 `@elegant-router` | ✅ 严格遵循 | ✅ 严格遵循 |
| 错误处理 | 所有异步有try/catch或统一拦截 | N/A（纯同步配置） | ✅ catch 块有 console.error 降级 | ✅ `fetchGetConstantRoutes` 失败时 fallback 到静态路由 |
| 可测试性 | 纯函数可单测，副作用可mock | ✅ 纯配置工厂函数 | ✅ 纯转换函数，输入→输出 | ⚠️ Store 耦合 router 实例，需 mock |
| 国际化 | 用户可见字符串使用 `$t()` | N/A（无用户可见字符串） | N/A | ✅ 菜单通过 `updateLocaleOfGlobalMenus` |


> **规范亮点**：`transform.ts` 中 `error: any` 是 catch 块中合理的 `any` 使用，因为 catch 无法预知异常类型。这是规范允许的例外。

---

## 功能实践 — 分三步

### 第一步：功能分析与任务拆解

**目标**：新增一个「系统通知」页面，理解从创建文件到出现在菜单中的完整链路。

**任务拆解**：

| 子任务 | 说明 | 技术要点 |
|--------|------|---------|
| 1. 创建页面文件 | 在 `src/views/manage/` 下新建 `notice/index.vue` | 遵循目录约定 |
| 2. 运行路由生成 | `pnpm gen-route` 触发插件重新扫描 | 观察生成文件的变化 |
| 3. 验证路由注册 | 在浏览器中访问 `/manage/notice` | 检查路由是否生效 |
| 4. 添加路由元信息 | 为路由添加 icon、order、roles | 修改 Vite 插件配置的回调 |
| 5. 理解菜单生成 | 观察新路由如何自动出现在左侧菜单 | 阅读 `getGlobalMenusByAuthRoutes` |
| 6. 权限控制 | 为路由添加 `roles: ['R_ADMIN']` 实现权限过滤 | 阅读 `filterAuthRoutesByRoles` |

---

### 第二步：小任务开发

#### 子任务1：创建页面文件

```bash
# 在 src/views/manage/ 下创建 notice 目录和 index.vue
mkdir -p src/views/manage/notice
```

```vue
<!-- src/views/manage/notice/index.vue -->
<script setup lang="ts">
defineOptions({
  name: 'ManageNotice'
});
</script>

<template>
  <div class="p-4">
    <h2 class="text-lg font-bold">系统通知</h2>
    <p class="text-gray-500 mt-2">这是一条测试通知页面</p>
  </div>
</template>

<style scoped></style>
```

**规范要点**：
- 文件名 `index.vue`：这是文件系统路由的约定，Elegant Router 以此识别页面入口
- 组件名 `defineOptions({ name: 'ManageNotice' })`：PascalCase 多词组合，符合规范
- 目录名 `notice`（kebab-case）：符合目录命名规范

#### 子任务2：运行路由生成

```bash
pnpm gen-route
```

这个命令会触发 `@elegant-router/vue` 插件重新扫描 `src/views/`，更新以下文件：

**变化1：`src/router/elegant/routes.ts` — 新增一条路由**

```typescript
// 自动追加到 manage.children 数组中
{
  name: 'manage_notice',
  path: '/manage/notice',
  component: 'view.manage_notice',
  meta: {
    title: 'manage_notice',
    i18nKey: 'route.manage_notice'
  }
}
```

**变化2：`src/router/elegant/imports.ts` — 新增懒加载导入**

```typescript
manage_notice: () => import("@/views/manage/notice/index.vue"),
```

**变化3：`src/router/elegant/transform.ts` — 更新 routeMap**

```typescript
"manage_notice": "/manage/notice",
```

**变化4：`src/typings/elegant-router.d.ts` — 更新类型声明**

```typescript
// RouteMap 中新增
"manage_notice": "/manage/notice";

// RouteKey 自动包含 'manage_notice'
// LastLevelRouteKey 自动包含 'manage_notice'
```

> **关键观察**：你只创建了一个文件，四个文件被自动更新。这就是「文件即路由」的威力。

#### 子任务3：验证路由注册

启动开发服务器：

```bash
pnpm dev
```

打开浏览器 `http://localhost:9527/manage/notice`，应该能看到刚才创建的页面。

> **如果看不到**：检查 `pnpm typecheck` 是否有类型错误，确保 `gen-route` 成功执行。

#### 子任务4：添加路由元信息（icon、order、roles）

由于 `manage` 路由的 `onRouteMetaGen` 回调只生成 `title` 和 `i18nKey`，我们需要在 `build/plugins/router.ts` 中为特定路由添加自定义 meta：

```typescript
// build/plugins/router.ts 中的 onRouteMetaGen
onRouteMetaGen(routeName) {
  const key = routeName as RouteKey;

  // ... 现有代码

  // 为特定路由添加额外 meta
  const routeMetaMap: Partial<Record<RouteKey, Partial<RouteMeta>>> = {
    manage_notice: {
      icon: 'carbon:notification',
      order: 12,
      roles: ['R_ADMIN'],
      keepAlive: true
    }
  };

  return {
    ...meta,
    ...routeMetaMap[key]
  };
}
```

**但更好的做法**：直接在 `src/views/manage/notice/` 目录下添加路由元信息。Elegant Router 支持在页面目录下放置 `route.ts` 或通过 `_route` 文件来声明额外元信息（参考 `@elegant-router/vue` 文档）。

#### 子任务5：理解菜单生成

`src/store/modules/route/shared.ts` 中的 `getGlobalMenusByAuthRoutes` 是菜单生成的核心：

```typescript
export function getGlobalMenusByAuthRoutes(routes: ElegantConstRoute[]) {
  const menus: App.Global.Menu[] = [];
  routes.forEach(route => {
    // 关键过滤：hideInMenu 的路由不出现在菜单中
    if (!route.meta?.hideInMenu) {
      const menu = getGlobalMenuByBaseRoute(route);
      // 递归处理子路由
      if (route.children?.some(child => !child.meta?.hideInMenu)) {
        menu.children = getGlobalMenusByAuthRoutes(route.children);
      }
      menus.push(menu);
    }
  });
  return menus;
}
```

**菜单生成流程**：
```
authRoutes → 过滤 hideInMenu → 过滤无子路由的中间节点 → 递归转换 → menus[]
                                                                      ↓
                                                            sortRoutesByOrder()
                                                                      ↓
                                                             左侧菜单渲染
```

#### 子任务6：权限控制

当 `manage_notice` 的 `meta.roles = ['R_ADMIN']` 生效后：

```typescript
// src/store/modules/route/shared.ts
function filterAuthRouteByRoles(route: ElegantConstRoute, roles: string[]) {
  const routeRoles = route.meta?.roles || [];
  const isEmptyRoles = !routeRoles.length;    // 空 = 所有角色可见
  const hasPermission = routeRoles.some(role => roles.includes(role));

  // 递归过滤子路由
  if (filterRoute.children?.length) {
    filterRoute.children = filterRoute.children.flatMap(
      item => filterAuthRouteByRoles(item, roles)
    );
  }

  // 过滤后无子路由的中间节点要移除
  if (filterRoute.children?.length === 0) {
    return [];
  }

  return hasPermission || isEmptyRoles ? [filterRoute] : [];
}
```

**关键逻辑**：
- `roles: []`（或未设置）= 所有人可见
- `roles: ['R_ADMIN']` = 仅 ADMIN 角色可见
- 父路由无权限但子路由有权限 = 父路由被过滤，子路由也消失（因为它的父节点被移除了）
- 父路由有权限但所有子路由无权限 = 父路由也被移除（`children.length === 0`）

---

### 第三步：整合小任务，功能测试

#### 完整验证流程

```bash
# Step 1: 确保页面文件存在
ls src/views/manage/notice/index.vue

# Step 2: 重新生成路由
pnpm gen-route

# Step 3: 检查生成产物
# 在 routes.ts 中搜索 manage_notice
grep -n "manage_notice" src/router/elegant/routes.ts

# 在 imports.ts 中搜索
grep -n "manage_notice" src/router/elegant/imports.ts

# Step 4: 类型检查
pnpm typecheck

# Step 5: 启动开发服务器验证
pnpm dev
```

#### 排查思路

| 症状 | 可能原因 | 排查方法 |
|------|---------|---------|
| 页面 404 | 路由未生成或 `gen-route` 没执行 | 检查 `routes.ts` 是否有对应条目 |
| 页面白屏 | 组件导入路径错误 | 检查 `imports.ts` 中的 import 路径 |
| 菜单不显示 | meta 配置问题或权限过滤 | 检查是否有 `hideInMenu: true`，检查角色匹配 |
| TypeScript 报错 | 路由名不在 RouteKey 类型中 | 确认 `gen-route` 已执行，检查 `elegant-router.d.ts` |
| 路由跳转报错 | 使用未注册的路由名 | 确保使用 `LastLevelRouteKey` 中的路由名 |

---

### 验收标准

- [ ] **能用**：新增 `manage/notice` 页面，`pnpm dev` 后可通过 URL 访问
- [ ] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过，目录名 kebab-case，组件名 PascalCase
- [ ] **精进**：理解 `transformElegantRoutesToVueRoutes` 的三级路由处理逻辑，能解释「为什么单级路由要拆成两层」

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| 文件即路由 | 创建 `.vue` 文件 = 创建一条路由，无需手写路由表 | Spring `@ComponentScan` 发现 `@Controller` | Vite 编译时代码生成，类型安全零运行时开销 |
| `ElegantConstRoute` | 纯数据中间格式，不依赖 Vue，可序列化 | 路由的 DTO/VO 对象 | 可在 Node.js 侧做权限裁剪，无需浏览器环境 |
| `layout.base$view.home` | 单级路由的组件 DSL：同时指定布局和视图 | XML 中 `<layout><page/></layout>` | 编译时解析而非运行时解析，拼写错误在 typecheck 阶段暴露 |
| `routePathTransformer` | 特殊路由路径改写钩子（如 login 动态模块参数） | Spring `PathPattern` 自定义 | Vite 插件生命周期中执行，构建时即确定 |
| `filterAuthRoutesByRoles` | 递归过滤路由树，移除无权限分支及空父节点 | Spring Security `@PreAuthorize` | 递归 + 剪枝算法，纯函数可独立测试 |
| `handleConstantAndAuthRoutes` | 统一处理：排序→转换→注册→菜单→缓存 | Spring `ApplicationRunner` | 五步流水线，每步职责单一 |

---

**明日预告**：第40天 — 权限控制：路由权限、按钮权限、菜单动态生成（Spring Security 的前端镜像）
