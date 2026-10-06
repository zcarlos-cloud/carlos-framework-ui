<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { appClientAuthMethodOptions, appClientGrantTypeOptions, appClientScopeOptions } from '@/constants/business';
import { REG_REDIRECT_URI } from '@/constants/reg';
import { fetchAddAppClient, fetchAppCategoryList, fetchGetClientDetail, fetchUpdateAppClient } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'AppClientOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.AppClient.AppClientPageRecord | null;
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
const { defaultRequiredRule, createRequiredRule, patternRules, createMaxLengthRule } = useFormRules();

/**
 * 列宽取自 `carlos-auth/docs/02-design/database/auth_postgresql.sql` 的 app_client：
 * app_name VARCHAR(64)、app_desc VARCHAR(255)、homepage_url VARCHAR(500)；
 * app_logo 是 TEXT（存图标/图片地址），jwkSetUrl 是 client_settings（TEXT）内的 JSON 字段，
 * 两者无明确列宽，按 URL 类合理值取 255
 */
const APP_NAME_MAX = 64;
const APP_LOGO_MAX = 255;
const APP_DESC_MAX = 255;
const HOMEPAGE_URL_MAX = 500;
const JWK_SET_URL_MAX = 255;

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.appClient.addClient'),
    edit: $t('page.manage.appClient.editClient')
  };
  return titles[props.operateType];
});

type Model = {
  id: string;
  appName: string;
  appLogo: string;
  appDesc?: string;
  appType: number;
  appCategoryId?: number;
  homepageUrl?: string;
  displayOrder?: number;
  portalVisible: boolean;
  authenticationMethods: string[];
  authorizationGrantTypes: string[];
  scopes: string[];
  redirectUris: string[];
  requireProofKey: boolean;
  requireAuthorizationConsent: boolean;
  jwkSetUrl?: string;
  accessTokenFormat: 'self-contained' | 'reference';
  accessTokenTimeToLive?: number;
  refreshTokenTimeToLive?: number;
  authorizationCodeTimeToLive?: number;
  reuseRefreshTokens: boolean;
  clientStatus: string;
};

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    id: '',
    appName: '',
    appLogo: '',
    appDesc: '',
    appType: 1,
    appCategoryId: undefined,
    homepageUrl: '',
    displayOrder: 0,
    portalVisible: true,
    authenticationMethods: [],
    authorizationGrantTypes: [],
    scopes: [],
    redirectUris: [],
    requireProofKey: false,
    requireAuthorizationConsent: false,
    jwkSetUrl: '',
    accessTokenFormat: 'self-contained',
    accessTokenTimeToLive: undefined,
    refreshTokenTimeToLive: undefined,
    authorizationCodeTimeToLive: undefined,
    reuseRefreshTokens: true,
    clientStatus: 'ENABLE'
  };
}

type RuleKey = Extract<
  keyof Model,
  | 'appName'
  | 'appLogo'
  | 'appDesc'
  | 'authenticationMethods'
  | 'authorizationGrantTypes'
  | 'homepageUrl'
  | 'jwkSetUrl'
  | 'redirectUris'
>;

const arrayRequiredRule: App.Global.FormRule = {
  ...createRequiredRule($t('form.required')),
  type: 'array'
};

/**
 * 重定向地址逐条校验
 *
 * 它是 `mode="tags"` 的数组，`type: 'array'` 只能校验「是个数组」，管不到元素内容 ——
 * 而 redirectUris 会被原样注册到 IdP，一条写错的地址要等到授权跳转失败才会暴露。
 * 用自定义 validator 逐条过 {@link REG_REDIRECT_URI}，并把不合法的值直接列在错误信息里。
 */
const redirectUriRule: App.Global.FormRule = {
  validator: (_rule, value) => {
    const list = Array.isArray(value) ? value.map(item => String(item)) : [];
    const invalid = list.filter(uri => !REG_REDIRECT_URI.test(uri));

    if (invalid.length > 0) {
      return Promise.reject($t('page.manage.appClient.form.redirectUrisInvalid', { uris: invalid.join('、') }));
    }

    return Promise.resolve();
  },
  trigger: 'change'
};

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  appName: [defaultRequiredRule, createMaxLengthRule(APP_NAME_MAX)],
  appLogo: [defaultRequiredRule, createMaxLengthRule(APP_LOGO_MAX)],
  appDesc: [createMaxLengthRule(APP_DESC_MAX)],
  authenticationMethods: [arrayRequiredRule],
  authorizationGrantTypes: [arrayRequiredRule],
  // 两个地址都是可选字段；async-validator 对非必填的空串会直接跳过，不会误拦
  homepageUrl: [patternRules.url, createMaxLengthRule(HOMEPAGE_URL_MAX)],
  jwkSetUrl: [patternRules.url, createMaxLengthRule(JWK_SET_URL_MAX)],
  redirectUris: [redirectUriRule]
};

const categoryOptions = ref<Api.AppCategory.AppCategory[]>([]);

async function getCategoryOptions() {
  const { data: list, error } = await fetchAppCategoryList();

  if (!error && list) {
    categoryOptions.value = list;
  }
}

