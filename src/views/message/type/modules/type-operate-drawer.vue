<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddMessageType, fetchUpdateMessageType } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'TypeOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.Message.MessageType | null;
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
 * 的 `message_type`（已用线上库的 information_schema 复核过）。
 * 后端 `MessageTypeCreateParam` 一个 `@Size` 都没有，超长只能拿到「新增失败」。
 */
const TYPE_CODE_MAX = 32;
const TYPE_NAME_MAX = 32;

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.message.type.addType'),
    edit: $t('page.message.type.editType')
  };
  return titles[props.operateType];
});

type Model = Pick<Api.Message.MessageType, 'typeCode' | 'typeName' | 'enabled'>;

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    typeCode: '',
    typeName: '',
    enabled: true
  };
}

type RuleKey = Extract<keyof Model, 'typeCode' | 'typeName'>;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  // typeCode 是业务键（编辑态锁定），除长度外再卡一道业务编码格式
  typeCode: [defaultRequiredRule, patternRules.bizCode, createMaxLengthRule(TYPE_CODE_MAX)],
  typeName: [defaultRequiredRule, createMaxLengthRule(TYPE_NAME_MAX)]
};

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { typeCode, typeName, enabled } = props.rowData;

    // 显式挑选字段，避免把 id / createBy 等公共字段一并回传
    model.value = {
      typeCode: typeCode ?? '',
      typeName: typeName ?? '',
      enabled: enabled ?? true
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
      ? await fetchUpdateMessageType({ id: props.rowData?.id ?? '', ...model.value })
      : await fetchAddMessageType(model.value);

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
  <ADrawer v-model:open="visible" :title="title" :width="360">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.message.type.typeCode')" name="typeCode">
        <!--
          type_code 是业务键：唯一索引 uk_message_type_code，
          且消息模板按它关联（`message_type.type_code` → `message_template.type_id`），
          编辑态放开可改会静默打断这些引用。
        -->
        <AInput
          v-model:value="model.typeCode"
          :disabled="isEdit"
          :maxlength="TYPE_CODE_MAX"
          show-count
          :placeholder="$t('page.message.type.form.typeCode')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.message.type.typeName')" name="typeName">
        <AInput
          v-model:value="model.typeName"
          :maxlength="TYPE_NAME_MAX"
          show-count
          :placeholder="$t('page.message.type.form.typeName')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.message.type.enabled')" name="enabled">
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
