# 今日前端课程 — 第40天：权限控制 — 路由权限、按钮权限、菜单动态生成

> **学习目标**
> - **能读**：读懂 `carlos-ui` 权限体系的完整链路（路由守卫 → Store 过滤 → 菜单生成 → 按钮显隐）
> - **能用**：能基于角色/按钮编码实现前端权限控制，新增一个受保护页面
> - **规范**：零 `any`，所有权限函数参数/返回值有类型；`hasAuth` 封装在 `hooks/business/`；路由守卫逻辑清晰可维护
> - **精进**：理解"前端权限是体验层，不是安全层"的设计哲学；能画出权限数据流图
>
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + Pinia + Vue Router 4 + `@elegant-router/vue`

---

## 阶段过渡说明

**第四阶段（第36-50天）：工程化与项目实战**

经过第36-39天的工程化基础（Vite配置、ESLint、Git Hooks、路由自动生成），从今天开始进入**实战层**。权限控制是 Admin 系统的核心骨架——没有它，路由、菜单、按钮都只是一盘散沙。今天的目标是把"权限"这个概念从 Spring Security 的 Java 世界，完整映射到 Vue 3 的前端世界，并理解两者的本质差异。

---

## 理论学习

### 核心知识点

#### 1. 前端权限的三种粒度

| 粒度 | 控制对象 | 实现方式 | 目的 |
|------|----------|----------|------|
| **路由权限** | 页面/路由 | 路由守卫 `beforeEach` + `meta.roles` | 阻止无权限用户访问页面 |
| **菜单权限** | 侧边栏/导航 | 动态过滤路由生成菜单树 | 无权限菜单不显示 |
| **按钮权限** | 页面内操作 | `v-if="hasAuth('B_CODE')"` | 无权限按钮不渲染 |

> ⚠️ **关键认知**：前端权限控制的是**用户体验**，不是**安全边界**。所有敏感操作必须在后端再次校验。前端隐藏按钮只是"不让你看到"，不是"不让你做到"。

#### 2. 路由权限：Vue Router 导航守卫

Vue Router 的 `beforeEach` 是前端拦截未授权访问的第一道防线。它的执行顺序：

```
用户点击链接 / 输入 URL
  ↓
router.beforeEach 触发
  ├── 1. 初始化路由（常量路由 → 权限路由）
  ├── 2. 检查是否登录（Token 存在？）
  ├── 3. 检查路由是否需要登录（meta.constant?）
  ├── 4. 检查角色权限（meta.roles vs userInfo.roles）
  └── 5. 放行 / 跳登录页 / 跳 403 页
```

#### 3. 菜单动态生成：从路由到菜单的映射

`carlos-ui` 不手写菜单，而是**从权限路由自动生成菜单树**。核心逻辑：

1. 后端返回 `routes`（或前端静态配置）
2. `filterAuthRoutesByRoles()` 按角色过滤路由
3. `getGlobalMenusByAuthRoutes()` 将路由转换为菜单树
4. `updateLocaleOfGlobalMenus()` 更新国际化标签

#### 4. 按钮权限：基于编码的细粒度控制

后端在用户登录时返回 `buttons: string[]` 数组。前端通过 `hasAuth('B_CODE1')` 判断当前用户是否拥有某个按钮权限。

```vue
<!-- 只有拥有 B_CODE1 权限的用户才能看到"删除"按钮 -->
<AButton v-if="hasAuth('B_CODE1')">删除</AButton>
```

### Java 思维类比

> **Spring Security → Vue Router Guard**
>
> | Java Spring Security | Vue 前端权限 | 类比说明 |
> |----------------------|-------------|---------|
> | `@PreAuthorize("hasRole('ADMIN')")` | `meta: { roles: ['ADMIN'] }` | 路由元信息标注权限要求 |
> | `FilterChain` | `router.beforeEach` | 请求/路由拦截链 |
> | `AuthenticationEntryPoint` | `next({ name: 'login' })` | 未登录时重定向到登录页 |
> | `AccessDeniedException` | `next({ name: '403' })` | 无权限时跳 403 页面 |
> | `GrantedAuthority` | `userInfo.roles` | 用户拥有的角色列表 |
> | 方法级安全 `@Secured` | `v-if="hasAuth('B_CODE')"` | 按钮/方法级权限控制 |
> | 动态菜单构建 | `getGlobalMenusByAuthRoutes()` | 基于权限数据构建菜单树 |

