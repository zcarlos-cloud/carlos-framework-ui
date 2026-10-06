# 今日前端课程 — 第20天：TypeScript 在 Vue 中的实践 — Props 类型、Emit 类型、泛型组件

> **学习目标**
> - 能读：看懂 carlos-framework-ui 中任意 Vue 组件的 TypeScript 类型定义，包括 Props、Emit、泛型
> - 能用：为自己的组件编写完整的 TS 类型定义，零 `any`、零 `// @ts-ignore`
> - 规范：遵循 `import type` 分离、接口命名 PascalCase、Props 写 JSDoc 注释、泛型参数约束合理
> - 精进：理解 Vue 编译器如何将 `.vue` 文件中的类型信息转化为运行时检查与 IDE 提示，能设计可复用的泛型组件（如 `<DataTable<T>`）
    > ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + AntDV + Pinia + UnoCSS

---

## 理论学习

### 核心知识点

#### 1. Props 的类型定义：从 Java 构造参数到 Vue 的 `defineProps`

Java 开发者在定义类的构造参数时，会写参数类型、注解、默认值。Vue 3 + TS 使用 `defineProps` + `interface` 来声明 Props，语义几乎完全对应：

| Java 构造器                                   | Vue 3 Props                                         |
|--------------------------------------------|-----------------------------------------------------|
| `public UserService(String name, int age)` | `defineProps<{ name: string; age: number }>()`      |
| `@NotNull String name`                     | 必填属性：不加 `?`                                         |
| `@Nullable String email`                   | 可选属性：`email?: string`                               |
| `int age = 18`                             | 默认值：`withDefaults(defineProps<...>(), { age: 18 })` |
| Javadoc 注释                                 | JSDoc：`/** 用户姓名 */ name: string`                    |

**carlos-framework-ui 真实代码示例**（`src/components/custom/count-to.vue`）—— 一个完整的 Props 定义：

```vue

<script setup lang="ts">
  interface Props {
    /** 起始值 */
    startValue?: number;
    /** 结束值 */
    endValue?: number;
    /** 动画持续时间（毫秒） */
    duration?: number;
    /** 是否自动播放 */
    autoplay?: boolean;
    /** 小数位数 */
    decimals?: number;
    /** 前缀字符串 */
    prefix?: string;
    /** 后缀字符串 */
    suffix?: string;
    /** 千分位分隔符 */
    separator?: string;
    /** 小数点符号 */
    decimal?: string;
    /** 是否使用缓动动画 */
    useEasing?: boolean;
    /** 缓动函数类型 */
    transition?: keyof typeof TransitionPresets;
  }

  const props = withDefaults(defineProps<Props>(), {
    startValue: 0,
    endValue: 2021,
    duration: 1500,
    autoplay: true,
    decimals: 0,
    prefix: '',
    suffix: '',
    separator: ',',
    decimal: '.',
    useEasing: true,
    transition: 'linear'
  });
</script>
```

> **为什么这样写更好？**
> 1. `interface Props` 独立声明，方便复用和扩展
> 2. `withDefaults` 集中管理默认值，比运行时 `props.xxx || default` 更安全
> 3. JSDoc 注释让组件在 IDE 中悬停时显示文档提示，类似 Java 的 `@param` 悬停提示
> 4. `keyof typeof TransitionPresets` 是 TS 类型操作，确保 `transition` 只能传合法的缓动函数名——编译期就能拦掉拼写错误

---

#### 2. Emit 的类型定义：从 Java 观察者模式到 `defineEmits`

Java 中通知观察者通常用 `notifyObservers(Event e)` 或回调接口。Vue 3 的 `defineEmits` 使用函数签名风格定义事件类型：

| Java 观察者模式                                                         | Vue 3 Emit                                         |
|--------------------------------------------------------------------|----------------------------------------------------|
| `interface OnSubmitListener { void onSubmit(UserFormData data); }` | `defineEmits<{ submit: [data: UserFormData]; }>()` |
| `void notify();`                                                   | `defineEmits<{ submitted: [] }>()`                 |
| 回调无参数                                                              | `[]` 表示空元组                                         |

**carlos-framework-ui 真实代码示例**（`src/views/manage/user/modules/user-operate-drawer.vue`）—— Emit 类型定义：

