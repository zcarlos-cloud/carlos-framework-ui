# 今日前端课程 — 第38天：Git Hooks 与自动化 — 前端世界的「提交门禁」

> **学习目标**
> - 能读：看懂 simple-git-hooks / lint-staged 的配置和执行流程
> - 能用：理解 pre-commit → typecheck + lint-staged → commit-msg 的完整链路
> - 规范：掌握 Conventional Commits 标准，能用 `pnpm commit` 交互式生成规范提交信息
> - 精进：理解 Git Hooks 的执行模型（客户端 hooks vs 服务端 hooks），能在 CI 中复现同样逻辑
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Node.js CLI / cac / execa / simple-git-hooks / lint-staged

---

## 理论学习

### 核心知识点

#### 1. Git Hooks 的本质 — 不是前端专属，但前端用得很到位

Git Hooks 是 Git 内置的「事件回调机制」—— 在 Git 生命周期的关键节点（commit 前、commit 后、push 前 等），自动触发你定义的一段脚本。

```
.git/hooks/
├── pre-commit          # git commit 执行前触发
├── commit-msg          # 提交信息编辑完成后触发
├── pre-push            # git push 执行前触发
└── post-commit         # git commit 执行后触发
```

> **Java 类比**：Git Hooks ≈ Spring AOP 的 `@Before` / `@After` 切面，拦截 Git 操作并插入自定义逻辑。就像你在 Service 方法上加 `@Transactional` 切面一样，Git Hooks 在 commit/push 等操作前后织入检查逻辑。

#### 2. simple-git-hooks — 轻量级 Hook 管理

传统的 Git Hooks 管理（如 Husky）需要在 `.git/hooks/` 目录写入 shell 脚本，而 `simple-git-hooks` 只做两件事：
1. 在 `package.json` 中声明 hooks 配置
2. `npm install`（或 pnpm install）后自动写入 `.git/hooks/` 文件

```json
// carlos-ui/package.json 中的配置
{
  "simple-git-hooks": {
    "commit-msg": "pnpm sa git-commit-verify",
    "pre-commit": "pnpm typecheck && pnpm lint-staged"
  }
}
```

**执行链路**：

```
git commit
  → pre-commit hook 触发
    → pnpm typecheck          # 全量 TypeScript 类型检查
    → pnpm lint-staged        # 仅检查暂存区文件 + ESLint 修复
      → git add (重新暂存修复后的文件)
  → 编辑器打开 COMMIT_EDITMSG
  → commit-msg hook 触发
    → pnpm sa git-commit-verify  # 校验提交信息格式
  → git commit 完成
```

#### 3. lint-staged — 只检查你改了的文件

在大型项目中，全量运行 ESLint 可能很慢（数千个文件）。`lint-staged` 只对 `git add` 暂存的文件执行检查，大幅提升 pre-commit 速度。

```json
// carlos-ui/package.json
{
  "lint-staged": {
    "*": "eslint --fix"
  }
}
```

**工作原理**：
1. `git diff --cached --name-only` 获取暂存区文件列表
2. 按 glob 模式匹配（`*` 匹配所有文件）
3. 对匹配的文件执行 `eslint --fix`
4. ESLint 自动修复后，`lint-staged` 执行 `git add` 重新暂存

> **Java 类比**：lint-staged ≈ 代码审查（Code Review）的自动化版。就像你 PR 提交后只审查 diff 内容一样，lint-staged 只检查暂存区的 diff，不是全量扫描整个项目。

#### 4. pnpm sa git-commit-verify — 提交信息校验器

这是 `@sa/scripts` 提供的 CLI 命令，集成在 `packages/scripts/src/commands/git-commit.ts` 中。

**核心逻辑**（来自真实源码）：

```typescript
// packages/scripts/src/commands/git-commit.ts
export async function gitCommitVerify(lang: Lang = 'en-us', ignores: RegExp[] = []) {
  // 1. 找到 .git 目录
  const gitPath = await execCommand('git', ['rev-parse', '--show-toplevel']);

  // 2. 读取提交信息文件
  const gitMsgPath = path.join(gitPath, '.git', 'COMMIT_EDITMSG');
  const commitMsg = readFileSync(gitMsgPath, 'utf8').trim();

  // 3. 跳过忽略规则（如 Merge commit）
  if (ignores.some(regExp => regExp.test(commitMsg))) return;

  // 4. 正则校验
  const REG_EXP = /(?<type>[a-z]+)(?:\((?<scope>.+)\))?(?<breaking>!)?: (?<description>.+)/i;
  if (!REG_EXP.test(commitMsg)) {
    throw new Error(errorMsg); // 拦截提交
  }
}
```

**忽略规则**（来自 `packages/scripts/src/config/index.ts`）：

