<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storageTypeOptions } from '@/constants/business';
import { fetchAddStorageConfig, fetchGetStorageConfigDetail, fetchUpdateStorageConfig } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'StorageConfigOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.SystemManage.StorageConfig | null;
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
const { defaultRequiredRule, createMaxLengthRule } = useFormRules();

/** 列宽取自 sys_file_storage_config 的 DDL */
const CONFIG_NAME_MAX = 100;
const STORAGE_TYPE_MAX = 20;
const ENDPOINT_MAX = 255;
const ACCESS_KEY_MAX = 500;
const SECRET_KEY_MAX = 500;
const BUCKET_NAME_MAX = 100;
const REGION_MAX = 50;
const LOCAL_PATH_MAX = 255;
const PUBLIC_ENDPOINT_MAX = 255;
const REMARK_MAX = 500;

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

/** 编辑态要先取详情（见 handleInitModel），期间把表单罩住避免用户改到半截数据 */
const detailLoading = ref(false);

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.storageConfig.addStorageConfig'),
    edit: $t('page.manage.storageConfig.editStorageConfig')
  };
  return titles[props.operateType];
});

type Model = Pick<
  Api.SystemManage.StorageConfig,
  | 'configName'
  | 'storageType'
  | 'endpoint'
  | 'accessKey'
  | 'secretKey'
  | 'bucketName'
  | 'region'
  | 'pathStyleAccess'
  | 'localBasePath'
  | 'publicEndpoint'
  | 'configStatus'
  | 'remark'
>;

const model = ref(createDefaultModel());

/**
 * 默认模型
 *
 * `bucketName` / `region` 只在 S3 下给初值：它们本是 S3 形状的字段，
 * 无条件写进模型会让新建的 LOCAL 配置也带着 `bucketName='default'`、`region='us-east-1'` 落库。
 */
function createDefaultModel(storageType: Api.SystemManage.StorageConfig['storageType'] = 'S3'): Model {
  const isS3Default = storageType === 'S3';

  return {
    configName: '',
    storageType,
    endpoint: '',
    accessKey: '',
    secretKey: '',
    bucketName: isS3Default ? 'default' : '',
    region: isS3Default ? 'us-east-1' : '',
    pathStyleAccess: true,
    localBasePath: '',
    publicEndpoint: '',
    configStatus: 1,
    remark: ''
  };
}

const isS3 = computed(() => model.value.storageType === 'S3');
const isLocal = computed(() => model.value.storageType === 'LOCAL');

/**
 * 校验规则随存储类型与新增/编辑切换
 *
 * - S3 的 `endpoint` / `bucketName` 功能上必填（少了它们连不上），此前零规则
 * - **`secretKey` 只在新增时必填**：编辑时留空表示「不修改」，见 getSubmitParams
 * - `accessKey` 编辑时来自详情接口的真实值，一般不为空；不设必填以免blocked住历史空值数据
 */
const rules = computed<Record<string, App.Global.FormRule[]>>(() => {
  const list: Record<string, App.Global.FormRule[]> = {
    configName: [defaultRequiredRule, createMaxLengthRule(CONFIG_NAME_MAX)],
    storageType: [defaultRequiredRule, createMaxLengthRule(STORAGE_TYPE_MAX)],
    publicEndpoint: [createMaxLengthRule(PUBLIC_ENDPOINT_MAX)],
    remark: [createMaxLengthRule(REMARK_MAX)]
  };

  if (isS3.value) {
    list.endpoint = [defaultRequiredRule, createMaxLengthRule(ENDPOINT_MAX)];
    list.bucketName = [defaultRequiredRule, createMaxLengthRule(BUCKET_NAME_MAX)];
    list.region = [createMaxLengthRule(REGION_MAX)];
    list.accessKey = [createMaxLengthRule(ACCESS_KEY_MAX)];
    list.secretKey = isEdit.value
      ? [createMaxLengthRule(SECRET_KEY_MAX)]
      : [defaultRequiredRule, createMaxLengthRule(SECRET_KEY_MAX)];
  } else {
    list.localBasePath = [defaultRequiredRule, createMaxLengthRule(LOCAL_PATH_MAX)];
  }

  return list;
});