### 超越类比 — 前端独有的设计哲学

> **为什么前端不能只做"鉴权"，还要做"权限过滤"？**
>
> Java 后端的安全模型是"请求到达 → 鉴权 → 拒绝或执行"。前端面对的是**已经到达浏览器的代码**——用户可以用 DevTools 查看所有源码。所以前端权限的核心不是"阻止访问"（这不可能），而是：
>
> 1. **减少困惑**：没权限的菜单/按钮不显示，用户不会被"点击后报错"困扰
> 2. **降低攻击面**：隐藏管理入口，减少被扫描到的概率
> 3. **提升体验**：不同角色看到不同界面，实现真正的"千人千面"
>
> 前端权限是**体验层安全（UX Security）**，不是**边界安全（Boundary Security）**。后端永远要做最终校验。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

1. `src/router/guard/route.ts` — 路由权限守卫（核心）
2. `src/store/modules/route/shared.ts` — `filterAuthRoutesByRoles` + `getGlobalMenusByAuthRoutes`
3. `src/hooks/business/auth.ts` — `hasAuth` 按钮权限 Hook
4. `src/views/function/toggle-auth/index.vue` — 按钮权限演示页面
5. `src/store/modules/auth/index.ts` — `userInfo.roles` / `userInfo.buttons`
6. `src/store/modules/route/index.ts` — 路由初始化时序

### 阅读指引

**阅读顺序**（按数据流）：`auth.ts` → `route/shared.ts` → `route/index.ts` → `guard/route.ts` → `toggle-auth/index.vue`

1. **先看 `auth.ts`**：只有21行，理解按钮权限的最小实现
2. **再看 `route/shared.ts`**：理解 `filterAuthRoutesByRoles` 的递归过滤逻辑和 `getGlobalMenusByAuthRoutes` 的菜单映射
3. **然后 `route/index.ts`**：理解 `initStaticAuthRoute` 的时序（超级管理员不过滤，普通用户按角色过滤）
4. **最后 `guard/route.ts`**：理解完整的守卫逻辑，特别关注 `initRoute` 的返回值处理

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件 kebab-case、函数 camelCase、组件 PascalCase | ✅ `auth.ts` / `route.ts` / `toggle-auth/index.vue` |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ `hasAuth(codes: string \| string[]): boolean` 类型完整；`filterAuthRoutesByRoles` 参数/返回值均有类型 |
| 目录规范 | 文件放在正确的目录 | ✅ `guard/` → 路由守卫；`hooks/business/` → 业务 Hook；`views/function/` → 功能演示页 |
| 导入顺序 | type 导入 → 第三方库 → 内部模块 → 相对路径 | ✅ `route.ts` 中 `import type` 在前，Vue Router 随后，Store 最后 |
| 错误处理 | 所有异步有 try/catch 或统一拦截 | ⚠️ `guard/route.ts` 中 `initRoute` 未显式 try/catch，但错误通过 `error` 字段处理；`route/index.ts` 中 `fetchGetUserRoutes` 有 `if (!error)` 判断 |
| 可测试性 | 纯函数可单测，副作用可 mock | ✅ `filterAuthRoutesByRoles` 是纯函数，输入输出确定，极易单测；`hasAuth` 依赖 Store 状态，可通过 Pinia 测试工具 mock |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ `toggle-auth/index.vue` 中所有标签均使用 `$t()` |

### 重点代码精读

#### 精读 1：`filterAuthRoutesByRoles` — 路由权限递归过滤

```typescript
// src/store/modules/route/shared.ts

export function filterAuthRoutesByRoles(routes: ElegantConstRoute[], roles: string[]) {
  return routes.flatMap(route => filterAuthRouteByRoles(route, roles));
}

function filterAuthRouteByRoles(route: ElegantConstRoute, roles: string[]): ElegantConstRoute[] {
  const routeRoles = (route.meta && route.meta.roles) || [];

  // 规则 1：路由未配置 roles，则允许访问（默认开放）
  const isEmptyRoles = !routeRoles.length;

  // 规则 2：用户角色与路由 roles 有交集，则允许访问
  const hasPermission = routeRoles.some(role => roles.includes(role));

  const filterRoute = { ...route };

  // 递归过滤子路由
  if (filterRoute.children?.length) {
    filterRoute.children = filterRoute.children.flatMap(item =>
      filterAuthRouteByRoles(item, roles)
    );
  }

  // 规则 3：子路由全部被过滤后，父路由也应被移除
  if (filterRoute.children?.length === 0) {
    return [];
  }

  return hasPermission || isEmptyRoles ? [filterRoute] : [];
}
```

