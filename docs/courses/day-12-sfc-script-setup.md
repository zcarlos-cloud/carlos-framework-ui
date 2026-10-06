# 今日前端课程 — 第12天：单文件组件（SFC）与 `<script setup>` 语法糖

> **学习目标**
> - **能读**：看懂 `.vue` 文件的三大块（script/template/style），理解 `<script setup>` 的编译产物
> - **能用**：手写一个完整的 `<script setup lang="ts">` 组件，包含 Props、Emits、插槽、Model
> - **规范**：遵循 carlos-ui 的导入顺序、命名规范、类型规范（零 `any`）
> - **精进**：理解为什么 Vue 3 选择编译期宏（`defineProps`/`defineEmits`）而不是运行时反射，掌握 TSX 在 SFC 中的用法
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + `<script setup>`

---

## 理论学习

### 核心知识点

#### 1. `.vue` 文件的本质：三合一

一个 `.vue` 文件 = **逻辑层**（script）+ **视图层**（template）+ **样式层**（style）。Vite 通过 `@vitejs/plugin-vue` 在编译时将其拆成三个部分，分别交给对应的处理器：

```
.vue 文件
├── <script setup lang="ts">  →  TypeScript 编译器 → ES Module
├── <template>               →  Vue 模板编译器 → render function (h())
└── <style scoped>           →  PostCSS → 带作用域的 CSS
```

**Java 类比**：像 Java Swing 的 `JPanel` 子类 + FXML 布局 + CSS 样式表，写在一个文件里。但本质区别在于：Vue 是**编译时**三合一，Swing 是**运行时**组装。

#### 2. `<script setup>` — 为什么不是 `setup()` 函数？

Vue 3 提供两种 Composition API 写法：

```typescript
// 写法 A：setup() 函数（显式）
export default {
  setup() {
    const count = ref(0);
    return { count };
  }
};

// 写法 B：<script setup>（编译时自动展开）
<script setup lang="ts">
const count = ref(0);
</script>
```

`<script setup>` 是编译器语法糖。Vite 编译时会把 `<script setup>` 的内容**自动包裹到 `setup()` 函数中**，并将顶层变量自动暴露给模板。减少样板代码，是 carlos-ui 的唯一写法。

**Java 类比**：像 Lombok 的 `@Data` 自动生成 getter/setter，但 `<script setup>` 更激进——它改变了整个组件的代码组织方式。

#### 3. `defineOptions` — 显式声明组件元数据

```vue
<script setup lang="ts">
defineOptions({
  name: 'App',           // 组件名（DevTools 和递归组件需要）
  inheritAttrs: false    // 是否自动继承 $attrs 到根元素
});
</script>
```

在 `<script setup>` 中无法直接写 `export default { name: 'Xxx' }`，`defineOptions` 是编译器宏，用来填补这个缺口。carlos-ui 强制要求每个组件声明 `name`。

#### 4. `defineProps` + `withDefaults` — 类型安全的父传子

```typescript
interface Props {
  /** 用户ID */
  userId?: number;
  /** 是否显示 */
  visible: boolean;
  /** 模式 */
  mode?: 'create' | 'edit' | 'view';
}

// 带默认值
const props = withDefaults(defineProps<Props>(), {
  userId: 0,
  mode: 'create'
});
```

**关键区别**：`defineProps` 是**编译器宏**（compile-time macro），运行时不存在。Vue 编译器根据类型定义自动生成 `props` 选项。这是前端独有的设计——**类型即运行时契约**。

**Java 类比**：像 Java 构造函数参数 + `@NotNull` 注解，但 Java 的类型只在编译期检查，运行时被擦除。Vue 的 `defineProps` 类型定义**同时服务于编译期和运行时**（生成 props 校验）。

#### 5. `defineEmits` — 类型安全的子传父

```typescript
const emit = defineEmits<{
  submit: [data: UserFormData];  // 带参数
  cancel: [];                     // 无参数
  'update:visible': [value: boolean]; // v-model 约定事件
}>();
```

使用**元组类型**声明参数，调用时：`emit('submit', formData)`。TypeScript 会自动校验事件名和参数类型。

#### 6. `defineModel` — Vue 3.4+ 的 v-model 双向绑定（ carlos-ui 已在使用）

