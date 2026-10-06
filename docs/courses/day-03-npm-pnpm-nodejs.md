# 今日前端课程 — 第3天：npm / pnpm / Node.js 生态 — Java 的 Maven 在前端

> **学习目标**
> - 能读：看懂 `package.json`、`pnpm-workspace.yaml`，理解依赖声明与版本锁定
> - 能用：能新增内部包、安装依赖、运行脚本，理解 monorepo 工作流
> - 规范：遵循 `@sa/xxx` 命名，正确配置 `exports` 和 `typesVersions`
> - 精进：理解 pnpm 硬链接机制，分析依赖去重策略，画出模块依赖图
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：pnpm workspace + Node.js 18 + Vite 7

---

## 理论学习

### 核心知识点

1. **package.json — 前端的 "pom.xml"**
   - `name` / `version`：包的坐标，类似 Maven 的 `groupId:artifactId:version`
   - `dependencies` / `devDependencies`：运行时依赖 vs 构建时依赖（类似 Maven 的 `<scope>compile</scope>` vs `<scope>provided</scope>`）
   - `scripts`：npm 脚本，等价于 Maven 的 `mvn clean install` 等命令
   - `engines`：环境约束，类似 Maven 的 `maven.compiler.source`

2. **pnpm vs npm vs yarn — 为什么选 pnpm？**
   - **硬链接（Hard Link）**：pnpm 将依赖存储在全局内容寻址存储（CAS），通过硬链接复用，磁盘占用远小于 npm
   - **非扁平 node_modules**：pnpm 严格遵循 `package.json` 声明的依赖树，解决 npm 的 "幽灵依赖" 问题
   - **workspace 原生支持**：pnpm workspace 比 npm workspaces 更成熟、性能更好

3. **pnpm-workspace.yaml — 聚合 POM**
   - 定义哪些目录属于 workspace（类似 Maven 的 `<modules>`）
   - `packages/*` 表示 `packages/` 下的每个子目录都是一个独立包
   - 依赖可声明为 `workspace:*`，表示使用本地版本（类似 Maven 的 `<dependency>` 指向同项目模块）

4. **Monorepo 依赖关系**
   - 内部包通过 `workspace:*` 相互引用
   - pnpm 自动解析本地链接，无需手动 `npm link`
   - 每个包独立 `package.json`，独立版本管理

### Java 思维类比

| Java 概念 | 前端对应 | 类比说明 |
|---------|---------|---------|
| `pom.xml` | `package.json` | 依赖声明 + 构建脚本 + 元信息 |
| `mvn install` | `pnpm install` | 下载依赖到本地存储 |
| `~/.m2/repository` | `~/.pnpm-store` | 全局依赖缓存 |
| Maven 多模块 `<modules>` | `pnpm-workspace.yaml` | 声明哪些子目录是子模块 |
| `<dependency>` 指向同项目 | `workspace:*` | 本地模块间引用 |
| `scope=compile` | `dependencies` | 运行时必需 |
| `scope=provided` | `devDependencies` | 构建时需要，运行时不打包 |
| `mvn clean package` | `pnpm build` | 构建产物 |

### 超越类比 — 前端独有的设计哲学

> **为什么前端需要 "非扁平" 的 node_modules？**
>
> Java 的 Maven 依赖也是树形的（传递依赖），但运行时通过 classpath 扁平化加载。前端的不同在于：**每个包可能依赖不同版本的同一库**，而 JavaScript 没有类加载器隔离。pnpm 的非扁平结构让 `packageA` 和 `packageB` 各自拥有独立的依赖版本，避免了 "依赖地狱"。
>
> 这是前端包管理比 Maven 更复杂的根源：没有 JVM 的类隔离机制，必须用文件系统层级来模拟隔离。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

- `pnpm-workspace.yaml` — workspace 声明
- `package.json` — 根项目配置
- `packages/axios/package.json` — 内部包示例
- `packages/utils/package.json` — 另一个内部包

### 阅读指引

