# 今日前端课程 — 第27天：Axios 与网络请求封装 — 与后端联调

> **学习目标**
> - **能读**：理解 `@sa/axios` 的封装层级，区分 `createRequest` 与 `createFlatRequest`
> - **能用**：能编写符合规范的 API 函数，能配置请求拦截器、响应拦截器、错误处理
> - **规范**：API 命名 `fetch + 动词 + 名词`，类型零 `any`，错误处理完备，导入顺序正确
> - **精进**：理解 Token 刷新队列机制（防并发刷新）、AbortController 取消请求、错误消息防重复弹出
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + TS + Axios + `@sa/axios` + Pinia

---

## 理论学习

### 核心知识点

#### 1. Axios 拦截器机制 — 前端版的 "Filter Chain"

```
请求拦截器 → 后端处理 → 响应拦截器 → 业务代码
     ↑___________________________↓
              错误处理
```

Axios 提供两种拦截器：
- **请求拦截器**：在请求发送到后端前执行，常用于附加 Token、设置请求头
- **响应拦截器**：在收到后端响应后执行，常用于统一判断成功/失败、转换数据格式

> **Java 类比**：Axios 拦截器 ≈ Java Servlet `Filter` 链 + Spring `HandlerInterceptor`
> - `onRequest` ≈ `preHandle()` — 请求前附加 Token
> - `onBackendFail` ≈ `postHandle()` 异常分支 — 判断业务码是否成功
> - `onError` ≈ `afterCompletion()` 异常处理 — 网络错误/HTTP 错误统一处理

#### 2. 两种请求实例设计 — `createRequest` vs `createFlatRequest`

| 特性 | `createRequest` | `createFlatRequest` |
|------|---------------|-------------------|
| 成功返回值 | 直接返回 `data` | `{ data, error: null, response }` |
| 失败行为 | `throw` 异常，需 `try/catch` | 返回 `{ data: null, error, response }`，不抛异常 |
| 适用场景 | 简单场景，相信"成功是常态" | 需要同时获取成功/失败数据的复杂场景 |
| 代码风格 | 命令式（imperative） | 函数式（functional），更利于组合 |

> **Java 类比**：
> - `createRequest` ≈ 直接返回 `ResponseEntity<T>`，异常时抛 `RestClientException`
> - `createFlatRequest` ≈ 返回 `Result<T, Error>`（类似 Rust 的 Result 类型），用结构体承载成功/失败

#### 3. Token 刷新队列 — 并发请求的防重机制

**问题**：当 Token 过期时，如果同时有多个请求发出，每个请求都会触发刷新 Token，导致刷新接口被重复调用。

**解决方案**：`@sa/axios` 使用 Promise 缓存机制，将并发刷新合并为一次：

```typescript
// shared.ts
export async function handleExpiredRequest(state: RequestInstanceState) {
  if (!state.refreshTokenFn) {
    // 第一次触发：创建 Promise 并缓存
    state.refreshTokenFn = handleRefreshToken();
  }
  // 后续并发请求：复用同一个 Promise（等待同一结果）
  const success = await state.refreshTokenFn;
  
  setTimeout(() => {
    state.refreshTokenFn = null; // 1秒后清除缓存，允许下次刷新
  }, 1000);
  
  return success;
}
```

> **Java 类比**：这个模式 ≈ Java 的 `synchronized` + `Future` 缓存。`Promise<boolean>` 相当于 `CompletableFuture<Boolean>`，一旦创建，所有等待者都 `await` 同一个结果。`setTimeout` 清理相当于缓存失效策略（TTL = 1000ms）。

> **前端独有**：为什么用 `setTimeout` 而不是立即清理？因为响应拦截器可能在微任务队列中异步执行，立即清理会导致后续请求错过复用窗口。1000ms 的缓冲是一个经验值，确保同一批并发请求都能复用。

#### 4. AbortController — 请求取消机制

```typescript
// 每个请求自动分配 AbortController
const abortController = new AbortController();
config.signal = abortController.signal;
abortControllerMap.set(requestId, abortController);

// 需要取消时调用
abortController.abort(); // 触发 Axios 的取消逻辑
```

