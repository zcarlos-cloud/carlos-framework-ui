import type { ComputedRef, Ref } from 'vue';
import { ref, toValue } from 'vue';
import type { FormInstance } from 'ant-design-vue';
import {
  REG_BIZ_CODE,
  REG_CODE_SIX,
  REG_EMAIL,
  REG_I18N_LANG,
  REG_PHONE,
  REG_PWD,
  REG_PWD_SPECIAL,
  REG_URL,
  REG_USER_NAME
} from '@/constants/reg';
import { $t } from '@/locales';

/**
 * 密码命中的字符类别数：小写 / 大写 / 数字 / 特殊
 *
 * ⚠️ 必须与后端 `OrgUserService.checkPasswordComplexity`（carlos-org）逐字一致 ——
 * 它统计的正是 `[a-z]`、`[A-Z]`、`\d`、以及 `REG_PWD_SPECIAL` 这四类。
 * 放宽任何一类都会出现「前端放行、后端以『密码复杂度不符合要求』拒绝」，
 * 而用户只看到一句笼统报错，无从得知究竟是哪个字符不合法。
 */
export function countPasswordCharClasses(pwd: string) {
  let count = 0;

  if (/[a-z]/.test(pwd)) count += 1;
  if (/[A-Z]/.test(pwd)) count += 1;
  if (/\d/.test(pwd)) count += 1;
  if (REG_PWD_SPECIAL.test(pwd)) count += 1;

  return count;
}

/** 是否满足后端复杂度要求：至少 8 位，且命中 3 类以上 */
export function isPasswordComplexEnough(pwd: string) {
  return pwd.length >= 8 && countPasswordCharClasses(pwd) >= 3;
}

export function useFormRules() {
  const patternRules = {
    userName: {
      pattern: REG_USER_NAME,
      message: $t('form.userName.invalid'),
      trigger: 'change'
    },
    phone: {
      pattern: REG_PHONE,
      message: $t('form.phone.invalid'),
      trigger: 'change'
    },
    pwd: {
      pattern: REG_PWD,
      message: $t('form.pwd.invalid'),
      trigger: 'change'
    },
    code: {
      pattern: REG_CODE_SIX,
      message: $t('form.code.invalid'),
      trigger: 'change'
    },
    email: {
      pattern: REG_EMAIL,
      message: $t('form.email.invalid'),
      trigger: 'change'
    },
    /**
     * 业务编码格式
     *
     * ⚠️ 注意与上面的 `code` 区分：`code` 是登录用的 6 位短信验证码（REG_CODE_SIX），
     * 这里指的是「模块编码 / 配置编码 / 字典编码」这类业务主键。两者语义完全不同，
     * 不要互相复用。
     */
    bizCode: {
      pattern: REG_BIZ_CODE,
      message: $t('form.bizCode.invalid'),
      trigger: 'change'
    },
    url: {
      pattern: REG_URL,
      message: $t('form.url.invalid'),
      trigger: 'change'
    },
    lang: {
      pattern: REG_I18N_LANG,
      message: $t('form.lang.invalid'),
      trigger: 'change'
    }
  } satisfies Record<string, App.Global.FormRule>;

  const formRules = {
    userName: [createRequiredRule($t('form.userName.required')), patternRules.userName],
    phone: [createRequiredRule($t('form.phone.required')), patternRules.phone],
    pwd: [createRequiredRule($t('form.pwd.required')), patternRules.pwd],
    code: [createRequiredRule($t('form.code.required')), patternRules.code],
    email: [createRequiredRule($t('form.email.required')), patternRules.email]
  } satisfies Record<string, App.Global.FormRule[]>;

  /** the default required rule */
  const defaultRequiredRule = createRequiredRule($t('form.required'));

  function createRequiredRule(message: string) {
    return {
      required: true,
      message
    };
  }

  /** create a rule for confirming the password */
  function createConfirmPwdRule(pwd: string | Ref<string> | ComputedRef<string>) {
    const confirmPwdRule: App.Global.FormRule[] = [
      { required: true, message: $t('form.confirmPwd.required') },
      {
        validator: (rule, value) => {
          if (value.trim() !== '' && value !== toValue(pwd)) {
            return Promise.reject(rule.message);
          }
          return Promise.resolve();
        },
        message: $t('form.confirmPwd.invalid'),
        trigger: 'change'
      }
    ];
    return confirmPwdRule;
  }

  /**
   * 长度上限，对应**数据库列宽**
   *
   * 列宽是本仓库里真实存在、而后端普遍不校验的约束：消息模块的 `type_code` /
   * `channel_code` 是 VARCHAR(32)、`template_code` 是 VARCHAR(50)、
   * `title_template` 是 VARCHAR(100)，而对应的 `*CreateParam` 一个 `@Size` 都没有。
   * 不挂这条规则，超长输入会一路走到数据库，用户只拿到一句无信息量的「新增失败」。
   *
   * 通常还应同时在控件上设 `:maxlength` —— 那是输入期的硬截断，本规则是校验期的
   * 提示，两者互补而非重复。
   */
  function createMaxLengthRule(max: number) {
    return {
      max,
      message: $t('form.maxLength.invalid', { max }),
      trigger: 'change'
    } satisfies App.Global.FormRule;
  }

  /**
   * 数值区间
   *
   * 用于后端只标了 `@NotNull` 却没标 `@Min`/`@Max`、但库里有明确范围的字段，
   * 例如 audit 的 `samplingRate` 是 `NUMERIC(3,2)`（0.00-1.00）、
   * message channel 的 `retry_times` 是 `SMALLINT`。
   */
  function createNumberRangeRule(min: number, max: number) {
    return {
      type: 'number',
      min,
      max,
      message: $t('form.numberRange.invalid', { min, max }),
      trigger: 'change'
    } satisfies App.Global.FormRule;
  }

  /**
   * 密码复杂度规则（至少 8 位 + 命中 3 类以上）
   *
   * `message` 由调用方传：不同页面挂在各自的 i18n 命名空间下
   * （个人中心用 `page.userCenter.passwordRule`、用户管理用
   * `page.organization.user.passwordRule`），这里不替调用方挑命名空间。
   */
  function createPasswordComplexityRule(message: string) {
    return {
      validator: (_rule, value: string) => {
        if (value && !isPasswordComplexEnough(value)) {
          return Promise.reject(message);
        }

        return Promise.resolve();
      }
    } satisfies App.Global.FormRule;
  }

  return {
    patternRules,
    formRules,
    defaultRequiredRule,
    createRequiredRule,
    createConfirmPwdRule,
    createMaxLengthRule,
    createNumberRangeRule,
    createPasswordComplexityRule
  };
}

export function useAntdForm() {
  const formRef = ref<FormInstance | null>(null);

  async function validate() {
    await formRef.value?.validate();
  }

  function resetFields() {
    formRef.value?.resetFields();
  }

  /** 仅清除校验状态，不回写字段值（resetFields 会把挂载时的快照写回 model，见 user-profile.vue） */
  function clearValidate() {
    formRef.value?.clearValidate();
  }

  return {
    formRef,
    validate,
    resetFields,
    clearValidate
  };
}