**为什么用 `flatMap` 而不是 `map` + `filter`？**

因为 `filterAuthRouteByRoles` 的返回值是 `ElegantConstRoute[]`（数组），而不是单个对象。`flatMap` 会把返回的数组"拍平"，这是递归过滤树结构的惯用技巧。

**Java 类比**：这类似于从一棵权限树中递归剪枝——没有权限的分支及其所有子节点都被移除。

#### 精读 2：`createRouteGuard` — 路由守卫的完整决策树

```typescript
// src/router/guard/route.ts

router.beforeEach(async (to, from, next) => {
  const location = await initRoute(to); // ① 初始化路由（可能返回重定向地址）
  if (location) { next(location); return; }

  const authStore = useAuthStore();
  const isLogin = Boolean(localStg.get('token'));
  const needLogin = !to.meta.constant;  // 是否需要登录
  const routeRoles = to.meta.roles || [];
  const hasRole = authStore.userInfo.roles.some(role => routeRoles.includes(role));
  const hasAuth = authStore.isStaticSuper || !routeRoles.length || hasRole;

  // ② 已登录用户访问登录页 → 跳首页
  if (to.name === loginRoute && isLogin) { next({ name: rootRoute }); return; }

  // ③ 常量路由（登录页、404）无需权限
  if (!needLogin) { handleRouteSwitch(to, from, next); return; }

  // ④ 需要登录但未登录 → 跳登录页
  if (!isLogin) { next({ name: loginRoute, query: { redirect: to.fullPath } }); return; }

  // ⑤ 已登录但无权限 → 跳 403
  if (!hasAuth) { next({ name: noAuthorizationRoute }); return; }

  // ⑥ 通过所有检查 → 正常放行
  handleRouteSwitch(to, from, next);
});
```

**为什么守卫要先 `initRoute` 再检查权限？**

因为 `initRoute` 负责在**第一次访问时**从后端加载权限路由并注册到 Vue Router。如果路由未初始化，所有动态路由都是"404"，无从判断权限。这是时序上的依赖：先让路由"存在"，再判断"能否访问"。

**Java 类比**：类似于 Spring Security 的 `FilterSecurityInterceptor` — 先构建安全上下文（`SecurityContext`），再执行权限投票（`AccessDecisionVoter`）。

#### 精读 3：`hasAuth` — 按钮权限的最小实现

```typescript
// src/hooks/business/auth.ts

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

**为什么用 Hook 而不是全局函数？**

因为 `useAuthStore()` 是 Vue 的 Composition API，必须在 `setup` 上下文中调用。封装为 `useAuth()` Hook 后，任何组件都能通过 `const { hasAuth } = useAuth()` 获取权限判断能力，同时保持响应式（用户登录状态变化时自动重新计算）。

**为什么支持 `string | string[]`？**

支持两种场景：
- `hasAuth('B_DELETE')` — 精确匹配一个按钮权限
- `hasAuth(['B_DELETE', 'B_BATCH_DELETE'])` — 满足任一即可（OR 逻辑）

**Java 类比**：这类似于 `SecurityExpressionRoot.hasAnyAuthority('ROLE_ADMIN', 'ROLE_USER')`。

#### 精读 4：`toggle-auth` 页面 — 按钮权限的实战用法

```vue
<!-- src/views/function/toggle-auth/index.vue -->
<script setup lang="ts">
import { useAuth } from '@/hooks/business/auth';

const { hasAuth } = useAuth();
</script>

<template>
  <ASpace>
    <!-- 超级管理员可见 -->
    <AButton v-if="hasAuth('B_CODE1')">超级管理员按钮</AButton>
    <!-- 管理员可见 -->
    <AButton v-if="hasAuth('B_CODE2')">管理员按钮</AButton>
    <!-- 管理员或用户可见 -->
    <AButton v-if="hasAuth('B_CODE3')">管理员或用户</AButton>
  </ASpace>