```typescript
const columns = defineModel<AntDesign.TableColumnCheck[]>('columns', {
  default: () => []
});
```

在父组件中使用：`<TableHeaderOperation v-model:columns="columnChecks" />`。比传统的 `props + emit('update:xxx')` 更简洁。

#### 7. `<script setup lang="tsx">` — TSX 在 SFC 中

当渲染逻辑复杂（如条件渲染表格单元格），模板语法可能不够灵活。carlos-ui 的 `user/index.vue` 使用 `lang="tsx"`：

```tsx
// 在 customRender 中直接返回 JSX
{
  key: 'userGender',
  customRender: ({record}) => {
    const tagMap: Record<Api.SystemManage.UserGender, string> = {
      1: 'processing',
      2: 'error'
    };
    return <Tag color={tagMap[record.userGender]}>{label}</Tag>;
  }
}
```

**何时用模板，何时用 TSX？**
- 模板：静态结构、条件/循环渲染、属性绑定（可读性优先）
- TSX：动态渲染逻辑、复杂单元格渲染、需要 TypeScript 精确控制的场景

### Java 思维类比

| 前端概念 | Java 类比 | 说明 |
|---------|----------|------|
| `.vue` 文件 | `JPanel` + FXML + CSS | 三合一文件，但前端是编译时组装 |
| `<script setup>` | 构造函数 + `@PostConstruct` + Lombok | 初始化逻辑自动注入，减少样板 |
| `defineProps` | 构造函数参数 + `@NotNull` | 类型即运行时契约 |
| `defineEmits` | `Observer.notifyObservers()` | 事件通知，但类型安全 |
| `defineModel` | `PropertyChangeSupport` | 双向绑定的简化 |
| `defineOptions` | `@Component("name")` | 组件元数据声明 |
| `scoped style` | 组件级 CSS 隔离 | Java 没有原生样式作用域概念 |
| 插槽 `slot` | 模板方法模式 `abstract render()` | 父组件填充子组件的"占位符" |

### 超越类比 — 前端独有的设计哲学

> **为什么 Vue 选择编译器宏（`defineProps`/`defineEmits`）而不是运行时反射？**
>
> 1. **性能**：编译时生成代码，运行时无需类型检查开销。Java 的反射在运行时，Vue 的宏在编译时——前端对首屏加载性能极度敏感。
> 2. **Tree Shaking**：编译期可静态分析，未使用的 props/emits 定义可被优化。Java 的注解处理器无法做到这一点。
> 3. **类型零损耗**：`defineProps<Props>()` 的类型定义完全在编译期，不生成任何运行时代码。Java 泛型会擦除，但 Vue 的宏编译器能把类型直接转换为运行时选项。
> 4. **单文件思维**：`.vue` 文件是前端的独特产物——一个组件的所有相关代码（逻辑、模板、样式）被强制内聚，Java 中这三者通常分散在不同文件。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

#### 文件 1：`src/App.vue` — 最标准的 SFC 模板

```vue
<script setup lang="ts">
import type {WatermarkProps} from 'ant-design-vue';     // 1. type 导入
import {computed} from 'vue';                           // 2. Vue 库
import {ConfigProvider} from 'ant-design-vue';          // 2. 第三方库
import {useAppStore} from './store/modules/app';        // 3. 内部模块
import {useThemeStore} from './store/modules/theme';    // 3. 内部模块
import {antdLocales} from './locales/antd';             // 3. 内部模块

defineOptions({ name: 'App' });                         // 4. 组件选项

const appStore = useAppStore();                          // 5. 逻辑代码
const themeStore = useThemeStore();

const antdLocale = computed(() => {                    // 5. 计算属性
  return antdLocales[appStore.locale];
});
</script>

<template>
  <ConfigProvider :theme="themeStore.antdTheme" :locale="antdLocale">
    <AppProvider>
      <RouterView class="bg-layout"/>
    </AppProvider>
  </ConfigProvider>
</template>

<style scoped></style>
```

**阅读指引**：
1. 导入顺序：type → Vue → 第三方库 → 内部模块 → 无相对路径（根组件）
2. `defineOptions({ name: 'App' })` — 单字组件名 `App` 是允许的白名单
3. 没有 `any`，所有类型完整

#### 文件 2：`src/components/custom/svg-icon.vue` — Props 设计典范

