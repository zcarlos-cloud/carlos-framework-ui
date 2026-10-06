<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddDictItem, fetchUpdateDictItem } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'DictItemOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.SystemManage.DictItem | null;
  dictId: string;
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

/** 列宽取自 system_postgresql.sql：item_name / item_code 是 VARCHAR(100)、description VARCHAR(500) */
const ITEM_NAME_MAX = 100;
const ITEM_CODE_MAX = 100;
const ITEM_DESC_MAX = 500;

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.dict.addDictItem'),
    edit: $t('page.manage.dict.editDictItem')
  };
  return titles[props.operateType];
});

type Model = Pick<Api.SystemManage.DictItem, 'itemName' | 'itemCode' | 'orderNum' | 'description' | 'enable'>;

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    itemName: '',
    itemCode: '',
    orderNum: 0,
    description: '',
    enable: true
  };
}

type RuleKey = Extract<keyof Model, 'itemName' | 'itemCode' | 'description'>;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  itemName: [defaultRequiredRule, createMaxLengthRule(ITEM_NAME_MAX)],
  itemCode: [defaultRequiredRule, createMaxLengthRule(ITEM_CODE_MAX)],
  description: [createMaxLengthRule(ITEM_DESC_MAX)]
};

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { itemName, itemCode, orderNum, description, enable } = props.rowData;

    // 显式挑选字段，避免把 id / dictId / createBy 等公共字段一并回传
    model.value = {
      itemName: itemName ?? '',
      itemCode: itemCode ?? '',
      orderNum: orderNum ?? 0,
      description: description ?? '',
      enable: enable ?? true
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
    // dictId 由父级抽屉透传，不属于表单字段，提交时单独带上
    const { error } = isEdit.value
      ? await fetchUpdateDictItem({ id: props.rowData?.id ?? '', dictId: props.dictId, ...model.value })
      : await fetchAddDictItem({ dictId: props.dictId, ...model.value });

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
      <AFormItem :label="$t('page.manage.dict.itemName')" name="itemName">
        <AInput
          v-model:value="model.itemName"
          :maxlength="ITEM_NAME_MAX"
          show-count
          :placeholder="$t('page.manage.dict.form.itemName')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.dict.itemCode')" name="itemCode">
        <!-- itemCode 是字典项的业务键（业务代码按它取值），编辑态放开可改会静默打断引用方 -->
        <AInput
          v-model:value="model.itemCode"
          :disabled="isEdit"
          :maxlength="ITEM_CODE_MAX"
          show-count
          :placeholder="$t('page.manage.dict.form.itemCode')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.dict.orderNum')" name="orderNum">
        <!-- 原先没有 :min，排序号可以填负数 -->
        <AInputNumber
          v-model:value="model.orderNum"
          class="w-full"
          :min="0"
          :precision="0"
          :placeholder="$t('page.manage.dict.form.orderNum')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.common.statusTitle')" name="enable">
        <ARadioGroup v-model:value="model.enable">
          <ARadio :value="true">{{ $t('page.manage.common.status.enable') }}</ARadio>
          <ARadio :value="false">{{ $t('page.manage.common.status.disable') }}</ARadio>
        </ARadioGroup>
      </AFormItem>

      <AFormItem :label="$t('page.manage.dict.description')" name="description">
        <ATextarea
          v-model:value="model.description"
          :maxlength="ITEM_DESC_MAX"
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
