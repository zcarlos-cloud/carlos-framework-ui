<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchChangeMessageChannelEnabled, fetchDeleteMessageChannel, fetchGetMessageChannelList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import ChannelOperateDrawer from './modules/channel-operate-drawer.vue';
import ChannelSearch from './modules/channel-search.vue';

// 渠道类型改由后端枚举字典驱动（前端不再持有 ChannelType 表）。
// 子组件（搜索栏 / 抽屉）依赖这里先发起加载，所以不要在 *-search.vue 里重复调用。
ensureEnumDict('message');

const TABLE_SCROLL_X = 1400;

const { tableWrapperRef, scrollConfig } = useTableScroll(TABLE_SCROLL_X);

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
  apiFn: fetchGetMessageChannelList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    channelCode: undefined,
    channelName: undefined,
    channelType: undefined,
    enabled: undefined
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
      key: 'channelCode',
      dataIndex: 'channelCode',
      title: $t('page.message.common.channelCode'),
      align: 'center',
      width: 160
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'channelName',
      dataIndex: 'channelName',
      title: $t('page.message.channel.channelName'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'channelType',
      dataIndex: 'channelType',
      title: $t('page.message.channel.channelType'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => <Tag>{enumDictText('message', 'ChannelType', record.channelType)}</Tag>
    },
    {
      key: 'provider',
      dataIndex: 'provider',
      title: $t('page.message.common.provider'),
      align: 'center',
      width: 120,
      ellipsis: true,
      customRender: ({ record }) => record.provider || '-'
    },
    {
      key: 'enabled',
      dataIndex: 'enabled',
      title: $t('page.message.channel.enabled'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('message', 'MessageChannelEnabled', record.enabled)}>
          {enumDictText('message', 'MessageChannelEnabled', record.enabled)}
        </Tag>
      )
    },
    {
      key: 'rateLimitQps',
      dataIndex: 'rateLimitQps',
      title: $t('page.message.channel.rateLimitQps'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => record.rateLimitQps ?? '-'
    },
    {
      key: 'weight',
      dataIndex: 'weight',
      title: $t('page.message.channel.weight'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => record.weight ?? '-'
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
      // 三个按钮：启用/停用 + 编辑 + 删除，宽度按「最宽组合不换行」取值
      width: 200,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button size="small" onClick={() => handleChangeEnabled(record)}>
            {$t(String(record.enabled) === '1' ? 'page.message.common.disabled' : 'page.message.common.enabled')}
          </Button>
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

/**
 * 启用 / 停用
 *
 * 后端只提供 enable（1）与 disable（0）两个端点；故障态（2）由后端在发送失败时置位，
 * 这里把「启用」也作为故障渠道的恢复手段（会覆盖为 1）。
 */
async function handleChangeEnabled(record: Api.Message.MessageChannel) {
  // enabled 后端是 Integer、JSON 下发为数字（TS 名义类型是字符串联合），必须 String() 归一后再比
  const { error } = await fetchChangeMessageChannelEnabled(record.id, String(record.enabled) !== '1');

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
    const { error } = await fetchDeleteMessageChannel(ids);

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
    const { error } = await fetchDeleteMessageChannel([id]);

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
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <ChannelSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.message.channel.title')"
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
      <ChannelOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
