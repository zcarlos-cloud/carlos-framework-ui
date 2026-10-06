# 今日前端课程 — 第4天：Vite 构建工具 — 前端世界的"Spring Boot"

> **学习目标**
> - **能读**：理解 Vite 的 ESM 原生导入、HMR 热更新、Rollup 生产构建三核心机制
> - **能用**：能读懂并修改 `vite.config.ts`，配置别名、代理、环境变量、插件
> - **规范**：环境变量以 `VITE_` 前缀命名，构建配置分离到 `build/` 目录，插件按职责拆分文件
> - **精进**：理解 Vite 预构建（pre-bundle）原理，能编写自定义插件，能分析构建产物
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite 7 + TypeScript + pnpm workspace

---

## 理论学习

### 核心知识点

#### 1. 为什么需要 Vite？Webpack 不是已经很好了吗？

**Webpack 的问题**：
- 开发启动慢：需要打包整个应用，大型项目可能要等 30 秒+
- HMR 慢：修改一个文件，需要重新编译整个依赖链
- 配置复杂：`webpack.config.js` 动辄几百行

**Vite 的核心突破**：
- **开发时直接利用浏览器原生 ESM**：不对源码打包，浏览器直接请求单个模块
- **HMR 极速**：只更新修改的模块，边界毫秒级
- **生产时用 Rollup 打包**：仍然产出优化后的 bundle，但构建配置简洁

> 💡 Java 类比：Webpack 像 Maven 的 `mvn package`（每次都要全量打包），Vite 像 Spring Boot DevTools（只热替换变更的类）+ 生产时再用 ProGuard 压缩混淆。

#### 2. ESM（ES Modules）原生导入

```typescript
// 浏览器原生支持的模块化语法
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
```

Vite 开发时：
1. 浏览器请求 `src/main.ts`
2. Vite 服务器拦截请求，编译 TS → JS，返回给浏览器
3. 浏览器解析到 `import App from './App.vue'`，再发起新请求
4. 每个模块都是独立的 HTTP 请求，按需加载

> ⚠️ 注意：开发时的 "不打包" 不是不编译，而是 **单文件即时编译 + 浏览器原生 ESM 组装**

#### 3. HMR（Hot Module Replacement）热更新

- 修改 `src/App.vue` → Vite 只编译这一个文件 → 通过 WebSocket 推送给浏览器 → 浏览器局部替换，不刷新页面
- 状态保持：Vue 组件的状态不会丢失

#### 4. 预构建（Pre-bundle）

为什么需要预构建？
- 一些库（如 lodash-es）导出成百上千个模块，浏览器发几百个 HTTP 请求性能极差
- Vite 启动时扫描依赖，用 esbuild 将依赖预打包成单文件，放入 `node_modules/.vite/deps/`

#### 5. 环境变量与模式

| 文件 | 说明 |
|------|------|
| `.env` | 通用环境变量（所有模式都加载） |
| `.env.development` | 开发模式专属（`pnpm dev`） |
| `.env.production` | 生产模式专属（`pnpm build`） |
| `.env.[mode]` | 自定义模式 |

规则：
- 只有以 `VITE_` 开头的变量才会暴露给前端代码（通过 `import.meta.env`）
- 这是安全设计，防止意外泄露敏感配置

---

### Java 思维类比

| 前端概念 | Java 类比 | 说明 |
|---------|----------|------|
| Vite | Spring Boot + DevTools | 开发时极速启动，热替换，生产时优化打包 |
| `vite.config.ts` | `pom.xml` + `application.yml` | 构建配置 + 环境配置合一 |
| `import.meta.env` | Spring `Environment` / `@Value` | 读取环境变量 |
| ESM 按需加载 | Java 模块化系统（JPMS） | 运行时按需解析依赖 |
| HMR | JRebel / HotSwap | 运行时替换代码，状态保持 |
| Rollup 生产构建 | Maven `package` + ProGuard | 代码压缩、Tree Shaking、分包 |
| Vite 插件 | Maven 插件 / Gradle 插件 | 扩展构建流程 |
| `VITE_` 前缀变量 | `application.yml` 中的 `app.*` | 暴露给应用层的配置 |

