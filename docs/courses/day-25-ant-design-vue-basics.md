# 今日前端课程 — 第25天：Ant Design Vue 基础 — 表单组件与表格组件

> **学习目标**
> - 能读：读懂 `src/views/manage/user/index.vue` 中表格+搜索+表单联动的完整链路
> - 能用：独立使用 `ATable` + `AForm` + `APagination` 搭建一个分页列表页
> - 规范：组件名 PascalCase、模板中组件名 PascalCase、`v-model` 使用正确、所有 `any` 消除
> - 精进：理解 `useTable` Hook 的封装哲学，能解释为什么用 `tsx` 而不是 `template` 写自定义渲染列
    > ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + Ant Design Vue 4 + Pinia + UnoCSS

---

## 理论学习

### 核心知识点

1. **Ant Design Vue 的定位**
    - 企业级中后台 UI 组件库，对标 Java 世界的 `Swing` + `JTable` + `JForm`
    - 核心组件：`Table`（表格）、`Form`（表单）、`Input`/`Select`/`DatePicker`（输入）、`Modal`/`Drawer`（弹窗）
    - 与 Element Plus 的区别：Ant Design Vue 4 基于 Vue 3 + TS 重写，类型更完善

2. **ATable 的核心概念**
    - `columns`：列定义数组，每列包含 `title`（表头）、`dataIndex`（数据字段）、`key`（唯一标识）
    - `data-source`：数据源数组，每行数据是一个对象
    - `pagination`：分页配置对象，包含 `current`（当前页）、`pageSize`（每页条数）、`total`（总条数）
    - `customRender`：自定义渲染函数，用于渲染复杂列（如状态标签、操作按钮）
    - `row-selection`：行选择配置，支持单选/多选/复选框

3. **AForm 的核心概念**
    - `model`：表单数据对象（响应式绑定）
    - `rules`：验证规则对象，与 Java 的 `@NotNull`、`@Size` 等价
    - `name`：字段名，与 `model` 中的属性名对应
    - `validate()`：触发整体验证，返回 Promise
    - `resetFields()`：重置表单到初始状态

4. **v-model 在 AntDV 中的使用**
    - `v-model:value`：AntDV 4 的表单组件使用 `value` 作为默认属性（而非 Vue 原生的 `modelValue`）
    - 原因：Ant Design Vue 保留历史兼容性，同时支持 `v-model:value` 和 `v-model`

### Java 思维类比

> **ATable ≈ Java 的 `JTable` + `TableModel`**
> - `columns` 相当于 `TableModel` 的列定义（`ColumnInfo`）
> - `data-source` 相当于 `TableModel` 的数据行（`List<Object[]>`）
> - `customRender` 相当于 `TableCellRenderer`（自定义单元格渲染）
> - `pagination` 相当于分页参数对象（`PageRequest` + `PageResult`）
>
> **AForm ≈ Java 的 `JPanel` + `FormLayout` + `Bean Validation`**
> - `model` 相当于表单绑定的 Java Bean（DTO）
> - `rules` 相当于 `@Valid` + 约束注解（`@NotNull`、`@Email`）
> - `validate()` 相当于 `Validator.validate(bean)`
> - `resetFields()` 相当于重置 Bean 到初始状态

### 超越类比 — 前端独有的设计哲学

> **为什么 AntDV 的表格列定义是"声明式"而非"命令式"？**
>
> Java 中配置 JTable 通常是一步步调用方法：`table.setModel(model)`、`model.addColumn(...)`。
> 前端表格的 `columns` 是一个**纯数组对象**，这种声明式写法有三大优势：
> 1. **可序列化**：列配置可以存 JSON、存后端、动态下发
> 2. **可响应式**：`columns` 是响应式数据，切换列显示/隐藏时框架自动 diff 更新
> 3. **可组合**：通过 `computed` 动态生成列配置，实现权限控制（某些列仅管理员可见）
>
> 这是前端"数据驱动 UI"哲学的典型体现，Java 的 Swing 是做不到这点的。

> **为什么用 `tsx` 写 `customRender` 而不是 `template`？**
>
> `customRender` 接收 `(record) => VNode` 函数。在 `template` 中写复杂的条件渲染（如状态标签）需要嵌套多层 `v-if`，可读性差。
> 使用 TSX 可以直接返回 JSX 表达式，语法更贴近 Java 的 Lambda 表达式：`record => <Tag>{record.status}</Tag>`。
> 更重要的是：TSX 中的类型推导更严格，`record` 的类型自动推断为 `Api.SystemManage.User`，零 `any`。

