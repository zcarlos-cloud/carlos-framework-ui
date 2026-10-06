# 今日前端课程 — 第 18 天：动画与过渡 — Transition / TransitionGroup

> **学习目标**
> - **能读**：理解 Vue 的 `<Transition>` 和 `<TransitionGroup>` 组件，掌握 enter/leave 的 CSS 钩子类名
> - **能用**：能为页面切换、列表项增删、条件显示/隐藏添加流畅的过渡动画
> - **规范**：动画类名定义在 `src/styles/css/transition.css`，组件局部动画定义在 `<style scoped>` 中
> - **精进**：理解 `mode="out-in"` 的深层原理，避免 DOM 节点冲突；区分 `v-if` 和 `v-show` 在 Transition 中的差异；理解 FLIP 列表动画原理
> ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + UnoCSS

---

## 理论学习

### 核心知识点

1. **Vue 的 `<Transition>` 组件**
   - 不是一个真正的 DOM 元素，而是 Vue 的**包装组件**（built-in component），用来给单个元素/组件的插入或移除添加过渡效果
   - 它只能包裹**一个**元素或组件。如果要处理多个元素，必须用 `<TransitionGroup>`
   - 被包裹的元素在出现（`v-if` 从 false → true）或消失（`v-if` 从 true → false）时，Vue 会自动注入 6 个 CSS 类名到该元素上：
     - `v-enter-from` / `v-enter-active` / `v-enter-to`（进入时）
     - `v-leave-from` / `v-leave-active` / `v-leave-to`（离开时）
   - 如果给 `<Transition name="fade">`，类名会替换为 `fade-enter-from` 等

2. **CSS 类名生命周期（以 `name="fade"` 为例）**

   ```
   元素出现（v-if = true）
   ├─ 插入元素到 DOM
   ├─ 添加 fade-enter-from（opacity: 0）
   ├─ 添加 fade-enter-active（transition: opacity 0.3s）
   ├─ 下一帧（requestAnimationFrame）移除 fade-enter-from，添加 fade-enter-to（opacity: 1）
   ├─ 等待 transition 结束
   └─ 移除 fade-enter-active 和 fade-enter-to

   元素消失（v-if = false）
   ├─ 添加 fade-leave-from（opacity: 1）
   ├─ 添加 fade-leave-active（transition: opacity 0.3s）
   ├─ 下一帧移除 fade-leave-from，添加 fade-leave-to（opacity: 0）
   ├─ 等待 transition 结束
   └─ 移除 DOM 元素 + 所有类名
   ```

   **关键理解**：`enter-from` 和 `leave-to` 是过渡的起始/终止状态，`enter-active` 和 `leave-active` 是 CSS 的 `transition` 定义（告诉浏览器哪些属性要动画）。Vue 在**下一帧**才移除 `from` 类并添加 `to` 类，这样浏览器能检测到 CSS 属性的变化，从而触发 transition。

3. **`<Transition>` 的 `mode` 属性**
   - `mode="out-in"`：当前元素先离开（out），新元素再进入（in）。**这是页面切换的标配**
   - `mode="in-out"`：新元素先进入，当前元素再离开（较少用）
   - 如果不设 mode，两个元素会同时存在于 DOM 中，导致布局问题（两个元素重叠或并排）
   - **为什么必须有 mode？** 如果不设，在 RouterView 切换路由时，两个页面组件同时渲染，DOM 中同时有两个页面，会出现短暂的布局错乱。`out-in` 确保旧页面完全消失后再插入新页面。

4. **`<TransitionGroup>` 组件**
   - 用于列表的增删重排动画，必须包裹多个元素（如 `v-for` 列表）
   - 与 `<Transition>` 不同：它不渲染真实 DOM 元素，而是直接渲染其子元素（默认渲染为 `<span>` 标签，可通过 `tag` 属性指定）
   - 除了 `enter`/`leave` 类名，还多了 `move` 类名：当列表项**位置变化**时，Vue 会应用 `move` 类
   - 列表项必须绑定**唯一的 `key`**（`v-for` 的 `key`），TransitionGroup 依赖 key 来判断哪个元素是新增/删除/移动

