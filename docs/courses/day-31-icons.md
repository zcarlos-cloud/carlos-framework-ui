# 第31天 — 图标系统：Iconify、unplugin-icons、SVG

> **日期**: 2026-06-25 | **阶段**: 第三阶段 — 项目核心库深入 | **上一篇**: [Day 30: UnoCSS 实战](./day-30-unocss.md)

---

## 一、今日目标

### 三层学习目标

1. **能用**: 理解 Iconify 图标集生态、unplugin-icons 自动导入机制、本地 SVG 组件化渲染
2. **规范**: 遵循项目中 SvgIcon 组件的统一使用方式，正确选择 iconify 图标 vs 本地 SVG
3. **极致**: 理解项目双通道图标渲染架构（Iconify 运行时 + UnoCSS preset-icons + SVG Sprite），掌握离线部署方案

### 核心问题

- 为什么不用 `<img src="icon.svg" />` 而是用 Iconify？
- unplugin-icons 的 `Icons` + `IconsResolver` 配合 `unplugin-vue-components` 是如何工作的？
- 项目中为什么同时存在两套图标渲染方案（SvgIcon 组件 + presetIcons）？

---

## 二、Java 类比

| 前端概念                     | Java 类比                           | 说明                                                                                      |
|--------------------------|-----------------------------------|-----------------------------------------------------------------------------------------|
| **Iconify**              | Maven coordinates 坐标系统            | `ant-design:bar-chart-outlined` ≈ `com.github:ant-design-icons:4.0` — 用命名空间+标识符唯一寻址一个图标 |
| **unplugin-icons**       | Spring `@ComponentScan` 自动注册      | 扫描图标集 → 自动生成 Vue 组件，无需手动 import 每个图标                                                    |
| **SVG `<use>` Sprite**   | Java 矢量图形 `java.awt.geom`         | `<svg><use href="#icon-name"/></svg>` ≈ `Graphics2D.draw(Shape)` — 声明式引用预定义图形           |
| **IconsResolver**        | Spring `BeanNameAutoProxyCreator` | 自动按命名规则（`icon-ant-design-bar-chart-outlined`）创建代理 Bean（组件）                              |
| **FileSystemIconLoader** | Java `ClassPathResource`          | 从文件系统加载资源并做预处理（svg→去fill→设em尺寸）                                                         |
| **Iconify offline**      | 离线 Maven 仓库（Nexus）                | `VITE_ICONIFY_URL` 指向自建 API 服务器，不依赖公网                                                   |
| **iconType 枚举**          | Java `Enum` 类型区分策略                | `'1'`=Iconify图标 / `'2'`=本地SVG图标 → 类似策略模式选择渲染器                                           |

---

## 三、carlos-framework-ui 源码阅读

### 3.1 项目架构全景

```
项目图标系统分层架构：

┌─────────────────────────────────────────────────┐
│                  业务层                          │
│  SvgIcon 组件 (src/components/custom/svg-icon.vue)│
│  useSvgIcon Hook (src/hooks/common/icon.ts)      │
│  getLocalIcons 工具 (src/utils/icon.ts)          │
├─────────────────────────────────────────────────┤
│                  插件层                          │
│  unplugin-icons (build/plugins/unplugin.ts)     │
│  presetIcons + UnoCSS (build/plugins/unocss.ts) │
│  vite-plugin-svg-icons (build/plugins/unplugin.ts)│
├─────────────────────────────────────────────────┤
│                  数据层                          │
│  @iconify/vue Icon 组件 (运行时渲染)              │
│  @iconify/json (离线图标数据)                     │
│  src/assets/svg-icon/ (18 个本地 SVG)            │
└─────────────────────────────────────────────────┘
```

### 3.2 核心文件清单

