# 今日前端课程 — 第9天：Vue 3 组件基础 — 父子通信与插槽

> **学习目标**
> - 能读：读懂项目中所有组件的 Props/Emits/Slots 定义方式
> - 能用：按规范封装一个可复用的 Table 操作按钮组件
> - 规范：零 any、完整 JSDoc、`defineOptions` 声明、正确的导入顺序
> - 精进：理解为什么用 `defineModel` 替代 `v-model` + `emit('update:xxx')`，为什么用 `defineExpose` 暴露方法
> 
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + AntDV + Pinia + UnoCSS

---

## 理论学习

### 核心知识点

1. **Props 单向数据流** — 父组件通过 Props 向子组件传递数据，子组件不可直接修改 Props
2. **Emits 事件通信** — 子组件通过 `emit` 向父组件通知事件，携带数据
3. **Slots 内容分发** — 父组件向子组件"注入"模板内容，分为默认插槽、具名插槽、作用域插槽
4. **`defineModel` 双向绑定** — Vue 3.4+ 提供的简化双向绑定语法，替代 `v-model` + `emit('update:xxx')`
5. **`defineExpose` 暴露方法** — 让父组件通过 ref 调用子组件的方法
6. **`defineOptions` 声明组件名** — 规范要求所有组件显式声明 name，用于调试和递归

### Java 思维类比

| 前端概念 | 类比 | 连接说明 |
|--------|------|---------|
| Props | Java 构造参数 / setter 方法 | 父传子 = 构造注入，但子组件只能"读"不能"写" |
| `$emit` | Java 观察者模式 `notifyObservers()` | 子组件通知父组件："我发生了某个事件" |
| 默认插槽 `slot` | Java 模板方法模式 `abstract render()` | 父组件决定"子组件内部某个位置填什么内容" |
| 具名插槽 `#header` | Java 方法重载中不同的参数组合 | 子组件预留多个"插槽位置"，父组件按需填充 |
| `defineModel` | Java `PropertyChangeSupport` 的双向绑定 | 父子共享同一个响应式引用，谁改都行 |
| `defineExpose` | Java 公开方法（public method） | 父组件通过 ref 拿到子组件实例，调用其方法 |
| `defineOptions` | Java 类的 `@Component` 注解 | 显式声明元信息，便于调试和递归渲染 |

### 超越类比 — 前端独有的设计哲学

> **Props 是只读的，为什么不能直接修改？**
> 
> Java 中构造参数是值拷贝或引用传递，你在方法里改参数不会影响到调用方。但 Vue 的 Props 是响应式引用，如果子组件直接修改 `props.xxx`，父组件的状态也会跟着变——这破坏了"单向数据流"。
> 
> **前端为什么这样做更好？**
> 
> 1. **数据流向清晰**：父 → 子 → 孙，任何一层想改数据，都必须通过事件向上通知，层层传递到源头修改
> 2. **调试更简单**：你知道数据变化的唯一来源是父组件，不会怀疑子组件偷偷改了 Props
> 3. **性能优化**：Vue 可以精确追踪 Props 变化，只重渲染必要的子树
> 4. **与 Pinia 配合**：当状态变得复杂，直接上 Pinia，而不是层层传递 Props + emit
> 
> Java 中没有这个约束，因为 Java 对象引用本身就是可变的。但前端 UI 是一个"树形结构"，单向数据流让这棵树的更新变得可预测。这是 React/Vue 的核心设计哲学，不是语法限制，而是架构选择。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

1. `src/components/common/exception-base.vue` — Props 定义 + 计算属性
2. `src/components/common/lang-switch.vue` — Props + Emits + `withDefaults`
3. `src/components/common/app-provider.vue` — 默认插槽 + 嵌套组件
4. `src/components/custom/button-icon.vue` — 默认插槽 + 后备内容
5. `src/components/advanced/table-header-operation.vue` — 具名插槽 `#prefix` / `#default` / `#suffix`
6. `src/components/advanced/table-column-setting.vue` — `defineModel` 双向绑定
7. `src/views/manage/user/modules/user-operate-drawer.vue` — `defineExpose` + 具名插槽 `#footer`
8. `src/components/custom/better-scroll.vue` — `defineExpose` + 默认插槽

### 阅读指引

**1. `exception-base.vue` — Props 定义规范**

```vue
<script lang="ts" setup>
import {computed} from 'vue';
import {$t} from '@/locales';
import {useRouterPush} from '@/hooks/common/router';

defineOptions({name: 'ExceptionBase'});

type ExceptionType = '403' | '404' | '500';

interface Props {
  /**
   * Exception type
   *
   * - 403: no permission
   * - 404: not found
   * - 500: service error
   */
  type: ExceptionType;
}

const props = defineProps<Props>();
```

