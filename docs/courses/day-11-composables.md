# 今日前端课程 — 第11天：组合式函数（Composables）— Vue 的"静态工具方法"

> **学习目标**
> - **能读**：理解 Composable 的本质——函数式封装 + 响应式状态 + 生命周期管理
> - **能用**：能从业务逻辑中提取可复用逻辑，封装为 `useXxx` 函数；能在组件中正确调用多个 Composable 并组合使用
> - **规范**：命名 `useXxx`（camelCase）、类型完整、导入顺序正确、纯逻辑与副作用分离
> - **精进**：理解 `effectScope` 与 `onScopeDispose` 的作用；能判断何时提取 Composable 而非直接写在组件内
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + AntDV + Pinia + UnoCSS

---

## 理论学习

### 核心知识点

#### 1. 什么是 Composable？

> A "composable" is a function that **leverages Vue's Composition API** to encapsulate and reuse **stateful logic**.
> —— Vue 官方文档

一句话：**Composable 是用函数封装"有状态的逻辑"，让别人可以像调用工具方法一样复用这段逻辑。**

它不是"工具函数"（utility），因为工具函数是纯函数（无状态、无副作用）。Composable 内部可以：
- 持有响应式状态（`ref` / `reactive`）
- 使用 Vue 生命周期（`onMounted` / `onUnmounted` / `onScopeDispose`）
- 访问其他 Composable（`useXxx` 嵌套调用）

#### 2. Composable 的命名铁律

**必须以 `use` 开头，camelCase：**

| ✅ 正确 | ❌ 错误 |
|-------|-------|
| `useBoolean` | `booleanHook` |
| `useLoading` | `loadingHook` |
| `useTable` | `TableHook` |
| `useRouterPush` | `routerPush` |
| `useCaptcha` | `captcha` |

这个约定不是建议，是**Vue 生态的全球共识**。IDE 和工具链都靠这个前缀识别 Composable。

#### 3. Composable 与 VueUse 的关系

