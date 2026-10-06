/**
 * Warm-Flow 流程设计器 Token 同步
 *
 * 后端在 `/warm-flow-ui/index.html` 挂的是第三方 SPA（Warm-Flow 自带的设计器），
 * 以 iframe 嵌入本应用。它带着自己的 axios 请求拦截器，**每次请求前**直接从 localStorage 读数：
 *
 *   localStorage['Warm-TokenName']       header 名列表（逗号分隔），本应用恒为 `Authorization`
 *   localStorage['Warm-Authorization']   header 值，即 `Bearer <accessToken>`
 *
 * 设计器自身没有任何续期逻辑，access token 过期后它的保存/查询请求会持续 401 且无提示，
 * 用户会丢失编辑内容。因此本模块只做一件事：本应用每次写入/清除 token 时，把这份副本同步过去。
 * 设计器每次请求都会重读，**改值即可，无需重载 iframe**。
 *
 * ⚠️ 必须用**原生 localStorage**，不能用 `@/utils/storage` 的 localStg（见 src/utils/storage.ts）：
 *
 * 1. localStg 会给 key 加上 `VITE_STORAGE_PREFIX` 前缀，写成 `<prefix>Warm-Authorization`，
 *    设计器按裸 key 读，永远读不到；
 * 2. localStg 的 value 会 `JSON.stringify`，写进去是带引号的 `"Bearer xxx"`，
 *    而设计器把取到的字符串**原样**塞进 header，多一对引号就是非法 token。
 *
 * 所以这里的 key 与值都按原样写。**请勿"顺手"改成 localStg**。
 *
 * ⚠️ 加载设计器时不要在 URL 上带 `Authorization` 之类的 token 参数。
 * 设计器只在自己启动时从 URL query 写这两个 key；既然 localStorage 已被本模块预置，URL 参数就是多余的，
 * 而带上它会经浏览器历史、`Referer` 头和网关访问日志泄露 token。
 */

/** 设计器读写 localStorage 时使用的 key 前缀 */
const WARM_FLOW_KEY_PREFIX = 'Warm-';

/** 设计器使用的鉴权 header 名 */
const WARM_FLOW_AUTHORIZATION_HEADER = 'Authorization';

/** header 值前缀 */
const BEARER_PREFIX = 'Bearer ';

/** 设计器读取的「header 名列表」key */
export const WARM_FLOW_TOKEN_NAME_KEY = `${WARM_FLOW_KEY_PREFIX}TokenName`;

/** 设计器读取的「header 值」key */
export const WARM_FLOW_AUTHORIZATION_KEY = `${WARM_FLOW_KEY_PREFIX}Authorization`;

/** 设计器缓存的后端 `/warm-flow-ui/config` 配置 key */
export const WARM_FLOW_CONFIG_KEY = `${WARM_FLOW_KEY_PREFIX}Framework`;

/**
 * 把 access token 同步给 Warm-Flow 设计器
 *
 * 登录、刷新等**任何** token 变更处调用；传空值时等价于 {@link clearWarmFlowToken}
 *
 * @param token 当前 access token（不含 `Bearer ` 前缀）
 */
export function syncWarmFlowToken(token?: string | null) {
  if (!token) {
    clearWarmFlowToken();

    return;
  }

  localStorage.setItem(WARM_FLOW_TOKEN_NAME_KEY, WARM_FLOW_AUTHORIZATION_HEADER);
  localStorage.setItem(WARM_FLOW_AUTHORIZATION_KEY, `${BEARER_PREFIX}${token}`);
}

/**
 * 清除同步给 Warm-Flow 设计器的 token
 *
 * 登出时必须调用，否则设计器会拿着上一个会话的 token 继续发请求。
 * 同时清掉设计器缓存的 framework 配置，避免切换后端环境后仍用旧配置。
 */
export function clearWarmFlowToken() {
  localStorage.removeItem(WARM_FLOW_TOKEN_NAME_KEY);
  localStorage.removeItem(WARM_FLOW_AUTHORIZATION_KEY);
  localStorage.removeItem(WARM_FLOW_CONFIG_KEY);
}

/** 设计器静态资源在「同源 API 前缀」下的相对路径（后端 `WarmFlowUiConfig#addResourceHandlers` 挂载点） */
export const WARM_FLOW_UI_PATH = 'warm-flow-ui/index.html';

/** 设计器宿主页的打开方式 */
export type WarmFlowDesignerMode = 'design' | 'view' | 'chart';

export interface WarmFlowDesignerOptions {
  /**
   * `design` / `view` 传**流程定义 id**，`chart` 传**流程实例 id**
   *
   * 不传即「新增流程」——设计器会初始化开始/中间/结束三个节点。
   */
  id?: string;
  /**
   * 缺省为 `design`
   *
   * - `design`：`onlyDesignShow=false`，显示「基础信息 + 流程设计」两个 tab，可编辑；
   * - `view`：`onlyDesignShow=true&disabled=true`，**只看画布、不可编辑**；
   * - `chart`：走 `type=FlowChart`，`id` 传的是**实例 id**。
   */
  mode?: WarmFlowDesignerMode;
}

