<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useLoading } from '@sa/hooks';
import { loginModuleRecord } from '@/constants/app';
import { fetchLogin } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import { useRouterPush } from '@/hooks/common/router';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'PwdLogin'
});

const authStore = useAuthStore();
const { toggleLoginModule, redirectFromLogin, redirectToIdpAuthorize } = useRouterPush();
const { formRef, validate } = useAntdForm();
const { loading, startLoading, endLoading } = useLoading();
const { formRules } = useFormRules();

interface FormModel {
  userName: string;
  password: string;
  /** S2 租户管理：租户编码（仅 VITE_AUTH_TENANT_ENABLED=true 时展示并提交） */
  tenantCode: string;
  rememberMe: boolean;
}

const model: FormModel = reactive({
  userName: '',
  password: '',
  tenantCode: '',
  rememberMe: false
});

/** 是否展示租户编码输入（需与后端 carlos.auth.tenant.enabled 同步开启） */
const tenantEnabled = import.meta.env.VITE_AUTH_TENANT_ENABLED === 'true';

/** 输入期硬上限（账号/租户编码）；密码不加 maxlength，由 REG_PWD 规则（6-18 位）校验期拦截 */
const USER_NAME_MAX = 64;
const TENANT_CODE_MAX = 64;

const rules = computed<Record<keyof FormModel, App.Global.FormRule[]>>(() => ({
  userName: formRules.userName,
  password: formRules.pwd,
  tenantCode: tenantEnabled
    ? [{ required: true, message: $t('page.login.pwdLogin.tenantCodeRequired'), trigger: 'blur' }]
    : [],
  rememberMe: []
}));

/**
 * 用户名校验失焦时触发风控预检
 *
 * <p>调用后端 /auth/user/pre-check，风控评估结果存入 authStore.preCheckResult，
 * 后续登录时后端会根据风控分数决定是否需要验证码或 MFA 挑战。</p>
 */
async function handleUserNameBlur() {
  if (!model.userName.trim()) return;
  await authStore.preCheck(model.userName);
}

/**
 * 提交登录表单
 *
 * <p>登录流程：</p>
 * <ol>
 *   <li>表单校验</li>
 *   <li>调用 fetchLogin（内部处理 SM2 公钥获取 + 密码加密 + POST 请求）</li>
 *   <li>判断是否需要 MFA：若 mfaRequired=true，设置 authStore 的 MFA 状态触发弹窗</li>
 *   <li>不需要 MFA 则直接存储 Token、获取用户信息、跳转业务页</li>
 * </ol>
 */
async function handleSubmit() {
  await validate();

  startLoading();

  try {
    const { data, error } = await fetchLogin(model.userName, model.password, model.tenantCode);

    if (error || !data) {
      // 错误消息由 request 拦截器统一处理，此处不额外弹窗
      return;
    }

    // 分支 A：需要 MFA step-up 验证
    if (data.mfaRequired) {
      authStore.mfaRequired = true;
      authStore.mfaToken = data.mfaToken || '';
      return;
    }

    // 分支 B：直接登录成功
    const pass = await authStore.loginByToken(data);

    if (pass) {
      window.$notification?.success({
        message: $t('page.login.common.loginSuccess'),
        description: $t('page.login.common.welcomeBack', { userName: model.userName })
      });

      await redirectFromLogin(true);
    } else {
      window.$message?.error($t('common.error'));
    }
  } catch {
    // 网络异常等，由 request 拦截器处理
  } finally {
    endLoading();
  }
}

/**
 * SSO 统一认证登录：重定向到 IdP /oauth2/authorize
 *
 * <p>与普通登录的区别：</p>
 * <ul>
 *   <li>不在 SPA 内收集、传输密码</li>
 *   <li>浏览器 302 重定向到 carlos-auth 的 IdP 统一登录页</li>
 *   <li>登录成功后 IdP 种 Session Cookie，实现跨系统 SSO</li>
 *   <li>回调 /oauth2/callback 后换取 Token</li>
 * </ul>
 */
function handleSsoLogin() {
  redirectToIdpAuthorize();
}
</script>

<template>
  <AForm ref="formRef" :model="model" :rules="rules">
    <AFormItem name="userName">
      <AInput
        v-model:value="model.userName"
        size="large"
        :maxlength="USER_NAME_MAX"
        :placeholder="$t('page.login.common.userNamePlaceholder')"
        @blur="handleUserNameBlur"
      />
    </AFormItem>

    <AFormItem name="password">
      <AInputPassword
        v-model:value="model.password"
        size="large"
        :placeholder="$t('page.login.common.passwordPlaceholder')"
        @press-enter="handleSubmit"
      />
    </AFormItem>

    <AFormItem v-if="tenantEnabled" name="tenantCode">
      <AInput
        v-model:value="model.tenantCode"
        size="large"
        :maxlength="TENANT_CODE_MAX"
        :placeholder="$t('page.login.pwdLogin.tenantCodePlaceholder')"
        @press-enter="handleSubmit"
      />
    </AFormItem>

    <div class="mb-16px flex-y-center justify-between">
      <ACheckbox v-model:checked="model.rememberMe">
        {{ $t('page.login.pwdLogin.rememberMe') }}
      </ACheckbox>
      <AButton type="link" @click="toggleLoginModule('reset-pwd')">
        {{ $t('page.login.pwdLogin.forgetPassword') }}
      </AButton>
    </div>

    <ASpace direction="vertical" size="large" class="w-full">
      <AButton type="primary" block size="large" shape="round" :loading="loading" @click="handleSubmit">
        {{ $t('common.confirm') }}
      </AButton>

      <ADivider>
        <span class="text-12px text-#999">{{ $t('page.login.pwdLogin.otherLoginMode') }}</span>
      </ADivider>

      <AButton block size="large" shape="round" @click="handleSsoLogin">
        {{ $t('page.login.pwdLogin.ssoLogin') }}
      </AButton>

      <div class="flex-y-center justify-between">
        <AButton class="h-34px flex-1" block @click="toggleLoginModule('code-login')">
          {{ $t(loginModuleRecord['code-login']) }}
        </AButton>
        <div class="w-12px"></div>
        <AButton class="h-34px flex-1" block @click="toggleLoginModule('register')">
          {{ $t(loginModuleRecord.register) }}
        </AButton>
      </div>
    </ASpace>
  </AForm>
</template>

<style scoped></style>