/**
 * 由配置数据构造编辑态 model
 *
 * ⚠️ **刻意不回填 `secretKey`**，无论数据来自列表还是详情接口：
 * 后端 `FileStorageConfigService#toVOWithDesensitization` 会把 secretKey 换成脱敏值
 * （形如 `SECR****0001`），它是**非空字符串** —— 一旦回填并随表单提交，
 * `encryptSensitiveFields` 会把这段掩码当成新密钥加密入库，**真密钥就被永久毁掉了**。
 * （已实测：库里原本的密钥确实会被改成掩码。）
 *
 * `accessKey` 则可以回填：详情接口先 `decryptSensitiveFields` 再脱敏，拿到的是真实明文，
 * 原样回传会被重新加密，语义正确。列表接口**没有**解密这一步，所以必须取详情。
 */
function buildModelFrom(source: Api.SystemManage.StorageConfig): Model {
  const {
    configName,
    storageType,
    endpoint,
    accessKey,
    bucketName,
    region,
    pathStyleAccess,
    localBasePath,
    publicEndpoint,
    configStatus,
    remark
  } = source;

  return {
    configName: configName ?? '',
    storageType: storageType ?? 'S3',
    endpoint: endpoint ?? '',
    accessKey: accessKey ?? '',
    // 永远留空：留空 = 不修改
    secretKey: '',
    bucketName: bucketName ?? '',
    region: region ?? '',
    pathStyleAccess: pathStyleAccess ?? true,
    localBasePath: localBasePath ?? '',
    publicEndpoint: publicEndpoint ?? '',
    configStatus: configStatus ?? 1,
    remark: remark ?? ''
  };
}

async function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType !== 'edit' || !props.rowData) {
    return;
  }

  detailLoading.value = true;
  try {
    const { data } = await fetchGetStorageConfigDetail(props.rowData.id);

    // 详情拿不到就退回行数据：accessKey 在这种情况下可能是密文，但至少不会毁掉 secretKey
    model.value = buildModelFrom(data ?? props.rowData);
  } finally {
    detailLoading.value = false;
  }
}

/**
 * 切换存储类型时清掉另一个分支的字段
 *
 * 否则把 S3 配置改成 LOCAL 会带着 endpoint / region 等一起提交。
 * 凭据字段一并清空 —— 它们在 LOCAL 下本就不提交，正好保持原值不变。
 */
function handleStorageTypeChange() {
  if (model.value.storageType === 'S3') {
    model.value.localBasePath = '';
  } else {
    model.value.endpoint = '';
    model.value.accessKey = '';
    model.value.secretKey = '';
    model.value.bucketName = '';
    model.value.region = '';
    model.value.pathStyleAccess = true;
  }
}

function closeDrawer() {
  visible.value = false;
}

/**
 * 提交参数
 *
 * 敏感凭据的空值一律**从 payload 里删掉**，而不是提交空串：
 * 后端 `encryptSensitiveFields` 只处理非空值，而 `modify` 用的 `updateById` 会跳过 null、
 * 但**会写入空串** —— 所以「不传」才是「保持原值」的唯一正确表达，
 * 传 `''` 等于把已有的密钥覆盖成空。
 */
function getSubmitParams(): Partial<Api.SystemManage.StorageConfig> {
  const params: Partial<Api.SystemManage.StorageConfig> = { ...model.value };

  if (!params.accessKey) {
    delete params.accessKey;
  }

  if (!params.secretKey) {
    delete params.secretKey;
  }

  return params;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const params = getSubmitParams();

    const { error } = isEdit.value
      ? await fetchUpdateStorageConfig({ ...params, id: props.rowData?.id ?? '' })
      : await fetchAddStorageConfig(params);

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
    resetFields();
  }
});
</script>