- **VueUse**：社区维护的通用 Composable 库（200+ 个），类似 Java 的 Apache Commons
- **@sa/hooks**：项目内部封装的通用 Composable（`useBoolean`, `useLoading`, `useCountDown` 等）
- **src/hooks/**：项目业务级 Composable（`useAuth`, `useCaptcha`, `useTable`）

**规则**：先用 VueUse，没有再自己写。项目内部已有 `@sa/hooks`，优先使用。

#### 4. Composable 的三种"来源"

| 来源 | 位置 | 示例 | 复用范围 |
|------|------|------|---------|
| 第三方库 | `@vueuse/core` | `useElementSize`, `useFetch` | 全局 |
| 项目内部包 | `packages/hooks/src/` | `useBoolean`, `useHookTable` | 多个项目 |
| 项目业务级 | `src/hooks/` | `useAuth`, `useCaptcha` | 本项目 |

#### 5. 关键概念：`effectScope` 与 `onScopeDispose`

- `effectScope()`：创建一个作用域，里面的 `watch`/`computed` 会在作用域停止时自动清理
- `onScopeDispose()`：在作用域销毁时执行清理（类似 Java 的 `@PreDestroy`）

**为什么重要？** 在 Composable 中创建 `watch` 时，如果不声明作用域，组件卸载后 watcher 可能仍在运行，导致内存泄漏。

---

### Java 思维类比

> **Composable ≈ Java 的 `UtilityClass` + `Spring Bean` 的混合体**

| 前端概念 | Java 类比 | 说明 |
|---------|---------|------|
| `useBoolean()` | `AtomicBoolean` + getter/setter | 包装一个布尔值，提供原子操作 |
| `useLoading()` | `ReentrantLock` 的状态封装 | 封装 loading 状态切换逻辑 |
| `useTable()` | `Service` 层 + `DAO` 层 | 封装分页、列控制、数据获取 |
| `useRouterPush()` | `NavigationService` | 封装路由跳转逻辑 |
| `useAuth()` | `PermissionService` | 封装权限判断逻辑 |
| `useCaptcha()` | `SmsService` | 封装验证码发送逻辑 |
| Composable 嵌套 | `Service` 注入 `DAO` | `useLoading` 调用 `useBoolean` |
| `effectScope` | `try-with-resources` / `Scope` | 资源自动清理 |

**核心差异**：
- Java 的静态工具方法是"纯逻辑"，不持有状态。
- Vue 的 Composable 是"有状态的服务"，每次调用 `useXxx()` 都会创建**独立的状态实例**。

---

### 超越类比 — 前端独有的设计哲学

> **为什么前端不直接写"静态工具类"，而是要有 Composable？**

#### 原因1：响应式是"传染性的"

Java 的工具方法返回的是**静态结果**。Composable 返回的是**响应式引用**。当 Composable 内部的状态变化时，**所有使用这个状态的组件自动更新**。这不是 Java 的观察者模式能简单实现的——Vue 的 Proxy 依赖追踪是**自动的、细粒度的**。

#### 原因2：生命周期是"函数级的"

Java 的 Bean 生命周期是容器管理的。Vue 的 Composable 生命周期是**调用方组件的**——`onMounted` 在调用组件挂载时触发，`onScopeDispose` 在调用组件卸载时触发。这意味着同一个 Composable 在不同组件中调用，生命周期各自独立。

#### 原因3：组合优于继承

Java 的复用主要靠继承和组合（`@Autowired`）。Vue 的 Composable 是**函数级组合**——你可以在 `setup()` 中自由组合多个 Composable，不需要继承任何基类。这是前端"函数式"思维的核心。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

| 文件 | 路径 | 说明 |
|------|------|------|
| useBoolean | `packages/hooks/src/use-boolean.ts` | 最基础的 Composable，理解状态封装 |
| useLoading | `packages/hooks/src/use-loading.ts` | 组合式 Composable，基于 useBoolean |
| useCountDown | `packages/hooks/src/use-count-down.ts` | 带生命周期和副作用的 Composable |
| useHookTable | `packages/hooks/src/use-table.ts` | 复杂业务逻辑 Composable |
| useTable | `src/hooks/common/table.ts` | 项目级表格 Composable，组合 useHookTable |
| useRouterPush | `src/hooks/common/router.ts` | 路由操作 Composable |
| useAuth | `src/hooks/business/auth.ts` | 权限判断 Composable |
| useCaptcha | `src/hooks/business/captcha.ts` | 验证码业务 Composable |
| useFormRules | `src/hooks/common/form.ts` | 表单规则 Composable |

### 阅读指引

#### 阅读顺序（从简到繁）

**第一层：useBoolean — 最简 Composable**

```typescript
import {ref} from 'vue';

export default function useBoolean(initValue = false) {
  const bool = ref(initValue);

  function setBool(value: boolean) { bool.value = value; }
  function setTrue() { setBool(true); }
  function setFalse() { setBool(false); }
  function toggle() { setBool(!bool.value); }

  return { bool, setBool, setTrue, setFalse, toggle };
}
```

**问自己**：
1. 为什么返回 `bool`（一个 ref）而不是原始值？→ 因为需要响应式
2. 为什么提供 `setTrue`/`setFalse`/`toggle`？→ 减少调用方的样板代码
3. 如果两个组件都调用 `useBoolean()`，它们的状态共享吗？→ **不共享**，各自独立

**第二层：useLoading — 组合式 Composable**

```typescript
import useBoolean from './use-boolean';

export default function useLoading(initValue = false) {
  const {bool: loading, setTrue: startLoading, setFalse: endLoading} = useBoolean(initValue);
  return { loading, startLoading, endLoading };
}
```

**问自己**：
1. 这是"继承"还是"组合"？→ 组合（内部调用 `useBoolean`）
2. 为什么重命名返回值？→ `bool` → `loading`，语义更明确
3. 为什么不直接返回 `useBoolean` 的全部方法？→ 只暴露业务需要的（隐藏 `toggle`）

**第三层：useCountDown — 带副作用的 Composable**

```typescript
import {computed, onScopeDispose, ref} from 'vue';
import {useRafFn} from '@vueuse/core';

export default function useCountDown(seconds: number) {
  const FPS_PER_SECOND = 60;
  const fps = ref(0);
  const count = computed(() => Math.ceil(fps.value / FPS_PER_SECOND));
  const isCounting = computed(() => fps.value > 0);

  const {pause, resume} = useRafFn(() => {
    if (fps.value > 0) { fps.value -= 1; } else { pause(); }
  }, {immediate: false});

  function start(updateSeconds: number = seconds) {
    fps.value = FPS_PER_SECOND * updateSeconds;
    resume();
  }

  function stop() { fps.value = 0; pause(); }

  onScopeDispose(() => { pause(); });  // ← 关键！组件卸载时清理

  return { count, isCounting, start, stop };
}
```

**问自己**：
1. 为什么用 `useRafFn` 而不是 `setInterval`？→ 请求动画帧，页面不可见时自动暂停，更省电
2. 为什么用 `fps` 计数而不是直接秒数？→ 基于帧的倒计时更精确，不受 `setInterval` 漂移影响
3. `onScopeDispose` 的作用？→ 组件卸载时自动停止动画，**防止内存泄漏**

**第四层：useHookTable / useTable — 复杂业务 Composable**

`useHookTable`（`packages/hooks/src/use-table.ts`）是通用表格逻辑封装：
- 加载状态 (`useLoading`)
- 空状态 (`useBoolean`)
- 数据转换（`transformer`）
- 列控制（`getColumnChecks` / `getColumns`）
- 搜索参数（`searchParams`）
- 立即获取数据（`immediate`）

`useTable`（`src/hooks/common/table.ts`）在此基础上添加：
- 分页逻辑（`pagination` / `mobilePagination`）
- 表格滚动（`useTableScroll`）
- 语言切换时重新加载列（`watch` + `effectScope`）

**关键代码段（`useTable` 中的 `effectScope` 使用）：**

```typescript
const scope = effectScope();

scope.run(() => {
  watch(() => appStore.locale, () => { reloadColumns(); });
});

onScopeDispose(() => { scope.stop(); });
```

**问自己**：
1. 为什么不用 `watch` 直接放在 `useTable` 顶层？→ 因为 `useTable` 可能在非 setup 上下文中被调用，需要显式管理作用域
2. `effectScope` 比直接在组件里 `watch` 的优势？→ 当 Composable 被提取为独立函数时，作用域需要显式控制

**第五层：useTableOperate — 表格操作 Composable**

```typescript
export function useTableOperate<T extends TableData = TableData>(data: Ref<T[]>, getData: () => Promise<void>) {
  const {bool: drawerVisible, setTrue: openDrawer, setFalse: closeDrawer} = useBoolean();
  const operateType = ref<AntDesign.TableOperateType>('add');
  const editingData: Ref<T | null> = ref(null);
  const checkedRowKeys: Ref<T['id'][]> = ref([]);

  function handleAdd() { operateType.value = 'add'; openDrawer(); }
  function handleEdit(id: T['id']) { /* ... */ }
  // ...

  return { drawerVisible, operateType, editingData, handleAdd, handleEdit, /* ... */ };
}
```

**问自己**：
1. 为什么接收 `data: Ref<T[]>` 和 `getData` 作为参数？→ 解耦——不依赖特定的 API，只依赖"数据"和"刷新方法"
2. 泛型 `<T extends TableData>` 的作用？→ 类型安全，让 `editingData` 和 `handleEdit` 的类型与传入数据一致

**第六层：useRouterPush — 带路由知识的 Composable**

```typescript
export function useRouterPush(inSetup = true) {
  const router = inSetup ? useRouter() : globalRouter;
  const route = globalRouter.currentRoute;

  async function toLogin(loginModule?: UnionKey.LoginModule, redirectUrl?: string) {
    const module = loginModule || 'pwd-login';
    const redirect = redirectUrl || route.value.fullPath;
    return routerPushByKey('login', { params: { module }, query: { redirect } });
  }

  async function redirectFromLogin(needRedirect = true) {
    const redirect = route.value.query?.redirect as string;
    if (needRedirect && redirect) { await routerPush(redirect); } else { await toHome(); }
  }

  return { routerPush, routerBack, routerPushByKey, toLogin, redirectFromLogin, /* ... */ };
}
```

**问自己**：
1. `inSetup` 参数的作用？→ 兼容 setup 内和 setup 外的调用（`useRouter()` 只能在 setup 内调用）
2. 为什么用 `globalRouter` 作为 fallback？→ 在非 setup 场景（如拦截器）中也能使用

---

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| **命名规范** | 函数以 `use` 开头，camelCase | ✅ `useBoolean`, `useLoading`, `useTable` 全部符合 |
| **类型完整性** | 零 any，参数/返回值有类型 | ✅ `useBoolean` 有 `initValue: boolean`；`useTable` 有泛型 `<A extends AntDesign.TableApiFn>`；⚠️ `useHookTable` 的 `ApiFn` 有 `args: any`（一处可优化） |
| **目录规范** | 通用放 `common/`，业务放 `business/`，内部包放 `packages/hooks/` | ✅ 严格分层：`packages/hooks/`（通用）→ `src/hooks/common/`（项目通用）→ `src/hooks/business/`（业务） |
| **导入顺序** | type → 第三方 → 内部 → 相对 | ✅ 所有文件遵循：`import type` → `vue`/`@vueuse/core` → `@sa/xxx` → `@/store/` → `./use-boolean` |
| **错误处理** | 异步有 try/catch 或统一拦截 | ⚠️ `useHookTable.getData()` 直接 `await apiFn()`，没有 try/catch。项目中通过 `@sa/axios` 的拦截器统一处理，**这是设计选择**——让调用方通过拦截器处理，而非每个 Composable 内 catch。但在 Composable 内部添加 catch 可以增强鲁棒性。 |
| **可测试性** | 纯逻辑可单测，副作用可 mock | ✅ `useBoolean` 是纯逻辑，可单测；`useCountDown` 依赖 `useRafFn`（VueUse），可通过 mock 测试；`useTable` 依赖 `apiFn`，可通过传入 mock 函数测试 |
| **国际化** | 用户可见字符串使用 `$t()` | ✅ `useCaptcha` 和 `useFormRules` 全部使用 `$t()`；`useTable` 的列标题通过组件传入 `$t()` |
| **JSDoc** | 复杂函数有注释 | ✅ `useRouterPush` 和 `useHookTable` 有完整 JSDoc；⚠️ `useBoolean` 和 `useLoading` 较为简单，注释也可，但可加更详细说明 |

---

## 功能实践 — 分三步

### 第一步：分析与拆解

**任务**：封装一个 `usePagination` Composable，用于管理分页逻辑（页码、页大小、总条数、跳转）。

**拆解成小任务**：
1. 定义分页状态（currentPage, pageSize, total）
2. 提供页码变更方法（changePage, changeSize）
3. 提供重置方法（reset）
4. 提供计算属性（hasNextPage, hasPrevPage, totalPages）
5. 支持传入回调函数（onChange 时自动调用）
6. 添加类型安全（泛型页码参数类型）

### 第二步：小任务开发

#### 小任务1：定义状态和方法

```typescript
// src/hooks/common/pagination.ts
import {computed, ref} from 'vue';

