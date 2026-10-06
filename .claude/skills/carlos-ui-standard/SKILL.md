---
name: carlos-ui-standard
description: >
  carlos-framework-ui 前端编码规范。编写 Vue 3 / TypeScript 代码时使用。
  包含列表页范式（强制）、组件规范、类型规范、状态管理、API 请求、样式、路由等完整规范。
---

# carlos-framework-ui 编码规范

## 强制规范速查

| 规范     | 要求                                          | 禁止             |
|--------|---------------------------------------------|----------------|
| 组件语法   | `<script setup>` + TypeScript               | Options API    |
| 类型     | 明确类型，禁止 `any`                               | `any`、`as any` |
| 包管理    | pnpm                                        | npm、yarn       |
| 样式     | UnoCSS 工具类 + `<style scoped>`               | 内联样式           |
| 状态     | Pinia store                                 | 组件间直接传递复杂状态    |
| 请求     | `src/service/api/` + `@sa/axios`            | 直接 axios/fetch |
| **列表页** | **见下方「列表页范式」，13 条全部强制**                     | 手写分页/搜索/工具栏    |
| 文案     | 模板中全部走 `$t()`                                | 硬编码中文（已上 ESLint 规则） |

> **列表页是本仓库最容易写歪的地方。** 原 `src/views/manage/` 下的 `user` / `role` / `menu`
> 三个标准模块**已迁到 `src/views/org/`**（见 `docs/sys_menu_org_migration.sql`），
> `manage/` 里剩下的仍是历史遗留的偏差版本。**新增任何列表页，请直接复制下方骨架，
> 不要凭印象写、也不要参考 `config` / `file` / `region` 等页面。**
> 较新的合规实现可参考 `src/views/message/**`（2026-09 新增）。

---

## 列表页范式（强制）

一个列表页 = **三个文件**：

```
src/views/{模块}/
├── index.vue                       # 列表页主文件
└── modules/
    ├── {模块}-search.vue           # 搜索栏（独立组件，不是内联 div）
    └── {模块}-operate-drawer.vue   # 新增/编辑抽屉
```

### 13 条硬性约定

1. 外层容器固定 `class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto"`
2. 搜索栏是 **`ACard` 的兄弟节点，置于其前** —— 不是塞进 `ACard` 正文里
3. `ACard` 固定 `:bordered="false"` + `:body-style="{ flex: 1, overflow: 'hidden' }"` + `class="flex-col-stretch card-wrapper sm:flex-1-hidden"`
4. 工具栏用 `TableHeaderOperation` 放 `#extra`；导出/导入/模板/缓存等附加按钮走它的 `#prefix` / `#suffix` 插槽，**不许手拼按钮**
5. 表格固定 `size="small"` + `row-key="id"` + `:pagination="mobilePagination"`（**不是 `pagination`**）+ `:scroll="scrollConfig"` + `class="h-full"`
6. 首列固定为 `index` 序号列（`width: 64`）
7. 操作列宽度按「最宽按钮组合不换行」定，2 个按钮用 `130`；容器 `class="flex-center gap-8px"`（**不带 `justify-end`**）
8. 编辑按钮 `<Button type="primary" ghost size="small">`；删除按钮 `<Button danger size="small">`（**不带 `ghost`**，且必须包在 `<Popconfirm>` 里）
9. 状态列用 `<Tag>` + `tagMap: Record<Api 的联合类型, string>` + `$t(xxxStatusRecord[...])`；**渲染前必须做 `=== null || === undefined` 守卫**（backend 字段缺失时 `$t(undefined)` 会抛异常并让整个表格卡死）
10. 删除：`deleting` ref + `try/finally` + 失败 `$t('common.deleteFailed')`；**成功后只调 `onDeleted()` / `onBatchDeleted()`，页面不得再弹成功提示**（hook 内部已弹）
11. `deleting` 必须**真正被读取**（接到 `TableHeaderOperation` 的 `:disabled-delete` 上做防重），否则就是死状态
12. 新增/编辑一律用 `ADrawer`；`AModal` 只用于非表单的确认/选择
13. 抽屉回填**显式挑字段**，禁用 `Object.assign(model, rowData)` 全量展开（否则会把 `id` / `createBy` 等公共字段回传后端）

