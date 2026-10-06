<script setup lang="tsx">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Dropdown, Popconfirm, Tag } from 'ant-design-vue';
import type { ItemType } from 'ant-design-vue';
import {
  fetchActivateWorkflowDefinition,
  fetchCopyWorkflowDefinition,
  fetchDeleteWorkflowDefinition,
  fetchExportWorkflowDefinition,
  fetchGetWorkflowDefinitionList,
  fetchPublishWorkflowDefinition,
  fetchSuspendWorkflowDefinition,
  fetchUnpublishWorkflowDefinition
} from '@/service/api';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { downloadBlob, formatDateTime } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import DefinitionBasicModal from './modules/definition-basic-modal.vue';
import DefinitionImportModal from './modules/definition-import-modal.vue';
import DefinitionOperateDrawer from './modules/definition-operate-drawer.vue';
import DefinitionSearch from './modules/definition-search.vue';

// 发布状态/设计器模型改由后端枚举字典驱动：搜索栏与两个弹窗共用本页加载的字典
ensureEnumDict('workflow');

/**
 * 列宽：定宽列合计 64+170+90+120+120+110+170+220 = 1064，flowName 列吃剩余宽度，
 * 故横向最小宽度取 1400（≈ 给 flowName 留 336）。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1400);

const router = useRouter();

/** 行操作进行中（发布 / 撤销发布 / 挂起 / 复制 / 导出 / 删除），绑定按钮 disabled 防双击重复触发 */
const operating = ref(false);

/** 已发布码值，与后端 `is_publish` 一致 */
const PUBLISHED: Api.Workflow.WorkflowPublishStatus = 1;

/** 已挂起码值，与后端 `activity_status` 一致（0 挂起 / 1 激活） */
const ACTIVITY_SUSPENDED: Api.Workflow.WorkflowActivityStatus = 0;

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
  apiFn: fetchGetWorkflowDefinitionList,
  apiParams: {
    current: 1,
    size: 10,
    // 后端：flowName / flowCode / category 为模糊匹配，isPublish 为精确匹配
    flowName: undefined,
    flowCode: undefined,
    category: undefined,
    isPublish: undefined
  },
  columns: () => [
    {
      key: 'index',
      dataIndex: 'index',
      title: $t('common.index'),
      width: 64,
      align: 'center'
    },
    {
      key: 'flowName',
      dataIndex: 'flowName',
      title: $t('page.workflow.definition.flowName'),
      align: 'center',
      // 不写 width：名称列吃掉剩余宽度；点名称打开只读详情
      ellipsis: true,
      customRender: ({ record }) => (
        <span class="cursor-pointer text-primary hover:underline" onClick={() => showDetail(record)}>
          {record.flowName}
        </span>
      )
    },
    {
      key: 'flowCode',
      dataIndex: 'flowCode',
      title: $t('page.workflow.definition.flowCode'),
      align: 'center',
      width: 170,
      ellipsis: true
    },
    {
      key: 'version',
      dataIndex: 'version',
      title: $t('page.workflow.definition.version'),
      align: 'center',
      width: 90
    },
    {
      key: 'modelValue',
      dataIndex: 'modelValue',
      title: $t('page.workflow.definition.modelType'),
      align: 'center',
      width: 120,
      ellipsis: true,
      customRender: ({ record }) => enumDictText('workflow', 'WorkflowModelType', record.modelValue)
    },
    {
      key: 'category',
      dataIndex: 'category',
      title: $t('page.workflow.definition.category'),
      align: 'center',
      width: 120,
      customRender: ({ record }) => record.category || '-'
    },
    {
      key: 'isPublish',
      dataIndex: 'isPublish',
      title: $t('page.workflow.definition.isPublish'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('workflow', 'WorkflowPublishStatus', record.isPublish)}>
          {enumDictText('workflow', 'WorkflowPublishStatus', record.isPublish)}
        </Tag>
      )
    },
    {
      key: 'createTime',
      dataIndex: 'createTime',
      title: $t('page.workflow.definition.createTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => formatDateTime(record.createTime)
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      /**
       * 平铺只留两个**主操作**（设计 + 发布/撤销发布），其余六个进「更多」下拉。
       *
       * 最宽组合：设计 + 撤销发布 + 更多 ≈ 206px（中文，字号 14px 的 small 按钮 + 8px 间距），
       * 取 220 给英文文案留余量。发布/撤销发布互斥，只算一个。
       */
      width: 220,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button
            type="primary"
            ghost
            size="small"
            disabled={operating.value}
            onClick={() => goDesign(record.definitionId)}
          >
            {$t('page.workflow.definition.design')}
          </Button>
          {record.isPublish === PUBLISHED ? (
            <Popconfirm
              title={$t('page.workflow.definition.unpublish')}
              description={$t('page.workflow.definition.unpublishConfirm')}
              onConfirm={() => handleTogglePublish(record)}
            >
              <Button size="small" disabled={operating.value}>
                {$t('page.workflow.definition.unpublish')}
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title={$t('page.workflow.definition.publish')}
              description={$t('page.workflow.definition.publishConfirm')}
              onConfirm={() => handleTogglePublish(record)}
            >
              <Button size="small" disabled={operating.value}>
                {$t('page.workflow.definition.publish')}
              </Button>
            </Popconfirm>
          )}
          <Dropdown
            trigger={['click']}
            disabled={operating.value}
            menu={{ items: moreMenuItems(record), onClick: ({ key }) => handleMoreClick(String(key), record) }}
          >
            <Button size="small" disabled={operating.value}>
              {$t('common.more')}
              <icon-ant-design-down-outlined class="ml-4px align-sub text-icon" />
            </Button>
          </Dropdown>
        </div>
      )
    }
  ]
});

