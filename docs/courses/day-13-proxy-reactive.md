# 今日前端课程 — 第13天：响应式系统深入 — 从 Proxy 到依赖追踪

> **学习目标**
> - **能读**：理解 Vue 3 响应式系统的核心原理（Proxy、依赖收集、触发更新）
> - **能用**：正确使用 ref/reactive/computed，理解它们的适用场景和性能差异
> - **规范**：遵循项目规范选择响应式 API，避免不必要的响应式转换
> - **精进**：理解 effectScope 和生命周期管理，手写一个极简响应式系统
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + TypeScript + Pinia

---

## 理论学习

### 核心知识点

#### 1. 为什么 Vue 3 使用 Proxy 而不是 Object.defineProperty？

Vue 2 使用 `Object.defineProperty` 进行响应式拦截，存在以下限制：
- 无法检测新增/删除属性（需要 `Vue.set` / `Vue.delete`）
- 无法监听数组索引和长度的变化
- 只能拦截已有属性，对嵌套对象需要递归处理

Vue 3 使用 `Proxy` 代理整个对象：
```typescript
// Vue 3 的响应式核心：Proxy 拦截对象的所有操作
const proxy = new Proxy(target, {
  get(target, key, receiver) {
    // 1. 读取值时，收集依赖（track）
    track(target, key);
    return Reflect.get(target, key, receiver);
  },
  set(target, key, value, receiver) {
    // 2. 设置值时，触发更新（trigger）
    const result = Reflect.set(target, key, value, receiver);
    trigger(target, key);
    return result;
  }
});
```

**关键理解**：Proxy 是"代理整个对象"，而不是"给每个属性加 getter/setter"。这带来了：
- 可以检测任意属性的新增和删除
- 可以监听数组索引操作
- 嵌套对象懒代理（访问时才创建 Proxy）

#### 2. ref vs reactive：什么时候用哪个？

| 特性 | ref | reactive |
|------|-----|----------|
| 包装对象 | Ref 对象（`.value`） | Proxy 代理对象 |
| 基本类型 | ✅ 支持 | ❌ 不支持 |
| 对象类型 | ✅ 支持（内部用 reactive） | ✅ 支持 |
| 整体替换 | ✅ `ref.value = newObj` | ❌ 会失去响应式 |
| 解构/展开 | ❌ 需要 `.value` | ❌ 会失去响应式连接 |
| 模板中使用 | 自动解包（无需 `.value`） | 直接使用属性 |

**项目中的使用规则**：
```typescript
// 1. 基本类型：必须用 ref
const count = ref(0);
const isLoading = ref(false);
const token = ref(getToken());  // src/store/modules/auth/index.ts

// 2. 对象/数组：可以用 reactive，但要注意限制
const userInfo = reactive({       // src/store/modules/auth/index.ts
  userId: '',
  userName: '',
  roles: [],
  buttons: []
});

// 3. 需要整体替换的场景：用 ref
const tabs = ref<App.Global.Tab[]>([]);  // src/store/modules/tab/index.ts
// tabs.value = newTabs  ✅ 可以整体替换

// 4. 大数据对象：用 shallowRef 避免深层响应式
const bigList = shallowRef([]);  // 性能优化：不递归监听内部属性
```

#### 3. computed 的缓存机制

`computed` 不是"简单的 getter"，它有**惰性求值**和**缓存**特性：

```typescript
// src/store/modules/theme/index.ts
const darkMode = computed(() => {
  // 这个函数只在依赖变化时执行一次
  // 多次访问 darkMode.value 不会重复计算
  if (settings.value.themeScheme === 'auto') {
    return osTheme.value === 'dark';
  }
  return settings.value.themeScheme === 'dark';
});

// 对比普通函数：每次调用都重新计算
function getDarkMode() {
  // 每次调用都会执行这些逻辑
  if (settings.value.themeScheme === 'auto') {
    return osTheme.value === 'dark';
  }
  return settings.value.themeScheme === 'dark';
}
```

**computed 的核心特性**：
- 惰性求值：只有被访问时才计算
- 缓存：依赖不变时，返回缓存结果
- 自动追踪依赖：Vue 自动知道它依赖了哪些响应式数据

#### 4. effectScope — 副作用的生命周期管理

Vue 3 引入 `effectScope` 用于管理一组响应式副作用的生命周期：

