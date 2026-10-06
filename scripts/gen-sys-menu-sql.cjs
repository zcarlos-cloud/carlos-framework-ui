const fs = require('node:fs');
const path = require('node:path');

// =============================================================
// ⚠️ 谨慎重新生成
//
// 本脚本产出的 SQL 以 `DELETE FROM sys_menu WHERE create_by = 0;` 开头，随后整表重建；
// 而下面的雪花ID基于 Date.now()，**每次运行都会得到全新的 ID 空间**。
// 因此对已在运行的库重新执行生成结果，会让所有菜单换 ID，
// 进而使 sys_operation.menu_id 等既有引用失效。
//
// 纯增量场景请改用手写/追加的迁移脚本（参见 docs/sys_menu_audit_migration.sql），
// 或先改造 ID 生成策略使其对同一 route_name 稳定，再重新生成。
// =============================================================

// 标准雪花算法（Twitter epoch）
const EPOCH = 1288834974657n;
let lastTimestamp = -1n;
let sequence = 0n;
const datacenterId = 0n;
const workerId = 0n;

function tilNextMillis(last) {
  let t = BigInt(Date.now()) - EPOCH;
  while (t <= last) {
    t = BigInt(Date.now()) - EPOCH;
  }
  return t;
}

/* eslint-disable no-bitwise -- 雪花算法依赖位移与按位或，无法用算术运算等价替代 */
function nextSnowflakeId() {
  let timestamp = BigInt(Date.now()) - EPOCH;
  if (timestamp < lastTimestamp) {
    throw new Error('Clock moved backwards');
  }
  if (timestamp === lastTimestamp) {
    sequence = (sequence + 1n) & 4095n;
    if (sequence === 0n) {
      timestamp = tilNextMillis(lastTimestamp);
    }
  } else {
    sequence = 0n;
  }
  lastTimestamp = timestamp;
  return (timestamp << 22n) | (datacenterId << 17n) | (workerId << 12n) | sequence;
}
/* eslint-enable no-bitwise */

// 路由中文名称映射（src/locales/langs/zh-cn.ts 中 route 字段）
const nameMap = {
  home: '首页',
  document: '文档',
  document_project: '项目文档',
  'document_project-link': '项目文档(外链)',
  document_vue: 'Vue文档',
  document_vite: 'Vite文档',
  document_unocss: 'UnoCSS文档',
  document_naive: 'Naive UI文档',
  document_antd: 'Ant Design Vue文档',
  about: '关于',
  function: '系统功能',
  function_tab: '标签页',
  'function_multi-tab': '多标签页',
  'function_hide-child': '隐藏子菜单',
  'function_hide-child_one': '隐藏子菜单',
  'function_hide-child_two': '菜单二',
  'function_hide-child_three': '菜单三',
  function_request: '请求',
  'function_toggle-auth': '切换权限',
  'function_super-page': '超级管理员可见',
  manage: '系统管理',
  org: '组织管理',
  org_user: '用户管理',
  'org_user-detail': '用户详情',
  org_role: '角色管理',
  org_department: '部门管理',
  org_position: '职位管理',
  manage_menu: '菜单管理',
  manage_config: '配置管理',
  manage_dict: '字典管理',
  manage_file: '文件管理',
  manage_i18n: '国际化管理',
  manage_module: '模块管理',
  manage_operation: '操作管理',
  manage_region: '区域管理',
  'manage_storage-config': '存储配置管理',
  audit: '审计管理',
  audit_log: '审计日志',
  audit_config: '审计配置',
  audit_archive: '归档记录',
  'multi-menu': '多级菜单',
  'multi-menu_first': '菜单一',
  'multi-menu_first_child': '菜单一子菜单',
  'multi-menu_second': '菜单二',
  'multi-menu_second_child': '菜单二子菜单',
  'multi-menu_second_child_home': '菜单二子菜单首页',
  exception: '异常页',
  exception_403: '403',
  exception_404: '404',
  exception_500: '500',
  'user-center': '个人中心'
};

function getMenuName(name) {
  return nameMap[name] || name;
}