```vue

<script setup lang="ts">
  interface Props {
    /** 操作类型：add / edit */
    operateType: AntDesign.TableOperateType;
    /** 编辑行数据 */
    rowData?: Api.SystemManage.User | null;
  }

  const props = defineProps<Props>();

  interface Emits {
    (e: 'submitted'): void;
  }

  const emit = defineEmits<Emits>();

  async function handleSubmit() {
    await validate();
    window.$message?.success($t('common.updateSuccess'));
    closeDrawer();
    emit('submitted'); // 触发事件，父组件监听 @submitted
  }
</script>
```

> **为什么这样写更好？**
> 1. `interface Emits` 定义了事件签名，父组件写 `<UserOperateDrawer @submitted="handleSubmitted" />` 时，IDE 能自动补全并检查回调参数
> 2. 如果事件需要参数，写成 `submitted: [data: UserFormData]`，类型信息传递完整，不会出现 `any` 逃逸
> 3. 与 Java 的接口回调对比：Vue 的 Emit 是"声明式"的，不需要定义额外接口文件，类型直接写在组件里，类似 Java 的 `Consumer<T>` 内联写法

---

#### 3. 泛型组件：让组件像 Java 泛型类一样复用

Java 中 `List<T>` 可以装任何类型。Vue 3.3+ 支持泛型组件（Generic Components），通过 `<script setup lang="ts" generic="T">` 声明：

**carlos-framework-ui 真实代码示例**（`src/components/advanced/table-column-setting.vue`）—— 泛型组件：

```vue

<script setup lang="ts" generic="T extends Record<string, unknown>, K = never">
  import {VueDraggable} from 'vue-draggable-plus';
  import {$t} from '@/locales';

  defineOptions({
    name: 'TableColumnSetting'
  });

  const columns = defineModel<AntDesign.TableColumnCheck[]>('columns', {
    required: true
  });
</script>
```

虽然这个组件的 `generic` 参数 `T` 和 `K` 在当前模板中未显式使用（因为 `columns` 的类型是 `AntDesign.TableColumnCheck[]`，与 `T` 无关），但这个声明展示了**泛型组件的语法结构**。更典型的泛型表格组件可以这样设计：

```vue

<script setup lang="ts" generic="T extends Record<string, any>">
  interface Props {
    /** 表格数据 */
    data: T[];
    /** 列定义 */
    columns: { key: keyof T; title: string }[];
  }

  const props = defineProps<Props>();

  interface Emits {
    (e: 'rowClick', row: T): void;
  }

  const emit = defineEmits<Emits>();
</script>
```

> **Java 类比**：`class DataTable<T extends BaseEntity>` — 类型参数约束确保 `T` 至少是一个对象，且 `keyof T` 可以作为列名使用。

> **前端独有的设计哲学**：
> Vue 泛型组件在编译时由 `vue-tsc` 处理，将类型信息注入到 `.vue` 文件的虚拟声明文件（`.vue.d.ts`）中。这意味着：
> - 使用时 `<DataTable :data="userList" />`，IDE 会自动推断 `T = User`
> - 无需像 Java 那样显式写 `<DataTable<User> :data="userList" />`（当然也可以写，用于复杂场景）
> - 类型推断来自 `props` 的实际传入值，这是前端类型系统与 Java 泛型最大的差异：**Vue 泛型组件在调用时通常能自动推断类型参数**

---

### 4. `defineModel` — Vue 3.4 的语法糖，替代 `v-model` + `emit('update:xxx')`

**carlos-framework-ui 代码示例**（`user-operate-drawer.vue`）：

```vue

<script setup lang="ts">
  const visible = defineModel<boolean>('visible', {
    default: false
  });

  function closeDrawer() {
    visible.value = false; // 自动触发 update:visible
  }
</script>
```

> **Java 类比**：`defineModel` 类似于 Java 的 `PropertyChangeSupport` + `BoundProperty` 的简化版。`visible` 是一个双向绑定的属性，修改时自动通知父组件。
>
> 传统写法需要在父组件写 `:visible="visible" @update:visible="visible = $event"`，`defineModel` 一行搞定，等价于 Java 中 `@Bindable` 注解 + 自动生成 setter 通知。

---

### 5. `import type` 的分离与 Tree Shaking

**《前端开发规范》要求**：
> 导入顺序：1. `import type` 类型导入 → 2. 第三方库 → 3. 内部模块 → 4. 相对路径

