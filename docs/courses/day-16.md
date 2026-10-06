# 今日前端课程 — 第16天：表单处理与验证 — 与 Ant Design Vue 结合

> **学习目标**
> - **能读**：看懂 `user-operate-drawer.vue` 中表单的状态管理、验证规则配置、提交逻辑
> - **能用**：独立使用 `AForm` + `AFormItem` + `rules` 实现一个带验证的 CRUD 表单
> - **规范**：符合 `useAntdForm` / `useFormRules` 封装范式，零 `any`，类型完整
> - **精进**：理解 `computed` 规则为何能解决国际化切换时规则文本不更新问题；理解 `defineModel` 双向绑定的替代方案优劣
    > ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + Ant Design Vue 4 + Pinia + UnoCSS

---

## 理论学习

### 核心知识点

1. **Ant Design Vue 表单三件套**：`AForm`（容器）+ `AFormItem`（字段包装）+ `rules`（验证规则）
    - `AForm` 的 `ref` 是 `FormInstance`，用于调用 `validate()` / `resetFields()`
    - `AFormItem` 的 `name` 对应 `model` 的字段路径，支持嵌套（如 `name="user.phone"`）
    - `rules` 可以是数组或对象，每个字段对应一个 `Rule[]` 或单个 `Rule`

2. **Vue 3 表单状态管理**：`ref` 或 `reactive` 定义 `model`，`v-model:value` 绑定字段
    - 与 Vue 2 的区别：Vue 3 中 `v-model` 需要显式写 `v-model:value`，AntDV 的 `AInput` 等组件未使用默认 `v-model`
    - `reactive` 适合扁平对象，`ref` 适合需要整体替换的场景（如搜索表单重置）

3. **自定义验证规则（Validator）**
    - 同步：`{ validator: (rule, value) => value.length > 0 }`
    - 异步：`{ validator: (rule, value) => Promise.resolve() / Promise.reject() }`
    - 动态依赖：`computed` 返回 `rules`，确保依赖字段变更时规则重新生成（见 `register.vue` 的密码确认规则）

4. **表单封装 Hook：`useAntdForm` + `useFormRules`**
    - `useAntdForm`：统一封装 `formRef`、`validate()`、`resetFields()`
    - `useFormRules`：统一封装必填规则、正则规则、密码确认规则等
    - 避免每个表单组件重复手写 `ref<FormInstance | null>(null)` 和 `async function validate() { ... }`

5. **`defineModel` 在表单场景中的价值**
    - `visible = defineModel<boolean>('visible', { default: false })` — 替代 `props + emits('update:visible')`
    - `model = defineModel<Api.SystemManage.UserSearchParams>('model', { required: true })` — 父子组件共享搜索条件对象
    - 注意：如果父组件传入的是 `reactive` 对象，`defineModel` 拿到的也是同一个引用，修改会直接影响父组件

### Java 思维类比

> | 前端概念 | Java 类比 | 说明 |
> |---------|----------|------|
> | `AForm` + `rules` | `Validator` + `BindingResult` | 表单容器 + 验证规则集 |
> | `FormInstance.validate()` | `validator.validate(target)` | 触发验证，返回 Promise（类似异步校验） |
> | `useAntdForm` Hook | `BaseFormController` 抽象类 | 抽取公共表单操作（验证、重置） |
> | `useFormRules` | `ValidationUtils` 工具类 | 统一定义可复用的规则（正则、必填） |
> | `reactive` Model | `Bean` / `POJO` 实例 | 对象属性双向绑定，修改即反映到视图 |
> | `computed(() => rules)` | `Supplier<ValidationRule[]>` | 依赖变化时重新生成规则（如密码确认依赖密码字段） |
> | `defineModel` | Lombok `@Data` 或 Spring `@RequestBody` 自动注入 | 简化父子双向绑定，但本质仍是引用传递 |

### 超越类比 — 前端独有的设计哲学