---

### 列宽：`minWidth` 是**死属性**，不要再用

`ant-design-vue@4.2.6` 从不把 `minWidth` 变成宽度：`es/vc-table/Table.js` 构造 `ColGroup` 的
`colWidths` 时**只取 `column.width`**，`ColGroup.js` 也只写 `style.width`
（`<col>` 上 `min-width` 本来就不是合法 CSS）。再叠加 `useTableScroll()` 恒返回 `scroll.y`
→ 表头 `fixHeader` → `mergedTableLayout = 'fixed'`，于是：

> **没写 `width` 的列会均分剩余宽度**；写了 `minWidth: 220` 的列**并不会**「至少 220px」。

危险之处在于它看起来像是考虑过列宽，评审也容易放过 —— 全仓曾有 63 处。写法：

- 定宽列（序号 / 状态 / 操作 / 时间）→ 用 `width`
- 要吃剩余宽度的列（名称、长文本）→ **不写宽度**，并显式加 `ellipsis: true`
  （固定布局下长文本要么截断要么换行撑高行高，加 `ellipsis` 才是截断）
- `scrollX` 给足：`useTableScroll(n)` 的 `n` 至少是「定宽列之和 + 弹性列的合理下限」，
  默认 `702` 是按简单表格估的，列一多就挤。偏离默认值时写一行注释说明理由 ——
  见 `src/views/message/channel/index.vue` 的 `useTableScroll(1400)`。

---

### 树形列表（对上述约定的三条例外）

当数据本身有层级（如菜单）且需要让人看清父子关系时，用 `ATable` 的 `children` 嵌套渲染。
参考实现：`src/views/manage/menu/index.vue` + 通用工具 `src/utils/tree.ts`。

**例外 A —— 可以不用 `mobilePagination`（对应第 5 条）**

树形与分页语义冲突：分页只对根节点有意义，同一父级的子树可能被切到两页。
允许 `:pagination="false"`，但必须同时满足：

- 数据**一次取全**（有界数据；菜单表几十条量级）
- 文件里写注释说明为什么关了分页
- 仍保留 `useTableScroll`，并**显式传入合适的 `scrollX`**（默认 702 是按简单表格估的，树形首列还要容纳缩进）

**例外 B —— 首列不设 `index`，改由名称列承载缩进（对应第 6 条）**

antd 把展开箭头渲染在**首个数据列**内，缩进为 `indentSize × 层级`（默认 15px）。
64px 的序号列装不下箭头 + 多级缩进，故：名称列提到首列、显式设 `:indent-size`。

**例外 C —— 搜索可以在客户端做，但必须保留祖先链（对应第 2 条的搜索部分）**

后端的关键词过滤只返回**命中行**，父级不在结果里，而树形必须保留祖先链才能表达层级
—— 也就是说无论如何都需要全量数据。既如此可以只留一条代码路径：
一次拉全 + 客户端过滤（`searchParams` 改为页面本地 `ref`，不再进 `apiParams`）。
过滤时必须用祖先补全（见 `src/utils/tree.ts` 的 `collectWithAncestors`），否则命中项会变成孤儿根节点。

**例外 D —— 数据安全：关联字段必须用能带回它的接口**

**若编辑抽屉会提交某个「仅专用接口才返回」的关联字段（如菜单的 `buttons`），
列表数据源必须使用能带回该字段的接口，不得为了拿树形而换接口。**

菜单页就是反例教材：`/sys/menu/pageWithButtons` 带 `buttons`，而 `/sys/menu/tree/list`
的 `buttons` 恒为 null（它从不查 `sys_operation`）；抽屉又**无条件提交** `buttons`，
后端 `updateMenu` 是「先删光再按传入值重建」—— 一旦换了数据源，点一次「编辑→确认」
就会静默清空该菜单的全部按钮权限。

**树形列表还必须处理的两件事**（不在 13 条之内，但同样是硬要求）：

- **兄弟节点排序**：按业务排序字段（如 `orderNum`）升序，后端分页接口的默认排序
  通常不是树形该有的顺序