> **Java 类比**：`AbortController` ≈ Java `Future.cancel(true)`。`signal` 相当于 CancellationToken，传递到 fetch/axios 底层后，浏览器会中断 TCP 连接。
> 
> **前端独有**：浏览器资源有限，取消未完成的请求可以释放网络连接槽（HTTP/1.1 通常限制 6 个同源并发）。这对移动端尤为重要。

#### 5. 错误消息防重复弹出 — 状态驱动的消息管理

```typescript
// 用 state.errMsgStack 数组记录已弹出的错误消息
if (!state.errMsgStack.includes(message)) {
  state.errMsgStack.push(message);
  window.$message?.error(message, 1.5, () => {
    // 消息关闭后从数组移除
    state.errMsgStack = state.errMsgStack.filter(msg => msg !== message);
  });
}
```

> **Java 类比**：≈ Java 中使用 `ConcurrentHashMap` 做去重，配合 `ScheduledExecutorService` 做定时清理。
> 
> **前端独有**：UI 错误消息必须控制频率，否则用户会看到满屏红色提示。这不是后端日志，而是面向用户的体验设计。

---

### Java 思维类比

| 前端概念 | Java 对应 | 类比说明 |
|---------|----------|---------|
| Axios 请求拦截器 | `ClientHttpRequestInterceptor` | 请求前附加 Header、Token |
| Axios 响应拦截器 | `ResponseErrorHandler` | 统一判断 HTTP 状态码和业务码 |
| `createFlatRequest` | `Result<T, E>` | 返回结构体而非抛异常 |
| `AbortController` | `Future.cancel()` | 中断正在执行的请求 |
| Token 刷新队列 | `synchronized` + `CompletableFuture` 缓存 | 防止并发刷新 |
| 错误消息防重复 | `ConcurrentHashMap` + TTL 清理 | 状态驱动的去重机制 |
| `fetch + 动词 + 名词` | `getUserList()` / `saveUser()` | 命名规范，但前缀统一为 `fetch` |

### 超越类比 — 前端独有的设计哲学

1. **Flat Response 优于异常**：`createFlatRequest` 返回 `{data, error}` 而不是 `throw`，这是前端函数式编程的影响。Vue 模板和 `async/await` 中，`try/catch` 嵌套会打断响应式的可读性，Flat 结构让错误处理成为数据流的一部分。

2. **请求取消是必需品**：Java 后端很少需要"取消一个正在执行的 HTTP 请求"，但前端页面切换时必须取消未完成的请求，否则回调可能操作已卸载的组件，导致内存泄漏或状态错误。

3. **错误消息是 UI 状态的一部分**：后端日志可以全量记录，但前端错误消息必须做频率控制和去重，因为用户只有一个屏幕。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

1. `packages/axios/src/index.ts` — `@sa/axios` 核心封装
2. `packages/axios/src/type.ts` — 类型定义
3. `src/service/request/index.ts` — 业务请求实例配置
4. `src/service/request/shared.ts` — Token 管理与错误显示
5. `src/service/api/auth.ts` — API 函数示例

### 阅读指引

#### 阅读 `packages/axios/src/index.ts`（从底层到上层）

1. **先看 `createCommonRequest`**：这是所有实例的公共基础
   - 创建 axios instance
   - 配置 axios-retry（重试机制）
   - 请求拦截器：设置 `requestId` + `AbortController`
   - 响应拦截器：判断成功/失败 → `onBackendFail` → 或抛 `BACKEND_ERROR_CODE`

2. **再看 `createRequest`**：基于 `createCommonRequest`，在成功时直接返回 `transformBackendResponse` 的结果，失败时 `throw`

3. **最后看 `createFlatRequest`**：同样的基础，但成功返回 `{data, error: null}`，失败返回 `{data: null, error}`，**永不抛异常**

#### 阅读 `src/service/request/index.ts`（业务定制层）

1. **环境判断**：`isHttpProxy` 决定开发环境是否使用代理
2. **baseURL**：从 `getServiceBaseURL()` 获取，区分不同环境
3. **`onRequest`**：附加 `Authorization` Header
4. **`isBackendSuccess`**：判断 `response.data.code === VITE_SERVICE_SUCCESS_CODE`
5. **`onBackendFail`**：处理三种特殊错误码 — logoutCodes / modalLogoutCodes / expiredTokenCodes
6. **`onError`**：显示错误消息，但过滤 modalLogoutCodes 和 expiredTokenCodes（避免重复）

