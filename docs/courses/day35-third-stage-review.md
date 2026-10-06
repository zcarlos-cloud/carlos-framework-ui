# 今日前端课程 — 第35天：第三阶段复习 — 整合多库实现系统日志模块

> **🎉 第三阶段收官日！** 从 Vue Router → Pinia → AntDV → Axios → i18n → ECharts → UnoCSS → Icons → Upload → Drag → Storage，14天里你已深入掌握项目核心库。今天把所有技能串起来，独立完成一个完整的功能模块。
>
> **学习目标**
> - 能读：系统日志模块的完整架构设计（Axios请求日志 + ECharts统计 + 导出 + 分页）
> - 能用：独立实现一个从 API 到图表到表格的全栈前端模块
> - 规范：零 any、类型完整、国际化覆盖、错误处理完备
> - 精进：理解多库协作的数据流设计，体会"组合优于继承"在实战中的体现
    > ⏱️ 预计用时：2-2.5小时 | 🔧 技术栈：Vue3 + Vite + TS + AntDV + Pinia + ECharts + Axios + i18n + UnoCSS

---

## 第三阶段回顾与过渡

### 阶段回顾：你已掌握的14天技能

| 天数    | 主题             | 核心技能                          | 在本次实战中用到     |
|-------|----------------|-------------------------------|--------------|
| 22    | Vue Router 4   | 路由配置、导航守卫、懒加载                 | 新建路由、配置 meta |
| 23-24 | Pinia          | Store 设计、持久化、storeToRefs      | 日志状态管理       |
| 25-26 | Ant Design Vue | Table/Form/Select/Drawer      | 日志表格、筛选表单    |
| 27    | Axios 封装       | 拦截器、Token 刷新、@sa/axios        | 请求日志捕获       |
| 28    | i18n 国际化       | $t()、语言切换、flatToNested        | 日志模块中英双语     |
| 29    | ECharts        | useEcharts、暗色模式、按需加载          | 统计图表         |
| 30    | UnoCSS         | shortcuts、theme、暗色模式          | 页面布局样式       |
| 31    | 图标系统           | Iconify、unplugin-icons        | 操作按钮图标       |
| 32    | 文件上传/下载        | FormData、Blob、revokeObjectURL | Excel 导出     |
| 33    | 剪贴板与拖拽         | clipboard、vue-draggable-plus  | 日志复制         |
| 34    | 浏览器存储          | createStorage、AES、三层架构        | 日志筛选条件缓存     |

### 下一阶段预告：第四阶段 — 工程化与项目实战（第36-50天）

| 天数    | 主题                                     |
|-------|----------------------------------------|
| 36    | Vite 配置深入 — 别名、代理、环境变量                 |
| 37    | ESLint 与代码规范 — 扁平配置、规则定制               |
| 38    | Git Hooks 与自动化 — pre-commit、commit-msg |
| 39    | 路由自动生成 — @elegant-router/vue           |
| 40    | 权限控制 — 路由权限、按钮权限、菜单动态生成                |
| 41-50 | 主题/布局/大屏/表格/表单/错误处理/性能/移动端/测试          |

> **从今天起，你不再只是写代码，而是写工程。** 第四阶段你将接触到 Vite 构建、ESLint 规范、Git Hooks、权限系统、主题定制等真正的工程化能力。

---

## 理论学习

### 核心知识点

#### 1. 多库协作的数据流设计

在 carlos-framework-ui 中，一个完整的 CRUD 模块涉及以下数据流：

```
用户操作 → Vue组件 → useTable Hook → fetchXxx API → @sa/axios request → 后端
                ↑                                                    |
                └──────── 响应数据 ← transformer 转换 ←──────────────┘
                                    ↓
                         Pinia Store（可选，跨组件状态）
                                    ↓
                         ECharts / Table 渲染
```

**关键设计原则**：

- **单向数据流**：数据从 API → Hook → 组件，组件不直接修改 API 返回数据
- **关注点分离**：搜索（UserSearch）、表格（index.vue）、弹窗（UserOperateDrawer）各自独立
- **组合优于继承**：`useTable` + `useTableOperate` + `useTableScroll` 组合使用而非继承

#### 2. 表格搜索-分页-排序的标准模式

`useTable` Hook 封装了以下职责：