> 1. **声明式验证 vs 命令式验证**：Java 的 Bean Validation 通常是在 Controller 层一次性校验，前端是"用户每输入一个字符都可能触发校验"（`trigger: 'change'` / `trigger: 'blur'`）。这是响应式 UI 的必然结果——验证不是提交时的"检查点"，而是贯穿交互的"实时反馈"。
> 2. **`computed` 规则是前端特有**：Java 的验证规则一旦定义就是静态的，但前端需要根据另一个字段的值动态调整规则（如密码确认必须等于密码）。`computed(() => rules)` 让规则本身成为响应式数据——这是 Vue 的依赖追踪系统带来的能力，不是简单的语法糖。
> 3. **`resetFields()` 的设计差异**：Java 没有"重置表单到初始状态"的需求，因为服务端渲染是无状态的。前端表单需要 `resetFields()` 来恢复初始值——这是有状态 UI 的代价，也是为什么 `reactive` 需要配合 `createDefaultModel()` 函数来创建新的初始状态副本。
> 4. **Hook 封装比继承更灵活**：Java 中你可能会写一个 `BaseFormController<T>` 抽象类让所有表单继承。但 Vue 中用的是组合——`useAntdForm()` 可以在任何组件中被调用，不限定继承关系，不引入隐式耦合。这是组合优于继承（Composition over Inheritance）的极致体现。

---

## carlos-framework-ui 源码阅读 + 规范评审

### 目标文件

1. **`src/hooks/common/form.ts`** — 表单通用 Hook 封装（`useAntdForm`、`useFormRules`）
2. **`src/views/manage/user/modules/user-operate-drawer.vue`** — 用户 CRUD 表单（抽屉模式）
3. **`src/views/_builtin/login/modules/register.vue`** — 注册表单（含动态规则联动）
4. **`src/views/manage/user/modules/user-search.vue`** — 搜索表单（多条件 + `defineModel`）

### 阅读指引

1. **先看 `form.ts`**：这是整个项目表单的"基座"。理解 `useAntdForm` 返回什么，`useFormRules` 为什么同时返回 `patternRules` 和 `formRules`（前者单条，后者 `required + pattern` 组合）。
2. **再看 `user-operate-drawer.vue`**：理解 `defineModel` 控制抽屉显隐，`Pick<>` 提取需要的字段，`watch(visible, ...)` 在打开时初始化模型并拉取角色列表。
3. **对比 `register.vue`**：注意 `rules` 是 `computed`，因为 `confirmPassword` 的规则依赖 `model.password`；`model` 用 `reactive` 而非 `ref`。
4. **最后看 `user-search.vue`**：注意 `model = defineModel(...)` 的用法，这是父子组件共享搜索条件的高级模式；规则放在 `computed` 中使 `$t` 响应式切换。

### 规范评审清单

| 检查项   | 标准                                                       | 该文件是否达标？                                                                                                                        |
|-------|----------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| 命名规范  | 文件kebab-case、函数camelCase、组件PascalCase、常量UPPER_SNAKE_CASE | ✅ `user-operate-drawer.vue` / `useAntdForm` / `REG_PHONE`                                                                       |
| 类型完整性 | 零any，所有参数/返回值有类型                                         | ✅ `formRef: ref<FormInstance \| null>`、`Model: Pick<...>`、`rules: Record<RuleKey, App.Global.FormRule>`                         |
| 目录规范  | 文件放在正确目录                                                 | ✅ `hooks/common/form.ts` 在通用Hooks目录；`user-operate-drawer.vue` 在 `modules/` 子目录                                                  |
| 导入顺序  | type导入 → 第三方库 → 内部模块 → 相对路径                              | ✅ 所有文件遵循：1) `import type` 2) `vue` 3) `ant-design-vue` 4) `@/` 内部模块                                                             |
| 错误处理  | 异步有try/catch或统一拦截                                        | ⚠️ `getRoleOptions()` 有 `if (!error)` 但无 `else` 处理失败场景；`handleSubmit` 无 `try/catch`（`validate()` 失败会抛异常，但 `await` 已在调用处处理）      |
| 可测试性  | 纯函数可单测，副作用可mock                                          | ✅ `createDefaultModel()`、`createRequiredRule()` 是纯函数；`useAntdForm` 返回的函数可测试；`useCaptcha` 的 `getCaptcha` 依赖全局 `$message`，需要 mock |
| 国际化   | 用户可见字符串使用 `$t()`                                         | ✅ 所有表单标签、占位符、提示文字均使用 `$t()`，无硬编码中文                                                                                              |

