# 今日前端课程 — 第8天：模板语法与指令 — Vue 的"JSP 标签库"

> **学习目标**
> - **能读**：看懂 `v-for`、`v-if`、`v-show`、`v-model`、`v-bind`、`v-on` 在项目代码中的真实用法
> - **能用**：能用 `v-for` + `v-if` + 修饰符实现一个动态表格列控制面板
> - **规范**：遵循 `v-for` 必须带 `:key`、条件渲染优先用 `v-show` 等性能规范
> - **精进**：理解 `v-if` vs `v-show` 的 DOM 开销差异，掌握 `v-for` + `v-if` 同级的性能陷阱
>
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + AntDV + UnoCSS

---

## 理论学习

### 核心知识点

#### 1. `v-if` vs `v-show` — 条件渲染的两种哲学

| 指令 | 工作原理 | 适用场景 | Java 类比 |
|------|---------|---------|-----------|
| `v-if` | **条件为假时销毁组件**（DOM 移除，事件/监听器清理） | 切换不频繁、条件为假时真的不需要渲染 | JSP `<c:if>` — 条件成立才输出 HTML |
| `v-show` | **始终渲染，仅通过 CSS `display` 切换** | 频繁切换 tab/面板 | Java Swing `setVisible(false)` — 组件还在，只是隐藏 |

> **关键决策**：如果切换频率高，用 `v-show`（避免 DOM 重建开销）；如果条件很少满足，用 `v-if`（减少初始渲染负担）。

#### 2. `v-for` + `:key` — 列表渲染的身份识别

```vue
<ACol v-for="item in cardData" :key="item.key" :span="24" :md="12" :lg="6">
```

`:key` 不是可选的，它是 Vue **Diff 算法的身份标识**。没有 `:key`，Vue 会复用 DOM 元素，导致状态错乱。

**Java 类比**：`key` ≈ 数据库主键（Primary Key）。没有主键，ORM 无法区分两条记录，更新时会出错。

> **前端独有**：React 和 Vue 的 `key` 设计源于虚拟 DOM 的 Diff 策略。Java 的 JSP `<c:forEach>` 没有 `key` 概念，因为它不维护组件状态——每次请求都重新渲染完整页面。

#### 3. `v-for` + `v-if` 同级时的性能陷阱

Vue 3 的规范：**不要**在同一元素上同时使用 `v-if` 和 `v-for`。`v-if` 优先级高于 `v-for`，会导致每次渲染都遍历完整列表再过滤。

**正确做法**：
```vue
<!-- ❌ 错误：v-if 和 v-for 同级 -->
<div v-for="item in list" v-if="item.visible">...</div>

<!-- ✅ 正确：先 computed 过滤，再 v-for 渲染 -->
<div v-for="item in visibleList" :key="item.id">...</div>
```

#### 4. `v-bind` 缩写与动态属性

```vue
<!-- 完整写法 -->
<SvgIcon v-bind:icon="item.icon" class="text-32px"/>

<!-- 缩写 -->
<SvgIcon :icon="item.icon" class="text-32px"/>

<!-- 动态属性名 -->
<div :[dynamicAttr]="value"></div>

<!-- 对象绑定（批量属性） -->
<div v-bind="objectProps"></div>
```

#### 5. `v-on` 事件处理与修饰符

```vue
<!-- 完整写法 -->
<AButton v-on:click="handleSubmit">提交</AButton>

<!-- 缩写 -->
<AButton @click="handleSubmit">提交</AButton>

<!-- 修饰符 -->
<AButton @click.prevent="handleSubmit">阻止默认行为</AButton>
<AInput @keydown.enter="handleSearch" />  <!-- 回车触发 -->
```

常用修饰符速查：