```typescript
// 1. API 调用 + 分页参数管理
// 2. 数据转换（transformer: 添加序号、格式化数据）
// 3. 列控制（columnChecks: 用户可自由控制显示/隐藏列）
// 4. 国际化联动（locale 变化时自动重载列标题）
// 5. 加载状态（loading / empty）
```

**关键参数**：

- `apiFn`：API 函数引用
- `apiParams`：初始查询参数（注意：未使用的字段必须设为 `undefined`，不能省略）
- `columns`：列定义工厂函数（使用函数而非直接传值，支持国际化响应式）
- `immediate`：是否立即请求（默认 `true`）

#### 3. ECharts 按需加载 + 暗色模式联动

`useEcharts` Hook 的三大亮点：

```typescript
// 1. 按需加载（只导入使用的图表类型，减小打包体积）
echarts.use([BarChart, LineChart, PieChart, ...]);

// 2. 暗色模式自动切换（watch darkMode → destroy → render）
scope.run(() => {
  watch(darkMode, () => { changeTheme(); });
});

// 3. 容器尺寸自动响应（useElementSize 监听容器宽高变化）
watch([width, height], ([newWidth, newHeight]) => {
  renderChartBySize(newWidth, newHeight);
});
```

---

### Java 思维类比

| 前端模式                             | Java 类比                                        | 说明                  |
|----------------------------------|------------------------------------------------|---------------------|
| `useTable(config)` 组合式 Hook      | Spring `@Service` + `@Autowired` 多 Bean 注入     | 多个独立 Hook 组合成一个完整功能 |
| `transformer` 数据转换               | MyBatis `ResultMap` / MapStruct                | 后端返回 → 前端展示格式转换     |
| `columnChecks` 列控制               | Java TableModel 的动态列过滤                         | 用户可控制可见列            |
| `useEcharts()` 图表封装              | Java JFreeChart 的 ChartFactory                 | 封装图表创建、更新、销毁生命周期    |
| `effectScope` + `onScopeDispose` | Java `try-with-resources` / `@PreDestroy`      | 自动管理副作用生命周期         |
| API → Hook → 组件 单向数据流            | Spring MVC `Controller → Service → Repository` | 数据单向流动，各层职责清晰       |
| `updateOptions(callback)`        | Java Builder Pattern 的动态修改                     | 函数式更新图表配置           |

---

### 超越类比 — 前端独有的设计哲学

#### 1. 组合式 Hooks 不是"Service 类"

Java Service 是有状态单例，而 Composable Hook 是**响应式闭包工厂**：

```typescript
// 同一个 Hook 可以在不同组件中产生独立的状态实例
const table1 = useTable({ apiFn: fetchGetUserList, ... });
const table2 = useTable({ apiFn: fetchGetRoleList, ... });
// table1 和 table2 拥有独立的分页、搜索、加载状态
```

这得益于 Vue 3 的 `effectScope` + `ref` 机制：每次调用 `useTable()` 都在当前组件的作用域下创建新的响应式引用。

#### 2. 数据转换的"纯函数"哲学

`transformer` 是纯函数，不修改输入数据：

```typescript
transformer: res => {
  const {records = [], current = 1, size = 10, total = 0} = res.data || {};
  const recordsWithIndex = records.map((item, index) => ({
    ...item,  // 展开运算符创建新对象，不修改原数据
    index: (current - 1) * pageSize + index + 1
  }));
  return { data: recordsWithIndex, pageNum: current, pageSize, total };
}
```

这与 Java 中不可变对象（Immutable）的理念一致，但前端通过 `...spread` 展开运算符和 `map` 函数的组合来简洁实现。

#### 3. watch + locale 的国际化响应式联动

```typescript
// 当语言切换时，列标题自动更新
scope.run(() => {
  watch(() => appStore.locale, () => { reloadColumns(); });
});
```

这是前端独有的"声明式依赖"：不需要手动注册监听器，Vue 的响应式系统自动追踪 `appStore.locale` 的变化并触发重新渲染。

---

## carlos-ui 源码阅读 + 规范评审

### 目标文件

