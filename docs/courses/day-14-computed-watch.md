# 今日前端课程 — 第14天：计算属性与侦听器 — computed / watch / watchEffect

> **学习目标**
> - **能读**：能在 carlos-framework-ui 源码中一眼识别 `computed`/`watch`/`watch` 的使用场景和意图
> - **能用**：能用 `computed` 实现派生状态，用 `watch` 监听状态变化触发副作用，理解 `effectScope` 的生命周期管理
> - **规范**：遵循 SFC 导入顺序、类型标注完整、无副作用泄露
> - **精进**：理解 Vue 3 依赖追踪原理 — 为什么 `computed` 能缓存？为什么 `watch` 比手动监听更高效？
>
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + AntDV + Pinia + UnoCSS

---

## 理论学习

### 核心知识点

#### 1. `computed` — 有缓存的派生状态

`computed` 接收一个 getter 函数，返回一个**只读的响应式引用**。它的核心特性是**懒计算 + 缓存**：只有依赖的响应式数据变化时，才会重新求值。

```typescript
import { ref, computed } from 'vue';

const count = ref(0);
const double = computed(() => count.value * 2);

console.log(double.value); // 0
console.log(double.value); // 0（不重新计算，直接读缓存）
count.value = 1;
console.log(double.value); // 2（依赖变了，重新求值）
```

**可写 computed**（有 setter）：

```typescript
const fullName = computed({
  get: () => `${firstName.value} ${lastName.value}`,
  set: (val) => {
    [firstName.value, lastName.value] = val.split(' ');
  }
});
```

#### 2. `watch` — 有明确依赖的副作用监听

`watch` 显式声明监听的数据源，当数据源变化时执行回调。**它会对比新旧值**（深度监听时除外）。

```typescript
watch(source, callback, options);
```

| 写法                                        | 说明                |
|-------------------------------------------|-------------------|
| `watch(() => obj.prop, ...)`              | 监听 getter 返回值（推荐） |
| `watch(obj, ...)`                         | 监听整个响应式对象         |
| `watch([source1, source2], ...)`          | 监听多个源             |
| `watch(source, ..., { immediate: true })` | 初始化时立即执行一次        |
| `watch(source, ..., { deep: true })`      | 深度监听对象内部变化        |

**注意**：`watch` 默认**不监听深层属性变化**，除非开启 `deep: true`。

#### 3. `watchEffect` — 自动追踪依赖的副作用

`watchEffect` **不声明依赖**，它在执行时会自动追踪访问到的响应式数据。每次依赖变化都会重新执行。

```typescript
watchEffect(() => {
  console.log(count.value); // 自动追踪 count
  // 访问了多少响应式数据，就追踪多少
});
```

|      | `watch`     | `watchEffect` |
|------|-------------|---------------|
| 依赖声明 | 显式          | 自动追踪          |
| 新旧值  | ✅ 有         | ❌ 无           |
| 懒执行  | ✅ 默认懒执行     | ❌ 立即执行        |
| 适用场景 | 需要对比旧值、条件执行 | 简单副作用、不关心旧值   |

#### 4. `effectScope` + `onScopeDispose` — 副作用生命周期管理

在 carlos-framework-ui 中，`effectScope` 是管理一组响应式副作用（`watch`、`computed`、其他 `effect`）的核心工具。当 scope 被 `stop()` 时，其内部所有副作用都会被清理。

```typescript
import { effectScope, watch, onScopeDispose } from 'vue';

const scope = effectScope();

scope.run(() => {
  watch(someRef, () => { /* ... */ });
  watch(anotherRef, () => { /* ... */ });
});

onScopeDispose(() => {
  scope.stop(); // 组件卸载时自动清理所有 watch
});
```

**为什么 Pinia Store 要用 `effectScope`？**

Store 是全局单例，不会像组件一样自动卸载。但当应用热更新或需要手动重置时，`effectScope` 提供了**批量清理副作用**的能力。这是 VueUse 的 `useEventListener` 等 Hook 也能在组件卸载时自动清理的底层原理。

---