- **批量删除必须阻断级联**：antd 默认勾父节点会带上全部子节点，而后端往往禁止删除
  有子节点的行 —— 若子节点排在前就会出现「子节点已删、父节点报错」的部分删除。
  处理：`checkStrictly: true` + 对有子节点的行 `getCheckboxProps` 返回 `disabled: true`

### 骨架 1 — `index.vue`

```vue
<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { xxxStatusRecord } from '@/constants/business';
import { fetchDeleteXxx, fetchGetXxxList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { $t } from '@/locales';
import XxxOperateDrawer from './modules/xxx-operate-drawer.vue';
import XxxSearch from './modules/xxx-search.vue';

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
  apiFn: fetchGetXxxList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    xxxName: undefined
  },
  columns: () => [
    {
      key: 'index',
      dataIndex: 'index',
      title: $t('common.index'),
      align: 'center',
      width: 64
    },
    {
      key: 'xxxName',
      dataIndex: 'xxxName',
      title: $t('page.manage.xxx.xxxName'),
      align: 'center',
      // 不写 width：名称列吃掉剩余宽度。**不要写 minWidth** —— 见上方「列宽」一节
      ellipsis: true
    },
    {
      key: 'xxxStatus',
      dataIndex: 'xxxStatus',
      title: $t('page.manage.xxx.xxxStatus'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => {
        const { xxxStatus } = record;

        // 必须守卫：字段缺失时 $t(undefined) 会抛异常，导致表格永远不结束 loading
        if (xxxStatus === null || xxxStatus === undefined) {
          return null;
        }

        const tagMap: Record<Api.SystemManage.XxxStatus, string> = {
          '0': 'error',
          '1': 'success'
        };

        return <Tag color={tagMap[xxxStatus]}>{$t(xxxStatusRecord[xxxStatus])}</Tag>;
      }
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 130,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => handleEdit(record.id)}>
            {$t('common.edit')}
          </Button>
          <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
            <Button danger size="small">
              {$t('common.delete')}
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ]
});

const {
  drawerVisible,
  operateType,
  editingData,
  handleAdd,
  handleEdit,
  checkedRowKeys,
  rowSelection,
  onBatchDeleted,
  onDeleted
} = useTableOperate(data, getData);

const deleting = ref(false);

async function handleBatchDelete() {
  const ids = checkedRowKeys.value;

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteXxx(ids);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    // success toast 由 onBatchDeleted 内部统一发出，此处不得重复
    await onBatchDeleted();
  } finally {
    deleting.value = false;
  }
}

async function handleDelete(id: string) {
  deleting.value = true;
  try {
    const { error } = await fetchDeleteXxx([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <XxxSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.xxx.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0 || deleting"
          :loading="loading"
          @add="handleAdd"
          @delete="handleBatchDelete"
          @refresh="getData"
        />
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="data"
        size="small"
        :row-selection="rowSelection"
        :scroll="scrollConfig"
        :loading="loading"
        row-key="id"
        :pagination="mobilePagination"
        class="h-full"
      />
      <XxxOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
```

### 骨架 2 — `modules/xxx-search.vue`