---

## carlos-framework-ui 源码阅读 + 规范评审

### 目标文件

- `src/views/manage/user/index.vue` — 用户列表页（表格 + 搜索 + 分页 + 操作）
- `src/views/manage/user/modules/user-search.vue` — 搜索表单组件
- `src/views/manage/user/modules/user-operate-drawer.vue` — 编辑/新增抽屉表单
- `src/hooks/common/table.ts` — `useTable` / `useTableOperate` / `useTableScroll` 封装
- `src/service/api/system-manage.ts` — 用户相关 API 接口

### 阅读指引

1. 先看 `user-search.vue`：理解 `AForm` + `ARow` + `ACol` 的响应式搜索布局
2. 再看 `index.vue`：理解 `ATable` 的 `columns` 定义、`customRender` 渲染状态标签、操作按钮列
3. 最后看 `user-operate-drawer.vue`：理解 `ADrawer` + `AForm` + 表单验证的完整链路

### 关键代码精读

#### 1. 表格列定义中的 `customRender`

```tsx
// src/views/manage/user/index.vue
{
  key: 'status',
  dataIndex: 'status',
  title: $t('page.manage.user.userStatus'),
  align: 'center',
  width: 100,
  customRender: ({record}) => {
    if (record.status === null) {
      return null;
    }

    const tagMap: Record<Api.Common.EnableStatus, string> = {
      1: 'success',
      2: 'warning'
    };

    const label = $t(enableStatusRecord[record.status]);

    return <Tag color={tagMap[record.status]}>{label}</Tag>;
  }
}
```

**为什么这样写？**

- `Record<Api.Common.EnableStatus, string>` 确保 `tagMap` 的键必须是 `1` 或 `2`，编译器会检查是否有遗漏
- `record.status === null` 先检查空值，避免 `tagMap[null]` 返回 `undefined`
- 返回 `Tag` 组件而非字符串，因为状态需要用颜色区分

#### 2. 搜索表单的数据绑定

```vue
<!-- src/views/manage/user/modules/user-search.vue -->
<AForm ref="formRef" :model="model" :rules="rules">
  <AFormItem :label="$t('page.manage.user.userName')" name="userName">
    <AInput v-model:value="model.userName" :placeholder="$t('page.manage.user.form.userName')"/>
  </AFormItem>
</AForm>
```

**为什么这样写？**

- `v-model:value="model.userName"` 是 AntDV 4 的写法（不是 `v-model`）
- `model` 由 `defineModel` 定义，父组件通过 `v-model:model` 传入，形成父子双向绑定
- `name="userName"` 必须与 `model` 中的属性名一致，否则验证规则找不到对应字段

#### 3. useTable Hook 的封装哲学

```typescript
// src/hooks/common/table.ts
export function useTable<A extends AntDesign.TableApiFn>(config: AntDesign.AntDesignTableConfig<A>) {
  const {apiFn, apiParams, immediate} = config;
  
  // ... 使用 effectScope 管理副作用生命周期
  const scope = effectScope();
  
  // ... 封装分页、加载、搜索、数据转换
  const {loading, data, columns, getData, searchParams, ...} = useHookTable({
    apiFn,
    apiParams,
    // transformer: 后端分页格式 → 前端表格格式
    transformer: res => {
      const {records = [], current = 1, size = 10, total = 0} = res.data || {};
      // 给每行加序号
      const recordsWithIndex = records.map((item, index) => ({
        ...item,
        index: (current - 1) * size + index + 1
      }));
      return {data: recordsWithIndex, pageNum: current, pageSize: size, total};
    }
  });
  
  // 监听语言变化，重新加载列（国际化列标题）
  scope.run(() => {
    watch(() => appStore.locale, () => reloadColumns());
  });
  
  onScopeDispose(() => scope.stop());
  
  return { /* ... */ };
}
```

**为什么这样写？**

- `effectScope` 是 Vue 3.2+ 的高级特性，用于批量管理副作用的生命周期。当组件卸载时，调用 `scope.stop()` 自动清理所有 `watch`/`computed`。
- 这相当于 Java 的 `try-with-resources` 或 `AutoCloseable`，确保资源不泄漏。
- `transformer` 将后端分页格式（`records`/`current`/`size`/`total`）转换为前端表格格式，解耦后端数据结构与前端展示逻辑。

### 规范评审清单

