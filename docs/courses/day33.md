# 今日前端课程 — 第33天：剪贴板与拖拽 — 交互增强

> **学习目标**
> - 能读：读懂 carlos-ui 中剪贴板（Clipboard 库）和拖拽排序（vue-draggable-plus）的实现
> - 能用：独立封装一个 `useClipboard` composable 和一个拖拽排序列表组件
> - 规范：遵循项目命名规范、类型完整性、导入顺序、错误处理
> - 精进：理解 Clipboard API vs execCommand 的设计演变、理解 HTML5 Drag & Drop 的原生事件模型
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + clipboard + vue-draggable-plus

---

## 理论学习

### 核心知识点

#### 1. 剪贴板 API：从 `document.execCommand` 到 `navigator.clipboard`

**历史演变**：

| 方案 | 年代 | 特点 | 问题 |
|------|------|------|------|
| `document.execCommand('copy')` | ~2010 | 选中 DOM → 执行命令 | 同步阻塞、仅 HTTP/HTTPS |
| `navigator.clipboard.writeText()` | 2018+ | Promise 异步、权限控制 | 需要安全上下文（HTTPS） |
| `Clipboard` 库 (clipboard.js) | 2014+ | 兼容库，封装 execCommand | 依赖项，额外体积 |

**carlos-ui 的选择**：使用 `clipboard` 库（v2.0.11），因为它兼容性好、API 简洁、不需要 HTTPS。

```typescript
// clipboard 库的标准用法（参考 config-operation.vue）
import Clipboard from 'clipboard';

const clipboard = new Clipboard(domElement, {
  text: () => getTextToCopy()  // 返回要复制的字符串
});

clipboard.on('success', () => {
  window.$message?.success('复制成功');
});
```

**现代 API 对比**（如果你写新功能，可以考虑）：

```typescript
// 优点：不需要 DOM 元素、无需选中文本、Promise 风格
await navigator.clipboard.writeText('要复制的文本');
// 读取剪贴板
const text = await navigator.clipboard.readText();
// 局限性：需要 HTTPS 或 localhost、需要用户授权
```

#### 2. HTML5 拖拽 API：原生事件模型

**原生拖拽的事件流程**：

```
拖拽源（draggable="true"）          放置目标（有 dragover 监听）
dragstart → 设置数据              ↓
drag → 拖动中（持续触发）           dragover → 必须 preventDefault() 才能 drop
dragend → 结束拖拽                drop → 获取数据，执行操作
```

**核心原则**：
- 只有设置了 `draggable="true"` 的元素才能被拖拽
- 放置目标必须监听 `dragover` 并调用 `event.preventDefault()` 才允许放置
- `dragstart` 中通过 `event.dataTransfer.setData()` 传递数据
- `drop` 中通过 `event.dataTransfer.getData()` 读取数据

```typescript
// 原生拖拽示例
function handleDragStart(e: DragEvent) {
  e.dataTransfer!.setData('text/plain', itemId);
  e.dataTransfer!.effectAllowed = 'move';
}

function handleDragOver(e: DragEvent) {
  e.preventDefault(); // 必须！否则不能 drop
  e.dataTransfer!.dropEffect = 'move';
}

function handleDrop(e: DragEvent) {
  const id = e.dataTransfer!.getData('text/plain');
  // 执行排序逻辑
}
```

#### 3. vue-draggable-plus：Vue 3 的拖拽排序库

**carlos-ui 选择 `vue-draggable-plus`（v0.6.0）的原因**：

- 基于 `SortableJS`（业界标准）的 Vue 3 封装
- 支持 `v-model` 双向绑定，数组自动重排
- 支持 Vue 3 Composition API 和 TSX
- 支持 `filter` 排除不可拖拽元素
- 支持动画配置

