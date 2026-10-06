<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  fetchAddAlarmRule,
  fetchGetAlarmRuleTemplates,
  fetchGetAllGroups,
  fetchGetRoleOptions,
  fetchGetUserList,
  fetchUpdateAlarmRule
} from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';
import InstanceSelect from '../../modules/instance-select.vue';

defineOptions({
  name: 'MonitorAlarmRuleOperateModal'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.Monitor.AlarmRule | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const { formRef, validate, resetFields } = useAntdForm();
const { defaultRequiredRule, createMaxLengthRule, createNumberRangeRule } = useFormRules();

const RULE_NAME_MAX = 100;
const REMARK_MAX = 500;

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() =>
  isEdit.value ? $t('page.manage.monitor.alarm.editRule') : $t('page.manage.monitor.alarm.addRule')
);

/** 指标名联动选项（对齐后端 MetricNameConstant） */
const METRIC_OPTIONS: Record<Api.Monitor.MetricSource, string[]> = {
  REDIS: [
    'redis.memory.used_percent',
    'redis.stats.ops_per_sec',
    'redis.stats.hit_rate',
    'redis.clients.connected',
    'redis.keyspace.keys',
    'redis.stats.evicted_keys',
    'redis.replication.master_link_status',
    'redis.replication.connected_slaves',
    'redis.memory.fragmentation_ratio'
  ],
  DB: [
    'db.pool.active_count',
    'db.pool.wait_thread_count',
    'db.threads.running',
    'db.questions',
    'db.slow_queries',
    'db.deadlocks',
    'db.sessions'
  ],
  SERVICE: [
    'service.health',
    'service.instance.count',
    'service.instance.healthy.count',
    'service.jvm.memory.used',
    'service.jvm.threads.live',
    'service.jvm.gc.pause',
    'instance.unreachable'
  ]
};

const metricSourceOptions = computed(() => [
  { label: 'Redis', value: 'REDIS' },
  { label: $t('page.manage.monitor.alarm.sourceDb'), value: 'DB' },
  { label: $t('page.manage.monitor.alarm.sourceService'), value: 'SERVICE' }
]);

interface RuleModel {
  ruleName: string;
  metricSource: Api.Monitor.MetricSource;
  targetType: string;
  targetId?: string;
  metricName?: string;
  conditionOp?: string;
  thresholdValue?: number;
  durationCount: number;
  alarmLevel: Api.Monitor.AlarmLevel;
  notifyChannels: string[];
  userIds: string[];
  roleIds: string[];
  remark?: string;
}

const model = ref<RuleModel>(createDefaultModel());

function createDefaultModel(): RuleModel {
  return {
    ruleName: '',
    metricSource: 'REDIS',
    targetType: 'INSTANCE',
    targetId: undefined,
    metricName: METRIC_OPTIONS.REDIS[0],
    conditionOp: 'GT',
    thresholdValue: undefined,
    durationCount: 1,
    alarmLevel: 'WARN',
    notifyChannels: ['SITE'],
    userIds: [],
    roleIds: [],
    remark: undefined
  };
}

const metricNameOptions = computed(() =>
  (METRIC_OPTIONS[model.value.metricSource] ?? []).map(value => ({ label: value, value }))
);

const targetTypeOptions = computed(() => [
  { label: $t('page.manage.monitor.alarm.targetInstance'), value: 'INSTANCE' },
  { label: $t('page.manage.monitor.alarm.targetGroup'), value: 'GROUP' },
  { label: $t('page.manage.monitor.alarm.targetAll'), value: 'ALL' }
]);

const conditionOpOptions = [
  { label: '>', value: 'GT' },
  { label: '>=', value: 'GTE' },
  { label: '<', value: 'LT' },
  { label: '<=', value: 'LTE' },
  { label: '=', value: 'EQ' },
  { label: '!=', value: 'NE' },
  { label: $t('page.manage.monitor.alarm.opChangeRateGt'), value: 'CHANGE_RATE_GT' },
  { label: $t('page.manage.monitor.alarm.opChangeRateLt'), value: 'CHANGE_RATE_LT' }
];

const alarmLevelOptions = computed(() => [
  { label: 'INFO', value: 'INFO' },
  { label: 'WARN', value: 'WARN' },
  { label: 'CRITICAL', value: 'CRITICAL' }
]);

const notifyChannelOptions = [
  { label: $t('page.manage.monitor.alarm.channelSite'), value: 'SITE' },
  { label: $t('page.manage.monitor.alarm.channelMail'), value: 'MAIL' },
  { label: $t('page.manage.monitor.alarm.channelDingtalk'), value: 'DINGTALK' }
];

type RuleKey = keyof Pick<
  RuleModel,
  | 'ruleName'
  | 'metricSource'
  | 'targetType'
  | 'metricName'
  | 'conditionOp'
  | 'thresholdValue'
  | 'durationCount'
  | 'remark'
>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  ruleName: [defaultRequiredRule, createMaxLengthRule(RULE_NAME_MAX)],
  metricSource: [defaultRequiredRule],
  targetType: [defaultRequiredRule],
  metricName: [defaultRequiredRule],
  conditionOp: [defaultRequiredRule],
  thresholdValue: [defaultRequiredRule],
  durationCount: [createNumberRangeRule(1, 100)],
  remark: [createMaxLengthRule(REMARK_MAX)]
}));