| 检查项   | 标准                          | 该文件是否达标？                                                              |
|-------|-----------------------------|-----------------------------------------------------------------------|
| 命名规范  | 文件 kebab-case、组件 PascalCase | ✅ `user-search.vue` / `UserSearch`                                    |
| 类型完整性 | 零 any                       | ✅ `customRender` 使用 `Record<Api.Common.EnableStatus, string>`，无 `any` |
| 目录规范  | 页面子模块放在 `modules/`          | ✅ `user-search.vue` 在 `user/modules/`                                 |
| 导入顺序  | type → 第三方 → 内部 → 相对        | ✅ 符合规范                                                                |
| 错误处理  | 异步有 try/catch 或拦截           | ⚠️ `handleSubmit` 仅 `await validate()`，无错误处理（需改进）                     |
| 可测试性  | 纯函数可单测                      | ⚠️ `customRender` 是纯函数，但 `useTable` 依赖 API 调用，需 mock                  |
| 国际化   | 用户可见字符串使用 `$t()`            | ✅ 所有表头、按钮、标签均使用 `$t()`                                                |

**改进建议**：

1. `user-operate-drawer.vue` 的 `handleSubmit` 缺少错误处理：
   ```typescript
   async function handleSubmit() {
     try {
       await validate();
       // request
       window.$message?.success($t('common.updateSuccess'));
       closeDrawer();
       emit('submitted');
     } catch (error) {
       // 表单验证失败时，validate() 已抛出错误，但网络请求错误需额外处理
       window.$message?.error($t('common.requestError'));
     }
   }
   ```
2. `user-search.vue` 的 `rules` 定义在 `computed` 中，但 `useFormRules()` 在 `computed` 内部调用，每次重新计算都会创建新的 rules 对象，建议移到 `setup` 顶层：
   ```typescript
   const {patternRules} = useFormRules(); // 移到 computed 外部
   const rules = computed<Record<RuleKey, App.Global.FormRule>>(() => ({
     userEmail: patternRules.email,
     userPhone: patternRules.phone
   }));
   ```

---

## 功能实践 — 分三步

### 第一步：功能拆解

目标：实现一个**角色管理列表页**，包含：

1. 搜索表单：角色名称（输入框）、角色状态（下拉选择）、角色编码（输入框）
2. 表格展示：序号、角色名称、角色编码、状态、创建时间、操作（编辑/删除）
3. 分页：每页 10 条，支持切换页码和每页条数
4. 操作：新增按钮、批量删除、行内编辑/删除

### 第二步：小任务开发

#### 任务 1：创建 API 接口（参考 `src/service/api/system-manage.ts`）

```typescript
// src/service/api/role-manage.ts
import {request} from '../request';

/** get role list */
export function fetchGetRoleList(params?: Api.SystemManage.RoleSearchParams) {
  return request<Api.SystemManage.RoleList>({
    url: '/org/role/page',
    method: 'get',
    params
  });
}

/** delete role */
export function fetchDeleteRole(id: number) {
  return request<void>({
    url: `/org/role/${id}`,
    method: 'delete'
  });
}
```

**技术要点**：

- 使用 `fetch + 动词 + 名词` 命名规范
- 参数类型使用 `Api.SystemManage.RoleSearchParams`（后端定义的搜索参数类型）
- 返回类型使用 `Api.SystemManage.RoleList`（后端定义的分页结果类型）

#### 任务 2：创建搜索表单组件