---

### 超越类比 — 前端独有的设计哲学

> **"为什么前端构建工具要区分开发和生产两套机制？"**

Java 的世界观是 "编译一次，到处运行"（JVM 字节码统一），但前端面对的是**浏览器这个多变的运行时环境**：

1. **浏览器版本碎片化**：ESM 支持程度不同，开发时可以用最新语法，生产时需要降级和 polyfill
2. **网络环境差异**：开发时本地网络极好（localhost），可以容忍几百个 HTTP 请求；生产时公网环境必须极致减少请求数
3. **调试体验优先**：开发时 SourceMap、详细的错误堆栈、HMR 是第一优先级；生产时代码体积、加载速度是第一优先级

所以 Vite 的 "双模式" 不是过度设计，而是**对不同场景的最优解**：
- 开发 = 速度优先（esbuild 单文件编译 + 原生 ESM）
- 生产 = 体积优先（Rollup 全量打包 + 代码分割 + 压缩）

> 🎯 **记住这句话**：前端构建工具的本质是**在"开发体验"和"生产性能"之间做 trade-off**，Vite 的独特之处是两边都做到了当前最优。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

1. **`vite.config.ts`** — Vite 主配置入口
2. **`build/config/proxy.ts`** — 开发代理配置
3. **`build/config/time.ts`** — 构建时间工具
4. **`build/plugins/index.ts`** — 插件总装入口
5. **`build/plugins/html.ts`** — 自定义 HTML 插件（注入构建时间）
6. **`build/plugins/router.ts`** — 优雅路由自动生成插件
7. **`build/plugins/unocss.ts`** — UnoCSS 插件配置
8. **`build/plugins/unplugin.ts`** — 自动组件/图标导入插件
9. **`.env` / `.env.prod` / `.env.test`** — 环境变量文件

---

### 阅读指引

#### 第一步：vite.config.ts — 总览骨架

```typescript
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { setupVitePlugins } from './build/plugins';
import { createViteProxy, getBuildTime } from './build/config';

export default defineConfig(configEnv => {
  // 1. 加载当前模式的环境变量
  const viteEnv = loadEnv(configEnv.mode, process.cwd()) as unknown as Env.ImportMeta;

  // 2. 获取构建时间（注入到 HTML meta 中）
  const buildTime = getBuildTime();

  // 3. 只在 dev serve 时启用代理（preview 不启用）
  const enableProxy = configEnv.command === 'serve' && !configEnv.isPreview;

  return {
    base: viteEnv.VITE_BASE_URL,           // 应用基础路径
    resolve: {
      alias: {                             // 路径别名
        '~': fileURLToPath(new URL('./', import.meta.url)),
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          additionalData: `@use "@/styles/scss/global.scss" as *;`  // 自动注入全局 SCSS
        }
      }
    },
    plugins: setupVitePlugins(viteEnv, buildTime),  // 插件集
    define: {
      BUILD_TIME: JSON.stringify(buildTime)         // 全局常量：构建时间
    },
    server: {
      host: '0.0.0.0',
      port: 9527,          // 开发端口（Java 工程师注意：不是 8080）
      open: true,          // 自动打开浏览器
      proxy: createViteProxy(viteEnv, enableProxy)  // 开发代理
    },
    preview: {
      port: 9725           // preview 模式端口
    },
    build: {
      reportCompressedSize: false,
      sourcemap: viteEnv.VITE_SOURCE_MAP === 'Y',   // SourceMap 开关
      commonjsOptions: {
        ignoreTryCatch: false
      }
    }
  };
});
```

**关键点**：
- `defineConfig` 接收一个函数，参数 `configEnv` 包含 `mode`（development/production）、`command`（serve/build）、`isPreview`
- `loadEnv()` 按优先级加载 `.env.[mode]` → `.env.local` → `.env`
- 路径别名 `~` 指向项目根目录，`@` 指向 `src/`，与前端开发规范一致

#### 第二步：build/config/proxy.ts — 代理配置