```typescript
gitCommitVerifyIgnores: [
  /^((Merge pull request)|(Merge (.*?) into (.*?)|(Merge branch (.*?)))(?:\r?\n)*$)/m,
  /^(Merge tag (.*?))(?:\r?\n)*$/m,
  /^(R|r)evert (.*)/,
  /^(amend|fixup|squash)!/,
  // ... 更多 Merge 模式
]
```

#### 5. pnpm commit — 交互式提交生成器

同一个 `git-commit.ts` 文件还提供了 `gitCommit()` 函数，用于交互式生成规范提交信息：

```typescript
export async function gitCommit(lang: Lang = 'en-us') {
  // 使用 enquirer 库做交互式命令行问答
  const result = await prompt<PromptObject>([
    { name: 'types', type: 'select', message: 'Please select a type', choices: typesChoices },
    { name: 'scopes', type: 'select', message: 'Please select a scope', choices: scopesChoices },
    { name: 'description', type: 'text', message: 'Please enter a description' }
  ]);

  const commitMsg = `${result.types}(${result.scopes})${breaking}: ${description}`;
  await execCommand('git', ['commit', '-m', commitMsg], { stdio: 'inherit' });
}
```

> **Java 类比**：`git-commit-verify` ≈ Spring `@Valid` 注解校验；`git-commit` ≈ IDE 的提交对话框提供下拉选择 type/scope。

---

### Java 思维类比

| 前端概念 | Java 类比 | 关键差异 |
|---------|----------|---------|
| `pre-commit` hook | Maven `validate` 阶段 | 前端在暂存时就拦截，Java 在编译时拦截 |
| `lint-staged` | 增量代码审查（只审 diff） | lint-staged 还自动修复并重新暂存 |
| `commit-msg` hook | 提交信息模板 + 正则校验 | 前端可以通过 CLI 交互式生成 |
| Conventional Commits | Maven Release Plugin 的版本号规则 | 前端提交信息决定自动版本号和 CHANGELOG |
| `simple-git-hooks` | Maven Wrapper 脚本 | 安装依赖时自动初始化，零配置 |

### 超越类比 — 前端独有的设计哲学

**为什么前端不直接用 shell 脚本管理 hooks？**

1. **跨平台兼容**：Windows 的 `.sh` 脚本不工作，`simple-git-hooks` 通过 Node.js 执行，天然跨平台
2. **Monorepo 友好**：`pnpm sa git-commit-verify` 调用的是 workspace 内的 `@sa/scripts`，无需全局安装
3. **依赖注入式配置**：`package.json` 是前端项目的唯一配置文件，hooks 放在这里统一管理
4. **零污染**：不需要在项目根目录创建 `.husky/` 目录，Git 仓库更干净
5. **CI 可复现**：相同的命令可以在本地和 GitHub Actions 中执行，行为一致

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

| 文件 | 说明 |
|------|------|
| `package.json` | simple-git-hooks + lint-staged 配置入口 |
| `packages/scripts/bin.ts` | CLI 入口（`#!/usr/bin/env tsx`） |
| `packages/scripts/src/index.ts` | CLI 命令注册（cac 框架） |
| `packages/scripts/src/commands/git-commit.ts` | git-commit + git-commit-verify 核心逻辑 |
| `packages/scripts/src/config/index.ts` | 配置加载（c12 库 + 默认值） |
| `packages/scripts/src/locales/index.ts` | 中英文提交类型/范围定义 |
| `packages/scripts/src/types/index.ts` | CliOption 类型定义 |
| `packages/scripts/src/shared/index.ts` | execCommand 工具函数 |

### 阅读指引

1. **先看入口链**：`bin.ts` → `index.ts` → `commands/git-commit.ts`
2. **再看配置体系**：`config/index.ts` 使用 `c12` 库加载配置（支持 `soybean.config.ts`、`package.json` 等来源）
3. **检查**：
   - hooks 执行顺序是否正确？（pre-commit → commit-msg）
   - 如果 `pnpm typecheck` 失败，`pnpm lint-staged` 还会执行吗？（不会，`&&` 短路）
   - 是否有循环依赖？（scripts 包被 devDependencies 引用，不影响运行时）
4. **思考**：如果是你写，如何支持更多的 hook 类型（pre-push、post-merge）？

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件 camelCase、函数 camelCase、目录 kebab-case | ✅ `git-commit.ts`、`gitCommit()`、`config/` |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ `CliOption` 接口、`CommandArg` 接口、`Lang` 类型完备 |
| 目录规范 | 文件放在正确的目录（commands/config/shared/types/locales） | ✅ 分层清晰 |
| 导入顺序 | type 导入 → 第三方库 → 内部模块 → 相对路径 | ✅ `commands/git-commit.ts` 符合 |
| 错误处理 | 所有异步有 try/catch 或统一拦截 | ✅ gitCommitVerify 抛出 Error 阻断提交 |
| 可测试性 | 纯函数可单测，副作用可 mock | ⚠️ execCommand 和文件读写未分离，可改进 |
| 国际化 | 用户可见字符串使用 i18n | ✅ 中英文 locale 支持 |