```vue
<!-- src/views/manage/role/modules/role-search.vue -->
<script setup lang="ts">
import {computed} from 'vue';
import {$t} from '@/locales';
import {useAntdForm, useFormRules} from '@/hooks/common/form';
import {enableStatusOptions} from '@/constants/business';
import {translateOptions} from '@/utils/common';

defineOptions({name: 'RoleSearch'});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();
const {formRef, validate, resetFields} = useAntdForm();
const model = defineModel<Api.SystemManage.RoleSearchParams>('model', {required: true});

const {defaultRequiredRule} = useFormRules();

// 注意：移到 computed 外部，避免重复创建
const rules = computed(() => ({
  roleName: defaultRequiredRule
}));

async function reset() {
  await resetFields();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}
</script>

<template>
  <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
    <AForm ref="formRef" :model="model" :rules="rules">
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.role.roleName')" name="roleName" class="m-0">
            <AInput v-model:value="model.roleName" :placeholder="$t('page.manage.role.form.roleName')"/>
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.role.roleCode')" name="roleCode" class="m-0">
            <AInput v-model:value="model.roleCode" :placeholder="$t('page.manage.role.form.roleCode')"/>
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.role.roleStatus')" name="status" class="m-0">
            <ASelect
              v-model:value="model.status"
              :placeholder="$t('page.manage.role.form.roleStatus')"
              :options="translateOptions(enableStatusOptions)"
              clearable
            />
          </AFormItem>
        </ACol>
        <ACol flex="1">
          <AFormItem class="m-0">
            <div class="w-full flex-y-center justify-end gap-12px">
              <AButton @click="reset">
                <template #icon>
                  <icon-ic-round-refresh class="align-sub text-icon"/>
                </template>
                <span class="ml-8px">{{ $t('common.reset') }}</span>
              </AButton>
              <AButton type="primary" ghost @click="search">
                <template #icon>
                  <icon-ic-round-search class="align-sub text-icon"/>
                </template>
                <span class="ml-8px">{{ $t('common.search') }}</span>
              </AButton>
            </div>
          </AFormItem>
        </ACol>
      </ARow>
    </AForm>
  </ACard>
</template>
```

**技术要点**：

- 使用 `defineModel` 实现父子双向绑定（Vue 3.4+）
- `ARow` + `ACol` 实现响应式布局（移动端 1 列，平板 2 列，桌面 3 列）
- `clearable` 属性让下拉框支持清除选择

#### 任务 3：创建主页面（表格 + 操作）

```vue
<!-- src/views/manage/role/index.vue -->
<script setup lang="tsx">
import {Button, Popconfirm, Tag} from 'ant-design-vue';
import {fetchGetRoleList} from '@/service/api';
import {useTable, useTableOperate, useTableScroll} from '@/hooks/common/table';
import {$t} from '@/locales';
import {enableStatusRecord} from '@/constants/business';
import RoleSearch from './modules/role-search.vue';

defineOptions({name: 'RoleManage'});

const {tableWrapperRef, scrollConfig} = useTableScroll();

const {
  columns,
  columnChecks,
  data,
  getData,
  getDataByPage,
  loading,
  mobilePagination,
  searchParams,
  resetSearchParams
} = useTable({
  apiFn: fetchGetRoleList,
  apiParams: {
    current: 1,
    size: 10,
    roleName: undefined,
    roleCode: undefined,
    status: undefined
  },
  columns: () => [
    {
      key: 'index',
      title: $t('common.index'),
      dataIndex: 'index',
      align: 'center',
      width: 64
    },
    {
      key: 'roleName',
      dataIndex: 'roleName',
      title: $t('page.manage.role.roleName'),
      align: 'center',
      minWidth: 120
    },
    {
      key: 'roleCode',
      dataIndex: 'roleCode',
      title: $t('page.manage.role.roleCode'),
      align: 'center',
      minWidth: 120
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: $t('page.manage.role.roleStatus'),
      align: 'center',
      width: 100,
      customRender: ({record}) => {
        if (record.status === null) {
          return null;
        }
        const tagMap: Record<Api.Common.EnableStatus, string> = {
          1: 'success',
          2: 'warning'
        };
        const label = $t(enableStatusRecord[record.status]);
        return <Tag color={tagMap[record.status]}>{label}</Tag>;
      }
    },
    {
      key: 'createTime',
      dataIndex: 'createTime',
      title: $t('page.manage.role.createTime'),
      align: 'center',
      minWidth: 180
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 130,
      customRender: ({record}) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
            {$t('common.edit')}
          </Button>
          <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
            <Button danger size="small">
              {$t('common.delete')}
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ]
});

const {
  drawerVisible,
  operateType,
  editingData,
  handleAdd,
  handleEdit,
  checkedRowKeys,
  rowSelection,
  onBatchDeleted,
  onDeleted
} = useTableOperate(data, getData);

function handleDelete(id: number) {
  console.log(id);
  onDeleted();
}

function edit(id: number) {
  handleEdit(id);
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <RoleSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage"/>
    <ACard
      :title="$t('page.manage.role.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch sm:flex-1-hidden card-wrapper"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0"
          :loading="loading"
          @add="handleAdd"
          @delete="handleBatchDelete"
          @refresh="getData"
        />
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="data"
        size="small"
        :row-selection="rowSelection"
        :scroll="scrollConfig"
        :loading="loading"
        row-key="id"
        :pagination="mobilePagination"
        class="h-full"
      />
    </ACard>
  </div>
</template>
```