| 修饰符 | 作用 | 使用场景 |
|--------|------|---------|
| `.stop` | 阻止事件冒泡 | 嵌套点击区域 |
| `.prevent` | 阻止默认行为 | 表单提交、链接跳转 |
| `.once` | 只触发一次 | 初始化加载 |
| `.enter` | 回车键触发 | 搜索框 |
| `.esc` | ESC 键触发 | 关闭弹窗 |

#### 6. `v-model` 双向绑定 — 不是魔法，是语法糖

```vue
<!-- 完整展开 -->
<AInput v-model:value="model.roleName" />

<!-- 等价于 -->
<AInput 
  :value="model.roleName" 
  @update:value="model.roleName = $event" 
/>
```

> **Java 类比**：`v-model` ≈ Java Bean 的 `PropertyChangeSupport` + `addPropertyChangeListener` 的自动版。你写 `input.value = "xxx"`，框架自动通知所有监听器更新。

---

### Java 思维类比

> Vue 模板指令 ≈ JSP 标签库 + JSTL
> - `v-if` → `<c:if>`
> - `v-for` → `<c:forEach>`
> - `v-model` → Spring MVC `@ModelAttribute` 双向绑定
> - `:key` → 数据库主键（用于 Diff 时识别"这条数据还是不是原来的那条"）
> - `v-on:click` → Java Swing `ActionListener`

### 超越类比 — 前端独有的设计哲学

> 1. **响应式 DOM 与完整页面刷新的差异**：JSP 每次请求都重新渲染整个页面，Vue 只更新变化的部分。`key` 的存在是为了让 Vue 知道"列表中的第3条数据还是原来那条"，而不是每次重绘。
>
> 2. **虚拟 DOM 的存在意义**：Java 的 Swing/JavaFX 是命令式 UI（你直接操作组件），Vue 是声明式 UI（你描述"我想要什么"，框架负责"怎么做"）。`v-if` 和 `v-show` 的选择背后是"重建 vs 隐藏"的性能权衡。
>
> 3. **事件委托与修饰符**：前端事件系统天然有冒泡/捕获机制，Vue 的修饰符是对这种复杂性的封装。Java GUI 没有冒泡，所以没有 `.stop` 概念。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

- `src/views/home/modules/card-data.vue` — `v-for` + `:key` 的标准用法
- `src/views/manage/menu/modules/menu-operate-modal.vue` — `v-if` 条件渲染 + `v-for` 嵌套
- `src/views/function/toggle-auth/index.vue` — `v-for` 列表 + `v-if` 权限控制
- `src/views/manage/role/modules/role-operate-drawer.vue` — `v-for` 渲染选项 + `v-if` 控制编辑态

### 阅读指引

1. **先看 `card-data.vue`**：
   - 注意 `v-for="item in cardData" :key="item.key"` — `:key` 使用业务主键 `key`，不是索引
   - 注意 `:span="24" :md="12" :lg="6"` — Ant Design Vue 的响应式栅格，与 `v-for` 结合实现响应式卡片布局

2. **再看 `menu-operate-modal.vue`**：
   - 注意 `v-if="showLayout"` 和 `v-if="showPage"` — 条件控制表单字段的显示，减少用户认知负担
   - 注意 `v-for` 嵌套在 `<ARadioGroup>` 内部，`:key="item.value"` 使用业务值
   - 注意 `v-if="model.iconType === '1'"` 和 `v-if="model.iconType === '2'"` — 互斥条件控制图标输入方式

3. **再看 `toggle-auth/index.vue`**：
   - 注意 `v-for="role in authStore.userInfo.roles" :key="role"` — 这里 `role` 是字符串，直接作为 key（字符串是稳定的）
   - 注意 `v-for="account in accounts"` 与 `v-if="hasAuth('B_CODE1')"` — **分开层级**，不在同一元素上
   - 注意事件绑定：`@click="handleToggleAccount(account)"` — 直接传参，Java 的 `ActionListener` 做不到