<!-- 宽度用 480 而非默认 360：S3 分支含 5 个额外字段，整体字段数达 12 个 -->
<template>
  <ADrawer v-model:open="visible" :title="title" :width="480">
    <ASpin :spinning="detailLoading">
      <AForm ref="formRef" :model="model" :rules="rules" layout="vertical">
        <AFormItem
          :label="$t('page.manage.storageConfig.storageType')"
          name="storageType"
          :extra="$t('page.manage.storageConfig.help.storageType')"
        >
          <ARadioGroup v-model:value="model.storageType" @change="handleStorageTypeChange">
            <ARadio v-for="item in storageTypeOptions" :key="item.value" :value="item.value">
              {{ $t(item.label) }}
            </ARadio>
          </ARadioGroup>
        </AFormItem>

        <AFormItem :label="$t('page.manage.storageConfig.configName')" name="configName">
          <AInput
            v-model:value="model.configName"
            :maxlength="CONFIG_NAME_MAX"
            show-count
            :placeholder="$t('page.manage.storageConfig.form.configName')"
          />
        </AFormItem>

        <AFormItem
          :label="$t('page.manage.storageConfig.bucketName')"
          name="bucketName"
          :extra="$t('page.manage.storageConfig.help.bucketName')"
        >
          <AInput
            v-model:value="model.bucketName"
            :maxlength="BUCKET_NAME_MAX"
            show-count
            :placeholder="$t('page.manage.storageConfig.form.bucketName')"
          />
        </AFormItem>

        <template v-if="isS3">
          <AFormItem
            :label="$t('page.manage.storageConfig.endpoint')"
            name="endpoint"
            :extra="$t('page.manage.storageConfig.help.endpoint')"
          >
            <AInput
              v-model:value="model.endpoint"
              :maxlength="ENDPOINT_MAX"
              show-count
              :placeholder="$t('page.manage.storageConfig.form.endpoint')"
            />
          </AFormItem>
          <AFormItem
            :label="$t('page.manage.storageConfig.accessKey')"
            name="accessKey"
            :extra="$t('page.manage.storageConfig.help.accessKey')"
          >
            <AInput
              v-model:value="model.accessKey"
              :maxlength="ACCESS_KEY_MAX"
              show-count
              :placeholder="$t('page.manage.storageConfig.form.accessKey')"
            />
          </AFormItem>
          <!--
            编辑态绝不回填已存的密钥（接口下发的是脱敏值，回填即毁数据），
            故这里没有初值，只在用户主动填写时才提交。
          -->
          <AFormItem
            :label="$t('page.manage.storageConfig.secretKey')"
            name="secretKey"
            :extra="
              isEdit
                ? $t('page.manage.storageConfig.help.secretKeyEdit')
                : $t('page.manage.storageConfig.help.secretKey')
            "
          >
            <AInputPassword
              v-model:value="model.secretKey"
              :maxlength="SECRET_KEY_MAX"
              :placeholder="
                isEdit ? $t('page.manage.common.leaveBlankToKeep') : $t('page.manage.storageConfig.form.secretKey')
              "
              autocomplete="new-password"
            />
          </AFormItem>
          <AFormItem
            :label="$t('page.manage.storageConfig.region')"
            name="region"
            :extra="$t('page.manage.storageConfig.help.region')"
          >
            <AInput
              v-model:value="model.region"
              :maxlength="REGION_MAX"
              show-count
              :placeholder="$t('page.manage.storageConfig.form.region')"
            />
          </AFormItem>
          <AFormItem
            :label="$t('page.manage.storageConfig.pathStyleAccess')"
            name="pathStyleAccess"
            :extra="$t('page.manage.storageConfig.help.pathStyleAccess')"
          >
            <ASwitch v-model:checked="model.pathStyleAccess" />
          </AFormItem>
        </template>

        <template v-if="isLocal">
          <AFormItem
            :label="$t('page.manage.storageConfig.localBasePath')"
            name="localBasePath"
            :extra="$t('page.manage.storageConfig.help.localBasePath')"
          >
            <AInput
              v-model:value="model.localBasePath"
              :maxlength="LOCAL_PATH_MAX"
              show-count
              :placeholder="$t('page.manage.storageConfig.form.localBasePath')"
            />
          </AFormItem>
        </template>

        <AFormItem
          :label="$t('page.manage.storageConfig.publicEndpoint')"
          name="publicEndpoint"
          :extra="$t('page.manage.storageConfig.help.publicEndpoint')"
        >
          <AInput
            v-model:value="model.publicEndpoint"
            :maxlength="PUBLIC_ENDPOINT_MAX"
            show-count
            :placeholder="$t('page.manage.storageConfig.form.publicEndpoint')"
          />
        </AFormItem>

        <AFormItem :label="$t('page.manage.common.statusTitle')" name="configStatus">
          <!-- configStatus 后端为 Integer 0/1，不是 boolean -->
          <ARadioGroup v-model:value="model.configStatus">
            <ARadio :value="1">{{ $t('page.manage.common.status.enable') }}</ARadio>
            <ARadio :value="0">{{ $t('page.manage.common.status.disable') }}</ARadio>
          </ARadioGroup>
        </AFormItem>

        <AFormItem :label="$t('page.manage.storageConfig.remark')" name="remark">
          <ATextarea
            v-model:value="model.remark"
            :rows="3"
            :maxlength="REMARK_MAX"
            show-count
            :placeholder="$t('page.manage.storageConfig.form.remark')"
          />
        </AFormItem>
      </AForm>
    </ASpin>
    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" @click="handleSubmit">{{ $t('common.confirm') }}</AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