```vue
<template>
  <!-- 核心用法：v-model 绑定列表，自动重排 -->
  <VueDraggable v-model="list" :animation="150" filter=".no-drag">
    <div v-for="item in list" :key="item.id">
      <!-- 拖拽手柄 -->
      <span class="drag-handle">⋮⋮</span>
      <!-- 不可拖拽的内容 -->
      <span class="no-drag">{{ item.name }}</span>
    </div>
  </VueDraggable>
</template>
```

### Java 思维类比

| 前端概念 | Java 类比 | 说明 |
|----------|-----------|------|
| `Clipboard` 库 | Java `java.awt.datatransfer.Clipboard` | 系统剪贴板操作封装 |
| `navigator.clipboard.writeText()` | Java `Toolkit.getDefaultToolkit().getSystemClipboard().setContents()` | 异步 vs 同步 |
| HTML5 Drag & Drop | Java Swing `TransferHandler` + `DropTargetListener` | 拖拽源 + 放置目标模式 |
| `vue-draggable-plus` | Java `SortableTableModel` 或 `JList` 的拖拽重排 | 列表排序的高级封装 |
| `dragover` 必须 `preventDefault()` | Java `consume()` 事件消费 | 阻止默认行为 |
| `dataTransfer.setData()` | Java `Transferable.getTransferData()` | 拖拽数据传递 |

### 超越类比 — 前端独有的设计哲学

> **为什么前端拖拽用事件委托而非直接监听？**
>
> Java Swing 中每个 `JComponent` 可以独立添加 `MouseListener`。但前端中，大列表的每个项都绑定事件会导致：
> 1. **内存浪费**：1000 个元素 = 1000 个事件监听器
> 2. **动态元素问题**：新增的元素没有绑定监听
> 3. **性能问题**：每个监听器都是闭包，GC 压力大
>
> 前端解决方案：**在父容器上监听，通过 `event.target` 判断操作对象**。vue-draggable-plus 底层 SortableJS 就是这样工作的——它只在外层容器上绑定一次事件。

> **为什么 clipboard 库还在用 `execCommand` 而不是 `navigator.clipboard`？**
>
> 这是前端"渐进增强"哲学的体现：
> - `execCommand` 在 HTTP 和 HTTPS 下都能工作
> - `navigator.clipboard` 只在 HTTPS/localhost 下可用
> - carlos-ui 可能在非 HTTPS 内网部署，用 clipboard 库是最稳妥的选择
> - 类比 Java：就像 Java 8 到 17 的迁移——新 API 更好，但要考虑部署环境

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

- `src/components/advanced/table-column-setting.vue` — 拖拽排序（vue-draggable-plus）
- `src/layouts/modules/theme-drawer/modules/config-operation.vue` — 剪贴板复制（clipboard 库）
- `src/store/modules/theme/index.ts` — 中 `settingsJson` computed（被复制的内容）

### 阅读指引

#### 阅读顺序

**先读 table-column-setting.vue（拖拽）**：

1. 看导入：`import {VueDraggable} from 'vue-draggable-plus'` — 只有这一个拖拽相关导入
2. 看 `defineModel` — 使用 Vue 3.4+ 的 `defineModel` 宏定义 `v-model:columns`，类型是 `AntDesign.TableColumnCheck[]`
3. 看模板中的 `<VueDraggable>` — `v-model="columns"` 绑定数组，`:animation="150"` 动画时长 150ms，`filter=".none_draggable"` 排除 checkbox 区域
4. 看图标：`<icon-mdi-drag class="mr-8px h-full cursor-move text-icon"/>` — 拖拽手柄提示

**再读 config-operation.vue（剪贴板）**：

1. 看导入：`import Clipboard from 'clipboard'` — 注意这是第三方库，不是浏览器 API
2. 看 `initClipboard()` 函数 — `new Clipboard(domRef.value, { text: () => getClipboardText() })` — 绑定 DOM 元素，text 是工厂函数（每次点击才执行）
3. 看 `getClipboardText()` — 用正则 `/"\w+":/g` 去掉 JSON key 的双引号，因为复制出去希望是 JS 对象的格式而非 JSON 字符串
4. 看 `clipboard.on('success', ...)` — 事件监听复制成功
5. 看生命周期：`onMounted` 中初始化，为什么不在 `setup` 顶层初始化？因为 `domRef` 还没挂载到 DOM