```typescript
// src/store/modules/theme/index.ts
const scope = effectScope();

scope.run(() => {
  // 在这个 scope 中创建的 watch/computed 会被自动收集
  watch(darkMode, val => toggleCssDarkMode(val), { immediate: true });
  watch(themeColors, val => setupThemeVarsToGlobal(), { immediate: true });
});

// 组件卸载时停止所有副作用
onScopeDispose(() => {
  scope.stop();  // 停止 scope 内的所有 watch/computed
});
```

**Java 类比**：`effectScope` 类似于 Java 的 `ExecutorService` + `shutdown()`，管理一组后台任务的启动和停止。

### Java 思维类比

| 前端概念 | Java 类比 | 关键差异 |
|---------|----------|---------|
| `ref` | `AtomicReference<T>` | 需要 `.value` 访问，模板自动解包 |
| `reactive` | `ObservableMap` / `PropertyChangeSupport` | 基于 Proxy 拦截，不是观察者模式 |
| `computed` | 缓存的 `getter` + `volatile` | 自动依赖追踪，无需手动声明 |
| `watch` | `PropertyChangeListener` | 精确追踪依赖，无需手动注册/移除 |
| `effectScope` | `ExecutorService` | 用于管理副作用生命周期，不是线程池 |
| `Proxy` | `InvocationHandler` 动态代理 | 拦截的是对象属性访问，不是方法调用 |

### 超越类比 — 前端独有的设计哲学

**1. 自动依赖追踪 vs 手动注册监听器**

Java 的观察者模式需要手动注册/移除监听器：
```java
// Java：手动管理监听器
PropertyChangeSupport pcs = new PropertyChangeSupport(this);
pcs.addPropertyChangeListener("name", listener);
// 忘记移除 = 内存泄漏
```

Vue 的响应式系统自动追踪依赖：
```typescript
// Vue：自动追踪，无需手动注册
const fullName = computed(() => firstName.value + ' ' + lastName.value);
// Vue 自动知道 fullName 依赖 firstName 和 lastName
// 组件卸载时自动清理（配合 effectScope）
```

**2. 惰性求值与精确更新**

```typescript
// computed 只在被访问时计算，且只重新计算变化的依赖
const expensive = computed(() => {
  console.log('重新计算');
  return a.value + b.value;
});

// 修改 c 不会触发 expensive 重新计算
const c = ref(0);
c.value++;  // expensive 不会重新计算

// 修改 a 才会触发
a.value++;  // expensive 重新计算
```

这种精确更新机制是前端框架独有的优势，避免了 Java 中常见的"级联更新"问题。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

**文件 1**：`src/store/modules/auth/index.ts` — 认证 Store 的响应式实践
**文件 2**：`src/store/modules/theme/index.ts` — 主题 Store 的 effectScope 和 watch 实践
**文件 3**：`src/hooks/common/table.ts` — 表格 Hook 的响应式组合

### 阅读指引

1. **先看 `auth/index.ts`**：
   - 观察 `token` 用 `ref`，`userInfo` 用 `reactive` — 为什么这样选择？
   - 观察 `isLogin` 用 `computed` — 为什么不用普通函数？
   - 思考：`userInfo` 如果用 `ref` 会有什么不同？

2. **再看 `theme/index.ts`**：
   - 观察 `effectScope` 的使用场景 — 为什么这里需要它？
   - 观察 `watch` 的 `{immediate: true}` 配置 — 为什么需要立即执行？
   - 思考：如果没有 `onScopeDispose` 清理，会有什么后果？

3. **最后看 `table.ts`**：
   - 观察 `pagination` 用 `reactive` — 为什么不用 `ref`？
   - 观察 `mobilePagination` 用 `computed` — 为什么需要缓存？
   - 思考：`shallowRef` 在 `tableWrapperRef` 中的用途？

### 规范评审清单

