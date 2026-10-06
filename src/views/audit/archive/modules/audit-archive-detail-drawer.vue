<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Tag } from 'ant-design-vue';
import { fetchGetArchiveRecordDetail } from '@/service/api';
import { formatDateTime, formatFileSize } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'AuditArchiveDetailDrawer'
});

ensureEnumDict('audit');

interface Props {
  /** 待查看的归档记录主键 */
  id: string;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const loading = ref(false);

const detail = ref<Api.Audit.ArchiveRecord | null>(null);

/** 空值统一显示为短横线，避免 Descriptions 出现空白格 */
const EMPTY_TEXT = '-';

function text(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return EMPTY_TEXT;
  }

  return String(value);
}

const items = computed(() => {
  const record = detail.value;

  if (!record) {
    return [];
  }

  return [
    { key: 'archiveId', label: $t('page.audit.archive.archiveId'), value: text(record.archiveId) },
    { key: 'archiveDate', label: $t('page.audit.archive.archiveDate'), value: text(record.archiveDate) },
    {
      key: 'dataRange',
      label: $t('page.audit.archive.dataRange'),
      value: [formatDateTime(record.startTime), formatDateTime(record.endTime)].filter(Boolean).join(' ~ ')
    },
    { key: 'recordCount', label: $t('page.audit.archive.recordCount'), value: text(record.recordCount) },
    {
      key: 'fileSizeBytes',
      label: $t('page.audit.archive.fileSizeBytes'),
      value: formatFileSize(record.fileSizeBytes)
    },
    {
      key: 'storageType',
      label: $t('page.audit.archive.storageType'),
      value: enumDictText('audit', 'AuditLogStorageType', record.storageType)
    },
    { key: 'storagePath', label: $t('page.audit.archive.storagePath'), value: text(record.storagePath) },
    { key: 'verifyChecksum', label: $t('page.audit.archive.verifyChecksum'), value: text(record.verifyChecksum) },
    {
      key: 'archiveStatus',
      label: $t('page.audit.archive.archiveStatus'),
      value: enumDictText('audit', 'AuditLogArchiveState', record.archiveStatus)
    },
    { key: 'createdTime', label: $t('page.audit.archive.createdTime'), value: formatDateTime(record.createdTime) }
  ];
});

async function loadDetail() {
  if (!props.id) {
    return;
  }

  loading.value = true;
  try {
    const { data, error } = await fetchGetArchiveRecordDetail(props.id);

    if (error) {
      return;
    }

    detail.value = data ?? null;
  } finally {
    loading.value = false;
  }
}

watch(visible, () => {
  if (visible.value) {
    detail.value = null;
    loadDetail();
  }
});
</script>

<template>
  <ADrawer v-model:open="visible" :title="$t('page.audit.archive.detailTitle')" :width="560">
    <ASpin :spinning="loading">
      <div v-if="detail" class="flex flex-col gap-16px">
        <div v-if="detail.archiveStatus" class="flex-y-center gap-8px">
          <Tag :color="enumDictColor('audit', 'AuditLogArchiveState', detail.archiveStatus)">
            {{ enumDictText('audit', 'AuditLogArchiveState', detail.archiveStatus) }}
          </Tag>
        </div>
        <ADescriptions :column="1" size="small" bordered>
          <ADescriptionsItem v-for="item in items" :key="item.key" :label="item.label">
            {{ item.value }}
          </ADescriptionsItem>
        </ADescriptions>
      </div>
    </ASpin>
  </ADrawer>
</template>

<style scoped></style>
