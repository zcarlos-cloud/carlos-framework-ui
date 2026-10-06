# 今日前端课程 — 第34天：浏览器存储 — 从 Cookie 到 IndexedDB

> **学习目标**
> - 能读：理解 `localStorage` / `sessionStorage` / `IndexedDB` / `Cookie` 四种存储的差异与适用场景
> - 能用：基于 carlos-ui 的 `createStorage` 封装，写出类型安全的存储操作
> - 规范：所有存储 key 加入 `StorageType` namespace 声明，禁止裸字符串 key
> - 精进：理解加密存储的必要性与实现原理，掌握 `beforeunload` 事件持久化模式
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + @sa/utils + Pinia + VueUse

---

## 理论学习

### 核心知识点

#### 1. 四种浏览器存储全景图

| 维度 | Cookie | localStorage | sessionStorage | IndexedDB |
|------|--------|-------------|----------------|-----------|
| **容量** | ~4KB | ~5-10MB | ~5-10MB | 无上限（受磁盘限制） |
| **生命周期** | 可设过期时间 / 会话 | 永久（除非手动删除） | 标签页关闭即销毁 | 永久 |
| **作用域** | 同源 + path | 同源 | 同源 + 同标签页 | 同源 |
| **与服务端通信** | 自动附带在 HTTP Header | 不自动发送 | 不自动发送 | 不自动发送 |
| **API 风格** | 字符串操作 `document.cookie` | 同步 key-value | 同步 key-value | 异步事务 |
| **存储类型** | 仅字符串 | 仅字符串（需 JSON 序列化） | 仅字符串 | 任意 JS 类型 |
| **适用场景** | 服务端需要的标识（sessionId） | 用户偏好、主题、Token | 表单草稿、临时状态 | 大量结构化数据 |

#### 2. carlos-ui 的存储设计哲学

carlos-ui 不直接使用 `localStorage.setItem('token', 'xxx')` 这种裸操作，而是构建了**三层存储体系**：

```
┌─────────────────────────────────────────────┐
│  业务层：auth store / theme store / app store │  ← 只调用 localStg / sessionStg
├─────────────────────────────────────────────┤
│  工具层：localStg / sessionStg / localforage │  ← 类型安全封装，前缀隔离
├─────────────────────────────────────────────┤
│  底层：localStorage / sessionStorage / IndexedDB │  ← 浏览器原生 API
└─────────────────────────────────────────────┘
```

**为什么要这样分层？**

1. **类型安全**：`localStg.get('token')` 返回 `string`，不是 `any`
2. **前缀隔离**：多个项目同域部署时，`VITE_STORAGE_PREFIX` 避免 key 冲突
3. **统一 JSON 序列化**：不用每次手动 `JSON.parse` / `JSON.stringify`
4. **错误容忍**：`JSON.parse` 失败时自动清理脏数据

#### 3. 存储 Key 的集中声明

所有存储 key 的类型定义在 `src/typings/storage.d.ts` 的 `StorageType` namespace 中：

```typescript
declare namespace StorageType {
  interface Local {
    lang: App.I18n.LangType;
    token: string;
    refreshToken: string;
    themeColor: string;
    themeSettings: App.Theme.ThemeSetting;
    globalTabs: App.Global.Tab[];
    // ...
  }
  interface Session {
    themeColor: string;
  }
}
```

**为什么这样设计？**
- 任何人想知道"项目有哪些持久化数据"，打开这一个文件就全知道
- TypeScript 自动校验 key 是否存在、value 类型是否匹配
- 禁止散落在各文件中的裸字符串 `localStorage.setItem('some_random_key', ...)`

---

### Java 思维类比

| Java 概念 | 前端存储 | 类比说明 |
|-----------|---------|---------|
| `HttpSession` | `sessionStorage` | 会话级别，每个"会话"独立，关闭即销毁 |
| Redis 缓存 | `localStorage` | 持久化 key-value，快速读写，需手动管理过期 |
| 关系数据库 / MySQL | `IndexedDB` | 结构化存储，支持索引查询、事务 |
| `JSESSIONID` Cookie | `document.cookie` | 自动随请求发送，服务端可读 |
| Spring `@Value` + `application.yml` | `.env` + `import.meta.env` | 环境配置，构建时注入 |
| MyBatis 二级缓存 | Pinia Store + `localStg` | 内存缓存 + 持久化备份，重启后可恢复 |
| `@Transactional` | IndexedDB Transaction | 原子操作，失败回滚 |

