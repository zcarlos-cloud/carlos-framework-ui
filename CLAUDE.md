# carlos-framework-ui — Carlos Framework 管理后台前端

本文档为 Claude Code 提供本仓库(carlos-framework-ui)的开发指导。

> **⚠️ 编码规范已迁移至 Skill**
>
> 详细前端编码规范在 `.claude/skills/carlos-ui-standard/SKILL.md`。编写 Vue/TypeScript 代码前请务必阅读。

## 项目概述

Carlos Framework 的管理后台前端,基于 **Vue 3.5 + Vite 7 + Ant Design Vue (Soybean Admin Antd v1.3.11)**。

- 包管理: **pnpm**(workspace)
- 规范文档: `docs/前端开发规范.md`、`docs/后端工程师前端速查手册.md`
- 仓库: 独立 git 仓库(由 monorepo 拆分而来,69 个提交)

## 常用命令

```bash
pnpm install       # 安装依赖
pnpm dev           # 本地开发 (:5173)
pnpm build         # 构建
pnpm lint          # 代码检查
pnpm typecheck     # 类型检查
```

## 目录结构

- `src/` — 应用源码(Vue SFC / Pinia / Router / service)
- `build/` — 构建配置
- `docs/` — 规范与实施文档
- `.claude/` — AI 配置(skill / agents / commands)

> **菜单是样例参考时看 `docs/样例页面索引.md`**：系统功能 `/function`、异常页 `/exception`、多级菜单
> `/multi-menu` 三组菜单是**框架配置样例而非业务功能**，在 `sys_menu` 里与业务菜单无从区分，
> **精简菜单时不要删**。样例的参考价值在 `meta` 字段组合与菜单层级配置，不在页面代码。
> **这三组菜单当前是否显示、如何恢复，以该文档开头的「当前状态」一节为准。**

## 与相关仓库的关系

| 仓库                        | 说明                   |
|---------------------------|----------------------|
| `carlos-framework` (后端)   | 本前端对接的后端,接口走 Gateway |
| `carlos-framework-portal` | 门户前端(另一独立仓库)         |
| `carlos-framework-docs`   | 官方文档站                |

## 重要注意事项

- 遵循 `carlos-ui-standard` skill 的强制规范(组件 `<script setup>`、禁止 `any`、pnpm、UnoCSS、Pinia、`src/service/api/`)
- 本仓库是独立 git 仓库,`git commit` 只影响本仓库,不影响其他三个仓库

---

## 前端公共模块

> 前端框架基于 Soybean Admin Antd v1.3.11（Vue 3.5 + Vite 7 + TS 5.9 + AntDesign Vue 4.2 + Pinia + UnoCSS）。

### 目录总览

| 目录                | 文件数 |  完成度   | 说明                                             |
|-------------------|:---:|:------:|------------------------------------------------|
| `src/components/` | 27  | ✅ 100% | 通用组件（advanced 3 + common 10 + custom 10 + agent-chat/ 4） |
| `src/hooks/`      | 10  | ⚠️ 90% | common 5 + business 5，captcha 验证码发送未实现          |
| `src/store/`      |  6  | ✅ 100% | Pinia 状态管理（agent/app/auth/route/tab/theme）     |
| `src/utils/`      |  9  | ✅ 100% | 通用工具（common/enum-dict/warm-flow/tree/service 等）  |
| `src/constants/`  |  5  | ✅ 100% | 常量（app/business/common/icon/reg）               |
| `src/enum/`       |  1  | ✅ 100% | `SetupStoreId`（Pinia store id 常量，**不是枚举表**）    |

### 组件清单（27 个）

**advanced/（3 个）— 表格高级组件**

| 组件                         | 行数 | 用途                   |
|----------------------------|:--:|----------------------|
| import-drawer.vue          | 281 | 数据导入抽屉             |
| table-header-operation.vue | 73 | 表格头部操作（列设置/刷新/新增/删除） |
| table-column-setting.vue   | 39 | 列显隐设置                |

**common/（10 个）— 通用基础组件**

| 组件                      | 行数  | 用途                 |
|-------------------------|:---:|--------------------|
| system-logo.vue         | 159 | 系统 Logo（含动态图标）     |
| theme-schema-switch.vue | 56  | 主题模式切换             |
| lang-switch.vue         | 54  | 语言切换               |
| menu-toggler.vue        | 48  | 侧边栏折叠切换            |
| exception-base.vue      | 43  | 异常页基类（403/404/500） |
| app-provider.vue        | 34  | 应用全局 Provider      |
| pin-toggler.vue         | 22  | 标签页固定切换            |
| full-screen.vue         | 22  | 全屏切换               |
| reload-button.vue       | 21  | 刷新按钮               |
| dark-mode-container.vue | 17  | 暗色模式容器             |

**custom/（10 个文件 + agent-chat/ 子目录）— 自定义业务组件**

| 组件                 | 行数 | 用途                 |
|--------------------|:--:|--------------------|
| agent-chat/        | 4 文件 | AI 助手聊天面板（对接 dsh）   |
| sequence-input.vue | 136 | 序列号输入（S5 序列号生成器）   |
| icon-picker.vue    | 124 | 图标选择器              |
| warm-flow-chart.vue | 106 | warm-flow 流程图      |
| count-to.vue       | 88 | 数字滚动动画             |
| about-info.vue     | 73 | 关于信息               |
| wave-bg.vue        | 59 | 波浪背景               |
| svg-icon.vue       | 54 | SVG 图标（SvgIcon 封装） |
| better-scroll.vue  | 53 | 滚动容器               |
| button-icon.vue    | 50 | 图标按钮               |
| look-forward.vue   | 20 | 敬请期待占位             |

### Hooks 清单（10 个）

**common/（5 个）— 通用 Hook**

| Hook       | 行数  | 用途                           |
|------------|:---:|------------------------------|
| table.ts   | 316 | 表格核心（分页/搜索/列设置/行选择）          |
| echarts.ts | 235 | ECharts 封装（初始化/销毁/自适应）       |
| form.ts    | 217 | 表单（useAntdForm/useFormRules） |
| router.ts  | 178 | 路由相关                         |
| icon.ts    | 10  | 图标                           |

**business/（5 个）— 业务 Hook**

| Hook       | 行数 | 用途                |
|------------|:--:|-------------------|
| use-export.ts | 129 | 导出下载（Blob 落盘）    |
| warm-flow-token.ts | 155 | warm-flow 流程图鉴权 token 续期 |
| captcha.ts | 71 | 验证码倒计时 ⚠️ 发送接口未实现 |
| news-detail.ts | 52 | 公告详情弹窗（查看内容）     |
| auth.ts    | 21 | 认证                |

### Store 清单（6 个 + 入口）

| Store               | 行数  | 用途            |
|---------------------|:---:|---------------|
| modules/route/      | 348 | 路由状态          |
| modules/tab/        | 296 | 多标签页状态        |
| modules/theme/      | 221 | 主题状态          |
| modules/auth/       | 215 | 认证状态          |
| modules/agent/      | 176 | AI 助手会话状态（dsh 对接） |
| modules/app/        | 170 | 应用状态          |
| index.ts + plugins/ |  —  | Store 入口 + 插件 |

### 未实现功能

- ⚠️ `src/hooks/business/captcha.ts` 的 `getCaptcha()`：验证码发送用 `setTimeout` 模拟（500ms 延迟），未调用真实后端短信接口。待后端短信服务（starter-sms）接入后实现。

---

