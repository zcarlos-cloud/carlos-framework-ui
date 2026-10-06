const LAYOUT_PREFIX = 'layout.';
const VIEW_PREFIX = 'view.';
const FIRST_LEVEL_ROUTE_COMPONENT_SPLIT = '$';

export function getLayoutAndPage(component?: string | null) {
  let layout = '';
  let page = '';

  const [layoutOrPage = '', pageItem = ''] = component?.split(FIRST_LEVEL_ROUTE_COMPONENT_SPLIT) || [];

  layout = getLayout(layoutOrPage);
  page = getPage(pageItem || layoutOrPage);

  return { layout, page };
}

function getLayout(layout: string) {
  return layout.startsWith(LAYOUT_PREFIX) ? layout.replace(LAYOUT_PREFIX, '') : '';
}

function getPage(page: string) {
  return page.startsWith(VIEW_PREFIX) ? page.replace(VIEW_PREFIX, '') : '';
}

export function transformLayoutAndPageToComponent(layout: string, page: string) {
  const hasLayout = Boolean(layout);
  const hasPage = Boolean(page);

  if (hasLayout && hasPage) {
    return `${LAYOUT_PREFIX}${layout}${FIRST_LEVEL_ROUTE_COMPONENT_SPLIT}${VIEW_PREFIX}${page}`;
  }

  if (hasLayout) {
    return `${LAYOUT_PREFIX}${layout}`;
  }

  if (hasPage) {
    return `${VIEW_PREFIX}${page}`;
  }

  return '';
}

/**
 * Get route name by route path
 *
 * @param routeName
 */
export function getRoutePathByRouteName(routeName: string) {
  return `/${routeName.replace(/_/g, '/')}`;
}

/**
 * Get path param from route path
 *
 * @param routePath route path
 */
export function getPathParamFromRoutePath(routePath: string) {
  const [path, param = ''] = routePath.split('/:');

  return {
    path,
    param
  };
}

/**
 * Get route path with param
 *
 * @param routePath route path
 * @param param path param
 */
export function getRoutePathWithParam(routePath: string, param: string) {
  if (param.trim()) {
    return `${routePath}/:${param}`;
  }

  return routePath;
}

/**
 * 归一化父级菜单 id
 *
 * 顶层菜单在库里存的是 0（后端 CoreConstant.PARENT_LONG_0），而 VO 带
 * `@JsonInclude(NON_NULL)`，所以下发给前端的可能是 "0"，也可能是字段缺失。
 * 两种都表示「没有父级」，统一收成 null。
 *
 * 不归一的话 `showLayout`（`!model.parentId`）对一切的顶层菜单都是 false
 * —— "0" 是 truthy 的，会让「布局」下拉永远不出现。
 *
 * 提交时 null 会被后端 `ObjectUtil.isEmpty` 兜成 PARENT_LONG_0，来回一致。
 */
export function normalizeParentId(parentId?: string | null): string | null {
  if (!parentId || parentId === '0') {
    return null;
  }

  return parentId;
}

/**
 * routeQuery 的 JSON 字符串 → 表单的 [{ key, value }]
 *
 * `buildRouteQuery`（menu-operate-drawer.vue）的逆操作：后端存的是扁平的 JSON 对象字符串，
 * 而表单编辑的是**有序数组**，两者互转。
 *
 * 存进去的值不是合法 JSON、或不是对象时一律返回空数组 —— 脏数据不该让编辑抽屉打不开。
 */
export function parseRouteQuery(routeQuery?: string | null): { key: string; value: string }[] {
  if (!routeQuery) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(routeQuery);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [];
  }

  return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
    key,
    value: String(value)
  }));
}