</template>
```

---

## 功能实践 — 分三步

### 第一步：功能分析和拆解

**目标**：在 `carlos-ui` 中新增一个"权限测试页面"，演示三种权限粒度的完整链路。

拆解为以下小任务：

| 序号 | 小任务 | 涉及文件/技术点 | 难度 |
|------|--------|----------------|------|
| 1 | 新增路由页面 | `src/views/function/permission-test/index.vue` + 自动路由生成 | ⭐ |
| 2 | 为路由配置角色权限 | `src/router/routes.ts` 中设置 `meta.roles` | ⭐⭐ |
| 3 | 实现按钮级权限控制 | `useAuth().hasAuth()` + `v-if` | ⭐ |
| 4 | 测试不同角色的访问效果 | 切换 Super / Admin / User 账号 | ⭐ |

### 第二步：小任务开发

#### 子任务 1：新增页面文件

在 `src/views/function/permission-test/index.vue` 创建页面：

```vue
<script setup lang="ts">
import { useAuth } from '@/hooks/business/auth';
import { useAuthStore } from '@/store/modules/auth';

const authStore = useAuthStore();
const { hasAuth } = useAuth();

defineOptions({ name: 'PermissionTest' });
</script>

<template>
  <ASpace direction="vertical" :size="16">
    <ACard :title="$t('route.function_permission-test')" :bordered="false" class="card-wrapper">
      <ADescriptions layout="vertical" bordered :column="1">
        <ADescriptionsItem label="当前角色">
          <ASpace>
            <ATag v-for="role in authStore.userInfo.roles" :key="role" color="blue">{{ role }}</ATag>
          </ASpace>
        </ADescriptionsItem>
        <ADescriptionsItem label="当前按钮权限">
          <ASpace wrap>
            <ATag v-for="btn in authStore.userInfo.buttons" :key="btn" color="green">{{ btn }}</ATag>
          </ASpace>
        </ADescriptionsItem>
      </ADescriptions>
    </ACard>

    <ACard title="按钮权限测试" :bordered="false" class="card-wrapper">
      <ASpace>
        <AButton v-if="hasAuth('B_CODE1')" type="primary" danger>
          {{ $t('page.function.toggleAuth.superAdminVisible') }}
        </AButton>
        <AButton v-if="hasAuth('B_CODE2')" type="primary">
          {{ $t('page.function.toggleAuth.adminVisible') }}
        </AButton>
        <AButton v-if="hasAuth('B_CODE3')">
          {{ $t('page.function.toggleAuth.adminOrUserVisible') }}
        </AButton>
      </ASpace>
    </ACard>
  </ASpace>
</template>

<style scoped></style>
```

> **为什么 `defineOptions({ name: 'PermissionTest' })` 必须写？**
> 因为 `index.vue` 的默认文件名是 `index`，组件名不会自动变成 `PermissionTest`。显式声明是为了：
> 1. Vue DevTools 能正确显示组件名
> 2. `keep-alive` 的 `include` 匹配需要正确的 `name`
> 3. ESLint 规则 `vue/multi-word-component-names` 要求多词组件名

#### 子任务 2：配置路由角色权限（静态路由模式）

在 `src/router/routes.ts` 中，为新路由添加 `meta.roles`：

```typescript
{
  name: 'function_permission-test',
  path: '/function/permission-test',
  component: 'layout.base$view.function_permission-test',
  meta: {
    title: 'permission-test',
    i18nKey: 'route.function_permission-test',
    icon: 'ant-design:security-scan-outlined',
    roles: ['R_SUPER', 'R_ADMIN'],  // ← 只有超级管理员和管理员能访问
    order: 5
  }
}
```

> **为什么用 `roles` 而不是 `permissions`？**
> `carlos-ui` 使用角色控制页面级访问，使用按钮编码（`buttons`）控制操作级访问。这种分层设计的好处是：
> - 角色变化少（用户所属角色相对稳定）
> - 按钮编码变化多（新增功能时随时增加按钮编码）
> - 避免角色爆炸（不用为每个按钮创建一个角色）

#### 子任务 3：添加国际化文案

在 `src/locales/langs/zh-cn.ts` 中新增：

```typescript
route: {
  // ... 已有路由
  'function_permission-test': '权限测试',
}
```

在 `en-us.ts` 中同步新增英文翻译。

> **为什么不能漏掉国际化？**
> 因为 `getGlobalMenusByAuthRoutes` 会调用 `$t(i18nKey)` 生成菜单标签。如果 `i18nKey` 缺失，菜单会显示为空的 `label`。

#### 子任务 4：运行并测试

```bash
pnpm dev
```

测试步骤：
1. 用 Super 账号登录 → 应能看到"权限测试"菜单，所有按钮可见
2. 用 Admin 账号登录 → 应能看到"权限测试"菜单，B_CODE1 不可见，B_CODE2/B_CODE3 可见
3. 用 User 账号登录 → 不应看到"权限测试"菜单（被路由过滤），直接访问 URL 应跳 403

### 第三步：整合与调试

**权限数据流总图**：

```
用户登录
  ↓