4. **最后 `role-operate-drawer.vue`**：
   - 注意 `v-if="isEdit"` 控制权限按钮的显示 — 新增角色时不显示权限分配
   - 注意 `v-for="item in enableStatusOptions"` — 用常量数组渲染 Radio 选项

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件kebab-case、函数camelCase、组件PascalCase | ✅ `card-data.vue` ✅ `toggle-auth/index.vue` |
| 类型完整性 | 零any，所有参数/返回值有类型 | ✅ `card-data.vue` 有 `interface CardData`；`toggle-auth` 有 `interface Account` |
| `:key` 规范 | `v-for` 必须带 `:key`，且不能用索引 | ✅ `card-data.vue` 用 `item.key`；`menu-operate-modal` 用 `item.value`；`toggle-auth` 用 `role` / `account.key` |
| `v-if` 层级 | 不与 `v-for` 同级 | ✅ `toggle-auth` 中 `v-if` 和 `v-for` 在不同层级；`menu-operate-modal` 中 `v-if` 在 `<AFormItem>` 或 `<ACol>` 上，`v-for` 在 `<ARadio>` 或 `<div>` 上 |
| 导入顺序 | type导入 → 第三方库 → 内部模块 → 相对路径 | ✅ `card-data.vue`：`import type` 无，但 `import {computed}` 在 `@vueuse/core` 之前，locales 在最后 |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ 所有可见文字都有 `$t()` 包裹 |
| 事件绑定 | 参数传递清晰 | ✅ `@click="handleToggleAccount(account)"` 直接传参 |

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**目标**：实现一个"动态表格列控制面板"，包含：
1. 一个表格，列通过数组配置动态渲染
2. 列配置面板：可勾选显示/隐藏列，可调整列顺序（拖拽）
3. 列的显示/隐藏用 `v-if` 还是 `v-show`？用 `v-show`（频繁切换）
4. 列的渲染用 `v-for` + `:key`，key 用列标识符

**拆解小任务**：
- 小任务1：定义列配置数据结构（TS 接口）
- 小任务2：用 `v-for` 渲染表头
- 小任务3：用 `v-show` 控制列的显示/隐藏
- 小任务4：用 `v-for` 渲染列控制面板（Checkbox 列表）
- 小任务5：整合为一个可复用的 Hook/组件

### 第二步：小任务开发

#### 小任务1：定义列配置数据结构

```typescript
// src/typings/table.d.ts 或组件内定义
interface TableColumn<T = any> {
  /** 列唯一标识 */
  key: string;
  /** 列标题 */
  title: string;
  /** 是否显示 */
  visible: boolean;
  /** 数据字段名 */
  dataIndex?: keyof T;
  /** 列宽 */
  width?: number | string;
  /** 自定义渲染 */
  render?: (row: T) => VNode;
}
```

#### 小任务2：用 `v-for` 渲染表头

```vue
<template>
  <ATable :data-source="dataSource">
    <template v-for="col in visibleColumns" :key="col.key">
      <AColumn v-if="col.visible" :title="col.title" :data-index="col.dataIndex" :width="col.width">
        <template v-if="col.render" #default="{ record }">
          <component :is="col.render(record)" />
        </template>
      </AColumn>
    </template>
  </ATable>
</template>
```

> ⚠️ **注意**：这里用 `v-if` 而不是 `v-show`，因为 Ant Design Vue 的 `<AColumn>` 不支持 `v-show`（它是配置式组件，不是 DOM 元素）。这是框架差异，需要适配。

#### 小任务3：用 `v-show` 控制列显示（如果不用 ATable）

如果是自己手写 `<table>`：
```vue
<table>
  <thead>
    <tr>
      <th v-for="col in columns" :key="col.key" v-show="col.visible">
        {{ col.title }}
      </th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="row in dataSource" :key="row.id">
      <td v-for="col in columns" :key="col.key" v-show="col.visible">
        {{ row[col.dataIndex] }}
      </td>
    </tr>
  </tbody>
</table>
```