| 文件                                                      | 作用                 | 本次实战参考                                      |
|---------------------------------------------------------|--------------------|---------------------------------------------|
| `src/views/manage/user/index.vue`                       | 用户管理页面（标准 CRUD 模板） | 表格+搜索+操作列的标准写法                              |
| `src/views/manage/user/modules/user-search.vue`         | 搜索组件               | 表单搜索的标准模式                                   |
| `src/views/manage/user/modules/user-operate-drawer.vue` | 编辑/新增抽屉            | Drawer + Form 的标准模式                         |
| `src/hooks/common/table.ts`                             | 核心表格 Hook          | useTable / useTableOperate / useTableScroll |
| `src/hooks/common/form.ts`                              | 表单验证 Hook          | useFormRules / useAntdForm                  |
| `src/hooks/common/echarts.ts`                           | ECharts 封装 Hook    | useEcharts（按需加载+暗色模式）                       |
| `src/service/api/system-manage.ts`                      | 系统管理 API           | API 函数命名和类型规范                               |
| `src/constants/business.ts`                             | 业务常量               | Record + Options 模式                         |
| `src/views/home/modules/line-chart.vue`                 | 折线图示例              | ECharts 实战参考                                |

### 阅读指引

1. **先看 `user/index.vue`**：这是最完整的 CRUD 模板，理解 `useTable` + `useTableOperate` + `useTableScroll` 三剑客的协作方式
2. **再看 `useTable` 源码**：关注 `immediate`、`transformer`、`getColumnChecks`、`getColumns` 这四个核心配置项
3. **最后看 `useEcharts` 源码**：理解 `effectScope` 如何管理 chart 的生命周期（创建→渲染→暗色模式切换→销毁）

### 规范评审清单

| 检查项   | 标准                                           | `user/index.vue` 是否达标？                                | 本次实战需注意                            |
|-------|----------------------------------------------|-------------------------------------------------------|------------------------------------|
| 命名规范  | 文件 kebab-case、组件 PascalCase、API fetchXxx     | ✅ `UserSearch`、`UserOperateDrawer`、`fetchGetUserList` | 新建 `system-log` 目录、组件名 `SystemLog` |
| 类型完整性 | 零 any、所有参数/返回值有类型                            | ✅ 使用泛型约束 `A extends AntDesign.TableApiFn`             | 日志数据接口完整声明                         |
| 目录规范  | 页面在 `views/[page]/index.vue`、子模块在 `modules/` | ✅ 标准结构                                                | 创建 `views/manage/log/`             |
| 导入顺序  | type → 第三方 → 内部模块 → 相对路径                     | ✅ 严格遵守                                                | 严格遵循                               |
| 错误处理  | 异步有 try/catch 或统一拦截                          | ⚠️ handleDelete 中仅有 `console.log`（实际项目要请求接口）          | 错误统一由 @sa/axios 拦截器处理              |
| 可测试性  | 纯函数可单测、副作用可 mock                             | ✅ transformer 是纯函数                                    | transformer 保持纯函数                  |
| 国际化   | 用户可见字符串使用 `$t()`                             | ✅ 全面使用                                                | 日志模块所有文案用 `$t()`                   |

---

## 功能实践 — 系统日志模块

### 功能需求

实现一个"系统操作日志"页面，包含以下功能：

1. **日志列表**（AntDV Table）：分页展示操作日志（操作用户、操作类型、IP地址、操作时间、操作状态）
2. **搜索筛选**（Form）：按用户名、操作类型、时间范围筛选
3. **统计图表**（ECharts）：操作类型分布饼图 + 操作量日趋势折线图
4. **日志导出**（Blob 下载）：导出当前筛选结果为 Excel
5. **日志详情**（Drawer）：点击查看日志的请求参数和返回结果

---

### 第一步：功能分析与拆解

按照 carlos-ui 的标准 CRUD 模式，将功能拆解为以下子任务：

```
任务1: 类型定义   → src/typings/api.d.ts（声明 Api.Audit.Log、LogSearchParams）
任务2: API 层     → src/service/api/audit.ts（fetchGetLogList、fetchGetLogStats、fetchExportLogs）
任务3: 常量定义   → src/constants/business.ts（操作类型 Record + Options）
任务4: 页面入口   → src/views/manage/log/index.vue（表格 + useTable）
任务5: 搜索组件   → src/views/manage/log/modules/log-search.vue（表单筛选）
任务6: 详情抽屉   → src/views/manage/log/modules/log-detail-drawer.vue（日志详情展示）
任务7: 统计图表   → src/views/manage/log/modules/log-stats.vue（饼图 + 折线图）
任务8: 导出按钮   → index.vue 中新增"导出Excel"按钮（Blob 下载）
任务9: 国际化     → locales 文件中添加日志相关 key
```