### 规范评审清单

#### 文件1：`src/components/advanced/table-column-setting.vue`

| 检查项 | 标准 | 是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件 kebab-case、组件 PascalCase（defineOptions name） | ✅ `table-column-setting.vue` / `TableColumnSetting` |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ 使用泛型 `generic="T extends Record<string, unknown>, K = never"` |
| 目录规范 | 文件放在正确的目录 | ✅ `components/advanced/` → 高级业务组件 |
| 导入顺序 | type 导入 → 第三方库 → 内部模块 → 相对路径 | ⚠️ 缺少 `import type`，第三方库只导入了一个 `VueDraggable`，符合要求 |
| 错误处理 | 所有异步有 try/catch | ✅ 无异步操作，无风险 |
| 可测试性 | 纯函数可单测，副作用可 mock | ⚠️ `defineModel` 的 columns 双向绑定耦合了组件外部状态，但这是 Vue 组件设计模式 |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ `$t('common.columnSetting')` |

#### 文件2：`src/layouts/modules/theme-drawer/modules/config-operation.vue`

| 检查项 | 标准 | 是否达标？ |
|--------|------|---------------|
| 命名规范 | 文件 kebab-case、组件 PascalCase | ✅ `config-operation.vue` / `ConfigOperation` |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ⚠️ `domRef` 类型为 `HTMLElement \| null`，类型正确 |
| 目录规范 | 文件放在正确的目录 | ✅ `layouts/modules/theme-drawer/modules/` — 布局子模块 |
| 导入顺序 | type 导入 → 第三方库 → 内部模块 → 相对路径 | ✅ vue 在前，clipboard 第三方库，`@/` 内部模块，符合规范 |
| 错误处理 | 所有异步有 try/catch | ✅ `initClipboard` 中有 `if (!domRef.value) return;` 的防御性检查 |
| 可测试性 | 纯函数可单测，副作用可 mock | ⚠️ `Clipboard` 依赖真实 DOM，需要 jsdom 环境才能测试 |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ 所有用户可见文案都使用 `$t()` |

**代码改进建议**（"你做得很好，但这里可以更好"）：

1. **config-operation.vue**：`clipboard` 实例没有在组件卸载时销毁，建议加上 `onScopeDispose`：
```typescript
let clipboard: Clipboard | null = null;

function initClipboard() {
  if (!domRef.value) return;
  clipboard = new Clipboard(domRef.value, { text: () => getClipboardText() });
  clipboard.on('success', () => { /* ... */ });
}

onMounted(() => { initClipboard(); });
onScopeDispose(() => { clipboard?.destroy(); }); // 防止内存泄漏
```

2. **table-column-setting.vue**：`VueDraggable` 的 `v-model` 数组更新是直接修改引用吗？如果外部期望不可变性，需要 emit 一个新数组。

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

**目标**：实现一个"系统通知消息管理"页面，包含：
1. 消息列表拖拽排序（vue-draggable-plus）
2. 一键复制消息内容（Clipboard 库 / navigator.clipboard）
3. 复制成功后 Toast 提示

**拆解为 3 个子任务**：

| 子任务 | 技术点 | 预计用时 |
|--------|--------|----------|
| 1. 封装 `useClipboard` composable | 剪贴板操作抽象、类型安全 | 20min |
| 2. 封装 `SortableList` 组件 | vue-draggable-plus 封装、过滤、动画 | 25min |
| 3. 整合为通知管理页面 | 组合 composable + 组件 | 25min |

### 第二步：小任务开发

#### 子任务 1：`useClipboard` composable

