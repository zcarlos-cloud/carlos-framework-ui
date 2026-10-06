/**
 * Namespace Env
 *
 * It is used to declare the type of the import.meta object
 */
declare namespace Env {
  /** The router history mode */
  type RouterHistoryMode = 'hash' | 'history' | 'memory';

  /**
   * Interface for import.meta.env
   *
   * 命名刻意区别于全局的 `ImportMeta`（本文件底部那个）——后者描述 import.meta 本身，
   * 这里描述的是 import.meta.env 的形状，两者同名会让 eslint 的 no-shadow 报错，
   * 也容易在 Env 命名空间内部误引用。
   *
   * extends 处必须限定 `globalThis.`：在本命名空间内 `ImportMetaEnv` 会解析到自己，
   * 不加限定就成了循环继承。
   */
  interface ImportMetaEnv extends globalThis.ImportMetaEnv {
    /** The base url of the application */
    readonly VITE_BASE_URL: string;
    /** The title of the application */
    readonly VITE_APP_TITLE: string;
    /** The description of the application */
    readonly VITE_APP_DESC: string;
    /**
     * The version of the application
     *
     * 这是 Carlos Framework 平台版本（3.0.0-SNAPSHOT），**不是** package.json 的 version
     * ——后者是上游 soybean 模板的版号（1.3.11），仅在「关于」里作为前端框架版本展示。
     */
    readonly VITE_APP_VERSION: string;
    /** The router history mode */
    readonly VITE_ROUTER_HISTORY_MODE?: RouterHistoryMode;
    /** The prefix of the iconify icon */
    readonly VITE_ICON_PREFIX: 'icon';
    /**
     * The prefix of the local icon
     *
     * This prefix is start with the icon prefix
     */
    readonly VITE_ICON_LOCAL_PREFIX: 'local-icon';
    /** backend service base url */
    readonly VITE_SERVICE_BASE_URL: string;
    /**
     * success code of backend service
     *
     * when the code is received, the request is successful
     */
    readonly VITE_SERVICE_SUCCESS_CODE: string;
    /**
     * logout codes of backend service
     *
     * when the code is received, the user will be logged out and redirected to login page
     *
     * use "," to separate multiple codes
     */
    readonly VITE_SERVICE_LOGOUT_CODES: string;
    /**
     * modal logout codes of backend service
     *
     * when the code is received, the user will be logged out by displaying a modal
     *
     * use "," to separate multiple codes
     */
    readonly VITE_SERVICE_MODAL_LOGOUT_CODES: string;
    /**
     * token expired codes of backend service
     *
     * when the code is received, it will refresh the token and resend the request
     *
     * use "," to separate multiple codes
     */
    readonly VITE_SERVICE_EXPIRED_TOKEN_CODES: string;
    /** when the route mode is static, the defined super role */
    readonly VITE_STATIC_SUPER_ROLE: string;
    /**
     * other backend service base url
     *
     * the value is a json
     */
    readonly VITE_OTHER_SERVICE_BASE_URL: string;
    /**
     * Whether to enable the http proxy
     *
     * Only valid in the development environment
     */
    readonly VITE_HTTP_PROXY?: CommonType.YesOrNo;
    /**
     * The auth route mode
     *
     * - Static: the auth routes is generated in front-end
     * - Dynamic: the auth routes is generated in back-end
     */
    readonly VITE_AUTH_ROUTE_MODE: 'static' | 'dynamic';
    /**
     * Whether to show the tenant code input on the login page
     *
     * S2 租户管理：仅当后端开启 carlos.auth.tenant.enabled 时才应置为 'true'，
     * 开启后登录请求会携带 tenantCode，由后端校验租户状态/有效期
     */
    readonly VITE_AUTH_TENANT_ENABLED?: string;
    /**
     * The home route key
     *
     * It only has effect when the auth route mode is static, if the route mode is dynamic, the home route key is
     * defined in the back-end
     */
    readonly VITE_ROUTE_HOME: import('@elegant-router/types').LastLevelRouteKey;
    /**
     * Default menu icon if menu icon is not set
     *
     * Iconify icon name
     */
    readonly VITE_MENU_ICON: string;
    /** Whether to build with sourcemap */
    readonly VITE_SOURCE_MAP?: CommonType.YesOrNo;
    /**
     * Iconify api provider url
     *
     * 默认不配置：项目用到的图标数据已离线打包（pnpm gen:icons 可重新生成），运行时零网络请求。
     * 若部署环境自建了 Iconify API 服务，配置此项后改为从该服务按需获取图标。
     *
     * @link https://docs.iconify.design/api/providers.html
     */
    readonly VITE_ICONIFY_URL?: string;
    /** Used to differentiate storage across different domains */
    readonly VITE_STORAGE_PREFIX?: string;
    /** Whether to automatically detect updates after configuring application packaging */
    readonly VITE_AUTOMATICALLY_DETECT_UPDATE?: CommonType.YesOrNo;
  }
}

interface ImportMeta {
  readonly env: Env.ImportMetaEnv;
}
