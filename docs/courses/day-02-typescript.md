# 今日前端课程 — 第2天：TypeScript 入门 — Java 开发者的类型系统

> **学习目标**
> - **能读**：看懂 `src/typings/` 中的类型声明，理解 `interface` 与 `type` 的区别
> - **能用**：为一个 JS 函数添加类型注解，使用泛型封装工具函数
> - **规范**：开启 `strict` 模式，所有函数参数和返回值标注类型，零 `any`
> - **精进**：理解协变/逆变、条件类型、映射类型，手写 `DeepReadonly<T>`
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + AntDV + Pinia + UnoCSS

---

## 理论学习

### 核心知识点

#### 1. TypeScript 是什么？为什么 Vue 3 项目必须用它？

TypeScript = JavaScript + 静态类型系统。编译时检查类型，运行时是纯 JS。

**关键配置**（`tsconfig.json`）：

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "strict": true,
    "strictNullChecks": true,
    "noUnusedLocals": false,
    "paths": {
      "@/*": ["./src/*"],
      "~/*": ["./*"]
    }
  }
}
```

> ⚠️ `strict: true` 是项目底线。它开启了所有严格类型检查，包括 `noImplicitAny`、`strictNullChecks` 等。

#### 2. Interface vs Type — 什么时候用哪个？

| 场景 | 推荐 | 说明 |
|------|------|------|
| 对象类型 | `interface` | 可扩展（`extends`）、可合并声明（Declaration Merging） |
| 联合类型 | `type` | `'active' \| 'inactive'` |
| 工具类型 | `type` | `Partial<T>`, `Pick<T, K>` |
| 映射类型 | `type` | `{ [K in keyof T]: V }` |

```typescript
// interface：描述对象形状，可扩展
interface User {
  id: number;
  name: string;
}

interface Admin extends User {
  permissions: string[];
}

// type：联合类型、工具类型
type Status = 'active' | 'inactive' | 'deleted';
type PartialUser = Partial<User>;
```

**为什么项目里大量用 `interface`？**

看 `src/typings/api.d.ts`：

```typescript
declare namespace Api {
  namespace Auth {
    interface LoginToken {
      token: string;
      refreshToken: string;
    }

    interface UserInfo {
      userId: string;
      userName: string;
      roles: string[];
      buttons: string[];
    }
  }
}
```

所有后端接口类型都用 `interface`，因为：
1. 对象结构可能随接口版本迭代扩展（`extends`）
2. 多个 `.d.ts` 文件可以对同一 `interface` 追加属性（合并声明）

#### 3. 泛型 `<T>` — 和 Java 泛型概念相通，但语法更轻

```typescript
// Java: <T extends Comparable<T>>
// TS: <T extends string>

function transformRecordToOption<T extends Record<string, string>>(record: T) {
  return Object.entries(record).map(([value, label]) => ({
    value,
    label
  })) as CommonType.Option<keyof T, T[keyof T]>[];
}
```

这是 `src/utils/common.ts` 中的真实代码。注意：
- `T extends Record<string, string>` = Java 的 `T extends Map<String, String>`
- `keyof T` = Java 的泛型类型参数推导
- `as` 类型断言 = Java 的强制类型转换，但仅在编译时存在

#### 4. 非空断言 `!` vs 可选链 `?.` vs 类型守卫

```typescript
// ❌ 不推荐：非空断言（编译器不管，运行时报错风险）
const name = user!.name;

// ✅ 推荐：可选链 + 空值合并（运行安全）
const name = user?.name ?? '';

// ✅ 推荐：类型守卫（TypeScript 收窄类型）
if (user) {
  const name = user.name; // TypeScript 知道 user 不为 undefined
}
```

**项目规范**：尽量避免 `!`，优先用可选链和类型守卫。

#### 5. `declare namespace` — 组织全局类型

```typescript
declare namespace Api {
  namespace Common {
    interface PaginatingCommonParams {
      current: number;
      size: number;
      total: number;
    }

