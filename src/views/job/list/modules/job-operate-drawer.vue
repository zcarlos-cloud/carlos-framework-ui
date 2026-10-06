<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddJob, fetchPreviewFireTimes, fetchUpdateJob } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { ensureEnumDict, enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'JobOperateDrawer'
});

ensureEnumDict('job');

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.Job.JobRecord | null;
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
const { defaultRequiredRule, createMaxLengthRule } = useFormRules();

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

/**
 * 列宽/长度与后端约束对齐：
 * jobName VARCHAR 规则 ^[a-zA-Z0-9_-]{1,100}$，serviceName 64，handlerName 128，
 * params 4000（QRTZ_JOB_DETAILS.JOB_DATA 存储），description 250（QRTZ DESCRIPTION 列），
 * author 64，alarmReceivers 500（job_info 列宽），
 * cronExpression 128（job_info.schedule_conf VARCHAR(128)，见 carlos-job/docs/sql/job_info.sql）
 */
const JOB_NAME_MAX = 100;
const SERVICE_NAME_MAX = 64;
const HANDLER_NAME_MAX = 128;
const CRON_EXPRESSION_MAX = 128;
const PARAMS_MAX = 4000;
const DESCRIPTION_MAX = 250;
const AUTHOR_MAX = 64;
const ALARM_RECEIVERS_MAX = 500;

/** 与后端 JobScheduleManagerImpl.MIN_INTERVAL_MS 对齐 */
const MIN_INTERVAL_MS = 10000;
const TIMEOUT_MAX = 86400;
const RETRY_MAX = 10;

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.job.addJob'),
    edit: $t('page.manage.job.editJob')
  };
  return titles[props.operateType];
});

/**
 * 调度类型选项（数字码）：字典直驱（label 已本地化），选项 value 转回数字以匹配 number 模型
 * （勿用 transformRecordToOption —— 它会把数字键转成字符串导致选中失配）
 */
const scheduleTypeOptions = computed(() =>
  enumDictOptions('job', 'JobScheduleType').map(option => ({
    ...option,
    value: Number(option.value) as Api.Job.ScheduleType
  }))
);

const misfireOptions = computed(() =>
  enumDictOptions('job', 'JobMisfireStrategy').map(option => ({
    ...option,
    value: Number(option.value) as Api.Job.MisfireStrategy
  }))
);

const concurrentOptions = computed(() =>
  enumDictOptions('job', 'JobConcurrentMode').map(option => ({
    ...option,
    value: Number(option.value) as Api.Job.ConcurrentMode
  }))
);

/**
 * 表单模型：调度配置按类型拆成三个字段（cronExpression / intervalMs / onceTime），
 * 提交时再折叠成 scheduleConf 下发；其余字段与后端 JobCreateParam / JobUpdateParam 一一对应。
 */
type Model = Pick<
  Api.Job.JobOperateParams,
  'jobName' | 'serviceName' | 'handlerName' | 'params' | 'description' | 'author' | 'alarmReceivers'
> & {
  scheduleType: Api.Job.ScheduleType;
  cronExpression: string;
  /** AInputNumber 不接受 null，空值用 undefined（清空时 axios 会丢弃该字段走后端默认） */
  intervalMs?: number;
  /** ISO_LOCAL_DATE_TIME 字符串（DatePicker valueFormat 直接产出） */
  onceTime: string;
  misfireStrategy: Api.Job.MisfireStrategy;
  concurrentMode: Api.Job.ConcurrentMode;
  timeoutSeconds?: number;
  failRetryCount?: number;
};

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    jobName: '',
    serviceName: '',
    handlerName: '',
    scheduleType: 1,
    cronExpression: '',
    intervalMs: undefined,
    onceTime: '',
    misfireStrategy: 0,
    concurrentMode: 1,
    timeoutSeconds: undefined,
    failRetryCount: undefined,
    author: '',
    alarmReceivers: '',
    params: '',
    description: ''
  };
}

type RuleKey = Extract<
  keyof Model,
  | 'jobName'
  | 'serviceName'
  | 'handlerName'
  | 'cronExpression'
  | 'intervalMs'
  | 'author'
  | 'alarmReceivers'
  | 'params'
  | 'description'
>;

/**
 * 每个键都必须在模板里有同名的 `name`，否则规则静默失效
 * （反面教材见 SKILL.md 的 `RuleKey = Extract<...>` 一节）
 *
 * 正则与后端 @Pattern 保持一致：jobName 允许字母数字下划线中划线，
 * serviceName 不允许下划线（Nacos 服务名约定），handlerName 是 Bean 名不允许中划线。
 * intervalMs 只在固定间隔类型下必填（条件校验在 validator 内判断 scheduleType）。
 */