```typescript
import type { ProxyOptions } from 'vite';
import { createServiceConfig } from '../../src/utils/service';

export function createViteProxy(env: Env.ImportMeta, enable: boolean) {
  const isEnableHttpProxy = enable && env.VITE_HTTP_PROXY === 'Y';

  if (!isEnableHttpProxy) return undefined;

  const { baseURL, proxyPattern, other } = createServiceConfig(env);

  const proxy: Record<string, ProxyOptions> = createProxyItem({ baseURL, proxyPattern });

  other.forEach(item => {
    Object.assign(proxy, createProxyItem(item));
  });

  return proxy;
}

function createProxyItem(item: App.Service.ServiceConfigItem) {
  const proxy: Record<string, ProxyOptions> = {};

  proxy[item.proxyPattern] = {
    target: item.baseURL,
    changeOrigin: true,
    rewrite: path => path.replace(new RegExp(`^${item.proxyPattern}`), '')
  };

  return proxy;
}
```

**关键点**：
- 代理仅在 `VITE_HTTP_PROXY=Y` 且 `command === 'serve'` 时启用
- `proxyPattern` 是匹配前缀（如 `/api`），匹配到的请求会被转发到 `target`
- `rewrite` 将前缀去掉，再转发到后端
- `changeOrigin: true` 修改请求头 Host，解决跨域（类似 Java 后端的 CORS 配置）

#### 第三步：build/plugins/index.ts — 插件总装

```typescript
import type { PluginOption } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import VueDevtools from 'vite-plugin-vue-devtools';
import progress from 'vite-plugin-progress';
import { setupElegantRouter } from './router';
import { setupUnocss } from './unocss';
import { setupUnplugin } from './unplugin';
import { setupHtmlPlugin } from './html';

export function setupVitePlugins(viteEnv: Env.ImportMeta, buildTime: string) {
  const plugins: PluginOption = [
    vue(),                    // Vue SFC 编译
    vueJsx(),                 // Vue JSX 支持
    VueDevtools(),            // Vue DevTools 集成
    setupElegantRouter(),     // 文件系统路由自动生成
    setupUnocss(viteEnv),     // UnoCSS 原子化 CSS
    ...setupUnplugin(viteEnv), // 自动组件/图标导入
    progress(),               // 构建进度条
    setupHtmlPlugin(buildTime) // 自定义：注入构建时间到 HTML
  ];

  return plugins;
}
```

**插件链的执行顺序**：Vite 插件按数组顺序执行，每个插件可以在不同生命周期钩子（`buildStart`, `transform`, `generateBundle` 等）介入。

#### 第四步：build/plugins/html.ts — 自定义插件示例