export interface PaginationOptions {
  initialPage?: number;
  initialSize?: number;
  onChange?: (page: number, size: number) => void;
}

export function usePagination(options: PaginationOptions = {}) {
  const { initialPage = 1, initialSize = 10, onChange } = options;

  const currentPage = ref(initialPage);
  const pageSize = ref(initialSize);
  const total = ref(0);

  function changePage(page: number) {
    if (page < 1) return;
    currentPage.value = page;
    onChange?.(currentPage.value, pageSize.value);
  }

  function changeSize(size: number) {
    pageSize.value = size;
    currentPage.value = 1; // 切换页大小，回到第一页
    onChange?.(currentPage.value, pageSize.value);
  }

  function reset() {
    currentPage.value = initialPage;
    pageSize.value = initialSize;
    total.value = 0;
  }

  return {
    currentPage,
    pageSize,
    total,
    changePage,
    changeSize,
    reset
  };
}
```

**技术要点**：
- 使用 `ref` 定义状态（基本类型用 `ref`）
- 参数使用 `options` 对象（便于扩展，避免参数过多）
- 提供合理的默认值（`initialPage = 1`, `initialSize = 10`）

#### 小任务2：添加计算属性

```typescript
  const totalPages = computed(() => {
    if (total.value <= 0 || pageSize.value <= 0) return 0;
    return Math.ceil(total.value / pageSize.value);
  });

  const hasNextPage = computed(() => currentPage.value < totalPages.value);
  const hasPrevPage = computed(() => currentPage.value > 1);
  const isEmpty = computed(() => total.value === 0);
