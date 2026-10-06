<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchResetUserPassword } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'UserResetPwdDrawer'
});

interface Props {
  /** 目标用户 id */
  userId: string;
  /** 目标用户账号，仅用于提示「正在为谁重置」 */
  account?: string;
}

const props = defineProps<Props>();

interface Emits {
  /** 重置成功，调用方据此刷新列表 */
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { formRef, validate, clearValidate } = useAntdForm();
const { defaultRequiredRule, createPasswordComplexityRule, createConfirmPwdRule } = useFormRules();

const submitting = ref(false);

interface Model {
  newPwd: string;
  confirmPwd: string;
}

function createDefaultModel(): Model {
  return { newPwd: '', confirmPwd: '' };
}

const model = ref(createDefaultModel());

const rules = computed<Record<keyof Model, App.Global.FormRule[]>>(() => ({
  // 与后端 OrgUserService.resetPassword 的 checkPasswordComplexity 同源，
  // 保证「前端放行 → 后端也放行」，而不是提交后才收到一句笼统的复杂度报错
  newPwd: [defaultRequiredRule, createPasswordComplexityRule($t('page.organization.user.passwordRule'))],
  confirmPwd: createConfirmPwdRule(computed(() => model.value.newPwd))
}));

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitting.value = true;

  try {
    // 后端直接按明文使用 newPwd 并自行 encode，前端不要做任何加密
    const { error } = await fetchResetUserPassword(props.userId, model.value.newPwd);

    if (error) {
      // 请求层已弹过提示，此处不得重复
      return;
    }

    window.$message?.success?.($t('page.organization.user.resetPwdSuccess'));
    closeDrawer();
    emit('submitted');
  } finally {
    submitting.value = false;
  }
}

watch(visible, () => {
  if (visible.value) {
    model.value = createDefaultModel();
    // 用 clearValidate 而不是 resetFields：后者会把「挂载时」的字段快照写回 model，
    // 本组件常驻、挂载时 model 还是空的，resetFields 会与上面刚重置的 model 打架
    clearValidate();
  }
});
</script>

<template>
  <ADrawer v-model:open="visible" :title="$t('page.organization.user.resetPassword')" :width="360">
    <AAlert
      v-if="account"
      type="warning"
      show-icon
      class="mb-16px"
      :message="$t('page.organization.user.resetPwdFor', { account })"
    />
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.organization.user.newPassword')" name="newPwd">
        <AInputPassword v-model:value="model.newPwd" autocomplete="new-password" />
      </AFormItem>
      <AFormItem :label="$t('page.organization.user.confirmPassword')" name="confirmPwd">
        <AInputPassword v-model:value="model.confirmPwd" autocomplete="new-password" />
      </AFormItem>
    </AForm>
    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitting" @click="handleSubmit">{{ $t('common.confirm') }}</AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