5. **FLIP 动画（First-Last-Invert-Play）**
   - Vue 的 `<TransitionGroup>` 内部使用了 FLIP 技术来实现列表项的位置变化动画
   - 原理：记录元素初始位置（First），获取新位置（Last），计算位移差（Invert），通过 CSS transform 反向偏移，然后去掉 transform 让元素平滑过渡到新位置（Play）
   - **Vue 的 move 类名**就是配合这个原理的：可以定义 `transition: transform 0.3s` 让位置变化产生动画

6. **CSS `@keyframes` 动画**
   - 除了 CSS `transition`，也可以用 `@keyframes` 做更复杂的动画（如旋转、无限循环）
   - `src/styles/css/nprogress.css` 中的 `nprogress-spinner` 就是 keyframes 动画：
     ```css
     @keyframes nprogress-spinner {
       0% { transform: rotate(0deg); }
       100% { transform: rotate(360deg); }
     }
     ```
   - `transition` 是**状态变化**触发的动画（A → B）；`@keyframes` 是**时间线驱动**的动画（0% → 100%），可以循环、往复

### Java 思维类比

> - `<Transition>` 的 enter/leave 类名注入 ≈ Java Swing 的 `ContainerListener`（`componentAdded`/`componentRemoved`），但 Vue 把 CSS 动画的时机自动管理了，你不需要手动计算时间
> - `mode="out-in"` ≈ Java 的 `CardLayout` 切换卡片时，先移除旧卡片再添加新卡片的策略，避免两个卡片重叠
> - `<TransitionGroup>` 的 FLIP 动画 ≈ Java 表格数据排序时，重绘行位置。Vue 的 FLIP 比 Java 的 Swing 更聪明：它通过 CSS transform 而不是重布局来实现，性能更好（避免了重排）
> - CSS `@keyframes` ≈ JavaFX 的 `Timeline` 和 `Animation` 类，定义关键帧和缓动函数

### 超越类比 — 前端独有的设计哲学

> **为什么 Vue 选择 CSS 类名注入而不是直接操作 style？**
> 1. **关注点分离**：动画逻辑完全交给 CSS 声明式处理，Vue 只负责在正确的时机添加/移除类名。这与 Java 的"命令式"动画（`timeline.play()`）完全不同，CSS 声明式动画可以被浏览器 GPU 加速，性能更好。
> 2. **CSS 变量的实时性**：通过 CSS 变量（如 `var(--primary-color)`）可以动态改变动画颜色，而不需要重新计算 JS 中的动画逻辑。
> 3. **FLIP 的零重排**：Vue 的 `move` 动画使用 `transform` 而不是 `margin`/`top`/`left` 来改变位置，这样**不会触发浏览器的重排（Reflow）**，只触发重绘（Repaint），性能提升一个数量级。在 Java Swing 中，移动组件必然触发布局重计算，这是前端比桌面 GUI 更高级的地方。
> 4. **组合式灵活性**：Vue 的 Transition 可以与 `v-if`、`v-show`、`component :is`、`<KeepAlive>` 任意组合，形成无限多的动画场景。Java 的动画通常是固定的 API 调用，组合能力有限。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

- `src/styles/css/transition.css` — 全局页面过渡动画（fade、fade-slide、fade-bottom、fade-scale、zoom-fade、zoom-out）
- `src/layouts/modules/global-content/index.vue` — 页面路由切换的 Transition 封装
- `src/views/_builtin/login/index.vue` — 登录模块切换的 Transition 使用
- `src/layouts/modules/theme-drawer/modules/page-fun.vue` — TransitionGroup 列表动画
- `src/layouts/modules/theme-drawer/modules/dark-mode.vue` — 自定义 Transition 局部动画
- `src/components/custom/count-to.vue` — VueUse `useTransition` 数字动画
- `src/styles/css/nprogress.css` — 页面加载进度条动画（@keyframes）

### 阅读指引