### Java 思维类比

| Vue 3 概念      | Java 类比                                      | 关键差异                                              |
|---------------|----------------------------------------------|---------------------------------------------------|
| `computed`    | Java 的 `getter` + 缓存（类似 `@Cacheable`）        | Vue 自动追踪依赖，无需手动声明缓存失效条件                           |
| `watch`       | Java `PropertyChangeListener`                | Vue 3 的依赖追踪是自动的，不需要手动 `addPropertyChangeListener` |
| `watchEffect` | Java `Observer` 模式的自动订阅                      | 更自动化，无需显式注册/注销每个依赖                                |
| `effectScope` | Java `try-finally` 或 Spring `DisposableBean` | 批量管理副作用生命周期，不是单个                                  |

> **Java 开发者常见误区**：
> 1. 把 `computed` 当成普通函数调用 — 它不是每次调用都重新计算！
> 2. 用 `watch` 代替 `computed` — 能用 `computed` 表达的派生状态，不要用 `watch` 手动维护，那是反模式。
> 3. 忘记清理副作用 — 在组件卸载或 Store 重置时，`effectScope` 是你的好帮手。

---

### 超越类比 — 前端独有的设计哲学

#### 为什么 Vue 3 的 `computed` 比 Java `getter` 更智能？

Java 的 getter 每次调用都会执行（除非手动加缓存注解）。Vue 3 的 `computed` 底层依赖 **Proxy + 依赖追踪（Track/Trigger）**：

1. **Track**：执行 getter 时，Vue 记录访问了哪些响应式数据
2. **Trigger**：这些数据变化时，标记 `computed` 为 "dirty"
3. **Lazy Re-evaluate**：下次 `.value` 被读取时，如果 dirty 才重新计算

这个过程是**全自动**的，不需要像 Java 那样手动配置 `@Cacheable` + `@CacheEvict`。

#### 为什么 `watchEffect` 不是 "魔法"，而是一种工程 trade-off？

`watchEffect` 的自动追踪依赖听起来像 "黑魔法"，其实底层是 Vue 3 的 **Proxy 拦截**：

```
访问 ref.value  →  Proxy.get()  →  记录当前 effect 为依赖者
修改 ref.value  →  Proxy.set()  →  通知所有依赖的 effect 重新执行
```

但这也是它的**限制**：如果在条件分支中有响应式数据，首次执行时没走到那个分支，就不会被追踪到。这时需要用 `watch` 显式声明依赖。

---

## carlos-framework-ui 源码阅读 + 规范评审

### 目标文件 1：`src/store/modules/auth/index.ts`

```typescript
/** Is login */
const isLogin = computed(() => Boolean(token.value));

/** is super role in static route */
const isStaticSuper = computed(() => {
  const { VITE_AUTH_ROUTE_MODE, VITE_STATIC_SUPER_ROLE } = import.meta.env;
  return VITE_AUTH_ROUTE_MODE === 'static' && userInfo.roles.includes(VITE_STATIC_SUPER_ROLE);
});
```

**阅读指引**：

1. `isLogin`：最简单的派生状态。`token` 是 `ref`，`computed` 自动追踪它
2. `isStaticSuper`：同时依赖 `userInfo.roles`（reactive 对象属性）和 `import.meta.env`。注意 `import.meta.env` 不是响应式数据 — 这个 computed **不会**在环境变量变化时重新计算（构建时确定）
3. 两个 `computed` 都是**只读 getter**，没有 setter

### 目标文件 2：`src/store/modules/theme/index.ts`

```typescript
const darkMode = computed(() => {
  if (settings.value.themeScheme === 'auto') {
    return osTheme.value === 'dark';
  }
  return settings.value.themeScheme === 'dark';
});

const themeColors = computed(() => {
  const { themeColor, otherColor, isInfoFollowPrimary } = settings.value;
  const colors: App.Theme.ThemeColor = {
    primary: themeColor,
    ...otherColor,
    info: isInfoFollowPrimary ? themeColor : otherColor.info
  };
  return colors;
});
```