---

### 第二步：小任务开发

#### 任务1：类型定义

```typescript
// src/typings/api.d.ts — 在 declare namespace Api 中添加

declare namespace Api {
  namespace Audit {
    /** 操作日志记录 */
    interface Log {
      /** 日志ID */
      id: number;
      /** 操作用户 */
      userName: string;
      /** 操作类型: 1=查询 2=新增 3=修改 4=删除 */
      operationType: '1' | '2' | '3' | '4';
      /** 操作模块 */
      module: string;
      /** 操作描述 */
      description: string;
      /** 请求URL */
      requestUrl: string;
      /** 请求方法 */
      requestMethod: string;
      /** 请求参数（JSON字符串） */
      requestParams: string;
      /** 响应结果（JSON字符串） */
      responseResult: string;
      /** 操作IP */
      ip: string;
      /** 操作状态: 1=成功 2=失败 */
      status: '1' | '2';
      /** 操作时间 */
      operationTime: string;
      /** 耗时(ms) */
      duration: number;
    }

    /** 日志搜索参数 */
    interface LogSearchParams {
      userName?: string;
      operationType?: Log['operationType'];
      startTime?: string;
      endTime?: string;
      current: number;
      size: number;
    }

    /** 日志分页列表 */
    interface LogList {
      records: Log[];
      current: number;
      size: number;
      total: number;
    }

    /** 操作类型统计 */
    interface OperationTypeStats {
      operationType: '1' | '2' | '3' | '4';
      count: number;
    }

    /** 操作量日趋势 */
    interface DailyTrend {
      date: string;
      count: number;
    }

    /** 日志统计数据 */
    interface LogStats {
      operationTypeStats: OperationTypeStats[];
      dailyTrend: DailyTrend[];
    }
  }
}
```

**为什么这样写**：

- `interface` 而非 `type`：对象类型用 interface，可扩展
- 字符串联合类型：`'1' | '2' | '3' | '4'` 比 `number` 更精确，避免魔法数字
- JSDoc 注释：每个字段都有说明
- `declare namespace Api.Audit`：遵循项目类型组织约定

---

#### 任务2：API 层

```typescript
// src/service/api/audit.ts
import { request } from '../request';

/**
 * 获取操作日志分页列表
 *
 * @param params 搜索参数
 */
export function fetchGetLogList(params: Api.Audit.LogSearchParams) {
  return request<Api.Audit.LogList>({
    url: '/audit/log/page',
    method: 'get',
    params
  });
}

/**
 * 获取日志统计数据（操作类型分布 + 日趋势）
 */
export function fetchGetLogStats() {
  return request<Api.Audit.LogStats>({
    url: '/audit/log/stats',
    method: 'get'
  });
}

/**
 * 导出日志为 Excel
 *
 * @param params 导出筛选条件（与搜索参数一致，但不需要分页）
 */
export function fetchExportLogs(params: Omit<Api.Audit.LogSearchParams, 'current' | 'size'>) {
  return request<Blob>({
    url: '/audit/log/export',
    method: 'get',
    params,
    responseType: 'blob'
  });
}
```

**注意**：别忘记在 `src/service/api/index.ts` 中添加导出：

```typescript
export * from './audit';
```

**关键要点**：

- `fetchExportLogs` 使用 `responseType: 'blob'`，因为 Excel 是二进制数据
- `Omit<...>` 工具类型从搜索参数中排除分页字段（导出不需要分页）

---

#### 任务3：常量定义

```typescript
// src/constants/business.ts — 追加以下内容

/** 操作类型 Record */
export const operationTypeRecord: Record<Api.Audit.Log['operationType'], App.I18n.I18nKey> = {
  '1': 'page.manage.log.operationType.query',
  '2': 'page.manage.log.operationType.add',
  '3': 'page.manage.log.operationType.update',
  '4': 'page.manage.log.operationType.delete'
};

export const operationTypeOptions = transformRecordToOption(operationTypeRecord);
```

**为什么 `Record<Api.Audit.Log['operationType'], ...>`**：从已定义的类型中提取键，确保类型与后端约定一致，一处修改全局生效。

---

#### 任务4：页面入口（主表格）