/**
 * 这里刻意**不用** `useTableOperate`：它要求记录带 `CommonRecord` 的 `id` 字段
 * （`handleEdit`/`onDeleted` 都按 `id` 索引），而本 AO 的主键叫 `definitionId`，
 * 类型也过不了（`T extends TableData`）。删除仍是「成功提示 + 刷数据」两件事，
 * 与 `job/list/index.vue` 的写法一致。
 */
const detailVisible = ref(false);
const detailId = ref<string | null>(null);

function showDetail(record: Api.Workflow.WorkflowDefinition) {
  detailId.value = record.definitionId;
  detailVisible.value = true;
}

/**
 * 「基础信息」弹窗 —— 建流程的第一步
 *
 * 之前「新建流程」直接跳设计器，用户反馈缺了第一步。现在改为：先在这个弹窗填编码/名称/
 * 模型/类别并落库拿到 `definitionId`，成功后再跳设计器画节点。
 * 编辑模式复用同一个弹窗（传 id 预填）；`basicEditId` 同时充当模式开关与「提交后该怎么办」的依据。
 */
const basicVisible = ref(false);
const basicEditId = ref<string | null>(null);

function openBasicCreate() {
  basicEditId.value = null;
  basicVisible.value = true;
}

function openBasicEdit(record: Api.Workflow.WorkflowDefinition) {
  basicEditId.value = record.definitionId;
  basicVisible.value = true;
}

/**
 * 弹窗提交成功
 *
 * 新建：**直接进设计器**接第二步（此刻定义还没有流程图，发布会被引擎拒，必须先画节点）；
 * 编辑：留在列表页刷新数据即可，不打断用户。
 */
async function handleBasicSuccess(record: Api.Workflow.WorkflowDefinition) {
  if (basicEditId.value) {
    await getData();
    return;
  }

  goDesign(record.definitionId);
}

/** 设计：跳到宿主页，由宿主页拼 `id=<definitionId>` */
function goDesign(definitionId: string) {
  router.push({ name: 'workflow_design', query: { id: definitionId } });
}

/**
 * 查看流程：同一个宿主页，`mode=view` ⇒ `onlyDesignShow=true&disabled=true`
 *（只显示画布、不可编辑，见 `src/utils/warm-flow.ts`）
 */
function goView(definitionId: string) {
  router.push({ name: 'workflow_design', query: { id: definitionId, mode: 'view' } });
}

/**
 * 「更多」下拉的菜单项
 *
 * ⚠️ 行操作共 8 个，全平铺要 400px 以上且按钮互相淹没，所以只留「设计 + 发布/撤销发布」
 * 两个主操作，其余收在这里。`danger: true` 让「删除」在下拉里也是红字（antd 自带）。
 * 挂起 / 激活按 `activityStatus` 二选一：激活的才能挂起，挂起的才能激活。
 */
