# 今日前端课程 — 第37天：ESLint 与代码规范 — 前端世界的"Checkstyle + SonarQube"

> **学习目标**
> - 能读：理解 ESLint 9 扁平配置体系，读懂项目中 `eslint.config.js` 的每一行
> - 能用：能独立新增/修改 ESLint 规则，用 `pnpm lint` 自动修复代码
> - 规范：理解项目规范背后的设计意图——为什么"命名规范"能提升团队协作效率
> - 精进：能设计自定义 ESLint 规则，将团队编码习惯固化为自动化检查
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：ESLint 9 + @soybeanjs/eslint-config + Vue + TypeScript + simple-git-hooks + lint-staged

---

## 理论学习

### 核心知识点

#### 1. ESLint 是什么？——前端的第一道质量关卡

ESLint 是 JavaScript/TypeScript/Vue 的**静态代码分析工具**。它像 Java 世界的 Checkstyle + FindBugs + PMD 三合一：

| 职责 | Java 工具 | ESLint 等价 |
|------|----------|------------|
| 代码风格检查 | Checkstyle | ESLint 风格规则 |
| Bug 模式发现 | FindBugs/SpotBugs | ESLint 逻辑规则 |
| 最佳实践提醒 | PMD | ESLint 最佳实践规则 |
| 自动修复 | 无内置 | `eslint --fix` |

**核心能力**：
- **解析（Parse）**：将源码转为 AST（抽象语法树）
- **遍历（Traverse）**：遍历 AST 节点，用规则检查
- **报告（Report）**：输出警告/错误列表
- **修复（Fix）**：自动修正可自动修复的问题

#### 2. ESLint 9 扁平配置（Flat Config）—从 `.eslintrc` 到 `eslint.config.js`

**历史演进**：

```
.eslintrc.js (JSON/YAML）  →  eslint.config.js（Flat Config）
    嵌套/继承复杂                   扁平数组，逻辑清晰
    多个文件打架                    单一入口
    extends 链式                   直接组合
```

ESLint 9.x 默认只支持扁平配置。carlos-ui 使用的就是这种：

```javascript
// carlos-ui/eslint.config.js
import {defineConfig} from '@soybeanjs/eslint-config';

export default defineConfig(
  // 第一个参数：preset 配置
  {vue: true, unocss: true},
  // 第二个参数：自定义规则覆盖
  {
    rules: {
      'vue/multi-word-component-names': [
        'warn',
        {ignores: ['index', 'App', 'Register', '[id]', '[url]']}
      ],
      'vue/component-name-in-template-casing': [
        'warn',
        'PascalCase',
        {registeredComponentsOnly: false, ignores: ['/^icon-/']}
      ],
      'unocss/order-attributify': 'off'  // 关闭 UnoCSS attributify 顺序检查
    }
  }
);
```

**Java 类比**：

```
defineConfig({vue: true, unocss: true}, { rules: {...} })
     ≈
<parent>spring-boot-starter-parent</parent>
<properties><!-- 覆盖属性 --></properties>
```

**每一行拆解**：

| 行 | 含义 | Java 类比 |
|----|------|----------|
| `import {defineConfig}` | 从 @soybeanjs/eslint-config 导入配置工厂 | `@Import(DefaultAutoConfiguration.class)` |
| `{vue: true}` | 启用 Vue 专用规则（eslint-plugin-vue） | `@EnableVueSupport` |
| `{unocss: true}` | 启用 UnoCSS 专用规则（@unocss/eslint-config） | `@EnableCssLint` |
| `rules: {...}` | 项目级别的规则覆盖 | `<properties>` 覆盖父 POM 版本号 |
| `'vue/multi-word-component-names': ['warn', ...]` | 组件名必须多词（如 `UserSearch`），但 `index`/`App` 等除外 | Checkstyle 模块 + suppression |
| `'vue/component-name-in-template-casing': ['warn', 'PascalCase', ...]` | 模板中组件名用 PascalCase：`<UserSearch>` 而非 `<user-search>` | 命名约定检查 |
| `'unocss/order-attributify': 'off'` | 关闭 attributify 属性顺序检查（太严格） | `@SuppressWarnings` |