```vue
<script setup lang="ts">
import { xxxStatusOptions } from '@/constants/business';
import { translateOptions } from '@/utils/common';
import { $t } from '@/locales';

defineOptions({
  name: 'XxxSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.SystemManage.XxxSearchParams>('model', { required: true });

function reset() {
  emit('reset');
}

function search() {
  emit('search');
}
</script>

<template>
  <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
    <AForm :model="model" :label-width="80">
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.xxx.xxxName')" name="xxxName" class="m-0">
            <AInput v-model:value="model.xxxName" :placeholder="$t('page.manage.xxx.form.xxxName')" />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.xxx.xxxStatus')" name="xxxStatus" class="m-0">
            <ASelect
              v-model:value="model.xxxStatus"
              :placeholder="$t('page.manage.xxx.form.xxxStatus')"
              :options="translateOptions(xxxStatusOptions)"
              allow-clear
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

> **按钮列必须用 `<ACol flex="1">`，不许写 `<ACol :span="24" :md="12" :lg="6">`。**
>
> `ARow` 是固定 24 栅格 + `flex-wrap`。死宽 25% 的按钮列只会「顺着」排在最后一个筛选列后面，
> 位置取决于前面几个筛选列凑了多少格 —— 只有凑成 `18 + 6 = 24` 时才恰好贴右。
> 换成 4 个筛选列（`4×6 = 24` 占满整行）时按钮会掉到下一行**最左边**；5 个筛选列时悬在 1/4 处；
> 带 `lg="4"` / `lg="8"` 的组合又会落到中间。
>
> `flex="1"` 让按钮列吃掉本行剩余宽度，`justify-end` 才能稳定把按钮顶到**右下角**。
> 它同时保留栅格 gutter 的 padding（`grid/Col.js` 通过 `useInjectRow` 注入，与 `span` 无关），
> 所以按钮右边缘和筛选框右边缘精确对齐 —— 这是裸 `<div class="flex-1">` 做不到的
> （裸 div 没有 gutter padding，会比筛选框多探出半个 gutter，即 8px）。

### 骨架 3 — `modules/xxx-operate-drawer.vue`

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { xxxStatusOptions } from '@/constants/business';
import { fetchAddXxx, fetchUpdateXxx } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'XxxOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.SystemManage.Xxx | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { formRef, validate, resetFields } = useAntdForm();
const { defaultRequiredRule } = useFormRules();

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.xxx.addXxx'),
    edit: $t('page.manage.xxx.editXxx')
  };
  return titles[props.operateType];
});

type Model = Pick<Api.SystemManage.Xxx, 'xxxName' | 'xxxStatus'>;

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    xxxName: '',
    xxxStatus: '1'
  };
}

type RuleKey = Extract<keyof Model, 'xxxName'>;

const rules: Record<RuleKey, App.Global.FormRule> = {
  xxxName: defaultRequiredRule
};

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { xxxName, xxxStatus } = props.rowData;

    // 显式挑选字段，避免把 id / createBy 等公共字段一并回传
    model.value = {
      xxxName: xxxName ?? '',
      xxxStatus: xxxStatus ?? '1'
    };
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const { error } = isEdit.value
      ? await fetchUpdateXxx({ id: props.rowData?.id ?? '', ...model.value })
      : await fetchAddXxx(model.value);

    if (error) {
      window.$message?.error?.(isEdit.value ? $t('common.updateFailed') : $t('common.addFailed'));
      return;
    }

    window.$message?.success?.(isEdit.value ? $t('common.updateSuccess') : $t('common.addSuccess'));
    closeDrawer();
    emit('submitted');
  } finally {
    submitLoading.value = false;
  }
}

watch(visible, () => {
  if (visible.value) {
    handleInitModel();
    resetFields();
  }
});
</script>

<template>
  <ADrawer v-model:open="visible" :title="title" :width="360">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.manage.xxx.xxxName')" name="xxxName">
        <AInput v-model:value="model.xxxName" :placeholder="$t('page.manage.xxx.form.xxxName')" />
      </AFormItem>
      <AFormItem :label="$t('page.manage.xxx.xxxStatus')" name="xxxStatus">
        <ARadioGroup v-model:value="model.xxxStatus">
          <ARadio v-for="item in xxxStatusOptions" :key="item.value" :value="item.value">
            {{ $t(item.label) }}
          </ARadio>
        </ARadioGroup>
      </AFormItem>
    </AForm>
    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" @click="handleSubmit">
          {{ $t('common.confirm') }}
        </AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
```

> 抽屉宽度默认 `360`；字段较多可用 `480`，含表格/多步可用 `560` —— 偏离默认值时请在
> 组件里写一行注释说明理由。

---

## 共享基建（写新页面前先看这里，别重复造）

下面这些能力是 2026-09 统一补的；早期页面各写各的版本正在逐模块收敛。

### 导出：`useExport()`

`src/hooks/business/use-export.ts` —— 统一加载态、文件名时间戳、`downloadBlob`，
并处理一个**既有四处导出全都踩了的坑**：

> 后端用 `Result.error(...)` 表达业务错误时 **HTTP 状态码仍是 200**，只把 `code` 换成非成功码；
> 而 `responseType: 'blob'` 会让 axios 拦截器**跳过成功码校验**
> （`packages/axios/src/index.ts`：非 json 响应一律 resolve）。
> 结果 `data` 是一个「内容是 JSON 的 Blob」—— 用户会静默下载到一个后缀 `.xlsx`、
> 打开却是 `{"code":…,"msg":…}` 的坏文件，没有任何提示。