> **关键差异**：Java 的 `HttpSession` 数据存在服务端，前端 `sessionStorage` 存在浏览器。前端"会话"是标签页级别，不是用户级别。

---

### 超越类比 — 前端独有的设计哲学

#### 1. 为什么 Token 存 localStorage 而不是 Cookie？

**Java 工程师直觉**：Cookie 自动带在请求头，不是更方便？

**前端实际**：
- Cookie 容量仅 4KB，JWT Token 动辄 1-2KB，加上其他 Cookie 很容易超限
- Cookie 有 `HttpOnly` 属性时 JS 无法读写，只能服务端设置
- **自动附带是安全风险** — 任何同源请求都带上 Token，CSRF 攻击面更大
- 前端主动通过 `Authorization: Bearer xxx` Header 携带，**精确控制哪些请求需要认证**

```typescript
// carlos-ui 的做法（src/service/request/shared.ts）
export function getAuthorization() {
  const token = localStg.get('token');
  return token ? `Bearer ${token}` : null;
}
```

#### 2. 为什么需要 `beforeunload` 事件持久化？

**Java 思维**：用户在页面操作，不就是"点击保存"才持久化吗？

**前端现实**：
- 用户可能直接关闭标签页、刷新页面、浏览器崩溃
- 主题设置、标签页状态、语言偏好这些**非关键但有体验价值**的状容，不能用"保存按钮"
- 答案是 `beforeunload`：在页面卸载前，把 Pinia 中的状态刷到 localStorage

```typescript
// carlos-ui 主题 store 中的模式（src/store/modules/theme/index.ts）
useEventListener(window, 'beforeunload', () => {
  cacheThemeSettings();  // 将内存中的主题配置写入 localStorage
});
```

#### 3. 为什么 localStorage 只有 5MB，却不用 IndexedDB？

**前端权衡**：
- 5MB 对配置类数据（Token、主题、语言、标签页列表）绰绰有余
- localStorage 是**同步** API，代码写起来简单直白
- IndexedDB 是**异步事务** API，复杂度高很多
- **只在存大量结构化数据（如离线消息、文件缓存）时才需要 IndexedDB**

carlos-ui 的做法：日常用 `localStorage`，可选 `localforage`（IndexedDB 封装）作为备选。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

| 文件 | 角色 |
|------|------|
| `packages/utils/src/storage.ts` | `createStorage` / `createLocalforage` 核心实现 |
| `src/utils/storage.ts` | 项目级存储实例（含前缀） |
| `src/typings/storage.d.ts` | 存储 Key 的集中类型声明 |
| `packages/utils/src/crypto.ts` | AES 加密工具类 |
| `src/store/modules/auth/index.ts` | Token 存储与认证流程 |
| `src/store/modules/auth/shared.ts` | `getToken` / `clearAuthStorage` |
| `src/store/modules/theme/index.ts` | 主题持久化 + `beforeunload` 模式 |
| `src/store/modules/app/index.ts` | 语言/布局偏好持久化 |
| `src/store/modules/tab/index.ts` | 标签页缓存持久化 |
| `src/service/request/shared.ts` | Token 读取与刷新 |

---

### 阅读指引

#### 第一步：看整体结构 — `createStorage` 的泛型设计

```typescript
// packages/utils/src/storage.ts
export function createStorage<T extends object>(type: StorageType, storagePrefix: string) {
  const stg = type === 'session' ? window.sessionStorage : window.localStorage;

  const storage = {
    set<K extends keyof T>(key: K, value: T[K]) {
      const json = JSON.stringify(value);
      stg.setItem(`${storagePrefix}${key as string}`, json);
    },
    get<K extends keyof T>(key: K): T[K] | null {
      const json = stg.getItem(`${storagePrefix}${key as string}`);
      if (json) {
        let storageData: T[K] | null = null;
        try {
          storageData = JSON.parse(json);
        } catch { /* 解析失败，静默处理 */ }
        if (storageData) return storageData as T[K];
      }
      stg.removeItem(`${storagePrefix}${key as string}`);
      return null;
    },
    remove(key: keyof T) { /* ... */ },
    clear() { /* ... */ }
  };
  return storage;
}
```