```vue
<!-- src/views/manage/log/index.vue -->
<script setup lang="tsx">
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchGetLogList, fetchExportLogs } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { $t } from '@/locales';
import { operationTypeRecord } from '@/constants/business';
import LogSearch from './modules/log-search.vue';
import LogDetailDrawer from './modules/log-detail-drawer.vue';
import LogStats from './modules/log-stats.vue';

defineOptions({ name: 'SystemLog' });

const { tableWrapperRef, scrollConfig } = useTableScroll();

const {
  columns,
  columnChecks,
  data,
  getData,
  getDataByPage,
  loading,
  mobilePagination,
  searchParams,
  resetSearchParams
} = useTable({
  apiFn: fetchGetLogList,
  apiParams: {
    current: 1,
    size: 10,
    userName: undefined,
    operationType: undefined,
    startTime: undefined,
    endTime: undefined
  },
  columns: () => [
    {
      key: 'index',
      title: $t('common.index'),
      dataIndex: 'index',
      align: 'center',
      width: 64
    },
    {
      key: 'userName',
      dataIndex: 'userName',
      title: $t('page.manage.log.userName'),
      align: 'center',
      minWidth: 100
    },
    {
      key: 'operationType',
      dataIndex: 'operationType',
      title: $t('page.manage.log.operationType'),
      align: 'center',
      width: 100,
      customRender: ({ record }: { record: Api.Audit.Log }) => {
        const colorMap: Record<string, string> = {
          '1': 'blue',    // 查询
          '2': 'green',   // 新增
          '3': 'orange',  // 修改
          '4': 'red'      // 删除
        };
        return <Tag color={colorMap[record.operationType]}>{$t(operationTypeRecord[record.operationType])}</Tag>;
      }
    },
    {
      key: 'description',
      dataIndex: 'description',
      title: $t('page.manage.log.description'),
      align: 'left',
      ellipsis: true,
      minWidth: 200
    },
    {
      key: 'ip',
      dataIndex: 'ip',
      title: $t('page.manage.log.ip'),
      align: 'center',
      width: 140
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: $t('page.manage.log.status'),
      align: 'center',
      width: 80,
      customRender: ({ record }: { record: Api.Audit.Log }) => (
        <Tag color={record.status === '1' ? 'success' : 'error'}>
          {record.status === '1' ? $t('common.success') : $t('common.fail')}
        </Tag>
      )
    },
    {
      key: 'operationTime',
      dataIndex: 'operationTime',
      title: $t('page.manage.log.operationTime'),
      align: 'center',
      width: 180
    },
    {
      key: 'duration',
      dataIndex: 'duration',
      title: $t('page.manage.log.duration'),
      align: 'center',
      width: 90,
      customRender: ({ record }: { record: Api.Audit.Log }) => `${record.duration}ms`
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 80,
      customRender: ({ record }: { record: Api.Audit.Log }) => (
        <Button type="primary" ghost size="small" onClick={() => viewDetail(record)}>
          {$t('common.view')}
        </Button>
      )
    }
  ]
});

const {
  drawerVisible,
  operateType,
  editingData,
  handleAdd,
  openDrawer,
  closeDrawer
} = useTableOperate(data, getData);

/** 查看日志详情 */
function viewDetail(row: Api.Audit.Log) {
  editingData.value = row;
  operateType.value = 'view';
  openDrawer();
}

/** 导出日志 */
async function handleExport() {
  const { data } = await fetchExportLogs({
    userName: searchParams.value.userName,
    operationType: searchParams.value.operationType,
    startTime: searchParams.value.startTime,
    endTime: searchParams.value.endTime
  });

  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `操作日志_${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url); // 释放内存

  window.$message?.success($t('common.exportSuccess'));
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <LogSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />

    <!-- 统计图表区域 -->
    <LogStats />

    <ACard
      :title="$t('page.manage.log.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch sm:flex-1-hidden card-wrapper"
    >
      <template #extra>
        <div class="flex items-center gap-8px">
          <AButton size="small" @click="handleExport">
            <template #icon>
              <icon-uil-export class="align-sub text-icon" />
            </template>
            {$t('common.export')}
          </AButton>
          <TableHeaderOperation
            v-model:columns="columnChecks"
            :loading="loading"
            hide-add
            hide-delete
            @refresh="getData"
          />
        </div>
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="data"
        size="small"
        :scroll="scrollConfig"
        :loading="loading"
        row-key="id"
        :pagination="mobilePagination"
        class="h-full"
      />
    </ACard>

    <LogDetailDrawer
      v-model:visible="drawerVisible"
      :row-data="editingData"
    />
  </div>