1. **先看 `transition.css`**：所有 6 种全局页面动画都在这里定义。注意每种动画的 `enter-from` 和 `leave-to` 状态是对称的（比如 `fade-slide` 进入从左移入，离开从右移出）。

2. **再看 `global-content/index.vue`**：这是 Vue Router 页面切换的核心。它用 `<Transition>` 包裹 `<KeepAlive>` 包裹 `<component :is>`，形成"路由切换 → 动画过渡 → 缓存保持"的完整链路。注意 `mode="out-in"` 是页面切换的**必须设置**。

3. **再看 `login/index.vue`**：登录模块（密码登录/短信登录/注册/重置密码）通过 `<component :is="activeModule.component" />` 切换，配合 `mode="out-in"` 的 Transition。注意它使用了 `appear` 属性，表示**首次渲染时也会触发动画**。

4. **再看 `theme-drawer/modules/page-fun.vue`**：TransitionGroup 的经典用法。`tag="div"` 表示用 `<div>` 作为外层容器，`name="setting-list"` 指定类名前缀。注意 `<style scoped>` 中定义了 `.setting-list-move` 和 `.setting-list-enter-active` 等。这里用 `v-if` 控制列表项的显示/隐藏，TransitionGroup 自动处理列表的增删动画。

5. **再看 `dark-mode.vue` 的局部动画**：这是一个自定义 Transition 的完整例子。`<Transition name="sider-inverted">` 配合 `<style scoped>` 中的 `.sider-inverted-enter-active` 等类名。注意它使用了 `--uno: transition-all-300` 这种 UnoCSS 原子类来简化 CSS 定义。这是一个非常好的**规范实践**：在 scoped style 中通过 UnoCSS 简化动画声明。

6. **最后看 `count-to.vue`**：这里使用了 VueUse 的 `useTransition`，不是 Vue 的 `<Transition>` 组件。`useTransition` 是一个**数值过渡 Hook**：把数字变化变成一个平滑的动画过程。它用 `TransitionPresets` 定义了各种缓动函数（linear、easeInOut 等）。

### 规范评审清单

| 检查项 | 标准 | 该文件是否达标？ |
|--------|------|---------------|
| 命名规范 | 动画名使用 kebab-case（如 `fade-slide`、`sider-inverted`） | ✅ `transition.css` 中所有动画名均为 kebab-case；`page-fun.vue` 中 `name="setting-list"` 也是 kebab-case |
| 类型完整性 | 零 any，所有参数/返回值有类型 | ✅ `global-content/index.vue` 中 Props 有接口定义；`login/index.vue` 中 `interface LoginModule` 有完整类型；`count-to.vue` 中 Props 接口完整 |
| 目录规范 | 全局 CSS 放在 `src/styles/css/`；局部动画放在组件的 `<style scoped>` | ✅ 全局 transition 在 `styles/css/transition.css`；局部动画在 `dark-mode.vue` 的 `<style scoped>` 中 |
| 导入顺序 | type导入 → 第三方库 → 内部模块 → 相对路径 | ✅ `global-content/index.vue` 中 `@sa/materials`（第三方）→ `@/store/`（内部）→ `@/locales`（内部）；`login/index.vue` 中 `@sa/utils` → `@/constants` → `@/store` → `./modules/` |
| 错误处理 | 无异步操作，不适用 | N/A 这些文件不涉及异步请求 |
| 可测试性 | 纯函数可单测，副作用可 mock | ✅ 动画是纯 CSS 行为，不需要 JS 测试；`count-to.vue` 中的 `formatValue` 是纯函数，可单测；`transition` 的 `computed` 逻辑简单，可测试 |
| 国际化 | 用户可见字符串使用 `$t()` | ✅ `login/index.vue` 中 `$t('system.title')` 和 `$t(activeModule.label)` 使用国际化；`global-content` 中没有直接面向用户的文本 |
| 组件命名 | 通过 `defineOptions` 声明 PascalCase 组件名 | ✅ `global-content` 声明 `name: 'GlobalContent'`；`login` 声明 `name: 'Login'`（文件名也是 `login/index.vue`） |
| 样式规范 | 优先使用 UnoCSS 原子类；复杂动画用 CSS 文件 | ✅ `dark-mode.vue` 中 `--uno: h-22px transition-all-300` 是 UnoCSS 原子类；全局过渡动画在 `transition.css` 中 |