// ==================== 下拉数据 ====================

const groupOptions = ref<{ label: string; value: string }[]>([]);
const userOptions = ref<{ label: string; value: string }[]>([]);
const roleOptions = ref<{ label: string; value: string }[]>([]);

async function loadOptions() {
  const [groups, users, roles] = await Promise.all([
    fetchGetAllGroups(),
    fetchGetUserList({ current: 1, size: 500 }),
    fetchGetRoleOptions()
  ]);
  if (groups.data) {
    groupOptions.value = groups.data.map(item => ({ label: item.groupName, value: item.id }));
  }
  if (users.data) {
    userOptions.value = (users.data.records ?? []).map(item => ({
      label: `${item.nickname}(${item.account})`,
      value: item.id
    }));
  }
  if (roles.data) {
    roleOptions.value = roles.data.map(item => ({ label: item.roleName, value: item.id }));
  }
}

// ==================== 内置模板 ====================

const templateVisible = ref(false);
const templates = ref<Api.Monitor.AlarmRuleTemplate[]>([]);

async function openTemplates() {
  templateVisible.value = true;
  const { data, error } = await fetchGetAlarmRuleTemplates();
  templates.value = error || !data ? [] : data;
}

function applyTemplate(template: Api.Monitor.AlarmRuleTemplate) {
  model.value.ruleName = template.ruleName;
  model.value.metricSource = template.metricSource;
  model.value.metricName = template.metricName;
  model.value.conditionOp = template.conditionOp;
  model.value.thresholdValue = Number(template.thresholdValue);
  model.value.durationCount = template.durationCount ?? 1;
  model.value.alarmLevel = template.alarmLevel;
  templateVisible.value = false;
}

// ==================== 提交 ====================

function handleMetricSourceChange() {
  model.value.metricName = METRIC_OPTIONS[model.value.metricSource]?.[0];
}

function handleTargetTypeChange() {
  model.value.targetId = undefined;
}

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const row = props.rowData;

    model.value = {
      ruleName: row.ruleName ?? '',
      metricSource: row.metricSource,
      targetType: row.targetType ?? 'INSTANCE',
      targetId: row.targetId,
      metricName: row.metricName,
      conditionOp: row.conditionOp,
      thresholdValue: Number(row.thresholdValue),
      durationCount: row.durationCount ?? 1,
      alarmLevel: row.alarmLevel ?? 'WARN',
      notifyChannels: row.notifyChannels ? row.notifyChannels.split(',').filter(Boolean) : ['SITE'],
      userIds: row.notifyTargets?.userIds ? [...row.notifyTargets.userIds] : [],
      roleIds: row.notifyTargets?.roleIds ? [...row.notifyTargets.roleIds] : [],
      remark: row.remark
    };
  }
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const params: Api.Monitor.AlarmRuleOperateParams = {
      id: props.rowData?.id,
      ruleName: model.value.ruleName,
      metricSource: model.value.metricSource,
      targetType: model.value.targetType,
      targetId: model.value.targetType === 'ALL' ? undefined : model.value.targetId,
      metricName: model.value.metricName ?? '',
      conditionOp: model.value.conditionOp ?? '',
      thresholdValue: model.value.thresholdValue ?? 0,
      durationCount: model.value.durationCount,
      alarmLevel: model.value.alarmLevel,
      notifyChannels: model.value.notifyChannels.join(','),
      userIds: model.value.userIds,
      roleIds: model.value.roleIds,
      remark: model.value.remark
    };

    const { error } = isEdit.value ? await fetchUpdateAlarmRule(params) : await fetchAddAlarmRule(params);

    if (error) {
      window.$message?.error?.(isEdit.value ? $t('common.updateFailed') : $t('common.addFailed'));
      return;
    }

    window.$message?.success?.(isEdit.value ? $t('common.updateSuccess') : $t('common.addSuccess'));
    visible.value = false;
    emit('submitted');
  } finally {
    submitLoading.value = false;
  }
}

