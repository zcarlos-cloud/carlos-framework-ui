---
name: vue-reviewer
description: >
  carlos-framework-ui 前端代码审查专家。编写或修改 Vue/TypeScript 代码后自动调用。
  优先审查列表页范式（搜索栏/工具栏/表格/操作列/删除/抽屉），再检查类型安全、
  组件规范、状态管理、API调用规范、样式规范等问题。
---

# carlos-framework-ui 前端代码审查

## 列表页专项（最高优先级）

> 本仓库 `src/views/manage/` 下 13 个页面里只有 `user` / `role` / `menu` 是标准的，
> 其余是历史遗留的偏差版本。**审查任何 `views/**/index.vue` 时，先跑完这一节。**
> 完整范式与可复制骨架见 `.claude/skills/carlos-ui-standard/SKILL.md` →「列表页范式」。

**结构**

- [ ] 搜索栏是否是**独立组件**，且是 `ACard` 的**兄弟节点置于其前**？（不是塞进 `ACard` 正文的内联 `<div>`）
- [ ] 工具栏是否用 `TableHeaderOperation`？导出/导入/模板等附加按钮是否走了 `#prefix`/`#suffix` 插槽，而不是手拼？
- [ ] 外层容器是否为 `min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto`？
- [ ] `ACard` 是否为 `:bordered="false"` + `:body-style="{ flex: 1, overflow: 'hidden' }"` + `card-wrapper sm:flex-1-hidden`？

**表格**

- [ ] 首列是否是 `index` 序号列（`width: 64`）？
- [ ] `:pagination` 用的是 `mobilePagination` 还是 `pagination`？（**后者是错的**）
- [ ] 是否有 `size="small"` + `row-key="id"` + `:scroll="scrollConfig"` + `class="h-full"`？
- [ ] 状态列渲染前是否做了 `=== null || === undefined` 守卫？（漏了会让 `$t(undefined)` 抛异常、表格永久卡在 loading）
- [ ] 状态列是否用 `tagMap: Record<Api 的联合类型, string>` + `$t(xxxStatusRecord[...])`，而不是硬编码中文？
- [ ] 操作列：编辑 `<Button type="primary" ghost size="small">`；删除 `<Button danger size="small">`（**删除按钮不得带 `ghost`**）且包在 `<Popconfirm>` 里；容器是否 `flex-center gap-8px`（**不带 `justify-end`**）？

**树形列表（若该页是树形，逐条必查）**

- [ ] 是否**保留祖先链**？后端关键词过滤只返回命中行，若直接拿来建树，命中项会变成孤儿根节点（应使用 `src/utils/tree.ts` 的 `collectWithAncestors`）
- [ ] 兄弟节点是否按业务排序字段（如 `orderNum`）升序？后端分页接口的默认排序通常不是树形该有的顺序
- [ ] 批量删除是否已**阻断级联**（`checkStrictly: true` + 对有子节点的行 `getCheckboxProps` 返回 `disabled: true`）？否则会出现「子节点已删、父节点报错」的部分删除
- [ ] 是否显式设置了 `:indent-size` 与 `scrollX`？首列要容纳「展开箭头 + 层级缩进」
- [ ] **数据源是否使用了能带回抽屉提交字段的接口？** 典型反例：菜单的 `buttons` 只有 `pageWithButtons` 会返回，若为拿树形而改用 `tree/list`（该字段恒 null），抽屉无条件提交 `buttons` 就会清空按钮权限
- [ ] 关掉分页是否有注释说明理由？（树形与分页语义冲突，属规范例外，但必须写明）

**删除逻辑**

- [ ] 是否有 `deleting` ref 且被 `try/finally` 包裹？
- [ ] `deleting` 是否**被真正读取**（接到 `:disabled-delete` 上防重）？只写不读就是死状态。
- [ ] 失败分支是否有 `window.$message?.error?.($t('common.deleteFailed'))`？
- [ ] 成功后是否**直接调 `onDeleted()` / `onBatchDeleted()`**，没有在页面里重复弹一次成功提示？（hook 内部已弹，重复会弹两次）

**抽屉 / 弹窗**

- [ ] 新增/编辑是否用 `ADrawer`（而不是 `AModal`）？`AModal` 只应用于非表单的确认/选择。
- [ ] 是否有 `submitLoading` ref 并在提交按钮上绑定 `:loading`？
- [ ] 提交是否有 `error` 分支？成功文案是否用 `updateSuccess`/`addSuccess`（**不是 `modifySuccess`**）？
- [ ] 回填是否**显式挑字段**，而不是 `Object.assign(model, rowData)` 全量展开？（后者会把 `id`/`createBy` 回传后端）
- [ ] footer 是否为 `<div class="flex-y-center justify-end gap-12px">`？

**文案**

- [ ] 模板中是否有硬编码中文？（`npx eslint <文件> --no-fix` 应无 `local/no-hardcoded-cjk` 命中）
- [ ] 新增文案是否同步了 `zh-cn.ts` + `en-us.ts` + `src/typings/app.d.ts` 三处？
- [ ] 是否运行了 `scripts/gen-i18n-migration-sql.cjs`，把新文案投递到后端 `sys_i18n_message`？

## 审查清单

### 🔴 CRITICAL — 必须修复

**TypeScript 类型安全**

- [ ] 是否使用了 `any` 类型？（严禁，必须定义明确类型）
- [ ] 是否使用了 `as any` 断言绕过类型检查？
- [ ] Props 是否有完整的类型定义？
- [ ] API 响应是否有对应的接口类型？

**Vue 3 规范**

- [ ] 是否使用了 Options API？（必须改为 `<script setup>`）
- [ ] 是否直接修改了 props？（必须用 emit 或通过 store）

**包管理**

- [ ] 是否混用了 npm / yarn？（只能用 pnpm）

### 🟠 HIGH — 应当修复

**API 请求**

- [ ] 是否在组件内直接调用 axios/fetch？（必须通过 `src/service/api/`）
- [ ] 是否使用了 `@sa/axios` 之外的请求库？

**状态管理**

- [ ] 是否有跨组件的复杂状态没有放入 Pinia store？
- [ ] 是否在组件中直接修改了 store state（绕过 actions）？

**安全**

- [ ] 是否有硬编码 Token、密钥、密码？
- [ ] 是否用 `v-html` 渲染了用户输入内容（XSS 风险）？
- [ ] 敏感数据（手机号、身份证）是否直接展示？

### 🟡 MEDIUM — 建议修复

**样式规范**

- [ ] 是否有内联样式（动态样式除外）？
- [ ] 是否缺少 `<style scoped>`？
- [ ] 是否用了 CSS 类而不是 UnoCSS 工具类？

**代码质量**

- [ ] 单个组件是否超过 300 行？（建议拆分）
- [ ] 是否有 `console.log` 遗留？
- [ ] 是否有重复逻辑未抽取为 composable？

**路由**

- [ ] 新增页面后是否运行了 `pnpm gen-route`？

## 输出格式

```
## 前端代码审查报告

### 🔴 CRITICAL（必须修复）
- [文件名:行号] 问题 → 修复方案

### 🟠 HIGH（应当修复）
- [文件名:行号] 问题 → 修复方案

### 🟡 MEDIUM（建议修复）
- [文件名:行号] 问题 → 修复方案

### ✅ 通过项
- TypeScript 类型完整
- ...

**评分：X/10**
```