| 文件                                   | 作用                                                   | 行数 |
|--------------------------------------|------------------------------------------------------|----|
| `build/plugins/unplugin.ts`          | 统一插件入口：Icons + IconsResolver + vite-plugin-svg-icons | 43 |
| `build/plugins/unocss.ts`            | UnoCSS presetIcons 配置：同名本地图标集合                       | 31 |
| `src/components/custom/svg-icon.vue` | **核心组件**：根据 props 智能选择 Iconify 或本地 SVG 渲染            | 42 |
| `src/hooks/common/icon.ts`           | useSvgIcon Hook：封装 SvgIconVNode 渲染函数                 | 12 |
| `src/plugins/iconify.ts`             | Iconify 离线模式初始化                                      | 9  |
| `src/utils/icon.ts`                  | getLocalIcons()：动态获取本地 SVG 文件列表                      | 8  |
| `.env`                               | 环境变量：VITE_ICON_PREFIX / VITE_ICON_LOCAL_PREFIX       | —  |
| `src/typings/vite-env.d.ts`          | VITE_ICONIFY_URL 类型声明                                | —  |

### 3.3 【源码精读】build/plugins/unplugin.ts — 插件注册

```typescript
// build/plugins/unplugin.ts（关键代码片段）
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import { FileSystemIconLoader } from 'unplugin-icons/loaders';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';

const localIconPath = path.join(process.cwd(), 'src/assets/svg-icon');
const collectionName = VITE_ICON_LOCAL_PREFIX.replace(`${VITE_ICON_PREFIX}-`, '');
// 结果：collectionName = 'local' （VITE_ICON_LOCAL_PREFIX='icon-local', VITE_ICON_PREFIX='icon'）

const plugins = [
  // 【通道1】unplugin-icons：按需自动导入
  Icons({
    compiler: 'vue3',
    customCollections: {
      [collectionName]: FileSystemIconLoader(localIconPath, svg =>
        svg.replace(/^<svg\s/, '<svg width="1em" height="1em" ')
      )
    },
    scale: 1,
    defaultClass: 'inline-block'
  }),

  // 【通道2】unplugin-vue-components：自动注册 Iconify 图标为 Vue 组件
  Components({
    dts: 'src/typings/components.d.ts',
    resolvers: [
      AntDesignVueResolver({ importStyle: false }),
      IconsResolver({
        customCollections: [collectionName],
        componentPrefix: VITE_ICON_PREFIX  // 'icon'
      })
    ]
  }),

  // 【通道3】vite-plugin-svg-icons：生成 SVG Sprite + 注入 body
  createSvgIconsPlugin({
    iconDirs: [localIconPath],
    symbolId: `${VITE_ICON_LOCAL_PREFIX}-[dir]-[name]`,  // 'icon-local-xxx'
    inject: 'body-last',
    customDomId: '__SVG_ICON_LOCAL__'
  })
];
```

**设计精要**：

1. **Icons 插件**：在构建时为每个图标文件生成 Vue 组件（`~icons/local/xxx.vue`），支持 Tree Shaking
2. **IconsResolver**：配合 `unplugin-vue-components`，在模板中使用 `<icon-ant-design-bar-chart-outlined />` 时自动导入
3. **createSvgIconsPlugin**：将所有本地 SVG 合并为一个 Sprite（`#icon-local-name`），供 `<use>` 引用

### 3.4 【源码精读】src/components/custom/svg-icon.vue — 统一组件

```vue
<script setup lang="ts">
import {computed, useAttrs} from 'vue';
import {Icon} from '@iconify/vue';

defineOptions({name: 'SvgIcon', inheritAttrs: false});

/**
 * Props
 *
 * - Support iconify and local svg icon
 * - If icon and localIcon are passed at the same time, localIcon will be rendered first
 */
interface Props {
  /** Iconify icon name */
  icon?: string;
  /** Local svg icon name */
  localIcon?: string;
}

const props = defineProps<Props>();
const attrs = useAttrs();

const bindAttrs = computed<{ class: string; style: string }>(() => ({
  class: (attrs.class as string) || '',
  style: (attrs.style as string) || ''
}));

const symbolId = computed(() => {
  const {VITE_ICON_LOCAL_PREFIX: prefix} = import.meta.env;
  const defaultLocalIcon = 'no-icon';
  const icon = props.localIcon || defaultLocalIcon;
  return `#${prefix}-${icon}`;
});

