# 今日前端课程 — 第26天：Ant Design Vue 进阶 — 复杂表格、表单联动、自定义主题

> **学习目标**
> - **能读**：读懂 `user/index.vue` 中 TSX 渲染函数、列配置、分页联动逻辑
> - **能用**：实现表格行展开详情、表单字段联动（选择角色后联动权限）、主题色动态切换
> - **规范**：零 `any`、所有 API 参数有类型、常量用 `Record` + `transformRecordToOption`、用户可见字符串用 `$t()`
> - **精进**：理解 `effectScope` 管理副作用生命周期、`computed` 缓存策略、主题系统 CSS 变量注入原理
>
> ⏱️ 预计用时：1.5-2 小时 | 🔧 技术栈：Vue3 + Vite + TS + AntDV + Pinia + UnoCSS

---

## 理论学习

### 核心知识点

#### 1. 表格的「复杂渲染」—— TSX 与 `customRender`

Ant Design Vue 的 `Table` 组件通过 `columns` 配置列，其中 `customRender` 允许你用函数返回任意渲染内容。carlos-ui 中使用 **TSX**（TypeScript + JSX）写法，直接在 `.vue` 文件中写 `<Tag color={...}>{...}</Tag>`。

**为什么要用 TSX？**

- 模板语法对复杂逻辑支持有限（如条件渲染 + 循环 + 变量计算）
- TSX 就是 JavaScript，可以任意组合逻辑，同时保持类型安全
- 与 React 的 JSX 几乎一致，Java 工程师类比：就像 JSP 的 `<c:choose>` 不如写 Java 代码灵活

**关键代码**（`src/views/manage/user/index.vue`）：

```tsx
{
  key: 'userGender',
  title: $t('page.manage.user.userGender'),
  align: 'center',
  width: 100,
  customRender: ({record}) => {
    if (record.userGender === null) {
      return null;
    }

    const tagMap: Record<Api.SystemManage.UserGender, string> = {
      1: 'processing',
      2: 'error'
    };

    const label = $t(userGenderRecord[record.userGender]);

    return <Tag color={tagMap[record.userGender]}>{label}</Tag>;
  }
}
```

> ⚠️ 注意：`<script setup lang="tsx">` 必须声明为 `tsx`，否则 TSX 语法会报错。

#### 2. 表单联动 — `watch` + 条件重置

表单联动是 Admin 系统的核心交互模式：选择一个字段，其他字段随之变化。实现方式通常是 `watch` 监听某个字段，然后重置或更新其他字段。

**关键代码**（`src/views/manage/user/modules/user-operate-drawer.vue`）：

```typescript
watch(visible, () => {
  if (visible.value) {
    handleInitModel();
    resetFields();
    getRoleOptions();
  }
});
```

这里 `visible` 是抽屉的显示状态，每次打开抽屉时：
1. `handleInitModel()` — 根据 `operateType` 初始化模型（新增用空对象，编辑用 `rowData`）
2. `resetFields()` — 重置 AntDV Form 的校验状态
3. `getRoleOptions()` — 异步获取角色下拉选项

> **Java 类比**：这就像 Spring 的 `@EventListener` — 监听状态变化，触发一系列副作用。

#### 3. 主题系统 — CSS 变量 + Pinia + `effectScope`

carlos-ui 的主题系统不依赖 AntDV 的内置主题，而是通过 **CSS 变量** 动态注入，由 Pinia Store 统一管理。

**三层架构**：

| 层级 | 职责 | 对应文件 |
|------|------|---------|
| 配置层 | 定义主题色、布局模式、Token | `src/store/modules/theme/index.ts` |
| 计算层 | 根据配置生成 CSS 变量值 | `src/store/modules/theme/shared.ts` |
| 注入层 | 将 CSS 变量写入 `:root` | `addThemeVarsToGlobal()` |

**关键代码**（`src/store/modules/theme/index.ts`）：

```typescript
const scope = effectScope();

// ...

scope.run(() => {
  watch(darkMode, val => {
    toggleCssDarkMode(val);
  }, {immediate: true});

  watch(themeColors, val => {
    setupThemeVarsToGlobal();
    localStg.set('themeColor', val.primary);
  }, {immediate: true});
});

onScopeDispose(() => {
  scope.stop();
});
```

> `effectScope` 是 Vue 3.2+ 引入的 API，用于创建一个「作用域」，将该作用域内所有的响应式副作用（`watch`、`computed`、`effect`）统一收集，离开时一次性停止。这比手动 `watchStopHandle()` 更清晰，类比 Java 的 `try-with-resources`。