```vue
<script setup lang="ts">
import {computed, useAttrs} from 'vue';
import {Icon} from '@iconify/vue';

defineOptions({name: 'SvgIcon', inheritAttrs: false});

interface Props {
  /** Iconify icon name */
  icon?: string;
  /** Local svg icon name */
  localIcon?: string;
}

const props = defineProps<Props>();
const attrs = useAttrs();

const bindAttrs = computed<{ class: string; style: string }>(() => ({
  class: (attrs.class as string) || '',
  style: (attrs.style as string) || ''
}));

const symbolId = computed(() => {
  const {VITE_ICON_LOCAL_PREFIX: prefix} = import.meta.env;
  const defaultLocalIcon = 'no-icon';
  const icon = props.localIcon || defaultLocalIcon;
  return `#${prefix}-${icon}`;
});

const renderLocalIcon = computed(() => props.localIcon || !props.icon);
</script>
```

**学习要点**：
- `inheritAttrs: false` — 防止 attrs 自动透传到根元素，手动控制绑定
- `useAttrs()` — 获取非 props 的 attribute（如 class/style）
- 两个 props 的优先级设计：`localIcon` 优先于 `icon`

#### 文件 3：`src/components/custom/button-icon.vue` — `withDefaults` 用法

```vue
<script setup lang="ts">
import type {TooltipPlacement} from 'ant-design-vue/es/tooltip';
import {twMerge} from 'tailwind-merge';

defineOptions({ name: 'ButtonIcon', inheritAttrs: false });

interface Props {
  class?: string;
  icon?: string;
  tooltipContent?: string;
  tooltipPlacement?: TooltipPlacement;
  triggerParent?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  class: 'h-36px text-icon',
  icon: '',
  tooltipContent: '',
  tooltipPlacement: 'bottom',
  triggerParent: false
});

function getPopupContainer(triggerNode: HTMLElement) {
  return props.triggerParent ? triggerNode.parentElement! : document.body;
}
</script>
```

**学习要点**：
- `withDefaults` 给可选 props 提供默认值
- `!` 非空断言（`triggerNode.parentElement!`）— 规范允许在确定不为 null 时使用

#### 文件 4：`src/components/advanced/table-header-operation.vue` — Emits + `defineModel`

```vue
<script setup lang="ts">
import {$t} from '@/locales';

defineOptions({ name: 'TableHeaderOperation' });

interface Props {
  disabledDelete?: boolean;
  loading?: boolean;
}

defineProps<Props>();

interface Emits {
  (e: 'add'): void;
  (e: 'delete'): void;
  (e: 'refresh'): void;
}

const emit = defineEmits<Emits>();

const columns = defineModel<AntDesign.TableColumnCheck[]>('columns', {
  default: () => []
});
</script>
```

**学习要点**：
- `defineModel` 实现 `v-model:columns` 双向绑定（Vue 3.4+）
- Emits 使用 TypeScript 函数签名语法，更精确

#### 文件 5：`src/views/manage/user/index.vue` — TSX 在 SFC 中的实战

```vue
<script setup lang="tsx">  <!-- 注意 lang="tsx" -->
import {Button, Popconfirm, Tag} from 'ant-design-vue';
import {fetchGetUserList} from '@/service/api';
import {useTable, useTableOperate, useTableScroll} from '@/hooks/common/table';
// ...

