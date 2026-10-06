<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  sequenceDatePatternOptions,
  sequenceDatePatternResetCycles,
  sequenceResetCycleOptions
} from '@/constants/business';
import { fetchAddSequenceRule, fetchUpdateSequenceRule } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'SequenceRuleOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.SystemManage.SequenceRule | null;
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

/** 列宽取自 `sys_sequence_rule.sql`：rule_code VARCHAR(64)、rule_name VARCHAR(128)、
 *  prefix VARCHAR(32)、separator VARCHAR(8) */
const RULE_CODE_MAX = 64;
const RULE_NAME_MAX = 128;
const PREFIX_MAX = 32;
const SEPARATOR_MAX = 8;

/** 与后端 `SysSequenceRuleCreateParam` 的 @Min/@Max 一致 */
const SEQ_LENGTH_MIN = 1;
const SEQ_LENGTH_MAX = 12;
const STEP_MIN = 1;
const STEP_MAX = 10000;

/** 「永不重置」编码，无日期段时只允许取该值 */
const RESET_NEVER = 1;

/**
 * 规则编码格式
 *
 * ⚠️ 必须与后端 `SysSequenceRuleCreateParam.ruleCode` 的 @Pattern **逐字一致**：
 * `^[A-Za-z][A-Za-z0-9_]{1,63}$`（只允许下划线，**不含** `.` 与 `-`）。
 * 不要复用 `REG_BIZ_CODE` —— 它额外放行 `.` 和 `-`，会让 `a.b` 通过前端校验后被后端拒绝。
 */
const RULE_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{1,63}$/;

/**
 * 前缀 / 分隔符允许的字符集
 *
 * 与后端 `SysSequenceRuleCreateParam.prefix/separator` 的 @Pattern 逐字一致
 * （`^[A-Za-z0-9_-]*$`）。这两个字段会被**逐字拼进业务单号**，流向日志、CSV 导出与
 * 下游 LIKE 查询，因此必须挡住换行、引号、`%`、`_` 这类会破坏下游解析的字符。
 * 空串合法（= 清空该字段），故量词是 `*`。
 */
const CODE_CHARSET_PATTERN = /^[A-Za-z0-9_-]*$/;

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.sequence.addRule'),
    edit: $t('page.manage.sequence.editRule')
  };
  return titles[props.operateType];
});

interface Model {
  ruleCode: string;
  ruleName: string;
  prefix: string;
  /** 空串表示编码中不含日期段 */
  datePattern: Api.SystemManage.SequenceDatePattern | '';
  separator: string;
  seqLength: number;
  step: number;
  resetCycle: Api.SystemManage.SequenceResetCycle;
}

const model = ref<Model>(createDefaultModel());

function createDefaultModel(): Model {
  return {
    ruleCode: '',
    ruleName: '',
    prefix: '',
    datePattern: 'yyyyMMdd',
    separator: '-',
    seqLength: 6,
    step: 1,
    resetCycle: 2
  };
}

type RuleKey = Extract<
  keyof Model,
  'ruleCode' | 'ruleName' | 'prefix' | 'separator' | 'seqLength' | 'step' | 'resetCycle'
>;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  ruleCode: [
    defaultRequiredRule,
    { pattern: RULE_CODE_PATTERN, message: $t('page.manage.sequence.form.ruleCodePattern'), trigger: 'change' }
  ],
  ruleName: [defaultRequiredRule, createMaxLengthRule(RULE_NAME_MAX)],
  // 前缀/分隔符会被逐字拼进业务单号（进日志、进导出、进下游 LIKE 查询），故限字符集；
  // 空串合法（= 清空该字段），所以量词是 `*` 而非 `+`
  prefix: [
    createMaxLengthRule(PREFIX_MAX),
    { pattern: CODE_CHARSET_PATTERN, message: $t('page.manage.sequence.form.codeCharset'), trigger: 'change' }
  ],
  separator: [
    createMaxLengthRule(SEPARATOR_MAX),
    { pattern: CODE_CHARSET_PATTERN, message: $t('page.manage.sequence.form.codeCharset'), trigger: 'change' }
  ],
  // AInputNumber 清空后值是 null，仅靠区间规则拦不住，故叠加必填
  seqLength: [defaultRequiredRule, createNumberRangeRule(SEQ_LENGTH_MIN, SEQ_LENGTH_MAX)],
  step: [defaultRequiredRule, createNumberRangeRule(STEP_MIN, STEP_MAX)],
  resetCycle: [defaultRequiredRule]
};