**设计思路**：封装两种复制方式 —
- 基于 Clipboard 库（兼容 HTTP）
- 基于 `navigator.clipboard`（现代、推荐）

```typescript
// src/hooks/common/clipboard.ts
import Clipboard from 'clipboard';

interface UseClipboardOptions {
  /** 复制成功回调 */
  onSuccess?: (text: string) => void;
  /** 复制失败回调 */
  onError?: (error: Error) => void;
  /** 复制来源：dom（绑定DOM元素）| api（navigator.clipboard） */
  source?: 'dom' | 'api';
}

/**
 * 剪贴板操作 composable
 *
 * 封装两种复制方式：
 * - dom 模式：使用 Clipboard 库绑定 DOM 元素（兼容 HTTP）
 * - api 模式：使用 navigator.clipboard API（现代浏览器）
 */
export function useClipboard(options: UseClipboardOptions = {}) {
  const { onSuccess, onError } = options;

  let clipboardInstance: Clipboard | null = null;

  /** 绑定 DOM 元素进行复制（使用 Clipboard 库） */
  function bindClipboard(element: HTMLElement, getText: () => string) {
    // 先销毁旧实例
    clipboardInstance?.destroy();

    clipboardInstance = new Clipboard(element, {
      text: () => getText()
    });

    clipboardInstance.on('success', () => {
      const text = getText();
      onSuccess?.(text);
    });

    clipboardInstance.on('error', (e) => {
      onError?.(new Error('Copy failed'));
    });
  }

  /** 直接复制文本（使用 navigator.clipboard API） */
  async function copyText(text: string): Promise<boolean> {
    try {
      // 优先使用现代 API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        onSuccess?.(text);
        return true;
      }
      // 降级方案：使用 Clipboard 库
      throw new Error('navigator.clipboard not available');
    } catch (error) {
      // 降级：execCommand 兜底
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (success) {
        onSuccess?.(text);
        return true;
      }
      onError?.(error as Error);
      return false;
    }
  }

  /** 销毁剪贴板实例 */
  function destroy() {
    clipboardInstance?.destroy();
  }

  return {
    bindClipboard,
    copyText,
    destroy
  };
}
```

**技术要点**：
- 为什么 `copyText` 中要先判断 `navigator.clipboard` 再降级到 `execCommand`？—— 渐进增强：能用新 API 就用新的，不行就降级
- 为什么 `clipboardInstance?.destroy()` 使用可选链？—— JavaScript 中第三方库实例可能在任何时候被置空
- `window.isSecureContext` 是什么？—— 判断当前环境是否是安全上下文（HTTPS 或 localhost）

#### 子任务 2：`SortableList` 通用组件

```vue
<!-- src/components/common/sortable-list.vue -->
<script setup lang="ts" generic="T extends Record<string, unknown>">
import type { Options } from 'sortablejs';
import { VueDraggable } from 'vue-draggable-plus';

defineOptions({
  name: 'SortableList'
});

interface Props {
  /** 列表数据 */
  modelValue: T[];
  /** 唯一键字段名，默认 'id' */
  itemKey?: string;
  /** 拖拽动画时长（ms），默认 150 */
  animation?: number;
  /** 不可拖拽元素的 CSS 选择器 */
  filter?: string;
  /** SortableJS 额外配置 */
  sortableOptions?: Options;
}

const props = withDefaults(defineProps<Props>(), {
  itemKey: 'id',
  animation: 150,
  filter: ''
});

const emit = defineEmits<{
  'update:modelValue': [value: T[]];
  change: [newList: T[], oldIndex: number, newIndex: number];
}>();

const list = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

function handleChange(event: { oldIndex: number; newIndex: number }) {
  emit('change', [...list.value], event.oldIndex, event.newIndex);
}
</script>

<template>
  <VueDraggable
    v-model="list"
    :animation="animation"
    :filter="filter"
    v-bind="sortableOptions"
    @change="handleChange"
  >
    <slot />
  </VueDraggable>
</template>

<style scoped></style>
```