</template>

<style scoped></style>
```

---

#### 任务5：搜索组件

```vue
<!-- src/views/manage/log/modules/log-search.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { $t } from '@/locales';
import { useAntdForm } from '@/hooks/common/form';
import { operationTypeOptions } from '@/constants/business';
import { translateOptions } from '@/utils/common';

defineOptions({ name: 'LogSearch' });

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, resetFields } = useAntdForm();

const model = defineModel<Api.Audit.LogSearchParams>('model', { required: true });

async function reset() {
  await resetFields();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}
</script>

<template>
  <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
    <AForm ref="formRef" :model="model" :label-col="{ span: 5, md: 7 }">
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.log.userName')" name="userName" class="m-0">
            <AInput v-model:value="model.userName" :placeholder="$t('page.manage.log.form.userName')" />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.log.operationType')" name="operationType" class="m-0">
            <ASelect
              v-model:value="model.operationType"
              :options="translateOptions(operationTypeOptions)"
              :placeholder="$t('page.manage.log.form.operationType')"
              clearable
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.log.startTime')" name="startTime" class="m-0">
            <ADatePicker
              v-model:value="model.startTime"
              value-format="YYYY-MM-DD HH:mm:ss"
              :placeholder="$t('page.manage.log.form.startTime')"
              show-time
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.log.endTime')" name="endTime" class="m-0">
            <ADatePicker
              v-model:value="model.endTime"
              value-format="YYYY-MM-DD HH:mm:ss"
              :placeholder="$t('page.manage.log.form.endTime')"
              show-time
            />
          </AFormItem>
        </ACol>
        <ACol flex="1">
          <AFormItem class="m-0">
            <div class="w-full flex-y-center justify-end gap-12px">
              <AButton @click="reset">
                <template #icon>
                  <icon-ic-round-refresh class="align-sub text-icon" />
                </template>
                <span class="ml-8px">{{ $t('common.reset') }}</span>
              </AButton>
              <AButton type="primary" ghost @click="search">
                <template #icon>
                  <icon-ic-round-search class="align-sub text-icon" />
                </template>
                <span class="ml-8px">{{ $t('common.search') }}</span>
              </AButton>
            </div>
          </AFormItem>
        </ACol>
      </ARow>
    </AForm>
  </ACard>
</template>

<style scoped></style>
```

---

#### 任务6：日志详情抽屉

```vue
<!-- src/views/manage/log/modules/log-detail-drawer.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { $t } from '@/locales';
import { operationTypeRecord } from '@/constants/business';

defineOptions({ name: 'LogDetailDrawer' });