/**
 * 当前日期段允许的重置周期集合
 *
 * 后端校验的是「重置周期不得短于日期段粒度」（`SequenceCodeFormatter.isCycleCompatible`）：
 * 编码里只有月份段却要求按日重置时，重置实际发生在月切换时，配置与意图不符（后端 20986 拒绝）。
 */
const allowedResetCycles = computed<Api.SystemManage.SequenceResetCycle[]>(
  () => sequenceDatePatternResetCycles[model.value.datePattern] ?? [RESET_NEVER]
);

/** 重置周期下拉项：只列出与当前日期段兼容的（不含日期段时仅剩「永不重置」） */
const resetCycleOptions = computed(() =>
  sequenceResetCycleOptions.filter(option => allowedResetCycles.value.includes(option.value))
);

/**
 * 把重置周期收敛进当前允许集合
 *
 * 保留用户已选的「永不重置」；否则落到该日期段**最细**的允许周期
 * （yyyy → 按年、yyyyMM → 按月、yyyyMMdd 及更细 → 按日）。
 */
function normalizeResetCycle() {
  if (allowedResetCycles.value.includes(model.value.resetCycle)) {
    return;
  }

  model.value.resetCycle = allowedResetCycles.value.find(item => item !== RESET_NEVER) ?? RESET_NEVER;
}

/**
 * 日期段变化 ⇒ 重新收敛重置周期
 *
 * 编码里没有周期标识时，跨周期流水归零会与上一周期的编码**重复**（后端 20984）；
 * 日期段变粗后原周期可能不再可用（后端 20986）。两处都在这里兜住，
 * 避免用户填完整张表单才被拒。
 */
watch(() => model.value.datePattern, normalizeResetCycle);

/**
 * 编辑态展示数据库兜底计数水位
 *
 * 真相源是 Redis 键 `sys:sequence:{ruleCode}[:{period}]`（无日期段时无 period 后缀），
 * `current_value` 只在 Redis 不可用时的 CAS 兜底路径上推进，正常时按条件回写，
 * 因此**不是实时计数**（见 sys_sequence_rule.sql 注释）。
 * 该字段后端是 Long、按字符串下发（与 id 同一约定），故插值前不做数值运算。
 */
