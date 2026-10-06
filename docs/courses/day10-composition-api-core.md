# 今日前端课程 — 第10天：Composition API 核心 — setup、ref、reactive

> **学习目标**
> - 能读：看懂 `carlos-ui` 中 `ref`/`reactive`/`computed` 的用法和意图
> - 能用：用 `ref` 和 `reactive` 分别实现状态管理，能写出带类型推导的响应式代码
> - 规范：遵循 `useXxxStore` 的 Pinia Composition API 风格，命名和类型完整
> - 精进：理解 `ref` 的 `.value` 解包机制 vs `reactive` 的对象代理，能解释为什么 carlos-ui 的 `userInfo` 用 `reactive` 而 `token` 用 `ref`
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + Pinia

---

## 理论学习

### 核心知识点

#### 1. ref — 单值的响应式容器

`ref` 是 Vue 3 中最基础的响应式原语。它把任意值包装成一个**响应式对象**，通过 `.value` 读写。

```typescript
import { ref } from 'vue';

// 基本类型
const count = ref(0);        // Ref<number>
const name = ref('');        // Ref<string>
const visible = ref(false);  // Ref<boolean>

// 读取：必须 .value
console.log(count.value); // 0

// 修改：必须 .value
count.value++;

// 对象类型（也可以，但通常用 reactive）
const user = ref({ id: 1, name: 'Alice' });
user.value.name = 'Bob'; // 深层响应式（因为 Vue 3 的 ref 内部也会用 reactive 处理对象）
```

**为什么叫 `ref`？**
> 类比 Java 的 `AtomicReference<T>` — 它是一个"引用包装器"，引用本身不变，引用的值可变。每次 `.value` 赋值都会触发依赖追踪和更新。

#### 2. reactive — 对象的响应式代理

`reactive` 只对**对象**有效（不能包装基本类型），返回一个 Proxy 代理对象。直接访问属性，**不需要 `.value`**。

```typescript
import { reactive } from 'vue';

const userInfo = reactive({
  userId: '',
  userName: '',
  roles: [] as string[]
});

// 直接访问属性 — 无 .value
userInfo.userName = 'admin';
userInfo.roles.push('SUPER');
```

**关键限制：解构或重新赋值会丢失响应式**

```typescript
// ❌ 错误：解构后失去响应式
const { userName } = userInfo; // userName 只是一个普通字符串！

// ❌ 错误：重新赋值整个对象，响应式连接断裂
userInfo = { userId: '2', userName: 'guest' }; // 编译错误：reactive 返回值不能重新赋值

// ✅ 正确：使用 Object.assign 保持响应式
Object.assign(userInfo, { userId: '2', userName: 'guest' });
```

#### 3. ref vs reactive — 选择指南

| 场景 | 推荐 | 原因 |
|------|------|------|
| 基本类型（string/number/boolean） | `ref` | reactive 不支持基本类型 |
| 需要替换整个对象 | `ref` | `user.value = newObj` 合法，`reactive` 不能重新赋值 |
| 复杂对象，只修改属性 | `reactive` | 无需 `.value`，代码更简洁 |
| 需要解构 / 展开 | `ref` + `toRefs` | reactive 解构会丢失响应式 |
| 数组（需要替换整个数组） | `ref` | `list.value = newArray` 合法 |
| 表单数据对象 | `reactive` | 属性访问更直观，减少 `.value` 噪音 |
| 跨函数传递状态 | `ref` | 作为单一值更容易传递和类型标注 |

> **carlos-ui 的实战经验**：`token` 是字符串（基本类型），用 `ref`；`userInfo` 是复杂对象（需要逐个属性修改），用 `reactive`。这不是随意选择，而是**类型特征驱动的决策**。

#### 4. computed — 缓存的计算属性

```typescript
import { computed, ref } from 'vue';

const token = ref('');
const isLogin = computed(() => Boolean(token.value)); // 自动依赖 token，缓存结果

// 带 setter 的 computed（较少用）
const fullName = computed({
  get: () => `${firstName.value} ${lastName.value}`,
  set: (val) => {
    [firstName.value, lastName.value] = val.split(' ');
  }
});
```

`computed` 的**缓存特性**非常关键：只有依赖的响应式值变化时，才会重新计算。这与 Java 中手动缓存的 `getter` 方法（如 `getIsLogin()`）相比，Vue 自动处理了依赖追踪和缓存失效。

#### 5. setup() 的执行时机与 `<script setup>` 语法糖

Vue 3 的 `setup()` 函数在**组件实例创建之前**执行，此时还没有 `this`。它是组件的逻辑入口。

