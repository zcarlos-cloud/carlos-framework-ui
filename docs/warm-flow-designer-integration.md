# Warm-Flow 流程设计器前端集成方案

> 目标：让管理后台（本仓库）能打开 Warm-Flow 1.8.9 自带的流程设计器，完成流程定义的新增 / 编辑 / 查看 / 发布。
> 本文所有关于设计器行为的描述，均来自**解压 `warm-flow-plugin-vue3-ui-1.8.9.jar` 里的真实产物**与 **1.8.9 源码 jar**，
> 不是照抄官网文档（官网 master 文档停留在 2026-04，早于 1.8.9，部分参数已变）。证据位置随文标注。

---

## 0. 结论摘要

| 项 | 结论 |
|---|---|
| 集成方式 | **jar 内置 SPA + iframe 嵌入**（官方唯一推荐；npm 包 `@dromara/warm-flow-designer` 官方自标「实验性」且未发布到 npm） |
| 是否 npm / 源码二开 | **否**。二开静态资源官方要求人工逐版本同步提交记录，维护成本不可接受 |
| **硬约束** | **iframe 必须与本应用同源**。设计器所有请求都是相对路径，且只读自己 origin 的 `localStorage` |
| token 传递 | 走我们已实现的裸 `localStorage`（`Warm-TokenName` / `Warm-Authorization`），**URL 上不带 token**。⚠️ **这是与官网的唯一实质分歧**（官网让人把 token 拼在 URL 上），逐条差异见 §1.9 |
| 需要新增 | 前端 1 个列表页 + 1 个隐藏设计器宿主页；网关 2 条路由 + 1 条认证白名单；后端 2 个前置接口 |
| 最大风险 | access token TTL 默认 **900 秒**，而设计器自身**无续期**，用户编辑超过 15 分钟保存必 401 |
| 好消息 | 官网的办理人 `storageId` 约定（`role:<id>` / `dept:<id>` / 裸 `<userId>`）**与我们已经实现的词汇表逐字兼容**，`D4` 不用新造词表 |

---

## 1. 设计器实测行为（重构认知用，请以此为准）

### 1.1 静态资源与入口

- 设计器 SPA 打包在 `warm-flow-plugin-vue3-ui` 的 `META-INF/resources/warm-flow-ui/` 下，全部产物只有 4 个文件：
  `index.html`、`js/index-BTmmNT3K.js`（3.2 MB）、`css/index-DlKfNZiv.css`、`ico/favicon-FqvijpIH.ico`。
- `warm-flow-plugin-ui-sb-web` 的 `WarmFlowUiConfig#addResourceHandlers` 把它挂在 **`/warm-flow-ui/**`**，
  开关是 `warm-flow.ui`（`matchIfMissing = true`）。我们已在 `carlos-workflow-boot` / `-cloud` 的 yml 里配了 `warm-flow.ui: true`。
- 入口地址：`<后端根>/warm-flow-ui/index.html`。

### 1.2 【关键】所有请求都是相对路径 —— 决定了必须同源

产物里：

```js
const $i = Hq.create({ baseURL: "", timeout: 1e4 });   // axios 实例，baseURL 为空
const jd = "../";                                      // 统一前缀常量
$i({ url: jd + "warm-flow/save-json", method: "post", data: e, headers: { onlyNodeSkip: t } })
$i({ url: jd + "warm-flow/query-def" + e, method: "get" })
$i({ url: jd + "warm-flow/query-flow-chart/" + e, method: "get" })
```

`baseURL` 为空 + url 以 `../` 开头 ⇒ 浏览器按 **iframe 自己的 document URL** 解析。于是：

```
iframe src = http://host/manage-api/warm-flow-ui/index.html?id=1
     ├─ config   →  http://host/manage-api/warm-flow-ui/config
     └─ 数据接口  →  http://host/manage-api/warm-flow/<xxx>
```

**推论（本方案的地基）**：
1. iframe 的 src 必须写成**同源的、带 API 前缀的路径**（`/manage-api/warm-flow-ui/index.html`），
   开发态由 Vite proxy 转发、生产态由网关同源转发。
2. **不能**写成 `http://gateway-host:9510/warm-flow-ui/index.html`。一旦跨源：
   - `localStorage` 不通 ⇒ 请求不带鉴权头 ⇒ 数据接口全 401；
   - 只能退化成官方文档那条「URL 上拼 `&Authorization=`」，而这违反我们既有的安全约束（见 `src/utils/warm-flow.ts:23-25`）。

### 1.3 鉴权头是怎么拼出来的

产物里的 axios 请求拦截器：

```js
const m3 = "Warm-", jq = m3 + "TokenName", Wq = m3 + "Framework";
function kL(e) { return localStorage.getItem(m3 + e) }   // getWarm(key)
function TL() { return localStorage.getItem(jq) }        // getWarm("TokenName")
// 拦截器
if (TL()) {
  const names = TL().split(",");
  for (const n of names) if (kL(n)) e.headers[n] = kL(n);
}
```

- 每次请求前**重读** `localStorage`；键是裸 key（无前缀、无 JSON 包裹）。
- 值形如 `Bearer <token>`，**原样**塞进 header。
- 我们已实现的 `src/utils/warm-flow.ts` 正是按这个机制写入，因此 **token 变更后立即生效，无需重载 iframe**。

### 1.4 `/warm-flow-ui/config` 的作用与匿名性

- `WarmFlowUiController`：`@RequestMapping("/warm-flow-ui")` + `@GetMapping("/config")`，返回 `ApiResult<WarmFlowVo>`
  （注意是引擎的 `ApiResult`，成功码 **200**，不是 Carlos 的 `Result` / `00000`）。