function moreMenuItems(record: Api.Workflow.WorkflowDefinition): ItemType[] {
  return [
    { key: 'edit', label: $t('common.modify') },
    { key: 'view', label: $t('page.workflow.definition.viewFlow') },
    {
      key: 'activity',
      label:
        record.activityStatus === ACTIVITY_SUSPENDED
          ? $t('page.workflow.definition.activate')
          : $t('page.workflow.definition.suspend')
    },
    { key: 'copy', label: $t('page.workflow.definition.copyVersion') },
    { key: 'export', label: $t('page.workflow.definition.exportFlow') },
    { key: 'delete', label: $t('common.delete'), danger: true }
  ];
}

/**
 * 下拉项分发
 *
 * 需要二次确认的三项（挂起/激活、复制、删除）走 `window.$modal.confirm` 而不是
 * `Popconfirm`：`Popconfirm` 的浮层挂在下拉菜单里，点菜单项的瞬间下拉就收了，
 * 确认框会跟着被卸载 —— 所以下拉里的破坏性操作只能用 Modal 二次确认。
 */
function handleMoreClick(key: string, record: Api.Workflow.WorkflowDefinition) {
  switch (key) {
    case 'edit':
      openBasicEdit(record);
      break;
    case 'view':
      goView(record.definitionId);
      break;
    case 'activity':
      confirmToggleActivity(record);
      break;
    case 'copy':
      confirmCopy(record.definitionId);
      break;
    case 'export':
      handleExport(record);
      break;
    case 'delete':
      confirmDelete(record.definitionId);
      break;
    default:
      break;
  }
}

function confirmDelete(definitionId: string) {
  window.$modal?.confirm({
    title: $t('common.confirmDelete'),
    content: $t('page.workflow.definition.deleteConfirm'),
    okButtonProps: { danger: true },
    onOk: () => handleDelete(definitionId)
  });
}

function confirmCopy(definitionId: string) {
  window.$modal?.confirm({
    title: $t('page.workflow.definition.copyVersion'),
    onOk: () => handleCopy(definitionId)
  });
}

/** 挂起 / 激活流程定义（挂起后不能再发起新流程，故二次确认） */
function confirmToggleActivity(record: Api.Workflow.WorkflowDefinition) {
  const suspend = record.activityStatus !== ACTIVITY_SUSPENDED;

  window.$modal?.confirm({
    title: suspend ? $t('page.workflow.definition.suspend') : $t('page.workflow.definition.activate'),
    content: suspend ? $t('page.workflow.definition.suspendConfirm') : $t('page.workflow.definition.activateConfirm'),
    onOk: () => handleToggleActivity(record, suspend)
  });
}

async function handleToggleActivity(record: Api.Workflow.WorkflowDefinition, suspend: boolean) {
  operating.value = true;
  try {
    const { error } = suspend
      ? await fetchSuspendWorkflowDefinition(record.definitionId)
      : await fetchActivateWorkflowDefinition(record.definitionId);

    if (error) {
      window.$message?.error?.(
        suspend ? $t('page.workflow.definition.suspendFailed') : $t('page.workflow.definition.activateFailed')
      );
      return;
    }

    window.$message?.success?.(
      suspend ? $t('page.workflow.definition.suspendSuccess') : $t('page.workflow.definition.activateSuccess')
    );
    await getData();
  } finally {
    operating.value = false;
  }
}

/**
 * 从 `Content-Disposition` 里取文件名
 *
 * 后端给的是 `attachment; filename="<flowCode>_<version>.json"`（纯 ASCII）。
 * 读不到响应头时（跨源部署时它不在 CORS 安全头名单里，需要后端显式 `Access-Control-Expose-Headers`）
 * 回退成同一套命名规则的 `<flowCode>_<version>.json`，保证用户的下载文件总是有正确名字。
 */
function resolveExportFileName(disposition: string | undefined, record: Api.Workflow.WorkflowDefinition) {
  const matched = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);

  if (matched?.[1]) {
    try {
      return decodeURIComponent(matched[1]);
    } catch {
      return matched[1];
    }
  }

  return `${record.flowCode}_${record.version}.json`;
}