```vue

<script setup lang="ts">
  // 1. import type — 只在编译时使用，不会生成运行时代码（类似 Java 的泛型擦除）
  import type {WatermarkProps} from 'ant-design-vue';
  import type {Api} from '@/typings/api';

  // 2. 第三方库
  import {computed, ref} from 'vue';
  import {ConfigProvider} from 'ant-design-vue';

  // 3. 内部模块
  import {useAppStore} from '@/store/modules/app';
  import {useThemeStore} from '@/store/modules/theme';

  // 4. 相对路径（同目录子模块）
  import {someHelper} from './modules/helper';
</script>
```

> **为什么区分 `import type`？**
> - 类似 Java 的 `import` 在编译时仅用于符号解析，运行时不存在
> - Vite 构建时，`import type` 的导入会被完全移除，减少 bundle 体积
> - 如果混用 `import { type Xxx }` 也可以，但规范要求统一用 `import type { Xxx }` 以提升可读性

---

### Java 思维类比

| Java 概念                 | Vue 3 + TS 对应                                 | 类比说明               |
|-------------------------|-----------------------------------------------|--------------------|
| 类的构造参数                  | `defineProps<Props>()`                        | 父组件通过属性传入，子组件声明类型  |
| 构造器默认值                  | `withDefaults(defineProps<...>(), { ... })`   | 集中声明默认值，比运行时 `     ||` 更安全 |
| 回调接口 / 观察者              | `defineEmits<Emits>()`                        | 子组件通知父组件，类型安全的事件签名 |
| 泛型类 `<T>`               | `<script setup generic="T">`                  | 组件可复用于多种数据类型       |
| 泛型约束 `<T extends Base>` | `generic="T extends Record<string, unknown>"` | 类型参数必须有特定结构        |
| Javadoc `@param`        | JSDoc `/** 描述 */`                             | IDE 悬停提示，文档生成      |
| 类型擦除（编译后无泛型）            | `import type` 移除                              | 类型只在编译时存在，不进入运行时   |
| 接口继承 `extends`          | `interface Props extends BaseProps`           | 类型复用与扩展            |
| `Optional<T>`           | `prop?: T` 或 `T                               | null`              | 可选属性 |

### 超越类比 — 前端独有的设计哲学

> 1. **编译期鸭子类型 vs 运行时类检查**：Java 的泛型在编译时擦除，运行时 `List<String>` 和 `List<Integer>` 是同一个类。Vue 的泛型组件在 `vue-tsc` 编译时保留类型信息，生成 `.vue.d.ts` 声明文件，IDE 在使用组件时能推断 `T` 的具体类型——这是 Java 的编译期类型检查 + 前端 IDE 的实时推断的结合。
>
> 2. **Props 的可变性**：Java 的构造参数传入后不可变（除非赋值给字段），Vue 的 Props 是"响应式"的——父组件修改传入值，子组件会自动更新。这是 Vue 响应式系统的特性，不是 TS 类型系统的特性。TS 只管类型，`reactive` / `Proxy` 管运行时变化。
>
> 3. **Emit 的声明式 vs 命令式**：Java 的观察者模式需要显式 `addObserver` / `removeObserver`，Vue 的 Emit 是声明式的——在模板中写 `@event="handler"` 即可，不需要手动注册/注销。这是 Vue 模板编译器的抽象，与 Java 的回调模式本质不同。
>
> 4. **`defineModel` 的双向绑定**：Java 中不存在"双向绑定"这个概念，通常需要手写 getter/setter + 通知。Vue 的 `defineModel` 是编译器语法糖，将 `v-model` 的展开逻辑自动转换为 `props` + `emit` 的组合。这是前端框架独有的便利，Java 开发者需要适应这种"声明式数据流"思维。

---

## carlos-framework-ui 源码阅读 + 规范评审

### 目标文件

- `src/components/custom/count-to.vue` — Props 定义典范（10+ 个带 JSDoc 的属性，全部有默认值）
- `src/views/manage/user/modules/user-operate-drawer.vue` — Props + Emit + defineModel 的完整示例
- `src/components/advanced/table-column-setting.vue` — 泛型组件语法（`generic="T extends ..."`）
- `src/typings/api.d.ts` / `src/typings/antd.d.ts` — 类型声明文件的组织方式（`declare namespace`）
- `src/typings/common.d.ts` — 通用类型工具（`RecordNullable<T>` 等）

### 阅读指引