**规范点评**：
- ⚠️ `execCommand` 是副作用函数，`gitCommitVerify` 直接调用它读取文件，导致难以单元测试。改进方案：将文件读取逻辑作为参数注入
- ✅ CLI 框架使用 `cac` 而非 `commander`，更轻量（3KB vs 30KB）
- ✅ 配置加载使用 `c12`，支持多种配置来源（文件 / package.json / 环境变量），类似 Java Spring 的 `PropertySource` 机制
- ✅ 忽略规则使用正则数组而非硬编码字符串，扩展性好

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

今天的练习任务是**理解并扩展 Git Hooks 门禁机制**，拆解为以下子任务：

| 子任务 | 描述 | 难度 |
|--------|------|------|
| 1. 阅读现有 hooks 配置 | 理解 `package.json` 中 simple-git-hooks 和 lint-staged 的配置 | ⭐ |
| 2. 模拟 pre-commit 流程 | 手动执行 typecheck + lint-staged，观察输出 | ⭐ |
| 3. 分析 git-commit-verify 源码 | 逐行理解正则校验逻辑 + 忽略规则 | ⭐⭐ |
| 4. 扩展 lint-staged 规则 | 新增对 `.css` / `.scss` 文件的 stylelint 检查 | ⭐⭐ |
| 5. 集成测试 | 故意制造错误，验证门禁拦截 | ⭐ |

### 第二步：小任务开发

#### 任务1：阅读现有 hooks 配置

在项目根目录打开 `package.json`，找到这两个配置块：

```json
// 1. simple-git-hooks — 定义在哪些 Git 节点执行什么命令
"simple-git-hooks": {
  "commit-msg": "pnpm sa git-commit-verify",   // 提交时校验信息格式
  "pre-commit": "pnpm typecheck && pnpm lint-staged"  // 提交前类型检查 + ESLint
},

// 2. lint-staged — 定义对暂存文件执行什么操作
"lint-staged": {
  "*": "eslint --fix"  // 对所有暂存文件执行 ESLint 自动修复
}
```

**关键理解**：
- `simple-git-hooks` 告诉 Git「在这些时候调用这些命令」
- `lint-staged` 告诉 lint-staged「对这类文件执行这个操作」
- `pnpm sa` 调用的是 `@sa/scripts` 包的 CLI（`bin.ts` 入口）

#### 任务2：手动模拟 pre-commit 流程

```bash
# 1. TypeScript 类型检查（全量，非增量）
pnpm typecheck
# 如果通过 → 继续下一步；如果失败 → 中止提交

# 2. lint-staged（增量，仅暂存区文件）
# 先查看暂存区有哪些文件
git diff --cached --name-only

# 手动运行 lint-staged 看看会检查哪些文件
pnpm lint-staged
# 输出示例：
# ✔ Preparing lint-staged...
# ✔ Running tasks for staged files...
# ✔ Applying modifications from tasks...
```

> **理解短路逻辑**：`pnpm typecheck && pnpm lint-staged` 中 `&&` 的含义是 —— typecheck 失败则终止，lint-staged 不会执行。这保证了「先过类型关，再过格式关」。

#### 任务3：分析 git-commit-verify 源码

完整源码在 `packages/scripts/src/commands/git-commit.ts`，关键路径：

```
git-commit-verify 入口
  ↓
execCommand('git', ['rev-parse', '--show-toplevel'])
  → 获取 Git 仓库根路径（如 /home/carlos/my-project）
  ↓
readFileSync(path.join(gitPath, '.git', 'COMMIT_EDITMSG'))
  → 读取 Git 刚写入的提交信息文件
  ↓
正则校验 /(?<type>[a-z]+)(?:\((?<scope>.+)\))?(?<breaking>!)?: (?<description>.+)/i
  → 匹配格式：type(scope): description
  → 支持 breaking change：type(scope)!: description
  ↓
不匹配 → throw Error → Git 拦截提交
匹配 → 放行
```

**正则拆解**：

| 正则片段 | 含义 | 示例匹配 |
|---------|------|---------|
| `(?<type>[a-z]+)` | 命名组 type：小写字母 | `feat` |
| `(?:\((?<scope>.+)\))?` | 可选的范围 `(xxx)` | `(projects)` |
| `(?<breaking>!)?` | 可选的破坏性标记 `!` | `feat!:` |
| `: ` | 冒号+空格分隔符 | `: ` |
| `(?<description>.+)` | 提交描述 | `add user login` |

#### 任务4：扩展 lint-staged 规则

