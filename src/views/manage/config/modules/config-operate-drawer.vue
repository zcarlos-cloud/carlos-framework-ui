<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { configValueTypeOptions } from '@/constants/business';
import { fetchAddConfig, fetchUpdateConfig } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'ConfigOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.SystemManage.SysConfig | null;
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
const { defaultRequiredRule, patternRules, createMaxLengthRule } = useFormRules();

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

/**
 * 值类型：'1' 文本 / '2' 文件
 *
 * 对应后端 ConfigValueType，且它是**全仓唯一按数字码序列化的枚举**
 * （带 @JsonValue getJsonCode），所以这里比较的是 '1'/'2' 而不是枚举名。
 * 见 src/service/api/system-config.ts 顶部的说明。
 */
const VALUE_TYPE_TEXT = '1';
const VALUE_TYPE_FILE = '2';

/**
 * 列宽取自 `carlos-system/docs/02-design/database/system_postgresql.sql`：
 * config_name / config_code 是 VARCHAR(100)、remark 是 VARCHAR(500)、config_value 是 TEXT（不限长）
 */
const CONFIG_NAME_MAX = 100;
const CONFIG_CODE_MAX = 100;
const REMARK_MAX = 500;

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.config.addConfig'),
    edit: $t('page.manage.config.editConfig')
  };
  return titles[props.operateType];
});

type Model = Pick<
  Api.SystemManage.SysConfig,
  'configName' | 'configCode' | 'configValue' | 'valueType' | 'remark' | 'configStatus'
>;

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    configName: '',
    configCode: '',
    configValue: '',
    valueType: VALUE_TYPE_TEXT,
    remark: '',
    configStatus: true
  };
}

/** 值类型为「文件」时，configValue 换成上传控件（见 SKILL「控件随字段切换」） */
const isFileValue = computed(() => model.value.valueType === VALUE_TYPE_FILE);

type RuleKey = Extract<keyof Model, 'configName' | 'configCode' | 'configValue' | 'valueType' | 'remark'>;

/**
 * 每个键都必须在模板里有同名的 `name`，否则规则静默失效
 * （反面教材见 `SKILL.md` 的 `RuleKey = Extract<...>` 一节）
 */
const rules: Record<RuleKey, App.Global.FormRule[]> = {
  configName: [defaultRequiredRule, createMaxLengthRule(CONFIG_NAME_MAX)],
  configCode: [defaultRequiredRule, patternRules.bizCode, createMaxLengthRule(CONFIG_CODE_MAX)],
  configValue: [defaultRequiredRule],
  valueType: [defaultRequiredRule],
  remark: [createMaxLengthRule(REMARK_MAX)]
};

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { configName, configCode, configValue, valueType, remark, configStatus } = props.rowData;

    // 显式挑选字段，避免把 id / createBy / createTime 等公共字段一并回传
    model.value = {
      configName: configName ?? '',
      configCode: configCode ?? '',
      configValue: configValue ?? '',
      valueType: valueType ?? VALUE_TYPE_TEXT,
      remark: remark ?? '',
      configStatus: configStatus ?? true
    };
  }
}

/**
 * 值类型为「文件」时，把上传后的**访问地址**写进 configValue
 *
 * 后端 `SysConfigService` 里那条 `TODO: 如果是文件类型，将文件转换成地址` 指的就是这件事 ——
 * 在此落地：上传由 FileUpload 完成（namespace=config），库里存的仍然是地址字符串，后端无需改动。
 * 组件绑定值是文件 id，change 事件里换回 url 写回 model；不用 v-model 避免把 id 写进 configValue。
 */
function handleConfigFileChange(files: Api.SystemManage.FileInfo[]) {
  model.value.configValue = files[0]?.url ?? '';
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const { error } = isEdit.value
      ? await fetchUpdateConfig({ id: props.rowData?.id ?? '', ...model.value })
      : await fetchAddConfig(model.value);

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

<template>
  <ADrawer v-model:open="visible" :title="title" :width="480">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.manage.config.configName')" name="configName">
        <AInput
          v-model:value="model.configName"
          :maxlength="CONFIG_NAME_MAX"
          show-count
          :placeholder="$t('page.manage.config.form.configName')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.config.configCode')" name="configCode">
        <!--
          编码是业务键：sys_config 上有唯一索引 uk_sys_config_code，
          且多处以「按码查询」引用它（fetchGetConfigByCode）。
          编辑态放开可改会静默打断所有按码引用，故锁定。
        -->
        <AInput
          v-model:value="model.configCode"
          :disabled="isEdit"
          :maxlength="CONFIG_CODE_MAX"
          show-count
          :placeholder="$t('page.manage.config.form.configCode')"
        />
      </AFormItem>

      <!-- 值类型决定 configValue 的填写方式：文本直接输入，文件走上传 -->
      <AFormItem :label="$t('page.manage.config.valueType')" name="valueType">
        <ARadioGroup v-model:value="model.valueType">
          <ARadio v-for="item in configValueTypeOptions" :key="item.value" :value="item.value">
            {{ $t(item.label) }}
          </ARadio>
        </ARadioGroup>
      </AFormItem>

      <AFormItem :label="$t('page.manage.config.configValue')" name="configValue">
        <ATextarea
          v-if="!isFileValue"
          v-model:value="model.configValue"
          :rows="3"
          :placeholder="$t('page.manage.config.form.configValue')"
        />
        <div v-else class="w-full">
          <FileUpload
            :value="model.configValue"
            namespace="config"
            :disabled="submitLoading"
            @change="handleConfigFileChange"
          />
        </div>
      </AFormItem>

      <AFormItem :label="$t('page.manage.config.configStatus')" name="configStatus">
        <ARadioGroup v-model:value="model.configStatus">
          <ARadio :value="true">{{ $t('page.manage.common.status.enable') }}</ARadio>
          <ARadio :value="false">{{ $t('page.manage.common.status.disable') }}</ARadio>
        </ARadioGroup>
      </AFormItem>

      <AFormItem :label="$t('page.manage.config.remark')" name="remark">
        <ATextarea
          v-model:value="model.remark"
          :maxlength="REMARK_MAX"
          :rows="3"
          show-count
          :placeholder="$t('page.manage.config.form.remark')"
        />
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