1. 先看 `count-to.vue` 的 `interface Props` 定义——理解如何为复杂组件组织 Props 类型
2. 再看 `user-operate-drawer.vue` 的 `interface Emits`——对比 Props 和 Emit 的类型定义风格差异
3. 看 `table-column-setting.vue` 的 `generic` 属性——理解泛型组件在 Vue 中的语法
4. 看 `typings/api.d.ts` 中 `declare namespace Api` —— 理解后端接口类型如何集中管理

### 规范评审清单

| 检查项   | 标准                                        | 该文件是否达标？                                                                                                                |
|-------|-------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| 命名规范  | 文件 kebab-case、接口 PascalCase、组件 PascalCase | ✅ `count-to.vue` 符合；`interface Props` 符合                                                                                |
| 类型完整性 | 零 any，所有参数/返回值有类型                         | ✅ `count-to.vue` 所有 Props 均有类型；`user-operate-drawer.vue` 使用 `Api.SystemManage.User` 等精确类型                               |
| 目录规范  | 文件放在正确的目录                                 | ✅ `custom/` 放通用组件；`advanced/` 放业务组件；`views/manage/user/modules/` 放页面子模块                                                 |
| 导入顺序  | type 导入 → 第三方库 → 内部模块 → 相对路径              | ✅ `user-operate-drawer.vue`：`import {computed, ref, watch}` → `import {useAntdForm}` → `@/service/api` → `@/locales`    |
| 错误处理  | 所有异步有 try/catch 或统一拦截                     | ⚠️ `user-operate-drawer.vue` 的 `handleSubmit` 中 `await validate()` 后没有 `try/catch`，但 `validate` 可能内部抛出。实际项目中已通过表单组件封装处理 |
| 可测试性  | 纯函数可单测，副作用可 mock                          | ⚠️ `count-to.vue` 的 `formatValue` 是纯函数，可独立测试；`useTransition` 副作用需要 mock                                                 |
| 国际化   | 用户可见字符串使用 `$t()`                          | ✅ `user-operate-drawer.vue` 中所有用户可见字符串均使用 `$t()`                                                                        |

> **评审小结**：carlos-framework-ui 的类型定义整体水准很高。 Props 全部使用 `interface` + `withDefaults`，Emit 使用类型化定义，泛型组件使用 `generic` 声明。不足之处在于部分异步操作（如表单提交）的错误处理依赖 UI 框架的封装，而不是显式的 try/catch。这是前端与 Java 的差异：前端常将错误处理委托给框架（如 Ant Design Vue 的表单验证），而 Java 通常在 Service 层显式捕获。

---

## 功能实践 — 分三步

### 第一步：分析和拆解

今天我们要实现一个**类型安全的用户列表卡片组件 `<UserCard>`** 和一个**泛型数据表格 `<DataTable<T>>`**：

1. 为 `<UserCard>` 定义完整的 Props 类型（含 JSDoc）和 Emit 类型
2. 使用 `defineModel` 实现双向绑定（如编辑模式开关）
3. 为 `<DataTable<T>>` 定义泛型组件，支持任意行数据类型和列配置
4. 将类型声明提取到 `typings/` 目录中，遵循 `declare namespace` 规范

### 第二步：小任务开发

#### 小任务 1：创建 `UserCard` 组件，类型完整