| 检查项 | 标准 | auth/index.ts | theme/index.ts | table.ts |
|--------|------|---------------|----------------|----------|
| 命名规范 | 文件 kebab-case、函数 camelCase、常量 UPPER_SNAKE_CASE | ✅ | ✅ | ✅ |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ `Api.Auth.UserInfo` | ✅ `Ref<App.Theme.ThemeSetting>` | ✅ 泛型约束 `A extends AntDesign.TableApiFn` |
| 目录规范 | 文件放在正确的目录 | ✅ store/modules | ✅ store/modules | ✅ hooks/common |
| 导入顺序 | type 导入 → 第三方库 → 内部模块 → 相对路径 | ✅ | ✅ | ✅ |
| 响应式选择 | ref/reactive 选择合理 | ✅ ref 用于 token | ✅ ref 用于 settings | ✅ reactive 用于 pagination |
| 副作用管理 | watch/effect 有生命周期管理 | ❌ 无 effectScope | ✅ 有 effectScope + onScopeDispose | ✅ 有 effectScope + onScopeDispose |
| 可测试性 | 纯函数可单测，副作用可 mock | ⚠️ 依赖 localStorage | ⚠️ 依赖 window 事件 | ✅ 相对独立 |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ | ✅ | ✅ |

**发现的问题**：
- `auth/index.ts` 没有使用 `effectScope` 管理副作用，如果 Store 被重置或组件卸载，可能存在未清理的响应式依赖。不过 Pinia Store 是全局单例，生命周期与应用一致，所以这不是严重问题。
- `table.ts` 使用 `shallowRef` 存储 DOM 引用，这是正确的用法——DOM 元素不需要深层响应式。

---

## 功能实践 — 分三步

### 第一步：分析功能需求

**目标**：实现一个"实时搜索计数器"组件，要求：
1. 输入关键词，实时显示搜索结果数量
2. 搜索过程有加载状态
3. 显示搜索历史（最近 5 条）
4. 支持清空历史

**技术拆解**：
- 关键词输入 → `ref<string>`（基本类型）
- 搜索结果列表 → `ref<Result[]>`（需要整体替换）
- 加载状态 → `ref<boolean>`（基本类型）
- 搜索历史 → `reactive<HistoryItem[]>`（需要频繁增删）
- 结果数量 → `computed<number>`（从结果列表派生）
- 防抖搜索 → `watch` + `setTimeout`
- 历史持久化 → `watch` + `localStorage`

### 第二步：小任务开发

#### 任务 1：定义响应式状态

```typescript
// 定义类型
interface SearchResult {
  id: number;
  title: string;
  content: string;
}

interface HistoryItem {
  keyword: string;
  timestamp: number;
}

// 创建响应式状态
const keyword = ref('');                    // 搜索关键词
const results = ref<SearchResult[]>([]);    // 搜索结果
const loading = ref(false);                  // 加载状态
const history = reactive<HistoryItem[]>([]); // 搜索历史（用 reactive 方便 push/pop）

// 计算属性：结果数量（缓存计算）
const resultCount = computed(() => results.value.length);

// 计算属性：是否有历史记录
const hasHistory = computed(() => history.length > 0);
```

**技术要点**：
- `keyword` 和 `loading` 是基本类型，用 `ref`
- `results` 需要整体替换（异步请求返回新数组），用 `ref`
- `history` 需要频繁增删，用 `reactive` + `push`/`pop`
- `resultCount` 和 `hasHistory` 是派生状态，用 `computed` 缓存

#### 任务 2：实现防抖搜索

```typescript
// 模拟搜索 API
async function fetchSearch(keyword: string): Promise<SearchResult[]> {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // 模拟返回数据
  return Array.from({ length: Math.floor(Math.random() * 10) }, (_, i) => ({
    id: i,
    title: `结果 ${i + 1} 包含 "${keyword}"`,
    content: `这是关于 "${keyword}" 的详细内容...`
  }));
}

// 监听关键词变化，自动搜索
watch(keyword, async (newKeyword) => {
  if (!newKeyword.trim()) {
    results.value = [];
    return;
  }
  
  loading.value = true;
  try {
    const data = await fetchSearch(newKeyword);
    results.value = data;
    
    // 添加到历史（去重）
    addToHistory(newKeyword);
  } catch (error) {
    console.error('搜索失败:', error);
    results.value = [];
  } finally {
    loading.value = false;
  }
}, { debounce: 300 });  // VueUse 的 debounce watch

// 或者使用手写防抖
let searchTimer: NodeJS.Timeout | null = null;
watch(keyword, (newKeyword) => {
  if (searchTimer) clearTimeout(searchTimer);
  
  searchTimer = setTimeout(async () => {
    // 执行搜索...
  }, 300);
});
```

**技术要点**：
- `watch` 监听 `keyword` 变化，自动触发搜索
- 使用防抖避免频繁请求
- 错误处理：try/catch + 重置状态

