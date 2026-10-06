<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchChangeUserPassword } from '@/service/api';
import { countPasswordCharClasses, useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'UserPassword'
});

interface Props {
  /** 当前登录用户 id（后端按入参 id 定位用户并校验旧密码） */
  userId: string;
}

const props = defineProps<Props>();

const { formRef, validate, resetFields } = useAntdForm();
const { defaultRequiredRule, createConfirmPwdRule, createPasswordComplexityRule } = useFormRules();

const submitting = ref(false);

interface Model {
  oldPwd: string;
  newPwd: string;
  confirmPwd: string;
}

function createDefaultModel(): Model {
  return {
    oldPwd: '',
    newPwd: '',
    confirmPwd: ''
  };
}

const model = ref(createDefaultModel());

/** 统计命中的字符类别数与「是否够复杂」都由 hooks/common/form 提供（与后端同源，勿在此另写一份） */

type Strength = 'weak' | 'medium' | 'strong';

const strength = computed<Strength | null>(() => {
  const { newPwd } = model.value;

  if (!newPwd) {
    return null;
  }

  const classes = countPasswordCharClasses(newPwd);

  if (newPwd.length < 8 || classes <= 1) {
    return 'weak';
  }

  return classes === 4 && newPwd.length >= 12 ? 'strong' : 'medium';
});

/**
 * 强度条的展示参数
 *
 * 用 antd Progress 的 status 表达强弱，而不是自己拼一条带色块的 div：
 * 主题色是运行时 CSS 变量（--error-color 等），UNO 里并没有 `bg-fill` 这类中性色，
 * 手写色块既拿不到主题色也漏掉暗色适配。
 */
const strengthMeta = computed<Record<Strength, { percent: number; status: 'exception' | 'normal' | 'success' }>>(
  () => ({
    weak: { percent: 33, status: 'exception' },
    medium: { percent: 66, status: 'normal' },
    strong: { percent: 100, status: 'success' }
  })
);

const rules = computed<Record<'oldPwd' | 'newPwd' | 'confirmPwd', App.Global.FormRule[]>>(() => ({
  oldPwd: [defaultRequiredRule],
  newPwd: [defaultRequiredRule, createPasswordComplexityRule($t('page.userCenter.passwordRule'))],
  // 传 ComputedRef：校验器在验证时才取新密码的当前值，避免「先填确认、再改新密码」漏判
  confirmPwd: createConfirmPwdRule(computed(() => model.value.newPwd))
}));

/**
 * 先填「确认密码」、再回头改「新密码」时，confirmPwd 的校验不会自动重跑，
 * 旧的「两次输入不一致」红字会一直挂着。这里在新密码变化时主动重校验确认框。
 *
 * 不用 async-validator 的 dependencies —— 它不在 ant-design-vue 的 Rule 类型里（会挂类型检查），
 * 语义也是「依赖字段有值时才校验」，与这里的诉求不同。
 */
watch(
  () => model.value.newPwd,
  () => {
    if (model.value.confirmPwd) {
      formRef.value?.validateFields('confirmPwd').catch(() => undefined);
    }
  }
);

async function handleSubmit() {
  await validate();

  if (!props.userId) {
    return;
  }

  submitting.value = true;
  try {
    // 明文提交：后端 OrgUserService.changePassword 直接做 matches/encode，
    // carlos-org 内无任何解密逻辑（详见 service 层 fetchChangeUserPassword 注释）。
    // 此处**不要**接入 SM2 —— 加密后必然报「旧密码不正确」。
    const { error } = await fetchChangeUserPassword({
      id: props.userId,
      oldPwd: model.value.oldPwd,
      newPwd: model.value.newPwd,
      confirmPwd: model.value.confirmPwd
    });

    if (error) {
      // 旧密码错误 / 复杂度不达标等具体原因由后端 msg 下发，请求层已统一弹出
      return;
    }

    window.$message?.success?.($t('page.userCenter.passwordChanged'));
    model.value = createDefaultModel();
    resetFields();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AForm ref="formRef" :model="model" :rules="rules" layout="vertical" class="max-w-480px">
    <AFormItem :label="$t('page.userCenter.oldPassword')" name="oldPwd">
      <AInputPassword
        v-model:value="model.oldPwd"
        autocomplete="current-password"
        :placeholder="$t('page.userCenter.form.oldPassword')"
      />
    </AFormItem>

    <AFormItem :label="$t('page.userCenter.newPassword')" name="newPwd">
      <AInputPassword
        v-model:value="model.newPwd"
        autocomplete="new-password"
        :placeholder="$t('page.userCenter.form.newPassword')"
      />
      <div v-if="strength" class="mt-8px flex-y-center gap-8px">
        <AProgress
          :percent="strengthMeta[strength].percent"
          :status="strengthMeta[strength].status"
          :show-info="false"
          :stroke-width="8"
          class="w-120px"
        />
        <span class="text-12px text-gray-500">{{ $t(`page.userCenter.strength.${strength}`) }}</span>
      </div>
      <div class="mt-4px text-12px text-gray-500">{{ $t('page.userCenter.passwordRule') }}</div>
    </AFormItem>

    <AFormItem :label="$t('page.userCenter.confirmPassword')" name="confirmPwd">
      <AInputPassword
        v-model:value="model.confirmPwd"
        autocomplete="new-password"
        :placeholder="$t('page.userCenter.form.confirmPassword')"
      />
    </AFormItem>

    <AFormItem>
      <AButton type="primary" :loading="submitting" @click="handleSubmit">
        {{ $t('common.confirm') }}
      </AButton>
    </AFormItem>
  </AForm>
</template>

<style scoped></style>