```typescript
// 传统写法（Options API 中）
export default {
  setup() {
    const count = ref(0);
    return { count };
  }
};

// <script setup> 语法糖（编译时自动展开为 setup()）
<script setup lang="ts">
const count = ref(0);
// 无需 return，所有顶层变量自动暴露给模板
</script>
```

`<script setup>` 的编译结果：
- 所有 `import` 保留
- 所有顶层变量/函数自动注入 `setup()` 的返回对象
- `defineProps` / `defineEmits` / `defineOptions` 是编译器宏，不成为运行时函数

---

### Java 思维类比

| 前端概念 | Java 类比 | 关键差异 |
|---------|----------|---------|
| `ref(0)` | `AtomicInteger` / `AtomicReference` | JS 没有显式类型，但 `.value` 的读写仪式感很像 `.get()` / `.set()` |
| `reactive({})` | `ObservableMap` / `PropertyChangeSupport` | Proxy 是语言级拦截，比 Java 的手动 `addPropertyChangeListener` 更透明 |
| `computed()` | 带缓存的 `getter` 方法 | Java 需要手动维护缓存状态，Vue 自动依赖追踪和缓存失效 |
| `watch()` | `PropertyChangeListener` | 前端是声明式的（"当A变时执行B"），Java 是手动注册监听器 |
| `setup()` | 构造函数 + `@PostConstruct` | 前端没有 `this`，所有状态通过闭包和返回对象暴露 |
| `effectScope()` | 资源管理器 / `try-finally` | 批量管理副作用的生命周期，销毁时自动 cleanup |

### 超越类比 — 前端独有的设计哲学

> **1. 响应式是"推"的，不是"拉"的**
>
> Java 中，你写 `if (user.isLogin())` 时，每次调用都会重新计算。Vue 的 `computed` 是**惰性求值 + 缓存**：只在依赖变化时重新计算，读取时直接返回缓存。这是"推"模型（依赖变化推送给计算属性），而不是"拉"模型（每次读取都重新计算）。
>
> **2. 副作用是显式的，不是隐式的**
>
> Java 中， setter 方法里可以偷偷做很多事（发消息、改数据库、通知观察者）。Vue 的 `watch` 和 `watchEffect` 把副作用从"属性的 setter 中"抽离出来，变成独立的、显式的声明。这让代码更易追踪和测试。
>
> **3. 没有 `this`，只有闭包**
>
> Java 开发者习惯 `this.xxx` 来访问实例状态。Vue 3 的 Composition API 完全基于函数和闭包，状态在 `setup()` 的作用域中定义，通过返回值暴露。这强迫你思考"这个数据真正属于谁"，而不是"这个类有哪些字段"。结果是更细粒度的状态复用（通过 composable 函数），而不是更粗粒度的类继承。
>
> **4. Proxy 是"透明的"，POJO 不需要修改**
>
> Java 的响应式库（如 JavaFX 的 `SimpleStringProperty`）要求你把字段改成特殊的属性类型。Vue 的 `reactive` 用 Proxy 拦截普通对象的读写，**原始对象无需修改**。这意味着你可以把后端返回的 JSON 直接 `reactive(json)`，它立刻变成响应式的。这是 Java 中不可能做到的（除非用字节码增强）。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

- `src/store/modules/auth/index.ts` — `ref` / `reactive` / `computed` 在 Pinia Store 中的真实用法
- `src/store/modules/app/index.ts` — `effectScope` + `watch` 管理副作用生命周期
- `src/hooks/common/form.ts` — `ref` 在 Hook 中的用法（`formRef` 获取 DOM 实例）
- `src/views/manage/user/index.vue` — 页面级 `<script setup>` + TSX 中 `ref` 的隐式解包

### 阅读指引：auth Store

1. **看状态定义**：`token` 是 `ref<string | null>`，`userInfo` 是 `reactive<Api.Auth.UserInfo>`
2. **看计算属性**：`isLogin` 和 `isStaticSuper` 都用 `computed`，依赖 `token` 和 `userInfo`
3. **看方法**：`login()` 中 `startLoading()` / `endLoading()` 用 `useLoading` 的 `ref` 状态
4. **看错误处理**：`login()` 中的 `if (!error)` 分支 — 异步请求 + 状态更新的完整链路

### 阅读指引：app Store