#### 4. 常量与选项的规范转换 — `Record` → `Option`

carlos-ui 中所有下拉选项都不手写数组，而是通过 `Record` 常量自动转换：

```typescript
// src/constants/business.ts
export const enableStatusRecord: Record<Api.Common.EnableStatus, App.I18n.I18nKey> = {
  '1': 'page.manage.common.status.enable',
  '2': 'page.manage.common.status.disable'
};

export const enableStatusOptions = transformRecordToOption(enableStatusRecord);
// 结果: [{ value: '1', label: 'page.manage.common.status.enable' }, ...]
```

**好处**：
- 单源 truth：修改 `Record` 一处，选项和翻译同时生效
- 类型安全：`Record<Api.Common.EnableStatus, ...>` 确保键只能是 `'1'` 或 `'2'`
- 国际化友好：`label` 是 i18n key，渲染时通过 `$t()` 翻译

---

### Java 思维类比

| 前端概念 | Java 类比 | 关键差异 |
|---------|----------|---------|
| `customRender` TSX | JSP 自定义标签 `<my:tag>` | TSX 是类型安全的纯函数，无服务端渲染开销 |
| `watch(visible, ...)` | Spring `@EventListener` | 前端监听的是响应式数据变化，而非事件总线 |
| `effectScope` | `try-with-resources` / `AutoCloseable` | 管理的是响应式副作用生命周期，而非 IO 资源 |
| CSS 变量主题 | Java Swing `UIManager.put()` | CSS 变量是声明式的，修改即生效，无需手动重绘 |
| `Record` → `Option` | Java 枚举 `Enum.values()` + `Stream.map()` | 前端 Record 更灵活，key 可以是字符串联合类型 |
| `transformRecordToOption` | 通用的 `Enum → Select Option` 工具方法 | 前端版本天然支持 i18n key 作为 label |

### 超越类比 — 前端独有的设计哲学

> **为什么前端用 CSS 变量做主题，而不用 Java 的「换肤 = 换配置文件」？**
>
> Java 应用换肤通常意味着重启或重新加载配置。但浏览器中，CSS 变量是**运行时声明式**的 —— 修改 `:root { --primary-color }` 的值，所有引用该变量的元素瞬间更新，无需重新渲染组件树。这是 Web 平台「样式与结构分离」的极致体现。
>
> 更进一步，carlos-ui 通过 `dark: 'class'` 模式（UnoCSS 配置），在根元素切换 `.dark` class，所有 `dark:` 前缀的原子类同时生效，实现**零 JavaScript 参与的暗色模式切换**。这是 Java GUI 无法做到的性能优化。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

1. `src/views/manage/user/index.vue` — 复杂表格（TSX 渲染、分页、操作列）
2. `src/components/advanced/table-column-setting.vue` — 拖拽列设置（泛型组件）
3. `src/views/manage/user/modules/user-search.vue` — 搜索表单（响应式布局、规则校验）
4. `src/views/manage/user/modules/user-operate-drawer.vue` — 编辑抽屉（表单联动、异步加载）
5. `src/store/modules/theme/index.ts` — 主题状态管理
6. `src/hooks/common/table.ts` — `useTable` 封装（分页、列缓存）
7. `src/hooks/common/form.ts` — `useFormRules` 封装（校验规则复用）

### 阅读指引

**文件 1：`src/views/manage/user/index.vue`**

1. 先看 `useTable({...})` 的调用：传入 `apiFn`（数据获取函数）和 `apiParams`（初始参数）
2. 注意 `apiParams` 中所有字段必须初始化为 `null` 而非 `undefined`，否则 AntDV Form 不会响应式绑定
3. 看 `columns` 中的 `customRender`：用 TSX 渲染 `Tag` 和按钮组，返回类型是 `VNode | null`
4. 思考：为什么操作列的按钮用 `size="small"`？—— 表格行高有限，小按钮更紧凑

**文件 2：`src/components/advanced/table-column-setting.vue`**

1. 注意 `<script setup lang="ts" generic="T extends Record<string, unknown>, K = never">` — Vue 3.3+ 的泛型组件语法
2. `defineModel<AntDesign.TableColumnCheck[]>('columns')` — 双向绑定列配置数组
3. `VueDraggable` 来自 `vue-draggable-plus`，实现列拖拽排序

**文件 3：`src/store/modules/theme/index.ts`**

1. `effectScope()` 创建作用域 → `scope.run(() => { ...watch... })` → `onScopeDispose(() => scope.stop())`
2. `computed` 层层推导：`themeColors` → `antdTheme` → `ConfigProvider :theme`
3. `watch(themeColors, ...)` 中同时做两件事：更新 CSS 变量 + 缓存 primary 色到 localStorage