- 返回 `{ tokenNameList: ["Authorization"], framework: "springboot" }`。
  `Authorization` 来自 `WarmFlow.tokenName` 的默认值（`warm-flow-core` 的 `config/WarmFlow.java:108`）。
- 设计器启动时**先**请求 config，再遍历 URL query：**key 命中 `tokenNameList` 的参数才会被写进 localStorage**，
  其余参数一律进 `appParams`。所以「传 token 需要 URL 参数名与后端 `warm-flow.token-name` 一致」这条官方说明是真的，
  **但我们的方案根本不用 URL 传 token**，这条只是解释为什么 `Warm-Authorization` 这个 key 名不能改。
- config 请求包在 `.catch(() => {})` 里，失败不阻断启动 —— 意味着 config 挂了设计器仍能起来（我们预置的 localStorage 兜住了鉴权）。

### 1.5 URL 参数全集（1.8.9 实测）

| 参数 | 取值 | 语义 |
|---|---|---|
| `id` | 定义 id / 实例 id | 设计模式=流程定义 id；**不传即「新增流程」**，设计器会初始化开始/中间/结束三节点 |
| `type` | 缺省 / `FlowChart` | 缺省=设计器；`FlowChart`=只读流程图，此时 `id` 是**流程实例 id**。产物里还有 `form` / `formCreate` 分支，**官方无文档，不使用** |
| `onlyDesignShow` | `true` / `false` | `true` 只显示流程画布，隐藏「流程基础信息」面板 |
| `disabled` | `true` / `false` | `true` 强制只读。**1.8.0 起可省**：产物里 `isPublish` 为真时**自动只读** |
| `theme` | `theme-light`（默认）/ `theme-dark` | 主题（另有 postMessage 通道，见 1.6） |
| `darkColors` | 如 `111827` | 深色主题基色，仅深色下生效 |
| `showGrid` | `true` | **必须显式传 `showGrid=true` 才显示网格**（判定是 `=== "true"`）；设计器与流程图**都吃这个参数** |