authStore.loginByToken() → fetchGetUserInfo()
  ↓
userInfo = { roles: ['R_ADMIN'], buttons: ['B_CODE2', 'B_CODE3'] }
  ↓
routeStore.initAuthRoute()
  ├── staticAuthRoutes (全部路由)
  ├── filterAuthRoutesByRoles(staticAuthRoutes, ['R_ADMIN']) → 过滤掉 R_SUPER 专属路由
  └── addAuthRoutes(filteredRoutes) → 注册到 Vue Router
  ↓
getGlobalMenusByAuthRoutes(filteredRoutes) → 生成侧边栏菜单
  ↓
用户看到"与他角色匹配"的菜单和页面
  ↓
页面内：hasAuth('B_CODE2') → true → 按钮渲染
```

**常见调试问题**：

| 问题 | 排查思路 | 检查点 |
|------|----------|--------|
| 菜单没显示 | 检查 `meta.hideInMenu` 是否为 `true`；检查 `i18nKey` 是否缺失 | `getGlobalMenusByAuthRoutes` |
| 页面白屏 | 检查路由是否被 `filterAuthRoutesByRoles` 过滤掉了 | `routeStore.authRoutes` 在 Vue DevTools 中查看 |
| 按钮没显示 | 检查 `userInfo.buttons` 是否包含对应编码 | `authStore.userInfo` 在 Pinia 面板查看 |
| 跳 403 | 检查 `meta.roles` 配置；检查 `isStaticSuper` 判断 | `guard/route.ts` 第 33 行 |

### 验收标准

- [x] **能用**：以不同角色登录，看到不同的菜单和按钮
- [x] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过
- [x] **精进**：
  - [ ] 能解释 `flatMap` 在 `filterAuthRoutesByRoles` 中的作用
  - [ ] 能解释为什么 `initRoute` 在 `beforeEach` 中先于权限检查执行
  - [ ] 能画出从登录到菜单渲染的完整数据流图

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `meta.roles` | 路由元信息中的角色要求，控制页面级访问 | `@PreAuthorize("hasRole('ADMIN')")` | 路由守卫是**导航时**拦截，不是请求时拦截 |
| `filterAuthRoutesByRoles` | 递归剪枝：按角色过滤路由树，无权限的分支整体移除 | 基于角色的动态菜单构建 | 用 `flatMap` 递归拍平树结构，Java 一般用 Stream + filter |
| `hasAuth('B_CODE')` | 检查当前用户按钮编码列表是否包含指定编码 | `hasAuthority('DELETE_USER')` | 支持 `string \| string[]` 参数，满足任一即通过 |
| `initRoute` | 在路由守卫中初始化常量路由和权限路由 | `Filter.init()` | 首次访问时异步加载，后续缓存；`initConstantRoute` → `initAuthRoute` 时序不可颠倒 |
| 前端权限 | 控制"看到什么"，不是"能做什么" | Spring Security 只做边界安全 | 前端代码已到达用户浏览器，无法真正阻止执行；权限是体验优化 |

---

**明日预告**：第41天 — 主题与暗色模式（CSS 变量、UnoCSS dark 模式、动态主题切换）

> 明天将学习 carlos-ui 的主题系统——如何用 CSS 变量 + UnoCSS 实现一套代码、多种主题、秒级切换。