const watermarkText = computed(() => {
  const value = props.rowData?.currentValue ?? '0';
  const period = props.rowData?.currentPeriod || $t('page.manage.sequence.datePatternNone');

  return $t('page.manage.sequence.watermarkHint', { value, period });
});

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const source = props.rowData;

    // 显式逐字段赋值，禁止 Object.assign 整体铺开（SKILL 列表页范式第 13 条）
    model.value = {
      ruleCode: source.ruleCode ?? '',
      ruleName: source.ruleName ?? '',
      prefix: source.prefix ?? '',
      datePattern: (source.datePattern ?? '') as Model['datePattern'],
      separator: source.separator ?? '',
      seqLength: source.seqLength ?? 6,
      step: source.step ?? 1,
      resetCycle: source.resetCycle ?? RESET_NEVER
    };
  }

  // 兜底：库里可能存在「无日期段 + 按周期重置」的行（建表默认值是 2，手工 SQL / 初始化脚本
  // 都能造出来），此时 watch 不会触发（值没变），必须在这里收敛，否则用户只改个名称也会被后端拒
  normalizeResetCycle();
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;
  try {
    // 空串是有意义的输入：后端 MyBatis-Plus 会跳过 null 字段，只有空串才能清空已填的前缀/分隔符
    const payload: Api.SystemManage.SequenceRuleOperateParams = {
      ruleCode: model.value.ruleCode,
      ruleName: model.value.ruleName,
      prefix: model.value.prefix,
      datePattern: model.value.datePattern,
      separator: model.value.separator,
      seqLength: model.value.seqLength,
      step: model.value.step,
      resetCycle: model.value.resetCycle
    };

    const requestFn = props.operateType === 'edit' ? fetchUpdateSequenceRule : fetchAddSequenceRule;
    const { error } = await requestFn(
      props.operateType === 'edit' ? { id: String(props.rowData?.id ?? ''), ...payload } : payload
    );
    if (error) {
      return;
    }
    window.$message?.success?.(props.operateType === 'edit' ? $t('common.updateSuccess') : $t('common.addSuccess'));
    closeDrawer();
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
</script>

<template>
  <!-- 宽度 480：规范默认档，竖排表单含下拉与数值输入 -->
  <ADrawer v-model:open="visible" :title="title" :width="480">
    <AAlert v-if="isEdit" type="info" show-icon class="mb-16px" :message="watermarkText" />
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.manage.sequence.ruleCode')" name="ruleCode">
        <!-- 业务主键：创建后不可修改（后端 update 忽略该字段），编辑态只读 -->
        <AInput
          v-model:value="model.ruleCode"
          :disabled="isEdit"
          :maxlength="RULE_CODE_MAX"
          show-count
          :placeholder="$t('page.manage.sequence.form.ruleCode')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.manage.sequence.ruleName')" name="ruleName">
        <AInput
          v-model:value="model.ruleName"
          :maxlength="RULE_NAME_MAX"
          show-count
          :placeholder="$t('page.manage.sequence.form.ruleName')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.manage.sequence.prefix')" name="prefix">
        <AInput
          v-model:value="model.prefix"
          :maxlength="PREFIX_MAX"
          show-count
          :placeholder="$t('page.manage.sequence.form.prefix')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.manage.sequence.datePattern')" name="datePattern">
        <ASelect v-model:value="model.datePattern">
          <ASelectOption v-for="option in sequenceDatePatternOptions" :key="option.value" :value="option.value">
            {{ $t(option.label) }}
          </ASelectOption>
        </ASelect>
      </AFormItem>
      <AFormItem :label="$t('page.manage.sequence.separator')" name="separator">
        <AInput
          v-model:value="model.separator"
          :maxlength="SEPARATOR_MAX"
          show-count
          :placeholder="$t('page.manage.sequence.form.separator')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.manage.sequence.resetCycle')" name="resetCycle">
        <!-- 可选周期受日期段粒度限制（后端 20986），故选项是动态过滤后的 -->
        <ASelect v-model:value="model.resetCycle">
          <ASelectOption v-for="option in resetCycleOptions" :key="option.value" :value="option.value">
            {{ $t(option.label) }}
          </ASelectOption>
        </ASelect>
        <div v-if="resetCycleOptions.length < sequenceResetCycleOptions.length" class="mt-4px text-12px text-gray-400">
          {{ $t('page.manage.sequence.form.resetCycleLimited') }}
        </div>
      </AFormItem>
      <AFormItem :label="$t('page.manage.sequence.seqLength')" name="seqLength">
        <AInputNumber
          v-model:value="model.seqLength"
          class="w-full"
          :min="SEQ_LENGTH_MIN"
          :max="SEQ_LENGTH_MAX"
          :precision="0"
          :placeholder="$t('page.manage.sequence.form.seqLength')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.manage.sequence.step')" name="step">
        <AInputNumber
          v-model:value="model.step"
          class="w-full"
          :min="STEP_MIN"
          :max="STEP_MAX"
          :precision="0"
          :placeholder="$t('page.manage.sequence.form.step')"
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