watch(visible, val => {
  if (val) {
    handleInitModel();
    resetFields();
  }
});

onMounted(() => {
  loadOptions();
});
</script>

<template>
  <AModal v-model:open="visible" :title="title" :width="640" :mask-closable="false">
    <div v-if="!isEdit" class="mb-12px flex-y-center justify-end">
      <AButton size="small" @click="openTemplates">{{ $t('page.manage.monitor.alarm.templates') }}</AButton>
    </div>
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <ARow :gutter="16">
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.ruleName')" name="ruleName">
            <AInput
              v-model:value="model.ruleName"
              :maxlength="RULE_NAME_MAX"
              :placeholder="$t('page.manage.monitor.alarm.form.ruleName')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.metricSource')" name="metricSource">
            <ASelect
              v-model:value="model.metricSource"
              :options="metricSourceOptions"
              @change="handleMetricSourceChange"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.metricName')" name="metricName">
            <ASelect
              v-model:value="model.metricName"
              :options="metricNameOptions"
              show-search
              :placeholder="$t('page.manage.monitor.alarm.form.metricName')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.conditionOp')" name="conditionOp">
            <ASelect
              v-model:value="model.conditionOp"
              :options="conditionOpOptions"
              :placeholder="$t('page.manage.monitor.alarm.form.conditionOp')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.thresholdValue')" name="thresholdValue">
            <AInputNumber v-model:value="model.thresholdValue" class="w-full" />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.durationCount')" name="durationCount">
            <AInputNumber v-model:value="model.durationCount" :min="1" :max="100" class="w-full" />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.targetType')" name="targetType">
            <ASelect v-model:value="model.targetType" :options="targetTypeOptions" @change="handleTargetTypeChange" />
          </AFormItem>
        </ACol>
        <ACol v-if="model.targetType === 'INSTANCE'" :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.targetId')" name="targetId">
            <InstanceSelect v-model="model.targetId" />
          </AFormItem>
        </ACol>
        <ACol v-if="model.targetType === 'GROUP'" :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.targetId')" name="targetId">
            <ASelect v-model:value="model.targetId" :options="groupOptions" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.alarmLevel')" name="alarmLevel">
            <ASelect v-model:value="model.alarmLevel" :options="alarmLevelOptions" />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.notifyChannels')" name="notifyChannels">
            <ASelect v-model:value="model.notifyChannels" :options="notifyChannelOptions" mode="multiple" />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.userIds')" name="userIds">
            <ASelect
              v-model:value="model.userIds"
              :options="userOptions"
              mode="multiple"
              show-search
              option-filter-prop="label"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.alarm.roleIds')" name="roleIds">
            <ASelect v-model:value="model.roleIds" :options="roleOptions" mode="multiple" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="24">
          <AFormItem :label="$t('page.manage.monitor.alarm.remark')" name="remark">
            <ATextarea v-model:value="model.remark" :maxlength="REMARK_MAX" :rows="2" />
          </AFormItem>
        </ACol>
      </ARow>
    </AForm>
    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="visible = false">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" @click="handleSubmit">{{ $t('common.confirm') }}</AButton>
      </div>
    </template>

    <AModal
      v-model:open="templateVisible"
      :title="$t('page.manage.monitor.alarm.templates')"
      :width="640"
      :footer="null"
    >
      <AList :data-source="templates" size="small" :locale="{ emptyText: $t('common.noData') }">
        <template #renderItem="{ item }">
          <AListItem>
            <div class="w-full flex-y-center justify-between gap-8px">
              <div class="flex-1">
                <div>{{ item.ruleName }}</div>
                <div class="text-12px text-#999">
                  {{ item.metricName }} {{ item.conditionOp }} {{ item.thresholdValue }} · {{ item.description }}
                </div>
              </div>
              <AButton size="small" type="link" @click="applyTemplate(item)">
                {{ $t('page.manage.monitor.alarm.templateApply') }}
              </AButton>
            </div>
          </AListItem>
        </template>
      </AList>
    </AModal>
  </AModal>
</template>

<style scoped></style>