/** If localIcon is passed, render localIcon first */
const renderLocalIcon = computed(() => props.localIcon || !props.icon);
</script>

<template>
  <!-- 分支 A：本地 SVG（优先级更高） -->
  <template v-if="renderLocalIcon">
    <svg aria-hidden="true" width="1em" height="1em" v-bind="bindAttrs">
      <use :xlink:href="symbolId" fill="currentColor"/>
    </svg>
  </template>
  <!-- 分支 B：Iconify 图标（在线/离线） -->
  <template v-else>
    <Icon v-if="icon" :icon="icon" v-bind="bindAttrs"/>
  </template>
</template>
```

**设计精要**：

1. **双重渲染策略**：`localIcon` 优先 → SVG Sprite `<use>` 引用；否则 → `@iconify/vue` 的 `<Icon>` 组件
2. **inheritAttrs: false**：阻止 attrs 自动继承到根元素，手动通过 `v-bind="bindAttrs"` 控制
3. **currentColor**：填充色继承父元素 `color`，实现颜色联动（配合暗色模式）
4. **1em 尺寸**：相对父元素字体大小缩放，适应任何容器
5. **兜底图标**：当无 localIcon 时使用 `no-icon`（`defaultLocalIcon`），避免空白

### 3.5 图标使用场景分析

#### 场景 1：Iconify 图标 — `src/views/home/modules/card-data.vue`

```typescript
const cardData = [
  { icon: 'ant-design:bar-chart-outlined',    value: 9725 },
  { icon: 'ant-design:money-collect-outlined', value: 1026 },
  { icon: 'carbon:document-download',          value: 970925 },
  { icon: 'ant-design:trademark-circle-outlined', value: 9527 }
];
```

```vue
<SvgIcon :icon="item.icon" class="text-32px"/>
```

**图标集来源**：`ant-design:` → Ant Design Icons，`carbon:` → Carbon Design System Icons。通过 `@iconify/json` 包提供完整的图标元数据。

#### 场景 2：本地 SVG — `src/components/common/exception-base.vue`

```typescript
const iconMap: Record<ExceptionType, string> = {
  '403': 'no-permission',   // src/assets/svg-icon/no-permission.svg
  '404': 'not-found',       // src/assets/svg-icon/not-found.svg
  '500': 'service-error'    // src/assets/svg-icon/service-error.svg
};
```

```vue
<SvgIcon :local-icon="icon" />
<!-- 渲染为：<svg><use href="#icon-local-no-permission" fill="currentColor"/></svg> -->
```

#### 场景 3：菜单管理 — 两种图标类型并存

```typescript
// src/constants/business.ts
const menuIconTypeRecord = {
  '1': 'page.manage.menu.iconType.iconify',  // Iconify 图标
  '2': 'page.manage.menu.iconType.local'     // 本地 SVG
};
```

```vue
<!-- 菜单操作弹窗 (src/views/manage/menu/modules/menu-operate-modal.vue) -->
<!-- 类型1：Iconify 图标 — 用户输入图标名 -->
<AInput v-model:value="model.icon">
  <template #prefix>
    <SvgIcon v-if="model.icon" :icon="model.icon" class="text-icon"/>
  </template>
</AInput>

<!-- 类型2：本地 SVG — 下拉选择 -->
<ASelect v-model:value="model.icon" :options="localIconOptions">
  <template #option="{ value }">
    <SvgIcon :local-icon="value" class="text-icon"/>
  </template>