```typescript
import type { Plugin } from 'vite';

export function setupHtmlPlugin(buildTime: string) {
  const plugin: Plugin = {
    name: 'html-plugin',
    apply: 'build',    // 只在 build 时生效，dev 时不执行
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta name="buildTime" content="${buildTime}">`);
    }
  };

  return plugin;
}
```

**这是一个极简但完整的 Vite 自定义插件**。关键结构：
- `name`: 插件唯一标识
- `apply`: 控制何时生效（`'build'` | `'serve'`）
- `transformIndexHtml`: 转换 `index.html` 的钩子

#### 第五步：.env 文件 — 环境变量

```bash
# .env（通用配置）
VITE_BASE_URL=/
VITE_APP_TITLE=SoybeanAdmin
VITE_HTTP_PROXY=N                    # 开发代理开关
VITE_ROUTER_HISTORY_MODE=history   # 路由模式
VITE_SERVICE_SUCCESS_CODE=0000     # 后端成功码
VITE_STORAGE_PREFIX=SOY_            # localStorage 前缀
VITE_AUTOMATICALLY_DETECT_UPDATE=Y # 自动检测更新
```

```bash
# .env.prod（生产环境）
VITE_SERVICE_BASE_URL=https://mock.apifox.cn/m1/3109515-0-default
```

---

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件 kebab-case、函数 camelCase | ✅ `proxy.ts`, `time.ts`, `html.ts` 等均为 kebab-case；函数 `createViteProxy`, `getBuildTime`, `setupHtmlPlugin` 均为 camelCase |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ `env: Env.ImportMeta`, `enable: boolean`, 返回类型 `ProxyOptions` / `Plugin` 均完整标注 |
| 目录规范 | 文件放在正确的目录 | ✅ `build/config/` 存放构建配置，`build/plugins/` 存放插件，职责分离清晰 |
| 导入顺序 | type 导入 → 第三方库 → 内部模块 → 相对路径 | ✅ 如 `proxy.ts`：`import type` 在前 → `vite` 第三方 → `@/utils/service` 内部模块 |
| 错误处理 | 所有异步有 try/catch 或统一拦截 | ⚠️ `createViteProxy` 中无 try/catch，但此处逻辑简单（纯配置读取），风险可控 |
| 可测试性 | 纯函数可单测，副作用可 mock | ✅ `createProxyItem`, `getBuildTime` 是纯函数，可独立测试；`setupHtmlPlugin` 返回插件对象，可验证 `transformIndexHtml` 输出 |
| 国际化 | 用户可见字符串使用 `$t()` | N/A（构建配置无用户可见字符串） |

---

## 功能实践 — 分三步

### 第一步：功能分析和拆解

**目标**：为 carlos-ui 新增一个 Vite 自定义插件，实现以下功能：

1. 在构建时（build 模式）读取 `package.json` 的 `version` 字段
2. 将版本号注入到 `index.html` 的 `meta` 标签中（类似现有的 buildTime）
3. 在运行时通过 `import.meta.env` 暴露版本号（新增环境变量 `VITE_APP_VERSION`）
4. 在页面底部显示版本信息（练习组件内使用）

**拆解小任务**：

| 序号 | 任务 | 技术要点 |
|------|------|---------|
| 1 | 修改 `build/plugins/html.ts` | 读取 package.json，在 HTML 中注入 version meta |
| 2 | 修改 `vite.config.ts` | 新增 `define` 字段注入版本号到全局常量 |
| 3 | 修改 `.env` | 新增 `VITE_APP_VERSION` 环境变量 |
| 4 | 创建组件展示版本信息 | 使用 `import.meta.env` 读取版本号展示 |

---

### 第二步：小任务开发

#### 任务 1：修改 `build/plugins/html.ts` — 注入版本号

```typescript
// build/plugins/html.ts
import type { Plugin } from 'vite';
import process from 'node:process';
import path from 'node:path';

function getAppVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    // 在 Node 环境中使用 require 读取 JSON
    const pkg = require(pkgPath);
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function setupHtmlPlugin(buildTime: string) {
  const version = getAppVersion();

  const plugin: Plugin = {
    name: 'html-plugin',
    apply: 'build',
    transformIndexHtml(html) {
      const injectedMeta = [
        `    <meta name="buildTime" content="${buildTime}">`,
        `    <meta name="appVersion" content="${version}">`
      ].join('\n');

      return html.replace('<head>', `<head>\n${injectedMeta}`);
    }
  };

  return plugin;
}
```

**技术要点**：
- `process.cwd()` 获取项目根目录（Vite 启动时的目录）
- `require()` 在 Vite 配置（Node 环境）中可用，但在浏览器代码中不可用
- `transformIndexHtml` 接收 HTML 字符串，返回修改后的字符串

#### 任务 2：修改 `vite.config.ts` — 全局常量注入

```typescript
// vite.config.ts（修改 define 部分）
import { readFileSync } from 'node:fs';
import path from 'node:path';

function getAppVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// ... 在 defineConfig 中 ...
define: {
  BUILD_TIME: JSON.stringify(buildTime),
  __APP_VERSION__: JSON.stringify(getAppVersion())  // 新增：双下划线是常见的全局常量约定
}
```

**技术要点**：
- `define` 中的值必须用 `JSON.stringify()` 包裹，否则字符串会被当成代码片段解析
- `__APP_VERSION__` 在代码中可直接使用（如 `console.log(__APP_VERSION__)`）
- 这是编译时替换，不是运行时变量

#### 任务 3：新增环境变量（更推荐的做法）

在 `.env` 中新增：

```bash
VITE_APP_VERSION=1.0.0
```

然后在代码中使用：

```typescript
const version = import.meta.env.VITE_APP_VERSION;
```

**两种方案对比**：

| 方案 | 适用场景 | 优缺点 |
|------|---------|--------|
| `define` 全局常量 | 版本号来自 package.json，编译时确定 | ✅ 自动同步 package.json 版本；❌ 无法运行时修改 |
| `VITE_` 环境变量 | 配置化场景，可能需要不同环境不同值 | ✅ 灵活配置；❌ 需手动维护，可能与 package.json 不同步 |

**最佳实践**：在 Vite 配置中读取 package.json 版本，通过 `define` 注入，同时写入 `.env` 供其他工具使用。

#### 任务 4：创建版本展示组件

在 `src/components/common/app-version.vue`：

```vue
<script setup lang="ts">
defineOptions({
  name: 'AppVersion'
});

/** 应用版本号（编译时注入） */
const version = __APP_VERSION__;
/** 构建时间（编译时注入） */
const buildTime = BUILD_TIME;
</script>

<template>
  <div class="text-12px text-gray-400">
    <span>v{{ version }}</span>
    <span class="mx-1">|</span>
    <span>{{ buildTime }}</span>
  </div>
</template>
```

**规范检查**：
- ✅ 文件名 `app-version.vue` — kebab-case
- ✅ 组件名 `AppVersion` — PascalCase，通过 `defineOptions` 声明
- ✅ 使用 UnoCSS 原子类（`text-12px`, `text-gray-400`, `mx-1`）
- ✅ 变量注释使用 JSDoc 风格

---

### 第三步：整合与功能测试

#### 整合关系图

```
vite.config.ts
├── build/config/proxy.ts      ← 代理配置（独立职责）
├── build/config/time.ts       ← 时间工具（独立职责）
├── build/plugins/index.ts     ← 插件总装（编排职责）
│   ├── vue()                  ← Vue 编译（官方插件）
│   ├── setupElegantRouter()   ← 路由生成（业务插件）
│   └── setupHtmlPlugin()      ← 自定义插件（我们的修改）
│       └── 注入 buildTime + version meta
├── .env                       ← 环境变量
└── define                     ← 全局常量注入
    ├── BUILD_TIME
    └── __APP_VERSION__
```

#### 调试与错误排查思路

| 问题 | 排查方法 |
|------|---------|
| 版本号没注入到 HTML | 1. 检查 `apply: 'build'` → 只在 build 时生效，dev 时不生效<br>2. 查看 dist/index.html 确认 meta 标签存在<br>3. 检查 `transformIndexHtml` 是否被调用（加 `console.log` 调试） |
| `__APP_VERSION__` 未定义 | 1. 检查 `vite.config.ts` 的 `define` 字段是否正确配置<br>2. 检查 `JSON.stringify()` 是否包裹<br>3. 重启 dev server（修改 vite.config.ts 必须重启） |
| `import.meta.env.VITE_APP_VERSION` 为 `undefined` | 1. 检查 `.env` 中变量名是否以 `VITE_` 开头<br>2. 检查是否重启了 dev server（`.env` 修改后需要重启）<br>3. 检查 `loadEnv()` 是否正确加载了对应 mode 的 `.env` 文件 |
| 代理不生效 | 1. 检查 `VITE_HTTP_PROXY=Y`<br>2. 检查 `command === 'serve'`（preview 模式不启用）<br>3. Network 面板查看请求是否走了代理（Host 是否变更） |

#### 验证步骤

```bash
# 1. 开发模式验证
pnpm dev
# → 浏览器打开 http://localhost:9527
# → 打开 DevTools → Elements → 检查 <head> 中是否有 buildTime meta（dev 时 html 插件不生效，应无 version）
# → Console 输入 __APP_VERSION__，应输出版本号

# 2. 构建验证
pnpm build
# → 检查 dist/index.html 中是否有 <meta name="appVersion" content="x.x.x">
# → 检查 dist/index.html 中是否有 <meta name="buildTime" content="...">