### 规范评审清单

| 检查项 | 标准 | `user/index.vue` | `user-search.vue` | `theme/index.ts` |
|--------|------|:---------------:|:----------------:|:---------------:|
| 命名规范 | 文件 kebab-case、组件 PascalCase、函数 camelCase | ✅ `user-search.vue` | ✅ | ✅ `useThemeStore` |
| 类型完整性 | 零 any，参数/返回值有类型 | ✅ `customRender` 有类型 | ✅ `RuleKey` 精确提取 | ✅ `Ref<...>` 泛型 |
| 目录规范 | 页面在 views/、组件在 components/、Store 在 store/modules/ | ✅ | ✅（modules/ 子模块） | ✅ |
| 导入顺序 | type → 第三方 → 内部 → 相对 | ✅ | ✅ | ✅ |
| 错误处理 | 异步有 try/catch 或统一拦截 | ⚠️ `handleDelete` 只有 `console.log` | ✅ `validate()`  await | ✅ `scope.stop()` |
| 可测试性 | 纯函数可单测，副作用可 mock | ⚠️ `customRender` 闭包依赖外部变量 | ✅ 规则纯函数 | ✅ Store 可独立测试 |
| 国际化 | 用户可见字符串用 `$t()` | ✅ | ✅ | ✅ |

> 🔍 **发现的问题**：
> - `user/index.vue` 中 `handleDelete(id)` 只有 `console.log(id)`，未调用真实 API — 这是已知 TODO，但课程中应指出
> - `user-search.vue` 中 `rules` 定义在 `computed` 内部，注释说明「inside computed to make locale reactive」—— 这是为了让语言切换时校验提示自动更新，非常精巧

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**目标**：在 carlos-ui 中新增一个「部门管理」页面，包含：
1. 表格展示部门列表（带行展开显示部门下的人员数）
2. 搜索表单（部门名称 + 状态联动：禁用状态下隐藏负责人字段）
3. 编辑抽屉（选择部门类型后，动态显示/隐藏不同的表单字段）
4. 主题感知：表格行 hover 色跟随主题 primary 色

**拆解为 4 个小任务**：
- 任务 A：创建页面路由与文件结构
- 任务 B：实现表格（含行展开详情、状态 Tag 渲染）
- 任务 C：实现搜索表单（字段联动：状态选择「禁用」时隐藏负责人）
- 任务 D：实现编辑抽屉（部门类型联动表单字段）

---

### 第二步：小任务开发

#### 任务 A：页面结构与路由

```
src/views/manage/dept/
├── index.vue           # 页面入口
├── modules/
│   ├── dept-search.vue    # 搜索表单
│   └── dept-operate-drawer.vue  # 编辑抽屉
```

**为什么这样分？**
- `index.vue` 只负责组装（表格 + 搜索 + 抽屉），逻辑交给 hooks
- 子模块放在 `modules/` 下，与 `user` 页面结构一致
- 路由由 Elegant Router 自动生成，无需手动配置

#### 任务 B：表格实现（行展开 + TSX 渲染）

```tsx
// src/views/manage/dept/index.vue
<script setup lang="tsx">
import {Tag} from 'ant-design-vue';
import {useTable, useTableOperate} from '@/hooks/common/table';
import {$t} from '@/locales';
import {enableStatusRecord} from '@/constants/business';
import DeptSearch from './modules/dept-search.vue';
import DeptOperateDrawer from './modules/dept-operate-drawer.vue';

const {
  columns,
  data,
  getData,
  getDataByPage,
  loading,
  mobilePagination,
  searchParams,
  resetSearchParams
} = useTable({
  apiFn: fetchGetDeptList,  // 假设已定义的 API
  apiParams: {
    current: 1,
    size: 10,
    deptName: undefined,
    status: undefined
  },
  columns: () => [
    {
      key: 'deptName',
      title: $t('page.manage.dept.deptName'),
      dataIndex: 'deptName',
      align: 'center',
      minWidth: 120
    },
    {
      key: 'status',
      title: $t('page.manage.dept.status'),
      align: 'center',
      width: 100,
      customRender: ({record}) => {
        const tagMap: Record<Api.Common.EnableStatus, string> = {
          '1': 'success',
          '2': 'warning'
        };
        return <Tag color={tagMap[record.status]}>{$t(enableStatusRecord[record.status])}</Tag>;
      }
    },
    {
      key: 'leader',
      title: $t('page.manage.dept.leader'),
      dataIndex: 'leader',
      align: 'center'
    }
  ]
});

// 行展开详情配置
const expandedRowKeys = ref<number[]>([]);

const expandable = {
  expandedRowRender: (record: Api.SystemManage.Dept) => (
    <div class="p-16px">
      <p>{$t('page.manage.dept.memberCount')}: {record.memberCount}</p>
      <p>{$t('page.manage.dept.createTime')}: {record.createTime}</p>
    </div>
  )
};
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden">
    <DeptSearch v-model:model="searchParams" @search="getDataByPage" @reset="resetSearchParams"/>
    <ACard :title="$t('page.manage.dept.title')" class="card-wrapper flex-col-stretch sm:flex-1-hidden">
      <ATable
        :columns="columns"
        :data-source="data"
        :expandable="expandable"
        :expanded-row-keys="expandedRowKeys"
        :loading="loading"
        row-key="id"
        :pagination="mobilePagination"
      />
    </ACard>
  </div>
</template>
```