```

**技术要点**：
- `computed` 缓存计算结果，避免重复计算
- 边界条件处理（`total <= 0` 时返回 0）

#### 小任务3：完整版本（带类型和边界检查）

```typescript
// src/hooks/common/pagination.ts
import {computed, ref} from 'vue';

export interface PaginationOptions {
  /** 初始页码 */
  initialPage?: number;
  /** 初始页大小 */
  initialSize?: number;
  /** 页码或页大小变化时的回调 */
  onChange?: (page: number, size: number) => void;
  /** 最大页码限制 */
  maxPage?: number;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  total: number;
}

export function usePagination(options: PaginationOptions = {}) {
  const { initialPage = 1, initialSize = 10, onChange, maxPage } = options;

  const currentPage = ref(initialPage);
  const pageSize = ref(initialSize);
  const total = ref(0);

  const totalPages = computed(() => {
    if (total.value <= 0 || pageSize.value <= 0) return 0;
    return Math.ceil(total.value / pageSize.value);
  });

  const hasNextPage = computed(() => currentPage.value < totalPages.value);
  const hasPrevPage = computed(() => currentPage.value > 1);
  const isEmpty = computed(() => total.value === 0);

  function changePage(page: number) {
    if (page < 1) return;

    const limit = maxPage || totalPages.value;
    if (limit > 0 && page > limit) {
      currentPage.value = limit;
    } else {
      currentPage.value = page;
    }

    onChange?.(currentPage.value, pageSize.value);
  }

  function changeSize(size: number) {
    if (size < 1) return;
    pageSize.value = size;
    currentPage.value = 1;
    onChange?.(currentPage.value, pageSize.value);
  }

  function setTotal(value: number) {
    total.value = value >= 0 ? value : 0;
    // 如果当前页超过总页数，自动调整到最后一页
    if (totalPages.value > 0 && currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value;
    }
  }

  function reset() {
    currentPage.value = initialPage;
    pageSize.value = initialSize;
    total.value = 0;
  }

  return {
    currentPage,
    pageSize,
    total,
    totalPages,
    hasNextPage,
    hasPrevPage,
    isEmpty,
    changePage,
    changeSize,
    setTotal,
    reset
  };
}
```

### 第三步：整合与测试

**测试思路**：
1. 在 `src/views/manage/user/index.vue` 中，将原有的 `pagination` 逻辑替换为 `usePagination`
2. 验证页码切换、页大小切换、总条数更新是否正确
3. 验证边界条件（total=0、切换页大小后页码重置）

**使用示例**：

```typescript
// 在组件中使用
import {usePagination} from '@/hooks/common/pagination';
import {fetchGetUserList} from '@/service/api';