/** comma-joined string (page record) to string array */
function splitToArray(value?: string | string[] | null): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function assignDetail(detail: Api.AppClient.AppClientDetail) {
  model.value.id = detail.id;
  model.value.appName = detail.appName;
  model.value.appLogo = detail.appLogo;
  model.value.authenticationMethods = splitToArray(detail.authenticationMethods);
  model.value.authorizationGrantTypes = splitToArray(detail.authorizationGrantTypes);
  model.value.scopes = splitToArray(detail.scopes);
  model.value.redirectUris = splitToArray(detail.redirectUris);
  model.value.requireProofKey = detail.clientSettings?.requireProofKey ?? false;
  model.value.requireAuthorizationConsent = detail.clientSettings?.requireAuthorizationConsent ?? false;
  model.value.jwkSetUrl = detail.clientSettings?.jwkSetUrl ?? '';
  model.value.accessTokenFormat = detail.tokenSettings?.accessTokenFormat ?? 'self-contained';
  model.value.accessTokenTimeToLive = detail.tokenSettings?.accessTokenTimeToLive;
  model.value.refreshTokenTimeToLive = detail.tokenSettings?.refreshTokenTimeToLive;
  model.value.authorizationCodeTimeToLive = detail.tokenSettings?.authorizationCodeTimeToLive;
  model.value.reuseRefreshTokens = detail.tokenSettings?.reuseRefreshTokens ?? true;

  if (detail.clientStatus !== undefined && detail.clientStatus !== null) {
    model.value.clientStatus = String(detail.clientStatus);
  }
}

async function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { data: detail, error } = await fetchGetClientDetail(props.rowData.id);

    if (!error && detail) {
      assignDetail(detail);
    }
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    // 显式构造 payload，避免把 model 里的表单内部字段直接透传
    const basePayload: Api.AppClient.AppClientCreateParams = {
      appName: model.value.appName,
      appLogo: model.value.appLogo,
      appDesc: model.value.appDesc,
      appType: model.value.appType,
      appCategoryId: model.value.appCategoryId,
      homepageUrl: model.value.homepageUrl,
      displayOrder: model.value.displayOrder,
      portalVisible: model.value.portalVisible,
      authenticationMethods: model.value.authenticationMethods,
      authorizationGrantTypes: model.value.authorizationGrantTypes,
      scopes: model.value.scopes,
      redirectUris: model.value.redirectUris,
      clientSettings: {
        requireProofKey: model.value.requireProofKey,
        requireAuthorizationConsent: model.value.requireAuthorizationConsent,
        jwkSetUrl: model.value.jwkSetUrl
      },
      tokenSettings: {
        accessTokenFormat: model.value.accessTokenFormat,
        accessTokenTimeToLive: model.value.accessTokenTimeToLive,
        refreshTokenTimeToLive: model.value.refreshTokenTimeToLive,
        authorizationCodeTimeToLive: model.value.authorizationCodeTimeToLive,
        reuseRefreshTokens: model.value.reuseRefreshTokens
      }
    };

    const { error } = isEdit.value
      ? await fetchUpdateAppClient({ ...basePayload, id: model.value.id, clientStatus: model.value.clientStatus })
      : await fetchAddAppClient(basePayload);

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
    getCategoryOptions();
    resetFields();
  }
});
</script>

