# 今日前端课程 — 第15天：组件设计模式 — 高阶组件、渲染函数、动态组件

> **学习目标**
> - **能读**：看懂 carlos-ui 中动态组件、渲染函数、异步组件、可复用模板的设计意图
> - **能用**：在 `<template>` 和 `<script setup>` 中正确使用 `<component :is>`、`defineAsyncComponent`、`createReusableTemplate`
> - **规范**：组件命名遵循 PascalCase / kebab-case，导入顺序正确，类型完整
> - **精进**：理解"何时用动态组件 vs 条件渲染 v-if"、"何时用渲染函数 vs 模板"、"异步组件的加载状态管理"
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + AntDV + Pinia + UnoCSS

---

## 理论学习

### 核心知识点

#### 1. 动态组件 `<component :is>`

Vue 提供内置组件 `<component>`，通过 `:is` 属性决定实际渲染哪个组件。

```vue
<template>
  <!-- 方式1：直接传组件对象 -->
  <component :is="ActiveComponent" />

  <!-- 方式2：传字符串（已注册的全局组件名） -->
  <component :is="'MyComponent'" />

  <!-- 方式3：结合 KeepAlive 缓存状态 -->
  <KeepAlive>
    <component :is="ActiveComponent" />
  </KeepAlive>

  <!-- 方式4：结合 Transition 做过渡动画 -->
  <Transition name="fade" mode="out-in">
    <component :is="ActiveComponent" />
  </Transition>
```

**关键规则**：`:is` 的值可以是：
- 组件对象（import 导入的变量）
- 字符串组件名（需全局注册）
- HTML 标签名字符串（如 `'div'`）

#### 2. 异步组件 `defineAsyncComponent`

```typescript
import { defineAsyncComponent } from 'vue';

// 基础用法
const AsyncComp = defineAsyncComponent(() => import('./heavy-component.vue'));

// 带加载状态
const AsyncComp = defineAsyncComponent({
  loader: () => import('./heavy-component.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorFallback,
  delay: 200,        // 延迟显示 loading 组件
  timeout: 3000      // 超时时间
});
```

**适用场景**：大型组件、不常用页面、路由懒加载。

#### 3. 渲染函数 `h()` 与 `defineComponent`

当模板表达能力不够时，用渲染函数（JS/TSX）编写组件：

```typescript
import { h, defineComponent, createTextVNode } from 'vue';

// 简单渲染函数
const HelloWorld = defineComponent({
  props: { name: String },
  setup(props) {
    return () => h('div', { class: 'hello' }, `Hello, ${props.name}`);
  }
});

// 渲染空节点（App.useApp 注册全局 message/modal/notification）
const ContextHolder = defineComponent({
  setup() {
    const { message } = App.useApp();
    window.$message = message;
    return () => createTextVNode(); // 什么都不渲染
  }
});
```

#### 4. 高阶组件（HOC）与 `createReusableTemplate`

高阶组件 = 接收组件作为参数 / 返回新组件的函数。

VueUse 提供的 `createReusableTemplate` 是一种**轻量级高阶组件模式**：

```typescript
import { createReusableTemplate } from '@vueuse/core';

interface Props { title: string }
const [DefineTemplate, ReuseTemplate] = createReusableTemplate<Props>();
```

在模板中：
```vue
<template>
  <!-- 定义模板 -->
  <DefineTemplate v-slot="{ title }">
    <div class="card">
      <h3>{{ title }}</h3>
      <slot />  <!-- 默认插槽透传 -->
    </div>
  </DefineTemplate>

  <!-- 复用模板 -->
  <ReuseTemplate v-for="i in 3" :key="i" :title="`Card ${i}`">
    <p>Content {{ i }}</p>
  </ReuseTemplate>
</template>
```

---

### Java 思维类比

| 前端概念 | Java 类比 | 说明 |
|---------|----------|------|
| `<component :is>` | `Class.forName(className).newInstance()` | 运行时动态决定实例化哪个类 |
| `defineAsyncComponent` | 懒加载 Bean / 代理对象 | 需要时才加载，带加载超时和回退 |
| `h()` 渲染函数 | Swing 的 `paintComponent(Graphics g)` | 用代码描述 UI，而非声明式 XML |
| `defineComponent` | 手动写 `JPanel` 子类 | 完整控制组件生命周期和渲染 |
| `createReusableTemplate` | 模板方法模式 / JSP `<jsp:include>` | 定义可复用的片段，多处引用 |
| `KeepAlive` | 对象池 / 缓存池 | 切换时不销毁，保留状态 |

