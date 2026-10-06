<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { Tag } from 'ant-design-vue';
import { fetchGetMessageReceiverList, fetchGetMessageRecordDetail, fetchGetMessageSendLogList } from '@/service/api';
import { formatDateTime, formatJson } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';

// 优先级 / 接收者类型 / 接收人状态改由后端枚举字典驱动（前端不再持有这些文案表）
ensureEnumDict('message');

defineOptions({
  name: 'RecordDetailDrawer'
});

interface Props {
  /** 待查看的消息记录主键 */
  id: string;
  /**
   * 消息类型编码 → 名称
   *
   * 由 `index.vue` 传入：列表列已经改成显示名称了，详情里若还显示裸编码，
   * 同一条消息在两处读起来会不一样。拿不到映射时回退编码本身。
   */
  typeNameByCode?: Map<string, string>;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const recordLoading = ref(false);
const receiverLoading = ref(false);
const sendLogLoading = ref(false);

const detail = ref<Api.Message.MessageRecord | null>(null);
const receivers = ref<Api.Message.MessageReceiver[]>([]);
const sendLogs = ref<Api.Message.MessageSendLog[]>([]);

/** 明细的总条数（后端返回值），用于判断是否被截断 */
const receiversTotal = ref(0);
const sendLogsTotal = ref(0);

/**
 * 接收人 / 发送日志一次取多少条
 *
 * 两张明细表在抽屉里都是 `:pagination="false"`（抽屉内分页体验很差），
 * 原先硬编码 `size: 100` 且**完全不看 total** —— 收件人超过 100 的群发消息会静默少显示，
 * 页面上没有任何迹象表明数据被截断了。这里放大上限，并在真被截断时明确告知。
 */
const DETAIL_PAGE_SIZE = 200;

/** 空值统一显示为短横线，避免 Descriptions 出现空白格 */
const EMPTY_TEXT = '-';

function text(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') {
    return EMPTY_TEXT;
  }

  return String(value);
}

/** 消息类型显示名：优先用 `index.vue` 传下来的映射，拿不到就回退编码本身 */
function messageTypeLabel(code?: string | null) {
  if (!code) {
    return code;
  }

  return props.typeNameByCode?.get(code) ?? code;
}

const items = computed(() => {
  const record = detail.value;

  if (!record) {
    return [];
  }

  return [
    { key: 'messageId', label: $t('page.message.common.messageId'), value: text(record.messageId) },
    {
      key: 'messageType',
      label: $t('page.message.record.messageType'),
      value: text(messageTypeLabel(record.messageType))
    },
    { key: 'messageTitle', label: $t('page.message.record.messageTitle'), value: text(record.messageTitle) },
    {
      key: 'priority',
      label: $t('page.message.record.priority'),
      value: enumDictText('message', 'MessagePriority', record.priority)
    },
    { key: 'templateCode', label: $t('page.message.common.templateCode'), value: text(record.templateCode) },
    { key: 'senderId', label: $t('page.message.record.senderId'), value: text(record.senderId) },
    { key: 'senderName', label: $t('page.message.record.senderName'), value: text(record.senderName) },
    { key: 'senderSystem', label: $t('page.message.record.senderSystem'), value: text(record.senderSystem) },
    { key: 'totalCount', label: $t('page.message.record.totalCount'), value: text(record.totalCount) },
    { key: 'successCount', label: $t('page.message.record.successCount'), value: text(record.successCount) },
    { key: 'failCount', label: $t('page.message.record.failCount'), value: text(record.failCount) },
    { key: 'validUntil', label: $t('page.message.record.validUntil'), value: formatDateTime(record.validUntil) },
    { key: 'messageContent', label: $t('page.message.record.messageContent'), value: text(record.messageContent) },
    {
      key: 'templateParams',
      label: $t('page.message.template.paramSchema'),
      value: formatJson(record.templateParams)
    },
    { key: 'createTime', label: $t('page.message.common.createTime'), value: formatDateTime(record.createTime) }
  ];
});

