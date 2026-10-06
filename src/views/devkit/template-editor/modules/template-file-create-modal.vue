<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddDevkitTemplateFile } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'DevkitTemplateFileCreateModal'
});

interface Props {
  groupId: string;
  /** 当前打开的文件路径，用于给出同级目录的默认值 */
  currentPath?: string;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const { formRef, validate, resetFields } = useAntdForm();
const { defaultRequiredRule, createMaxLengthRule } = useFormRules();

const submitLoading = ref(false);
const showTemplate = ref(false);

const model = ref<Api.Devkit.TemplateFileCreateParams>({
  groupId: '',
  filePath: '',
  content: '',
  fileType: 1,
  remark: ''
});

const rules = {
  filePath: [defaultRequiredRule, createMaxLengthRule(512)]
};

/** 从当前文件路径推出同级目录，作为新建时的默认前缀 */
const defaultDir = computed(() => {
  const path = props.currentPath ?? '';
  const index = path.lastIndexOf('/');
  return index > 0 ? `${path.slice(0, index)}/` : '';
});

function handleInitModel() {
  model.value = {
    groupId: props.groupId,
    filePath: defaultDir.value ? `${defaultDir.value}new-file.java.ftl` : '',
    content: '',
    fileType: 1,
    remark: ''
  };
  showTemplate.value = false;
}

function closeModal() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const { error } = await fetchAddDevkitTemplateFile({
      ...model.value,
      content: model.value.content ?? ''
    });

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
  <AModal
    v-model:open="visible"
    :title="$t('page.devkit.editor.newFile')"
    :confirm-loading="submitLoading"
    :width="720"
    @ok="handleSubmit"
  >
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem
        :label="$t('page.devkit.editor.filePath')"
        name="filePath"
        :extra="$t('page.devkit.editor.filePathHint')"
      >
        <AInput
          v-model:value="model.filePath"
          :maxlength="512"
          :placeholder="`${defaultDir}src/main/java/pojo/entity/[base][for].java.ftl`"
        />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.template.fileType')" name="fileType">
        <ARadioGroup v-model:value="model.fileType">
          <ARadio :value="1">{{ $t('page.devkit.template.fileTypeTemplate') }}</ARadio>
          <ARadio :value="2">{{ $t('page.devkit.template.fileTypeStatic') }}</ARadio>
        </ARadioGroup>
      </AFormItem>
      <AFormItem :label="$t('page.devkit.editor.initialContent')" name="content">
        <ATextarea v-model:value="model.content" :rows="6" />
      </AFormItem>
    </AForm>
  </AModal>
</template>

<style scoped></style>