#### 任务 3：历史记录管理

```typescript
// 添加历史记录（去重，最多保留 5 条）
function addToHistory(keyword: string) {
  // 移除已存在的相同关键词
  const existingIndex = history.findIndex(h => h.keyword === keyword);
  if (existingIndex > -1) {
    history.splice(existingIndex, 1);
  }
  
  // 添加到开头
  history.unshift({ keyword, timestamp: Date.now() });
  
  // 限制 5 条
  if (history.length > 5) {
    history.pop();
  }
}

// 清空历史
function clearHistory() {
  history.length = 0;  // reactive 数组的清空方式
}

// 从历史中搜索
function searchFromHistory(keyword: string) {
  keyword.value = keyword;  // 触发 watch 搜索
}
```

**技术要点**：
- `reactive` 数组可以直接用 `push`/`pop`/`splice`
- 清空 `reactive` 数组用 `history.length = 0`（比 `history = []` 有效，后者会失去响应式）
- 修改 `keyword.value` 会触发 `watch` 重新搜索

#### 任务 4：持久化历史记录

```typescript
import { watch, onMounted } from 'vue';

// 页面加载时恢复历史
onMounted(() => {
  const saved = localStorage.getItem('search-history');
  if (saved) {
    const parsed: HistoryItem[] = JSON.parse(saved);
    parsed.forEach(item => history.push(item));
  }
});

// 监听历史变化，自动保存
watch(
  () => [...history],  // 转换为普通数组监听
  (newHistory) => {
    localStorage.setItem('search-history', JSON.stringify(newHistory));
  },
  { deep: true }
);
```

**技术要点**：
- `watch` 监听 `reactive` 数组需要 `() => [...history]` 或 `{ deep: true }`
- `localStorage` 操作在 `watch` 中处理，实现自动持久化

### 第三步：整合与功能测试

```vue
<script setup lang="ts">
defineOptions({ name: 'SearchCounter' });

// 1. 状态定义
const keyword = ref('');
const results = ref<SearchResult[]>([]);
const loading = ref(false);
const history = reactive<HistoryItem[]>([]);

// 2. 计算属性
const resultCount = computed(() => results.value.length);
const hasHistory = computed(() => history.length > 0);

// 3. 搜索逻辑
watch(keyword, async (newKeyword) => {
  if (!newKeyword.trim()) {
    results.value = [];
    return;
  }
  
  loading.value = true;
  try {
    const data = await fetchSearch(newKeyword);
    results.value = data;
    addToHistory(newKeyword);
  } catch (error) {
    console.error('搜索失败:', error);
    results.value = [];
  } finally {
    loading.value = false;
  }
});

// 4. 历史管理
function addToHistory(keyword: string) {
  const existingIndex = history.findIndex(h => h.keyword === keyword);
  if (existingIndex > -1) history.splice(existingIndex, 1);
  history.unshift({ keyword, timestamp: Date.now() });
  if (history.length > 5) history.pop();
}

function clearHistory() {
  history.length = 0;
}

function searchFromHistory(item: HistoryItem) {
  keyword.value = item.keyword;
}

// 5. 持久化
onMounted(() => {
  const saved = localStorage.getItem('search-history');
  if (saved) {
    JSON.parse(saved).forEach((item: HistoryItem) => history.push(item));
  }
});

watch(() => [...history], (newHistory) => {
  localStorage.setItem('search-history', JSON.stringify(newHistory));
}, { deep: true });
</script>

<template>
  <div class="search-counter">
    <!-- 搜索输入 -->
    <AInput
      v-model:value="keyword"
      placeholder="输入关键词搜索..."
      :loading="loading"
      allow-clear
    />
    
    <!-- 搜索统计 -->
    <div v-if="keyword" class="mt-2">
      <span v-if="loading">搜索中...</span>
      <span v-else>找到 {{ resultCount }} 条结果</span>
    </div>
    
    <!-- 搜索历史 -->
    <div v-if="hasHistory" class="mt-4">
      <div class="flex justify-between items-center">
        <span class="text-gray-500">搜索历史</span>
        <AButton type="link" size="small" @click="clearHistory">清空</AButton>
      </div>
      <div class="flex gap-2 mt-2">
        <ATag
          v-for="item in history"
          :key="item.timestamp"
          class="cursor-pointer"
          @click="searchFromHistory(item)"
        >
          {{ item.keyword }}
        </ATag>
      </div>
    </div>
    
    <!-- 搜索结果 -->
    <div v-if="results.length > 0" class="mt-4">
      <div
        v-for="result in results"
        :key="result.id"
        class="p-3 border-b hover:bg-gray-50"
      >
        <h4 class="font-medium">{{ result.title }}</h4>
        <p class="text-gray-500 text-sm mt-1">{{ result.content }}</p>
      </div>
    </div>
  </div>
</template>
```