#### 小任务4：列控制面板

```vue
<template>
  <ADrawer title="列设置" :open="visible" @close="visible = false">
    <div v-for="col in columns" :key="col.key" class="flex-y-center gap-8px py-8px">
      <ACheckbox v-model:checked="col.visible">
        {{ col.title }}
      </ACheckbox>
    </div>
  </ADrawer>
</template>
```

> 注意：这里修改的是 `columns` 数组中元素的 `visible` 属性，因为 `columns` 是 `reactive` 对象数组，修改属性会自动触发视图更新。如果 `columns` 是 `ref`，需要 `columns.value[index].visible = ...`。

#### 小任务5：封装为可复用的 Hook

```typescript
// src/hooks/business/table-column.ts
import { ref, computed } from 'vue';

export interface ColumnConfig {
  key: string;
  title: string;
  visible: boolean;
}

export function useTableColumn(columns: ColumnConfig[]) {
  const columnList = ref(columns);

  const visibleColumns = computed(() => columnList.value.filter(col => col.visible));

  function toggleColumn(key: string) {
    const col = columnList.value.find(c => c.key === key);
    if (col) {
      col.visible = !col.visible;
    }
  }

  function resetColumns() {
    columnList.value.forEach(col => {
      col.visible = true;
    });
  }

  return {
    columnList,
    visibleColumns,
    toggleColumn,
    resetColumns
  };
}
```

### 第三步：整合与测试

**整合思路**：
1. 父组件定义 `columns` 配置，传入 `useTableColumn`
2. 表格用 `visibleColumns` 渲染（`v-for` + `v-if`）
3. 控制面板用 `columnList` 渲染（`v-for` + `v-model` 双向绑定）
4. 测试：切换列显示，观察表格列是否正确增减

**调试技巧**：
- Vue DevTools → Components 面板，观察 `columns` 数组的变化
- 如果 `v-show` 不生效，检查目标元素是否是 DOM 元素（组件可能不支持 `v-show`）
- 如果 `key` 报错（Duplicate keys），检查 `:key` 是否有重复值

### 验收标准

- [ ] **能用**：表格列可动态显示/隐藏，控制面板可开关列
- [ ] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过
- [ ] **精进**：
  - 所有 `v-for` 都有 `:key`
  - `key` 使用业务标识（不是数组索引）
  - `v-if` 和 `v-for` 不在同一元素上
  - 频繁切换用 `v-show`，条件渲染用 `v-if`
  - 事件绑定有参数传递时使用箭头函数或直接调用

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `v-if` | 条件为假时**销毁**组件 | JSP `<c:if>` | 虚拟 DOM 的 Diff 需要重建组件 |
| `v-show` | 条件为假时**隐藏**组件（CSS） | Swing `setVisible(false)` | 纯 CSS 切换，无 DOM 重建 |
| `v-for` + `:key` | 列表渲染必须带身份标识 | 数据库主键 | 虚拟 DOM Diff 算法需要 `key` 来识别元素 |
| `v-model` | 双向绑定语法糖 | Bean 的 PropertyChangeSupport | 是 `:value` + `@update:value` 的缩写 |
| `v-on` + `@` | 事件监听与修饰符 | ActionListener + 事件拦截 | `.stop`、`.prevent` 是前端事件冒泡的专属封装 |
| `v-for` + `v-if` 陷阱 | 不要同级使用 | JSP 中 `<c:forEach>` 嵌套 `<c:if>` 无此问题 | Vue 的渲染优先级导致性能问题 |

---

**明日预告**：第9天 — 组件基础：父子通信与插槽（Props / Emits / Slots / Provide-Inject）

> 我们将从一个 Java 架构师的视角理解：Vue 的 `props` 为什么像构造参数注入？`$emit` 为什么像观察者模式？插槽为什么像模板方法模式？Provide/Inject 为什么像 Spring 的跨层级 `@Autowired`？