`useExport` 会识别它并弹出后端的 `msg`。**HTTP 层的失败不要重复弹提示** ——
请求层 `onError` 已经弹过了。

```ts
const { exporting, exportFile } = useExport();

// 导出当前筛选结果。剥掉 current/size 是 service 层的职责
// （见 src/service/api/audit-log.ts:53 的写法），hook 只管执行
function handleExport() {
  return exportFile(() => fetchExportXxx(searchParams), 'sys_xxx');
}
```

按钮放 `TableHeaderOperation` 的 `#suffix` 插槽，`:loading="exporting"`。

### 导入：`ImportDrawer`

`src/components/advanced/import-drawer.vue` —— 模板下载 + 选择文件 + 扩展名校验 + 加载态。

```vue
<ImportDrawer
  v-model:visible="importVisible"
  :title="$t('page.manage.xxx.importXxx')"
  :template-fn="fetchExportXxxTemplate"
  :import-fn="fetchImportXxx"
  template-name="xxx_template"
  @imported="getDataByPage"
/>
```

后端导入接口的既有约定（见 `SysConfigController`、`OrgUserController`）：
`GET …/export/template` 下载模板、`POST …/import` 为 multipart 且**字段名固定 `file`**。
`org/user` 还提供了更完整的两阶段 `import-preview`（逐行 errors）→ `import-confirm`。

### 枚举展示：`enumText()`

`src/utils/common.ts`。**不要**写 `value ? $t(record[value]) : ''` —— 那只挡住「字段缺失」，
挡不住「后端新增了枚举值而前端还没跟上」，后者会 `$t(undefined)` 抛异常并让表格卡在 loading
（就是规则 9 讲的故障模式）。`enumText` 查不到字典就回退显示原码值：

```ts
import { enumText } from '@/utils/common';

customRender: ({ record }) => <Tag>{enumText(xxxStatusRecord, record.status)}</Tag>
```

### 校验规则：`useFormRules()`

`src/hooks/common/form.ts` 除 `defaultRequiredRule` / `patternRules` 外，还有
`createMaxLengthRule(n)`（**对齐数据库列宽** —— 后端 `*CreateParam` 已统一补 `@Size`，
前端 maxlength 与后端 @Size 必须同值，不一致时以数据库列宽为准）、`createNumberRangeRule(min, max)`，
以及 `patternRules.bizCode` / `patternRules.url` / `patternRules.lang`。

**字数限制双重防护（强制）**：编辑表单里每个文本输入都是「模板 `:maxlength="X"`（输入期硬截断）
+ rules 对应键 `createMaxLengthRule(X)`（校验期提示）」成对出现，值必须一致；
文件头用 `const XXX_MAX = n` 常量统一定义。格式校验（手机号/邮箱/编码/URL）同样
「`:maxlength` + `patternRules.*`」成对。列表页**搜索表单有意不加 rules**，不要"顺手"补上。

⚠️ `patternRules.code` 是**登录用的 6 位短信验证码**（`REG_CODE_SIX`）。
业务编码（模块/配置/字典编码）用 `patternRules.bizCode`，两者不要混。

### 业务键在编辑态必须只读

`configCode` / `dictCode` / `moduleCode` / `regionCode` / `roleCode` / `positionCode` /
`deptCode` / `account` / `typeCode` / `channelCode` / `templateCode` / `logType` 这类
**业务主键**（后端多数带唯一索引，且常被「按码查询」引用），编辑态一律：

```vue
<AInput v-model:value="model.configCode" :disabled="isEdit" />
```

改名会静默打断所有按码引用它的地方（例如 `fetchGetConfigByCode`）。

### 业务编号：`<SequenceInput>`

`src/components/custom/sequence-input.vue` —— 输入框 + 「生成」按钮，调后端序列号生成器
（`POST /sys/sequence/next`）取一个业务编码并回填。**规则须先在「系统管理 → 编码规则」建好**，
否则后端返回「编码规则不存在」。