interface Props {
  rowData?: Api.Audit.Log | null;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', { default: false });

const title = computed(() => $t('page.manage.log.detail'));

function formatJson(jsonStr: string): string {
  try {
    return JSON.stringify(JSON.parse(jsonStr), null, 2);
  } catch {
    return jsonStr || '-';
  }
}

function closeDrawer() {
  visible.value = false;
}
</script>

<template>
  <ADrawer :open="visible" :title="title" :width="480" @close="closeDrawer">
    <template v-if="rowData">
      <ADescriptions :column="1" bordered size="small">
        <ADescriptionsItem :label="$t('page.manage.log.userName')">
          {{ rowData.userName }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.log.operationType')">
          {{ $t(operationTypeRecord[rowData.operationType]) }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.log.module')">
          {{ rowData.module }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.log.description')">
          {{ rowData.description }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.log.requestUrl')">
          <span class="text-blue-600">{{ rowData.requestMethod }} {{ rowData.requestUrl }}</span>
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.log.ip')">
          {{ rowData.ip }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.log.operationTime')">
          {{ rowData.operationTime }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.log.duration')">
          {{ `${rowData.duration}ms` }}
        </ADescriptionsItem>
      </ADescriptions>

      <ADivider>{{ $t('page.manage.log.requestParams') }}</ADivider>
      <pre class="bg-#f5f5f5 dark:bg-#1a1a1a p-12px rd-4px text-12px overflow-auto max-h-200px">{{ formatJson(rowData.requestParams) }}</pre>

      <ADivider>{{ $t('page.manage.log.responseResult') }}</ADivider>
      <pre class="bg-#f5f5f5 dark:bg-#1a1a1a p-12px rd-4px text-12px overflow-auto max-h-200px">{{ formatJson(rowData.responseResult) }}</pre>
    </template>
    <template #footer>
      <AButton @click="closeDrawer">{{ $t('common.close') }}</AButton>
    </template>
  </ADrawer>
</template>

<style scoped></style>
```

---

#### 任务7：统计图表组件

```vue
<!-- src/views/manage/log/modules/log-stats.vue -->
<script setup lang="ts">
import { watch } from 'vue';
import { $t } from '@/locales';
import { useAppStore } from '@/store/modules/app';
import { useEcharts } from '@/hooks/common/echarts';
import { fetchGetLogStats } from '@/service/api';
import { operationTypeRecord } from '@/constants/business';

defineOptions({ name: 'LogStats' });

const appStore = useAppStore();

// 饼图：操作类型分布
const { domRef: pieDomRef, updateOptions: updatePieOptions } = useEcharts(() => ({
  tooltip: { trigger: 'item' },
  legend: { orient: 'vertical', left: 'left' },
  series: [
    {
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: 'bold' }
      },
      data: [] as { value: number; name: string }[]
    }
  ]
}));

// 折线图：操作量日趋势
const { domRef: lineDomRef, updateOptions: updateLineOptions } = useEcharts(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  xAxis: { type: 'category', data: [] as string[] },
  yAxis: { type: 'value' },
  series: [
    {
      type: 'line',
      smooth: true,
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#8e9dff' }, { offset: 1, color: '#fff' }] }
      },
      data: [] as number[]
    }
  ]
}));

async function loadStats() {
  const { error, data } = await fetchGetLogStats();
  if (error) return;

  // 更新饼图
  updatePieOptions(() => ({
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: data.operationTypeStats.map(item => ({
        value: item.count,
        name: $t(operationTypeRecord[item.operationType])
      }))
    }]
  }));

  // 更新折线图
  updateLineOptions(() => ({
    xAxis: { data: data.dailyTrend.map(item => item.date) },
    series: [{ type: 'line', smooth: true, data: data.dailyTrend.map(item => item.count) }]
  }));
}

watch(() => appStore.locale, () => loadStats());

// 初始化加载
loadStats();
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-16px">
    <ACard :title="$t('page.manage.log.stats.operationType')" :bordered="false" class="card-wrapper">
      <div ref="pieDomRef" class="h-300px"></div>
    </ACard>
    <ACard :title="$t('page.manage.log.stats.dailyTrend')" :bordered="false" class="card-wrapper">
      <div ref="lineDomRef" class="h-300px"></div>
    </ACard>
  </div>
</template>