#### 阅读 `src/service/request/shared.ts`（Token 刷新机制）

1. `getAuthorization()`：从 `localStg` 读取 token，拼 `Bearer ` 前缀
2. `handleRefreshToken()`：调用 `fetchRefreshToken`，成功后更新本地存储
3. `handleExpiredRequest()`：核心 — Promise 缓存防止并发刷新
4. `showErrorMsg()`：消息去重 + 定时清理

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件 kebab-case、函数 camelCase | ✅ `index.ts` `shared.ts` `type.ts` 均正确 |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ `packages/axios/src/type.ts` 全部类型化；`index.ts` 泛型 `ResponseData`、`State` 使用合理；❌ 但 `RequestInstanceState` 中 `errMsgStack` 实际使用时有些隐式 `any` 风险 |
| 目录规范 | 文件放在正确的目录 | ✅ `packages/axios/` 是子包，`src/service/request/` 是业务封装，`src/service/api/` 是接口定义 |
| 导入顺序 | type 导入 → 第三方库 → 内部模块 → 相对路径 | ✅ 全部遵循规范：`import type` 在最前，然后 `axios`, `@sa/utils`, 然后 `@/store/`, `@/utils/`, 最后 `./type` |
| 错误处理 | 所有异步有 try/catch 或统一拦截 | ✅ `createFlatRequest` 内部 try/catch；`onError` 统一处理；`onBackendFail` 处理特殊业务码；但 `handleExpiredRequest` 中 `resetStore()` 在失败时调用，没有额外错误处理 |
| 可测试性 | 纯函数可单测，副作用可 mock | ✅ `createRequest`/`createFlatRequest` 是纯函数，输入配置返回实例；但 `useAuthStore()` 的调用在拦截器内，耦合了 Vue 生态，测试需 mock Pinia |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ `onBackendFail` 中 `window.$modal?.error` 使用了 `$t('common.error')` 和 `$t('common.confirm')` |
| 注释规范 | JSDoc 注释说明用途 | ✅ `auth.ts` 中每个函数都有 JSDoc；`type.ts` 中接口字段有注释；`packages/axios` 中缺少部分注释 |

### ⚠️ 发现的问题（精进机会）

1. **`request.state` 的类型安全**：`state` 初始化为 `{} as State`，但后续属性赋值没有类型校验。如果 `RequestInstanceState` 增加字段，容易遗漏。

2. **`handleExpiredRequest` 的竞态条件**：`setTimeout(() => { state.refreshTokenFn = null }, 1000)` 是硬编码的 1000ms。如果网络抖动导致刷新请求超过 1 秒，第二个请求会重新触发刷新。更好的做法是用 `finally` 或请求完成时清理。

3. **`demoRequest` 的 `Authorization` 格式**：`demoRequest` 直接拼接 `Bearer ${token}`，而 `request` 通过 `getAuthorization()` 统一获取。两种获取方式不一致，可能导致维护问题。

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**目标**：为 carlos-org 模块新增一个「部门分页查询」API，并理解完整的数据流转。

**拆解任务**：
1. 在 `src/service/api/` 下新增 `org.ts` 文件
2. 定义类型：在 `src/typings/api.d.ts` 中声明 `Api.Org` 命名空间
3. 编写 API 函数：`fetchGetDeptPage`、`fetchGetDeptTree`、`fetchAddDept`、`fetchUpdateDept`、`fetchDeleteDept`
4. 检查：导入顺序、命名规范、类型完整性、JSDoc 注释

### 第二步：小任务开发

#### 任务 1：类型定义（`src/typings/api.d.ts`）

```typescript
declare namespace Api {
  namespace Org {
    interface Dept {
      id: number;
      deptName: string;
      parentId: number;
      orderNum: number;
      leader: string;
      phone: string;
      email: string;
      status: Common.EnableStatus;
      createTime: string;
      updateTime: string;
    }

    interface DeptSearchParams {
      deptName?: string;
      status?: Common.EnableStatus;
      current: number;
      size: number;
    }

    type DeptList = Common.PaginatingCommonParams<Dept>;

    type DeptTree = Dept[];
  }
}
```