const rules: Record<RuleKey, App.Global.FormRule[]> = {
  jobName: [
    defaultRequiredRule,
    { pattern: /^[a-zA-Z0-9_-]{1,100}$/, message: $t('page.manage.job.form.jobNamePattern'), trigger: 'change' }
  ],
  serviceName: [
    defaultRequiredRule,
    { pattern: /^[a-zA-Z0-9-]{1,64}$/, message: $t('page.manage.job.form.serviceNamePattern'), trigger: 'change' }
  ],
  handlerName: [
    defaultRequiredRule,
    { pattern: /^[a-zA-Z0-9_]{1,128}$/, message: $t('page.manage.job.form.handlerNamePattern'), trigger: 'change' }
  ],
  cronExpression: [
    createMaxLengthRule(CRON_EXPRESSION_MAX),
    {
      validator: async (_rule, value) => {
        if (model.value.scheduleType !== 1) {
          return;
        }
        if (!value) {
          throw new Error($t('page.manage.job.form.cronExpression'));
        }
      },
      trigger: 'change'
    }
  ],
  intervalMs: [
    {
      validator: async (_rule, value) => {
        if (model.value.scheduleType !== 2) {
          return;
        }
        if (value === undefined || value === null || value < MIN_INTERVAL_MS) {
          throw new Error($t('page.manage.job.form.intervalMs'));
        }
      },
      trigger: 'change'
    }
  ],
  author: [createMaxLengthRule(AUTHOR_MAX)],
  alarmReceivers: [createMaxLengthRule(ALARM_RECEIVERS_MAX)],
  params: [createMaxLengthRule(PARAMS_MAX)],
  description: [createMaxLengthRule(DESCRIPTION_MAX)]
};

/** 把三个分类型字段折叠为后端 scheduleConf */
function resolveScheduleConf(): string {
  if (model.value.scheduleType === 1) {
    return model.value.cronExpression;
  }
  if (model.value.scheduleType === 2) {
    const interval = model.value.intervalMs;
    return interval === undefined || interval === null ? '' : String(interval);
  }
  return model.value.onceTime;
}

/** 编辑态回显：把行数据映射为表单模型（显式挑选字段，不带回 id / status / nextFireTime 等展示字段） */
function buildEditModel(rowData: Api.Job.JobRecord): Model {
  const scheduleType = rowData.scheduleType ?? 1;
  const scheduleConf = rowData.scheduleConf ?? rowData.cronExpression ?? '';
  return {
    jobName: rowData.jobName ?? '',
    serviceName: rowData.serviceName ?? '',
    handlerName: rowData.handlerName ?? '',
    scheduleType,
    cronExpression: scheduleType === 1 ? scheduleConf : '',
    intervalMs: scheduleType === 2 && scheduleConf ? Number(scheduleConf) : undefined,
    onceTime: scheduleType === 3 ? scheduleConf : '',
    misfireStrategy: rowData.misfireStrategy ?? 0,
    concurrentMode: rowData.concurrentMode ?? 1,
    timeoutSeconds: rowData.timeoutSeconds ?? undefined,
    failRetryCount: rowData.failRetryCount ?? undefined,
    author: rowData.author ?? '',
    alarmReceivers: rowData.alarmReceivers ?? '',
    params: rowData.params ?? '',
    description: rowData.description ?? ''
  };
}