> **思考**：为什么用 `type ExceptionType = '403' | '404' | '500'` 而不是 `enum`？
> - 这是**字面量联合类型**，比 enum 更轻量，编译后不会生成额外代码
> - 仅用于类型约束，不需要运行时值

**2. `lang-switch.vue` — Props + Emits + `withDefaults`**

```vue
interface Props {
  /** Current language */
  lang: App.I18n.LangType;
  /** Language options */
  langOptions: App.I18n.LangOption[];
  /** Show tooltip */
  showTooltip?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showTooltip: true
});

type Emits = {
  (e: 'changeLang', lang: App.I18n.LangType): void;
};

const emit = defineEmits<Emits>();
```

> **思考**：为什么用 `withDefaults` 而不是在 `interface` 里写 `showTooltip: boolean = true`？
> - TS 接口不支持默认值，默认值只能在运行时设定
> - `withDefaults` 是编译时宏，会在编译后的代码中插入默认值逻辑

**3. `table-header-operation.vue` — 具名插槽的最佳实践**

```vue
<template>
  <div class="flex flex-wrap justify-end gap-x-12px gap-y-8px lt-sm:(w-200px py-12px)">
    <slot name="prefix"></slot>
    <slot name="default">
      <!-- 默认插槽有后备内容：新增 + 批量删除 -->
      <AButton size="small" ghost type="primary" @click="add">
        ...
      </AButton>
      <APopconfirm ...>
        <AButton size="small" danger ...>
          ...
        </AButton>
      </APopconfirm>
    </slot>
    <AButton size="small" @click="refresh">...</AButton>
    <TableColumnSetting v-model:columns="columns"/>
    <slot name="suffix"></slot>
  </div>
</template>
```

> **思考**：为什么用 `<slot name="default">` 包裹默认按钮，而不是直接写？
> - 父组件可以覆盖默认内容（比如隐藏"批量删除"），也可以不传任何内容使用默认
> - 这是**可扩展的组件设计**：默认能用，扩展也容易

**4. `table-column-setting.vue` — `defineModel` 双向绑定**

```vue
<script setup lang="ts" generic="T extends Record<string, unknown>, K = never">
const columns = defineModel<AntDesign.TableColumnCheck[]>('columns', {
  required: true
});
</script>
```

> **思考**：`defineModel` 和 `props + emit('update:xxx')` 有什么区别？
> - 代码量减少 50%：不需要写 `props.columns` 和 `emit('update:columns')`
> - 父组件用法不变：`<TableColumnSetting v-model:columns="columns" />`
> - 子组件直接 `columns.value = ...` 修改，父组件自动同步

**5. `user-operate-drawer.vue` — 具名插槽 `#footer` + 完整表单**

```vue
<ADrawer v-model:open="visible" :title="title" :width="360">
  <AForm ...>...</AForm>
  <template #footer>
    <ASpace :size="16">
      <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
      <AButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</AButton>
    </ASpace>
  </template>
</ADrawer>
```

> **思考**：`#footer` 是 Ant Design Vue 的 Drawer 组件提供的具名插槽，不是 Vue 原生语法。但写法是 Vue 的语法糖 `<template #name>`。记住：插槽是 Vue 的，具体插槽名由子组件定义。

**6. `better-scroll.vue` — `defineExpose` 暴露方法**

```vue
<script setup lang="ts">
const instance = ref<BScroll>();
// ...
defineExpose({instance});
</script>
```

> **思考**：为什么暴露 `instance` 而不是方法？
> - 父组件可能需要调用 BScroll 的任意方法（`refresh`, `scrollTo`, `destroy` 等）
> - 直接暴露实例比逐一包装方法更灵活，但也更耦合
> - 权衡：如果是通用组件，暴露实例；如果是业务组件，暴露封装好的方法

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件kebab-case、组件PascalCase、通过 `defineOptions` 声明 | ✅ exception-base.vue → `ExceptionBase` ✅ lang-switch.vue → `LangSwitch` ✅ table-header-operation.vue → `TableHeaderOperation` |
| 类型完整性 | 零any，所有 Props/Emits 有类型定义 | ✅ 所有 Props 使用 `interface Props` 定义 ✅ Emits 使用 `type Emits = { (e: 'xxx', ...): void }` ✅ 无 `any` 逃逸 |
| 目录规范 | 通用组件在 `common/`，高级业务在 `advanced/`，业务模块在 `views/xxx/modules/` | ✅ 目录分层清晰 |
| 导入顺序 | type → 第三方 → 内部模块（@/store/ @/hooks/ @/utils/） → 相对路径 | ✅ 大部分符合，exception-base.vue 的 `$t` 导入在 `computed` 之前，但 `useRouterPush` 在之后，顺序稍乱 |
| 错误处理 | 异步操作有 try/catch 或统一拦截 | ⚠️ `user-operate-drawer.vue` 中 `getRoleOptions()` 有错误处理（`if (!error)`），但 `handleSubmit` 缺少 try/catch 包裹 validate 和 API 调用 |
| 可测试性 | 纯函数可单测，副作用可 mock | ✅ `exception-base.vue` 的 `icon` computed 是纯函数 ✅ `lang-switch.vue` 的 `changeLang` 是纯函数，emit 可被 mock |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ 所有按钮文字、表单项标签均使用 `$t()` |
| JSDoc 注释 | 复杂 Props 添加 JSDoc | ✅ `exception-base.vue` 的 `type` Props 有详细注释 ✅ 但 `lang-switch.vue` 的 `langOptions` 缺少注释 |