### 评审亮点与改进建议

- **亮点 1**：`useFormRules` 用 `satisfies` 关键字（TS 4.9+）同时保证类型推断和类型约束，既不用写冗长的 `: Record<string, App.Global.FormRule>` 又能获得类型检查。
- **亮点 2**：`RuleKey = Extract<keyof Model, 'userName' | 'status'>` 使用类型工具精确提取需要的字段，避免 `rules` 类型过宽。
- **改进 1**：`user-operate-drawer.vue` 第 41 行的 `model.value.userRoles.map` 那段注释是 mock 数据填充，真实项目中应该删除。这也是 TODO 管理的反面教材——遗留 mock 代码。
- **改进 2**：`user-operate-drawer.vue` 的 `handleSubmit` 中 `window.$message?.success()` 之后直接 `emit('submitted')`，如果 API 请求失败（虽然现在注释掉了），成功消息已经发出，逻辑上有"先报喜后做事"的风险。正确顺序：API 成功 → 成功消息 → 关闭抽屉 → 通知父组件刷新。
- **改进 3**：`register.vue` 的 `model` 用 `reactive`，但 `rules` 用 `computed` 返回 `Record<keyof FormModel, ...>`。如果 `FormModel` 字段增多，`keyof` 会包含所有字段，但 `rules` 实际上可能只配置了部分字段。用 `Record<keyof FormModel, ...>` 会强制要求每个字段都有规则，这一点 `register.vue` 确实满足，但 `user-operate-drawer.vue` 用 `Extract<keyof Model, ...>` 更精确。

---

## 功能实践 — 分三步

### 第一步：需求分析与拆解

**目标**：实现一个"角色管理"的新增/编辑表单抽屉，包含以下字段：

| 字段              | 类型         | 验证           | 组件                 |
|-----------------|------------|--------------|--------------------|
| roleName        | string     | 必填，4-20字符    | AInput             |
| roleCode        | string     | 必填，英文+数字+下划线 | AInput             |
| roleDesc        | string     | 可选，0-100字符   | AInput.TextArea    |
| status          | '1' \| '2' | 必填           | ARadioGroup（启用/禁用） |
| menuPermissions | string[]   | 可选           | ATree（菜单树，多选）      |

**拆解为 5 个小任务**：

1. 定义 `Model` 类型和 `createDefaultModel()` 函数
2. 使用 `useAntdForm` + `useFormRules` 配置表单验证
3. 实现抽屉组件，用 `defineModel` 控制显隐
4. 实现 `watch(visible, ...)` 初始化模型和拉取菜单树
5. 实现 `handleSubmit`：验证 → 调 API → 成功消息 → 关闭 → 通知父组件

### 第二步：小任务开发（参考源码写法）

#### 任务 1：定义 Model 类型

```typescript
// 在组件文件顶部
interface Props {
  operateType: AntDesign.TableOperateType;
  rowData?: Api.SystemManage.Role | null;
}

type Model = Pick<
  Api.SystemManage.Role,
  'roleName' | 'roleCode' | 'roleDesc' | 'status' | 'menuPermissions'
>;

function createDefaultModel(): Model {
  return {
    roleName: '',
    roleCode: '',
    roleDesc: '',
    status: '1',
    menuPermissions: []
  };
}
```

> **为什么用 `Pick<>`？** 后端返回的 `Role` 可能有 `id`、`createTime`、`updateTime` 等字段，但表单只需要编辑其中 5 个。`Pick` 让类型精确描述"表单关心的子集"，避免在 `model` 中定义无关字段。