    type CommonRecord<T = any> = {
      id: number;
      createBy: string;
      createTime: string;
      status: EnableStatus;
    } & T;  // 交叉类型 = Java 的接口多继承
  }
}
```

> `declare namespace` 中的类型**不需要 import**，在项目的任何 `.ts/.vue` 文件中直接用 `Api.Auth.LoginToken`。

### Java 思维类比

| Java 概念 | TypeScript 对应 | 类比说明 |
|-----------|----------------|---------|
| `interface` | `interface` | 几乎完全一致，TS interface 还能描述对象字面量形状 |
| `class` / `record` | `type` / `interface` | TS 的 `type` 更灵活，可描述联合类型 |
| 泛型 `<T>` | 泛型 `<T>` | 概念完全相同，协变/逆变规则相通 |
| `@Nullable` / `Optional` | `?` 可选属性 / `\| undefined` | `userName?: string` = 可能为 null |
| `final` 字段 | `readonly` | `readonly id: number` = 初始化后不可改 |
| `instanceof` | `typeof` / `in` / 自定义守卫 | 运行时类型收窄 |
| `Map<K, V>` | `Record<K, V>` | `Record<string, string>` = `Map<String, String>` |
| 枚举 `enum` | `enum` / 联合类型字面量 | TS 两种写法，项目里 enum 用于 Store ID，联合类型用于状态值 |
| `ObjectMapper` | 类型断言 `as` | 编译时类型转换，运行时不存在 |

### 超越类比 — 前端独有的设计哲学

> **1. 结构类型系统（Structural Typing）vs 名义类型系统（Nominal Typing）**
>
> Java 是名义类型：`class Dog` 和 `class Cat` 即使字段相同，也是不同类型。
> TypeScript 是结构类型：只要结构兼容，就是兼容类型。
>
> ```typescript
> interface Dog { name: string; }
> interface Cat { name: string; }
> const dog: Dog = { name: 'Momo' };
> const cat: Cat = dog; // ✅ 合法！结构相同即可
> ```
> 这是前端组件可复用的底层基础——传参时**看形状不看名**。
>
> **2. `type` 的联合类型 — Java 没有的原生概念**
>
> ```typescript
> type Status = 'active' | 'inactive' | 'deleted';
> ```
> Java 要用 `enum` 或 `sealed class`，TS 用字面量联合更轻量。`carlos-ui` 中 `EnableStatus = '1' | '2'` 就是典型用法。
>
> **3. `any` 是"类型系统的后门" — 但项目规范零容忍**
>
> Java 没有 `any`（`Object` 还有类型信息）。TS 的 `any` 会**完全关闭类型检查**。项目开启 `strict` 后，`any` 只在必要时用于第三方库未声明类型的场景。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

- `src/typings/api.d.ts` — 后端接口类型声明（全局命名空间）
- `src/typings/app.d.ts` — 应用全局类型（主题、菜单、Tab、I18n）
- `src/store/modules/auth/index.ts` — Pinia Store（Composition API + TS）
- `src/service/api/auth.ts` — API 函数（类型安全的请求封装）

### 阅读指引

#### 1. `src/typings/api.d.ts` — 后端契约的类型层

```typescript
declare namespace Api {
  namespace Common {
    interface PaginatingCommonParams {
      current: number;
      size: number;
      total: number;
    }

    type PaginatingQueryRecord<T = any> extends PaginatingCommonParams {
      records: T[];
    }

    type EnableStatus = '1' | '2';

