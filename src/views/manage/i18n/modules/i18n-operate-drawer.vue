<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddI18nMessage, fetchUpdateI18nMessage } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'I18nOperateDrawer'
});

interface Props {
  /** 语言（后端格式：zh_CN / en_US） */
  lang: Api.SystemManage.I18nLang;
  /** 消息键 */
  msgKey: string;
  /** 前端语言文件里的基线值，只读参考 */
  baseline: string;
  /** 已有覆盖行的 id；为空表示尚未覆盖 */
  overrideId?: string;
  /** 已有覆盖值 */
  overrideValue?: string;
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
const { defaultRequiredRule } = useFormRules();

const submitLoading = ref(false);
const isOverridden = computed(() => Boolean(props.overrideId));

const title = computed(() =>
  isOverridden.value ? $t('page.manage.i18n.editOverride') : $t('page.manage.i18n.setOverride')
);

const model = ref({ msgValue: '' });

const rules: Record<'msgValue', App.Global.FormRule> = {
  msgValue: defaultRequiredRule
};

function handleInitModel() {
  model.value = { msgValue: props.overrideValue ?? props.baseline ?? '' };
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    // 基线值来自前端语言文件、不落库；这里只写覆盖行。
    // moduleId 一律为 null —— 覆盖模型下唯一性是 (lang, msgKey)，不需要模块参与
    const payload = {
      lang: props.lang,
      moduleId: null,
      msgKey: props.msgKey,
      msgValue: model.value.msgValue,
      msgStatus: true
    };

    const { error } = props.overrideId
      ? await fetchUpdateI18nMessage({ ...payload, id: props.overrideId })
      : await fetchAddI18nMessage(payload);

    if (error) {
      window.$message?.error?.($t('common.updateFailed'));
      return;
    }

    window.$message?.success?.($t('common.updateSuccess'));
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
  <ADrawer v-model:open="visible" :title="title" :width="480">
    <AForm ref="formRef" :model="model" :rules="rules" layout="vertical">
      <AFormItem :label="$t('page.manage.i18n.msgKey')">
        <AInput :value="props.msgKey" disabled />
      </AFormItem>

      <AFormItem :label="$t('page.manage.i18n.baseline')">
        <ATextarea :value="props.baseline" :rows="2" disabled />
      </AFormItem>

      <AFormItem :label="$t('page.manage.i18n.overrideValue')" name="msgValue">
        <ATextarea v-model:value="model.msgValue" :rows="3" :placeholder="$t('page.manage.i18n.form.overrideValue')" />
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