**设计精要**：
- `T extends object` — 泛型绑定类型声明，如 `StorageType.Local`
- `K extends keyof T` — **key 必须是在 `StorageType` 中声明过的**，编译器帮你杜绝拼写错误
- `JSON.stringify` 自动包装 — 存对象不用手动序列化
- `JSON.parse` 失败时清理 — **脏数据自愈**，不会让后续代码一直读到 `null`

#### 第二步：看使用 — 各 Store 如何读写

**Token 存储** (`src/store/modules/auth/shared.ts`)：
```typescript
export function getToken() {
  return localStg.get('token') || '';   // null → ''，安全降级
}

export function clearAuthStorage() {
  localStg.remove('token');
  localStg.remove('refreshToken');
}
```

**主题持久化** (`src/store/modules/theme/index.ts`)：
```typescript
// 取：本地优先 + defu 深度合并 + 版本覆盖标志
const localSettings = localStg.get('themeSettings');
let settings = defu(localSettings, themeSettings);  // 本地覆盖默认值

// 存：beforeunload 时机写入
useEventListener(window, 'beforeunload', () => {
  cacheThemeSettings();
});
```

**语言偏好持久化** (`src/store/modules/app/index.ts`)：
```typescript
const locale = ref<App.I18n.LangType>(localStg.get('lang') || 'zh-CN');

async function changeLocale(lang: App.I18n.LangType) {
  locale.value = lang;
  setLocale(lang);
  localStg.set('lang', lang);           // 立即持久化（不等 beforeunload）
  await loadBackendMessages(lang);
}
```

#### 第三步：思考提升空间

1. **`createStorage` 未处理 `setItem` 配额超限** — 5MB 满了会抛 `QuotaExceededError`，当前实现未捕获
2. **`clear()` 直接调用 `stg.clear()`** — 会清除同域其他项目的数据（如果有多个前缀）
3. **`localforage` 未在实际业务中使用** — 代码存在但未被任何 Store 调用，可能是预留扩展点

---

### 规范评审清单

| 检查项 | 标准 | `packages/utils/src/storage.ts` 是否达标？ |
|--------|------|------------------------------------------|
| 命名规范 | 文件 camelCase、函数 camelCase | ✅ `createStorage`、`createLocalforage` |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ 泛型完整，无 any 逃逸 |
| 目录规范 | 文件放在正确的目录 | ✅ `packages/utils/src/storage.ts` |
| 导入顺序 | type 导入 → 第三方 → 内部 → 相对 | ✅ 仅导入 localforage |
| 错误处理 | 所有异步有 try/catch | ⚠️ `JSON.parse` 有 try/catch，但 `setItem` 无 |
| 可测试性 | 纯函数可单测 | ✅ `createStorage` 是纯工厂函数，易于 mock |
| 国际化 | 用户可见字符串使用 `$t()` | N/A（工具层无 UI） |

| 检查项 | 标准 | `src/store/modules/auth/shared.ts` 是否达标？ |
|--------|------|---------------------------------------------|
| 命名规范 | 函数 camelCase | ✅ `getToken`、`clearAuthStorage` |
| 类型完整性 | 零 any | ✅ 返回值明确 `string` |
| 目录规范 | shared.ts 与 store 同目录 | ✅ |
| 错误处理 | 所有异步有 try/catch | ✅ `getToken` 用 `\|\| ''` 安全降级 |
| JSDoc | 公共函数有注释 | ⚠️ `getToken` 缺少 JSDoc |

---

## 功能实践 — 分三步

### 第一步：需求分析与任务拆解

**目标**：封装一个类型安全、支持可选加密的 localStorage Hook

**用户故事**：
> 作为开发者，我希望有一个 `useSecureStorage` composable，它像 Pinia 一样简单（读/写/删），但有类型约束，敏感字段可选 AES 加密。

**任务拆解**：