**技术要点**：
- `expandedRowRender` 是 TSX 函数，接收整行数据返回 VNode
- `expandedRowKeys` 控制哪些行展开，可实现「每次只展开一行」的交互
- `row-key="id"` 必须指定，否则展开状态会混乱

#### 任务 C：搜索表单联动（状态 → 显示/隐藏负责人字段）

```vue
<!-- src/views/manage/dept/modules/dept-search.vue -->
<script setup lang="ts">
import {computed} from 'vue';
import {$t} from '@/locales';
import {useAntdForm} from '@/hooks/common/form';
import {enableStatusOptions} from '@/constants/business';

defineOptions({ name: 'DeptSearch' });

const emit = defineEmits<{ reset: []; search: [] }>();

const {formRef, validate, resetFields} = useAntdForm();
const model = defineModel<Api.SystemManage.DeptSearchParams>('model', {required: true});

// ⭐ 核心：根据状态决定是否显示负责人字段
const showLeaderField = computed(() => model.value.status !== '2');

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
  <ACard :title="$t('common.search')" class="card-wrapper">
    <AForm ref="formRef" :model="model">
      <ARow :gutter="[16, 16]">
        <ACol :span="24" :md="12" :lg="8">
          <AFormItem :label="$t('page.manage.dept.deptName')" name="deptName">
            <AInput v-model:value="model.deptName"/>
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="8">
          <AFormItem :label="$t('page.manage.dept.status')" name="status">
            <ASelect v-model:value="model.status" :options="enableStatusOptions" clearable/>
          </AFormItem>
        </ACol>
        <!-- ⭐ 条件渲染：v-if 控制字段显示 -->
        <ACol v-if="showLeaderField" :span="24" :md="12" :lg="8">
          <AFormItem :label="$t('page.manage.dept.leader')" name="leader">
            <AInput v-model:value="model.leader"/>
          </AFormItem>
        </ACol>
      </ARow>
      <!-- 按钮区域 -->
    </AForm>
  </ACard>
</template>
```

**为什么用 `computed` 而不是直接在模板写 `v-if="model.status !== '2'"`？**
- 可复用：`showLeaderField` 可以在多个地方使用
- 可测试：纯 computed 可以直接单元测试
- 可扩展：未来如果需要更复杂的逻辑（如多个字段联动），只需修改 computed

#### 任务 D：编辑抽屉（部门类型联动表单字段）