以及核心的 `watch` + `effectScope`：

```typescript
const scope = effectScope();

scope.run(() => {
  watch(darkMode, val => { toggleCssDarkMode(val); }, { immediate: true });
  watch([grayscaleMode, colourWeaknessMode], val => { toggleAuxiliaryColorModes(val[0], val[1]); }, { immediate: true });
  watch(themeColors, val => { setupThemeVarsToGlobal(); localStg.set('themeColor', val.primary); }, { immediate: true });
});

onScopeDispose(() => { scope.stop(); });
```

**阅读指引**：

1. `darkMode`：条件分支依赖 — 当 `themeScheme === 'auto'` 时依赖 `osTheme`，否则只依赖 `settings.value.themeScheme`。Vue 自动追踪所有访问过的响应式数据
2. `themeColors`：解构赋值后构建新对象。注意 `computed` 返回的是新对象引用，不是原对象引用
3. `effectScope` + `scope.run()`：把三个 `watch` 包裹在同一个 scope 中，Store 重置时一键清理
4. `{ immediate: true }`：初始化时立即执行一次回调 — 这是 "初始化即生效" 的常见模式

### 目标文件 3：`src/views/manage/user/modules/user-search.vue`

```typescript
type RuleKey = Extract<keyof Api.SystemManage.UserSearchParams, 'userEmail' | 'userPhone'>;

const rules = computed<Record<RuleKey, App.Global.FormRule>>(() => {
  const { patternRules } = useFormRules(); // inside computed to make locale reactive
  return {
    userEmail: patternRules.email,
    userPhone: patternRules.phone
  };
});
```

**阅读指引**：

1. `computed` 内部调用了 `useFormRules()` — 这是为了当国际化语言切换时，表单验证规则能**自动重新生成**
2. `computed` 有**显式泛型类型** `Record<RuleKey, App.Global.FormRule>`，这是规范要求 — 所有 computed 的返回值类型应该被推导或显式声明
3. **为什么不用 `ref` + `watch` 手动维护？** 因为 `patternRules` 本身就是响应式的（内部依赖 locale），用 `computed` 更简洁，且自动处理缓存

### 目标文件 4：`src/hooks/common/table.ts`

```typescript
const mobilePagination = computed(() => {
  const p: TablePaginationConfig = { ...pagination, simple: appStore.isMobile };
  return p;
});

const rowSelection = computed<TableRowSelection<T>>(() => ({
  columnWidth: 48,
  type: 'checkbox',
  selectedRowKeys: checkedRowKeys.value,
  onChange: onSelectChange
}));

const scrollConfig = computed(() => ({
  y: wrapperElHeight.value - 72,
  x: toValue(scrollX)
}));

// inside scope.run
watch(
  () => appStore.locale,
  () => { reloadColumns(); }
);
```

**阅读指引**：

1. `mobilePagination`：浅拷贝 + 覆盖属性。`appStore.isMobile` 变化时自动重新计算
2. `rowSelection`：返回 Ant Design Vue 的配置对象。`checkedRowKeys.value` 是响应式数据，组件自动同步
3. `scrollConfig`：基于 DOM 尺寸计算（`wrapperElHeight` 来自 `useElementSize`）
4. `watch(() => appStore.locale, ...)`：**getter 形式**监听深层属性 — 推荐写法，避免监听整个对象

### 目标文件 5：`src/layouts/modules/global-tab/index.vue`

```typescript
watch(
  () => route.fullPath,
  () => { tabStore.addTab(route); }
);
watch(
  () => tabStore.activeTabId,
  () => { scrollToActiveTab(); }
);
```

**阅读指引**：

1. `watch(() => route.fullPath, ...)`：路由变化时自动添加 tab — 这是 "路由驱动 UI" 的典型模式
2. `watch(() => tabStore.activeTabId, ...)`：tab 切换时自动滚动到可视区域
3. 两个 `watch` 放在 `<script setup>` 顶层，组件卸载时**自动清理**（无需手动调用 `onScopeDispose`）

---

### 规范评审清单

