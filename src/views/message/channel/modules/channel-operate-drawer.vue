<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { channelConfigHintRecord, channelConfigSampleRecord } from '@/constants/business';
import { fetchAddMessageChannel, fetchUpdateMessageChannel } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { enumDictCodeString, enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'ChannelOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.Message.MessageChannel | null;
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
const { defaultRequiredRule, patternRules, createMaxLengthRule } = useFormRules();

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

/**
 * 列宽与默认值取自 `carlos-message/docs/02-design/database/message_postgresql.sql`
 * 的 `message_channel`（已用线上库的 information_schema 复核过）。
 *
 * ⚠️ `weight` 的库默认是 **100**，原先前端写死 1。
 * 权重是路由的**相对**值（`ChannelRouter.selectByWeight` 按权重随机选同类型的服务商），
 * 所以「1」意味着这条渠道几乎不会被选中 —— 用户在新增页什么都不动，
 * 就已经把新渠道的命中概率压到了别人的 1/N，而界面上没有任何提示。
 */
const CHANNEL_CODE_MAX = 32;
const CHANNEL_NAME_MAX = 32;
const PROVIDER_MAX = 32;
/** channel_config 落库为 jsonb（不限长），这里给输入期一个宽松的硬上限，挡住误粘贴的超长内容 */
const CHANNEL_CONFIG_MAX = 2000;
const WEIGHT_DEFAULT = 100;

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.message.channel.addChannel'),
    edit: $t('page.message.channel.editChannel')
  };
  return titles[props.operateType];
});

type Model = Required<Api.Message.ChannelOperateParams>;

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    channelCode: '',
    channelName: '',
    channelType: '1',
    provider: '',
    channelConfig: '',
    rateLimitQps: 100,
    rateLimitBurst: 200,
    retryTimes: 3,
    retryInterval: 1000,
    // 与库默认值一致（weight INTEGER DEFAULT 100），不是 1
    weight: WEIGHT_DEFAULT,
    enabled: '1'
  };
}

/**
 * 渠道配置的样例与说明随 channelType 变化
 *
 * 依据见 `business.ts` 的 `channelConfigSampleRecord`（逐条从适配器源码里核出来的）。
 * 刻意**不**在切换类型时自动改写 `channelConfig` —— 那样会把用户已经填好的内容冲掉。
 * 改动只体现在这里的提示上。
 *
 * ⚠️ 两个查表都必须兜底，且这两处 `as Record<string, … | undefined>` 不是多余的：
 * `message_channel.channel_type` 是没有 CHECK 约束的裸 SMALLINT，而
 * `MessageChannelVO.channelType` 是 `Integer` 而不是 `ChannelType` 枚举 ——
 * 库里出现一个前端还不认识的类型码时，直接 `$t(record[value])` 会拿到 `undefined`，
 * 而 `$t(undefined)` 会抛异常、整个抽屉渲染不出来。
 * （列表页的 `enumText` 防的是同一件事。）
 */
const channelConfigHint = computed(() => {
  const key = (channelConfigHintRecord as Record<string, App.I18n.I18nKey | undefined>)[model.value.channelType];

  return $t(key ?? 'page.message.channel.configHint.unknown');
});

const channelConfigSample = computed(
  () => (channelConfigSampleRecord as Record<string, string | undefined>)[model.value.channelType] ?? '{}'
);

/**
 * 启用状态表单选项：故障（2）由后端发送链路自动置位、没有独立接口，人工只能在 0/1 之间切换，
 * 所以从字典全量（0/1/2）里滤掉故障态。字典是异步到达的，必须包 computed
 * （setup 期直接算会把空字典快照钉死）。
 */
const channelEnabledFormOptions = computed(() =>
  enumDictOptions('message', 'MessageChannelEnabled').filter(item => item.value !== '2')
);

type RuleKey = Extract<keyof Model, 'channelCode' | 'channelName' | 'channelType' | 'provider' | 'channelConfig'>;

/** channelConfig 落库为 jsonb，非法 JSON 会在后端解析失败 */
const jsonRule: App.Global.FormRule = {
  validator: (_rule, value) => {
    if (!value) {
      return Promise.resolve();
    }

    try {
      JSON.parse(value as string);
      return Promise.resolve();
    } catch {
      return Promise.reject($t('page.message.common.invalidJson'));
    }
  }
};