const { columns, data, loading, ... } = useTable({
  apiFn: fetchGetUserList,
  columns: () => [
    {
      key: 'userGender',
      customRender: ({record}) => {
        const tagMap: Record<Api.SystemManage.UserGender, string> = {
          1: 'processing',
          2: 'error'
        };
        return <Tag color={tagMap[record.userGender]}>{label}</Tag>;
      }
    },
    {
      key: 'operate',
      customRender: ({record}) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
            {$t('common.edit')}
          </Button>
          <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
            <Button danger size="small">{$t('common.delete')}</Button>
          </Popconfirm>
        </div>
      )
    }
  ]
});
</script>
```

**学习要点**：
- `lang="tsx"` 允许在 `<script setup>` 中使用 JSX 语法
- 表格的 `customRender` 返回 JSX 元素，比模板语法更灵活
- JSX 中事件绑定用 `onClick`（驼峰），而非模板的 `@click`（指令）

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件 kebab-case、组件 PascalCase | ✅ `svg-icon.vue` / `SvgIcon` |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ `svg-icon.vue` 无 any，`user/index.vue` 无 any |
| 目录规范 | 文件放在正确的目录 | ✅ `custom/` 放自定义组件，`advanced/` 放业务组件 |
| 导入顺序 | type → 第三方 → 内部 → 相对 | ✅ 所有文件均遵循 |
| `defineOptions` | 每个组件显式声明 name | ✅ `App.vue`、`SvgIcon`、`ButtonIcon` 均有 |
| 错误处理 | 异步有 try/catch 或统一拦截 | ✅ `useTable` 封装了请求错误 |
| 可测试性 | 纯函数可单测，副作用可 mock | ✅ `computed` 是纯函数，Store 可 mock |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ `table-header-operation.vue` 全部使用 `$t` |
| Props JSDoc | 复杂 props 添加注释 | ✅ `svg-icon.vue` 有 JSDoc |
| 零 `console.log` | 生产代码无调试输出 | ⚠️ `user/index.vue` 有 `console.log(id)` 残留 |

**评审结论**：`console.log` 是规范瑕疵。生产代码中应删除或使用日志工具。

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**目标**：用 `<script setup>` 实现一个 `UserCard` 组件，包含：
1. 接收用户信息（姓名、角色、状态、头像URL）
2. 点击发送"查看详情"事件
3. 点击状态切换按钮，双向绑定状态
4. 支持插槽自定义底部操作区
5. 使用 scoped style + UnoCSS 原子类

**小任务拆解**：
- 任务 A：定义 Props 类型（interface + JSDoc）
- 任务 B：定义 Emits 事件（查看详情 + 状态切换）
- 任务 C：使用 `defineModel` 实现状态双向绑定
- 任务 D：定义默认插槽和具名插槽（`default`、`footer`）
- 任务 E：编写模板结构，使用 UnoCSS 类
- 任务 F：添加 scoped style（如需要自定义动画）

### 第二步：小任务开发

#### 任务 A：定义 Props（类型驱动设计）

```vue
<script setup lang="ts">
interface Props {
  /** 用户ID */
  id: number;
  /** 用户姓名 */
  name: string;
  /** 用户角色 */
  role: 'admin' | 'editor' | 'viewer';
  /** 用户状态：1=启用, 2=禁用 */
  status: 1 | 2;
  /** 头像URL */
  avatarUrl?: string;
}

const props = withDefaults(defineProps<Props>(), {
  avatarUrl: ''
});
</script>
```

**技术要点**：
- 联合类型 `'admin' | 'editor' | 'viewer'` 限制 role 只能是这三个值（Java 用 enum）
- `withDefaults` 给可选属性默认值
- 必传属性不写 `?`，Vue 会自动校验

#### 任务 B：定义 Emits

```typescript
interface Emits {
  /** 查看详情 */
  (e: 'viewDetail', id: number): void;
  /** 删除用户 */
  (e: 'delete', id: number): void;
}

const emit = defineEmits<Emits>();

function handleViewDetail() {
  emit('viewDetail', props.id);
}

function handleDelete() {
  emit('delete', props.id);
}
```

**技术要点**：
- 使用函数签名语法 `(e: 'eventName', arg: Type)`，比数组语法更精确
- 事件处理函数不要直接写 `emit('viewDetail', props.id)` 在模板中，抽离为函数更易维护

#### 任务 C：使用 `defineModel` 实现状态切换

```typescript
const modelStatus = defineModel<1 | 2>('status', { required: true });