| 检查项               | 标准                                    | auth/index.ts             | theme/index.ts                  | user-search.vue                | table.ts                      |
|-------------------|---------------------------------------|---------------------------|---------------------------------|--------------------------------|-------------------------------|
| 命名规范              | 文件kebab-case、函数camelCase、组件PascalCase | ✅ `auth/index.ts`         | ✅ `theme/index.ts`              | ✅ `user-search.vue`            | ✅ `table.ts`                  |
| 类型完整性             | 零any，computed有返回类型                    | ✅ `isLogin` 推导明确          | ✅ `computed` 有类型                | ✅ `computed<Record<...>>`      | ✅ 泛型完整                        |
| 目录规范              | 文件放在正确的目录                             | ✅ `store/modules/`        | ✅ `store/modules/`              | ✅ `views/manage/user/modules/` | ✅ `hooks/common/`             |
| 导入顺序              | type导入 → 第三方 → 内部 → 相对路径              | ✅ 符合                      | ✅ 符合                            | ✅ 符合                           | ✅ 符合                          |
| 错误处理              | 异步有try/catch或拦截                       | ⚠️ `getUserInfo` 有error判断 | N/A                             | N/A                            | N/A                           |
| 可测试性              | 纯函数可单测，副作用可mock                       | ✅ `isLogin` 是纯推导          | ✅ `darkMode` 纯推导                | ✅ `rules` 纯推导                  | ✅ `scrollConfig` 纯推导          |
| 国际化               | 用户可见字符串 `$t()`                        | ✅ Store中使用了               | N/A                             | ✅ `user-search` 全国际化           | ✅ `table.ts` 中有               |
| computed vs watch | 派生状态用computed，副作用用watch               | ✅ `isLogin`是computed      | ✅ `darkMode`是computed，副作用用watch | ✅ `rules`是computed             | ✅ `mobilePagination`是computed |

**评审发现**：

1. ✅ **典范用法**：`theme/index.ts` 的 `effectScope` + `onScopeDispose` 是副作用生命周期的最佳实践
2. ⚠️ **注意点**：`auth/index.ts` 中 `computed` 依赖 `import.meta.env`（非响应式），如果业务需求需要运行时切换环境，需要改用其他方案
3. 💡 **精进建议**：`table.ts` 中的 `watch(() => appStore.locale, ...)` 可以考虑用 `watchEffect` 简化，但需要确认 `reloadColumns` 内部是否有其他不需要追踪的副作用

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**任务**：实现一个 "表格全选/半选状态指示器" 组件，类似 carlos-framework-ui 中的 `rowSelection`，但新增一个顶部统计条。

功能拆解：

1. 接收表格数据（列表）和当前选中项（列表）
2. 计算 "全选状态"（全选/半选/未选）
3. 计算 "已选数量 / 总数量"
4. 显示统计条，含 "全选" 复选框
5. 支持 "清除已选" 按钮

### 第二步：小任务开发

#### 小任务 1：定义 Props 和状态

```typescript
// src/components/common/table-selection-bar.vue
<script setup lang="ts">
import { computed } from 'vue';
import { Checkbox } from 'ant-design-vue';

defineOptions({
  name: 'TableSelectionBar'
});

interface Props {
  /** 表格数据 */
  data: Array<Record<string, unknown>> & { id: string | number }[];
  /** 当前选中的 ID 列表 */
  selectedIds: (string | number)[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:selectedIds': [ids: (string | number)[]];
}>();

/** 总数量 — 派生状态，用 computed */
const totalCount = computed(() => props.data.length);

/** 已选数量 */
const selectedCount = computed(() => props.selectedIds.length);

/** 全选状态 */
const selectState = computed(() => {
  if (selectedCount.value === 0) return 'none';
  if (selectedCount.value === totalCount.value) return 'all';
  return 'indeterminate';
});

/** 全选/取消全选 */
function toggleSelectAll() {
  if (selectState.value === 'all') {
    emit('update:selectedIds', []);
  } else {
    const allIds = props.data.map(item => item.id);
    emit('update:selectedIds', allIds);
  }
}

/** 清除已选 */
function clearSelection() {
  emit('update:selectedIds', []);
}
</script>

<template>
  <div class="flex items-center justify-between px-4 py-2 rd-8px shadow-sm bg-white">
    <div class="flex items-center gap-12px">
      <Checkbox
        :checked="selectState === 'all'"
        :indeterminate="selectState === 'indeterminate'"
        @change="toggleSelectAll"
      >
        <span class="text-14px">
          已选择 {{ selectedCount }} / {{ totalCount }} 项
        </span>
      </Checkbox>
    </div>
    <AButton v-if="selectedCount > 0" type="link" danger @click="clearSelection">
      清除已选
    </AButton>
  </div>
</template>

<style scoped></style>
```