<!-- 宽度用 560：表单分三段共 20+ 字段，远超基准的 360 -->
<template>
  <ADrawer v-model:open="visible" :title="title" :width="560">
    <AForm ref="formRef" :model="model" :rules="rules" layout="vertical">
      <ADivider orientation="left">{{ $t('page.manage.appClient.basicInfo') }}</ADivider>
      <AFormItem :label="$t('page.manage.appClient.appName')" name="appName">
        <AInput
          v-model:value="model.appName"
          :maxlength="APP_NAME_MAX"
          show-count
          :placeholder="$t('page.manage.appClient.form.appName')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.appLogo')" name="appLogo">
        <AInput
          v-model:value="model.appLogo"
          :maxlength="APP_LOGO_MAX"
          show-count
          :placeholder="$t('page.manage.appClient.form.appLogo')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.appDesc')" name="appDesc">
        <ATextarea
          v-model:value="model.appDesc"
          :maxlength="APP_DESC_MAX"
          show-count
          :rows="2"
          :placeholder="$t('page.manage.appClient.form.appDesc')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.appType')" name="appType">
        <ARadioGroup v-model:value="model.appType">
          <ARadio :value="1">{{ $t('page.manage.appClient.typeOptions.internal') }}</ARadio>
          <ARadio :value="2">{{ $t('page.manage.appClient.typeOptions.external') }}</ARadio>
          <ARadio :value="3">{{ $t('page.manage.appClient.typeOptions.mobile') }}</ARadio>
        </ARadioGroup>
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.appCategoryId')" name="appCategoryId">
        <ASelect
          v-model:value="model.appCategoryId"
          :placeholder="$t('page.manage.appClient.form.appCategoryId')"
          allow-clear
        >
          <ASelectOption v-for="item in categoryOptions" :key="item.id" :value="item.id">
            {{ item.categoryName }}
          </ASelectOption>
        </ASelect>
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.homepageUrl')" name="homepageUrl">
        <AInput
          v-model:value="model.homepageUrl"
          :maxlength="HOMEPAGE_URL_MAX"
          show-count
          :placeholder="$t('page.manage.appClient.form.homepageUrl')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.displayOrder')" name="displayOrder">
        <AInputNumber
          v-model:value="model.displayOrder"
          :min="0"
          class="w-full"
          :placeholder="$t('page.manage.appClient.form.displayOrder')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.portalVisible')" name="portalVisible">
        <ARadioGroup v-model:value="model.portalVisible">
          <ARadio :value="true">{{ $t('page.manage.appClient.portalVisibleOptions.visible') }}</ARadio>
          <ARadio :value="false">{{ $t('page.manage.appClient.portalVisibleOptions.hidden') }}</ARadio>
        </ARadioGroup>
      </AFormItem>

      <ADivider orientation="left">{{ $t('page.manage.appClient.oauth2Config') }}</ADivider>
      <AFormItem
        :label="$t('page.manage.appClient.authenticationMethods')"
        name="authenticationMethods"
        :extra="$t('page.manage.appClient.authMethodHint')"
      >
        <ASelect
          v-model:value="model.authenticationMethods"
          mode="multiple"
          :placeholder="$t('page.manage.appClient.form.authenticationMethods')"
          :options="appClientAuthMethodOptions"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.authorizationGrantTypes')" name="authorizationGrantTypes">
        <ASelect
          v-model:value="model.authorizationGrantTypes"
          mode="multiple"
          :placeholder="$t('page.manage.appClient.form.authorizationGrantTypes')"
          :options="appClientGrantTypeOptions"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.scopes')" name="scopes">
        <ASelect
          v-model:value="model.scopes"
          mode="tags"
          :placeholder="$t('page.manage.appClient.form.scopes')"
          :options="appClientScopeOptions"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.redirectUris')" name="redirectUris">
        <ASelect
          v-model:value="model.redirectUris"
          mode="tags"
          :placeholder="$t('page.manage.appClient.form.redirectUris')"
          :open="false"
        />
      </AFormItem>

      <ADivider orientation="left">{{ $t('page.manage.appClient.advancedSettings') }}</ADivider>
      <AFormItem :label="$t('page.manage.appClient.requireProofKey')" name="requireProofKey">
        <ASwitch v-model:checked="model.requireProofKey" />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.requireAuthorizationConsent')" name="requireAuthorizationConsent">
        <ASwitch v-model:checked="model.requireAuthorizationConsent" />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.jwkSetUrl')" name="jwkSetUrl">
        <AInput
          v-model:value="model.jwkSetUrl"
          :maxlength="JWK_SET_URL_MAX"
          show-count
          :placeholder="$t('page.manage.appClient.form.jwkSetUrl')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.accessTokenFormat')" name="accessTokenFormat">
        <ARadioGroup v-model:value="model.accessTokenFormat">
          <ARadio value="self-contained">{{ $t('page.manage.appClient.tokenFormatOptions.selfContained') }}</ARadio>
          <ARadio value="reference">{{ $t('page.manage.appClient.tokenFormatOptions.reference') }}</ARadio>
        </ARadioGroup>
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.accessTokenTimeToLive')" name="accessTokenTimeToLive">
        <AInputNumber
          v-model:value="model.accessTokenTimeToLive"
          :min="1"
          class="w-full"
          :placeholder="$t('page.manage.appClient.form.minutes')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.refreshTokenTimeToLive')" name="refreshTokenTimeToLive">
        <AInputNumber
          v-model:value="model.refreshTokenTimeToLive"
          :min="1"
          class="w-full"
          :placeholder="$t('page.manage.appClient.form.minutes')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.authorizationCodeTimeToLive')" name="authorizationCodeTimeToLive">
        <AInputNumber
          v-model:value="model.authorizationCodeTimeToLive"
          :min="1"
          class="w-full"
          :placeholder="$t('page.manage.appClient.form.minutes')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.appClient.reuseRefreshTokens')" name="reuseRefreshTokens">
        <ASwitch v-model:checked="model.reuseRefreshTokens" />
      </AFormItem>

      <AFormItem v-if="props.operateType === 'edit'" :label="$t('page.manage.common.statusTitle')" name="clientStatus">
        <!-- 后端 AppClientUpdateParam.clientStatus 是 ClientStatusEnum（无 @JsonValue），按枚举名绑定 -->
        <ARadioGroup v-model:value="model.clientStatus">
          <ARadio value="ENABLE">{{ $t('page.manage.appClient.statusOptions.enable') }}</ARadio>
          <ARadio value="DISABLE">{{ $t('page.manage.appClient.statusOptions.disable') }}</ARadio>
          <ARadio value="LOGGED_OUT">{{ $t('page.manage.appClient.statusOptions.loggedOut') }}</ARadio>
        </ARadioGroup>
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