### 超越类比 — 前端独有的设计哲学

> **为什么 Vue 用 `<component :is>` 而不是 Java 的反射 + 工厂？**
>
> 1. **声明式优于命令式**：`<component :is="X" />` 是声明式——你告诉 Vue "渲染这个组件"，Vue 帮你处理挂载、更新、卸载、diff。Java 的 `Class.forName()` 是命令式——你手动控制实例化生命周期。
> 2. **组合优于继承**：动态组件不需要被切换的组件继承同一个基类，任何独立组件都可以被动态挂载。Java 的工厂模式通常需要统一接口或抽象类。
> 3. **响应式自动追踪**：当 `:is` 绑定的响应式引用变化时，Vue 自动切换组件，无需手动订阅/通知。Java 需要手动更新视图或重新渲染。
> 4. **KeepAlive 是前端特有的**：浏览器页面切换频繁（标签页、路由页），KeepAlive 缓存 DOM 状态（滚动位置、表单输入）是桌面/后端开发不需要的。

> **为什么前端用 `createReusableTemplate` 而不是 Java 的继承/模板方法？**
>
> 因为 Vue 模板不是类，不能继承。`createReusableTemplate` 用 Vue 的编译器宏在编译期将模板片段提取为可复用的渲染函数，保持了模板的声明式优势，同时实现了跨组件复用。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

| 文件 | 设计模式 | 核心代码 |
|------|---------|---------|
| `src/layouts/modules/global-menu/index.vue` | 动态组件映射 | `computed` 返回 `Record<LayoutMode, Component>`，`<component :is="activeMenu" />` |
| `src/layouts/modules/global-content/index.vue` | 动态组件 + KeepAlive + Transition | `<RouterView v-slot="{ Component, route }">` + `<component :is="Component" />` |
| `src/components/common/app-provider.vue` | 渲染函数 + `defineComponent` | `defineComponent({ setup() => createTextVNode() })` |
| `src/layouts/modules/global-breadcrumb/index.vue` | 可复用模板 | `createReusableTemplate<BreadcrumbContentProps>` 复用面包屑内容 |
| `src/views/home/modules/card-data.vue` | 可复用模板 + 动态插槽 | `<component :is="$slots.default" />` 渲染默认插槽 |
| `src/layouts/base-layout/index.vue` | 异步组件 | `defineAsyncComponent(() => import('../modules/global-menu/index.vue'))` |

### 阅读指引

1. **先看 `global-menu/index.vue`**
   - 5 种菜单布局（vertical / vertical-mix / horizontal / horizontal-mix / reversed-horizontal-mix）
   - 用 `computed` 返回一个 `Record<UnionKey.ThemeLayoutMode, Component>` 映射表
   - `<component :is="activeMenu" :key="reRenderVertical" />` — `:key` 用于强制重新渲染

2. **再看 `global-content/index.vue`**
   - `<RouterView v-slot="{ Component, route }">` — RouterView 提供当前路由组件和路由信息
   - 三层嵌套：Transition → KeepAlive → component
   - 为什么用 `mode="out-in"`？新组件进入后旧组件才离开，避免同时出现两个路由页面

3. **再看 `app-provider.vue`**
   - `defineComponent` 不是 `<script setup>` 风格，而是 Options API 的 `setup()` 函数
   - `createTextVNode()` 返回空文本节点 — 这个组件**不渲染任何可见内容**，只做副作用（注册全局 message/modal/notification）
   - 为什么要用 `defineComponent` 而不是普通函数？因为需要 Vue 的组件生命周期和响应式上下文

4. **最后看 `global-breadcrumb/index.vue` 和 `card-data.vue`**
   - `createReusableTemplate` 定义在 `<template>` 中，编译为组件
   - 注意 `v-slot="{ breadcrumb }"` 的解构用法
   - `card-data.vue` 中 `<component :is="$slots.default" />` — 将默认插槽作为组件渲染

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件kebab-case、组件PascalCase、函数camelCase | ✅ `global-menu/index.vue` 文件名正确，`GlobalMenu` 组件名正确 |
| 类型完整性 | 零any，所有参数/返回值有类型 | ✅ `global-menu` 使用 `Component` 类型、`UnionKey.ThemeLayoutMode` 枚举；`global-breadcrumb` 使用 `BreadcrumbContentProps` 接口 |
| 目录规范 | 文件放在正确的目录 | ✅ `layouts/modules/` 放布局子模块，`components/common/` 放通用组件 |
| 导入顺序 | type导入 → 第三方库 → 内部模块 → 相对路径 | ✅ `global-breadcrumb`：`import type` → `@vueuse/core` → `@/store/` → `./` |
| 错误处理 | 所有异步有try/catch或统一拦截 | N/A 本课组件不涉及异步请求 |
| 可测试性 | 纯函数可单测，副作用可mock | ⚠️ `global-menu` 的 `computed` 依赖 Store，测试中需 mock Pinia Store |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ `global-breadcrumb` 中 `breadcrumb.label` 来自路由配置，本身已国际化 |