/**
 * 解析「同源 API 前缀」
 *
 * 设计器 iframe 里的所有请求都是相对路径（`url: "../warm-flow/save-json"`），且只读
 * **自己 origin** 的 localStorage 取 token，所以 iframe 必须与主应用同源：
 *
 * | 环境 | 返回 | 为什么 |
 * |---|---|---|
 * | 开发态开 proxy | `/manage-api` | `build/config/proxy.ts` 去掉该前缀后转发到网关 |
 * | 其余 | 从 `VITE_SERVICE_BASE_URL` 取 **pathname** | `.env.prod` 是绝对地址 `http://localhost:8080/manage-api`，只能取路径段 |
 *
 * 若取到的 origin 与本应用不一致，说明部署上「前端站点」与「网关」不同源 ——
 * 此时**不能**退化成绝对 URL（跨源 ⇒ 设计器读不到 localStorage ⇒ 数据接口全 401，
 * 且只能把 token 拼在 URL 上，违反本模块 23-25 行的安全约束），
 * 故返回 `null` + 报错，由调用方明确告知用户，宁可不打开也不静默失败。
 *
 * 注意 `''` 是**合法的返回值**：后端就挂在同源根路径（`VITE_SERVICE_BASE_URL=/`）时
 * 前缀就是空串，此时入口地址是 `/warm-flow-ui/index.html`。「不可用」只用 `null` 表达。
 */
function resolveApiBasePath(): string | null {
  const { DEV, VITE_HTTP_PROXY, VITE_SERVICE_BASE_URL } = import.meta.env;

  if (DEV && VITE_HTTP_PROXY === 'Y') {
    return '/manage-api';
  }

  if (VITE_SERVICE_BASE_URL.startsWith('/')) {
    return trimTrailingSlash(VITE_SERVICE_BASE_URL);
  }

  const resolved = new URL(VITE_SERVICE_BASE_URL, window.location.origin);

  if (resolved.origin !== window.location.origin) {
    // eslint-disable-next-line no-console
    console.error(
      `[warm-flow] 后端地址 ${VITE_SERVICE_BASE_URL} 与本应用不同源（${resolved.origin} ≠ ${window.location.origin}）。` +
        '设计器必须同源嵌入，请把 VITE_SERVICE_BASE_URL 改成同源相对路径（如 /manage-api），或在部署层做同源反向代理。'
    );

    return null;
  }

  return trimTrailingSlash(resolved.pathname);
}

function trimTrailingSlash(path: string) {
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * 拼装 Warm-Flow 设计器入口地址（**同源相对路径**）
 *
 * 返回形如 `/manage-api/warm-flow-ui/index.html?onlyDesignShow=false&showGrid=true`：
 * 以 `/` 开头 ⇒ 浏览器按当前 origin 解析 ⇒ iframe 与主应用同源。
 * `mode` 决定 `onlyDesignShow` / `disabled` / `type` 三个参数，取值见 {@link WarmFlowDesignerOptions.mode}。
 *
 * ⚠️ 两点不要动，动任一条整条链路就废：
 * 1. **不许**用 `VITE_SERVICE_BASE_URL` 直接拼绝对 URL（见 {@link resolveApiBasePath} 的说明）；
 * 2. **不许**在 query 上带 token。token 已由 {@link syncWarmFlowToken} 写进 localStorage，
 *    设计器每次请求自己读；带 URL 参数会经浏览器历史 / `Referer` / 网关日志泄露。
 *
 * @param options 见 {@link WarmFlowDesignerOptions}
 * @returns 同源相对 URL（**以 `/` 开头**）；同源前缀无法确定时返回空串
 *          （调用方应提示用户，**不要**把它设进 iframe.src）
 */
export function buildWarmFlowDesignerUrl(options: WarmFlowDesignerOptions = {}): string {
  const basePath = resolveApiBasePath();

  if (basePath === null) {
    return '';
  }

  const { id, mode = 'design' } = options;

  const query: Record<string, string> = {};

  if (mode === 'chart') {
    // 只读流程图：吃的是**实例 id**，与 onlyDesignShow / disabled 无关
    if (id) {
      query.id = id;
    }
    query.type = 'FlowChart';
  } else {
    // onlyDesignShow 的语义是「**不显示**基础信息，只给画布」—— 传 true 会把引擎自带的
    // 「基础信息 | 流程设计」两个 tab 里的前者整个关掉（实测：只剩画布，没有任何输入框）。
    //
    // 所以取值必须**跟着 mode 走**，不能写死：
    //   `design`（新建 / 编辑）⇒ `false`。流程编码 / 流程名称 / 设计器模型 / 流程类别
    //      都在「基础信息」那一屏，关掉它用户就填不了名称，保存出来是「未命名流程」。
    //      引擎设计器自带顶部 tab 与「保存」按钮，保存时把基础信息与节点一起提交到
    //      `/warm-flow/save-json`，所以「第一步基本信息 → 第二步流程设计」是引擎原生 UX，
    //      我们这个宿主页不需要自己再做一个表单。
    //   `view`（只读查看）⇒ `true`。本来就不给改，不显示基础信息反而更清爽 ——
    //      只留一张画布，对应参考项目「流程图」按钮的观感。
    query.onlyDesignShow = mode === 'view' ? 'true' : 'false';

    if (mode === 'view') {
      // 已发布的定义引擎自己也会置为只读，这个参数是把「只读」显式钉死
      query.disabled = 'true';
    }

    if (id) {
      // 不传 id ⇒「新增流程」
      query.id = id;
    }
  }

  // showGrid 是 `=== "true"` 判定，必须显式传；设计器与流程图都吃这个参数
  query.showGrid = 'true';

  return `${basePath}/${WARM_FLOW_UI_PATH}?${new URLSearchParams(query).toString()}`;
}