```vue
<!-- src/components/common/user-card.vue -->
<script setup lang="ts">
  import {$t} from '@/locales';

  defineOptions({
    name: 'UserCard'
  });

  interface Props {
    /** 用户昵称 */
    nickName: string;
    /** 用户头像 URL */
    avatar?: string | null;
    /** 用户角色列表 */
    roles?: string[];
    /** 是否处于编辑模式 */
    editing?: boolean;
    /** 用户状态：1=启用，2=禁用 */
    status?: Api.Common.EnableStatus;
  }

  const props = withDefaults(defineProps<Props>(), {
    avatar: null,
    roles: () => [],
    editing: false,
    status: '1'
  });

  interface Emits {
    /** 当用户点击卡片时触发 */
    (e: 'click', userId: string): void;

    /** 当用户状态切换时触发 */
    (e: 'statusChange', status: Api.Common.EnableStatus): void;

    /** 编辑模式开关（v-model:editing） */
    (e: 'update:editing', value: boolean): void;
  }

  const emit = defineEmits<Emits>();

  // 使用 defineModel 简化 v-model:editing
  const editingModel = defineModel<boolean>('editing', {
    default: false
  });

  function handleCardClick() {
    emit('click', props.nickName); // 实际应该用 userId，这里演示用 nickName
  }

  function toggleStatus() {
    const newStatus: Api.Common.EnableStatus = props.status === '1' ? '2' : '1';
    emit('statusChange', newStatus);
  }
</script>

<template>
  <div
      class="flex flex-col gap-12px rounded-lg p-16px shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      @click="handleCardClick"
  >
    <div class="flex items-center gap-12px">
      <img v-if="avatar" :src="avatar" class="h-48px w-48px rounded-full"/>
      <div v-else class="h-48px w-48px rounded-full bg-primary flex items-center justify-center text-white">
        {{ nickName.charAt(0) }}
      </div>
      <div class="flex flex-col">
        <span class="text-16px font-medium">{{ nickName }}</span>
        <ASpace size="small">
          <ATag v-for="role in roles" :key="role" size="small">{{ role }}</ATag>
        </ASpace>
      </div>
    </div>
    <div class="flex items-center justify-between">
      <ASwitch
          :checked="status === '1'"
          :checked-children="$t('common.enable')"
          :un-checked-children="$t('common.disable')"
          @change="toggleStatus"
      />
      <AButton v-if="!editingModel" size="small" @click.stop="editingModel = true">
        {{ $t('common.edit') }}
      </AButton>
      <AButton v-else size="small" type="primary" @click.stop="editingModel = false">
        {{ $t('common.save') }}
      </AButton>
    </div>
  </div>
</template>

<style scoped></style>
```

> **要点检查**：
> - ✅ `interface Props` 每个属性都有 JSDoc 注释
> - ✅ `withDefaults` 集中声明默认值，数组类型用工厂函数 `() => []`
> - ✅ `interface Emits` 定义了带参数的事件签名
> - ✅ `defineModel` 用于 `v-model:editing`，替代繁琐的 `props` + `emit('update:editing')`
> - ✅ 使用 `Api.Common.EnableStatus` 而非 `'1' | '2'`，复用全局类型

#### 小任务 2：创建泛型 `DataTable` 组件

```vue
<!-- src/components/common/data-table.vue -->
<script setup lang="ts" generic="T extends Record<string, any>">
  import {computed} from 'vue';

  defineOptions({
    name: 'DataTable'
  });

  interface Column {
    /** 列标识（对应数据字段名） */
    key: keyof T;
    /** 列标题 */
    title: string;
    /** 列宽度 */
    width?: number;
    /** 是否可排序 */
    sortable?: boolean;
  }

  interface Props {
    /** 表格数据 */
    data: T[];
    /** 列配置 */
    columns: Column[];
    /** 加载状态 */
    loading?: boolean;
    /** 分页配置 */
    pagination?: {
      current: number;
      pageSize: number;
      total: number;
    };
  }

  const props = withDefaults(defineProps<Props>(), {
    loading: false
  });

  interface Emits {
    /** 行点击事件 */
    (e: 'rowClick', row: T, index: number): void;

    /** 分页变化 */
    (e: 'pageChange', current: number, pageSize: number): void;

    /** 排序变化 */
    (e: 'sortChange', key: keyof T, order: 'ascend' | 'descend' | null): void;
  }

  const emit = defineEmits<Emits>();

  const paginationConfig = computed(() =>
      props.pagination
          ? {
            current: props.pagination.current,
            pageSize: props.pagination.pageSize,
            total: props.pagination.total,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 条`
          }
          : false
  );

  function handleRowClick(row: T, index: number) {
    emit('rowClick', row, index);
  }

  function handleTableChange(
      pagination: { current: number; pageSize: number },
      filters: any,
      sorter: { columnKey?: string; order?: 'ascend' | 'descend' }
  ) {
    if (pagination.current !== props.pagination?.current || pagination.pageSize !== props.pagination?.pageSize) {
      emit('pageChange', pagination.current, pagination.pageSize);
    }
    if (sorter.columnKey) {
      emit('sortChange', sorter.columnKey as keyof T, sorter.order || null);
    }
  }
</script>

<template>
  <ATable
      :data-source="data"
      :columns="columns as any"
      :loading="loading"
      :pagination="paginationConfig"
      row-key="id"
      @change="handleTableChange"
  >
    <template #bodyCell="{ column, record, index }">
      <slot name="bodyCell" :column="column" :record="record" :index="index">
        <span @click="handleRowClick(record as T, index)">
          {{ record[column.key as string] }}
        </span>
      </slot>
    </template>
  </ATable>
