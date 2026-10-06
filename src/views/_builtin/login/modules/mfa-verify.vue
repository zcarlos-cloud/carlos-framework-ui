<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { $t } from '@/locales';

defineOptions({
  name: 'MfaVerify'
});

const authStore = useAuthStore();
const code = ref('');
const trustDevice = ref(false);

async function handleVerify() {
  if (!code.value || code.value.length < 6) {
    window.$message?.warning($t('page.login.mfa.codeRequired'));
    return;
  }
  await authStore.verifyMfa(code.value, trustDevice.value);
}

function handleCancel() {
  authStore.resetStore();
}
</script>

<template>
  <AModal
    :open="authStore.mfaRequired"
    :title="$t('page.login.mfa.title')"
    :closable="true"
    :mask-closable="false"
    :footer="null"
    width="380px"
    @cancel="handleCancel"
  >
    <div class="mfa-content">
      <p class="mfa-desc">{{ $t('page.login.mfa.desc') }}</p>
      <AInput
        v-model:value="code"
        :placeholder="$t('page.login.mfa.codePlaceholder')"
        :maxlength="8"
        size="large"
        allow-clear
        class="mfa-input"
        @press-enter="handleVerify"
      />
      <ACheckbox v-model:checked="trustDevice" class="mfa-trust">{{ $t('page.login.mfa.trustDevice') }}</ACheckbox>
      <AButton
        type="primary"
        block
        size="large"
        :loading="authStore.loginLoading"
        class="mfa-btn"
        @click="handleVerify"
      >
        {{ $t('page.login.mfa.verify') }}
      </AButton>
      <p class="mfa-hint">{{ $t('page.login.mfa.hint') }}</p>
    </div>
  </AModal>
</template>

<style scoped>
.mfa-content {
  padding: 8px 0;
}

.mfa-desc {
  color: #666;
  font-size: 14px;
  margin-bottom: 20px;
  line-height: 1.6;
}

.mfa-input {
  margin-bottom: 12px;
}

.mfa-trust {
  margin-bottom: 20px;
}

.mfa-btn {
  margin-bottom: 12px;
}

.mfa-hint {
  text-align: center;
  color: #999;
  font-size: 12px;
}
</style>