**评审发现**：
1. `transition.css` 中 `transition: opacity 0.25s, transform 0.3s` 和 `transition: all 0.3s` 的写法是项目允许的，但最佳实践建议用 `--uno: transition-all-300` 或 `transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out` 来明确指定哪些属性需要动画（性能优化：避免所有属性都参与 transition）。
2. `transition.css` 中 `transition: opacity 0.25s, transform 0.3s` 两行逗号后面没有空格，这在其他 CSS 文件中也存在。虽然不影响运行，但代码风格可以统一（用 `transition: opacity 0.25s, transform 0.3s`）。
3. `global-content/index.vue` 中 `transitionName` 计算的是 `themeStore.page.animate ? themeStore.page.animateMode : ''`，当动画关闭时传空字符串给 `<Transition :name>`，Vue 会忽略类名注入，这是一个优雅的**降级策略**。

---

## 功能实践 — 分三步

### 第一步：功能分析和拆解

**目标**：为 carlos-ui 的一个列表页面（如用户管理页面）添加表格行增删的过渡动画。

**拆解小任务**：

1. **理解现有表格结构**：找一个使用 `a-table` 的视图，分析数据行是如何增删的
2. **在 `a-table` 上添加过渡效果**：为表格行的添加/删除添加过渡动画
3. **配置路由页面切换动画**：确保页面级别的动画与表格行动画不冲突

### 第二步：小任务开发

#### 小任务 1：阅读表格组件结构

打开 `src/views/manage/user/index.vue`（或类似的表格视图），观察表格的数据源和增删逻辑。通常：
- 表格数据来自 Pinia Store 或 API 请求
- 删除操作通过 `fetchDeleteUser(id)` 然后重新加载列表
- 添加/编辑通过 Drawer 或 Modal 完成

#### 小任务 2：在表格上添加动画

`a-table` 本身没有直接支持 `<TransitionGroup>`，但我们可以通过以下方式实现动画：

**方案 A：对表格行使用自定义动画（通过 `a-table` 的 `rowClassName` 或自定义渲染）**

这个方案比较复杂，因为 `a-table` 内部渲染的是虚拟 DOM 的列表，不容易直接控制每个 `<tr>` 的 Transition。

**方案 B：在表格数据变化前/后添加一个简化的过渡效果**

在数据刷新时，给表格容器添加一个短暂的不透明度变化：

```vue
<script setup lang="ts">
import { ref, nextTick } from 'vue';

const tableLoading = ref(false);

async function refreshData() {
  tableLoading.value = true;
  // 模拟数据加载
  await nextTick();
  // ... 加载数据
  tableLoading.value = false;
}
</script>

<template>
  <Transition name="fade" mode="out-in">
    <ATable
      v-if="!tableLoading"
      :columns="columns"
      :data-source="dataSource"
    />
  </Transition>
</template>
```

这个方案太简单，没有真正利用 TransitionGroup。

**方案 C（推荐）：用自定义列表替代 a-table，实现列表项增删动画**

在实际项目中，我们可以用 `<TransitionGroup>` 替代 `a-table` 的列表部分，实现更流畅的动画：

