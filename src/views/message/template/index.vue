<script setup lang="tsx">
import { onMounted, ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import {
  fetchChangeMessageTemplateEnabled,
  fetchDeleteMessageTemplate,
  fetchGetMessageTemplateList,
  fetchGetMessageTypeList,
  fetchPublishMessageTemplate
} from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import TemplateOperateDrawer from './modules/template-operate-drawer.vue';
import TemplateSearch from './modules/template-search.vue';

const TABLE_SCROLL_X = 1200;

const { tableWrapperRef, scrollConfig } = useTableScroll(TABLE_SCROLL_X);

/** 类型 id → 类型名称（列表列展示用，须定义在 useTable 之前） */
const typeNameById = ref<Map<string, string>>(new Map());

/** 搜索栏的类型下拉项（`typeId → typeName`），与列表列的名称映射同源，故在此一次拉取 */
const typeOptions = ref<CommonType.Option<string, string>[]>([]);

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
  apiFn: fetchGetMessageTemplateList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    typeId: undefined,
    templateCode: undefined,
    templateName: undefined,
    enabled: undefined,
    start: undefined,
    end: undefined
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
      key: 'templateCode',
      dataIndex: 'templateCode',
      title: $t('page.message.common.templateCode'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'templateName',
      dataIndex: 'templateName',
      title: $t('page.message.template.templateName'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'typeId',
      dataIndex: 'typeId',
      title: $t('page.message.template.typeId'),
      align: 'center',
      width: 140,
      // 后端只下发 typeId，类型名称需查类型列表补齐
      customRender: ({ record }) => typeNameById.value.get(String(record.typeId)) ?? record.typeId
    },
    {
      key: 'enabled',
      dataIndex: 'enabled',
      title: $t('page.message.template.enabled'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => {
        const { enabled } = record;

        // 必须守卫：字段缺失时 $t(undefined) 会抛异常，导致表格永远不结束 loading
        if (enabled === null || enabled === undefined) {
          return null;
        }

        // 后端 is_enabled 为 Boolean（Swagger 注释里的「草稿」态无法表达），故用三元而非 tagMap
        return (
          <Tag color={enabled ? 'success' : 'error'}>
            {$t(enabled ? 'page.message.common.enabled' : 'page.message.common.disabled')}
          </Tag>
        );
      }
    },
    {
      key: 'createTime',
      dataIndex: 'createTime',
      title: $t('page.message.common.createTime'),
      align: 'center',
      width: 180,
      customRender: ({ record }) => formatDateTime(record.createTime)
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      // 三个按钮：发布/禁用 + 编辑 + 删除，宽度按「最宽组合不换行」取值
      width: 200,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          {record.enabled ? (
            <Button size="small" onClick={() => handleChangeEnabled(record)}>
              {$t('page.message.common.disabled')}
            </Button>
          ) : (
            <Popconfirm
              title={$t('page.message.template.publishConfirm')}
              onConfirm={() => handleChangeEnabled(record)}
            >
              <Button size="small">{$t('page.message.template.publish')}</Button>
            </Popconfirm>
          )}
          <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
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

async function getTypeNameMap() {
  const { error, data: typeList } = await fetchGetMessageTypeList({ current: 1, size: 200 });

  if (error) {
    return;
  }

  typeNameById.value = new Map(typeList.records.map(item => [String(item.id), item.typeName]));
  typeOptions.value = typeList.records.map(item => ({
    label: item.typeName,
    value: String(item.id)
  }));
}

/**
 * 发布 / 禁用
 *
 * enabled 是 Boolean，「草稿」态无法表达，故：
 * 未启用走 publish（后端对已启用模板调用会拒绝），已启用走 disable。
 */
async function handleChangeEnabled(record: Api.Message.MessageTemplate) {
  const { error } = record.enabled
    ? await fetchChangeMessageTemplateEnabled(record.id, false)
    : await fetchPublishMessageTemplate(record.id);

  if (error) {
    window.$message?.error?.($t('common.updateFailed'));
    return;
  }

  window.$message?.success?.($t('common.updateSuccess'));
  await getData();
}

async function handleBatchDelete() {
  const ids = checkedRowKeys.value;

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteMessageTemplate(ids);

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
    const { error } = await fetchDeleteMessageTemplate([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    deleting.value = false;
  }
}

/** 用函数声明包一层：columns 在 useTableOperate 之前取值，直接引用 handleEdit 会触发 no-use-before-define */
function edit(id: string) {
  handleEdit(id);
}

onMounted(() => {
  getTypeNameMap();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <TemplateSearch
      v-model:model="searchParams"
      :type-options="typeOptions"
      @reset="resetSearchParams"
      @search="getDataByPage"
    />
    <ACard
      :title="$t('page.message.template.title')"
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
      <TemplateOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