**评审发现**：
- `global-menu/index.vue` 的 `reRenderVertical` 用 `computed` 返回布尔值，作为 `:key` 强制重新渲染。这是一个**性能优化技巧** — 当移动端从 vertical 模式切换时，强制重新渲染组件树以重置状态。
- `app-provider.vue` 使用 `window.$message = message` 这种全局挂载方式，在现代前端中属于**副作用**。好处是任何地方都能调用 `window.$message.success()`，坏处是 TypeScript 需要补充 `declare global` 类型声明。这是 carlos-ui 的既定架构选择。

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**任务**：实现一个"动态表单渲染器" — 根据 JSON 配置动态渲染不同表单控件。

功能拆解：
1. 定义表单控件类型（Input / Select / Checkbox / DatePicker）
2. 用 `Record` 建立控件类型 → 组件的映射
3. 用 `<component :is>` 根据配置动态渲染
4. 用 `createReusableTemplate` 提取统一的表单标签/错误提示模板
5. 用 `defineAsyncComponent` 异步加载复杂的富文本编辑器控件

### 第二步：小任务开发

#### 小任务1：定义控件映射

```typescript
// src/views/practice/day15/form-config.ts
import type { Component } from 'vue';
import { Input, Select, Checkbox, DatePicker } from 'ant-design-vue';

export type FormControlType = 'input' | 'select' | 'checkbox' | 'date' | 'rich-text';

// 同步控件映射
export const syncControlMap: Record<string, Component> = {
  input: Input,
  select: Select,
  checkbox: Checkbox,
  date: DatePicker
};
```

**技术要点**：
- `type` 用联合类型约束可选值
- `Record<string, Component>` 建立映射 — 类似 Java 的 `Map<String, Class<?>>`

#### 小任务2：动态渲染表单控件

```vue
<!-- src/views/practice/day15/dynamic-form.vue -->
<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import type { Component } from 'vue';
import { syncControlMap } from './form-config';

// 异步加载重组件
const RichTextEditor = defineAsyncComponent(
  () => import('./rich-text-editor.vue')
);

const fullControlMap: Record<string, Component> = {
  ...syncControlMap,
  'rich-text': RichTextEditor
};

interface FormField {
  key: string;
  label: string;
  type: string;
  props?: Record<string, unknown>;
}

interface Props {
  fields: FormField[];
  modelValue: Record<string, unknown>;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>];
}>();

function updateField(key: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}
</script>

<template>
  <AForm>
    <AFormItem
      v-for="field in fields"
      :key="field.key"
      :label="field.label"
    >
      <component
        :is="fullControlMap[field.type]"
        :value="modelValue[field.key]"
        v-bind="field.props"
        @update:value="(val: unknown) => updateField(field.key, val)"
      />
    </AFormItem>
  </AForm>
</template>
```

**技术要点**：
- `v-bind="field.props"` 将 JSON 配置的属性批量绑定到组件
- `@update:value` 是 Ant Design Vue 的默认更新事件
- 注意 `val: unknown` 类型标注 — 因为不同控件返回的类型不同

#### 小任务3：用 `createReusableTemplate` 提取统一标签模板

```vue
<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core';

interface LabelProps {
  label: string;
  required?: boolean;
}

const [DefineLabel, ReuseLabel] = createReusableTemplate<LabelProps>();

const fields = [
  { key: 'name', label: '用户名', type: 'input', required: true },
  { key: 'role', label: '角色', type: 'select', required: false },
  { key: 'active', label: '启用', type: 'checkbox', required: false }
];
</script>

<template>
  <!-- 定义统一标签模板 -->
  <DefineLabel v-slot="{ label, required }">
    <span class="flex-y-center gap-4px">
      <span v-if="required" class="text-red-500">*</span>
      <span>{{ label }}</span>
    </span>
  </DefineLabel>

  <AForm>
    <AFormItem v-for="field in fields" :key="field.key">
      <template #label>
        <ReuseLabel :label="field.label" :required="field.required" />
      </template>
      <component :is="fullControlMap[field.type]" />
    </AFormItem>
  </AForm>
</template>
```