#### 任务 2：配置验证规则

```typescript
import {useAntdForm, useFormRules} from '@/hooks/common/form';

const {formRef, validate, resetFields} = useAntdForm();
const {defaultRequiredRule, createRequiredRule} = useFormRules();

type RuleKey = Extract<keyof Model, 'roleName' | 'roleCode' | 'status'>;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  roleName: [
    defaultRequiredRule,
    {max: 20, message: $t('form.roleName.max'), trigger: 'change'}
  ],
  roleCode: [
    defaultRequiredRule,
    {
      pattern: /^[a-zA-Z0-9_]{4,20}$/,
      message: $t('form.roleCode.invalid'),
      trigger: 'change'
    }
  ],
  status: [defaultRequiredRule]
};
```

> **注意**：`roleDesc` 和 `menuPermissions` 是可选字段，不需要放入 `RuleKey`。`App.Global.FormRule` 是项目定义的统一规则类型，在 `src/typings/app.d.ts` 中声明。

#### 任务 3：抽屉组件骨架

```vue

<template>
  <ADrawer v-model:open="visible" :title="title" :width="360">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <!-- 表单项 -->
    </AForm>
    <template #footer>
      <ASpace :size="16">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</AButton>
      </ASpace>
    </template>
  </ADrawer>
</template>
```

> **PascalCase 组件标签**：`<ADrawer>`、`<AForm>` 是 Ant Design Vue 的组件，在模板中使用 PascalCase 引用，符合项目规范（`vue/component-name-in-template-casing`）。

#### 任务 4：watch 初始化

```typescript
const visible = defineModel<boolean>('visible', {default: false});

function handleInitModel() {
  model.value = createDefaultModel();
  if (props.operateType === 'edit' && props.rowData) {
    Object.assign(model.value, props.rowData);
  }
}

watch(visible, () => {
  if (visible.value) {
    handleInitModel();
    resetFields();
    fetchMenuTree(); // 拉取菜单树
  }
});
```

> **为什么先 `handleInitModel()` 再 `resetFields()`？** `resetFields()` 会将表单字段重置到 `model` 的**当前值**（不是 `createDefaultModel()` 的初始值）。如果先 `resetFields()` 再赋值，`resetFields()` 会重置到上一次的 `model`，然后 `Object.assign` 覆盖为当前值，但 `resetFields` 的字段标记（如 `isFieldTouched`）不会正确清理。正确顺序：先赋值 → 再 `resetFields`，让 `resetFields` 以新 `model` 为基准恢复。

#### 任务 5：提交逻辑

```typescript
async function handleSubmit() {
  await validate(); // 验证失败会抛异常，函数中断

  // 调用 API（需要根据 operateType 区分 add/edit）
  const apiFn = props.operateType === 'add' ? fetchAddRole : fetchUpdateRole;
  const {error} = await apiFn(model.value);

  if (error) {
    return; // 错误已在 request 拦截器中统一提示
  }

  window.$message?.success(
    props.operateType === 'add' ? $t('common.addSuccess') : $t('common.updateSuccess')
  );
  closeDrawer();
  emit('submitted');
}
```

> **为什么 API 错误不需要 `try/catch`？** 因为 `request` 封装层（`src/service/request/index.ts`）已经统一处理 HTTP 错误和业务错误码，返回 `{error, data}` 格式。组件层只需判断 `if (error)` 即可。这是项目约定的"错误拦截在前，业务逻辑在后"模式。

### 第三步：整合与测试

将上述 5 个任务整合到 `src/views/manage/role/modules/role-operate-drawer.vue`（与项目现有结构对齐）。

**测试清单**：

1. 打开抽屉：字段应显示默认值（新增）或传入数据（编辑）
2. 留空提交：触发必填验证，显示错误提示
3. 输入非法 roleCode：触发正则验证
4. 切换操作类型：从编辑切换到新增，数据应重置
5. 提交成功：显示成功消息，抽屉关闭，父组件刷新列表

**调试思路**：