**技术要点**：
- 为什么用 `computed` 做 get/set 而不是直接用 `defineModel`？—— 需要在 set 时做额外处理时用 computed，这里为了下一层封装保留灵活性
- `<slot />` 的作用是什么？—— 将子元素的渲染权交给使用者，保持组件通用性（类比 Java 模板方法模式中的 `abstract render()`）
- `v-bind="sortableOptions"` 是什么？—— Vue 的动态属性绑定，将 Options 对象的属性展开绑定（类比 Java 可变参数）

#### 子任务 3：通知管理页面

```vue
<!-- src/views/manage/notification/index.vue -->
<script setup lang="ts">
import type { Ref } from 'vue';
import { ref } from 'vue';
import { useClipboard } from '@/hooks/common/clipboard';
import SortableList from '@/components/common/sortable-list.vue';
import { $t } from '@/locales';

defineOptions({
  name: 'NotificationManage'
});

interface NotificationItem {
  id: number;
  title: string;
  content: string;
  order: number;
  createdAt: string;
}

const { copyText } = useClipboard({
  onSuccess: (text) => {
    window.$message?.success($t('common.copySuccess'));
  },
  onError: (error) => {
    window.$message?.error($t('common.copyFailed'));
  }
});

const notificationList: Ref<NotificationItem[]> = ref([
  { id: 1, title: '系统维护通知', content: '本周六 02:00-06:00 系统维护...', order: 1, createdAt: '2026-06-25' },
  { id: 2, title: '新版本发布', content: 'v2.3.0 已发布，新增...', order: 2, createdAt: '2026-06-26' },
  { id: 3, title: '安全提醒', content: '请及时修改密码...', order: 3, createdAt: '2026-06-27' }
]);

function handleCopyContent(content: string) {
  copyText(content);
}

function handleOrderChange(newList: NotificationItem[], oldIndex: number, newIndex: number) {
  // 更新 order 字段
  // 后端通过 fetchUpdateNotificationOrder 更新排序
  console.log('排序变更', { oldIndex, newIndex });
}
</script>

<template>
  <ACard :title="$t('page.manage.notification.title')" :bordered="false" class="card-wrapper">
    <SortableList
      v-model="notificationList"
      :animation="150"
      filter=".no-drag"
      @change="handleOrderChange"
    >
      <div
        v-for="item in notificationList"
        :key="item.id"
        class="flex items-center gap-12px p-12px mb-8px rd-6px bg-container hover:bg-primary-opacity"
      >
        <!-- 拖拽手柄 -->
        <icon-mdi-drag class="cursor-move text-icon text-18px" />
        <!-- 内容区域 -->
        <div class="flex-1 min-w-0">
          <div class="text-14px font-500 truncate">{{ item.title }}</div>
          <div class="text-12px text-secondary mt-4px truncate">{{ item.content }}</div>
        </div>
        <!-- 复制按钮 -->
        <AButton
          size="small"
          type="text"
          class="no-drag"
          @click="handleCopyContent(item.content)"
        >
          <template #icon>
            <icon-ant-design-copy-outlined />
          </template>
          {{ $t('common.copy') }}
        </AButton>
        <!-- 时间 -->
        <span class="text-12px text-placeholder no-drag">{{ item.createdAt }}</span>
      </div>
    </SortableList>
  </ACard>
</template>

<style scoped></style>
```

### 第三步：整合与调试

**整合要点**：

1. **数据流**：`notificationList` (ref) → `v-model` → SortableList (computed get/set) → VueDraggable (v-model)
2. **拖拽与复制的隔离**：通过 `class="no-drag"` + `filter=".no-drag"` 阻止复制按钮和日期区域触发拖拽
3. **复制成功后排序不变**：`copyText` 是异步操作但不修改列表数据，复制和拖拽互不影响