### 第三步：整合与测试

将以上三个文件整合到项目中：

1. 在 `src/views/manage/role/` 目录下创建 `index.vue` 和 `modules/role-search.vue`
2. 在 `src/service/api/` 下创建 `role-manage.ts`（或复用已有的 `system-manage.ts`）
3. 确保路由已配置（`src/views/manage/role/index.vue` 会自动生成路由）

**调试与错误排查思路**：

1. 页面白屏 → F12 检查 Console 报错 → 检查 `import` 路径是否正确
2. 表格无数据 → Network 面板检查 API 请求 → 检查 `apiParams` 是否与后端参数一致
3. 分页不生效 → 检查 `pagination` 的 `current`/`pageSize`/`total` 是否正确绑定
4. 表单验证不生效 → 检查 `name` 属性是否与 `model` 属性名一致 → 检查 `rules` 是否正确传入
5. 列不显示 → 检查 `columns` 的 `key` 是否唯一 → 检查 `columnChecks` 是否被过滤

### 验收标准

- [ ] 能用：功能正确（表格展示、搜索、分页、操作按钮正常）
- [ ] 规范：`pnpm typecheck` 通过，`pnpm lint` 通过
- [ ] 精进：对照规范评审清单自检通过
    - 命名规范：文件 `kebab-case`、组件 `PascalCase`
    - 类型完整性：无 `any`，`Record<Api.Common.EnableStatus, string>` 完整
    - 目录规范：页面子模块在 `modules/`
    - 导入顺序：`import type` → 第三方 → 内部 → 相对
    - 错误处理：表单验证失败有提示，API 错误有拦截
    - 国际化：所有用户可见字符串使用 `$t()`

---

## 今日重点记忆卡

| 概念                | 一句话               | Java类比                          | 前端独有                                 |
|-------------------|-------------------|---------------------------------|--------------------------------------|
| `columns`         | 表格列定义数组，声明式配置     | `TableModel` 列定义                | 可响应式、可动态生成、可序列化                      |
| `customRender`    | 自定义列渲染函数，返回 VNode | `TableCellRenderer`             | 用 TSX 写，类型推导更自然                      |
| `v-model:value`   | AntDV 4 表单组件双向绑定  | `Bean` + `PropertyEditor`       | 组件库自定义属性名（非 `modelValue`）            |
| `AForm` + `rules` | 表单验证，声明式规则        | `Bean Validation`               | 规则与 UI 绑定，验证失败自动高亮                   |
| `useTable`        | 表格逻辑封装 Hook       | 自定义 `TableModel` + `Controller` | 组合式函数，可复用、可测试、副作用自动清理                |
| `effectScope`     | 批量管理副作用生命周期       | `try-with-resources`            | 组件卸载时自动 stop，防止内存泄漏                  |
| `defineModel`     | 声明双向绑定 props      | 无直接对应                           | Vue 3.4 语法糖，省去 `props` + `emit` 样板代码 |
| `Tag` 颜色映射        | `Record<状态, 颜色>`  | `Map<Enum, Color>`              | TS 记录类型，编译时检查完整性                     |

---

## 延伸阅读与思考题

### 思考题

1. 为什么 `useTable` 使用 `effectScope` 而不是直接在 `onUnmounted` 中清理？
2. 如果后端返回的分页格式是 `list`/`pageNum`/`pageSize`/`total`，而 `useTable` 内部使用 `records`/`current`/`size`，`transformer` 如何解耦这种差异？
3. 为什么 `user-search.vue` 的 `model` 属性值必须初始化为 `null` 或 `undefined`，不能是 `undefined`（在 `apiParams` 中）？

### 答案提示

1. `effectScope` 可以收集多个 `watch`/`computed` 的副作用，一次性 `stop()` 清理。如果组件内还有异步请求或其他副作用，也能统一管理。
2. `transformer` 是一个纯函数，接收后端原始响应，返回前端需要的格式。这样无论后端格式如何变化，只需修改 `transformer` 即可，不影响组件代码。
3. `undefined` 在 Vue 的响应式系统中不会被追踪为属性（因为 `undefined` 不是有效的属性值），如果搜索参数在 `AForm` 中使用，`undefined` 会导致表单字段不响应。使用 `null` 或空字符串可以确保响应式追踪。

---

**明日预告**：第26天 — Ant Design Vue 进阶：复杂表格（行展开、树形数据）、表单联动、自定义主题
