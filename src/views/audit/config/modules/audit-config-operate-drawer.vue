<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddAuditConfig, fetchUpdateAuditConfig } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'AuditConfigOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.Audit.Config | null;
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
const { defaultRequiredRule, createMaxLengthRule, createNumberRangeRule } = useFormRules();

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

/**
 * 列宽与默认值取自 `carlos-audit/docs/02-design/database/audit_postgresql.sql`
 * 的 `audit_log_config`（已用线上库的 information_schema 复核过）。
 *
 * ⚠️ `retention_days` 的库默认是 **90**、`store_technical` 的库默认是 **FALSE**，
 * 与原先前端写死的 7 / true 都不一致。新增表单若不改，用户什么都没动就已经
 * 偏离了服务端默认值 —— 而 `retention_days` 会通过
 * `AuditLogEventHandler#applyConfig` 换算成 ClickHouse 的 TTL 截止日期，
 * 等于「默认少存 83 天」。
 */
const LOG_TYPE_MAX = 50;
const TENANT_ID_MAX = 64;
const RETENTION_DAYS_DEFAULT = 90;

/**
 * 保留天数的上限
 *
 * 后端没有任何上限校验，而它最终会变成 `eventDate.plusDays(retentionDays)`。
 * 给一个足够宽松、又能挡住 `Integer` 溢出/`LocalDate` 越界的值（10 年）。
 */
const RETENTION_DAYS_MAX = 3650;

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.audit.config.addConfig'),
    edit: $t('page.audit.config.editConfig')
  };
  return titles[props.operateType];
});

type Model = Pick<
  Api.Audit.Config,
  'logType' | 'retentionDays' | 'samplingRate' | 'asyncWrite' | 'storeDataChange' | 'storeTechnical' | 'tenantId'
>;

function createDefaultModel(): Model {
  return {
    logType: '',
    retentionDays: RETENTION_DAYS_DEFAULT,
    samplingRate: 1,
    asyncWrite: true,
    storeDataChange: true,
    // 与库默认值保持一致（store_technical BOOLEAN NOT NULL DEFAULT FALSE）
    storeTechnical: false,
    // 0 表示系统级（全局）配置，与库默认值 '0' 一致
    tenantId: '0'
  };
}

const model = ref(createDefaultModel());

type RuleKey = Extract<keyof Model, 'logType' | 'retentionDays' | 'samplingRate' | 'tenantId'>;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  logType: [defaultRequiredRule, createMaxLengthRule(LOG_TYPE_MAX)],
  retentionDays: [defaultRequiredRule, createNumberRangeRule(1, RETENTION_DAYS_MAX)],
  // sampling_rate 是 NUMERIC(3,2)：只能放两位小数，超出部分会被库静默四舍五入
  samplingRate: [defaultRequiredRule, createNumberRangeRule(0, 1)],
  tenantId: [defaultRequiredRule, createMaxLengthRule(TENANT_ID_MAX)]
};

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { logType, retentionDays, samplingRate, asyncWrite, storeDataChange, storeTechnical, tenantId } =
      props.rowData;

    // 显式挑选字段，避免把 id / createBy / createTime 等公共字段一并回传
    model.value = {
      logType: logType ?? '',
      retentionDays: retentionDays ?? RETENTION_DAYS_DEFAULT,
      samplingRate: samplingRate ?? 1,
      asyncWrite: asyncWrite ?? true,
      storeDataChange: storeDataChange ?? true,
      storeTechnical: storeTechnical ?? false,
      tenantId: tenantId ?? '0'
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
      ? await fetchUpdateAuditConfig({ id: props.rowData?.id ?? '', ...model.value })
      : await fetchAddAuditConfig(model.value);

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
  <!-- 7 个字段含两个数字输入与三个开关，360 的默认抽屉宽度偏挤，故放宽到 480 -->
  <ADrawer v-model:open="visible" :title="title" :width="480">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.audit.config.logType')" name="logType">
        <!--
          log_type 是业务键：唯一索引 uk_audit_config_tenant_type 是 (tenant_id, log_type)，
          且运行期按 (logType, tenantId) 精确查配置（AuditLogConfigManagerImpl 的 LoadingCache）。
          编辑态放开可改会静默打断这条引用。
        -->
        <AInput
          v-model:value="model.logType"
          :disabled="isEdit"
          :maxlength="LOG_TYPE_MAX"
          show-count
          :placeholder="$t('page.audit.config.form.logType')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.audit.config.retentionDays')" name="retentionDays">
        <AInputNumber
          v-model:value="model.retentionDays"
          class="w-full"
          :min="1"
          :max="RETENTION_DAYS_MAX"
          :precision="0"
        />
      </AFormItem>
      <AFormItem :label="$t('page.audit.config.samplingRate')" name="samplingRate">
        <!-- precision 必须与库里的 NUMERIC(3,2) 对齐：不设时输入 0.333 会被静默四舍五入成 0.33 -->
        <AInputNumber v-model:value="model.samplingRate" class="w-full" :min="0" :max="1" :step="0.01" :precision="2" />
      </AFormItem>
      <AFormItem
        :label="$t('page.audit.config.tenantId')"
        name="tenantId"
        :extra="$t('page.audit.config.form.tenantIdHint')"
      >
        <AInput
          v-model:value="model.tenantId"
          :maxlength="TENANT_ID_MAX"
          show-count
          :placeholder="$t('page.audit.config.form.tenantId')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.audit.config.asyncWrite')" name="asyncWrite">
        <ASwitch v-model:checked="model.asyncWrite" />
      </AFormItem>
      <AFormItem :label="$t('page.audit.config.storeDataChange')" name="storeDataChange">
        <ASwitch v-model:checked="model.storeDataChange" />
      </AFormItem>
      <AFormItem :label="$t('page.audit.config.storeTechnical')" name="storeTechnical">
        <ASwitch v-model:checked="model.storeTechnical" />
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
