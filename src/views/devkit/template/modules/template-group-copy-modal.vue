<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchCopyDevkitTemplateGroup } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'DevkitTemplateGroupCopyModal'
});

interface Props {
  /** 被复制的模板组 */
  rowData?: Api.Devkit.TemplateGroup | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const { formRef, validate, resetFields } = useAntdForm();
const { defaultRequiredRule, patternRules, createMaxLengthRule } = useFormRules();

const submitLoading = ref(false);

const model = ref<Api.Devkit.TemplateGroupCopyParams>({
  id: '',
  newGroupCode: '',
  newGroupName: '',
  copyFiles: true
});

const rules = {
  newGroupCode: [defaultRequiredRule, patternRules.bizCode, createMaxLengthRule(64)],
  newGroupName: [defaultRequiredRule, createMaxLengthRule(128)]
};

const title = computed(() => $t('page.devkit.template.copyTitle', { name: props.rowData?.groupName ?? '' }));

function handleInitModel() {
  model.value = {
    id: props.rowData?.id ?? '',
    // 默认给一个不会撞唯一索引的编码，用户可改
    newGroupCode: props.rowData ? `${props.rowData.groupCode}-copy` : '',
    newGroupName: props.rowData ? $t('page.devkit.template.copySuffix', { name: props.rowData.groupName }) : '',
    copyFiles: true
  };
}

function closeModal() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const { error } = await fetchCopyDevkitTemplateGroup(model.value);

    if (error) {
      window.$message?.error?.($t('common.addFailed'));
      return;
    }

    window.$message?.success?.($t('common.addSuccess'));
    closeModal();
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
  <AModal v-model:open="visible" :title="title" :confirm-loading="submitLoading" @ok="handleSubmit">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules" class="pt-8px">
      <AFormItem :label="$t('page.devkit.template.newGroupCode')" name="newGroupCode">
        <AInput v-model:value="model.newGroupCode" :maxlength="64" />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.template.newGroupName')" name="newGroupName">
        <AInput v-model:value="model.newGroupName" :maxlength="128" />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.template.copyFiles')" name="copyFiles">
        <ASwitch v-model:checked="model.copyFiles" />
      </AFormItem>
    </AForm>
  </AModal>
</template>

<style scoped></style>