```vue
<!-- 新增态：打开即自动生成一次；编辑态只读、按钮自动隐藏 -->
<SequenceInput
  v-model:value="model.orderNo"
  rule-code="order_no"
  :disabled="isEdit"
  :maxlength="ORDER_NO_MAX"
  :placeholder="$t('page.xxx.form.orderNo')"
/>
```

| prop | 默认 | 说明 |
|---|---|---|
| `v-model:value` | `''` | 编码本身 |
| `rule-code` | 必填 | 对应 `sys_sequence_rule.rule_code` |
| `disabled` | `false` | 只读；为 true 时按钮一并隐藏 |
| `auto` | `true` | 挂载时若字段为空则自动生成一次 |
| `placeholder` / `maxlength` | `''` / 不限 | 透传给 `AInput` |

**三条必须知道的语义**：

1. **点一次就消耗一个号段**，不可撤销 —— 关掉抽屉、连点两次都会跳号。序列号系统本就允许跳号
   （重启丢段、批量预取同理），这是换取「保存前就能看到、能复制单号」的代价，不是缺陷。
2. **`auto` 是「进场生成」，不是「自动补空」**：用户手动清空输入框**不会**重新生成，
   否则他想自己改写编码时会被一直顶掉。因此它只在 `onMounted` 判定一次。
3. ⚠️ 第 2 条的连带后果：`ADrawer` 默认懒挂载且关闭不销毁，**第二次打开抽屉时不会重新生成**。
   两个解法二选一 —— 给抽屉加 `:destroy-on-close="true"`（推荐，每次打开重新挂载），
   或者拿 `ref` 调组件暴露的 `generate()`。注意第二种在抽屉未打开/已关闭时 `ref.value`
   是 `null`（配合 `destroy-on-close` 时组件根本没挂载），直接调会 `TypeError`，
   要在打开分支里等一帧：

   ```ts
   watch(visible, async val => {
     if (val) {
       await nextTick();
       sequenceInputRef.value?.generate();
     }
   });
   ```

4. **生成期间输入框会一并禁用**（`disabled || generating`）：慢网下用户点完「生成」接着手敲，
   响应回来会把他刚敲的内容静默顶掉。另有两条异步保护 —— 组件卸载后不再回填
   （`defineModel` 的 setter 在卸载后仍会 emit `update:value`，会把编码写进已关闭抽屉的父表单），
   以及后端返回成功但 data 为空时**不清空**输入框（静默清空比报错更难查）。

**别把语义化的业务键套上去。** `configCode` / `dictCode` / `roleCode` 这类**要被人按码查询**的字段
（例如业务代码用 `dictCode` 去取字典）不能改成流水号 —— 那等于把有语义的键变成无意义数字，
会静默打断所有引用方。序列号只给**没有语义、只需唯一**的单号，判别标准一句话：
这个字符串会被印在单据上、口头上报、或按顺序核对吗？

### ⚠️ `RuleKey = Extract<...>` 会把校验变成死代码

反面教材 `src/views/org/user/modules/user-search.vue`：

```ts
// 但 UserSearchParams 里只有 phone / email，根本没有 userEmail / userPhone
type RuleKey = Extract<keyof Api.Organization.UserSearchParams, 'userEmail' | 'userPhone'>;
const rules = computed<Record<RuleKey, App.Global.FormRule>>(() => ({
  userEmail: patternRules.email,
  userPhone: patternRules.phone
}));
```

`Extract` 的结果是 **`never`** → `rules` 实际是空对象；模板里两个 `AFormItem` 的 `name`
是 `phone` / `email`，一条规则都匹配不上，`await validate()` 全程空转。
**`pnpm typecheck` 与 ESLint 都不报错**，界面看起来还有校验。

写规则后请反查一遍：`rules` 的每个键都要能在模板的 `name` 里找到，反之亦然。

### ⚠️ 敏感字段绝不回填、留空即不提交

后端对密钥类字段（`secretKey`、`accessKey`、各类 token）通常**只下发脱敏值**，
拿到的不是真值。把它当普通字段回填、再随表单整体提交，就是把掩码当真值写回库 ——
**一次「打开编辑 → 点确认」就毁掉密钥，而且没有任何报错**。