const {currentPage, pageSize, total, changePage, changeSize, setTotal, reset} = usePagination({
  onChange: async (page, size) => {
    const res = await fetchGetUserList({ current: page, size });
    setTotal(res.data?.total || 0);
  }
});
```

### 验收标准

- [x] **能用**：`usePagination` 可在组件中正常调用，页码/页大小/总条数管理正确
- [x] **规范**：文件命名 `pagination.ts`（camelCase），函数命名 `usePagination`，有完整类型定义
- [x] **精进**：包含边界检查（`page < 1` 时 return），包含自动调整（当前页超过总页数时自动调整），计算属性使用 `computed` 缓存

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| **Composable** | 用函数封装有状态的逻辑 | `UtilityClass` + `Spring Bean` | 自动响应式，自动关联调用组件的生命周期 |
| **useBoolean** | 封装布尔值及其切换逻辑 | `AtomicBoolean` + 操作方法 | `.value` 解包 + Vue 自动追踪依赖 |
| **useLoading** | 基于 useBoolean 的 loading 状态 | `ReentrantLock` 状态封装 | 组合而非继承——内部调用 useBoolean |
| **useCountDown** | 基于 requestAnimationFrame 的倒计时 | `ScheduledExecutorService` | `useRafFn` 在页面不可见时自动暂停，省电 |
| **effectScope** | 显式管理 watcher 的作用域 | `try-with-resources` | 在 Composable 中创建 watcher 时，必须显式管理，否则组件卸载后可能内存泄漏 |
| **useHookTable** | 通用表格逻辑封装 | `BaseService<T>` + `BaseDAO<T>` | 泛型 + 回调函数式配置（transformer / onFetched） |
| **useRouterPush** | 封装路由跳转逻辑 | `NavigationService` | `inSetup` 参数兼容 setup 内外调用 |
| **useAuth** | 封装权限判断 | `PermissionService` | 直接读取 Pinia Store 的响应式状态 |
| **命名铁律** | 必须以 `use` 开头 | 无强制前缀（Java 是 `get`/`set`/`is`） | 生态约定，`use` 前缀是 IDE 和工具链识别 Composable 的标志 |
| **状态独立性** | 每次调用创建独立状态 | 单例 Bean（默认共享） | 不同组件调用 `useBoolean()` 各自独立——这是 Vue 的设计，不是 bug |

---

## 进阶思考题

1. **为什么 `useBoolean` 返回 `bool`（ref）而不是 `boolean`？**
   > 如果返回 `boolean`，值会丢失响应式。只有返回 `ref`，调用方才能 `bool.value = true`，并且 Vue 能追踪这个变化。

2. **如果需要在两个组件间共享 `useBoolean` 的状态，怎么做？**
   > 不能直接用 `useBoolean`（它每次调用创建独立实例）。需要把状态提升到 Pinia Store，或者使用 `provide/inject`，或者将 `useBoolean` 放在外部模块级作用域（不推荐，因为热更新会重置）。

3. **为什么 `useTable` 中的 `watch` 要放在 `effectScope` 里？**
   > 因为 `useTable` 可能在非 setup 上下文中被调用（比如被另一个 Composable 调用）。`effectScope` 确保 watcher 有明确的生命周期，可以在 `onScopeDispose` 时停止。如果直接写在组件 setup 里，Vue 会自动管理；但在 Composable 内部，显式管理更安全。

---

**明日预告**：第12天 — **单文件组件（SFC）与 `<script setup>` 语法糖** — 深入理解 `.vue` 文件的编译原理、`defineProps`/`defineEmits` 的类型推导、以及为什么 `<script setup>` 比传统写法更好。

---

> 📌 **朱军专属提醒**：
> 
> 今天学的是 Vue 3 最核心的概念之一——**Composable**。这是 Vue 从"框架"走向"生态"的关键设计。
> 
> 你作为 Java 架构师，可能会本能地想"这不就是工具类吗？"。但请记住：**Composable 不是工具类，而是"有状态的服务"**。每个 `useXxx()` 调用都会创建一个独立的响应式实例，生命周期绑定到调用它的组件。
> 
> 这种设计让前端代码拥有了**极高的组合性**——你可以像搭积木一样把多个 Composable 拼在一起，而不需要继承任何基类。这是 Java 的"继承+组合"模式所不具备的灵活性。
> 
> 明天我们将深入 `<script setup>` 的编译原理，理解为什么 Vue 3 要放弃 `this` 和 Options API，转向函数式组合。这将是你理解 Vue 3 设计哲学的关键一天。