**技术要点**：

- `totalCount`、`selectedCount`、`selectState` 都是 **computed** — 因为它们是纯粹的派生状态
- `selectState` 返回 `'none' | 'all' | 'indeterminate'`，可以用 TypeScript 字面量联合类型精确约束
- 为什么不用 `watch`？因为不需要副作用，只需要派生值

#### 小任务 2：封装成可复用的 Composable

```typescript
// src/hooks/common/table-selection.ts
import { computed, ref, type Ref } from 'vue';

interface TableSelectionOptions<T extends { id: string | number }> {
  data: Ref<T[]>;
}

export function useTableSelection<T extends { id: string | number }>(options: TableSelectionOptions<T>) {
  const { data } = options;

  /** 选中的行 ID */
  const selectedIds = ref<(string | number)[]>([]);

  /** 全选状态 */
  const selectState = computed(() => {
    const total = data.value.length;
    const selected = selectedIds.value.length;
    if (selected === 0) return 'none' as const;
    if (selected === total) return 'all' as const;
    return 'indeterminate' as const;
  });

  /** 是否全部选中 */
  const isAllSelected = computed(() => selectState.value === 'all');

  /** 已选数据项 */
  const selectedItems = computed(() => {
    const idSet = new Set(selectedIds.value);
    return data.value.filter(item => idSet.has(item.id));
  });

  /** 切换全选 */
  function toggleSelectAll() {
    if (isAllSelected.value) {
      selectedIds.value = [];
    } else {
      selectedIds.value = data.value.map(item => item.id);
    }
  }

  /** 切换单选 */
  function toggleSelect(id: string | number) {
    const index = selectedIds.value.indexOf(id);
    if (index > -1) {
      selectedIds.value.splice(index, 1);
    } else {
      selectedIds.value.push(id);
    }
  }

  /** 清除选择 */
  function clearSelection() {
    selectedIds.value = [];
  }

  return {
    selectedIds,
    selectState,
    isAllSelected,
    selectedItems,
    toggleSelectAll,
    toggleSelect,
    clearSelection
  };
}
```

**技术要点**：

- `selectedItems` 是 computed — 基于 `selectedIds` 和 `data` 派生，带缓存
- `toggleSelectAll`、`toggleSelect`、`clearSelection` 是普通函数 — 它们**修改状态**，不是派生状态
- 返回的所有 computed 都可以直接在 template 中使用

#### 小任务 3：在页面中使用（集成 watch 监听分页变化时重置选择）

```typescript
// 在表格页面中使用
<script setup lang="ts">
import { watch } from 'vue';
import { useTableSelection } from '@/hooks/common/table-selection';

const tableData = ref<Api.SystemManage.User[]>([]);
const pagination = reactive({ current: 1, pageSize: 10 });

const { selectedIds, selectState, toggleSelectAll, clearSelection } = useTableSelection({
  data: tableData
});

// 分页变化时，清空已选（副作用 — 用 watch）
watch(
  () => [pagination.current, pagination.pageSize],
  () => {
    clearSelection();
  }
);

// 或者用 watchEffect（更简洁，但不够精确）
// watchEffect(() => {
//   // 访问了 pagination.current 和 pagination.pageSize
//   // 但也会追踪 clearSelection 内部没有的其他依赖
//   // 所以这里用 watch 更清晰
// });
</script>
```