反面教材 `src/views/manage/storage-config/modules/storage-config-operate-drawer.vue`
（B5 修复前）：`secretKey: secretKey ?? ''` 回填 + `{ ...model.value }` 整体提交
→ 后端 `encryptSensitiveFields` 把 `SECR****0001` 当成新密钥加密入库。
**已实测复现**（库里真密钥确实被改成掩码）。

正确做法三条：

1. **不回填** —— 读接口拿到的值一律丢弃，字段留空，并用 `placeholder` / `extra`
   说明「留空表示不修改」（文案复用 `page.manage.common.leaveBlankToKeep`）。
2. **空值从 payload 里删掉，不要提交空串** —— 后端 `updateById` 会跳过 `null`，
   但**会写入 `''`**，「不传」才是「保持原值」的唯一正确表达：

   ```ts
   const params: Partial<Api.Xxx> = { ...model.value };
   if (!params.secretKey) delete params.secretKey;
   ```

3. **要展示真值就走详情接口** —— 列表接口多半不解密（同一字段在列表里是密文、
   在 `/detail` 里才是明文）。要回填就取 `/detail`；拿不准时按第 1 条办。

同样的坑适用于一切「后端会脱敏 / 会加密」的字段，不限于密钥。
另外注意：**新增时必填、编辑时非必填**，规则要写成 `computed` 随 `isEdit` 切换。

---

## 文案与 i18n

**模板中禁止出现硬编码中文**，已由 ESLint 规则 `local/no-hardcoded-cjk` 强制（`src/views/**`）。

新增文案的完整链路：

1. `src/locales/langs/zh-cn.ts` —— 中文值（**编写源**）
2. `src/locales/langs/en-us.ts` —— 英文值
3. `src/typings/app.d.ts` 的 `App.I18n.Schema` —— 类型声明（**三处必须同步，否则 `pnpm typecheck` 报错**）

**没有第 4 步。** 早期文档在这里写的是「运行 `node scripts/gen-i18n-migration-sql.cjs` 把文案
投递到后端 `sys_i18n_message` 表」，但那个脚本不在本仓库，而且它描述的是**已经废弃的架构**：

> 后端表已从「前端语言文件的全量镜像」改为「**只存运营改过的覆盖值**」
> （v1.2，见 `carlos-system/docs/02-design/database/sys_i18n_override_migration.sql`）。
> 同步管道被刻意去掉了 —— 前端语言文件是完整的 key 目录 + 基线值，后端只存差异，
> 运行时 `mergeLocaleMessage` 按「覆盖值 ?? 基线值」合并。**没改过就没有行**，
> 于是「同步」这件事本身消失了（旧模型曾出现 253 个 key 滞后数月）。

所以：前端补完上面三处即可，不需要任何投递动作。运营要改文案时在
「系统管理 → 国际化管理」页面在线覆盖，无需前端发版。

**为什么前端本地文件不能少 key**：`$t()` 的签名是 `(key: I18nKey)`，而
`I18nKey = GetI18nKey<Schema>`。后端可以覆盖**值**，但**键**必须在本地 Schema 里，
否则编译不过。

后端 i18n 的机制与边界见 `carlos-system/docs/02-design/i18n-design.md`。

## 组件规范

### 组件名必须显式声明

```vue
<script setup lang="ts">
defineOptions({
  name: 'XxxOperateDrawer'
});
</script>
```

### 命名规范

| 类型    | 规范          | 示例                          |
|-------|-------------|-----------------------------|
| 组件文件  | kebab-case  | `user-operate-drawer.vue`   |
| 组件名   | PascalCase  | `UserOperateDrawer`         |
| 变量/函数 | camelCase   | `userList`, `loadData`      |
| 常量    | UPPER_SNAKE | `MAX_PAGE_SIZE`             |
| 类型/接口 | PascalCase  | `UserVO`, `UserCreateParams` |

## TypeScript 规范

```typescript
// ❌ 禁止
const data: any = response;
const user = data as any;

// ✅ 正确
interface UserVO {
  id: string;
  userName: string;
}
const data: UserVO = response;
```

## Pinia Store 规范

```typescript
// src/store/modules/xxx.ts
export const useXxxStore = defineStore('xxx', () => {
  const info = ref<Info | null>(null);

  async function fetchInfo() {
    const { data } = await getInfo();
    info.value = data;
  }

  function reset() {
    info.value = null;
  }

  return { info, fetchInfo, reset };
});
```