**调试思路**：

| 问题 | 排查方向 |
|------|----------|
| 拖拽不生效 | 检查是否添加了 `filter` 且全部元素都被过滤了；检查 `itemKey` 是否正确 |
| 复制无反应 | 检查浏览器控制台：是否 HTTPS？`navigator.clipboard` 是否可用？ |
| 拖拽后数组未更新 | 检查 `v-model` 绑定是否正确，是否使用了 `computed` 的 get 但忘记 set |
| 复制按钮也能拖拽 | 检查 `filter=".no-drag"` 是否正确，确保按钮上有相应 class |
| 动画闪烁 | 检查 `animation` 值是否为正数，或者 CSS transition 有冲突 |

### 验收标准

- [ ] 能用：列表可以拖拽排序，消息内容可以一键复制
- [ ] 规范：`pnpm typecheck` 通过，`pnpm lint` 通过
- [ ] 精进：对照规范评审清单自检通过
  - [ ] 零 any：所有泛型、Props、Emits 类型完整
  - [ ] 错误处理：复制失败有降级方案
  - [ ] 国际化：用户可见字符串使用 `$t()`
  - [ ] 导入顺序：type → 第三方 → `@/` → 相对路径
  - [ ] 内存安全：`onScopeDispose` 中销毁 Clipboard 实例

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `navigator.clipboard.writeText()` | 现代异步剪贴板 API | `Clipboard.setContents()` | 需要安全上下文（HTTPS），异步 Promise 风格 |
| `Clipboard` 库 | 兼容库，封装 execCommand，绑定 DOM 元素 | 旧版 AWT Clipboard | 在非 HTTPS 环境下也能工作 |
| HTML5 Drag & Drop | 原生拖拽：dragstart→dragover→drop | Swing `TransferHandler` | `dragover` 必须 preventDefault() 才允许 drop |
| `vue-draggable-plus` | SortableJS 的 Vue 3 封装，支持 v-model 双向绑定 | `SortableTableModel` | 通过 `filter` 排除不可拖拽元素，事件委托性能好 |
| `dataTransfer` | 拖拽过程中传递数据的载体 | `Transferable.getTransferData()` | `setData(type, value)` / `getData(type)` 键值对模型 |
| `execCommand('copy')` | 旧版同步复制方案 | 无直接类比 | 需要选中 DOM 文本，已被 clipboard API 取代但仍作降级 |

---

## 拓展思考

### 1. 为什么要封装 composable 而不是直接用 clipboard 库？

> 直接在组件中 `new Clipboard(ref)` 也能工作，但存在以下问题：
> - **不可复用**：每个需要复制的页面都要重复写初始化/销毁逻辑
> - **不可测试**：Clipboard 实例创建与业务逻辑耦合，单元测试时需要 mock DOM
> - **不可替换**：如果将来要换成 `navigator.clipboard`，每个页面都要改

> Composable 封装的好处（类比 Java 的 Service 层）：
> - **统一接口**：`copyText(text)` — 调用方不关心底层是 clipboard 还是 execCommand
> - **集中管理**：降级策略、错误处理、生命周期管理都在一个地方
> - **易于测试**：可以 mock `useClipboard` 的返回值

### 2. 拖拽排序的性能陷阱

> 如果你拖拽一个包含 1000 条数据的列表，每帧都在触发 Vue 的响应式更新：
> - **问题**：拖拽过程中数组引用频繁变化，触发大量 re-render
> - **解决方案**：vue-draggable-plus 底层 SortableJS 使用 DOM 操作而非数据驱动排序，只在 `change` 事件时更新数据
> - **原理**：拖拽过程中直接操作 DOM（`insertBefore`），拖拽结束才通过 v-model 同步数据。这避免了 React/Vue 的"数据驱动渲染"在拖拽场景下的性能问题。

---

**明日预告**：第34天 — 浏览器存储：从 Cookie 到 IndexedDB