**技术要点**：
- 使用 `declare namespace` 组织全局类型，避免分散导入
- `Common.EnableStatus` 复用已有类型，保持统一
- `PaginatingCommonParams` 复用分页结构，后端返回统一格式

#### 任务 2：API 函数编写（`src/service/api/org.ts`）

```typescript
import { request } from '../request';

/**
 * Get department page list
 *
 * @param params search params
 */
export function fetchGetDeptPage(params?: Api.Org.DeptSearchParams) {
  return request<Api.Org.DeptList>({
    url: '/org/dept/page',
    method: 'get',
    params
  });
}

/** Get department tree */
export function fetchGetDeptTree() {
  return request<Api.Org.DeptTree>({
    url: '/org/dept/tree',
    method: 'get'
  });
}

/**
 * Add department
 *
 * @param data department data
 */
export function fetchAddDept(data: Api.Org.Dept) {
  return request<Api.Org.Dept>({
    url: '/org/dept',
    method: 'post',
    data
  });
}

/**
 * Update department
 *
 * @param id department id
 * @param data department data
 */
export function fetchUpdateDept(id: number, data: Api.Org.Dept) {
  return request<Api.Org.Dept>({
    url: `/org/dept/${id}`,
    method: 'put',
    data
  });
}

/**
 * Delete department
 *
 * @param id department id
 */
export function fetchDeleteDept(id: number) {
  return request({
    url: `/org/dept/${id}`,
    method: 'delete'
  });
}
```

**技术要点**：
- 命名严格遵循 `fetch + 动词 + 名词`：`fetchGetDeptPage`、`fetchAddDept`、`fetchUpdateDept`、`fetchDeleteDept`
- 每个函数有 JSDoc 注释，说明参数含义
- `params` 用于 GET 查询参数，`data` 用于 POST/PUT 请求体
- 返回类型使用 `request<Api.Org.DeptList>`，确保响应数据有类型约束

#### 任务 3：理解 `request` vs `demoRequest` 的区别

在 `src/service/request/index.ts` 中，同时存在 `request` 和 `demoRequest`：

```typescript
// request: 主业务请求，使用 createFlatRequest
export const request = createFlatRequest<App.Service.Response, RequestInstanceState>(...);

// demoRequest: 演示/第三方请求，使用 createRequest
export const demoRequest = createRequest<App.Service.DemoResponse>(...);
```

| 对比维度 | `request` | `demoRequest` |
|---------|----------|---------------|
| 创建函数 | `createFlatRequest` | `createRequest` |
| 成功码判断 | `code === VITE_SERVICE_SUCCESS_CODE` | `status === '200'` |
| 数据提取 | `response.data.data` | `response.data.result` |
| Token 获取 | `getAuthorization()`（统一封装） | 直接读 `localStg`（自行拼接） |
| 错误处理 | 完整：logout / modal / expired / 消息去重 | 简化：仅弹窗消息 |
| 应用场景 | carlos-framework 后端联调 | 第三方接口 / 演示数据 |

> **为什么这样设计？** 因为 carlos-framework 后端有统一的响应格式 `{code, msg, data}`，而第三方接口可能使用不同格式。`createRequest` 和 `createFlatRequest` 的底层都是 `createCommonRequest`，只是上层封装不同，保持了 DRY 原则。

### 第三步：整合与调试

**整合检查清单**：

1. **类型检查**：运行 `pnpm typecheck`，确保没有类型错误
2. **ESLint 检查**：运行 `pnpm lint`，确保代码风格符合规范
3. **实际联调**：
   - 确认 `.env.development` 中 `VITE_SERVICE_URL` 指向正确的 Java 后端地址
   - 确认 Java 后端已启动且 CORS 配置正确
   - 使用浏览器 Network 面板观察请求/响应

**调试技巧**：

| 问题 | 排查方法 |
|------|---------|
| 请求 404 | 检查 `baseURL` + `url` 拼接是否正确，检查 Java 后端接口路径 |
| 请求 401 | 检查 `Authorization` Header 是否携带，检查 Token 是否过期 |
| 业务码非 0000 | 在 `onBackendFail` 中打断点，检查 `response.data.code` 和配置的错误码映射 |
| Token 刷新死循环 | 确保 `fetchRefreshToken` 返回的错误码不在 `expiredTokenCodes` 中 |
| 请求未取消 | 检查是否正确使用了 `request.cancelRequest(requestId)` |