1. **看 `effectScope`**：`const scope = effectScope()` 创建一个副作用作用域
2. **看 `scope.run()`**：内部的 `watch` 都被绑定到这个 scope，销毁时自动 stop
3. **看 `onScopeDispose`**：在 Store 被销毁时（如页面卸载）自动清理 `scope`
4. **看 `useBoolean`**：从 `@sa/hooks` 引入，返回 `{ bool: Ref<boolean>, setTrue, setFalse, toggle }` — 这是**响应式状态的函数式封装**的典型模式

### 规范评审清单

#### 文件 1：`src/store/modules/auth/index.ts`

| 检查项 | 标准 | 是否达标？ | 说明 |
|--------|------|---------|------|
| 命名规范 | 文件/目录 kebab-case，函数 camelCase，Store useXxxStore | ✅ | `useAuthStore` 符合 |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ | `token: ref<...>` 有类型，`userInfo: Api.Auth.UserInfo` 有类型 |
| 目录规范 | Store 放在 `store/modules/` | ✅ | 路径正确 |
| 导入顺序 | type → 第三方 → 内部 → 相对 | ✅ | `import type` 在前，Vue/Pinia 随后，内部按 `@/` 分组 |
| 错误处理 | 异步有 try/catch 或统一拦截 | ⚠️ | `login()` 检查 `error`，但 `getUserInfo()` 没有 try/catch，依赖 request 层的拦截 |
| 可测试性 | 纯函数可单测，副作用可 mock | ⚠️ | `login()` 耦合了 `window.$notification`，测试时需要 mock 全局对象 |
| 国际化 | 用户可见字符串用 `$t()` | ✅ | `loginSuccess`、`welcomeBack` 都用了 `$t()` |

> **可提升点**：`resetStore()` 中同步调用了 `toLogin()`（异步）但没有 `await` 返回值，虽然不影响功能，但语义上应该表明"这是异步操作"。可改为 `await toLogin()` 或显式 `void toLogin()` 标记忽略返回值。

#### 文件 2：`src/store/modules/app/index.ts`

| 检查项 | 标准 | 是否达标？ | 说明 |
|--------|------|---------|------|
| 命名规范 | 同上 | ✅ | 符合 |
| 类型完整性 | 零 any | ✅ | `locale` 类型 `App.I18n.LangType` 完整 |
| 错误处理 | 异步处理 | ✅ | `reloadPage()` 的 `await new Promise(...)` 优雅处理时序 |
| 可测试性 | 副作用可 mock | ✅ | `useEventListener` 和 `useBreakpoints` 都是 VueUse 的纯函数，可 mock |

> **亮点**：`effectScope` 的使用是 Vue 3 进阶技巧。`scope.run()` 把多个 `watch` 绑定到同一个作用域，`onScopeDispose` 在 Store 卸载时统一清理。这相当于 Java 中的 `try (Scope scope = new EffectScope()) { ... }` 资源管理。

#### 文件 3：`src/hooks/common/form.ts`

| 检查项 | 标准 | 是否达标？ | 说明 |
|--------|------|---------|------|
| 命名规范 | Hook 用 `useXxx` | ✅ | `useFormRules`、`useAntdForm` |
| 类型完整性 | 零 any | ✅ | `formRef: Ref<FormInstance \| null>` 类型完整 |
| 可测试性 | 纯函数可单测 | ✅ | `createRequiredRule` 是纯函数，输入输出确定 |

> **亮点**：`createConfirmPwdRule` 接受 `string | Ref<string> | ComputedRef<string>`，用 `toValue()` 统一解包。这是 Vue 3.3+ 的新 API，优雅处理了"值或 ref"的多态输入。类比 Java：相当于一个方法同时接受 `String` 和 `Supplier<String>`，内部统一 `.get()` 取值。

---

## 功能实践 — 分三步

### 第一步：功能拆解

实现一个 **"登录状态卡片"** 组件：显示当前用户昵称、登录状态、角色列表，支持切换语言和手动刷新页面。功能拆解：

1. **小任务 A**：用 `ref` 定义 `token`（字符串）和 `isRefreshing`（布尔值）
2. **小任务 B**：用 `reactive` 定义 `userInfo` 对象（userId, userName, roles）
3. **小任务 C**：用 `computed` 派生 `isLogin` 和 `roleDisplay`（角色列表字符串）
4. **小任务 D**：用 `watch` 监听 `locale` 变化，自动更新 document title
5. **小任务 E**：整合到 `<script setup>` 组件，使用 Ant Design Vue 的 Card + Tag 组件渲染

### 第二步：小任务开发

#### 小任务 A：用 `ref` 定义基本类型状态