**规则严重级别**：

| 级别 | 含义 | Java 类比 |
|------|------|----------|
| `'off'` / `0` | 关闭规则 | 注释掉 Checkstyle 检查项 |
| `'warn'` / `1` | 警告（不阻断） | `severity: warning` |
| `'error'` / `2` | 错误（阻断构建） | `severity: error` |

#### 3. 规则配置语法

```javascript
// 简单规则：直接指定级别
'no-console': 'warn'

// 带选项的规则
'vue/multi-word-component-names': [
  'warn',          // 级别
  {                // 选项（规则相关）
    ignores: ['index', 'App']
  }
]

// 关闭规则
'unocss/order-attributify': 'off'
```

#### 4. 为什么需要 Git Hooks？— 把规范"铆"进提交流程

仅靠 ESLint 不够——开发者可能忘记运行 `pnpm lint`。Git Hooks 在关键节点**强制执行**：

```
git commit 触发
    ↓
pre-commit hook: pnpm typecheck && pnpm lint-staged
    ↓                     ↓
 TypeScript 检查     lint-staged 对暂存文件跑 eslint --fix
    ↓                     ↓
失败 → 阻止提交        失败 → 阻止提交（但先自动修复）
```

**carlos-ui 的 Git Hooks 配置**（来自 `package.json`）：

```json
{
  "simple-git-hooks": {
    "commit-msg": "pnpm sa git-commit-verify",
    "pre-commit": "pnpm typecheck && pnpm lint-staged"
  },
  "lint-staged": {
    "*": "eslint --fix"
  }
}
```

**Java 类比**：

```
pre-commit hook ≈ Maven verify phase
    ├── typecheck ≈ mvn compile（语法检查）
    └── lint-staged ≈ mvn checkstyle:check + spotbugs:check（代码质量）

commit-msg hook ≈ GitLab merge request 的 commit message 检查
    └── git-commit-verify ≈ Conventional Commits 格式校验
```

#### 5. 提交时自动修复（lint-staged）

`lint-staged` 只对 **git 暂存区**（staged）文件运行，而不是全部文件：

```javascript
// carlos-ui 配置
"lint-staged": {
  "*": "eslint --fix"
}
```

**好处**：
- 速度快——只检查改动的文件
- 自动修复——`--fix` 自动修正可修复的问题
- 可扩展——可以给不同文件类型配置不同命令

```
"lint-staged": {
  "*.{js,ts,vue}": "eslint --fix",
  "*.scss": "stylelint --fix"
}
```

#### 6. Conventional Commits 规范

carlos-ui 强制使用 Conventional Commits 格式：

```
<type>(<scope>): <description>

feat(auth): 新增登录验证码功能
fix(table): 修复分页重置后页码错误
docs(course): 前端每日课程 Day37
```

**@sa/scripts 的校验逻辑**（源码位于 `packages/scripts/src/commands/git-commit.ts`）：

```typescript
// 核心正则——解析 Conventional Commits
const REG_EXP = /(?<type>[a-z]+)(?:\((?<scope>.+)\))?(?<breaking>!)?: (?<description>.+)/i;

// 不匹配 → 报错阻止提交
if (!REG_EXP.test(commitMsg)) {
  throw new Error(errorMsg);
}
```

**Type 含义速查**：

| Type | 含义 | 触发场景 |
|------|------|---------|
| `feat` | 新功能 | 新增一个按钮/页面/组件 |
| `fix` | 修复 Bug | 修了一个错误 |
| `docs` | 文档 | 只改文档/注释 |
| `style` | 格式 | 空格、缩进、分号（不影响逻辑） |
| `refactor` | 重构 | 既非 feat 也非 fix 的代码优化 |
| `perf` | 性能优化 | 提升性能的改动 |
| `test` | 测试 | 添加/修改测试 |
| `build` | 构建 | 改 Vite/webpack 配置 |
| `ci` | CI/CD | 改 CI 流水线 |
| `chore` | 杂项 | 依赖更新、脚本修改等 |
| `revert` | 回滚 | 撤销之前的提交 |