> **评审结论**：项目整体规范执行良好，但有两个可改进点：
> 1. `user-operate-drawer.vue` 的 `handleSubmit` 应添加 try/catch 包裹
> 2. 导入顺序可更严格地按规范排序

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**目标**：封装一个 `<TableActionBar>` 组件，用于管理页面表格上方操作区域。

拆解任务：
1. 分析已有组件 `table-header-operation.vue` 的设计思路
2. 理解 Props + Emits + Slots 的组合使用方式
3. 扩展功能：添加一个"导出"按钮，并通过插槽让父组件可以自定义

### 第二步：小任务开发

**任务 2.1：读懂现有组件的接口设计**

查看 `src/components/advanced/table-header-operation.vue`：

```typescript
interface Props {
  disabledDelete?: boolean;
  loading?: boolean;
}

interface Emits {
  (e: 'add'): void;
  (e: 'delete'): void;
  (e: 'refresh'): void;
}

const columns = defineModel<AntDesign.TableColumnCheck[]>('columns', {
  default: () => []
});
```

> 设计要点：
> - `disabledDelete` 控制删除按钮禁用状态 — 父组件根据"是否选中行"决定
> - `loading` 控制刷新按钮旋转动画 — 父组件根据请求状态决定
> - `defineModel` 的 `columns` 实现列设置弹窗的共享状态

**任务 2.2：按规范封装新组件**

在 `src/components/common/` 下创建 `table-action-bar.vue`（供练习使用，不提交）：

```vue
<script setup lang="ts">
import {$t} from '@/locales';

defineOptions({
  name: 'TableActionBar'
});

interface Props {
  /** Whether to show the add button */
  showAdd?: boolean;
  /** Whether to disable the delete button */
  disabledDelete?: boolean;
  /** Whether the refresh button is loading */
  loading?: boolean;
  /** Whether to show the export button */
  showExport?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showAdd: true,
  disabledDelete: true,
  loading: false,
  showExport: false
});

interface Emits {
  (e: 'add'): void;
  (e: 'delete'): void;
  (e: 'refresh'): void;
  (e: 'export'): void;
}

const emit = defineEmits<Emits>();

function handleAdd() {
  emit('add');
}

function handleDelete() {
  emit('delete');
}

function handleRefresh() {
  emit('refresh');
}

function handleExport() {
  emit('export');
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-12px">
    <!-- 左侧：标题或自定义前缀 -->
    <div class="flex items-center gap-12px">
      <slot name="left">
        <span class="text-16px font-medium">{{ $t('common.list') }}</span>
      </slot>
    </div>

    <!-- 右侧：操作按钮 -->
    <div class="flex flex-wrap items-center gap-12px">
      <slot name="prefix" />

      <slot name="default">
        <AButton v-if="showAdd" type="primary" @click="handleAdd">
          <template #icon>
            <icon-ic-round-plus class="align-sub text-icon" />
          </template>
          <span class="ml-8px">{{ $t('common.add') }}</span>
        </AButton>

        <APopconfirm
          :title="$t('common.confirmDelete')"
          :disabled="disabledDelete"
          @confirm="handleDelete"
        >
          <AButton danger :disabled="disabledDelete">
            <template #icon>
              <icon-ic-round-delete class="align-sub text-icon" />
            </template>
            <span class="ml-8px">{{ $t('common.batchDelete') }}</span>
          </AButton>
        </APopconfirm>
      </slot>

      <AButton v-if="showExport" @click="handleExport">
        <template #icon>
          <icon-mdi-download class="align-sub text-icon" />
        </template>
        <span class="ml-8px">{{ $t('common.export') }}</span>
      </AButton>

      <AButton :loading="loading" @click="handleRefresh">
        <template #icon>
          <icon-mdi-refresh class="align-sub text-icon" />
        </template>
        <span class="ml-8px">{{ $t('common.refresh') }}</span>
      </AButton>

      <slot name="suffix" />
    </div>
  </div>
</template>

<style scoped></style>
```