```typescript
// src/hooks/business/use-auth-card.ts
import { ref } from 'vue';

export function useAuthCard() {
  // 基本类型用 ref — 必须 .value 读写
  const token = ref<string | null>(localStorage.getItem('token'));
  const isRefreshing = ref(false);

  // 模拟刷新
  async function refresh() {
    isRefreshing.value = true;
    await new Promise(r => setTimeout(r, 1000));
    token.value = 'new-token-' + Date.now();
    isRefreshing.value = false;
  }

  return {
    token,
    isRefreshing,
    refresh
  };
}
```

> **要点**：`ref` 的泛型参数 `<string | null>` 显式声明类型。如果不写，TypeScript 会推断为 `Ref<string | null>`，但显式标注可读性更好。

#### 小任务 B：用 `reactive` 定义对象状态

```typescript
import { reactive } from 'vue';
import type { Api } from '@/typings/api'; // 假设的类型

export function useAuthCard() {
  // 对象状态用 reactive — 直接访问属性，无 .value
  const userInfo = reactive<Api.Auth.UserInfo>({
    userId: '',
    userName: '',
    roles: []
  });

  // 更新用户信息 — 用 Object.assign 保持响应式
  function updateUserInfo(info: Api.Auth.UserInfo) {
    Object.assign(userInfo, info);
  }

  return {
    userInfo,
    updateUserInfo
  };
}
```

> **要点**：`reactive` 的类型参数 `<Api.Auth.UserInfo>` 标注了对象的完整类型。注意不能用 `userInfo = { ... }` 重新赋值，必须用 `Object.assign`。

#### 小任务 C：用 `computed` 派生状态

```typescript
import { computed, ref, reactive } from 'vue';

export function useAuthCard() {
  const token = ref<string | null>(null);
  const userInfo = reactive({ userId: '', userName: '', roles: [] as string[] });

  // 派生状态：是否登录 — 缓存，只有 token 变化时重新计算
  const isLogin = computed(() => Boolean(token.value));

  // 派生状态：角色展示字符串 — 缓存
  const roleDisplay = computed(() => {
    if (userInfo.roles.length === 0) return '无角色';
    return userInfo.roles.join('、');
  });

  return { token, userInfo, isLogin, roleDisplay };
}
```

> **要点**：`computed` 的返回值是**只读的 `Ref<T>`**，在模板中自动解包（无需 `.value`），但在 JS 中读取仍需 `.value`。

#### 小任务 D：用 `watch` 监听变化

```typescript
import { ref, watch } from 'vue';

export function useAuthCard() {
  const locale = ref<'zh-CN' | 'en-US'>('zh-CN');

  // 监听 locale 变化，执行副作用（更新 title）
  watch(locale, (newVal, oldVal) => {
    console.log(`语言切换：${oldVal} → ${newVal}`);
    document.title = newVal === 'zh-CN' ? '管理后台' : 'Admin Dashboard';
  });

  // 更精确：监听特定条件
  watch(
    () => locale.value, // getter 形式
    (newVal) => {
      // 异步加载语言包
      loadLanguageAsync(newVal);
    },
    { immediate: true } // 初始化时立即执行一次
  );

  return { locale };
}
```

> **对比 Java**：`watch` 相当于 `PropertyChangeListener`，但前端是声明式的。`immediate: true` 相当于在注册监听器时立即执行一次回调，这在 Java 中需要手动调用一次。

### 第三步：整合小任务，功能测试

将上述 composable 整合到一个完整的 Vue 组件中：

```vue
<!-- src/components/business/auth-card.vue -->
<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { Card, Tag, Button, Space } from 'ant-design-vue';

defineOptions({ name: 'AuthCard' });

// ===== 状态定义 =====
const token = ref<string | null>(localStorage.getItem('token'));
const isRefreshing = ref(false);
const locale = ref<'zh-CN' | 'en-US'>('zh-CN');

const userInfo = reactive({
  userId: '10001',
  userName: 'admin',
  roles: ['SUPER_ADMIN', 'AUDITOR'] as string[]
});

// ===== 计算属性 =====
const isLogin = computed(() => Boolean(token.value));
const roleDisplay = computed(() => {
  if (userInfo.roles.length === 0) return '无角色';
  return userInfo.roles.join('、');
});

// ===== 监听 =====
watch(locale, (newVal) => {
  document.title = newVal === 'zh-CN' ? '管理后台' : 'Admin Dashboard';
}, { immediate: true });

// ===== 方法 =====
async function refresh() {
  isRefreshing.value = true;
  await new Promise(r => setTimeout(r, 1000));
  token.value = 'new-token-' + Date.now();
  isRefreshing.value = false;
}

function logout() {
  token.value = null;
  localStorage.removeItem('token');
}

function toggleLocale() {
  locale.value = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN';
}
</script>

<template>
  <Card :title="isLogin ? '用户信息' : '未登录'" class="w-300px">
    <Space direction="vertical">
      <div>用户名：{{ userInfo.userName }}</div>
      <div>角色：
        <Tag v-for="role in userInfo.roles" :key="role" color="blue">{{ role }}</Tag>
      </div>
      <div>Token：{{ token?.slice(0, 12) || '无' }}...</div>
      <div>语言：{{ locale }}</div>

      <Button type="primary" :loading="isRefreshing" @click="refresh">
        {{ isRefreshing ? '刷新中...' : '刷新 Token' }}
      </Button>
      <Button @click="toggleLocale">切换语言</Button>
      <Button danger @click="logout">退出登录</Button>
    </Space>
  </Card>
</template>
```