> **重要副作用**：`isPublish` 为真 ⇒ 设计器自动只读。所以「已发布的流程定义」在设计器里**改不了**，
> 列表页必须有「撤销发布」（引擎 `DefService#unPublish`）或「复制新版本」（`copyDef`）入口。
>
> 官网[《设计器集成》](https://www.warm-flow.com/master/primary/designerIntroduced.html) 2.2 节列的是
> `id` / `onlyDesignShow` / `disabled` / `theme` / `darkColors` / `token` 六项（`showGrid`、`type` 在
> [《流程图管理》](https://www.warm-flow.com/master/primary/chart_manage.html) 那页）。官网对 `disabled` 的措辞
> 「是否可编辑, true:不可标记 false:可标记」有笔误，含义是 **`true` = 不可编辑**（本文以产物里的 `=== "true"` 分支为准）。
> 官网另给了「前后端不分离」的 `@Controller` 重定向写法，我们不需要（见 §1.9 第 9 条）。

### 1.6 postMessage 协议（实测，与官方文档一致）

**设计器 → 宿主**（宿主必须监听）：

```js
{ method: "getTheme" }   // 设计器挂载时主动索要当前主题
{ method: "close" }      // 保存成功、或用户点设计器的关闭按钮
{ method: "formInit" }   // 仅表单设计器使用，本项目不涉及
```

**宿主 → 设计器**：

```js
iframeEl.contentWindow.postMessage({ type: 'theme-dark', darkColors: '111827' }, '*');
// 设计器侧：window.addEventListener("message", a)，a 里 switch (e.data.type) { case 'theme-dark': ... }
```

⚠️ 时序：设计器在自身 `onMounted` 里就发 `getTheme`，宿主必须**先挂监听、再设 iframe.src**，否则会漏掉这一枪。

### 1.7 设计器调用的是引擎端点，不经过我们的服务层

`/warm-flow/**` 端点清单（源码 `WarmFlowController`）：

```
POST /warm-flow/save-json          （必须带 header onlyNodeSkip，缺失 400）
GET  /warm-flow/query-def[/{id}]
GET  /warm-flow/query-flow-chart/{id}
GET  /warm-flow/handler-type  /handler-result  /handler-feedback  /handler-dict
GET  /warm-flow/published-form  /form-content/{id}
POST /warm-flow/form-content
GET  /warm-flow/execute/load/{taskId}  /execute/hisLoad/{taskId}
POST /warm-flow/execute/handle
GET  /warm-flow/node-ext  /listener-list
```

**必须记住这点**：`POST /warm-flow/save-json` 直写引擎，**绕过 `carlos-workflow` 的 `WorkflowDefinitionService#save`**。
我们实现的办理人 fail-fast 校验（`WorkflowAssigneeFailFastListener`）挂在「发起/办理」路径上，
**拦不住设计器保存动作**。定义阶段的办理人正确性只能靠：① 设计器侧的选择约束（见 §4.2），② 运行期 fail-fast 兜底。

### 1.8 两套命名空间（**别混**）

框架约定（我读过 `carlos-org` / `carlos-system` 的代码确认过）：

| | Feign 契约（服务间） | 前端接口（经网关） |
|---|---|---|
| 路径 | `/api/<服务>/**` | `/<服务>/**` |
| 落点 | `api` 的 `@FeignClient` 接口 + `bus/**/apiimpl/` 的 `@RestController implements ApiXxx` | `bus/**/controller/` 的**普通 `@RestController`**（不 implements 任何 Api 接口） |
| 例子 | `ApiOrgUser` 的 `path="/api/org/user"`、`ApiSysConfigImpl` → `/api/sys/config` | `OrgUserController` → `org/user`、`SysConfigController` → `/sys/config` |
| 网关 | **不路由** | 路由 `Path=/<服务>/**` |

网关前缀剥离的真相（容易搞错，`SelectStripPrefixGatewayFilterFactory#computeShouldStrip` 只看得到
`/doc.html`、`/swagger-ui/**`、`/v3/api-docs/**` 这些）：**业务路径原样透传，不削段**。
所以前端调 `/manage-api/sys/news/unread-count`，网关剥掉统一前缀 `/manage-api` 后，服务端收到的就是
`/sys/news/unread-count`。工作流同理：前端 `/manage-api/workflow/**` → 服务端 `/workflow/**`。

**`carlos-workflow` 的两套端点**：

| 前端（经网关，`/workflow/**`） | 服务间（Feign，`/api/workflow/**`，不经网关） |
|---|---|
| `POST|DELETE /workflow/definition`（保存 / 删除） | `GET /api/workflow/definition/published` — 可选流程清单 |
| `GET /workflow/definition/page`、`/{id}` | `POST /api/workflow/instance/start` — 发起流程 |
| `POST /workflow/definition/publish`、`/unpublish`、`/copy` | `GET /api/workflow/instance/{id}/chart` — 进度图数据 |
| `GET /workflow/task/todo/page`、`done/page` | `GET /api/workflow/task/{taskId}` — 读单个任务 |
| `GET /workflow/task/{taskId}/candidates` | `GET /api/workflow/his-task/{hisTaskId}` — 读历史任务 |
| `POST /workflow/task/handle`（按 action 分派 9 个动作） | |
| `GET /workflow/instance/{id}/his-task`、`any-node` | |
| `POST /workflow/instance/revoke`、`terminate`、`{id}/suspend`、`{id}/activate` | |

> 边界由 `WorkflowNamespaceBoundaryTest` 守住：前端 Controller 不得 implements `api` 包的接口、
> 不得挂到 `/api` 前缀下，且两套端点的映射集合交集必须为空。
>
> ⚠️ **曾经这两个命名空间是混着的**：所有端点都定义在 Feign 接口上、路径统一 `/api/workflow/**`，
> 然后网关还路由了 `/api/workflow/**` —— 等于把服务间命名空间暴露到了外部。已纠正。

### 1.9 与官网[《设计器集成》](https://www.warm-flow.com/master/primary/designerIntroduced.html)的差异（逐条）

官网那页我逐段核对过。**我们跟它只在「token 怎么传」这一件事上主动分歧，其余全部一致**：

| # | 官网怎么说 | 我们的做法 | 为什么 |
|---|---|---|---|
| 1 | 依赖 `warm-flow-plugin-ui-sb-web` | 一致 | — |
| 2 | 放行 `/warm-flow-ui/**` 与 `/warm-flow/**` | 一致，网关加白名单 | 官网第 4 节又改成「只放行 `/warm-flow-ui/**`」，我们采用第 4 节的版本 |
| 3 | iframe `src = ip:port/warm-flow-ui/index.html?id=…&onlyDesignShow=…&disabled=…` | 一致，但 src 是**同源相对路径** `/manage-api/warm-flow-ui/index.html` | 见 §1.2；官网第 3 节微服务示例也是带网关前缀的（`/flow/warm-flow-ui/...`），做法同源 |
| 4 | **`&Authorization=${token}` —— token 拼在 URL 上** | ❌ **不做**，改用 `localStorage['Warm-Authorization']` | 这是唯一实质分歧。URL 会进浏览器历史、`Referer`、网关访问日志；既有代码已把「不带 token 参数」写成硬约束（`src/utils/warm-flow.ts:23-25`）。官方文档对这一点的风险**只字未提**，也没给替代方案 |
| 5 | `onlyDesignShow` / `disabled` / `theme` / `darkColors` | 一致 | `disabled=true` 即只读，与官网一致，也从产物里确认了 `disabled==="true"` 的分支 |
| 6 | 官网未提 `showGrid`、`type=FlowChart`（在[《流程图管理》](https://www.warm-flow.com/master/primary/chart_manage.html)那页） | 采纳 | 从产物确认 `showGrid === "true"`、`type` 用于分派组件 |
| 7 | 官网只演示监听 `{method:'close'}` | 额外处理 `{method:'getTheme'}` | 产物里设计器挂载时会主动向父窗口发 `getTheme` 索要主题，官网没写。不处理就永远是浅色 |
| 8 | 微服务示例：网关路由 `Path=/flow/**` + `StripPrefix=1` | 我们用 `Path=/warm-flow-ui/**,/warm-flow/**`，**不加 strip** | 两者等价：官网的 `/flow` 前缀和我们的 `/manage-api` 前缀在做同一件事——保证 iframe 文档路径的**深度**与后端真实路径的深度差恰好是 1 层。我们网关的 `PrefixWebFilter` 已经统一剥了 `/manage-api`，所以不需要再 strip |
| 9 | 官网给了「前后端不分离」的 `@Controller` 重定向写法 | 不做 | 我们前端是独立 SPA，不需要后端转发 |
| 10 | 五个 SPI 的接口签名 | 一致，但**以源码 jar 为准** | 官网 5.2.1 把 `getHandlerSelect` 的返回类型写错成 `List<HandlerSelectVo>`；6.2.1 的 `handlerFeedback` 少写一个参数。详见 §4.2 |

---

## 2. 前端要新增的东西（文件级清单）

### 2.1 目录与路由

elegant-router 的规则：`src/views/<a>/<b>/index.vue` → route key `<a>_<b>`，path `/<a>/<b>`。

| 页面文件 | route key | path | 说明 |
|---|---|---|---|
| `src/views/workflow/definition/index.vue` | `workflow_definition` | `/workflow/definition` | 流程定义列表（侧边栏可见） |
| `src/views/workflow/design/index.vue` | `workflow_design` | `/workflow/design` | **设计器宿主页（侧边栏隐藏，靠 URL 直达）** |

配套（列表页按本仓库既有约定拆三件套）：

```
src/views/workflow/definition/
├── index.vue
└── modules/
    ├── definition-search.vue
    └── definition-operate-drawer.vue
```

生成路由与类型：**`pnpm gen-route`**（或跑一次 `pnpm dev`，elegant-router 插件会重写
`src/router/elegant/{routes,imports,transform}.ts` 与 `src/typings/elegant-router.d.ts`）。
这四个文件顶部写着 `// Generated by elegant-router`，**不要手改**。

### 2.2 设计器宿主页 `workflow_design`

职责只有 4 件，别塞别的：

1. 从 `route.query` 取 `id` / `mode`（`design` | `view` | `chart`），拼出 iframe src；
2. 挂 `window.addEventListener('message')`：
   - `getTheme` → `postMessage({ type: 当前主题, darkColors })`
   - `close` → 关闭/返回定义列表；
3. 主题切换时（`useThemeStore`）再向 iframe `postMessage({ type })`；
4. 页面存续期间做 token 心跳续期（见 §3.2）。

参数拼装规则（集中在 `src/utils/warm-flow.ts` 里做，不要散落在页面）：

| 场景 | query |
|---|---|
| 新增流程 | `?onlyDesignShow=true&showGrid=true`（**不传 id**） |
| 编辑流程 | `?id=<defId>&onlyDesignShow=true&showGrid=true` |
| 查看流程（已发布） | `?id=<defId>&onlyDesignShow=true&disabled=true&showGrid=true` |
| 查看流程图（实例） | `?id=<instanceId>&type=FlowChart&showGrid=true` |

> **`keep_alive` 必须是 `FALSE`**。设计器只在挂载时读一次 URL 参数，若被 `<KeepAlive>` 缓存，
> 从定义 A 跳到定义 B 会复用旧实例、显示旧内容。宁可重新加载 iframe。

### 2.3 API 层

- 新文件 `src/service/api/workflow.ts`，在 `src/service/api/index.ts` 加一行 `export * from './workflow';`
- 类型命名空间 `Api.Workflow` 加在 `src/typings/api.d.ts`，分页四件套沿用本仓库约定：
  `WorkflowDefinition` / `WorkflowDefinitionSearchParams` / `WorkflowDefinitionList` / `WorkflowDefinitionOperateParams`
- 走标准 `request<Api.Workflow.Xxx>({ url: '/workflow/...' })`
  （**注意**：我们自己的接口是 `Result`，成功码 `00000`，由现有 axios 实例处理；
  设计器内部的 `ApiResult`/200 与我们无关，我们不要替它发请求）

**前端绝不要自己去请求 `/warm-flow/**`**。那是设计器 iframe 内部的事，两套信封混在一起只会制造事故。

### 2.4 i18n

在 `src/locales/langs/zh-cn.ts` 与 `en-us.ts` 的 `route` 对象里各加两条：

```ts
workflow: '工作流',
workflow_definition: '流程定义',
workflow_design: '流程设计',
```

（`route` 是后端可覆盖命名空间，但**键**必须在本地文件里，否则 `pnpm typecheck` 直接失败。）

### 2.5 菜单 SQL

新文件 `docs/sys_menu_workflow_migration.sql` + `docs/sys_menu_workflow_migration_rollback.sql`，
模板照抄 `docs/sys_menu_sequence_migration.sql`（当前最新的单页最小样例；**不要**照抄已失效的 `sys_menu_job_migration.sql`）。

结构：

```
工作流  /workflow            layout.base        menu_category=1  parent_id=0
├─ 流程定义  /workflow/definition  view.workflow_definition   menu_category=2  可见
└─ 流程设计  /workflow/design      view.workflow_design       menu_category=2  hide_in_menu=TRUE
                                                              active_menu='workflow_definition'
```

硬约束（踩过坑，逐条继承）：

1. PG 下 `hide_in_menu` / `keep_alive` / `constant` / `multi_tab` 是 **BOOLEAN，写 `TRUE`/`FALSE`**，不能写 1/0；
2. 顶级菜单 `parent_id` 必须是 **`0`**，不是 `NULL`；
3. 子菜单的 `parent_id` **用子查询取**（`WHERE m.route_name = 'workflow'`），不要硬编码 id；
4. `route_name` 必须与 elegant-router 生成的 key **逐字一致**，`route_path` 必须与
   `src/typings/elegant-router.d.ts` 里的 path 逐字一致；
5. `menu_status = 1` 是**启用**（禁用是 2，写 2 会让整棵子树从路由表消失，页面变 not-found）；
6. 「隐藏但仍可路由」只能靠 `hide_in_menu = TRUE`，**不能**靠 `menu_status = 2`；
7. `id` 取雪花值，不能与既有行冲突（当前号段占用：`...959`~`...964`、agent 用 `2100621000000000001`）；
8. 执行完 SQL 必须**重新登录**才会重拉菜单树；
9. 不要用 `scripts/gen-sys-menu-sql.cjs` 做增量（它整表重建 + id 用 `Date.now()`，会让 `sys_operation.menu_id` 全部失效）。

---

## 3. 关键设计点

### 3.1 同源地址推导（必须做对，否则整条链路废掉）

在 `src/utils/warm-flow.ts` 里加一个唯一入口：

```ts
/** 设计器静态资源在“同源 API 前缀”下的相对路径 */
export const WARM_FLOW_UI_PATH = 'warm-flow-ui/index.html';

/** 取同源 API 前缀；跨源时抛错（设计器在同源之外无法工作） */
function resolveApiBasePath(): string { /* 见下 */ }

export function buildWarmFlowDesignerUrl(config: { id?: string; mode?: ... }): string
```

`resolveApiBasePath()` 的规则：

- `VITE_HTTP_PROXY === 'Y'` ⇒ 返回 `'/manage-api'`（Vite proxy 会把 `/manage-api` 去掉后转发到网关，
  与 `src/utils/service.ts` 的 `createProxyPattern()` 一致）；
- 否则解析 `VITE_SERVICE_BASE_URL`：
  - 若它是相对路径（以 `/` 开头）⇒ 直接用；
  - 若是绝对 URL ⇒ 用 `new URL(...)` 取 `.pathname`，并**校验 origin 是否等于 `window.location.origin`**，
    不等则 `console.error` 并降级为不可用（宁可不打开，也不要静默 401）。

> ⚠️ **`.env.prod` 当前是 `VITE_SERVICE_BASE_URL=http://localhost:8080/manage-api`**。
> 若生产上前端与网关不同源，这条会直接触发上面的报错。需要把生产配置改成同源相对路径
> （`/manage-api`），或让前端站点与网关走同一个域名+端口的反向代理。**这是必须做的部署侧改动。**

### 3.2 token 续期（已实现）

事实：`AUTH_ACCESS_TOKEN_TTL` 默认 **900 秒**（15 分钟）；前端现有的续期策略是**被动 401 才刷新**
（`src/service/request/shared.ts:15-43`）；而设计器 iframe 里的请求**不经过我们的 axios 实例**，
它的 401 我们收不到，也不会触发刷新。用户在设计器里画 20 分钟再保存 ⇒ 必 401，且**设计器没有任何提示**。

**实现**：`src/hooks/business/warm-flow-token.ts`（`ensureWarmFlowToken()` + `useWarmFlowTokenKeepAlive()`），
设计器宿主页与流程图弹窗都接了。

几个设计决定，都不是随手定的：

1. **提前续期，不是定时探活。** 探活只能发现「已经过期」，从过期到刷完之间存在盲区，
   用户恰好在这段时间点保存就丢数据；而按到期时间**提前 2 分钟**续期，盲区是 0。
2. **到期时间从哪来**：`saveAuthStorage` 会把后端 `/auth/user/login` 与 `/auth/user/refreshToken`
   返回的 `expiresIn`（秒）换算成 `tokenExpiresAt` 存下来。**距到期还早时心跳一个请求都不发** ——
   不是「每 30 秒 ping 一次」那种假心跳。
3. **续期复用 401 链路那一次刷新**（`handleExpiredRequest`），从而沿用它「同一时刻只允许一个刷新在飞」
   的去重。refresh token 是**轮换**的，如果心跳和业务请求的 401 各自刷一次，后到的那次必然失败并把用户登出。
4. **启动前先续期**：设计器启动后立刻就会查定义，那一刻 localStorage 里必须已经是有效 token ——
   宿主页是 `await ensureWarmFlowToken()` 之后才设 `iframe.src` 的。流程图弹窗同理（靠 `tokenReady` 闸门）。
5. **切回前台立刻检查**：`setInterval` 在后台标签页会被节流到 ≥1 分钟，而用户从别的窗口切回来时
   往往正是 token 已经过期的时候，所以额外监听 `visibilitychange`。
6. **刷新令牌也废了的时候**：`handleExpiredRequest` 内部已经 `resetStore()` 清空会话，
   路由守卫会把用户送回登录页。对设计器来说这一步代价特别大（画布上未保存的内容会丢），
   所以要显式提示一句（`page.workflow.session.expired`），且**只提示一次**不刷屏。

不做这一步，设计器就是个「15 分钟后注定丢数据」的功能。

### 3.3 深浅主题

我们的应用切主题时，设计器 iframe 不会自己知道。做法：

- `onMounted` 先 `addEventListener('message')`，然后再设 `iframe.src`；
- 收到 `{ method: 'getTheme' }` ⇒ 回 `postMessage({ type: themeStore.darkMode ? 'theme-dark' : 'theme-light', darkColors }, '*')`；
- 监听 `themeStore.darkMode` 变化，变化时再 `postMessage` 一次（设计器收到即切换，无需重载）；
- 兜底：iframe src 上也带 `theme=...`（设计器 `initFromUrl` 会读），两道保险。

### 3.4 关闭语义

设计器发 `{ method: 'close' }` 有两个来源：保存成功后、用户点设计器的关闭按钮。两者无法区分。
建议统一处理为：**回到流程定义列表并刷新一次**（`router.replace('/workflow/definition')` + 列表重新查询）。
若宿主页是独立浏览器标签打开的，则 `window.close()`。

### 3.5 权限边界：`/warm-flow/**` 是「有认证、无授权」

必须点明一个现状：网关的 `carlos.gateway.oauth2.authorization-enabled` 当前是 **`false`**
（`carlos-gateway/src/main/resources/application.yml` 里明确注释了原因：权限数据模型还没对齐，开了会拦掉所有业务请求）。

后果：**任何登录用户**都能直接

```
POST /manage-api/warm-flow/save-json       ← 建/改流程定义
GET  /manage-api/warm-flow/query-def/1     ← 读任意流程定义
```

也就是说设计器这套引擎端点目前是「登录即通」。菜单隐藏只影响侧边栏渲染，不是访问控制。

三个选项（需要你选）：

| | 做法 | 代价 |
|---|---|---|
| (a) | 接受现状，靠内部框架 + 登录门槛 | 内网可接受，但一旦对外开放就是漏洞 |
| (b) | 在 `carlos-workflow` 里给 `/warm-flow/**` 加一层自己的鉴权（例如要求某个权限码） | 会**同时拦掉设计器**，因为设计器请求带的是业务 token，没有这个权限码；得再放行部分路径，容易越弄越乱 |
| (c) | 打开网关 `authorization-enabled`，把权限模型补齐 | 正解，但是独立的、更大的工程 |

**我的建议**：本期按 (a)，但把这条写进 `carlos-workflow/README.md` 的「已知限制」，
并作为 (c) 的立项理由留档。**不要**选 (b)。

---

## 4. 后端 / 网关前置（不做的话前端就是空壳）

### 4.1 【P0】流程定义的管理接口

设计器必须挂在定义列表上，而我们现在只有 `listPublished()`，没有分页列表。
需要补齐（全部按框架规范落 **Manager 层 + MyBatis-Plus / mybatis-plus-join，严禁手写 SQL**）：

| 接口（全部在 `/workflow/**`，落在 `bus/**/controller/`） | 实现要点 |
|---|---|
| `GET /workflow/definition/page` | 新建 `WorkflowDefinitionManager extends BaseServiceImpl<FlowDefinitionMapper, Definition>`；支持按名称/编码/分类/发布状态过滤 + 分页 |
| `GET /workflow/definition/{id}` | 详情 |
| `POST /workflow/definition/publish`、`/unpublish` | 直接委派引擎 `DefService#publish` / `unPublish` |
| `POST /workflow/definition/copy` | 委派 `DefService#copyDef`（已发布流程要改就得走这条） |
| `DELETE /workflow/definition` | 委派 `DefService#removeDef` |

`FlowDefinitionMapper` / `FlowInstanceMapper` / `FlowTaskMapper` / `FlowNodeMapper` / `FlowSkipMapper` / `FlowUserMapper` / `FlowFormMapper` 在 `warm-flow-mybatis-plus-core` 里已提供，可直接作为 `BaseServiceImpl` 的 Mapper 泛型参数。

### 4.2 【P0】设计器侧的办理人选择 SPI

现状：`carlos-workflow` **没有**实现 `HandlerSelectService`。后果（源码 `WarmFlowService#handlerType` 已确认）：

- `GET /warm-flow/handler-type` → **返回空数组** ⇒ 设计器「办理人权限设置」的标签页是**空的**；
- `GET /warm-flow/handler-result` → 返回空 VO；
- 用户只能**手输** `permissionFlag`，无法从组织树/角色里点选。

#### 精确接口（1.8.9 源码 jar，别照抄官网文字——官网示例与接口对不上）

```java
public interface HandlerSelectService {
    List<String> getHandlerType();                       // 标签页名字，如 ["用户","角色","部门"]
    HandlerSelectVo getHandlerSelect(HandlerQuery query); // 注意：返回单个 VO，不是 List
    default List<HandlerFeedBackVo> handlerFeedback(List<String> storageIds) { ... }
    // 另有两个 default 便捷方法直接可用：getHandlerSelectVo(HandlerFunDto[, TreeFunDto])
}
```

> 官网 5.2.1 的接口清单把 `getHandlerSelect` 写成 `List<HandlerSelectVo>`，与实现类和真实接口（`HandlerSelectVo`）不一致；
> 官网 6.2.1 的 `handlerFeedback` 签名也比真实接口少了一个参数。**以源码 jar 为准。**

配套类型（都在 `warm-flow-plugin-ui-core`）：

| 类型 | 关键字段 |
|---|---|
| `HandlerQuery` | `handlerType`（**就是 `getHandlerType()` 返回的那个字符串本身**，用它做分派）、`handlerCode`、`handlerName`、`groupId`、`pageNum`、`pageSize`、`beginTime`、`endTime` |
| `HandlerSelectVo` | `handlerAuths`（`FlowPage<HandlerAuth>` 右侧列表 + 分页）、`treeSelections`（`List<Tree>` 左侧树） |
| `HandlerAuth` | `storageId`（入库主键）、`handlerCode`、`handlerName`、`groupName`、`createTime` |
| `HandlerFeedBackVo` | `storageId`、`handlerName` |

注意 `handlerType` **是标签页的显示名**（官网示例直接返回 `["用户","角色","部门"]`），不是 `user/role/dept`。
它只在一次请求里往返，不进库，所以我们可以自定义；但既然它是 opaque 字符串，**直接用官网那三个中文名最省事**
（唯一的代价是后端写死三个中文字面量）。

#### 【好消息】官方 storageId 约定与我们已实现的词汇表天然兼容

设计器把选中的办理人按 `storageId` 拼进 `flow_node.permission_flag`，**`@@` 分隔**（产物实测：
`permissionFlag: Array.isArray(g) ? g.filter(_=>_).join("@@") : g`）。官方约定的 `storageId` 构造是：

| 设计器标签 | 官方 `storageId` | 我们 `WorkflowAssigneeVocabulary` 的写法（`docs/design/workflow-assignee-expression-spec.md` §3） | 兼容 |
|---|---|---|---|
| 角色 | `"role:" + roleId` | `role:5` | ✅ **逐字相同** |
| 部门 | `"dept:" + deptId` | `dept:12`（默认不含子部门；要递归得写成 `dept:12:rec`） | ✅ 逐字相同 |
| 用户 | `userId.toString()`（**裸 id，无前缀**） | 词汇表把无冒号的 token 判为 `Kind.LITERAL`，原样交给引擎比较 → 裸用户 id 可用 | ✅ 可用 |

**结论：`D4` 不需要新造词表，直接产出官方那三种 `storageId` 即可，一条映射都不用加。**
唯一要显式决定的是部门的语义：官方示例的 `dept:<id>` 给我们会被解析成「不含子部门」。
如果业务上要「本部门及以下都能办」，需要在 `getHandlerSelect` 里就产出 `dept:<id>:rec`（用户看到的标签写「部门(含下级)」），
而不是运行期再改语义。

`handlerFeedback` 建议**重写**（官网也这么说，默认实现会把所有类型全量拉一遍，人多了很慢）：
按 `role:` / `dept:` 前缀分流、其余当用户裸 id，批量查 `carlos-org` 拿名称。
不重写的直接后果是设计器里显示一长串 `role:5,dept:12` 而不是「管理员 / 研发部」。

### 4.3 【P1】流程分类 SPI

```java
public interface CategoryService { List<Tree> queryCategory(); }
```

未实现 ⇒ 设计器「流程分类」下拉为空（`WarmFlowService#queryDef` 里 `FrameInvoker.getBean(...)` 返回 null 时已优雅降级）。
官网提醒：`Tree` 要**多设 `parentId`** 才会被组件自动构建成树，否则退化成单选。

若要分类，需要：后端实现该 SPI（建议直接用 `sys_dict` 的一个字典类型，不要新增表），
列表页的 `definition-search.vue` 同步加分类下拉。**分类值会落到 `flow_definition.category`**，列表页过滤按它做。

### 4.4 【P2 / 不做】表单路径 SPI

`FormPathService#queryFormPath()` 未实现时，`queryDef` 不会把 `formCustom` 默认成 `Y`，
设计器上不会出现「自定义表单」入口。本项目定位是**人工审批**，不涉及业务表单，**建议不做**。

`HandlerDictService` / `NodeExtService` / `ListenerListService` 同理：不实现只是对应下拉为空，不阻塞主流程。

### 4.5 网关改动（`carlos-integration/carlos-gateway/src/main/resources/application.yml`）

现状：设计器新前缀**不会自动被放行**，必须显式配。注意网关有**两个不同的白名单**，别搞混：

| 配置项 | 作用 | 我们要不要加 |
|---|---|---|
| `carlos.gateway.whitelist` | 名义上是「跳过 `/manage-api` 前缀剥离」 | ❌ **不要加 `/warm-flow-ui/**`**。注意 `PrefixWebFilter.java:56-60` 里那段白名单判断**目前是注释掉的**，所以现在加了也无效；但一旦被重新启用，加了就会导致前缀不被剥离、路由匹配不上。属于「埋雷」，别加 |
| `carlos.gateway.oauth2.whitelist` | **跳过 token 校验（匿名放行）** | ✅ 加 `/warm-flow-ui/config`（或整个 `/warm-flow-ui/**`）。条目按**剥离后**的路径匹配，所以写 `/warm-flow-ui/...` 而不是 `/manage-api/warm-flow-ui/...`。`/warm-flow/**` 必须保持鉴权 |

路由（`Path` 谓词**不写** `/manage-api`，因为 `PrefixWebFilter` 先剥离）：

```yaml
            # 工作流审批中心（前端接口，经网关）
            # 与 /sys/**、/org/**、/agent/** 同形
            -
              id: carlos-workflow
              uri: lb://carlos-workflow
              predicates:
                - Path=/workflow/**
              filters:
                - SelectStripPrefix=1

            # Warm-Flow 设计器：静态资源与引擎数据接口
            # 不写 filters（SelectStripPrefix 对业务路径本就不生效，这里靠 PrefixWebFilter 剥 /manage-api 就够了）
            # ⚠️ 不要在这里路由 /api/workflow/** —— 那是服务间 Feign 契约的命名空间，
            #    与 /api/org/**、/api/sys/** 一样只走服务发现、不经网关
            -
              id: carlos-workflow-warmflow
              uri: lb://carlos-workflow
              predicates:
                - Path=/warm-flow-ui/**,/warm-flow/**
```

**为什么这里要写 `SelectStripPrefix=1`，而设计器那条不写？**
先纠正一个常见误解：`SelectStripPrefix` **不会削业务路径**。它只看得到 `/doc.html`、`/swagger-ui/**`、
`/v3/api-docs/**` 这类文档路径（`computeShouldStrip`），业务路径一律原样透传。所以两条路由都不会
被削段；`/workflow/**` 那条加上它纯粹是为了和 `/sys/**`、`/org/**` 的写法保持一致。
真正削掉统一前缀 `/manage-api` 的是 `PrefixWebFilter`。

### 4.6 【可选】开发态直接连单体应用

若某天不走网关直连 `carlos-workflow-boot:9518`，`build/config/proxy.ts` 现有的
`/manage-api` → 去前缀转发刚好也成立，无需改代码。

---

## 5. 实施顺序（每步都可独立验证）

1. **网关 yml**：加 2 条路由 + 1 条 oauth2 白名单。验证：浏览器直达
   `http://<gateway>/manage-api/warm-flow-ui/index.html` 能出设计器、`/manage-api/warm-flow-ui/config` 返回 `code:200`。
2. **后端 P0 定义管理接口** + 单测。验证：`/manage-api/workflow/definition/page` 返回 `code:00000`。
3. **前端 `src/utils/warm-flow.ts` 扩展**：`resolveApiBasePath()` + `buildWarmFlowDesignerUrl()`。
   验证：`pnpm typecheck` 干净；dev 下控制台打印拼装结果，确认是 `/manage-api/warm-flow-ui/index.html?...`
   而不是绝对 URL（本仓库**没有**测试框架，不为其新增测试目录）。
4. **前端设计器宿主页 `workflow_design`** + i18n + `pnpm gen-route`。
   验证：手工直达 `/workflow/design?id=<真实定义id>`，画布能加载节点、能保存、保存后 `flow_node`/`flow_skip` 有数据。
5. **流程定义列表页 `workflow_definition`**（搜索/分页/设计/发布/撤销发布/复制/删除）+ 菜单 SQL。
6. **token 心跳续期**。验证：把 TTL 调成 60 秒，在设计器里待 3 分钟后保存，仍成功。
7. **后端 P0 办理人选择 SPI**。契约测试要断言：`getHandlerSelect` 产出的 `storageId`
   与 `WorkflowAssigneeVocabulary` 的解析结果一致（`role:5` → `Type.ROLE`、`dept:12` → `Type.DEPT`、
   裸 `1001` → `Kind.LITERAL`），并断言 `@@` 拼接后能被词汇表原样拆开。**这条测试比 UI 更容易漏，务必写。**

---

## 6. 需要决策的点

| # | 问题 | 备选 | 我的建议 |
|---|---|---|---|
| D1 | 设计器宿主页形态 | (a) 隐藏路由页 + `layout.base`（带侧边栏/页签）；(b) 独立浏览器标签全屏；(c) 列表页内弹窗 | **(a)**。刷新安全、URL 可分享、与既有菜单机制一致；(b) 留作「大屏编辑」的可选入口 |
| D2 | token 过期的用户体感 | (a) 只做静默心跳；(b) 心跳 + 过期时显式提示 | **(b)**，已实现：提前续期 + 失效时提示一次（`page.workflow.session.expired`）。见 §3.2 |
| D3 | 已发布流程的修改路径 | (a) 只给「撤销发布」；(b) 只给「复制新版本」；(c) 两者都给 | **(c)**，但默认动作是「复制新版本」（撤销发布会影响在跑的实例） |
| D4 | 办理人选择 SPI 的 storageId 词表 | (a) 直接复用官方约定（`role:<id>` / `dept:<id>` / 裸 `<userId>`）；(b) 另立一套短码再映射 | **(a)**，而且**成本为零** —— 官方约定与我们 `WorkflowAssigneeVocabulary` 已实现的写法逐字兼容（§4.2）。真正要单独拍板的是**部门的递归语义**：`dept:<id>` vs `dept:<id>:rec` |
| D5 | 生产 `VITE_SERVICE_BASE_URL` 是否改成同源相对路径 | (a) 改；(b) 不改，靠部署层同源反代 | **必须二选一做到同源**，否则设计器整体不可用（§3.1） |
| D6 | 流程图查看（`type=FlowChart`）本期是否做 | (a) 本期只做设计器；(b) 顺手把只读流程图也做了 | **(b)**：同一个宿主页加一个 `mode` 分支，成本极低，但需要实例数据（待办页）才有入口 —— 可先留空 |
| D7 | **是否确认偏离官网的 `&Authorization=${token}`** | (a) 保持偏离，走同源 + localStorage；(b) 按官网把 token 拼 URL | **(a)**。但这是**我们唯一没跟官网走的地方**，请明确点头。代价是「iframe 必须同源」成了整个方案的地基（§3.1 的 D5 因此不可协商） |
| D8 | `/warm-flow/**` 有认证无授权（任何登录用户可改流程定义） | (a) 本期接受，记入已知限制；(b) 在 workflow 侧自己加鉴权；(c) 补齐网关权限模型 | **(a)**，并把 (c) 立项。**不要选 (b)** —— 会同时拦掉设计器自己的请求，越弄越乱（§3.5） |

---

## 7. 明确不做的事

- **不用 npm 包 `@dromara/warm-flow-designer`**：官方 README 自标实验性、包名未定、npm 上 404，只有本地 `build:lib` 产物。
- **不二开设计器静态资源**：官方要求人工同步逐版本提交记录，我们不做这种长期负债。
- **不在 URL 上带 token**：既有安全约束（`src/utils/warm-flow.ts:23-25`），且同源方案下没有必要。**这是与官网的唯一实质分歧**（官网 2.2/4 节都让人把 token 拼在 URL 后）。
- **不用官网 2.2 节那个「前后端不分离」的 `@Controller` 重定向**：我们前端是独立 SPA。
- **不让前端直接调 `/warm-flow/**`**：那是 iframe 内部的世界，信封是 `ApiResult`/200，混进来只会制造两套成功码。
- **不碰 `warm-flow.token-name` 配置**：默认值 `Authorization` 与我们已实现的 `Warm-Authorization` key 一致，改了就要同步改前端常量。
- **不实现 `FormPathService`**：我们不做业务表单，官网第 8 节那套「动态表单/自定义表单」整节跳过。