    type CommonRecord<T = any> = {
      id: number;
      createBy: string;
      createTime: string;
      status: EnableStatus;
    } & T;
  }
}
```

**阅读要点**：
1. `T = any` 是泛型默认值，类似 Java `<T extends Object>`
2. `& T` 是**交叉类型** = Java 的接口多继承（`extends A, B`）
3. `EnableStatus = '1' | '2'` 是**字面量联合类型**，比 Java enum 更轻量

#### 2. `src/store/modules/auth/index.ts` — Pinia + TS 实战

```typescript
export const useAuthStore = defineStore(SetupStoreId.Auth, () => {
  const token = ref(getToken());                    // ref<string | null>
  const userInfo: Api.Auth.UserInfo = reactive({    // 用 Api 命名空间类型
    userId: '',
    userName: '',
    roles: [],
    buttons: []
  });

  const isLogin = computed(() => Boolean(token.value));

  async function login(userName: string, password: string, redirect = true) {
    const {data: loginToken, error} = await fetchLogin(userName, password);
    // ...
  }

  return { token, userInfo, isLogin, login };
});
```

**阅读要点**：
1. `ref()` 的类型推断：`getToken()` 返回 `string | null`，所以 `token` 是 `Ref<string | null>`
2. `reactive()` 的对象类型用 `Api.Auth.UserInfo` 显式注解
3. 函数参数和返回值都有类型（`login` 返回 `Promise<void>`，由 async 推导）

#### 3. `src/service/api/auth.ts` — API 层类型

```typescript
export function fetchLogin(userName: string, password: string) {
  return request<Api.Auth.LoginToken>({
    url: '/auth/login',
    method: 'post',
    data: { userName, password }
  });
}
```

**阅读要点**：
1. `request<Api.Auth.LoginToken>()` — 泛型指定响应数据类型
2. 函数参数全标注类型，无 `any`
3. 返回类型由 `request<T>()` 的泛型推导：`Promise<Api.Service.Response<Api.Auth.LoginToken>>`

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件 kebab-case、函数 camelCase、类型 PascalCase | ✅ `api.d.ts` / `auth.ts` / `useAuthStore` 均符合 |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ⚠️ `PaginatingQueryRecord<T = any>` 有一个 `any`，但它是泛型默认值，有明确设计意图；其余零 `any` |
| 目录规范 | 类型声明放 `typings/`、API 放 `service/api/`、Store 放 `store/modules/` | ✅ 全部正确 |
| 导入顺序 | type 导入 → 第三方库 → 内部模块 → 相对路径 | ✅ `auth/index.ts`：`import type` 无，但第三方（vue, pinia）→ 内部（`@/enum`, `@/hooks`）→ 相对（`./shared`） |
| 错误处理 | 异步有 try/catch 或解构 error | ✅ `fetchLogin` 返回 `{data, error}`，调用方检查 `if (!error)` |
| 可测试性 | 纯函数可单测，副作用可 mock | ✅ `transformRecordToOption` 是纯函数；Store 副作用通过 composable 隔离 |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ `auth/index.ts` 中 `window.$notification?.success({ message: $t(...) })` |

---

## 功能实践 — 分三步

### 第一步：分析和拆解

今天我们要为一个「用户状态管理」模块添加完整 TypeScript 类型。拆解为：

1. 定义用户领域模型（User Model）
2. 定义分页查询类型（复用项目 `PaginatingCommonParams`）
3. 为现有 JS 工具函数添加类型
4. 手写一个泛型工具类型 `DeepReadonly<T>`

### 第二步：小任务开发

#### 任务 2.1：定义用户领域模型

在 `src/typings/api.d.ts` 的 `SystemManage` 命名空间下，已有 `User` 类型：

```typescript
type User = Common.CommonRecord<{
  userName: string;
  userGender: UserGender;
  nickName: string;
  userPhone: string;
  userEmail: string;
  userRoles: string[];
}>;
```

**技术要点**：
- `Common.CommonRecord<T>` 是交叉类型，自动附加 `id`, `createBy`, `createTime`, `status` 等审计字段
- 等价于 Java 的 `class User extends BaseEntity { ... }`
- `userGender: UserGender` 是字面量联合类型 `'1' | '2'`，比 Java enum 更轻，编译后直接是字符串

#### 任务 2.2：复用分页类型

```typescript
type UserSearchParams = Partial<
  Pick<Api.SystemManage.User, 'userName' | 'userGender' | 'status'> &
  Common.CommonSearchParams