</ASelect>
```

### 3.6 辅助工具 — 动态获取本地图标列表

```typescript
// src/utils/icon.ts
export function getLocalIcons() {
  const svgIcons = import.meta.glob('/src/assets/svg-icon/*.svg');
  const keys = Object.keys(svgIcons)
    .map(item => item.split('/').at(-1)?.replace('.svg', '') || '')
    .filter(Boolean);
  return keys;
}
// 返回：['activity', 'at-sign', 'avatar', 'banner', 'cast', ...]
```

**设计精要**：使用 Vite 的 `import.meta.glob` 在构建时静态分析文件系统，生成文件名列表。这不是运行时 `fs.readdir`，而是编译时 glob 模式。

### 3.7 Iconify 离线模式

```typescript
// src/plugins/iconify.ts
import {addAPIProvider} from '@iconify/vue';

export function setupIconifyOffline() {
  const {VITE_ICONIFY_URL} = import.meta.env;
  if (VITE_ICONIFY_URL) {
    addAPIProvider('', {resources: [VITE_ICONIFY_URL]});
  }
}
```

**工作原理**：默认情况下 `@iconify/vue` 会向 `https://api.iconify.design` 请求图标 SVG 数据。通过 `VITE_ICONIFY_URL` 指向自建 API（如 `https://iconify.internal.company.com`），实现离线/内网部署。如果 `VITE_ICONIFY_URL` 未设置，则使用公网 API。

**注意**：即使离线模式，也推荐安装 `@iconify/json` 包（2.2.417），它包含所有图标集的元数据（名称、标签、分类），使搜索和自动补全仍可用。

### 3.8 UnoCSS 通道 — preset-icons

```typescript
// build/plugins/unocss.ts
presetIcons({
  prefix: `${VITE_ICON_PREFIX}-`,     // 'icon-'
  scale: 1,
  extraProperties: { display: 'inline-block' },
  collections: {
    [collectionName]: FileSystemIconLoader(localIconPath, svg =>
      svg.replace(/^<svg\s/, '<svg width="1em" height="1em" ')
    )
  },
  warn: true
})
```

**双通道设计的原因**：

| 对比维度     | SvgIcon 组件（组件通道）           | UnoCSS preset-icons（CSS 通道）           |
|----------|----------------------------|---------------------------------------|
| **使用方式** | `<SvgIcon :icon="name" />` | `<div class="icon-local-avatar" />`   |
| **适用场景** | 动态图标名、变量传入                 | 静态图标、装饰性图标                            |
| **渲染方式** | Vue 组件运行时渲染                | CSS `background-image` / `mask-image` |
| **性能**   | 组件开销（可接受）                  | CSS 原生（极高性能）                          |
| **灵活性**  | 支持 attr 透传                 | 受 CSS 限制（无法改 SVG 内部结构）                |

两者共存的设计体现了"各取所长"：大型静态列表用 CSS 通道（避免组件开销），需要交互或动态的用组件通道。

---

## 四、规范评审清单

基于 `docs/前端开发规范.md`，审查图标相关代码：

### 命名规范检查

| 检查项            | SvgIcon 组件                                      | 评估        |
|----------------|-------------------------------------------------|-----------|
| 文件名 kebab-case | `svg-icon.vue` ✅                                | 符合        |
| 组件名 PascalCase | `defineOptions({ name: 'SvgIcon' })` ✅          | 符合        |
| Props JSDoc    | `/** Iconify icon name */` ✅                    | 有注释       |
| 常量 UPPER_SNAKE | `VITE_ICON_PREFIX` / `VITE_ICON_LOCAL_PREFIX` ✅ | 符合        |
| API 函数         | `getLocalIcons` — 非 fetch 前缀 ✅                  | 工具函数不在此规范 |

### 导入顺序检查 (svg-icon.vue)

```
import {computed, useAttrs} from 'vue';      // Vue 核心
import {Icon} from '@iconify/vue';            // 第三方库
✅ 正确：Vue → 第三方库 → 无内部模块
```

### TypeScript 类型检查