| 序号 | 子任务 | 需要理解的知识点 | 产出 |
|------|--------|----------------|------|
| T1 | 理解 `createStorage` 的泛型设计 | TS 泛型约束 `K extends keyof T` | 画出类型流程图 |
| T2 | 实现类型安全的 `useTypedStorage` | Vue `ref` + `watch` 双向同步 | `useTypedStorage.ts` |
| T3 | 集成 AES 加密层 | `Crypto` 类 + 条件加密 | 加密 Hook |
| T4 | 编写使用示例 | 在组件中读取/写入加密数据 | Demo 页面 |
| T5 | 边界测试 | 过期处理、解密失败降级 | 测试用例 |

---

### 第二步：小任务开发

#### T1：理解泛型设计

`createStorage<T>` 的精妙之处在于：**key 被限制为 `T` 的 key 集合**。

```typescript
// ✅ 正确：'token' 是 StorageType.Local 的合法 key
localStg.set('token', 'my-jwt-token');

// ❌ TypeScript 编译报错：'foobar' 不是 StorageType.Local 的 key
localStg.set('foobar', 'oops');
```

这就是 TypeScript 的 **keyof 约束**，等价于 Java 的枚举限制。

#### T2：实现 `useTypedStorage` — 与 Vue 响应式打通

```typescript
// src/hooks/common/storage.ts
import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import { localStg } from '@/utils/storage';

/**
 * 类型安全的 localStorage 响应式 Hook
 *
 * @param key - 存储 key（受 StorageType.Local 约束）
 * @param fallback - 默认值（无存储数据时使用）
 * @returns Ref 响应式引用，修改后自动同步到 localStorage
 *
 * @example
 * ```ts
 * const token = useTypedStorage('token', '');
 * token.value = 'new-token'; // 自动写入 localStorage
 * ```
 */
export function useTypedStorage<K extends keyof StorageType.Local>(
  key: K,
  fallback: StorageType.Local[K]
): Ref<StorageType.Local[K]> {
  const stored = localStg.get(key);
  const data = ref(stored ?? fallback) as Ref<StorageType.Local[K]>;

  // 修改时同步到 localStorage
  watch(
    data,
    (newValue) => {
      if (newValue === null || newValue === undefined) {
        localStg.remove(key);
      } else {
        localStg.set(key, newValue);
      }
    },
    { deep: true }
  );

  return data;
}
```

**关键设计决策**：
- `Ref<StorageType.Local[K]>` — 返回值类型与 key 联动，`useTypedStorage('token')` 返回 `Ref<string>`
- `watch` + `deep: true` — 对象类型变化也能检测
- `null/undefined` 时 remove 而非 set — 避免存 `"null"` 字符串

#### T3：集成 AES 加密层

```typescript
// src/hooks/common/secure-storage.ts
import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import { localStg } from '@/utils/storage';
import { Crypto } from '@sa/utils';

// 加密密钥：生产环境应从环境变量读取
const STORAGE_SECRET = import.meta.env.VITE_STORAGE_SECRET || 'carlos-default-secret';
const crypto = new Crypto<Record<string, unknown>>(STORAGE_SECRET);

/**
 * 支持 AES 加密的 localStorage Hook
 *
 * @param key - 存储 key
 * @param fallback - 默认值
 * @param encrypt - 是否加密存储，默认 true
 *
 * @example
 * ```ts
 * // 敏感数据加密存储
 * const apiKey = useSecureStorage('apiKey', '');
 * // 非敏感数据明文存储
 * const pageSize = useSecureStorage('pageSize', 10, false);
 * ```
 */
export function useSecureStorage<T>(
  key: string,
  fallback: T,
  encrypt = true
): Ref<T> {
  function read(): T {
    try {
      const raw = localStg.get(key as any);
      if (raw === null || raw === undefined) return fallback;

      if (encrypt) {
        const decrypted = crypto.decrypt(raw as string);
        return (decrypted as T) ?? fallback;
      }
      return raw as unknown as T;
    } catch {
      console.warn(`[SecureStorage] 读取 "${key}" 失败，使用默认值`);
      localStg.remove(key as any);  // 清除损坏数据
      return fallback;
    }
  }

  function write(value: T): void {
    if (value === null || value === undefined) {
      localStg.remove(key as any);
      return;
    }
    const payload = encrypt
      ? crypto.encrypt(value as unknown as Record<string, unknown>)
      : (value as unknown as string);
    localStg.set(key as any, payload);
  }

  const data = ref(read()) as Ref<T>;

  watch(data, (newValue) => write(newValue), { deep: true });

  return data;
}
```