const rules: Record<RuleKey, App.Global.FormRule | App.Global.FormRule[]> = {
  // channelCode 是业务键（编辑态锁定），除长度外再卡一道业务编码格式
  channelCode: [defaultRequiredRule, patternRules.bizCode, createMaxLengthRule(CHANNEL_CODE_MAX)],
  channelName: [defaultRequiredRule, createMaxLengthRule(CHANNEL_NAME_MAX)],
  channelType: defaultRequiredRule,
  provider: [createMaxLengthRule(PROVIDER_MAX)],
  channelConfig: [defaultRequiredRule, createMaxLengthRule(CHANNEL_CONFIG_MAX), jsonRule]
};

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const {
      channelCode,
      channelName,
      channelType,
      provider,
      channelConfig,
      rateLimitQps,
      rateLimitBurst,
      retryTimes,
      retryInterval,
      weight,
      enabled
    } = props.rowData;

    // 显式挑选字段，避免把 id / createBy 等公共字段一并回传
    model.value = {
      channelCode: channelCode ?? '',
      channelName: channelName ?? '',
      channelType: channelType ?? '1',
      provider: provider ?? '',
      channelConfig: channelConfig ?? '',
      rateLimitQps: rateLimitQps ?? 100,
      rateLimitBurst: rateLimitBurst ?? 200,
      retryTimes: retryTimes ?? 3,
      retryInterval: retryInterval ?? 1000,
      weight: weight ?? WEIGHT_DEFAULT,
      // 故障态（2）不允许通过表单设置，回填时按「启用」处理；
      // enabled 后端是 Integer、JSON 下发为数字，必须 enumDictCodeString 归一后再比
      enabled: enumDictCodeString(enabled) === '0' ? '0' : '1'
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
      ? await fetchUpdateMessageChannel({ id: props.rowData?.id ?? '', ...model.value })
      : await fetchAddMessageChannel(model.value);

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
  <!-- 字段较多（11 个），抽屉加宽到 480 以容纳两列文本域 -->
  <ADrawer v-model:open="visible" :title="title" :width="480">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.message.common.channelCode')" name="channelCode">
        <!--
          channel_code 是业务键：唯一索引 uk_message_channel_code，
          且 `ChannelRouter.route(channelCode)` 按它直接取适配器，编辑态放开可改会静默打断路由。
        -->
        <AInput
          v-model:value="model.channelCode"
          :disabled="isEdit"
          :maxlength="CHANNEL_CODE_MAX"
          show-count
          :placeholder="$t('page.message.channel.form.channelCode')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.message.channel.channelName')" name="channelName">
        <AInput
          v-model:value="model.channelName"
          :maxlength="CHANNEL_NAME_MAX"
          show-count
          :placeholder="$t('page.message.channel.form.channelName')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.message.channel.channelType')" name="channelType">
        <ASelect
          v-model:value="model.channelType"
          :placeholder="$t('page.message.channel.form.channelType')"
          :options="enumDictOptions('message', 'ChannelType')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.message.common.provider')" name="provider">
        <AInput
          v-model:value="model.provider"
          :maxlength="PROVIDER_MAX"
          show-count
          :placeholder="$t('page.message.channel.form.provider')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.message.channel.channelConfig')" name="channelConfig">
        <ATextarea
          v-model:value="model.channelConfig"
          :rows="4"
          :maxlength="CHANNEL_CONFIG_MAX"
          show-count
          :placeholder="$t('page.message.channel.form.channelConfig')"
        />
        <!-- 键名写错时后端只是静默失败，所以把「这个类型实际读哪些键」摊在表单上 -->
        <template #extra>
          <div>{{ channelConfigHint }}</div>
          <pre class="m-0 mt-4px whitespace-pre-wrap text-12px text-gray-400">{{ channelConfigSample }}</pre>
        </template>
      </AFormItem>
      <AFormItem :label="$t('page.message.channel.rateLimitQps')" name="rateLimitQps">
        <AInputNumber v-model:value="model.rateLimitQps" class="w-full" :min="0" />
      </AFormItem>
      <AFormItem :label="$t('page.message.channel.rateLimitBurst')" name="rateLimitBurst">
        <AInputNumber v-model:value="model.rateLimitBurst" class="w-full" :min="0" />
      </AFormItem>
      <AFormItem :label="$t('page.message.channel.retryTimes')" name="retryTimes">
        <AInputNumber v-model:value="model.retryTimes" class="w-full" :min="0" />
      </AFormItem>
      <AFormItem :label="$t('page.message.channel.retryInterval')" name="retryInterval">
        <AInputNumber v-model:value="model.retryInterval" class="w-full" :min="0" />
      </AFormItem>
      <AFormItem
        :label="$t('page.message.channel.weight')"
        name="weight"
        :extra="$t('page.message.channel.weightHint')"
      >
        <AInputNumber v-model:value="model.weight" class="w-full" :min="0" />
      </AFormItem>
      <AFormItem :label="$t('page.message.channel.enabled')" name="enabled">
        <ARadioGroup v-model:value="model.enabled">
          <ARadio v-for="item in channelEnabledFormOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </ARadio>
        </ARadioGroup>
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