1. **先看根 `package.json`**：
   - 注意 `dependencies` 中的 `@sa/axios: "workspace:*"` — 这表示引用本地 workspace 包
   - `engines` 约束 Node >= 18.12.0, pnpm >= 8.7.0
   - `simple-git-hooks` 配置：pre-commit 自动 typecheck + lint

2. **再看 `pnpm-workspace.yaml`**：
   - 极简声明：`packages/*` 表示所有子目录自动识别
   - 对比 Maven 的 `<modules><module>module-a</module></modules>`，pnpm 更灵活

3. **对比两个内部包的 `package.json`**：
   - `@sa/axios`：依赖 `axios`、`qs`、`axios-retry`，以及 `@sa/utils`
   - `@sa/utils`：依赖 `crypto-js`、`nanoid`、`localforage` 等
   - 两者都有 `exports: { ".": "./src/index.ts" }` — 这是 ESM 入口声明
   - `typesVersions` 配置 TypeScript 类型解析路径

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 内部包使用 `@sa/xxx` 前缀 | ✅ `@sa/axios`, `@sa/utils` |
| 版本管理 | 内部包与根项目版本一致（1.3.11） | ✅ 统一版本 |
| 导出规范 | `exports["."]` 指向入口文件 | ✅ 指向 `./src/index.ts` |
| 类型配置 | `typesVersions` 正确配置 | ✅ 已配置 |
| 依赖声明 | `workspace:*` 引用本地包 | ✅ `@sa/utils: "workspace:*"` |
| 引擎约束 | `engines` 声明 Node/pnpm 版本 | ✅ 已声明 |

**思考题**：
- 如果 `@sa/axios` 需要升级 `axios` 到 2.x，会影响根项目的其他依赖吗？
- `workspace:*` 在发布到 npm 时会被替换为实际版本号，这是怎么实现的？

---

## 功能实践 — 分三步

### 第一步：分析现有结构

**任务**：画出 carlos-ui 的 monorepo 依赖关系图

```
carlos-ui (根项目)
├── dependencies:
│   ├── @sa/axios (workspace:*)
│   ├── @sa/color (workspace:*)
│   ├── @sa/hooks (workspace:*)
│   ├── @sa/materials (workspace:*)
│   ├── @sa/utils (workspace:*)
│   ├── vue, pinia, ant-design-vue... (外部依赖)
│
├── packages/
│   ├── @sa/axios
│   │   └── dependencies: @sa/utils (workspace:*)
│   ├── @sa/utils
│   │   └── dependencies: crypto-js, nanoid, localforage...
│   ├── @sa/hooks
│   ├── @sa/materials
│   ├── @sa/color
│   ├── @sa/ofetch
│   ├── @sa/scripts
│   └── @sa/uno-preset
```

**关键发现**：
- `@sa/axios` 依赖 `@sa/utils` — 内部包之间存在层级关系
- 根项目直接依赖 5 个内部包，构建时由 pnpm 自动链接
- 外部依赖（如 `vue`, `pinia`）版本由根项目统一管理

### 第二步：实战 — 在 `packages/` 下新增一个内部包

**任务**：创建一个 `@sa/formatter` 包，提供日期和数字格式化函数

**操作步骤**：

1. **创建目录和文件**：

```bash
mkdir -p /home/carlos/.openclaw/agents/carlos-dev-assistant/workspace/carlos-framework/carlos-ui/packages/formatter/src
```

2. **编写 `packages/formatter/package.json`**：

```json
{
  "name": "@sa/formatter",
  "version": "1.3.11",
  "exports": {
    ".": "./src/index.ts"
  },
  "typesVersions": {
    "*": {
      "*": ["./src/*"]
    }
  },
  "dependencies": {
    "dayjs": "1.11.19"
  }
}
```

3. **编写 `packages/formatter/src/index.ts`**：

```typescript
import dayjs from 'dayjs';

/**
 * Format date to YYYY-MM-DD
 *
 * @param date Date string, Date object, or timestamp
 * @returns Formatted date string
 */
export function formatDate(date: string | number | Date): string {
  return dayjs(date).format('YYYY-MM-DD');
}

/**
 * Format number to currency
 *
 * @param value Number value
 * @param decimals Decimal places
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, decimals = 2): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: decimals
  }).format(value);
}
```