```vue
<script setup lang="ts">
import {ref, watch} from 'vue';
import {useAntdForm, useFormRules} from '@/hooks/common/form';

defineOptions({ name: 'DeptOperateDrawer' });

const props = defineProps<{ operateType: AntDesign.TableOperateType; rowData?: Api.SystemManage.Dept | null }>();
const emit = defineEmits<{ submitted: [] }>();
const visible = defineModel<boolean>('visible', {default: false});

const {formRef, validate, resetFields} = useAntdForm();
const {defaultRequiredRule} = useFormRules();

type Model = Pick<Api.SystemManage.Dept, 'deptName' | 'deptType' | 'leader' | 'status' | 'parentId'>;

const model = ref<Model>(createDefaultModel());

function createDefaultModel(): Model {
  return {deptName: '', deptType: '1', leader: '', status: '1', parentId: undefined};
}

// ⭐ 核心：部门类型决定显示哪些字段
const isBranch = computed(() => model.value.deptType === '2');

const rules: Record<string, App.Global.FormRule> = {
  deptName: defaultRequiredRule,
  deptType: defaultRequiredRule,
  status: defaultRequiredRule
};

function handleInitModel() {
  model.value = createDefaultModel();
  if (props.operateType === 'edit' && props.rowData) {
    Object.assign(model.value, props.rowData);
  }
}

async function handleSubmit() {
  await validate();
  // API 调用...
  emit('submitted');
}

watch(visible, () => {
  if (visible.value) {
    handleInitModel();
    resetFields();
  }
});
</script>

<template>
  <ADrawer v-model:open="visible" :width="360">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem label="部门名称" name="deptName">
        <AInput v-model:value="model.deptName"/>
      </AFormItem>
      <AFormItem label="部门类型" name="deptType">
        <ARadioGroup v-model:value="model.deptType">
          <ARadio value="1">总部</ARadio>
          <ARadio value="2">分支</ARadio>
        </ARadioGroup>
      </AFormItem>
      <!-- ⭐ 分支部门才显示上级部门和负责人 -->
      <AFormItem v-if="isBranch" label="上级部门" name="parentId">
        <ATreeSelect v-model:value="model.parentId" :tree-data="deptTreeData"/>
      </AFormItem>
      <AFormItem v-if="isBranch" label="负责人" name="leader">
        <AInput v-model:value="model.leader"/>
      </AFormItem>
      <AFormItem label="状态" name="status">
        <ARadioGroup v-model:value="model.status">
          <ARadio value="1">启用</ARadio>
          <ARadio value="2">禁用</ARadio>
        </ARadioGroup>
      </AFormItem>
    </AForm>
  </ADrawer>
</template>
```

---

### 第三步：整合与调试

**各模块关系图**：

```
index.vue (页面组装)
  ├─ useTable() —— 表格数据、分页、列控制
  ├─ DeptSearch.vue —— 搜索条件双向绑定 v-model:model
  │   └─ 条件：status === '2' 时隐藏 leader 字段
  ├─ ATable —— 展示数据，expandable 展开详情
  └─ DeptOperateDrawer.vue —— 编辑/新增
      └─ 条件：deptType === '2' 时显示 parentId + leader
```

**调试思路**：
1. 表格不显示数据 → 检查 `apiFn` 是否正确定义、Network 面板看请求是否发出
2. 展开行不生效 → 确认 `row-key="id"` 已设置，且 `expandedRowKeys` 是响应式数组
3. 表单联动不生效 → 检查 `computed` 是否依赖了正确的响应式数据（`model.value.xxx` 而非 `model.xxx`）
4. 校验规则不生效 → 确认 `name` 属性与 `rules` 的 key 一致，且 `validate()` 已调用

---

### 验收标准

- [ ] **能用**：表格正确展示数据，行展开显示详情，表单联动正常（状态控制字段显示、类型控制字段显示）
- [ ] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过，无 `any`，所有字符串用 `$t()`
- [ ] **精进**：
  - [ ] 表格列配置使用 `Record` + `transformRecordToOption` 模式
  - [ ] 表单联动逻辑封装到 `computed`，不在模板写复杂表达式
  - [ ] 抽屉初始化逻辑用 `watch` 统一管理，不分散在多个事件处理中

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `customRender` | 用函数返回任意渲染内容 | JSP 自定义标签 | TSX 是类型安全的，可任意组合逻辑 |
| `effectScope` | 收集作用域内所有副作用，统一停止 | `try-with-resources` | 专为响应式副作用设计，不是 IO 资源 |
| `Record` → `Option` | 单源 truth 生成下拉选项 | `Enum.values()` + Stream | 天然支持 i18n key，类型更严格 |
| CSS 变量主题 | 修改变量即全局生效 | `UIManager.put()` | 运行时声明式，无需重绘组件 |
| 表单联动 `v-if` | 用 `computed` 控制字段显示 | 条件表单项 | 响应式自动更新，无需手动监听事件 |
| `watch(visible, ...)` | 监听状态变化初始化数据 | `@EventListener` | 可在回调中串行执行多个副作用 |

---

## 推荐阅读（10分钟）

1. `src/views/manage/user/index.vue` — 逐行阅读 `customRender` 的实现
2. `src/store/modules/theme/index.ts` — 理解 `effectScope` + `watch` 的组合模式
3. `src/hooks/common/form.ts` — 学习 `createConfirmPwdRule` 中 `toValue(pwd)` 的用法（支持 Ref/ComputedRef/普通值）

---

**明日预告**：第27天 — Axios 与网络请求封装 — 与后端联调（拦截器、错误统一处理、Token 刷新）

> 💡 提示：明日将深入 `@sa/axios` 的封装设计，这是前后端联调的关键一环。建议提前浏览 `src/service/request/` 目录。