# 3. 类型检查 + 代码检查
pnpm typecheck
pnpm lint
```

---

### 验收标准

- [ ] **能用**：`pnpm dev` 启动正常，`__APP_VERSION__` 能在组件中正确显示；`pnpm build` 后 dist/index.html 包含 version meta
- [ ] **规范**：新增文件命名符合 kebab-case，组件名 PascalCase + defineOptions，使用 UnoCSS 原子类，导入顺序正确
- [ ] **精进**：
  - 理解 `define` 与 `import.meta.env` 的区别（编译时 vs 运行时）
  - 能解释为什么 `JSON.stringify()` 是必须的
  - 能解释 `apply: 'build'` 的设计意图（区分 dev/build）
  - 代码零 any，类型完整

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| **Vite** | 开发时用原生 ESM 秒启，生产时用 Rollup 打包 | Spring Boot DevTools + Maven package | 双模式设计（esbuild dev + Rollup prod） |
| **ESM 按需加载** | 浏览器直接 `import` 模块，Vite 只编译不改格式 | Java JPMS 模块化 | 浏览器作为运行时加载器，每个模块独立 HTTP 请求 |
| **HMR** | 修改文件 → 局部替换 → 状态保持 | JRebel 热替换 | 通过 WebSocket 推送更新，框架级状态保持 |
| **预构建** | 把 lodash 等库的百个模块打包成单文件 | Maven 依赖下载 + 缓存 | esbuild 在启动时自动完成，无需人工干预 |
| **`VITE_` 前缀** | 只有 `VITE_` 开头的环境变量能进前端代码 | Spring `app.*` 配置暴露 | 安全隔离设计，防止泄露服务端密钥 |
| **`define`** | 编译时文本替换，代码中出现即替换 | Maven `filter` 资源过滤 | 替换发生在 AST 层面，不是字符串替换 |
| **`import.meta.env`** | 运行时读取构建时确定的环境变量 | Spring `Environment` | Vite 注入的特殊对象，Node 和浏览器通用规范 |
| **Vite 插件** | 在构建生命周期的钩子中介入 | Maven 插件 / Gradle Task | 可热插拔，支持 `apply: 'build' \| 'serve'` 条件生效 |
| **`transformIndexHtml`** | 修改最终生成的 HTML | Servlet Filter 修改响应 | 可以注入 meta、script、统计代码等 |

---

## 补充：Vite 配置速查表

```typescript
// vite.config.ts 常见配置项速查
defineConfig({
  base: '/',                    // 应用基础路径（子目录部署时用）
  resolve: {
    alias: { '@': '/src' },    // 路径别名
    extensions: ['.vue', '.ts'] // 导入时省略的后缀
  },
  css: {
    preprocessorOptions: {
      scss: { additionalData: '...' }  // 自动注入全局 SCSS
    }
  },
  plugins: [],                 // 插件数组
  define: {                    // 全局常量
    __VERSION__: JSON.stringify('1.0.0')
  },
  server: {
    port: 9527,                // 开发端口
    proxy: { '/api': 'http://localhost:8080' },  // 代理
    hmr: { overlay: false }    // HMR 错误遮罩
  },
  build: {
    outDir: 'dist',            // 输出目录
    sourcemap: true,           // SourceMap
    rollupOptions: {
      output: {
        manualChunks: {        // 代码分割
          vendor: ['vue', 'vue-router', 'pinia']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['lodash-es']     // 强制预构建的依赖
  }
});
```

---

## 阶段过渡说明

🎉 **恭喜你完成第一阶段第4天的学习！**

前4天你已经建立了现代前端的 **"工具链认知"**：
- Day 1: ES6+ 语法（语言层）
- Day 2: TypeScript 类型系统（类型层）
- Day 3: pnpm + Node.js 生态（包管理层）
- Day 4: Vite 构建工具（构建层）

**明天（Day 5）**将进入 **CSS 与布局系统**：Flexbox、Grid、CSS 变量、响应式设计，以及 carlos-ui 中实际使用的 UnoCSS 原子化方案。你将终于开始写 "看得见" 的代码了！

---

**明日预告**：第5天 — HTML5 / CSS3 快速回顾 — 从 JSP/Thymeleaf 到现代布局（Flexbox、Grid、CSS 变量、响应式、UnoCSS 原子化）