**任务 2.3：父组件中使用**

```vue
<script setup lang="ts">
import {ref} from 'vue';
import {$t} from '@/locales';

defineOptions({ name: 'UserManage' });

const loading = ref(false);
const selectedRows = ref<Api.SystemManage.User[]>([]);

function handleAdd() {
  // 打开新增弹窗
}

function handleDelete() {
  // 批量删除逻辑
}

function handleRefresh() {
  loading.value = true;
  // 加载数据
  loading.value = false;
}

function handleExport() {
  // 导出 Excel
}
</script>

<template>
  <div class="card-wrapper">
    <TableActionBar
      :show-export="true"
      :disabled-delete="selectedRows.length === 0"
      :loading="loading"
      @add="handleAdd"
      @delete="handleDelete"
      @refresh="handleRefresh"
      @export="handleExport"
    >
      <template #left>
        <span class="text-16px font-medium">{{ $t('page.manage.user.title') }}</span>
      </template>
    </TableActionBar>

    <ATable :data-source="userList" :columns="columns" row-key="id">
      <!-- 表格内容 -->
    </ATable>
  </div>
</template>
```

### 第三步：整合与测试

**关系分析**：
1. `TableActionBar` 是**纯粹的表现组件**（Presentational Component）：只负责 UI 布局和事件转发，不持有业务状态
2. 业务状态（`selectedRows`、`loading`）在父组件中管理，通过 Props 传入
3. 用户操作通过 Events 向上通知，父组件决定如何处理

**调试思路**：
- 如果点击按钮没反应：检查 `emit` 的事件名是否拼写正确（大小写敏感）
- 如果 Props 没生效：检查 `withDefaults` 的默认值是否覆盖了传入值
- 如果插槽不渲染：检查 `<template #name>` 的 name 是否与组件内 `<slot name="name">` 一致
- 如果 `defineModel` 不生效：检查 Vue 版本是否 >= 3.4

### 验收标准

- [ ] 能用：组件能正确渲染，所有按钮点击有响应
- [ ] 规范：`pnpm typecheck` 通过，`pnpm lint` 通过
- [ ] 精进：对照规范评审清单自检通过
  - [ ] 组件名使用 PascalCase，通过 `defineOptions` 声明
  - [ ] 所有 Props 有类型定义和 JSDoc 注释
  - [ ] 所有 Emits 有类型定义
  - [ ] 使用 `withDefaults` 提供默认值
  - [ ] 使用 `$t()` 国际化
  - [ ] 导入顺序：type → Vue → @/ → 相对路径

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| Props | 父组件传给子组件的数据，子组件只读 | 构造参数 / setter | 响应式引用，单向数据流 |
| Emits | 子组件通知父组件的事件 | 观察者模式 `notifyObservers()` | 事件名 + 载荷类型安全 |
| 默认插槽 | 父组件填充子组件的默认位置 | 模板方法 `render()` | 可以有"后备内容" |
| 具名插槽 | 父组件填充子组件的指定位置 | 方法重载 | 语法糖 `<template #name>` |
| `defineModel` | 双向绑定的语法糖 | `PropertyChangeSupport` | 自动同步父子状态，无需 emit |
| `defineExpose` | 暴露子组件方法给父组件 | public 方法 | 通过 ref 获取实例调用 |
| `withDefaults` | 给 Props 设置默认值 | 构造器重载 | 编译时宏，不生成运行时代码 |
| `defineOptions` | 声明组件元信息 | `@Component` | 必须显式声明 name |

---

## 常见错误排查

| 错误现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| `props.xxx` 未定义 | 拼写错误或未在 `interface Props` 中声明 | 检查 Props 接口和模板中的拼写 |
| `emit` 事件不触发 | 事件名大小写不匹配 | Vue 模板中 `@event-name` 对应 `emit('event-name')` |
| 插槽内容不显示 | 插槽名不匹配 | 父组件 `<template #footer>` 对应子组件 `<slot name="footer">` |
| `defineModel` 报错 | Vue 版本 < 3.4 | 升级 Vue 或改用 `props + emit('update:xxx')` |
| 组件名在调试器显示异常 | 未使用 `defineOptions` | 添加 `defineOptions({ name: 'Xxx' })` |

---

**明日预告**：第10天 — Composition API 核心 — `setup`、`ref`、`reactive` 的底层机制

> 我们将深入理解 Vue 3 的响应式系统，手写一个极简的 `reactive()` 实现，理解为什么 `.value` 设计是必要的。Java 工程师对 `AtomicReference` 的理解将帮助你快速建立连接。