**`!` 标记破环性变更**：

```
feat(api)!: 重构登录接口响应格式
```

---

### Java 思维类比

```
ESLint 体系 ≈ Checkstyle + FindBugs + PMD + 自动修复
    │
    ├── eslint.config.js     ≈ checkstyle.xml + findbugs.xml
    ├── pnpm lint            ≈ mvn checkstyle:check
    ├── pre-commit hook      ≈ mvn verify（在编译后的验证阶段）
    ├── commit-msg hook      ≈ GitLab push rules（提交信息校验）
    └── lint-staged          ≈ 针对 git diff 的增量检查
```

> 核心差异：Java 的静态分析运行**慢**（JVM 启动 + 全量扫描），ESLint 在 Vite/Node.js 环境下**秒级**完成，配合 lint-staged 只检查变更文件，几乎无感知。

---

### 超越类比 — 前端独有的设计哲学

**1. 前端代码检查必须处理多种语⾔**：

Java 只需要检查 `.java`。前端需要检查 `.js`、`.ts`、`.vue`、`.css`、`.scss`、`.json`、`.md`……每种文件有不同的解析器和规则集。ESLint 通过 **parser 插件**实现多语言支持：

```
*.js     → espree (自带)
*.ts     → @typescript-eslint/parser
*.vue    → vue-eslint-parser（先解析 SFC，再分发给 JS/TS/HTML 解析器）
*.json   → jsonc-eslint-parser
```

**2. 自动修复（Auto-fix）是前端特色——维护代码的一致性**：

不像 Checkstyle 只会报错，ESLint 能**自动修复**大部分风格问题：
- 缩进不对 → 自动调整
- 分号缺了 → 自动补
- 引号不一致 → 自动统一
- 导入排序 → 自动重排

**3. 前端规范必须考虑模板（Template）和样式**：

Vue SFC 文件一个文件包含 `<script>` + `<template>` + `<style>`，ESLint 要理解三种语言的上下文。例如：
```vue
<script setup lang="ts">
// eslint-plugin-vue 知道这是 TS 代码
const count = ref(0)
</script>

<template>
  <!-- eslint-plugin-vue 知道这是 HTML模板，检查 v-for 必须有 :key -->
  <div v-for="item in list" :key="item.id">{{ item.name }}</div>
</template>
```

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

- `eslint.config.js` — ESLint 主配置
- `packages/scripts/src/commands/git-commit.ts` — Git 提交工具链
- `package.json` — 查看 `simple-git-hooks`、`lint-staged` 配置
- `src/utils/common.ts` — 对照规范检查代码

### 阅读指引

**1. 先看 `eslint.config.js` 的整体结构**：

```javascript
import {defineConfig} from '@soybeanjs/eslint-config';        // 工厂函数
export default defineConfig(                                    // 导出配置
  {vue: true, unocss: true},                                   // 预设开关
  {rules: { ... }}                                              // 项目覆盖
);
```

`defineConfig` 是工厂模式——类似 Java 的 Builder 模式，传入参数生成完整配置。好处是：
- 屏蔽底层 ESLint 扁平配置的复杂结构
- 通过布尔开关控制模块（`vue: true` → 拉入 eslint-plugin-vue）
- 项目只需关注覆盖部分

**2. 仔细看三条自定义规则**：

- `vue/multi-word-component-names`：防止单名组件与 HTML 元素冲突。但 `index`、`App`、`Register` 是合法例外（入口组件/动态路由参数）
- `vue/component-name-in-template-casing`：模板中用 PascalCase，但 `<icon-*>` 忽略（Iconify 图标约定）
- `unocss/order-attributify: off`：如果启用，UnoCSS attributify 属性必须按特定顺序排列，太严格，关闭

**3. 看 `git-commit.ts` 的校验逻辑**：

使用**正则命名捕获**解析提交信息：
```typescript
const REG_EXP = /(?<type>[a-z]+)(?:\((?<scope>.+)\))?(?<breaking>!)?: (?<description>.+)/i;
```

这种模式来自 ES2018 的命名捕获组——Java 7+ 也有类似语法。