// 仅包含实际业务页面/菜单：排除登录、常量错误页、iframe 通用路由等
const routeTree = [
  {
    name: 'home',
    path: '/home',
    component: 'layout.base$view.home',
    meta: { title: 'home', i18nKey: 'route.home', icon: 'mdi:monitor-dashboard', order: 1 }
  },
  {
    name: 'document',
    path: '/document',
    component: 'layout.base',
    meta: { title: 'document', i18nKey: 'route.document', order: 2, icon: 'mdi:file-document-multiple-outline' },
    children: [
      {
        name: 'document_project',
        path: '/document/project',
        component: 'view.iframe-page',
        props: { url: 'https://docs.soybeanjs.cn/zh' },
        meta: { title: 'document_project', i18nKey: 'route.document_project', order: 1, localIcon: 'logo' }
      },
      {
        name: 'document_project-link',
        path: '/document/project-link',
        component: 'view.iframe-page',
        meta: {
          title: 'document_project-link',
          i18nKey: 'route.document_project-link',
          order: 2,
          localIcon: 'logo',
          href: 'https://docs.soybeanjs.cn/zh'
        }
      },
      {
        name: 'document_vue',
        path: '/document/vue',
        component: 'view.iframe-page',
        props: { url: 'https://cn.vuejs.org/' },
        meta: { title: 'document_vue', i18nKey: 'route.document_vue', order: 3, icon: 'logos:vue' }
      },
      {
        name: 'document_vite',
        path: '/document/vite',
        component: 'view.iframe-page',
        props: { url: 'https://cn.vitejs.dev/' },
        meta: { title: 'document_vite', i18nKey: 'route.document_vite', order: 4, icon: 'logos:vitejs' }
      },
      {
        name: 'document_unocss',
        path: '/document/unocss',
        component: 'view.iframe-page',
        props: { url: 'https://unocss.dev/' },
        meta: { title: 'document_unocss', i18nKey: 'route.document_unocss', order: 5, icon: 'logos:unocss' }
      },
      {
        name: 'document_naive',
        path: '/document/naive',
        component: 'view.iframe-page',
        props: { url: 'https://www.naiveui.com/zh-CN/os-theme/docs/introduction' },
        meta: { title: 'document_naive', i18nKey: 'route.document_naive', order: 6, icon: 'logos:naiveui' }
      },
      {
        name: 'document_antd',
        path: '/document/antd',
        component: 'view.iframe-page',
        props: { url: 'https://antdv.com/components/overview-cn' },
        meta: { title: 'document_antd', i18nKey: 'route.document_antd', order: 7, icon: 'logos:ant-design' }
      }
    ]
  },
  {
    name: 'function',
    path: '/function',
    component: 'layout.base',
    meta: { title: 'function', i18nKey: 'route.function', icon: 'icon-park-outline:all-application', order: 6 },
    children: [
      {
        name: 'function_tab',
        path: '/function/tab',
        component: 'view.function_tab',
        meta: { title: 'function_tab', i18nKey: 'route.function_tab', icon: 'ic:round-tab', order: 1 }
      },
      {
        name: 'function_hide-child',
        path: '/function/hide-child',
        meta: {
          title: 'function_hide-child',
          i18nKey: 'route.function_hide-child',
          icon: 'material-symbols:filter-list-off',
          order: 2
        },
        children: [
          {
            name: 'function_hide-child_one',
            path: '/function/hide-child/one',
            component: 'view.function_hide-child_one',
            meta: {
              title: 'function_hide-child_one',
              i18nKey: 'route.function_hide-child_one',
              icon: 'material-symbols:filter-list-off',
              hideInMenu: true,
              activeMenu: 'function_hide-child'
            }
          },
          {
            name: 'function_hide-child_two',
            path: '/function/hide-child/two',
            component: 'view.function_hide-child_two',
            meta: {
              title: 'function_hide-child_two',
              i18nKey: 'route.function_hide-child_two',
              hideInMenu: true,
              activeMenu: 'function_hide-child'
            }
          },
          {
            name: 'function_hide-child_three',
            path: '/function/hide-child/three',
            component: 'view.function_hide-child_three',
            meta: {
              title: 'function_hide-child_three',
              i18nKey: 'route.function_hide-child_three',
              hideInMenu: true,
              activeMenu: 'function_hide-child'
            }
          }
        ]
      },
      {
        name: 'function_request',
        path: '/function/request',
        component: 'view.function_request',
        meta: { title: 'function_request', i18nKey: 'route.function_request', icon: 'carbon:network-overlay', order: 3 }
      },
      {
        name: 'function_toggle-auth',
        path: '/function/toggle-auth',
        component: 'view.function_toggle-auth',
        meta: {
          title: 'function_toggle-auth',
          i18nKey: 'route.function_toggle-auth',
          icon: 'ic:round-construction',
          order: 4
        }
      },
      {
        name: 'function_super-page',
        path: '/function/super-page',
        component: 'view.function_super-page',
        meta: {
          title: 'function_super-page',
          i18nKey: 'route.function_super-page',
          icon: 'ic:round-supervisor-account',
          order: 5,
          roles: ['R_SUPER']
        }
      },
      {
        name: 'function_multi-tab',
        path: '/function/multi-tab',
        component: 'view.function_multi-tab',
        meta: {
          title: 'function_multi-tab',
          i18nKey: 'route.function_multi-tab',
          icon: 'ic:round-tab',
          multiTab: true,
          hideInMenu: true,
          activeMenu: 'function_tab'
        }
      }
    ]
  },
  {
    name: 'exception',
    path: '/exception',
    component: 'layout.base',
    meta: { title: 'exception', i18nKey: 'route.exception', icon: 'ant-design:exception-outlined', order: 7 },
    children: [
      {
        name: 'exception_403',
        path: '/exception/403',
        component: 'view.403',
        meta: { title: 'exception_403', i18nKey: 'route.exception_403', icon: 'ic:baseline-block' }
      },
      {
        name: 'exception_404',
        path: '/exception/404',
        component: 'view.404',
        meta: { title: 'exception_404', i18nKey: 'route.exception_404', icon: 'ic:baseline-web-asset-off' }
      },
      {
        name: 'exception_500',
        path: '/exception/500',
        component: 'view.500',
        meta: { title: 'exception_500', i18nKey: 'route.exception_500', icon: 'ic:baseline-wifi-off' }
      }
    ]
  },
  {
    name: 'multi-menu',
    path: '/multi-menu',
    component: 'layout.base',
    meta: { title: 'multi-menu', i18nKey: 'route.multi-menu', order: 8 },
    children: [
      {
        name: 'multi-menu_first',
        path: '/multi-menu/first',
        meta: { title: 'multi-menu_first', i18nKey: 'route.multi-menu_first', order: 1 },
        children: [
          {
            name: 'multi-menu_first_child',
            path: '/multi-menu/first/child',
            component: 'view.multi-menu_first_child',
            meta: { title: 'multi-menu_first_child', i18nKey: 'route.multi-menu_first_child' }
          }
        ]
      },
      {
        name: 'multi-menu_second',
        path: '/multi-menu/second',
        meta: { title: 'multi-menu_second', i18nKey: 'route.multi-menu_second', order: 2 },
        children: [
          {
            name: 'multi-menu_second_child',
            path: '/multi-menu/second/child',
            meta: { title: 'multi-menu_second_child', i18nKey: 'route.multi-menu_second_child' },
            children: [
              {
                name: 'multi-menu_second_child_home',
                path: '/multi-menu/second/child/home',
                component: 'view.multi-menu_second_child_home',
                meta: { title: 'multi-menu_second_child_home', i18nKey: 'route.multi-menu_second_child_home' }
              }
            ]
          }
        ]
      }
    ]
  },
  {
    name: 'org',
    path: '/org',
    component: 'layout.base',
    meta: {
      title: 'org',
      i18nKey: 'route.org',
      icon: 'carbon:network-4',
      order: 11
    },
    children: [
      {
        name: 'org_user',
        path: '/org/user',
        component: 'view.org_user',
        meta: {
          title: 'org_user',
          i18nKey: 'route.org_user',
          icon: 'ic:round-manage-accounts',
          order: 1,
          roles: ['R_ADMIN']
        }
      },
      {
        name: 'org_user-detail',
        path: '/org/user-detail/:id',
        component: 'view.org_user-detail',
        meta: {
          title: 'org_user-detail',
          i18nKey: 'route.org_user-detail',
          hideInMenu: true,
          roles: ['R_ADMIN'],
          activeMenu: 'org_user'
        }
      },
      {
        name: 'org_role',
        path: '/org/role',
        component: 'view.org_role',
        meta: {
          title: 'org_role',
          i18nKey: 'route.org_role',
          icon: 'carbon:user-role',
          order: 2,
          roles: ['R_SUPER']
        }
      },
      {
        name: 'org_department',
        path: '/org/department',
        component: 'view.org_department',
        meta: {
          title: 'org_department',
          i18nKey: 'route.org_department',
          icon: 'mdi:file-tree-outline',
          order: 3,
          roles: ['R_ADMIN'],
          keepAlive: true
        }
      },
      {
        name: 'org_position',
        path: '/org/position',
        component: 'view.org_position',
        meta: {
          title: 'org_position',
          i18nKey: 'route.org_position',
          icon: 'mdi:briefcase-outline',
          order: 4,
          roles: ['R_ADMIN'],
          keepAlive: true
        }
      }
    ]
  },
  {
    name: 'manage',
    path: '/manage',
    component: 'layout.base',
    meta: {
      title: 'manage',
      i18nKey: 'route.manage',
      icon: 'carbon:cloud-service-management',
      order: 9,
      roles: ['R_ADMIN']
    },
    children: [
      {
        name: 'manage_menu',
        path: '/manage/menu',
        component: 'view.manage_menu',
        meta: {
          title: 'manage_menu',
          i18nKey: 'route.manage_menu',
          icon: 'material-symbols:route',
          order: 3,
          roles: ['R_ADMIN'],
          keepAlive: true
        }
      },
      {
        name: 'manage_config',
        path: '/manage/config',
        component: 'view.manage_config',
        meta: {
          title: 'manage_config',
          i18nKey: 'route.manage_config',
          icon: 'carbon:settings',
          order: 4,
          roles: ['R_ADMIN'],
          keepAlive: true
        }
      },
      {
        name: 'manage_i18n',
        path: '/manage/i18n',
        component: 'view.manage_i18n',
        meta: {
          title: 'manage_i18n',
          i18nKey: 'route.manage_i18n',
          icon: 'carbon:language',
          order: 5,
          roles: ['R_ADMIN'],
          keepAlive: true
        }
      },
      {
        name: 'manage_dict',
        path: '/manage/dict',
        component: 'view.manage_dict',
        meta: {
          title: 'manage_dict',
          i18nKey: 'route.manage_dict',
          icon: 'carbon:book',
          order: 6,
          roles: ['R_ADMIN'],
          keepAlive: true
        }
      },
      {
        name: 'manage_module',
        path: '/manage/module',
        component: 'view.manage_module',
        meta: {
          title: 'manage_module',
          i18nKey: 'route.manage_module',
          icon: 'carbon:module',
          order: 7,
          roles: ['R_ADMIN'],
          keepAlive: true
        }
      },
      {
        name: 'manage_region',
        path: '/manage/region',
        component: 'view.manage_region',
        meta: {
          title: 'manage_region',
          i18nKey: 'route.manage_region',
          icon: 'carbon:map',
          order: 8,
          roles: ['R_ADMIN'],
          keepAlive: true
        }
      },
      {
        name: 'manage_file',
        path: '/manage/file',
        component: 'view.manage_file',
        meta: {
          title: 'manage_file',
          i18nKey: 'route.manage_file',
          icon: 'carbon:document',
          order: 9,
          roles: ['R_ADMIN'],
          keepAlive: true
        }
      },
      {
        name: 'manage_operation',
        path: '/manage/operation',
        component: 'view.manage_operation',
        meta: {
          title: 'manage_operation',
          i18nKey: 'route.manage_operation',
          icon: 'carbon:security',
          order: 10,
          roles: ['R_ADMIN'],
          keepAlive: true
        }
      },
      {
        name: 'manage_storage-config',
        path: '/manage/storage-config',
        component: 'view.manage_storage-config',
        meta: {
          title: 'manage_storage-config',
          i18nKey: 'route.manage_storage-config',
          icon: 'carbon:cloud-storage',
          order: 11,
          roles: ['R_ADMIN'],
          keepAlive: true
        }
      },
      {
        name: 'audit',
        path: '/audit',
        meta: { title: 'audit', i18nKey: 'route.audit', icon: 'mdi:shield-search', order: 12 },
        children: [
          {
            name: 'audit_log',
            path: '/audit/log',
            component: 'view.audit_log',
            meta: {
              title: 'audit_log',
              i18nKey: 'route.audit_log',
              icon: 'carbon:document-view',
              order: 1,
              roles: ['R_ADMIN'],
              keepAlive: true
            }
          },
          {
            name: 'audit_config',
            path: '/audit/config',
            component: 'view.audit_config',
            meta: {
              title: 'audit_config',
              i18nKey: 'route.audit_config',
              icon: 'mdi:cog-outline',
              order: 2,
              roles: ['R_ADMIN'],
              keepAlive: true
            }
          },
          {
            name: 'audit_archive',
            path: '/audit/archive',
            component: 'view.audit_archive',
            meta: {
              title: 'audit_archive',
              i18nKey: 'route.audit_archive',
              icon: 'mdi:archive-outline',
              order: 3,
              roles: ['R_ADMIN'],
              keepAlive: true
            }
          }
        ]
      }
    ]
  },
  {
    name: 'about',
    path: '/about',
    component: 'layout.base$view.about',
    // hideInMenu: 「关于」的主入口是右上角头像下拉里的抽屉，不再占侧边栏位置。
    // 注意只隐藏、不禁用：RouteService 对 hideInMenu 不做过滤，路由仍会注册，
    // 所以 /about 依然可以直接用 URL 访问（与 user-center 同形态）。
    meta: {
      title: 'about',
      i18nKey: 'route.about',
      icon: 'fluent:book-information-24-regular',
      order: 10,
      hideInMenu: true
    }
  },
  {
    name: 'user-center',
    path: '/user-center',
    component: 'layout.base$view.user-center',
    meta: { title: 'user-center', i18nKey: 'route.user-center', hideInMenu: true }
  }
];