const receiverColumns = computed(() => [
  {
    key: 'channelCode',
    dataIndex: 'channelCode',
    title: $t('page.message.common.channelCode'),
    align: 'center' as const,
    width: 120
  },
  {
    key: 'receiverId',
    dataIndex: 'receiverId',
    title: $t('page.message.receiver.receiverId'),
    align: 'center' as const,
    width: 140
  },
  {
    key: 'receiverType',
    dataIndex: 'receiverType',
    title: $t('page.message.receiver.receiverType'),
    align: 'center' as const,
    width: 110,
    customRender: ({ record }: { record: Api.Message.MessageReceiver }) => (
      <Tag>{enumDictText('message', 'MessageReceiverType', record.receiverType)}</Tag>
    )
  },
  {
    key: 'receiverNumber',
    dataIndex: 'receiverNumber',
    title: $t('page.message.receiver.receiverNumber'),
    align: 'center' as const,
    width: 160,
    customRender: ({ record }: { record: Api.Message.MessageReceiver }) => record.receiverNumber || EMPTY_TEXT
  },
  {
    key: 'status',
    dataIndex: 'status',
    title: $t('page.message.common.status'),
    align: 'center' as const,
    width: 100,
    customRender: ({ record }: { record: Api.Message.MessageReceiver }) => (
      <Tag color={enumDictColor('message', 'MessageReceiverStatus', record.status)}>
        {enumDictText('message', 'MessageReceiverStatus', record.status)}
      </Tag>
    )
  },
  {
    key: 'failReason',
    dataIndex: 'failReason',
    title: $t('page.message.receiver.failReason'),
    align: 'center' as const,
    width: 160,
    customRender: ({ record }: { record: Api.Message.MessageReceiver }) => record.failReason || EMPTY_TEXT
  },
  {
    key: 'sendTime',
    dataIndex: 'sendTime',
    title: $t('page.message.receiver.sendTime'),
    align: 'center' as const,
    width: 180,
    customRender: ({ record }: { record: Api.Message.MessageReceiver }) => formatDateTime(record.sendTime)
  },
  {
    key: 'deliverTime',
    dataIndex: 'deliverTime',
    title: $t('page.message.receiver.deliverTime'),
    align: 'center' as const,
    width: 180,
    customRender: ({ record }: { record: Api.Message.MessageReceiver }) => formatDateTime(record.deliverTime)
  },
  {
    key: 'readTime',
    dataIndex: 'readTime',
    title: $t('page.message.receiver.readTime'),
    align: 'center' as const,
    width: 180,
    customRender: ({ record }: { record: Api.Message.MessageReceiver }) => formatDateTime(record.readTime)
  }
]);

const sendLogColumns = computed(() => [
  {
    key: 'channelCode',
    dataIndex: 'channelCode',
    title: $t('page.message.common.channelCode'),
    align: 'center' as const,
    width: 120
  },
  {
    key: 'success',
    dataIndex: 'success',
    title: $t('page.message.record.sendLog.success'),
    align: 'center' as const,
    width: 100,
    customRender: ({ record }: { record: Api.Message.MessageSendLog }) => (
      <Tag color={record.success ? 'success' : 'error'}>
        {$t(record.success ? 'page.message.record.sendLog.succeeded' : 'page.message.record.sendLog.failed')}
      </Tag>
    )
  },
  {
    key: 'errorCode',
    dataIndex: 'errorCode',
    title: $t('page.message.record.sendLog.errorCode'),
    align: 'center' as const,
    width: 120,
    customRender: ({ record }: { record: Api.Message.MessageSendLog }) => record.errorCode || EMPTY_TEXT
  },
  {
    // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
    key: 'errorMessage',
    dataIndex: 'errorMessage',
    title: $t('page.message.record.sendLog.errorMessage'),
    align: 'center' as const,
    ellipsis: true,
    customRender: ({ record }: { record: Api.Message.MessageSendLog }) => record.errorMessage || EMPTY_TEXT
  },
  {
    key: 'costTime',
    dataIndex: 'costTime',
    title: $t('page.message.record.sendLog.costTime'),
    align: 'center' as const,
    width: 110,
    customRender: ({ record }: { record: Api.Message.MessageSendLog }) => record.costTime ?? EMPTY_TEXT
  },
  {
    key: 'createTime',
    dataIndex: 'createTime',
    title: $t('page.message.common.createTime'),
    align: 'center' as const,
    width: 180,
    customRender: ({ record }: { record: Api.Message.MessageSendLog }) => formatDateTime(record.createTime)
  }
]);

