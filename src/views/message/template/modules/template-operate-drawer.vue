<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddMessageTemplate, fetchGetMessageTypeList, fetchUpdateMessageTemplate } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'TemplateOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.Message.MessageTemplate | null;
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
 * 列宽取自 `carlos-message/docs/02-design/database/message_postgresql.sql`
 * 的 `message_template`（已用线上库的 information_schema 复核过）。
 *
 * content_template 是 TEXT、param_schema / channel_config 是 jsonb，库里都不限长；
 * 这里仍给输入期一个宽松的硬上限（2000），挡住误粘贴的超长内容。
 */
const TEMPLATE_CODE_MAX = 50;
const TEMPLATE_NAME_MAX = 50;
const TITLE_TEMPLATE_MAX = 100;
const CONTENT_TEMPLATE_MAX = 2000;
const JSON_CONFIG_MAX = 2000;

/** 所属类型下拉项，打开抽屉时拉取 */
const typeOptions = ref<CommonType.Option<string>[]>([]);

async function getTypeOptions() {
  const { error, data } = await fetchGetMessageTypeList({ current: 1, size: 200 });

  if (error) {
    return;
  }

  typeOptions.value = data.records.map(item => ({
    label: item.typeName,
    value: item.id
  }));
}

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.message.template.addTemplate'),
    edit: $t('page.message.template.editTemplate')
  };
  return titles[props.operateType];
});

type Model = Required<Api.Message.TemplateOperateParams>;

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    typeId: '',
    templateCode: '',
    templateName: '',
    titleTemplate: '',
    contentTemplate: '',
    paramSchema: '',
    channelConfig: '',
    /**
     * ⚠️ 必须是 `false`（草稿态）
     *
     * 库里 `is_enabled BOOLEAN NOT NULL DEFAULT FALSE`，而列表页把 `enabled` 当作
     * **发布态**经营：未启用的行才显示「发布」按钮，且点它要先过 Popconfirm
     * （后端另有专用的 `/message/template/publish` 端点）。
     * 原先这里填 `true`，于是「新增 → 保存」出来就是已发布状态，
     * **用户从头到尾没见过那次发布确认**，列表里也只有「禁用」按钮。
     */
    enabled: false
  };
}

type RuleKey = Extract<
  keyof Model,
  'typeId' | 'templateCode' | 'templateName' | 'titleTemplate' | 'contentTemplate' | 'paramSchema' | 'channelConfig'
>;

/** paramSchema / channelConfig 落库为 jsonb，非法 JSON 会在后端解析失败 */
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
  typeId: defaultRequiredRule,
  // templateCode 是业务键（编辑态锁定），除长度外再卡一道业务编码格式
  templateCode: [defaultRequiredRule, patternRules.bizCode, createMaxLengthRule(TEMPLATE_CODE_MAX)],
  templateName: [defaultRequiredRule, createMaxLengthRule(TEMPLATE_NAME_MAX)],
  titleTemplate: createMaxLengthRule(TITLE_TEMPLATE_MAX),
  contentTemplate: [defaultRequiredRule, createMaxLengthRule(CONTENT_TEMPLATE_MAX)],
  paramSchema: [createMaxLengthRule(JSON_CONFIG_MAX), jsonRule],
  channelConfig: [createMaxLengthRule(JSON_CONFIG_MAX), jsonRule]
};

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { typeId, templateCode, templateName, titleTemplate, contentTemplate, paramSchema, channelConfig, enabled } =
      props.rowData;

    // 显式挑选字段，避免把 id / createBy 等公共字段一并回传
    model.value = {
      typeId: typeId ?? '',
      templateCode: templateCode ?? '',
      templateName: templateName ?? '',
      titleTemplate: titleTemplate ?? '',
      contentTemplate: contentTemplate ?? '',
      paramSchema: paramSchema ?? '',
      channelConfig: channelConfig ?? '',
      // 字段缺失按「未发布」处理：宁可让用户多点一次发布，也不要悄悄发布一条模板
      enabled: enabled ?? false
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
      ? await fetchUpdateMessageTemplate({ id: props.rowData?.id ?? '', ...model.value })
      : await fetchAddMessageTemplate(model.value);

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
    getTypeOptions();
  }
});
</script>

<template>
  <!-- 字段较多且含两个 JSON 文本域，抽屉加宽到 560 -->
  <ADrawer v-model:open="visible" :title="title" :width="560">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.message.template.typeId')" name="typeId">
        <ASelect
          v-model:value="model.typeId"
          :placeholder="$t('page.message.template.form.typeId')"
          :options="typeOptions"
        />
      </AFormItem>
      <AFormItem :label="$t('page.message.common.templateCode')" name="templateCode">
        <!--
          template_code 是业务键：唯一索引 uk_message_template_code，
          且 `fetchGetMessageTemplateByCode` 等按码引用它，编辑态放开可改会静默打断这些引用。
        -->
        <AInput
          v-model:value="model.templateCode"
          :disabled="isEdit"
          :maxlength="TEMPLATE_CODE_MAX"
          show-count
          :placeholder="$t('page.message.template.form.templateCode')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.message.template.templateName')" name="templateName">
        <AInput
          v-model:value="model.templateName"
          :maxlength="TEMPLATE_NAME_MAX"
          show-count
          :placeholder="$t('page.message.template.form.templateName')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.message.template.titleTemplate')" name="titleTemplate">
        <AInput
          v-model:value="model.titleTemplate"
          :maxlength="TITLE_TEMPLATE_MAX"
          show-count
          :placeholder="$t('page.message.template.form.titleTemplate')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.message.template.contentTemplate')" name="contentTemplate">
        <ATextarea
          v-model:value="model.contentTemplate"
          :rows="4"
          :maxlength="CONTENT_TEMPLATE_MAX"
          show-count
          :placeholder="$t('page.message.template.form.contentTemplate')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.message.template.paramSchema')" name="paramSchema">
        <ATextarea
          v-model:value="model.paramSchema"
          :rows="3"
          :maxlength="JSON_CONFIG_MAX"
          show-count
          :placeholder="$t('page.message.template.form.paramSchema')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.message.template.channelConfig')" name="channelConfig">
        <ATextarea
          v-model:value="model.channelConfig"
          :rows="3"
          :maxlength="JSON_CONFIG_MAX"
          show-count
          :placeholder="$t('page.message.template.form.channelConfig')"
        />
      </AFormItem>
      <AFormItem
        :label="$t('page.message.template.enabled')"
        name="enabled"
        :extra="$t('page.message.template.enabledHint')"
      >
        <ASwitch v-model:checked="model.enabled" />
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