**为什么用 `watch` 而不是 `watchEffect`？**

- `watch` 显式声明 `[pagination.current, pagination.pageSize]` 为依赖 — 意图清晰
- `watchEffect` 会追踪回调中所有访问的响应式数据，如果 `clearSelection` 内部意外访问了其他响应式数据，可能导致意料外的重新执行
- **规则**：有明确的触发源时，用 `watch`；只是简单副作用且依赖不复杂时，用 `watchEffect`

### 第三步：整合与调试

```vue
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useTableSelection } from '@/hooks/common/table-selection';

defineOptions({ name: 'DemoUserTable' });

// 模拟数据
const users = ref([
  { id: 1, name: '张三' },
  { id: 2, name: '李四' },
  { id: 3, name: '王五' }
]);

const pagination = reactive({ current: 1 });

const selection = useTableSelection({ data: users });

// 换页清空选择
watch(() => pagination.current, selection.clearSelection);

// 调试：监听选择变化
watch(
  () => selection.selectedIds.value,
  (newVal, oldVal) => {
    console.log('选择变化:', oldVal, '→', newVal);
  },
  { deep: true }
);
</script>
```

**调试思路**：

1. 打开 Vue DevTools → Pinia / Inspector → 查看 `selectedIds` 的实时变化
2. 在 `computed` 中加 `console.log`，验证是否真的在缓存（只有依赖变化时才打印）
3. 检查 `watch` 的 `oldVal` 和 `newVal` — 如果是对象/数组，确保理解引用比较 vs 值比较

### 验收标准

- [ ] **能用**：全选/半选/取消功能正常，分页切换时清空选择
- [ ] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过
- [ ] **精进**：
    - 所有派生状态用 `computed`，不用 `watch` + `ref` 手动维护
    - `watch` 依赖用 getter 形式 `() => xxx`
    - 无副作用泄露（组件卸载时 watch 自动清理）
    - 类型零 any

---

## 今日重点记忆卡

| 概念                    | 一句话                | Java类比                           | 前端独有                  |
|-----------------------|--------------------|----------------------------------|-----------------------|
| `computed`            | 有缓存的派生状态，依赖不变不重新计算 | Java `getter` + `@Cacheable`     | 自动依赖追踪，无需手动声明         |
| `watch`               | 显式监听数据源变化，执行副作用    | `PropertyChangeListener`         | 支持 getter 形式精确监听，有新旧值 |
| `watchEffect`         | 自动追踪访问的响应式数据，执行副作用 | `Observer` 自动订阅                  | 懒声明依赖，但不提供新旧值对比       |
| `effectScope`         | 批量管理副作用生命周期        | `DisposableBean` / `try-finally` | 可以跨组件/跨 Store 批量清理    |
| `{ immediate: true }` | 初始化时立即执行一次         | `@PostConstruct`                 | 让 watch 的副作用在挂载时即生效   |
| `{ deep: true }`      | 深度监听对象内部变化         | 深度 equals 对比                     | Vue 3 默认不深度监听，需要显式开启  |

---

## 今日代码规范自查清单

```markdown
### 提交前自检（computed / watch 专项）

- [ ] 派生状态优先用 `computed`，不用 `watch` + `ref` 维护
- [ ] `computed` 有明确的返回类型（推导或显式声明）
- [ ] `watch` 的依赖用 getter 形式 `() => xxx`
- [ ] `watch` 不需要旧值时，考虑用 `watchEffect`
- [ ] 有多个 `watch` 的 Store/Hook，考虑用 `effectScope` 管理生命周期
- [ ] 副作用有清理逻辑（`onScopeDispose` 或 `watch` 的 `onCleanup`）
- [ ] 不滥用 `deep: true`（性能开销大）
```

---

**明日预告**：第15天 — **组件设计模式 — 高阶组件、渲染函数、动态组件**

> 我们将学习如何用 `render` 函数和 `h()` 实现动态表单渲染器，以及如何用高阶组件实现权限控制。这是 Vue 3 组件封装的进阶篇。