function handleInitModel() {
  model.value = props.operateType === 'edit' && props.rowData ? buildEditModel(props.rowData) : createDefaultModel();
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const scheduleConf = resolveScheduleConf();
    // 编辑态：目标服务与处理器不可改（后端 update 会忽略），其余字段全量回传（后端 null 会覆盖旧值）
    const payload: Api.Job.JobOperateParams = {
      jobName: model.value.jobName,
      serviceName: model.value.serviceName,
      handlerName: model.value.handlerName,
      scheduleType: model.value.scheduleType,
      scheduleConf,
      // cronExpression 仅作老数据兜底字段透传
      cronExpression: model.value.scheduleType === 1 ? scheduleConf : undefined,
      misfireStrategy: model.value.misfireStrategy,
      concurrentMode: model.value.concurrentMode,
      timeoutSeconds: model.value.timeoutSeconds ?? undefined,
      failRetryCount: model.value.failRetryCount ?? undefined,
      author: model.value.author,
      alarmReceivers: model.value.alarmReceivers,
      params: model.value.params,
      description: model.value.description
    };

    const { error } = isEdit.value ? await fetchUpdateJob(payload) : await fetchAddJob(payload);

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

/** 触发时间预览 */
const previewLoading = ref(false);
const previewTimes = ref<string[]>([]);
const previewVisible = ref(false);

async function handlePreview() {
  const scheduleConf = resolveScheduleConf();
  if (!scheduleConf) {
    previewTimes.value = [];
    previewVisible.value = true;
    return;
  }
  previewLoading.value = true;
  try {
    const { data, error } = await fetchPreviewFireTimes({
      scheduleType: model.value.scheduleType,
      scheduleConf,
      count: 5
    });
    if (error) {
      previewTimes.value = [];
      previewVisible.value = true;
      return;
    }
    previewTimes.value = data ?? [];
    previewVisible.value = true;
  } finally {
    previewLoading.value = false;
  }
}

watch(visible, () => {
  if (visible.value) {
    handleInitModel();
    resetFields();
    previewVisible.value = false;
    previewTimes.value = [];
  }
});
</script>

<template>
  <ADrawer v-model:open="visible" :title="title" :width="560">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.manage.job.jobName')" name="jobName">
        <!-- 任务名称是唯一键（配合分组），编辑态锁定 -->
        <AInput
          v-model:value="model.jobName"
          :disabled="isEdit"
          :maxlength="JOB_NAME_MAX"
          show-count
          :placeholder="$t('page.manage.job.form.jobName')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.job.serviceName')" name="serviceName">
        <AInput
          v-model:value="model.serviceName"
          :disabled="isEdit"
          :maxlength="SERVICE_NAME_MAX"
          show-count
          :placeholder="$t('page.manage.job.form.serviceName')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.job.handlerName')" name="handlerName">
        <AInput
          v-model:value="model.handlerName"
          :disabled="isEdit"
          :maxlength="HANDLER_NAME_MAX"
          show-count
          :placeholder="$t('page.manage.job.form.handlerName')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.job.scheduleType')">
        <ARadioGroup v-model:value="model.scheduleType" :options="scheduleTypeOptions" option-type="button" />
      </AFormItem>

      <AFormItem v-if="model.scheduleType === 1" :label="$t('page.manage.job.cronExpression')" name="cronExpression">
        <AInput
          v-model:value="model.cronExpression"
          :maxlength="CRON_EXPRESSION_MAX"
          show-count
          :placeholder="$t('page.manage.job.form.cronExpression')"
        />
      </AFormItem>

      <AFormItem v-if="model.scheduleType === 2" :label="$t('page.manage.job.intervalMs')" name="intervalMs">
        <AInputNumber
          v-model:value="model.intervalMs"
          :min="MIN_INTERVAL_MS"
          :step="1000"
          class="w-full"
          :placeholder="$t('page.manage.job.form.intervalMs')"
        />
      </AFormItem>

      <AFormItem v-if="model.scheduleType === 3" :label="$t('page.manage.job.onceTime')">
        <ADatePicker
          v-model:value="model.onceTime"
          show-time
          value-format="YYYY-MM-DDTHH:mm:ss"
          class="w-full"
          :placeholder="$t('page.manage.job.form.onceTime')"
        />
      </AFormItem>

      <AFormItem>
        <AButton size="small" :loading="previewLoading" @click="handlePreview">
          {{ $t('page.manage.job.preview') }}
        </AButton>
        <div v-if="previewVisible" class="mt-8px w-full">
          <AAlert v-if="previewTimes.length === 0" type="warning" :message="$t('page.manage.job.previewEmpty')" />
          <AAlert v-else type="info">
            <template #message>
              <div v-for="time in previewTimes" :key="time">{{ time }}</div>
            </template>
          </AAlert>
        </div>
      </AFormItem>

      <AFormItem :label="$t('page.manage.job.misfireStrategy')">
        <ASelect v-model:value="model.misfireStrategy" :options="misfireOptions" />
      </AFormItem>

      <AFormItem :label="$t('page.manage.job.concurrentMode')">
        <ARadioGroup v-model:value="model.concurrentMode" :options="concurrentOptions" option-type="button" />
      </AFormItem>

      <AFormItem :label="$t('page.manage.job.timeoutSeconds')">
        <AInputNumber v-model:value="model.timeoutSeconds" :min="0" :max="TIMEOUT_MAX" class="w-full" />
      </AFormItem>

      <AFormItem :label="$t('page.manage.job.failRetryCount')">
        <AInputNumber v-model:value="model.failRetryCount" :min="0" :max="RETRY_MAX" class="w-full" />
      </AFormItem>

      <AFormItem :label="$t('page.manage.job.author')" name="author">
        <AInput
          v-model:value="model.author"
          :maxlength="AUTHOR_MAX"
          show-count
          :placeholder="$t('page.manage.job.form.author')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.job.alarmReceivers')" name="alarmReceivers">
        <AInput
          v-model:value="model.alarmReceivers"
          :maxlength="ALARM_RECEIVERS_MAX"
          show-count
          :placeholder="$t('page.manage.job.form.alarmReceivers')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.job.params')" name="params">
        <ATextarea
          v-model:value="model.params"
          :rows="3"
          :maxlength="PARAMS_MAX"
          show-count
          :placeholder="$t('page.manage.job.form.params')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.job.description')" name="description">
        <ATextarea
          v-model:value="model.description"
          :rows="2"
          :maxlength="DESCRIPTION_MAX"
          show-count
          :placeholder="$t('page.manage.job.form.description')"
        />
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
