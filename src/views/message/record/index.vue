<script setup lang="tsx">
import { onMounted, ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchGetMessageRecordList, fetchGetMessageTypeList, fetchRevokeMessage } from '@/service/api';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import RecordDetailDrawer from './modules/record-detail-drawer.vue';
import RecordSearch from './modules/record-search.vue';

// 优先级改由后端枚举字典驱动（前端不再持有 MessagePriority 表）。
// 子组件（搜索栏 / 详情抽屉）依赖这里先发起加载，所以不要在 *-search.vue 里重复调用。
ensureEnumDict('message');

/**
 * 9 个数据列 + 操作列：定宽列之和 1124，弹性列 messageTitle 留 200 的下限，故取 1500。
 */
const TABLE_SCROLL_X = 1500;

const { tableWrapperRef, scrollConfig } = useTableScroll(TABLE_SCROLL_X);

/**
 * 消息类型编码 → 名称
 *
 * 后端 `message_record` 只存 `message_type` 编码（VARCHAR(32)），名称在 `message_type` 表里。
 * 用途有两个，都指向同一个映射，所以只拉一次：
 * 1. 列表列展示可读名称（原先裸显示编码）；
 * 2. 搜索栏的类型下拉（`code → name`）。
 *
 * 必须定义在 `useTable` 之前，columns 的渲染函数才能直接读到。
 */
const typeOptions = ref<CommonType.Option<string, string>[]>([]);
const typeNameByCode = ref<Map<string, string>>(new Map());

/**
 * 撤回中的消息
 *
 * 存的是「哪一条」而不是 boolean —— 按钮的 `loading` 是逐行的，
 * 用全局单例 ref 会让整页所有行一起转圈（audit/archive 就是那个反面教材）。
 * 声明在 `useTable` 之前，columns 的渲染函数才能直接读到。
 */
const revokingId = ref('');

async function getTypeOptions() {
  const { error, data } = await fetchGetMessageTypeList({ current: 1, size: 200 });

  if (error) {
    return;
  }

  typeNameByCode.value = new Map(data.records.map(item => [item.typeCode, item.typeName]));
  typeOptions.value = data.records.map(item => ({
    label: `${item.typeName}（${item.typeCode}）`,
    value: item.typeCode
  }));
}

/**
 * 消息记录只读
 *
 * 记录由发送链路产生，后端虽然生成了 add / update / delete 端点，但页面不暴露；
 * 因此不接 useTableOperate（无新增/编辑/删除/批量删除），行选择一并省略。
 */
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
  apiFn: fetchGetMessageRecordList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    messageId: undefined,
    messageTitle: undefined,
    messageType: undefined,
    senderSystem: undefined,
    priority: undefined,
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
      key: 'messageId',
      dataIndex: 'messageId',
      title: $t('page.message.common.messageId'),
      align: 'center',
      width: 200,
      ellipsis: true
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'messageTitle',
      dataIndex: 'messageTitle',
      title: $t('page.message.record.messageTitle'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'messageType',
      dataIndex: 'messageType',
      title: $t('page.message.record.messageType'),
      align: 'center',
      width: 140,
      ellipsis: true,
      // 表里存的是编码，展示名称；映射拿不到时回退编码本身
      customRender: ({ record }) => typeNameByCode.value.get(record.messageType) ?? record.messageType
    },
    {
      key: 'priority',
      dataIndex: 'priority',
      title: $t('page.message.record.priority'),
      align: 'center',
      width: 100,
      // 走枚举字典而不是就地查表：priority 在库里是没有 CHECK 约束的裸 SMALLINT，
      // 出现未知码时字典取词器回落显示原值，不会抛异常、整张表卡在 loading
      customRender: ({ record }) => (
        <Tag color={enumDictColor('message', 'MessagePriority', record.priority)}>
          {enumDictText('message', 'MessagePriority', record.priority)}
        </Tag>
      )
    },
    {
      key: 'totalCount',
      dataIndex: 'totalCount',
      title: $t('page.message.record.totalCount'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => record.totalCount ?? 0
    },
    {
      key: 'successCount',
      dataIndex: 'successCount',
      title: $t('page.message.record.successCount'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => record.successCount ?? 0
    },
    {
      key: 'failCount',
      dataIndex: 'failCount',
      title: $t('page.message.record.failCount'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => {
        const failCount = record.failCount ?? 0;

        return <Tag color={failCount > 0 ? 'error' : 'success'}>{failCount}</Tag>;
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
      width: 130,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => openDetail(record.id)}>
            {$t('page.message.record.detail')}
          </Button>
          <Popconfirm title={$t('page.message.record.revokeConfirm')} onConfirm={() => handleRevoke(record)}>
            <Button danger size="small" loading={revokingId.value === record.messageId}>
              {$t('page.message.record.revoke')}
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ]
});

/** 详情抽屉（只读，与表单抽屉无关） */
const detailVisible = ref(false);
const detailId = ref('');

function openDetail(id: string) {
  detailId.value = id;
  detailVisible.value = true;
}

/**
 * 撤回消息
 *
 * ⚠️ 后端入参是**业务 messageId** 而非主键；撤回失败时仍返回 200 且 data=false
 * （例如消息已送达或已撤回），故必须判 data 而不能只看 error。
 */
async function handleRevoke(record: Api.Message.MessageRecord) {
  revokingId.value = record.messageId;
  try {
    const { data: revoked, error } = await fetchRevokeMessage(record.messageId);

    if (error) {
      window.$message?.error?.($t('page.message.record.revokeFailed'));
      return;
    }

    if (!revoked) {
      window.$message?.warning?.($t('page.message.record.revokeFailed'));
      return;
    }

    window.$message?.success?.($t('common.updateSuccess'));
    await getData();
  } finally {
    revokingId.value = '';
  }
}

onMounted(() => {
  getTypeOptions();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <RecordSearch
      v-model:model="searchParams"
      :type-options="typeOptions"
      @reset="resetSearchParams"
      @search="getDataByPage"
    />
    <ACard
      :title="$t('page.message.record.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <!-- 消息记录只读：隐藏「新增 / 批量删除」（覆盖 default 插槽无效，见组件内注释） -->
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading"
          :show-add="false"
          :show-delete="false"
          @refresh="getData"
        />
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
      <RecordDetailDrawer :id="detailId" v-model:visible="detailVisible" :type-name-by-code="typeNameByCode" />
    </ACard>
  </div>
</template>

<style scoped></style>