| 检查项                   | 状态                           |
|-----------------------|------------------------------|
| Props 使用 interface 定义 | ✅ `interface Props`          |
| strict 模式             | ✅ 项目 tsconfig `strict: true` |
| 无 any 逃逸              | ✅ 所有类型显式                     |
| Emit 使用类型推导           | ✅ 无 emit（展示组件）               |

### 性能规范

- ✅ 组件无副作用，纯展示型（符合 SFC 最佳实践）
- ✅ `computed` 缓存 symbolId 和 bindAttrs（避免重复计算）
- ✅ `inheritAttrs: false` 精准控制属性透传

---

## 五、功能实践（三阶段）

### 第一阶段：能用 — 使用 SvgIcon 组件

**任务**：在任意页面中使用本地 SVG 和 Iconify 图标

```vue
<script setup lang="ts">
defineOptions({ name: 'IconDemo' });
</script>

<template>
  <div class="flex gap-16px p-24px">
    <!-- Iconify 图标 -->
    <SvgIcon icon="ant-design:smile-outlined" class="text-24px text-blue" />
    <SvgIcon icon="carbon:face-satisfied" class="text-24px text-green" />
    <SvgIcon icon="ph:heart-fill" class="text-24px text-red" />

    <!-- 本地 SVG 图标 -->
    <SvgIcon local-icon="logo" class="text-32px" />
    <SvgIcon local-icon="heart" class="text-24px" />
  </div>
</template>
```

**验收标准**：

- [ ] Iconify 图标正常渲染（F12 Network 看到 api.iconify.design 请求）
- [ ] 本地 SVG 正常显示（Elements 面板看到 `<use href="#icon-local-xxx">`）
- [ ] 颜色通过 `class="text-red"` 正确应用
- [ ] 尺寸通过 `class="text-24px"` 正确缩放

### 第二阶段：规范 — 新增一个本地 SVG 图标

**任务**：在 `src/assets/svg-icon/` 下新增一个自定义 SVG，并在菜单中展示

```bash
# 1. 创建 SVG 文件
cd src/assets/svg-icon/
# 新建一个 dashboard.svg（从 Iconify 下载或自绘）
```

```vue
<!-- 2. 使用（在任意页面中） -->
<SvgIcon local-icon="dashboard" class="text-24px text-primary" />
```

**规范检查清单**：

- [ ] SVG 文件命名使用 kebab-case：`custom-dashboard.svg`
- [ ] SVG 中去掉 `fill` 属性（让 `currentColor` 生效）
- [ ] SVG 中不要写固定 `width/height`（由 SvgIcon 组件统一设置 `1em`）
- [ ] 如需新图标在菜单中可选，`getLocalIcons()` 会自动发现新文件
- [ ] 重启 `pnpm dev`（vite-plugin-svg-icons 需要重新生成 Sprite）

### 第三阶段：极致 — 理解双通道渲染与离线化

**任务 1**：追踪 SvgIcon 的渲染过程

```
用户写: <SvgIcon local-icon="logo" class="text-24px"/>

↓ SvgIcon 组件（运行时）
localIcon="logo" → renderLocalIcon=true → 走本地 SVG 分支

↓ <svg><use href="#icon-local-logo" fill="currentColor"/></svg>

↓ 浏览器查找 id="icon-local-logo" 的 symbol

↓ 在 <body> 尾部（vite-plugin-svg-icons 注入）
<svg id="__SVG_ICON_LOCAL__" style="display:none">
  <symbol id="icon-local-logo" viewBox="0 0 24 24">
    <path d="..." fill="currentColor"/>
  </symbol>
</svg>

↓ 浏览器渲染 SVG logo
```

**任务 2**：搭建 Iconify 离线服务

```bash
# 方案 A：使用 @iconify/tools 本地生成 API
npx @iconify/tools export ant-design --output ./icon-data

# 方案 B：设置内网代理
# .env.local
VITE_ICONIFY_URL=https://iconify.internal.company.com
```

**验收标准**：

