<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddDevkitTemplateGroup, fetchUpdateDevkitTemplateGroup } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'DevkitTemplateGroupOperateDrawer'
});

interface Props {
  operateType: AntDesign.TableOperateType;
  rowData?: Api.Devkit.TemplateGroup | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const { formRef, validate, resetFields } = useAntdForm();
const { defaultRequiredRule, patternRules, createMaxLengthRule } = useFormRules();

const submitLoading = ref(false);

const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.devkit.template.addTitle'),
    edit: $t('page.devkit.template.editTitle')
  };
  return titles[props.operateType];
});

type Model = Api.Devkit.TemplateGroupCreateParams & { id?: string; status?: Api.Devkit.Status };

const model = ref<Model>(createDefaultModel());

function createDefaultModel(): Model {
  return {
    groupCode: '',
    groupName: '',
    description: '',
    templateType: 1,
    techStack: '',
    dbType: '',
    templateRoot: 'template',
    logicDeleteFields: 'is_deleted,deleted,del_flag',
    versionFields: 'version',
    commonFields: 'create_by,create_time,update_by,update_time',
    sortNum: 0,
    remark: ''
  };
}

/**
 * groupCode 是模板组的技术键：物化路径与生成记录都依赖它做追溯，
 * 创建后不可修改，故编辑态禁用（与 message 模板的 templateCode 同例）。
 */
const GROUP_CODE_MAX = 64;
const GROUP_NAME_MAX = 128;
const ROOT_MAX = 64;
const FIELDS_MAX = 512;
const COMMON_FIELDS_MAX = 1024;

const rules = {
  groupCode: [defaultRequiredRule, patternRules.bizCode, createMaxLengthRule(GROUP_CODE_MAX)],
  groupName: [defaultRequiredRule, createMaxLengthRule(GROUP_NAME_MAX)],
  templateType: defaultRequiredRule,
  templateRoot: createMaxLengthRule(ROOT_MAX),
  logicDeleteFields: createMaxLengthRule(FIELDS_MAX),
  versionFields: createMaxLengthRule(FIELDS_MAX),
  commonFields: createMaxLengthRule(COMMON_FIELDS_MAX)
};

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const row = props.rowData;
    model.value = {
      id: row.id,
      groupCode: row.groupCode,
      groupName: row.groupName,
      description: row.description ?? '',
      templateType: row.templateType,
      techStack: row.techStack ?? '',
      dbType: row.dbType ?? '',
      templateRoot: row.templateRoot ?? 'template',
      logicDeleteFields: row.logicDeleteFields ?? '',
      versionFields: row.versionFields ?? '',
      commonFields: row.commonFields ?? '',
      sortNum: row.sortNum ?? 0,
      status: row.status,
      remark: row.remark ?? ''
    };
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const { error } = isEdit.value
      ? await fetchUpdateDevkitTemplateGroup({
          id: model.value.id ?? '',
          groupName: model.value.groupName,
          description: model.value.description,
          techStack: model.value.techStack,
          dbType: model.value.dbType,
          templateRoot: model.value.templateRoot,
          logicDeleteFields: model.value.logicDeleteFields,
          versionFields: model.value.versionFields,
          commonFields: model.value.commonFields,
          status: model.value.status,
          sortNum: model.value.sortNum,
          remark: model.value.remark
        })
      : await fetchAddDevkitTemplateGroup(model.value);

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
  <ADrawer v-model:open="visible" :title="title" :width="620">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.devkit.template.groupCode')" name="groupCode">
        <AInput
          v-model:value="model.groupCode"
          :disabled="isEdit"
          :maxlength="GROUP_CODE_MAX"
          show-count
          :placeholder="$t('page.devkit.template.form.groupCode')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.template.groupName')" name="groupName">
        <AInput v-model:value="model.groupName" :maxlength="GROUP_NAME_MAX" show-count />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.template.templateType')" name="templateType">
        <ARadioGroup v-model:value="model.templateType" :disabled="isEdit">
          <ARadio :value="1">{{ $t('page.devkit.template.typeCode') }}</ARadio>
          <ARadio :value="2">{{ $t('page.devkit.template.typeProject') }}</ARadio>
        </ARadioGroup>
      </AFormItem>
      <ARow :gutter="12">
        <ACol :span="12">
          <AFormItem :label="$t('page.devkit.template.techStack')" name="techStack">
            <AInput v-model:value="model.techStack" :maxlength="32" placeholder="MYBATIS / SPRINGBOOT" />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.devkit.template.dbType')" name="dbType">
            <AInput v-model:value="model.dbType" :maxlength="16" placeholder="ANY / MYSQL / POSTGRESQL" />
          </AFormItem>
        </ACol>
      </ARow>
      <ARow :gutter="12">
        <ACol :span="12">
          <AFormItem :label="$t('page.devkit.template.templateRoot')" name="templateRoot">
            <AInput v-model:value="model.templateRoot" :maxlength="ROOT_MAX" />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.devkit.template.sortNum')" name="sortNum">
            <AInputNumber v-model:value="model.sortNum" :min="0" class="w-full" />
          </AFormItem>
        </ACol>
      </ARow>
      <AFormItem
        :label="$t('page.devkit.template.logicDeleteFields')"
        name="logicDeleteFields"
        :extra="$t('page.devkit.template.fieldsHint')"
      >
        <ATextarea v-model:value="model.logicDeleteFields" :rows="2" :maxlength="FIELDS_MAX" />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.template.versionFields')" name="versionFields">
        <ATextarea v-model:value="model.versionFields" :rows="2" :maxlength="FIELDS_MAX" />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.template.commonFields')" name="commonFields">
        <ATextarea v-model:value="model.commonFields" :rows="3" :maxlength="COMMON_FIELDS_MAX" />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.template.description')" name="description">
        <ATextarea v-model:value="model.description" :rows="2" :maxlength="512" show-count />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.template.remark')" name="remark">
        <ATextarea v-model:value="model.remark" :rows="2" :maxlength="512" show-count />
      </AFormItem>
      <AFormItem v-if="isEdit" :label="$t('page.devkit.template.status')" name="status">
        <ARadioGroup v-model:value="model.status">
          <ARadio :value="1">{{ $t('page.devkit.common.enabled') }}</ARadio>
          <ARadio :value="0">{{ $t('page.devkit.common.disabled') }}</ARadio>
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