/** 发送日志的请求/响应原文放在展开行，避免主表被长文本撑开 */
function renderSendLogDetail({ record }: { record: Api.Message.MessageSendLog }) {
  return (
    <div class="flex flex-col gap-8px">
      <div>
        <div class="mb-4px font-medium">{$t('page.message.record.sendLog.requestParam')}</div>
        <pre class="whitespace-pre-wrap break-all text-12px">{formatJson(record.requestParam)}</pre>
      </div>
      <div>
        <div class="mb-4px font-medium">{$t('page.message.record.sendLog.responseData')}</div>
        <pre class="whitespace-pre-wrap break-all text-12px">{formatJson(record.responseData)}</pre>
      </div>
    </div>
  );
}

async function loadDetail(): Promise<Api.Message.MessageRecord | null> {
  if (!props.id) {
    return null;
  }

  recordLoading.value = true;
  try {
    const { data, error } = await fetchGetMessageRecordDetail(props.id);

    if (error) {
      return null;
    }

    const record = data ?? null;
    detail.value = record;

    return record;
  } finally {
    recordLoading.value = false;
  }
}

async function loadReceivers(messageId: string) {
  receiverLoading.value = true;
  try {
    const { data, error } = await fetchGetMessageReceiverList({ messageId, current: 1, size: DETAIL_PAGE_SIZE });

    if (error) {
      return;
    }

    receivers.value = data.records;
    receiversTotal.value = data.total;
  } finally {
    receiverLoading.value = false;
  }
}

async function loadSendLogs(messageId: string) {
  sendLogLoading.value = true;
  try {
    const { data, error } = await fetchGetMessageSendLogList({ messageId, current: 1, size: DETAIL_PAGE_SIZE });

    if (error) {
      return;
    }

    sendLogs.value = data.records;
    sendLogsTotal.value = data.total;
  } finally {
    sendLogLoading.value = false;
  }
}

/**
 * 接收人与发送日志都按**业务 messageId** 过滤，而该字段只有详情接口返回，
 * 所以必须先取详情再并发拉明细。
 */
async function loadAll() {
  detail.value = null;
  receivers.value = [];
  sendLogs.value = [];
  receiversTotal.value = 0;
  sendLogsTotal.value = 0;

  const record = await loadDetail();
  const messageId = record?.messageId;

  if (!messageId) {
    return;
  }

  loadReceivers(messageId);
  loadSendLogs(messageId);
}

watch(visible, () => {
  if (visible.value) {
    loadAll();
  }
});
</script>

<template>
  <!-- 详情含两张明细表，抽屉加宽到 800 -->
  <ADrawer v-model:open="visible" :title="$t('page.message.record.detail')" :width="800">
    <ASpin :spinning="recordLoading">
      <div v-if="detail" class="flex flex-col gap-16px">
        <ADescriptions :column="1" size="small" bordered>
          <ADescriptionsItem v-for="item in items" :key="item.key" :label="item.label">
            {{ item.value }}
          </ADescriptionsItem>
        </ADescriptions>
        <ATabs>
          <ATabPane key="receiver" :tab="$t('page.message.record.tabReceiver')">
            <!-- 明细表在抽屉里不分页，被截断时必须说出来，不能静默少显示 -->
            <div v-if="receiversTotal > receivers.length" class="mb-8px text-12px text-orange-500">
              {{ $t('page.message.record.truncated', { total: receiversTotal, shown: receivers.length }) }}
            </div>
            <ATable
              :columns="receiverColumns"
              :data-source="receivers"
              :loading="receiverLoading"
              :pagination="false"
              :scroll="{ x: 1330 }"
              size="small"
              row-key="id"
            />
          </ATabPane>
          <ATabPane key="sendLog" :tab="$t('page.message.record.tabSendLog')">
            <div v-if="sendLogsTotal > sendLogs.length" class="mb-8px text-12px text-orange-500">
              {{ $t('page.message.record.truncated', { total: sendLogsTotal, shown: sendLogs.length }) }}
            </div>
            <ATable
              :columns="sendLogColumns"
              :data-source="sendLogs"
              :loading="sendLogLoading"
              :pagination="false"
              :scroll="{ x: 900 }"
              :expanded-row-render="renderSendLogDetail"
              size="small"
              row-key="id"
            />
          </ATabPane>
        </ATabs>
      </div>
    </ASpin>
  </ADrawer>
</template>

<style scoped></style>