function toggleStatus() {
  modelStatus.value = modelStatus.value === 1 ? 2 : 1;
}
```

**技术要点**：
- `defineModel` 是 Vue 3.4+ 特性，carlos-ui 已使用（`table-header-operation.vue`）
- 父组件使用 `<UserCard v-model:status="user.status" />`
- 命名规范：`modelXxx` 或直接用原属性名（推荐 `modelStatus` 避免冲突）

#### 任务 D：插槽设计

```vue
<template>
  <div class="card-wrapper flex-col gap-12px p-16px rd-8px bg-white shadow-sm">
    <div class="flex items-center gap-12px">
      <AAvatar :src="avatarUrl" :size="48">
        <template #icon><UserOutlined /></template>
      </AAvatar>
      <div class="flex-col gap-4px">
        <span class="text-16px font-medium">{{ name }}</span>
        <ATag :color="roleColor">{{ role }}</ATag>
      </div>
    </div>

    <!-- 默认插槽：允许父组件覆盖中间内容 -->
    <div class="flex-1">
      <slot>
        <p class="text-14px text-gray-500">{{ description }}</p>
      </slot>
    </div>

    <!-- 底部操作区：具名插槽 -->
    <div class="flex justify-between items-center">
      <ASwitch
        :checked="modelStatus === 1"
        @change="toggleStatus"
        :checked-children="$t('common.enable')"
        :un-checked-children="$t('common.disable')"
      />
      <div class="flex gap-8px">
        <slot name="footer">
          <AButton type="primary" ghost size="small" @click="handleViewDetail">
            {{ $t('common.detail') }}
          </AButton>
          <AButton danger size="small" @click="handleDelete">
            {{ $t('common.delete') }}
          </AButton>
        </slot>
      </div>
    </div>
  </div>
</template>
```

**技术要点**：
- 默认插槽 `<slot>`：父组件不传入则显示默认内容
- 具名插槽 `<slot name="footer">`：允许父组件完全自定义底部操作
- 插槽是前端"模板方法模式"——定义骨架，允许子类（父组件）填充

#### 任务 E：完整的 SFC 文件

将上述代码整合到 `src/components/common/user-card.vue`（或练习目录中）：

```vue
<script setup lang="ts">
import {computed} from 'vue';
import {useI18n} from 'vue-i18n';
import {Avatar, Button, Switch, Tag} from 'ant-design-vue';
import {UserOutlined} from '@ant-design/icons-vue';

defineOptions({ name: 'UserCard' });

interface Props {
  id: number;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 1 | 2;
  avatarUrl?: string;
  description?: string;
}

const props = withDefaults(defineProps<Props>(), {
  avatarUrl: '',
  description: ''
});

interface Emits {
  (e: 'viewDetail', id: number): void;
  (e: 'delete', id: number): void;
}

const emit = defineEmits<Emits>();

const modelStatus = defineModel<1 | 2>('status', { required: true });

const {t} = useI18n();

const roleColor = computed(() => {
  const map: Record<Props['role'], string> = {
    admin: 'red',
    editor: 'blue',
    viewer: 'green'
  };
  return map[props.role];
});

function toggleStatus() {
  modelStatus.value = modelStatus.value === 1 ? 2 : 1;
}

function handleViewDetail() {
  emit('viewDetail', props.id);
}

function handleDelete() {
  emit('delete', props.id);
}
</script>

<template>
  <div class="card-wrapper flex-col gap-12px p-16px rd-8px bg-white shadow-sm transition-all-300 hover:shadow-md">
    <div class="flex items-center gap-12px">
      <Avatar :src="avatarUrl" :size="48">
        <template #icon><UserOutlined /></template>
      </Avatar>
      <div class="flex-col gap-4px">
        <span class="text-16px font-medium">{{ name }}</span>
        <Tag :color="roleColor">{{ role }}</Tag>
      </div>
    </div>

    <div class="flex-1">
      <slot>
        <p class="text-14px text-gray-500">{{ description }}</p>
      </slot>
    </div>

    <div class="flex justify-between items-center">
      <Switch
        :checked="modelStatus === 1"
        @change="toggleStatus"
        :checked-children="t('common.enable')"
        :un-checked-children="t('common.disable')"
      />
      <div class="flex gap-8px">
        <slot name="footer">
          <Button type="primary" ghost size="small" @click="handleViewDetail">
            {{ t('common.detail') }}
          </Button>
          <Button danger size="small" @click="handleDelete">
            {{ t('common.delete') }}
          </Button>
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-wrapper {
  min-width: 280px;
}
</style>
```

### 第三步：整合与测试

在父组件中使用：

```vue
<script setup lang="ts">
import {ref} from 'vue';
import UserCard from './components/common/user-card.vue';

const users = ref([
  { id: 1, name: '张三', role: 'admin' as const, status: 1 as 1 | 2, description: '系统管理员' },
  { id: 2, name: '李四', role: 'editor' as const, status: 2 as 1 | 2, description: '内容编辑' }
]);