#### 调试与错误排查思路

1. **状态不更新？** → 检查是否用了 `.value`（`ref` 需要）或是否用了 `Object.assign`（`reactive` 不能重新赋值）
2. **计算属性不重新计算？** → 检查依赖的响应式值是否真的变化（引用相等不会触发）
3. **watch 不触发？** → 检查监听对象是否是响应式的（不能直接监听 `reactive` 对象的属性，要用 getter）
4. **模板中不显示？** → 检查 `setup()` 中是否正确返回了变量（`<script setup>` 中自动返回，传统 `setup()` 需要手动 `return`）

### 验收标准

- [x] **能用**：组件渲染正确，刷新 Token、切换语言、退出登录功能正常
- [x] **规范**：`pnpm typecheck` 通过（无类型错误），`pnpm lint` 通过
- [x] **精进**：
  - 能解释为什么 `token` 用 `ref`（基本类型）而 `userInfo` 用 `reactive`（对象属性修改）
  - 能解释 `computed` 的缓存优势 vs 普通函数
  - 能识别 `reactive` 的解构陷阱并正确用 `Object.assign` 或 `toRefs`
  - 无 `any` 类型逃逸

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `ref` | 把任意值包装成响应式对象，用 `.value` 读写 | `AtomicReference<T>` | 基本类型也能响应式，JS 没有类型擦除问题 |
| `reactive` | 用 Proxy 代理对象，直接属性访问即可响应 | `ObservableMap` / `PropertyChangeSupport` | 原始对象无需修改，任意 POJO 直接代理 |
| `computed` | 缓存的计算属性，依赖变化时自动重算 | 带缓存的 `getter` | 自动依赖追踪，无需手动声明依赖列表 |
| `watch` | 监听响应式值变化，执行副作用 | `PropertyChangeListener` | 声明式监听，支持 `immediate` 和 `deep` |
| `effectScope` | 批量管理副作用生命周期，销毁时自动清理 | `try-with-resources` / `AutoCloseable` | 比手动 `unwatch()` 更安全，避免内存泄漏 |
| `.value` 解包 | 模板中自动解包，JS 中需显式访问 | 无直接类比 | Vue 编译器在模板中自动注入 `.value` |
| `Object.assign` | 用于 `reactive` 对象的批量更新，保持响应式 | `BeanUtils.copyProperties` | 不能重新赋值 `reactive` 变量本身 |
| `<script setup>` | 编译时自动把顶层变量注入 `setup()` 返回 | `Lombok` 自动生成 getter/setter | 无 `this`，状态通过闭包和返回值暴露 |

---

## 今日代码提交检查清单

```markdown
- [ ] 组件文件名使用 kebab-case（`auth-card.vue`）
- [ ] 组件代码名使用 PascalCase，通过 `defineOptions` 声明
- [ ] Hook 函数以 `use` 开头，使用 camelCase
- [ ] 导入顺序：type → Vue → 第三方 → 内部 `@/` → 相对路径
- [ ] 所有 `ref` / `reactive` 有显式类型标注
- [ ] 无 `any` 类型
- [ ] 异步操作有错误处理或依赖 request 层拦截
- [ ] 用户可见字符串使用 `$t()`（如涉及国际化）
```

---

**明日预告**：第11天 — 组合式函数（Composables）— Vue 的"静态工具方法"，深入 `useXxx` 的设计模式，阅读 `src/hooks/common/table.ts` 和 `src/hooks/common/router.ts`。

> **朱军，今日寄语**：`ref` 的 `.value` 是前端最开始的"不自然"，但写三天后你会发现它其实很优雅——它强迫你区分"响应式容器"和"容器里的值"。这和 Java 中区分 `List<T>` 和 `T` 是一样的思维。继续前进！