</template>

<style scoped></style>
```

> **注意**：上面的 `columns as any` 是因为 Ant Design Vue 的 `Table` 组件的 `columns` 类型与我们的 `Column` 不完全兼容，实际项目中应该用 `as AntDesign.TableColumn<T>` 转换。这里为了演示泛型，使用 `as any` 是临时方案，**生产代码应避免**。

> **泛型组件使用示例**：
> ```vue
> <template>
>   <DataTable
>     :data="userList"
>     :columns="userColumns"
>     :pagination="pagination"
>     @rowClick="handleRowClick"
>   />
> </template>
> <script setup lang="ts">
> const userList = ref<Api.SystemManage.User[]>([]);
> const userColumns = [
>   { key: 'userName', title: '用户名' },
>   { key: 'nickName', title: '昵称' },
>   { key: 'status', title: '状态' }
> ];
> </script>
> ```
> 使用 `<DataTable>` 时，TypeScript 会自动推断 `T = Api.SystemManage.User`，无需显式写 `<DataTable<Api.SystemManage.User>>`（当然也可以写）。

#### 小任务 3：将类型提取到 `typings/` 目录

```typescript
// src/typings/business.d.ts（新建文件）
/** Business component types */
declare namespace Business {
  interface UserCardProps {
    nickName: string;
    avatar?: string | null;
    roles?: string[];
    editing?: boolean;
    status?: Api.Common.EnableStatus;
  }

  interface DataTableColumn<T> {
    key: keyof T;
    title: string;
    width?: number;
    sortable?: boolean;
  }

  interface DataTablePagination {
    current: number;
    pageSize: number;
    total: number;
  }
}
```

> **为什么提取到 `typings/`？**
> - 类似 Java 的 `dto/` 包，集中管理类型声明
> - `declare namespace` 不需要 `import/export`，全局可用
> - 组件中直接用 `Business.UserCardProps`，无需相对路径导入

### 第三步：整合小任务，功能测试

将 `UserCard` 和 `DataTable` 在一个页面中整合：

```vue
<!-- 测试页面（临时） -->
<template>
  <div class="p-16px flex gap-16px">
    <UserCard
        v-for="user in userList.slice(0, 3)"
        :key="user.id"
        v-model:editing="editingMap[user.id]"
        :nick-name="user.nickName"
        :roles="user.userRoles"
        :status="user.status"
        @click="handleCardClick"
        @status-change="handleStatusChange"
    />
  </div>
  <DataTable
      :data="userList"
      :columns="columns"
      :loading="loading"
      :pagination="pagination"
      @row-click="handleRowClick"
  />
</template>

<script setup lang="ts">
  import {ref} from 'vue';
  import UserCard from '@/components/common/user-card.vue';
  import DataTable from '@/components/common/data-table.vue';

  const userList = ref<Api.SystemManage.User[]>([
    {id: 1, userName: 'admin', nickName: '管理员', userRoles: ['超级管理员'], status: '1'},
    // ... 更多数据
  ]);

  const editingMap = ref<Record<number, boolean>>({});

  const columns: Business.DataTableColumn<Api.SystemManage.User>[] = [
    {key: 'userName', title: '用户名'},
    {key: 'nickName', title: '昵称'},
    {key: 'status', title: '状态'}
  ];

  const loading = ref(false);
  const pagination = ref<Business.DataTablePagination>({current: 1, pageSize: 10, total: 100});

  function handleCardClick(nickName: string) {
    console.log('点击了卡片:', nickName);
  }

  function handleStatusChange(status: Api.Common.EnableStatus) {
    console.log('状态切换为:', status);
  }

  function handleRowClick(row: Api.SystemManage.User, index: number) {
    console.log('点击了第', index, '行:', row.userName);
  }