function handleViewDetail(id: number) {
  console.log('查看详情', id);
}

function handleDelete(id: number) {
  console.log('删除', id);
}
</script>

<template>
  <div class="flex gap-16px p-24px">
    <UserCard
      v-for="user in users"
      :key="user.id"
      v-model:status="user.status"
      v-bind="user"
      @view-detail="handleViewDetail"
      @delete="handleDelete"
    />
  </div>
</template>
```

### 调试与错误排查思路

1. **Props 类型报错**：检查 `defineProps<Props>()` 的类型是否和传入值匹配，注意 `as const` 断言
2. **`v-model:status` 不生效**：检查 `defineModel` 是否正确定义，Vue 版本需 >= 3.4
3. **插槽不渲染**：检查 `<slot name="xxx">` 和 `<template #xxx>` 的命名是否一致
4. **样式不生效**：检查 `scoped` 属性，UnoCSS 类名是否拼写正确（建议安装 UnoCSS 插件）

### 验收标准

- [ ] **能用**：`UserCard` 组件编译通过，点击事件、状态切换、插槽均正常
- [ ] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过，零 `any`
- [ ] **精进**：
  - 使用 `defineOptions` 声明组件名
  - Props 带 JSDoc 注释
  - 导入顺序符合规范（type → Vue → 第三方 → 内部）
  - 无 `console.log` 残留
  - 可测试：computed 是纯函数，emit 可 mock

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `.vue` | 逻辑+模板+样式三合一 | Swing Panel + FXML + CSS | 编译时三合一，运行时已分离 |
| `<script setup>` | setup() 的语法糖，自动暴露变量 | Lombok `@Data` + 构造函数 | 编译器宏，改变整个代码组织方式 |
| `defineProps` | 类型即运行时 props 契约 | 构造函数参数 + `@NotNull` | 类型同时服务编译期和运行时 |
| `defineEmits` | 类型安全的事件声明 | `Observer` 接口 | 元组类型声明参数，编译时校验 |
| `defineModel` | v-model 的简化写法 | `PropertyChangeSupport` | Vue 3.4+ 编译器宏，自动处理 update 事件 |
| `defineOptions` | 组件元数据声明 | `@Component` | 在 `<script setup>` 中替代 export default |
| 插槽 Slot | 父组件填充子组件的占位 | 模板方法模式 | 运行时内容分发，非继承 |
| `scoped` | 样式作用域隔离 | 无直接对应 | 编译时添加 hash 属性，实现 CSS 隔离 |
| `lang="tsx"` | SFC 中写 JSX | 在 Java 类中写 Groovy | 同一文件混合两种语法，编译时统一处理 |
| `inheritAttrs` | 控制 attrs 透传 | 无 | 防止未声明的 attribute 自动落到根元素 |

---

## 进阶思考题（选做）

1. **为什么 `<script setup>` 中的变量不需要 `return` 就能在模板中使用？** 
   > 提示：查看 Vue 编译器输出（`vue-template-compiler`），理解编译时如何将顶层变量注入模板作用域。

2. **对比 `defineProps` 和 Java 注解处理器（APT）**
   > `defineProps` 在编译时生成代码，APT 也是。但 Vue 的宏更轻量——为什么？

3. **TSX 在 SFC 中的编译链路**
   > `.vue` → `@vitejs/plugin-vue` 提取 `<script>` → `esbuild` 处理 TSX → Vue 编译器处理模板。这个流程和 Java 的编译流程（`.java` → `javac` → `.class`）有何本质不同？

---

**明日预告**：第13天 — 响应式系统深入 — 从 Proxy 到依赖追踪

> 明天我们将手写一个极简的 `reactive()` 实现，理解 Vue 3 响应式系统的核心原理。这是 Vue 3 的"灵魂"——理解了它，你就理解了为什么 `ref` 需要 `.value`、为什么 `computed` 能缓存、为什么 `watch` 能自动追踪依赖。

---

> 📌 **学习建议**：今天的内容是 Vue 3 开发的最小完整单元——一个 `.vue` 文件。建议你花 20 分钟反复阅读 `src/components/custom/svg-icon.vue` 和 `src/App.vue`，它们分别是"小组件设计"和"根组件设计"的典范。不要急于写复杂功能，先把一个单组件写规范、写精致。