>;
```

**技术要点**：
- `Pick<T, K>` = Java 的 `BeanUtils.copyProperties` 只选部分字段
- `Partial<T>` = 所有字段变可选（`?`）
- `&` = 交叉类型，合并两个类型
- 这行代码干了 Java 可能要 10 行干的事：定义一个"可选部分字段 + 分页参数"的查询 DTO

#### 任务 2.3：为 JS 函数添加类型

看 `src/utils/common.ts` 中的 `transformRecordToOption`：

```typescript
export function transformRecordToOption<T extends Record<string, string>>(record: T) {
  return Object.entries(record).map(([value, label]) => ({
    value,
    label
  })) as CommonType.Option<keyof T, T[keyof T]>[];
}
```

**类型分析**：
- `T extends Record<string, string>` = 泛型约束，T 必须是"字符串键值对对象"
- `keyof T` = 所有键的联合类型（如 `'light' | 'dark' | 'auto'`）
- `T[keyof T]` = 所有值的联合类型（如 `App.I18n.I18nKey`）
- `as` 类型断言 = 告诉编译器"我保证返回的是这个类型"

#### 任务 2.4：手写 `DeepReadonly<T>`（精进）

```typescript
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? DeepReadonly<T[K]>
    : T[K];
};
```

**逐层解析**：
1. `readonly [K in keyof T]` = 遍历 T 的所有键，加上 `readonly` 修饰
2. `T[K] extends object ? ... : ...` = 条件类型：如果值是对象，递归处理
3. 最终效果：对象和嵌套对象的所有属性都变成只读

**Java 类比**：类似 `Collections.unmodifiableMap()` + 递归处理嵌套结构。

**前端独有**：这是编译时类型，运行时不产生任何代码。Java 要在运行时做防御性拷贝。

### 第三步：整合与测试

将以上类型知识整合，写一个小练习：

```typescript
// 定义一个带类型的用户查询函数
import type { AxiosResponse } from 'axios';

interface QueryResult<T> {
  list: T[];
  total: number;
}

async function fetchUserList(params: Api.SystemManage.UserSearchParams): Promise<QueryResult<Api.SystemManage.User>> {
  const response = await request<Api.Service.Response<Api.SystemManage.UserList>>({
    url: '/system-manage/user/list',
    method: 'get',
    params
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return {
    list: response.data.data.records,
    total: response.data.data.total
  };
}
```

**各步骤关系**：
1. 类型定义（`UserSearchParams`, `User`）是"契约"
2. API 函数实现时，参数和返回值必须满足契约
3. `request<T>()` 的泛型确保响应数据类型正确
4. 调用方拿到 `QueryResult<User>`，IDE 自动提示 `list[0].userName`

### 验收标准

- [ ] **能用**：在 `src/typings/` 中新增一个命名空间类型，IDE 无红线报错
- [ ] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过
- [ ] **精进**：手写 `DeepReadonly<T>` 并能解释每一层含义；对比 `interface` 和 `type` 至少 3 个差异

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `interface` | 描述对象的结构形状 | Java `interface` | 可合并声明（同名 interface 自动合并） |
| `type` | 类型的别名，可描述联合/交叉 | Java `class` / `record` | 可描述 `\|` 联合类型，Java 无直接对应 |
| 泛型 `<T>` | 类型参数化，复用类型逻辑 | Java 泛型 | 约束语法 `extends` 相同，但无需通配符 `?` |
| `keyof T` | 取对象所有键的联合类型 | Java `Field[]` 反射 | 编译时操作，运行时零开销 |
| `Partial<T>` | 所有属性变可选 | 手动写 `@Nullable` 版 DTO | 一行代码生成新类型 |
| `readonly` | 属性初始化后不可变 | Java `final` 字段 | 编译时检查，运行时不存在 |
| `any` | 关闭类型检查 | 无直接对应（`Object` 还有类型） | **项目规范零容忍** |
| 交叉类型 `&` | 合并多个类型的属性 | 接口多继承 | 可合并对象 + 联合类型 |
| `declare namespace` | 全局类型命名空间 | Java `package` | 不需要 import，项目中任意文件可用 |
| 结构类型系统 | 看形状不看名 | Java 名义类型（看类名） | 组件复用的底层基础 |

---

**明日预告**：第3天 — npm / pnpm / Node.js 生态 — Java 的 Maven 在前端

> 明天我们将学习前端包管理生态：package.json ≈ pom.xml，pnpm workspace ≈ Maven 多模块，vite.config.ts ≈ application.yml + pom.xml。我们会一起分析 `carlos-ui` 的 monorepo 结构，理解 `packages/` 下的内部包是如何链接和复用的。
