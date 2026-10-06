<script setup lang="tsx">
import { computed, ref } from 'vue';
import { Button, Popconfirm, Switch, Tag } from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { jsonClone } from '@sa/utils';
import {
  fetchAddAlarmSilence,
  fetchConfirmAlarmRecord,
  fetchDeleteAlarmRule,
  fetchGetAlarmRecordList,
  fetchGetAlarmRuleList,
  fetchUpdateAlarmRuleEnabled
} from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { useTable, useTableScroll } from '@/hooks/common/table';
import { formatDateTime } from '@/utils/common';
import { $t } from '@/locales';
import InstanceSelect from '../modules/instance-select.vue';
import { alarmLevelTagColor, alarmStatusTagColor, alarmStatusText } from '../shared';
import RuleOperateModal from './modules/rule-operate-modal.vue';

defineOptions({
  name: 'MonitorAlarm'
});

const { hasAuth } = useAuth();

const activeTab = ref<'records' | 'rules'>('records');

// ==================== 告警记录 ====================

const { scrollConfig: recordScroll } = useTableScroll(1500);

const recordRange = ref<[Dayjs, Dayjs]>();

const {
  columns: recordColumns,
  columnChecks: recordColumnChecks,
  data: recordData,
  getData: getRecordData,
  getDataByPage: getRecordDataByPage,
  loading: recordLoading,
  mobilePagination: recordPagination,
  searchParams: recordSearchParams,
  resetSearchParams: resetRecordSearchParams
} = useTable({
  apiFn: fetchGetAlarmRecordList,
  apiParams: {
    current: 1,
    size: 10,
    alarmStatus: undefined,
    alarmLevel: undefined,
    instanceId: undefined,
    start: undefined,
    end: undefined
  },
  columns: () => [
    { key: 'index', dataIndex: 'index', title: $t('common.index'), align: 'center', width: 64 },
    {
      key: 'alarmLevel',
      dataIndex: 'alarmLevel',
      title: $t('page.manage.monitor.alarm.alarmLevel'),
      align: 'center',
      width: 100,
      customRender: ({ record }) =>
        record.alarmLevel ? <Tag color={alarmLevelTagColor(record.alarmLevel)}>{record.alarmLevel}</Tag> : null
    },
    {
      key: 'ruleName',
      dataIndex: 'ruleName',
      title: $t('page.manage.monitor.alarm.ruleName'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      key: 'instanceName',
      dataIndex: 'instanceName',
      title: $t('page.manage.monitor.alarm.instanceName'),
      align: 'center',
      width: 150,
      ellipsis: true
    },
    {
      key: 'metricName',
      dataIndex: 'metricName',
      title: $t('page.manage.monitor.alarm.metricName'),
      align: 'center',
      width: 200,
      ellipsis: true
    },
    {
      key: 'metricValue',
      dataIndex: 'metricValue',
      title: $t('page.manage.monitor.alarm.metricValue'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => `${record.metricValue ?? '-'} / ${record.thresholdValue ?? '-'}`
    },
    {
      key: 'alarmContent',
      dataIndex: 'alarmContent',
      title: $t('page.manage.monitor.alarm.alarmContent'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'alarmStatus',
      dataIndex: 'alarmStatus',
      title: $t('page.manage.monitor.alarm.alarmStatus'),
      align: 'center',
      width: 110,
      customRender: ({ record }) =>
        record.alarmStatus ? (
          <Tag color={alarmStatusTagColor(record.alarmStatus)}>{alarmStatusText(record.alarmStatus)}</Tag>
        ) : null
    },
    {
      key: 'lastTriggerTime',
      dataIndex: 'lastTriggerTime',
      title: $t('page.manage.monitor.alarm.lastTriggerTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => formatDateTime(record.lastTriggerTime)
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 190,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          {hasAuth('monitor:alarm:confirm') && record.alarmStatus === 'FIRING' && (
            <Button type="primary" ghost size="small" onClick={() => openConfirm(record)}>
              {$t('page.manage.monitor.alarm.confirm')}
            </Button>
          )}
          {hasAuth('monitor:alarm:silence') && (
            <Button size="small" onClick={() => openSilence(record)}>
              {$t('page.manage.monitor.alarm.silence')}
            </Button>
          )}
        </div>
      )
    }
  ]
});

const statusOptions = computed(() => [
  { label: $t('page.manage.monitor.common.alarmFiring'), value: 'FIRING' },
  { label: $t('page.manage.monitor.common.alarmConfirmed'), value: 'CONFIRMED' },
  { label: $t('page.manage.monitor.common.alarmRecovered'), value: 'RECOVERED' }
]);

const levelOptions = [
  { label: 'INFO', value: 'INFO' },
  { label: 'WARN', value: 'WARN' },
  { label: 'CRITICAL', value: 'CRITICAL' }
];

function handleRecordSearch() {
  recordSearchParams.start = recordRange.value?.[0]?.format('YYYY-MM-DDTHH:mm:ss');
  recordSearchParams.end = recordRange.value?.[1]?.format('YYYY-MM-DDTHH:mm:ss');
  getRecordDataByPage();
}

function handleRecordReset() {
  recordRange.value = undefined;
  resetRecordSearchParams();
}

// ==================== 确认 ====================

const confirmVisible = ref(false);
const confirmLoading = ref(false);
const confirmRecord = ref<Api.Monitor.AlarmRecord | null>(null);
const confirmRemark = ref('');

function openConfirm(record: Api.Monitor.AlarmRecord) {
  confirmRecord.value = record;
  confirmRemark.value = '';
  confirmVisible.value = true;
}

async function submitConfirm() {
  if (!confirmRecord.value) {
    return;
  }
  confirmLoading.value = true;
  try {
    const { error } = await fetchConfirmAlarmRecord(confirmRecord.value.id, confirmRemark.value || undefined);
    if (error) {
      window.$message?.error?.($t('common.updateFailed'));
      return;
    }
    window.$message?.success?.($t('common.updateSuccess'));
    confirmVisible.value = false;
    getRecordDataByPage();
  } finally {
    confirmLoading.value = false;
  }
}

// ==================== 静默 ====================

const silenceVisible = ref(false);
const silenceLoading = ref(false);
const silenceRecord = ref<Api.Monitor.AlarmRecord | null>(null);
const silenceRange = ref<[Dayjs, Dayjs]>();
const silenceReason = ref('');

function openSilence(record: Api.Monitor.AlarmRecord) {
  silenceRecord.value = record;
  silenceRange.value = [dayjs(), dayjs().add(1, 'hour')];
  silenceReason.value = '';
  silenceVisible.value = true;
}

async function submitSilence() {
  if (!silenceRecord.value?.ruleId || !silenceRange.value) {
    window.$message?.warning?.($t('page.manage.monitor.alarm.form.silenceRange'));
    return;
  }
  silenceLoading.value = true;
  try {
    const { error } = await fetchAddAlarmSilence({
      ruleId: silenceRecord.value.ruleId,
      instanceId: silenceRecord.value.instanceId,
      silenceStart: silenceRange.value[0].format('YYYY-MM-DDTHH:mm:ss'),
      silenceEnd: silenceRange.value[1].format('YYYY-MM-DDTHH:mm:ss'),
      reason: silenceReason.value || undefined
    });
    if (error) {
      window.$message?.error?.($t('common.addFailed'));
      return;
    }
    window.$message?.success?.($t('common.addSuccess'));
    silenceVisible.value = false;
  } finally {
    silenceLoading.value = false;
  }
}

// ==================== 规则 ====================

const { scrollConfig: ruleScroll } = useTableScroll(1500);

const {
  columns: ruleColumns,
  columnChecks: ruleColumnChecks,
  data: ruleData,
  getData: getRuleData,
  getDataByPage: getRuleDataByPage,
  loading: ruleLoading,
  mobilePagination: rulePagination,
  searchParams: ruleSearchParams,
  resetSearchParams: resetRuleSearchParams
} = useTable({
  apiFn: fetchGetAlarmRuleList,
  apiParams: {
    current: 1,
    size: 10,
    ruleName: undefined,
    metricSource: undefined,
    alarmLevel: undefined,
    enabled: undefined
  },
  columns: () => [
    { key: 'index', dataIndex: 'index', title: $t('common.index'), align: 'center', width: 64 },
    {
      key: 'ruleName',
      dataIndex: 'ruleName',
      title: $t('page.manage.monitor.alarm.ruleName'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'metricSource',
      dataIndex: 'metricSource',
      title: $t('page.manage.monitor.alarm.metricSource'),
      align: 'center',
      width: 100
    },
    {
      key: 'metricName',
      dataIndex: 'metricName',
      title: $t('page.manage.monitor.alarm.metricName'),
      align: 'center',
      width: 220,
      ellipsis: true
    },
    {
      key: 'conditionOp',
      dataIndex: 'conditionOp',
      title: $t('page.manage.monitor.alarm.conditionOp'),
      align: 'center',
      width: 140,
      customRender: ({ record }) => `${record.conditionOp} ${record.thresholdValue}`
    },
    {
      key: 'durationCount',
      dataIndex: 'durationCount',
      title: $t('page.manage.monitor.alarm.durationCount'),
      align: 'center',
      width: 100
    },
    {
      key: 'alarmLevel',
      dataIndex: 'alarmLevel',
      title: $t('page.manage.monitor.alarm.alarmLevel'),
      align: 'center',
      width: 100,
      customRender: ({ record }) =>
        record.alarmLevel ? <Tag color={alarmLevelTagColor(record.alarmLevel)}>{record.alarmLevel}</Tag> : null
    },
    {
      key: 'enabled',
      dataIndex: 'enabled',
      title: $t('page.manage.monitor.alarm.enabled'),
      align: 'center',
      width: 90,
      customRender: ({ record }) => (
        <Switch
          checked={record.enabled}
          disabled={!hasAuth('monitor:alarm:rule')}
          onChange={checked => handleToggleRule(record, Boolean(checked))}
        />
      )
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 130,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          {hasAuth('monitor:alarm:rule') && (
            <Button type="primary" ghost size="small" onClick={() => handleEditRule(record.id)}>
              {$t('common.edit')}
            </Button>
          )}
          {hasAuth('monitor:alarm:rule') && (
            <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDeleteRule(record.id)}>
              <Button danger size="small">
                {$t('common.delete')}
              </Button>
            </Popconfirm>
          )}
        </div>
      )
    }
  ]
});

const ruleVisible = ref(false);
const ruleOperateType = ref<AntDesign.TableOperateType>('add');
const ruleEditingData = ref<Api.Monitor.AlarmRule | null>(null);

/** 抽屉状态手写：AlarmRule 不满足 useTableOperate 的 TableData 约束（同 instance 页） */
function handleAddRule() {
  ruleOperateType.value = 'add';
  ruleEditingData.value = null;
  ruleVisible.value = true;
}

function handleEditRule(id: string) {
  ruleOperateType.value = 'edit';
  const found = ruleData.value.find(item => item.id === id) ?? null;
  ruleEditingData.value = jsonClone(found);
  ruleVisible.value = true;
}

const metricSourceOptions = [
  { label: 'Redis', value: 'REDIS' },
  { label: 'DB', value: 'DB' },
  { label: 'SERVICE', value: 'SERVICE' }
];

const enabledOptions = computed(() => [
  { label: $t('page.manage.monitor.alarm.enabledYes'), value: 'true' },
  { label: $t('page.manage.monitor.alarm.enabledNo'), value: 'false' }
]);

async function handleToggleRule(record: Api.Monitor.AlarmRule, enabled: boolean) {
  const { error } = await fetchUpdateAlarmRuleEnabled(record.id, enabled);
  if (error) {
    window.$message?.error?.($t('common.updateFailed'));
    return;
  }
  record.enabled = enabled;
}

async function handleDeleteRule(id: string) {
  const { error } = await fetchDeleteAlarmRule(id);
  if (error) {
    window.$message?.error?.($t('common.deleteFailed'));
    return;
  }
  window.$message?.success?.($t('common.deleteSuccess'));
  getRuleData();
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <ACard
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'auto' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <ATabs v-model:active-key="activeTab">
        <ATabPane key="records" :tab="$t('page.manage.monitor.alarm.recordsTab')">
          <div class="mb-16px flex-y-center flex-wrap gap-12px">
            <ASelect
              v-model:value="recordSearchParams.alarmStatus"
              :options="statusOptions"
              :placeholder="$t('page.manage.monitor.alarm.alarmStatus')"
              class="w-140px"
              allow-clear
            />
            <ASelect
              v-model:value="recordSearchParams.alarmLevel"
              :options="levelOptions"
              :placeholder="$t('page.manage.monitor.alarm.alarmLevel')"
              class="w-140px"
              allow-clear
            />
            <!-- 搜索筛选项：默认「全部」，不做第一项自动选中 -->
            <InstanceSelect v-model="recordSearchParams.instanceId" :default-first="false" class="w-220px" />
            <ARangePicker v-model:value="recordRange" show-time />
            <AButton type="primary" ghost @click="handleRecordSearch">{{ $t('common.search') }}</AButton>
            <AButton @click="handleRecordReset">{{ $t('common.reset') }}</AButton>
            <div class="flex-1" />
            <TableColumnSetting v-model:columns="recordColumnChecks" />
            <AButton size="small" :loading="recordLoading" @click="getRecordData">{{ $t('common.refresh') }}</AButton>
          </div>
          <ATable
            :columns="recordColumns"
            :data-source="recordData"
            size="small"
            :scroll="recordScroll"
            :loading="recordLoading"
            row-key="id"
            :pagination="recordPagination"
            class="h-full"
          />
        </ATabPane>
        <ATabPane key="rules" :tab="$t('page.manage.monitor.alarm.rulesTab')">
          <div class="mb-16px flex-y-center flex-wrap gap-12px">
            <AInput
              v-model:value="ruleSearchParams.ruleName"
              :placeholder="$t('page.manage.monitor.alarm.form.ruleName')"
              class="w-200px"
              allow-clear
            />
            <ASelect
              v-model:value="ruleSearchParams.metricSource"
              :options="metricSourceOptions"
              :placeholder="$t('page.manage.monitor.alarm.metricSource')"
              class="w-140px"
              allow-clear
            />
            <ASelect
              v-model:value="ruleSearchParams.alarmLevel"
              :options="levelOptions"
              :placeholder="$t('page.manage.monitor.alarm.alarmLevel')"
              class="w-140px"
              allow-clear
            />
            <ASelect
              v-model:value="ruleSearchParams.enabled"
              :options="enabledOptions"
              :placeholder="$t('page.manage.monitor.alarm.enabled')"
              class="w-140px"
              allow-clear
            />
            <AButton type="primary" ghost @click="getRuleDataByPage()">{{ $t('common.search') }}</AButton>
            <AButton @click="resetRuleSearchParams">{{ $t('common.reset') }}</AButton>
            <div class="flex-1" />
            <AButton v-if="hasAuth('monitor:alarm:rule')" type="primary" @click="handleAddRule">
              {{ $t('page.manage.monitor.alarm.addRule') }}
            </AButton>
            <TableColumnSetting v-model:columns="ruleColumnChecks" />
            <AButton size="small" :loading="ruleLoading" @click="getRuleData">{{ $t('common.refresh') }}</AButton>
          </div>
          <ATable
            :columns="ruleColumns"
            :data-source="ruleData"
            size="small"
            :scroll="ruleScroll"
            :loading="ruleLoading"
            row-key="id"
            :pagination="rulePagination"
            class="h-full"
          />
        </ATabPane>
      </ATabs>

      <RuleOperateModal
        v-model:visible="ruleVisible"
        :operate-type="ruleOperateType"
        :row-data="ruleEditingData"
        @submitted="getRuleDataByPage"
      />
    </ACard>

    <AModal v-model:open="confirmVisible" :title="$t('page.manage.monitor.alarm.confirmTitle')" :width="480">
      <AAlert type="info" show-icon class="mb-12px" :message="confirmRecord?.alarmContent ?? ''" />
      <ATextarea
        v-model:value="confirmRemark"
        :maxlength="1000"
        :rows="3"
        :placeholder="$t('page.manage.monitor.alarm.form.handleRemark')"
      />
      <template #footer>
        <div class="flex-y-center justify-end gap-12px">
          <AButton @click="confirmVisible = false">{{ $t('common.cancel') }}</AButton>
          <AButton type="primary" :loading="confirmLoading" @click="submitConfirm">{{ $t('common.confirm') }}</AButton>
        </div>
      </template>
    </AModal>

    <AModal v-model:open="silenceVisible" :title="$t('page.manage.monitor.alarm.silenceTitle')" :width="480">
      <AForm layout="vertical">
        <AFormItem :label="$t('page.manage.monitor.alarm.silenceRange')" required>
          <ARangePicker v-model:value="silenceRange" show-time class="w-full" />
        </AFormItem>
        <AFormItem :label="$t('page.manage.monitor.alarm.silenceReason')">
          <ATextarea
            v-model:value="silenceReason"
            :maxlength="500"
            :rows="2"
            :placeholder="$t('page.manage.monitor.alarm.form.silenceReason')"
          />
        </AFormItem>
      </AForm>
      <template #footer>
        <div class="flex-y-center justify-end gap-12px">
          <AButton @click="silenceVisible = false">{{ $t('common.cancel') }}</AButton>
          <AButton type="primary" :loading="silenceLoading" @click="submitSilence">{{ $t('common.confirm') }}</AButton>
        </div>
      </template>
    </AModal>
  </div>
</template>

<style scoped></style>