### 验收标准

- [x] **能用**：API 函数能正确调用后端接口，返回数据类型正确
- [x] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过
- [x] **精进**：API 函数零 `any`，类型复用 `Api.Org` 命名空间，JSDoc 完整，导入顺序正确

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `createFlatRequest` | 返回 `{data, error}` 永不抛异常 | `Result<T, E>` | 错误即数据，适合 Vue 模板消费 |
| `createRequest` | 成功返回数据，失败抛异常 | `ResponseEntity<T>` | 传统命令式风格，需 try/catch |
| 请求拦截器 | 请求发送前附加 Header/Token | `ClientHttpRequestInterceptor` | 可在拦截器中使用 `useAuthStore()`（依赖注入） |
| 响应拦截器 | 收到响应后判断业务码 | `ResponseErrorHandler` | 需要区分 HTTP 码和业务码（200 但业务失败） |
| Token 刷新队列 | Promise 缓存防止并发刷新 | `synchronized` + `Future` | 用 `setTimeout` 做缓存失效，而非 `finally` |
| AbortController | 主动取消未完成的请求 | `Future.cancel()` | 页面切换时必须取消，防内存泄漏 |
| 错误消息去重 | `errMsgStack` 数组记录已弹消息 | `ConcurrentHashMap` + TTL | 用户只有一个屏幕，需控制频率 |
| `fetch + 动词 + 名词` | API 函数命名规范 | `getUserList()` / `saveUser()` | 统一前缀 `fetch`，一眼识别是 API 调用 |
| `params` vs `data` | GET 用 `params`，POST/PUT 用 `data` | `@RequestParam` vs `@RequestBody` | Axios 自动处理序列化，`params` 会拼到 URL |

---

## 代码规范速查（今日新增）

### API 函数规范

```typescript
// ✅ 正确：fetch + 动词 + 名词，JSDoc 完整，类型明确
/**
 * Get user list
 *
 * @param params search params
 */
export function fetchGetUserList(params?: Api.SystemManage.UserSearchParams) {
  return request<Api.SystemManage.UserList>({
    url: '/org/user/page',
    method: 'get',
    params
  });
}

// ❌ 错误：缺少 JSDoc，命名不规范，返回类型 any
export function getUsers(params: any) {
  return request<any>({ url: '/users', method: 'get', params });
}
```

### 导入顺序规范

```typescript
// 1. type 导入
import type { AxiosResponse } from 'axios';

// 2. 第三方库
import { BACKEND_ERROR_CODE, createFlatRequest } from '@sa/axios';

// 3. 内部模块（按 store/hooks/utils 排序）
import { useAuthStore } from '@/store/modules/auth';
import { localStg } from '@/utils/storage';
import { $t } from '@/locales';

// 4. 相对路径
import { getAuthorization } from './shared';
import type { RequestInstanceState } from './type';
```

---

## 明日预告

**第28天：Vue I18n 国际化 — 多语言支持**

我们将学习：
- `$t()` 的工作原理与 `MessageSource` 的对比
- `src/locales/` 目录的组织结构
- 异步加载语言包、复数规则、组件内插值
- 为 carlos-ui 添加新的翻译键值

> **关键问题**：为什么前端国际化不是简单的 "key → value" 映射？组件插值、复数规则、日期格式化，前端需要做哪些 Java 后端不需要做的事？

---

> **课后思考题**：
> 1. 为什么 `handleExpiredRequest` 使用 `setTimeout(..., 1000)` 而不是在 `handleRefreshToken` 的 `finally` 中清理？两种方式的优缺点是什么？
> 2. `createFlatRequest` 返回的 `error` 是 `AxiosError` 类型，但业务代码通常只需要 `error.response?.data?.msg`，如何在 `onError` 中做更友好的错误信息提取？
> 3. 如果 Java 后端需要切换为 `fetch` API（而非 Axios），`@sa/axios` 的封装层需要改动哪些部分？哪些部分可以复用？