```vue
<script setup lang="ts">
import { ref } from 'vue';

interface User {
  id: number;
  userName: string;
  status: string;
}

const userList = ref<User[]>([
  { id: 1, userName: 'admin', status: 'active' },
  { id: 2, userName: 'user1', status: 'inactive' },
  { id: 3, userName: 'user2', status: 'active' }
]);

function addUser() {
  const newId = Math.max(...userList.value.map(u => u.id), 0) + 1;
  userList.value.unshift({ id: newId, userName: `user${newId}`, status: 'active' });
}

function deleteUser(id: number) {
  const index = userList.value.findIndex(u => u.id === id);
  if (index > -1) {
    userList.value.splice(index, 1);
  }
}

function toggleUserStatus(id: number) {
  const user = userList.value.find(u => u.id === id);
  if (user) {
    user.status = user.status === 'active' ? 'inactive' : 'active';
  }
}
</script>

<template>
  <div class="flex-col-stretch gap-12px">
    <div class="flex gap-12px">
      <AButton type="primary" @click="addUser">新增用户</AButton>
    </div>
    <TransitionGroup tag="div" name="list" class="flex-col-stretch gap-8px">
      <div
        v-for="user in userList"
        :key="user.id"
        class="flex items-center justify-between px-16px py-12px rd-8px bg-white shadow-sm transition-all-300"
      >
        <div class="flex items-center gap-12px">
          <span class="text-16px font-500">{{ user.userName }}</span>
          <ATag :color="user.status === 'active' ? 'success' : 'default'">
            {{ user.status === 'active' ? '活跃' : '停用' }}
          </ATag>
        </div>
        <div class="flex gap-8px">
          <AButton size="small" @click="toggleUserStatus(user.id)">
            切换状态
          </AButton>
          <AButton size="small" danger @click="deleteUser(user.id)">
            删除
          </AButton>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.list-move,
.list-enter-active,
.list-leave-active {
  --uno: transition-all-300;
}

.list-enter-from,
.list-leave-to {
  --uno: opacity-0 translate-x-30px;
}

.list-leave-active {
  --uno: absolute;
}
</style>
```

**关键要点**：
1. `tag="div"` 指定 TransitionGroup 渲染为 `<div>`（默认是 `<span>`）
2. `v-for` 必须绑定唯一的 `key`，这是 TransitionGroup 判断增删/移动的依据
3. `.list-move` 配合 `transition-all-300` 让列表项位置变化时也有动画
4. `.list-leave-active` 设置为 `absolute`，让被删除的元素脱离文档流，不影响其他元素的位置计算（避免列表跳动）
5. 使用 `transition-all-300` 而不是 `transition: all 0.3s`，这是 UnoCSS 的 shorthand，符合项目规范

#### 小任务 3：将自定义动画注册为全局动画

在实际项目中，如果这个列表动画会被多个页面复用，应该把它注册到 `src/styles/css/transition.css` 中：

```css
/* list — 列表项增删动画 */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.list-leave-active {
  position: absolute;
}
```

然后组件只需要 `<TransitionGroup name="list">`，不需要再写 `<style scoped>` 中的动画类。

**什么时候放全局，什么时候放局部？**
- 如果动画会被多个页面使用 → 放 `src/styles/css/transition.css`
- 如果动画只有特定页面/组件使用 → 放 `<style scoped>`

### 第三步：整合小任务，功能测试

**整合步骤**：
1. 在 `src/styles/css/transition.css` 中新增 `list` 动画定义
2. 在 `src/views/manage/user/index.vue` 或新建一个测试页面中使用 `<TransitionGroup name="list">`
3. 测试增删、排序、状态切换时的动画效果

**调试及错误排查思路**：

- **动画不生效？**
  1. 检查 `v-for` 是否绑定了 `key`，且 `key` 是**唯一且稳定**的（不能用 `index` 作为 key，因为删除中间项后 index 会变化，Vue 无法正确识别哪个元素被删除了）
  2. 检查 CSS 类名是否写对：`list-enter-from` 对应 `name="list"`，不是 `enter-from`
  3. 检查 CSS 中是否定义了 `transition` 属性（没有 `transition` 浏览器不知道要动画什么）
  4. 检查元素是否一开始就是 `display: none`。如果是，`v-if` 在变为 true 时元素从 `display: none` 变为 `display: block`，Vue 会跳过 enter 动画。需要确保元素初始状态可见。