/**
 * 导出流程定义 JSON
 *
 * 响应体**不是** `Result` 信封（后端该接口带 `@NoWrap`），所以只能走 blob，
 * 且**不能**复用 `useExport()` —— 它的错误体识别会把「text/plain 的 JSON」一律当失败，
 * 而本接口正常返回的恰恰就是它（见 `fetchExportWorkflowDefinition` 的注释）。
 *
 * 失败分两种，都已在别处处理：HTTP 非 2xx 由请求层弹出后端 `msg`；
 * 这里只在「拿到了响应但没有 blob」这种不该发生的情况下兜一句文案。
 */
async function handleExport(record: Api.Workflow.WorkflowDefinition) {
  operating.value = true;
  try {
    // 这里不能写 `data`：表格数据也叫 data（useTable 的返回值），会撞名
    const { data: blob, error, response } = await fetchExportWorkflowDefinition(record.definitionId);

    if (error) {
      // 请求层已弹过后端提示，不重复
      return;
    }

    if (!blob) {
      window.$message?.error?.($t('page.workflow.definition.exportFailed'));

      return;
    }

    downloadBlob(blob, resolveExportFileName(response?.headers?.['content-disposition'], record));
  } finally {
    operating.value = false;
  }
}

/** 导入弹窗（单个 .json，选完手动提交） */
const importVisible = ref(false);

/** 发布 / 撤销发布（已发布 ⇒ 撤销，否则发布） */
async function handleTogglePublish(record: Api.Workflow.WorkflowDefinition) {
  const published = record.isPublish === PUBLISHED;
  const ids = [record.definitionId];

  operating.value = true;
  try {
    const { error } = published
      ? await fetchUnpublishWorkflowDefinition(ids)
      : await fetchPublishWorkflowDefinition(ids);

    if (error) {
      window.$message?.error?.(
        published ? $t('page.workflow.definition.unpublishFailed') : $t('page.workflow.definition.publishFailed')
      );
      return;
    }

    window.$message?.success?.($t('common.updateSuccess'));
    await getData();
  } finally {
    operating.value = false;
  }
}

/** 复制为新的未发布版本，拿到新 id 后直接进设计器继续编辑 */
async function handleCopy(definitionId: string) {
  operating.value = true;
  try {
    const { data: newDefinitionId, error } = await fetchCopyWorkflowDefinition(definitionId);

    if (error || !newDefinitionId) {
      window.$message?.error?.($t('page.workflow.definition.copyFailed'));
      return;
    }

    window.$message?.success?.($t('page.workflow.definition.copySuccess'));
    goDesign(newDefinitionId);
  } finally {
    operating.value = false;
  }
}

async function handleDelete(definitionId: string) {
  operating.value = true;
  try {
    const { error } = await fetchDeleteWorkflowDefinition([definitionId]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    window.$message?.success?.($t('common.deleteSuccess'));
    await getData();
  } finally {
    operating.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <DefinitionSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.workflow.definition.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <!-- 「新建流程」是先弹「基础信息」再跳设计器，不是内置的抽屉表单，故关掉内置「新增」按钮 -->
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :show-add="false"
          :show-delete="false"
          :loading="loading"
          @refresh="getData"
        >
          <template #prefix>
            <AButton type="primary" ghost size="small" @click="openBasicCreate">
              <template #icon>
                <icon-ic-round-plus class="align-sub text-icon" />
              </template>
              <span class="ml-8px">{{ $t('page.workflow.definition.createFlow') }}</span>
            </AButton>
            <AButton size="small" @click="importVisible = true">
              <template #icon>
                <icon-ic-round-file-upload class="align-sub text-icon" />
              </template>
              <span class="ml-8px">{{ $t('page.workflow.definition.importFlow') }}</span>
            </AButton>
          </template>
        </TableHeaderOperation>
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="data"
        :loading="loading"
        row-key="definitionId"
        size="small"
        :pagination="mobilePagination"
        :scroll="scrollConfig"
        class="h-full"
      />
      <DefinitionOperateDrawer v-model:visible="detailVisible" :definition-id="detailId" />
      <DefinitionBasicModal v-model:visible="basicVisible" :definition-id="basicEditId" @success="handleBasicSuccess" />
      <DefinitionImportModal v-model:visible="importVisible" @imported="getData" />
    </ACard>
  </div>
</template>

<style scoped></style>