### 验收标准

- [ ] **能用**：输入关键词自动搜索，显示结果数量，历史记录可点击和清空
- [ ] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过
- [ ] **精进**：
  - 零 any：所有状态有类型定义
  - 防抖处理：300ms 防抖避免频繁请求
  - 错误处理：try/catch 处理搜索失败
  - 副作用管理：watch 自动清理，onMounted 恢复数据
  - 可测试性：搜索逻辑可提取为纯函数测试

---

## 进阶挑战：手写极简响应式系统

**目标**：理解 Vue 3 响应式的核心原理，手写一个 50 行以内的响应式系统。

```typescript
// 极简响应式系统
let activeEffect: (() => void) | null = null;

const targetMap = new WeakMap();

function track(target: object, key: string | symbol) {
  if (!activeEffect) return;
  
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map();
    targetMap.set(target, depsMap);
  }
  
  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set();
    depsMap.set(key, dep);
  }
  
  dep.add(activeEffect);
}

function trigger(target: object, key: string | symbol) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  
  const dep = depsMap.get(key);
  if (dep) {
    dep.forEach(effect => effect());
  }
}

function reactive<T extends object>(target: T): T {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key);
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key);
      return result;
    }
  });
}

function effect(fn: () => void) {
  activeEffect = fn;
  fn();
  activeEffect = null;
}

// 使用示例
const state = reactive({ count: 0 });

effect(() => {
  console.log('count =', state.count);  // 自动追踪依赖
});

state.count++;  // 输出: count = 1
state.count++;  // 输出: count = 2
```

**理解要点**：
1. `track`：在读取属性时，将当前 effect 收集到依赖集合中
2. `trigger`：在设置属性时，执行所有收集到的 effect
3. `WeakMap`：避免内存泄漏，对象被垃圾回收时依赖自动清理
4. `activeEffect`：全局变量记录当前正在执行的 effect

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| ref | 包装任意值的响应式容器，访问用 `.value` | `AtomicReference<T>` | 模板自动解包，无需 `.value` |
| reactive | Proxy 代理对象，属性访问自动追踪 | `ObservableMap` | 基于 Proxy 拦截，不是观察者模式 |
| computed | 缓存的计算属性，依赖变化才重新计算 | 缓存的 `getter` | 自动追踪依赖，惰性求值 |
| watch | 监听响应式数据变化执行回调 | `PropertyChangeListener` | 精确追踪依赖，无需手动注册 |
| effectScope | 管理一组副作用的生命周期 | `ExecutorService` | 与组件生命周期绑定，自动清理 |
| Proxy | 代理对象的所有操作 | `InvocationHandler` | 拦截属性访问，不是方法调用 |
| shallowRef | 浅层响应式，不递归代理内部属性 | `AtomicReference`（浅层） | 性能优化：大数据/DOM 引用 |

---

**明日预告**：第14天 — 计算属性与侦听器（computed / watch / watchEffect）深入

> 明天我们将深入 computed 的缓存策略、watch 的 flush 模式、watchEffect 的自动追踪，以及如何在实际项目中选择合适的侦听策略。

---

## 附录：项目中的响应式使用速查

```typescript
// ✅ 推荐用法
const count = ref(0);                    // 基本类型
const user = reactive({ name: '' });    // 对象（不替换整体）
const list = ref<Item[]>([]);           // 数组（需要整体替换）
const fullName = computed(() => ...);   // 派生状态

// ❌ 避免用法
const count = reactive({ value: 0 });   // 用 ref 更简洁
const user = ref({ name: '' });         // 如果只是修改属性，用 reactive
const list = reactive<Item[]>([]);      // 如果需要整体替换，用 ref
const result = computed(async () => {   // computed 不能是异步
  return await fetchData();             // ❌ 错误！
});
```