- **列表删除时其他元素跳动？**
  检查 `.list-leave-active` 是否设置了 `position: absolute`。删除时如果不脱离文档流，被删除元素占用的空间瞬间消失，导致其他元素向上跳动。设为 `absolute` 后，元素不占空间，但 Vue 会在计算完所有位置变化后通过 FLIP 动画平滑过渡。

- **页面切换动画和列表动画冲突？**
  检查 Transition 的 `mode` 是否设置正确。页面级 Transition 用 `out-in`，列表项的 TransitionGroup 不需要 `mode`（因为列表项的 enter/leave 是独立的，不会同时有两个相同 key 的元素）。

- **动画卡顿？**
  1. 检查是否动画了 `width`/`height`/`margin`/`top`/`left` 等属性（这些会触发重排，性能差）
  2. 改用 `transform` 和 `opacity`（GPU 加速，性能最好）
  3. 减少同时动画的元素数量（如超过 50 个列表项同时动画会卡顿）

### 验收标准

- [ ] **能用**：列表项新增时有滑入动画，删除时有滑出动画，状态切换时有过渡效果
- [ ] **规范**：`pnpm typecheck` 通过，`pnpm lint` 通过；CSS 类名使用 kebab-case；动画定义在 `transition.css` 或 `<style scoped>` 中
- [ ] **精进**：列表项使用 `transform` 和 `opacity` 动画（不触发重排）；`key` 使用业务 ID 而非 `index`；删除动画使用 `position: absolute` 避免跳动；使用 `--uno: transition-all-300` 简化 CSS

---

## 今日重点记忆卡

| 概念 | 一句话 | Java类比 | 前端独有 |
|------|--------|---------|---------|
| `<Transition>` | Vue 内置的动画包装组件，给单元素的进入/离开添加 CSS 动画 | Swing `ContainerListener` + 自动 CSS 类名注入 | 自动在 6 个生命周期钩子注入 CSS 类名，不需要 JS 手动管理 |
| `name="xxx"` | 自定义 CSS 类名前缀，默认是 `v-` | 自定义 CSS 类前缀 | 纯声明式，不写一行 JS 代码就能做动画 |
| `mode="out-in"` | 旧元素先离开，新元素再进入，避免两个元素同时存在于 DOM | `CardLayout` 的卡片切换策略 | 与 Vue 的响应式系统深度集成，DOM 操作由 Vue 自动调度 |
| `<TransitionGroup>` | 包裹多个元素，给列表增删重排添加动画 | JTable 数据排序时的重绘 | 内置 FLIP 技术：通过 `transform` 做位置变化动画，零重排 |
| `move` 类名 | 列表项位置变化时的动画类 | 无直接对应（Java 重布局代价高） | FLIP 动画的核心：先计算位置差，再通过 `transform` 动画 |
| `@keyframes` | 时间线驱动的动画，定义关键帧 | JavaFX `Timeline` | CSS 动画可以被 GPU 加速，不需要 JS 线程参与 |
| `transition` vs `animation` | `transition`：状态变化触发（A→B）；`animation`：时间线驱动（0%→100%） | JavaFX `Transition` vs `Animation` | CSS 的 `transition` 和 `animation` 都可以被硬件加速，不需要 JS 参与计算 |
| `--uno: transition-all-300` | UnoCSS 的动画 shorthand，等于 `transition: all 0.3s` | 无 | 在 CSS 文件中也能用 UnoCSS 的 `--uno` 语法，编译时会被替换为真实 CSS |

---

**明日预告**：第 19 天 — 性能优化：keep-alive、Suspense、异步组件、虚拟列表

> **预告要点**：明天将学习 `keep-alive` 如何缓存页面状态（避免每次切换路由都重新加载数据）、`Suspense` 如何处理异步组件的加载状态、以及虚拟列表如何只渲染可见区域的 DOM 元素来优化大数据表格的性能。这是从"功能实现"到"性能优化"的关键过渡。

---

> 📌 **作业**：在 `src/styles/css/transition.css` 中新增一个 `list` 动画（进入从左滑入，离开向右滑出），然后在一个测试页面中使用 `<TransitionGroup>` 实现列表增删动画。截图发群，我们一起评审。