**4. 对照规范检查 `src/utils/common.ts`**：

```
✅ 文件命名：camelCase — 符合规范
✅ 函数导出：export function — 可 Tree Shaking
✅ JSDoc 注释：@example + @param — 完整
✅ 类型完整：T extends Record<string, string> — 泛型约束
✅ 无 any：没有 any 逃逸
```

### 规范评审清单

| 检查项 | 标准 | `src/utils/common.ts` 是否达标？ |
|--------|------|-------------------------------|
| 命名规范 | 文件 camelCase、函数 camelCase | ✅ `common.ts`、`transformRecordToOption` |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ 泛型 `<T extends Record<string, string>>` |
| 目录规范 | 放在 `src/utils/` 下 | ✅ |
| 导入顺序 | type导入 → 第三方库 → 内部模块 → 相对路径 | ✅ `import {$t} from '@/locales'` |
| 错误处理 | 所有异步有 try/catch 或统一拦截 | ✅ 纯函数，无异步 |
| 可测试性 | 纯函数可单测 | ✅ 都是纯函数，易于单测 |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ `translateOptions` 使用 `$t()` |
| JSDoc | 导出函数有注释 | ✅ `@example` + `@param` 完整 |

---

## 功能实践 — 分三步

### 第一步：分析——"禁止 console.log" 需求拆解

**背景**：carlos-ui 目前没有禁止 `console.log` 的规则。在生产代码中，`console.log` 会泄露调试信息、影响性能、降低代码专业性。

**需求拆解**：

| 子任务 | 内容 | 技术点 |
|--------|------|--------|
| ① 新增规则 | 在 `eslint.config.js` 中添加 `no-console: 'warn'` | ESLint 内置规则 |
| ② 验证 | `pnpm lint` 看效果 | CLI 使用 |
| ③ 例外处理 | `console.error` 和 `console.warn` 保留（用于错误上报） | 规则选项 `allow` |
| ④ 修复 | 删除或替换现有 `console.log` | 手动 + lint 自动提示 |

### 第二步：小任务开发

#### 子任务 ①：新增 `no-console` 规则

在 `eslint.config.js` 的 `rules` 对象中添加：

```javascript
// carlos-ui/eslint.config.js
import {defineConfig} from '@soybeanjs/eslint-config';

export default defineConfig(
  {vue: true, unocss: true},
  {
    rules: {
      'vue/multi-word-component-names': [
        'warn',
        {ignores: ['index', 'App', 'Register', '[id]', '[url]']}
      ],
      'vue/component-name-in-template-casing': [
        'warn',
        'PascalCase',
        {registeredComponentsOnly: false, ignores: ['/^icon-/']}
      ],
      'unocss/order-attributify': 'off',

      // ⬇️ 新增：禁止 console.log（但允许 error/warn）
      'no-console': [
        'warn',
        {allow: ['error', 'warn']}  // console.error / console.warn 保留
      ]
    }
  }
);
```

**为什么这样写？**
- `'warn'`：先警告不阻断——给团队缓冲期
- `allow: ['error', 'warn']`：`console.error` 用于错误上报是合理的，不能一刀切禁止
- `no-console` 是 ESLint 内置规则，不需要装插件

#### 子任务 ②：运行 `pnpm lint` 验证

```bash
cd carlos-ui
pnpm lint
```

**预期输出**：

```
warning  Unexpected console statement  no-console
```

如果有 `console.log`，ESLint 会警告并尝试自动修复（但 `no-console` 不支持 auto-fix，需要手动处理）。

#### 子任务 ③：添加更多常用规则

一个生产级项目的 ESLint 规则补充：