## API 请求规范

```typescript
// src/service/api/xxx.ts
import { request } from '../request';

export function fetchGetXxxList(params?: Api.SystemManage.XxxSearchParams) {
  return request<Api.SystemManage.XxxList>({
    url: '/xxx/page',
    method: 'get',
    params
  });
}
```

## UnoCSS 样式规范

```vue
<!-- ✅ 优先使用工具类 -->
<div class="flex items-center gap-4 p-4 bg-white rounded-lg shadow">

<!-- ✅ 动态样式可用内联 -->
<div :style="{ width: `${progress}%` }">

<!-- ❌ 避免静态内联样式 -->
<div style="display: flex; padding: 16px;">
```

## 路由规范

- 页面文件路径决定路由：`src/views/system/user/index.vue` → `/system/user`
- 动态路由：`src/views/system/user/[id].vue` → `/system/user/:id`
- 新增/修改页面后必须运行 `pnpm gen-route`
- **菜单的三层 `component` 规则（硬性）**：顶层 `layout.base` → **中间层一律 `NULL`** → 叶子 `view.{route_name}`。
  中间层写 `layout.*` 会再嵌一层布局，写 `view.*` 会让子路由不渲染。

> **需要菜单层面的样例（多级菜单、`roles` 可见性、`hideInMenu` + `activeMenu`、`multiTab`、异常页复用）
> 时，直接抄 `docs/样例页面索引.md`。** 系统功能 / 异常页 / 多级菜单三组框架样例的完整配置、
> 复刻清单、`meta` 字段表都在那里。**这三组是框架资产，精简菜单时不要删。**

## 代码检查清单

- [ ] 列表页是否直接复制了上方三件套骨架，而不是凭印象写？
- [ ] 搜索栏是否是独立组件且位于 `ACard` **之前**？
- [ ] 工具栏是否用了 `TableHeaderOperation`，附加按钮走插槽？
- [ ] 分页是否用 `mobilePagination`（不是 `pagination`）？（**树形列表例外见上方**）
- [ ] 若是树形列表：搜索是否保留了祖先链？兄弟节点是否按业务排序字段排？
- [ ] 若是树形列表：批量删除是否已阻断级联（`checkStrictly` + 父节点勾选框禁用）？
- [ ] 若编辑抽屉会提交仅专用接口才返回的关联字段，数据源是否用了能带回它的接口？
- [ ] 操作列删除按钮是否**没有** `ghost`、且包在 `Popconfirm` 里？
- [ ] 删除成功后是否**没有**在页面里重复弹成功提示？
- [ ] `deleting` 是否被真正读取（接到了 `:disabled-delete`）？
- [ ] 列是否**没有**用 `minWidth`（死属性）？长文本列是否加了 `ellipsis: true`？`scrollX` 是否够？
- [ ] 业务键（各种 code）在编辑态是否 `:disabled="isEdit"`？
- [ ] 枚举渲染是否用了 `enumText()`（而不是 `value ? $t(...) : ''` 这种真值守卫）？
- [ ] 表单 `rules` 的键与模板 `name` 是否逐字对得上？（`Extract<...>` 会静默变成 `never`，校验变死代码）
- [ ] 编辑表单每个文本输入是否都有「`:maxlength` + `createMaxLengthRule` / `patternRules`」成对限制（搜索表单除外）？
- [ ] 有导出/导入时，是否用了 `useExport()` / `ImportDrawer`，而不是各写一遍？
- [ ] 抽屉是否 `ADrawer` + `submitLoading` + `error` 分支 + 显式挑字段回填？
- [ ] 无 `any` 类型
- [ ] 模板中无硬编码中文（`npx eslint src/views --no-fix` 应无 `local/no-hardcoded-cjk` 命中）
- [ ] 新文案是否同步了 `zh-cn.ts` + `en-us.ts` + `app.d.ts` 三处？（**没有生成器/投递步骤**，见「文案与 i18n」）
- [ ] 使用 `<script setup>`
- [ ] API 通过 service 层调用
- [ ] 无 `console.log`
- [ ] 新页面已运行 `pnpm gen-route`