<style scoped></style>
```

**关键技巧**：

- `useEcharts` 返回值中的 `updateOptions` 接受回调函数，可直接传新 options 覆盖初始配置
- 国际化联动：`watch(appStore.locale, loadStats)` 在切换语言时重新加载并刷新图表
- 两个 chart 实例独立管理，各自拥有独立的 `domRef`

---

### 第三步：整合与测试

#### 整合要点

1. **注册路由**（`src/router/routes/` 中添加日志路由）：

```typescript
// 在 src/router/routes/ 中新增 log 路由配置
{
  name: 'manage_log',
  path: '/manage/log',
  component: 'self',
  meta: {
    title: 'page.manage.log.title',
    i18nKey: 'route.manage.log',
    icon: 'carbon:log',
    order: 6
  }
}
```

2. **添加国际化**（`src/locales/` 中补充 key）：

需要在 `locales/zh-CN.json`（或对应语言文件）中添加：

```json
{
  "page": {
    "manage": {
      "log": {
        "title": "操作日志",
        "userName": "操作用户",
        "operationType": "操作类型",
        "module": "操作模块",
        "description": "操作描述",
        "requestUrl": "请求地址",
        "requestMethod": "请求方法",
        "requestParams": "请求参数",
        "responseResult": "响应结果",
        "ip": "IP地址",
        "operationTime": "操作时间",
        "duration": "耗时",
        "detail": "日志详情",
        "startTime": "开始时间",
        "endTime": "结束时间",
        "stats": {
          "operationType": "操作类型分布",
          "dailyTrend": "操作量日趋势"
        },
        "form": {
          "userName": "请输入用户名",
          "operationType": "请选择操作类型",
          "startTime": "请选择开始时间",
          "endTime": "请选择结束时间"
        }
      }
    }
  }
}
```

3. **注册 API 导出**（`src/service/api/index.ts` 中追加 `export * from './audit'`）

#### 调试排查思路

| 问题                | 可能原因                            | 排查方法                                          |
|-------------------|---------------------------------|-----------------------------------------------|
| 表格无数据             | API 未注册或接口地址错误                  | F12 → Network 检查请求 URL 和响应                    |
| 图表不显示             | 容器无高度、useEcharts 未挂载            | 检查 `domRef` 是否绑定到正确的元素                        |
| 搜索后表格不刷新          | `searchParams.value.xxx` 不是响应式的 | 检查 `apiParams` 中字段是否定义了 `undefined` 默认值       |
| `$t('xxx')` 显示在页面 | locale key 不存在                  | 检查 locale JSON 文件是否正确添加                       |
| 导出失败              | responseType 未设置 blob           | 检查 `fetchExportLogs` 的 `responseType: 'blob'` |
| TS 报错             | 类型未声明                           | `pnpm typecheck` 定位具体报错行                      |

---

### 验收标准

- [ ] **能用**：表格分页正常、搜索筛选生效、图表渲染、详情抽屉打开、导出下载
- [ ] **规范**：`pnpm typecheck` 通过、`pnpm lint` 通过
- [ ] **精进**：对照规范评审清单自检通过
    - [ ] 零 `any`：所有类型完整声明
    - [ ] 国际化覆盖：用户可见文案全部使用 `$t()`
    - [ ] 错误处理：`fetchGetLogStats` 采用解构 `{ error, data }` 模式
    - [ ] 内存管理：`URL.revokeObjectURL(url)` 释放 Blob URL
    - [ ] 目录正确：`views/manage/log/index.vue` + `modules/` 子组件

---

## 今日重点记忆卡

| 概念                        | 一句话                                                               | Java类比                                                       | 前端独有                                                |
|---------------------------|-------------------------------------------------------------------|--------------------------------------------------------------|-----------------------------------------------------|
| `useTable` 三剑客            | `useTable` + `useTableOperate` + `useTableScroll` 组合成一个完整 CRUD 功能 | Spring `@Service` + `@Repository` + `@Transactional` 三个注解的组合 | 每个 Hook 都是独立的响应式闭包，在不同组件中产生独立实例                     |
| `transformer`             | 纯函数，将后端分页数据转换为前端表格数据（添加序号等）                                       | MapStruct / BeanUtils.copyProperties                         | 使用 `...spread` + `map` 实现不可变数据转换                    |
| `updateOptions(callback)` | 函数式更新 ECharts 配置，接收旧 options 返回新 options                          | Builder Pattern 的链式修改                                        | 箭头函数 + 回调模式，不需要 `instance.setOption` 手动调用           |
| `effectScope`             | 管理 `watch`/`computed` 等副作用的作用域，组件销毁时自动清理                          | `try-with-resources` / `@PreDestroy`                         | Vue 3 独有的响应式作用域隔离机制                                 |
| `responseType: 'blob'`    | Axios 配置，指定响应为二进制数据，用于文件下载                                        | Java `InputStream.readAllBytes()`                            | 前端独有的 Blob + URL.createObjectURL 模式                 |
| `defineModel`             | Vue 3.4+ 简化版 `v-model`，替代 `props + emit`                          | Java `@ModelAttribute` 双向绑定                                  | `defineModel` 是编译器宏，编译时自动展开为 props + emits          |
| `customRender` (TSX)      | 在表格列定义中使用 JSX/TSX 渲染自定义内容                                         | Java TableModel 的 `getColumnClass` + `getValueAt`            | Vue 3 支持在 `<script setup lang="tsx">` 中混合使用 TSX 和模板 |

---

**明日预告**：第36天 — Vite 配置深入：别名、代理、环境变量 | 第四阶段开启！进入工程化与项目实战阶段。

---

> **第三阶段总结**：从 Vue Router 到 Pinia 到 AntDV 到 Axios 到 i18n 到 ECharts 到 UnoCSS，你已遍历了 carlos-ui 的核心技术栈。第36天起，你将进入**工程化与项目实战**阶段——学会配置 Vite、编写 ESLint 规则、设置 Git Hooks、设计权限系统、定制主题。这是从"写代码"到"写工程"的关键一步。加油！
