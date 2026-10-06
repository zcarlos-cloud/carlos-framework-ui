<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { $t } from '@/locales';

defineOptions({
  name: 'MonitorConfirmDangerModal'
});

/**
 * 高危操作二次确认弹窗
 *
 * 流程：打开 → 调 issueToken 签发 confirm-token（60s 一次性）→
 * 用户输入确认文本（可选）→ 点确认调 submit(token) 携带 X-Confirm-Token 提交。
 */

interface Props {
  /** 弹窗标题 */
  title: string;
  /** 操作内容摘要（展示给用户确认） */
  description: string;
  /** 需要用户输入的确认文本（如实例名/key 数量）；为空则不要求输入 */
  confirmText?: string;
  /** 签发确认令牌；返回 null 表示签发失败 */
  issueToken: () => Promise<string | null>;
  /** 携带令牌提交；返回 true 表示成功（成功后弹窗自动关闭并 emit submitted） */
  submit: (token: string) => Promise<boolean>;
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: ''
});

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const issuing = ref(false);
const submitting = ref(false);
const token = ref<string | null>(null);
const inputValue = ref('');

const canSubmit = computed(() => {
  if (!token.value) {
    return false;
  }
  if (props.confirmText) {
    return inputValue.value === props.confirmText;
  }
  return true;
});

async function issue() {
  issuing.value = true;
  token.value = null;
  try {
    token.value = await props.issueToken();
  } finally {
    issuing.value = false;
  }
}

async function handleOk() {
  if (!token.value || !canSubmit.value) {
    return;
  }
  submitting.value = true;
  try {
    const success = await props.submit(token.value);
    if (success) {
      visible.value = false;
      emit('submitted');
    }
  } finally {
    submitting.value = false;
  }
}

function handleCancel() {
  visible.value = false;
}

watch(visible, val => {
  if (val) {
    inputValue.value = '';
    issue();
  }
});
</script>

<template>
  <AModal v-model:open="visible" :title="title" :width="480" :mask-closable="false" @cancel="handleCancel">
    <ASpin :spinning="issuing">
      <AAlert type="error" show-icon class="mb-16px">
        <template #message>{{ $t('page.manage.monitor.danger.warning') }}</template>
        <template #description>{{ description }}</template>
      </AAlert>
      <template v-if="confirmText">
        <div class="mb-8px">
          {{ $t('page.manage.monitor.danger.typeToConfirm', { text: confirmText }) }}
        </div>
        <AInput v-model:value="inputValue" :placeholder="confirmText" />
      </template>
      <div v-if="!issuing && !token" class="mt-8px text-#ff4d4f">
        {{ $t('page.manage.monitor.danger.tokenFailed') }}
      </div>
    </ASpin>
    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="handleCancel">{{ $t('common.cancel') }}</AButton>
        <AButton danger type="primary" :loading="submitting" :disabled="!canSubmit" @click="handleOk">
          {{ $t('page.manage.monitor.danger.execute') }}
        </AButton>
      </div>
    </template>
  </AModal>
</template>

<style scoped></style>