- [ ] 断网后 Iconify 图标仍能正常渲染（F12 无 api.iconify.design 请求）
- [ ] 能解释 `#icon-local-xxx` 的 symbol 定义在哪里
- [ ] 能解释项目中为什么同时有 `presetIcons` 和 `createSvgIconsPlugin`

---

## 六、记忆卡

| 概念                           | 速记                                                                         |
|------------------------------|----------------------------------------------------------------------------|
| **Iconify 命名规则**             | `命名空间:图标名`，如 `ant-design:home-outlined`、`ph:user-circle`                   |
| **unplugin-icons 三大件**       | `Icons`（生成组件） + `IconsResolver`（自动注册） + `FileSystemIconLoader`（加载本地 SVG）   |
| **SvgIcon 渲染优先级**            | `localIcon` 优先 → `<use href="#prefix-name">`；否则 → `@iconify/vue <Icon>`    |
| **vite-plugin-svg-icons 作用** | 合并所有本地 SVG 为一个 Sprite → 注入到 `<body>` → 供 `<use>` 引用                        |
| **currentColor 技巧**          | SVG 中 `fill="currentColor"` → 继承父元素 `color` → 配合 UnoCSS 原子类换色              |
| **1em 尺寸设计**                 | SVG `width="1em" height="1em"` → 相对父元素 `font-size` 缩放 → 用 `text-24px` 控制大小 |
| **离线部署**                     | `VITE_ICONIFY_URL` 指向自建 API → `setupIconifyOffline()` → `addAPIProvider()` |
| **getLocalIcons**            | 使用 `import.meta.glob` 构建时静态分析 → 获取所有本地 SVG 文件名                             |
| **双通道设计**                    | 组件通道（`<SvgIcon>` 灵活） + CSS 通道（`class="icon-local-xxx"` 高性能）                |

### 注意事项

- ⚠️ **SVG 不能有 fill 硬编码**：本地 SVG 中应使用 `fill="currentColor"` 或去掉 `fill` 属性，否则无法通过 CSS 改变颜色
- ⚠️ **重启生效**：新增/修改本地 SVG 后必须重启 `pnpm dev`，因为 vite-plugin-svg-icons 在启动时生成 Sprite
- ⚠️ **icon 和 localIcon 不要同时传**：虽然代码处理了（localIcon 优先），但语义上应只传一个
- ⚠️ **@iconify/json 体积**：完整包约 60MB+，生产构建中会被 Tree Shaking，但安装时会占用磁盘空间

---

## 七、今日小结

### 学到什么

1. **Iconify 生态**：统一了 200+ 图标集的访问方式，`命名空间:图标名` 是前端界的图标坐标系统
2. **unplugin-icons 自动导入**：像 Spring 组件扫描一样，构建时发现图标 → 生成 Vue 组件 → 自动注册到模板
3. **本地 SVG 体系**：vite-plugin-svg-icons 生成 SVG Sprite + SvgIcon 组件的 `<use>` 引用 + currentColor 颜色继承
4. **项目双通道设计**：组件通道（灵活）和 CSS 通道（高性能）各司其职

### 练习任务

- [ ] **Stage 1**：在 `src/views/` 下新建一个页面，分别展示 5 个 Iconify 图标和 5 个本地 SVG 图标
- [ ] **Stage 2**：在 `src/assets/svg-icon/` 下新增一个自定义 SVG 图标，确保去掉 fill（使用 currentColor）
- [ ] **Stage 3**：阅读 `build/plugins/unplugin.ts` 全文，画出三个插件的数据流图

### 明日预告

**第32天 — 文件上传与下载：进度条与断点续传**

- 文件选择 (input type="file")
- 上传进度监听 (Axios `onUploadProgress`)
- 大文件分片上传 (Blob.slice)
- 文件下载 (Blob + createObjectURL)
- 断点续传原理

---

> **学习建议**：今天的重点不是"会用图标"，而是理解这套系统的设计哲学 — 从 Maven 坐标类比到双通道架构。下次写 `<SvgIcon>` 时，想想它背后经过了哪几个插件的处理。
