<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { dictTypeOptions } from '@/constants/business';
import { fetchAddDict, fetchUpdateDict } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'DictOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.SystemManage.Dict | null;
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

/** 列宽取自 system_postgresql.sql：dict_name / dict_code 是 VARCHAR(100)、description VARCHAR(500) */
const DICT_CODE_MAX = 100;
const DICT_NAME_MAX = 100;
const DICT_DESC_MAX = 500;

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.dict.addDict'),
    edit: $t('page.manage.dict.editDict')
  };
  return titles[props.operateType];
});

type Model = Pick<Api.SystemManage.Dict, 'dictCode' | 'dictName' | 'type' | 'description'>;

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    dictCode: '',
    dictName: '',
    type: 'STRING',
    description: ''
  };
}

type RuleKey = Extract<keyof Model, 'dictCode' | 'dictName' | 'type' | 'description'>;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  dictCode: [defaultRequiredRule, createMaxLengthRule(DICT_CODE_MAX)],
  dictName: [defaultRequiredRule, createMaxLengthRule(DICT_NAME_MAX)],
  type: [defaultRequiredRule],
  description: [createMaxLengthRule(DICT_DESC_MAX)]
};

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { dictCode, dictName, type, description } = props.rowData;

    // 显式挑选字段，避免把 id / createBy / createTime 等公共字段一并回传
    model.value = {
      dictCode: dictCode ?? '',
      dictName: dictName ?? '',
      type: type ?? 'STRING',
      description: description ?? ''
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
      ? await fetchUpdateDict({ id: props.rowData?.id ?? '', ...model.value })
      : await fetchAddDict(model.value);

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
    <AForm ref="formRef" :model="model" :rules="rules" layout="vertical">
      <AFormItem :label="$t('page.manage.dict.dictCode')" name="dictCode">
        <!--
          dictCode 是业务键：业务代码按它取字典（fetchGetDictFullList(name) / fetchGetDictSelect(code)），
          编辑态放开可改会让所有引用方失联
        -->
        <AInput
          v-model:value="model.dictCode"
          :disabled="isEdit"
          :maxlength="DICT_CODE_MAX"
          show-count
          :placeholder="$t('page.manage.dict.form.dictCode')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.dict.dictName')" name="dictName">
        <AInput
          v-model:value="model.dictName"
          :maxlength="DICT_NAME_MAX"
          show-count
          :placeholder="$t('page.manage.dict.form.dictName')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.dict.dictType')" name="type">
        <ARadioGroup v-model:value="model.type">
          <ARadio v-for="item in dictTypeOptions" :key="item.value" :value="item.value">
            {{ $t(item.label) }}
          </ARadio>
        </ARadioGroup>
      </AFormItem>

      <AFormItem :label="$t('page.manage.dict.description')" name="description">
        <ATextarea
          v-model:value="model.description"
          :maxlength="DICT_DESC_MAX"
          :rows="3"
          show-count
          :placeholder="$t('page.manage.dict.form.description')"
        />
      </AFormItem>
    </AForm>
    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" @click="handleSubmit">{{ $t('common.confirm') }}</AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