- 表单不验证？检查 `AFormItem` 的 `name` 是否与 `model` 字段名完全一致（区分大小写）
- 验证规则不生效？检查 `rules` 的 key 是否包含在 `RuleKey` 中（类型不匹配会被 TS 检查出来）
- `resetFields` 无效？检查是否先赋值后调用 `resetFields`

---

## 今日重点记忆卡

| 概念                      | 一句话                                       | Java类比                                 | 前端独有                                       |
|-------------------------|-------------------------------------------|----------------------------------------|--------------------------------------------|
| `AForm` + `rules`       | 声明式验证配置                                   | JSR-303 Bean Validation                | 实时触发（`change`/`blur`），不是提交时一次性校验           |
| `useAntdForm`           | 封装 `formRef` + `validate` + `resetFields` | BaseFormController 抽象                  | 组合式注入，无继承耦合，任何组件都能用                        |
| `computed(() => rules)` | 响应式规则生成                                   | `Supplier<ValidationRule>`             | 规则本身依赖响应式数据，数据变规则自动重新计算                    |
| `defineModel`           | 父子双向绑定语法糖                                 | Lombok `@Data` + Spring `@RequestBody` | 自动处理 `update:modelValue`，减少样板代码            |
| `reactive` Model        | 对象级别的响应式追踪                                | `ObservableMap` / `BeanWrapper`        | 对象属性直接修改即触发视图更新，无需 `setter` 方法             |
| `resetFields`           | 恢复到当前 model 的初始值                          | 无直接对应（服务端无状态）                          | 前端有状态 UI 必需，需要配合 `createDefaultModel()` 重置 |
| `satisfies`             | 类型推断 + 约束并存                               | 无直接对应（编译器特性）                           | TS 4.9+ 关键字，让对象既有类型推断又有类型检查                |

---

## 补充阅读：表单相关的底层 Hook 解析

### `src/hooks/common/form.ts` 逐行解析

```typescript
export function useAntdForm() {
  const formRef = ref<FormInstance | null>(null);  // 绑定到 <AForm ref="formRef"> 的模板引用

  async function validate() {
    await formRef.value?.validate();  // 可选链 + await，如果 ref 未挂载则静默失败
  }

  function resetFields() {
    formRef.value?.resetFields();  // 可选链，同样处理未挂载情况
  }

  return {formRef, validate, resetFields};
}
```

> **为什么用 `ref<FormInstance | null>` 而不是 `shallowRef`？** `FormInstance` 是 AntDV 提供的组件实例对象，其内部不包含深层响应式数据，用 `ref` 足够。`shallowRef` 更适合存储大对象列表（如表格数据）。

### `useFormRules` 的设计巧思

```typescript
const patternRules = {
  phone: {pattern: REG_PHONE, message: $t('form.phone.invalid'), trigger: 'change'}
} satisfies Record<string, App.Global.FormRule>;
```

> `satisfies` 的精妙之处：不写 `: Record<string, App.Global.FormRule>` 时，`phone` 的 key 会被推断为字面量 `'phone'`，而不是宽泛的 `string`。后续 `patternRules.phone` 能获得精确类型提示。同时 `satisfies` 保证右侧对象符合 `Record<string, App.Global.FormRule>` 的结构约束。

```typescript
function createConfirmPwdRule(pwd: string | Ref<string> | ComputedRef<string>) {
  // ...
  if (value !== toValue(pwd)) {  // Vue 3.3+ 的 toValue：统一解包 ref/reactive/原始值
    return Promise.reject(rule.message);
  }
}
```

> `toValue` 是 Vue 3.3 引入的 API，替代了 `unref` 的升级版——它不仅能解包 `ref`，还能处理 `computed` 和 getter 函数。这里参数类型接受 `string | Ref<string> | ComputedRef<string>`，让调用者可以传入 `model.password`（reactive 的属性，原始值）、`refPwd.value`（ref 的值）或 `computedPwd`（计算属性）。

---

**明日预告**：第17天 — 自定义指令与插件 — 实现 `v-permission` 权限指令