```javascript
rules: {
  // --- 代码质量 ---
  'no-console': ['warn', {allow: ['error', 'warn']}],
  'no-debugger': 'error',                    // 禁止 debugger 语句
  'no-unused-vars': 'warn',                  // 未使用变量警告
  'prefer-const': 'warn',                    // 优先使用 const

  // --- Vue 专项 ---
  'vue/require-v-for-key': 'error',          // v-for 必须带 :key
  'vue/no-v-html': 'warn',                   // v-html 有 XSS 风险，警告

  // --- TypeScript 专项 ---
  '@typescript-eslint/no-explicit-any': 'warn',  // 禁止 any（但允许过渡期警告）
  '@typescript-eslint/explicit-function-return-type': 'off',  // 不强制声明返回值类型（TS 可推断）

  // --- 导入顺序 ---
  'import/order': ['warn', {
    'groups': ['type', 'builtin', 'external', 'internal', 'parent', 'sibling'],
    'newlines-between': 'always'
  }]
}
```

**为什么 `@typescript-eslint/no-explicit-any` 设为 `'warn'` 而非 `'error'`？**

因为严格模式（`strict: true`）已经有类型检查，`warn` 只是提醒"这里可以更精确"。但在规范评审中，目标是**零 any**，所以 warn 是过渡手段。

#### 子任务 ④：理解 lint-staged 的增量检查

`lint-staged` 配合 `simple-git-hooks` 的工作流程：

```
你执行 git add file.vue
  ↓
git commit
  ↓
simple-git-hooks 拦截
  ↓
运行 pre-commit: pnpm typecheck && pnpm lint-staged
  ↓
lint-staged: eslint --fix file.vue（只检查这一个文件！）
  ↓
✅ 通过 → 继续提交
❌ 失败 → 提交被阻止，修复后重试
```

**关键点**：`lint-staged` 只检查 **staged** 文件，不是整个项目。这是"增量"检查，速度快。

### 第三步：整合——从规则到自动化

**完整的规范体系链路**：

```
开发者写代码
    ↓
IDE 实时提示（VS Code ESLint 插件）
    ↓
git add → git commit
    ↓
pre-commit: typecheck（类型检查）
    ↓
pre-commit: lint-staged → eslint --fix（自动修复 + 检查）
    ↓
commit-msg: git-commit-verify（检查提交信息格式）
    ↓
✅ 提交成功 → push
```

**调试技巧**：

| 问题 | 排查方法 |
|------|---------|
| ESLint 规则不生效 | 检查规则名是否正确、配置是否覆盖 |
| lint-staged 慢 | 检查是否误杀了 node_modules 等大目录（lint-staged 会跳过 .gitignore 中的文件） |
| commit-msg 失败 | 检查提交格式：`type(scope): description` |
| VS Code 不提示 | 确认安装了 ESLint 插件并启用 |

**验收标准**：
- [ ] 能用：`pnpm lint` 运行正常，输出无 error
- [ ] 规范：新增的规则符合项目规范（合理配置、例外处理）
- [ ] 精进：理解每条规则的设计意图，能解释"为什么这样配置"

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| ESLint 9 Flat Config | 用 JS 函数代替 JSON 配置，组合式声明规则 | 注解代替 XML 配置 | 配置本身是可执行的 JS/TS |
| defineConfig | 工厂函数，传入开关和覆盖生成完整配置 | Spring Boot `@EnableXxx` + properties | 类型安全（TypeScript） |
| Flat Config 数组 | 每个元素是一个独立的配置对象，按顺序合并 | Maven Profile 叠加 | 数组结构让覆盖逻辑显式化 |
| lint-staged | 只检查 git staged 文件，秒级完成 | `git diff --name-only | xargs checkstyle` | 内置 git 工作流，零配置集成 |
| simple-git-hooks | 轻量 git hook 管理，不需要 husky | Maven Git Hook 插件 | JSON 配置，pnpm prepare 自动安装 |
| Conventional Commits | `<type>(scope): description` 标准化提交信息 | — （无对应） | 前端社区约定，semantic-release 自动发版 |
| `vue/multi-word-component-names` | 组件名必须多词，避免与 HTML 元素冲突 | Java 类名不能与 JDK 类同名 | 因为 Vue 组件最终会注册为全局自定义元素 |
| `eslint --fix` | 自动修复风格问题（缩进、引号、分号等） | — （无对应） | ESLint 内置 auto-fix，检查 + 修复一体 |

---

**明日预告**：第38天 — Git Hooks 与自动化 — simple-git-hooks、lint-staged、commitizen 全链路实战