function escapeSql(value) {
  if (value === null || value === undefined) return 'NULL';
  // sys_menu 在 PostgreSQL 中 hide_in_menu / keep_alive / constant / multi_tab 是 BOOLEAN，
  // 必须写 TRUE/FALSE；写成 1/0 会报
  // "column \"hide_in_menu\" is of type boolean but expression is of type integer"
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function buildMetaJson(node) {
  const meta = { ...(node.meta || {}) };
  if (node.props) {
    meta.props = node.props;
  }
  return Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;
}

const rows = [];

function walk(nodes, parentId, level) {
  for (const node of nodes) {
    const id = nextSnowflakeId();
    const meta = node.meta || {};
    const isDirectory = Array.isArray(node.children) && node.children.length > 0;
    const menuCategory = isDirectory ? 1 : 2;
    const icon = meta.localIcon ? meta.localIcon : meta.icon || null;
    // icon_type：2=本地 svg（localIcon），1=iconify，无图标为 null
    let iconType = null;
    if (meta.localIcon) {
      iconType = 2;
    } else if (meta.icon) {
      iconType = 1;
    }
    const url = node.props && node.props.url ? node.props.url : null;
    const metaJson = buildMetaJson(node);

    rows.push({
      id,
      parent_id: parentId,
      menu_name: getMenuName(node.name),
      route_path: node.path,
      route_name: node.name,
      icon,
      icon_type: iconType,
      meta: metaJson,
      component: node.component || null,
      url,
      menu_status: 1,
      remark: null,
      menu_level: level,
      order_num: typeof meta.order === 'number' ? meta.order : 0,
      hide_in_menu: Boolean(meta.hideInMenu),
      menu_category: menuCategory,
      client_type: 'ALL',
      i18n_key: meta.i18nKey || null,
      keep_alive: Boolean(meta.keepAlive),
      constant: Boolean(meta.constant),
      href: meta.href || null,
      active_menu: meta.activeMenu || null,
      multi_tab: Boolean(meta.multiTab),
      fixed_index_in_tab: null,
      route_query: null,
      create_by: 0,
      update_by: 0,
      is_deleted: false,
      create_time: 'NOW()',
      update_time: 'NOW()'
    });

    if (isDirectory) {
      walk(node.children, id, level + 1);
    }
  }
}

walk(routeTree, null, 1);

const columns = [
  'id',
  'parent_id',
  'menu_name',
  'route_path',
  'route_name',
  'icon',
  'icon_type',
  'meta',
  'component',
  'url',
  'menu_status',
  'remark',
  'menu_level',
  'order_num',
  'hide_in_menu',
  'menu_category',
  'client_type',
  'i18n_key',
  'keep_alive',
  'constant',
  'href',
  'active_menu',
  'multi_tab',
  'fixed_index_in_tab',
  'route_query',
  'create_by',
  'update_by',
  'is_deleted',
  'create_time',
  'update_time'
];

let sql = `-- 初始化 sys_menu 菜单数据\n`;
sql += `-- 生成时间：${new Date().toISOString()}\n`;
sql += `-- 规则：仅包含实际业务页面/菜单，排除了登录、常量错误页、通用 iframe 路由等\n\n`;
sql += `DELETE FROM sys_menu WHERE create_by = 0;\n\n`;

for (const row of rows) {
  const values = columns.map(col => {
    if (col === 'create_time' || col === 'update_time') return row[col];
    return escapeSql(row[col]);
  });
  sql += `INSERT INTO sys_menu (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
}

const outPath = path.resolve(__dirname, '../docs/sys_menu_init.sql');
fs.writeFileSync(outPath, sql, 'utf-8');
console.log(`已生成菜单初始化 SQL：${outPath}（共 ${rows.length} 条）`);