</script>
```

### 调试及错误排查思路

| 问题                       | 排查方法                                                                      |
|--------------------------|---------------------------------------------------------------------------|
| `defineProps` 类型报错       | 检查 `interface` 字段名是否拼写错误；检查是否混用了 `type` 和 `interface`                     |
| `defineEmits` 参数类型不匹配    | 检查事件调用时 `emit('event', payload)` 的 payload 类型是否与声明一致                      |
| 泛型组件使用时类型推断失败            | 确保传入的 `data` 数组有明确类型（如 `ref<User[]>([])`）；如果推断失败，可显式写 `<DataTable<User>>` |
| `import type` 导致运行时找不到类型 | 这是正常的——`import type` 只在编译时存在，不能用于 `instanceof` 等运行时检查                     |
| `defineModel` 不生效        | 检查父组件是否写 `v-model:editing`（不是 `v-model`）；检查 Vue 版本 >= 3.4                 |
| `pnpm typecheck` 报错      | 运行 `pnpm typecheck` 查看具体错误，通常是 `any` 逃逸或类型不匹配                             |

### 验收标准

- [ ] **能用**：`UserCard` 和 `DataTable` 在页面中正确渲染，事件正常触发
- [ ] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过
- [ ] **精进**：
    - 零 `any`（除了与 Ant Design Vue 类型兼容的临时转换）
    - Props 全部有 JSDoc 注释
    - Emit 使用类型化定义
    - 泛型组件 `T` 有合理约束（`extends Record<string, any>`）
    - 导入顺序符合规范（type → 第三方 → 内部 → 相对）

---

## 今日重点记忆卡

| 概念                     | 一句话              | Java类比                            | 前端独有                                             |
|------------------------|------------------|-----------------------------------|--------------------------------------------------|
| `defineProps<Props>()` | 声明组件接收的属性及其类型    | 类的构造参数声明                          | 支持响应式，父组件修改会自动触发子组件更新                            |
| `withDefaults`         | 为 Props 设置默认值    | 构造器默认值/Builder 模式                 | 默认值在编译时声明，运行时无需 `                                ||` 判断 |
| `defineEmits<Emits>()` | 声明组件可触发的事件及参数类型  | 观察者模式回调接口                         | 声明式使用，模板中 `@event` 自动匹配，无需手动注册                   |
| `defineModel`          | 声明双向绑定的属性        | `@Bindable` 注解 + 自动 setter 通知     | Vue 3.4 语法糖，自动展开为 `props` + `emit('update:xxx')` |
| `<script generic="T">` | 声明组件为泛型组件        | `class Component<T extends Base>` | 使用时自动推断 `T`，无需显式写 `<Component<T>>`               |
| `import type`          | 仅导入类型信息，不生成运行时代码 | Java 的 `import`（仅编译时）             | Vite 构建时会完全移除，减少 bundle 体积                       |
| `declare namespace`    | 声明全局类型命名空间       | `package com.example.types;`      | 全局可用，无需导入，适合集中管理后端接口类型                           |
| `keyof T`              | 获取对象类型的所有键的联合类型  | Java 反射 `Field[]`（但编译期安全）         | 编译期类型操作，确保列配置 `key` 只能使用合法字段名                    |
| `// @ts-ignore`        | 临时忽略下一行的 TS 错误   | `@SuppressWarnings`               | 项目规范**禁止**使用，宁可 `as` 临时断言                        |

---

## 扩展思考（选做）

1. **为什么 `withDefaults` 中数组/对象的默认值要用工厂函数？**
   > 类似 Java 中每个实例需要独立的默认值对象。如果直接写 `roles: []`，Vue 会在所有实例间共享同一个数组引用，导致一个实例修改影响其他实例。`withDefaults` 的工厂函数 `() => []` 确保每个实例获得独立副本。

2. **`defineProps` 解构 vs `const props = defineProps(...)` 的区别？**
   > Vue 3.4 支持 `const { nickName } = defineProps<Props>()` 解构，但**解构会丢失响应性**。除非使用 `toRefs`：`const { nickName } = toRefs(defineProps<Props>())`。最佳实践是保留 `props` 对象，在模板中直接使用 `props.xxx`，或使用 `computed` 包装。

3. **泛型组件的 `generic` 在编译后去哪了？**
   > Vue 编译器将 `generic="T extends ..."` 转换为 `.vue.d.ts` 声明文件中的 `declare const _default: <T extends ...>(props: ...)`。运行时 JS 代码中不存在泛型信息——这是类型擦除，与 Java 完全一致。

---

**明日预告**：第21天 — Vue 3 核心综合复习：独立实现一个"用户管理"页面（列表 + 搜索 + 编辑弹窗 + 删除确认），要求使用 Composition API + `<script setup>` + TypeScript + 完整类型定义