### 第三步：整合与调试

**整合思路**：
1. `form-config.ts` 负责"控件类型 → 组件"的映射关系
2. `dynamic-form.vue` 负责遍历字段配置、动态渲染、数据双向绑定
3. 统一标签模板通过 `createReusableTemplate` 在表单内部复用

**调试清单**：
- 如果 `field.type` 不在 `fullControlMap` 中，会渲染什么？ → Vue 会渲染为注释节点（ nothing ），需要加 fallback
- 如何在 TypeScript 中保证 `field.type` 的值合法？ → 用 `satisfies` 或严格联合类型
- 异步组件加载失败时如何处理？ → `defineAsyncComponent` 的 `errorComponent` 选项

**改进建议**（从规范到精进）：
```typescript
// 改进：添加 fallback 和类型守卫
const fallbackControl = markRaw(Input); // 未知类型默认用 Input

const activeComponent = computed(() => {
  return fullControlMap[field.type] ?? fallbackControl;
});

// 改进：使用 markRaw 避免 Vue 对组件对象做响应式包装
// （性能优化：组件对象不需要是响应式的）
```

---

### 验收标准

- [ ] **能用**：动态表单根据 JSON 配置正确渲染不同控件，数据绑定正常
- [ ] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过
- [ ] **精进**：
  - [ ] 对照规范评审清单自检通过
  - [ ] 对未知控件类型有 fallback 处理
  - [ ] 异步组件有 loading / error 状态
  - [ ] 使用 `markRaw` 避免不必要的响应式包装

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `<component :is>` | 运行时动态决定渲染哪个组件 | `Class.forName().newInstance()` | 声明式 + 响应式自动切换，无需手动订阅 |
| `defineAsyncComponent` | 异步加载组件，带 loading/error | 懒加载 Bean / 代理对象 | 支持加载超时、错误回退、SSR 兼容 |
| `h()` | 用代码创建虚拟 DOM 节点 | `paintComponent(Graphics)` | 与响应式系统深度集成，diff 算法自动更新 |
| `defineComponent` | 手动定义组件（完整控制） | 手动写 `JPanel` 子类 | `setup()` 返回渲染函数，替代模板 |
| `createReusableTemplate` | 在模板中定义可复用的片段 | JSP `<jsp:include>` / 模板方法模式 | 编译期提取，保持声明式优势，不是运行时组件 |
| `KeepAlive` | 缓存组件状态，切换时不销毁 | 对象池 | 浏览器特有的 DOM 状态保留（滚动、表单值） |
| `markRaw` | 标记对象不做响应式代理 | `transient` 字段 | Vue 特有：避免对组件对象等无需响应式的数据做 Proxy 包装 |

---

**明日预告**：第16天 — 表单处理与验证 — 与 Ant Design Vue 结合

> 明天将深入 Ant Design Vue 的 `Form` + `Rules` 体系，学习如何用声明式的方式实现复杂表单校验，并结合今天的动态组件实现一个完整的动态表单验证器。

---

## 课后思考题

1. 为什么 `global-menu/index.vue` 用 `computed` 而不是普通函数返回 `activeMenu`？如果 `themeStore.layout.mode` 变化，会发生什么？
2. `app-provider.vue` 为什么用 `createTextVNode()` 而不是 `h('div')`？如果用 `h('div')` 会怎样？
3. `card-data.vue` 中的 `<component :is="$slots.default" />` 是什么原理？`$slots.default` 是一个函数还是组件？
4. 动态组件和 `v-if` 条件渲染有什么本质区别？什么场景下应该选哪个？

---

> **今日寄语**：从 Java 的反射和工厂模式走过来，你可能会觉得 Vue 的 `<component :is>` 太"魔法"。但请记住：**前端 UI 是声明式的、响应式的、频繁切换的**。Java 的命令式思维（"我手动创建实例"）在这里会让代码变得复杂。学会信任 Vue 的声明式系统，让框架帮你处理挂载、卸载、缓存、diff — 你只需要描述"当状态是 X 时，渲染组件 Y"。