当前 `lint-staged` 配置只对所有文件运行 ESLint。可以扩展为按文件类型执行不同检查：

```json
// 扩展后的 lint-staged 配置（概念演示）
{
  "lint-staged": {
    "*.{ts,tsx,vue,js,jsx}": "eslint --fix",
    "*.{css,scss}": "stylelint --fix",
    "*.md": "prettier --write"
  }
}
```

> **注意**：stylelint 需要额外安装。按现有项目规范，CSS/SCSS 文件的样式检查通常在 ESLint 中完成（通过 `@soybeanjs/eslint-config`），不需要单独的 stylelint。

#### 任务5：集成测试 — 验证门禁拦截

```bash
# 测试1：提交信息格式错误
echo "fix bug" > /tmp/test-commit-msg
# 预期：pnpm sa git-commit-verify 抛出错误

# 测试2：提交信息格式正确
echo "fix(projects): resolve login timeout issue" > /tmp/test-commit-msg
# 预期：通过校验

# 测试3：Merge commit 被忽略
echo "Merge branch 'feature' into main" > /tmp/test-commit-msg
# 预期：通过（被忽略规则放行）

# 测试4：破坏性变更标记
echo "feat(api)!: remove deprecated getUser endpoint" > /tmp/test-commit-msg
# 预期：通过校验，breaking 组捕获 "!"
```

### 第三步：整合与调试

**完整提交门禁流程图**：

```
开发者执行: git commit

┌─────────────────────────────────────┐
│  pre-commit hook                    │
│  pnpm typecheck && pnpm lint-staged │
├─────────────────────────────────────┤
│  ① pnpm typecheck                   │
│     vue-tsc --noEmit --skipLibCheck │
│     检查所有 .ts/.vue 文件类型         │
│     失败 → 终止提交                   │
│     通过 → 继续                       │
├─────────────────────────────────────┤
│  ② pnpm lint-staged                 │
│     git diff --cached --name-only    │
│     获取暂存区文件列表                 │
│     eslint --fix 仅修复这些文件        │
│     修复后自动 git add 重新暂存        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  编辑器打开 COMMIT_EDITMSG           │
│  用户编写提交信息                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  commit-msg hook                    │
│  pnpm sa git-commit-verify          │
├─────────────────────────────────────┤
│  读取 .git/COMMIT_EDITMSG            │
│  正则校验格式                         │
│  失败 → throw Error → 终止提交        │
│  通过 → 提交完成                      │
└─────────────────────────────────────┘
```

**常见调试问题**：

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `pnpm typecheck` 报大量错误 | 第三方类型定义不兼容 | 添加 `--skipLibCheck` 标志 |
| lint-staged 不执行 | simple-git-hooks 未初始化 | 执行 `pnpm prepare` 重新写入 hooks |
| commit-msg 校验总是失败 | 提交信息格式不对 | 使用 `pnpm commit` 交互式生成 |
| Merge commit 被拦截 | 忽略规则未覆盖该模式 | 在 `gitCommitVerifyIgnores` 中添加正则 |

### 验收标准

- [ ] **能用**：理解 pre-commit → lint-staged → commit-msg 的完整链路，能用 `pnpm commit` 交互式提交
- [ ] **规范**：能够写出符合 Conventional Commits 的提交信息，理解 `feat(scope): desc` 各部分含义
- [ ] **精进**：能说出 `simple-git-hooks` 与 `husky` 的区别，理解 `cac`/`c12`/`execa` 各库的职责

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `simple-git-hooks` | 在 `package.json` 中声明 Git Hooks，安装依赖时自动初始化 | Maven Wrapper 脚本 | 跨平台、零配置文件 |
| `lint-staged` | 只对 `git add` 暂存的文件执行 lint | 只审查 PR diff 不审查全量代码 | 自动修复 + 重新暂存 |
| `Conventional Commits` | `<type>(<scope>): <description>` 格式的提交信息标准 | Maven Release Plugin 约定 | 驱动自动版本号 + CHANGELOG |
| `pnpm sa git-commit` | 交互式选择 type/scope 生成规范提交信息 | IDE 提交对话框 | CLI 下拉选择 + 中英文 |
| `pre-commit` 短路 | `pnpm typecheck && pnpm lint-staged` — typecheck 失败则 lint 不执行 | Spring `@Valid` 校验失败不执行业务方法 | 分层门禁 |
| `cac` | 6KB 的轻量 CLI 框架 | picocli (Java) | 比 commander 轻 10 倍 |
| `c12` | 从多来源加载配置（文件/package.json/环境变量） | Spring `PropertySource` | 与 Monorepo + package.json 深度集成 |

---

**明日预告**：第39天 — 路由自动生成（`@elegant-router/vue`），理解文件系统路由如何自动映射到 Vue Router 配置