4. **在根 `package.json` 的 `dependencies` 中添加**：

```json
"@sa/formatter": "workspace:*"
```

5. **安装依赖**：

```bash
cd /home/carlos/.openclaw/agents/carlos-dev-assistant/workspace/carlos-framework/carlos-ui
pnpm install
```

6. **验证**：检查 `node_modules/@sa/formatter` 是否指向本地目录

```bash
ls -la node_modules/@sa/formatter
# 应该看到软链接指向 packages/formatter
```

### 第三步：在项目中使用新包

**任务**：在 `src/utils/common.ts` 中使用 `@sa/formatter`

```typescript
import {formatDate} from '@sa/formatter';

// 在 transformRecordToOption 附近添加测试函数
export function testFormatter() {
  console.log(formatDate(new Date())); // 输出：2026-05-25
}
```

**验证**：
- `pnpm typecheck` — 类型检查通过
- `pnpm lint` — ESLint 无报错
- `pnpm dev` — 开发服务器正常启动

### 验收标准

- [ ] 能用：新增 `@sa/formatter` 包，根项目能正确引用
- [ ] 规范：`package.json` 遵循 `@sa/xxx` 命名，`exports` 和 `typesVersions` 配置正确
- [ ] 精进：理解 `workspace:*` 的解析机制，能解释 pnpm 硬链接 vs npm 软链接的差异

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `package.json` | 包的身份证 + 依赖清单 + 脚本定义 | `pom.xml` | `scripts` 可以任意定义命令，比 Maven 更灵活 |
| `pnpm-workspace.yaml` | 声明哪些目录是 monorepo 子包 | `<modules>` 聚合 POM | yaml 格式比 XML 更简洁，支持 glob 通配 |
| `workspace:*` | 引用本地 workspace 包的最新版本 | `<dependency>` 指向同项目模块 | 发布时自动替换为实际版本号 |
| 硬链接（Hard Link） | 多个位置共享同一份物理文件，不占额外空间 | Maven 的本地仓库也是全局存储 | pnpm 用硬链接实现依赖共享，node_modules 结构非扁平 |
| `node_modules` | 依赖的实际存放位置（或链接） | `~/.m2/repository` | 非扁平结构，每个包有自己的依赖隔离 |
| `engines` | 声明运行环境要求 | Maven 插件版本约束 | 可以约束 Node 版本、pnpm 版本 |
| `exports` | ESM 包的入口声明 | `Main-Class` 或 Spring Boot 启动类 | 支持条件导出（如 `"./package.json"` 单独暴露） |
| `typesVersions` | TypeScript 类型解析路径映射 | 无直接对应 | TypeScript 特有的类型系统配置 |

---

## 拓展思考

1. **如果删除 `pnpm-lock.yaml` 会怎样？**
   - 类比：类似删除 Maven 的 `dependencyManagement` 锁定版本
   - 下次 `pnpm install` 会重新解析最新版本，可能导致依赖漂移

2. **为什么 `devDependencies` 中的 Vite 不会被打包到生产环境？**
   - Vite 是构建工具，只在开发/构建时使用
   - 类比：Maven 的 `<scope>provided</scope>` 或插件依赖

3. **pnpm 的 `.pnpm-store` 在哪里？**
   - 默认在 `~/.local/share/pnpm/store`（Linux）
   - 所有项目共享同一份存储，通过硬链接节省空间

---

**明日预告**：第4天 — **Vite 构建工具 — 前端世界的"Spring Boot"**

我们将深入 Vite 的 HMR、ESM、Rollup 构建、插件系统，分析 `vite.config.ts` 的配置，并编写一个自定义 Vite 插件。

---

> **当日作业**：
> 1. 执行 `pnpm why axios` 查看 axios 的依赖路径
> 2. 尝试修改 `packages/utils/package.json` 的 `version`，观察根项目 `pnpm-lock.yaml` 的变化
> 3. 阅读 `packages/scripts/package.json`，理解 CLI 工具包的配置方式