**关键点**：
- 加密/解密失败时**静默降级**到默认值并清理脏数据，避免白屏
- 通过 `encrypt` 参数控制是否加密 — 不是所有数据都需要
- `deep: true` 保证嵌套对象变化也能触发持久化

#### T4：使用示例

```vue
<script setup lang="ts">
import { useSecureStorage } from '@/hooks/common/secure-storage';

// 加密存储：API Key
const apiKey = useSecureStorage('apiKey', '');

// 明文存储：用户表格每页条数偏好
const pageSize = useSecureStorage('pageSize', 10, false);

function saveApiKey() {
  apiKey.value = 'sk-abc123def456';
  // 自动加密后写入 localStorage
}
</script>

<template>
  <AInput v-model:value="apiKey" placeholder="输入 API Key（自动加密存储）" />
</template>
```

#### T5：边界测试要点

```typescript
// 应测试的场景：
// 1. 首次访问（localStorage 为空）→ 返回 fallback
// 2. 写入后刷新页面 → 读取到上次写入的值
// 3. 加密密钥变更 → 解密失败 → 返回 fallback + 清除脏数据
// 4. localStorage 满 → setItem 抛异常 → 应被捕获
// 5. 存储被手动篡改（非 JSON 字符串）→ JSON.parse 失败 → 返回 fallback
```

---

### 第三步：整合与调试

#### 整合后的完整 `useSecureStorage` 使用流程

```
用户输入 API Key
  → v-model 更新 Ref 值
    → watch 检测到变化
      → Crypto.encrypt() 加密
        → localStg.set() 写入 localStorage

页面刷新
  → setup() 执行
    → localStg.get() 读取
      → Crypto.decrypt() 解密
        → ref(decrypted) 初始化
          → 组件渲染
```

#### 常见问题排查

| 问题 | 原因 | 解决 |
|------|------|------|
| 刷新后数据丢失 | `watch` 没开 `deep: true` | 对象类型必须 deep |
| 加密数据无法解密 | 密钥和加密时不同 | 检查环境变量一致性 |
| 控制台报 `QuotaExceededError` | localStorage 5MB 已满 | 清理无用数据或迁移到 IndexedDB |
| TypeScript 报 key 不存在 | key 未在 `StorageType.Local` 声明 | 在 `storage.d.ts` 中补充声明 |

---

### 验收标准

- [ ] 能用：`useSecureStorage` 可以正常读写加密/明文数据，刷新后数据仍在
- [ ] 规范：函数有 JSDoc，泛型约束类型安全，key 补充到 `StorageType` namespace
- [ ] 精进：解密失败降级、脏数据自清理、密钥环境变量隔离

---

## 今日重点记忆卡

| 概念 | 一句话 | Java 类比 | 前端独有 |
|------|--------|---------|---------|
| `createStorage<T>` | 泛型工厂函数，key 被约束到 `T` 的 key 集合 | Java `EnumMap<K, V>` — key 类型受限 | 用 TS 泛型实现编译期 key 校验 |
| `localStorage` vs `sessionStorage` | 前者永久，后者标签页关即毁 | `Redis` vs `HttpSession` | 前端"会话"=标签页级，非用户级 |
| `beforeunload` 持久化 | 页面卸载前把内存状态刷到磁盘 | `@PreDestroy` 钩子 | 用户直接关标签页，没有"点保存"的机会 |
| AES 加密存储 | 敏感数据写入前加密，读取时解密 | `@ColumnTransformer` + AES | 前端加密≠安全（密钥在客户端），但可防明文泄露 |
| IndexedDB + localforage | 异步事务型大容量存储 | MySQL + JDBC | JS 中没有同步大容量存储，必须接受异步 |
| Token 存 localStorage 非 Cookie | 精确控制 Authorization Header，避免 CSRF | Spring Security `BearerTokenFilter` | Cookie 自动附带是功能也是风险 |
| Storage key 集中声明 | `StorageType` namespace 统一管理所有 key | Java `Constants.java` 集中管理 | TS namespace 自动关联 value 类型 |

---

**明日预告**：第35天 — 阶段复习：整合多个库做功能模块（Axios 请求日志列表 + ECharts 统计图表 + 导出 Excel + 分页），第三阶段收官！
