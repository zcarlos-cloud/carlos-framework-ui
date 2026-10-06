<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddDevkitDataSource, fetchTestDevkitDataSource, fetchUpdateDevkitDataSource } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { enumDictNameOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'DevkitDatasourceOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.Devkit.DataSource | null;
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
const { defaultRequiredRule } = useFormRules();

const submitLoading = ref(false);
const testLoading = ref(false);

const isEdit = computed(() => props.operateType === 'edit');

const dbTypeOptions = enumDictNameOptions('devkit', 'DevkitDbType');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.devkit.datasource.addTitle'),
    edit: $t('page.devkit.datasource.editTitle')
  };
  return titles[props.operateType];
});

type Model = Api.Devkit.DataSourceCreateParams & { id?: string; status?: Api.Devkit.Status };

const model = ref<Model>(createDefaultModel());

function createDefaultModel(): Model {
  return {
    dsName: '',
    dsCode: '',
    dbType: 'POSTGRESQL',
    host: '127.0.0.1',
    port: 5432,
    databaseName: '',
    schemaName: 'public',
    username: '',
    password: '',
    jdbcParams: '',
    readOnly: true,
    remark: ''
  };
}

const rules = {
  dsName: defaultRequiredRule,
  dbType: defaultRequiredRule,
  host: defaultRequiredRule,
  port: defaultRequiredRule,
  username: defaultRequiredRule
};

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const row = props.rowData;
    model.value = {
      id: row.id,
      dsName: row.dsName,
      dsCode: row.dsCode ?? '',
      dbType: row.dbType,
      host: row.host,
      port: row.port,
      databaseName: row.databaseName ?? '',
      schemaName: row.schemaName ?? '',
      username: row.username ?? '',
      // ⚠️ 后端从不回发密码：这里恒为空，留空即「保持原值」
      password: '',
      jdbcParams: row.jdbcParams ?? '',
      readOnly: row.readOnly ?? true,
      status: row.status,
      remark: row.remark ?? ''
    };
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleTest() {
  await validate();
  testLoading.value = true;

  try {
    const { error, data } = await fetchTestDevkitDataSource({
      // 编辑态把 id 带上：密码留空时后端会用库里已存的密码来测
      id: model.value.id,
      dbType: model.value.dbType,
      host: model.value.host,
      port: model.value.port,
      databaseName: model.value.databaseName,
      schemaName: model.value.schemaName,
      username: model.value.username,
      password: model.value.password,
      jdbcParams: model.value.jdbcParams
    });

    if (error) {
      window.$message?.error?.($t('page.devkit.datasource.testFailed'));
      return;
    }

    if (data.success) {
      window.$message?.success?.(
        $t('page.devkit.datasource.testSuccess', {
          name: data.databaseName ?? '',
          version: data.databaseVersion ?? '',
          ms: data.responseTimeMs ?? ''
        })
      );
    } else {
      window.$message?.error?.(data.errorMessage ?? $t('page.devkit.datasource.testFailed'));
    }
  } finally {
    testLoading.value = false;
  }
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const { error } = isEdit.value
      ? await fetchUpdateDevkitDataSource({ ...model.value, id: model.value.id ?? '' })
      : await fetchAddDevkitDataSource(model.value);

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
  <ADrawer v-model:open="visible" :title="title" :width="560">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.devkit.datasource.dsName')" name="dsName">
        <AInput v-model:value="model.dsName" :maxlength="128" show-count />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.datasource.dsCode')" name="dsCode">
        <AInput v-model:value="model.dsCode" :maxlength="64" />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.datasource.dbType')" name="dbType">
        <ASelect v-model:value="model.dbType" :options="dbTypeOptions" />
      </AFormItem>
      <ARow :gutter="12">
        <ACol :span="16">
          <AFormItem :label="$t('page.devkit.datasource.host')" name="host">
            <AInput v-model:value="model.host" :maxlength="128" />
          </AFormItem>
        </ACol>
        <ACol :span="8">
          <AFormItem :label="$t('page.devkit.datasource.port')" name="port">
            <AInputNumber v-model:value="model.port" :min="1" :max="65535" class="w-full" />
          </AFormItem>
        </ACol>
      </ARow>
      <ARow :gutter="12">
        <ACol :span="12">
          <AFormItem :label="$t('page.devkit.datasource.databaseName')" name="databaseName">
            <AInput v-model:value="model.databaseName" :maxlength="128" />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem
            :label="$t('page.devkit.datasource.schemaName')"
            name="schemaName"
            :extra="$t('page.devkit.datasource.schemaHint')"
          >
            <AInput v-model:value="model.schemaName" :maxlength="128" />
          </AFormItem>
        </ACol>
      </ARow>
      <AFormItem :label="$t('page.devkit.datasource.username')" name="username">
        <AInput v-model:value="model.username" :maxlength="128" autocomplete="off" />
      </AFormItem>
      <AFormItem
        :label="$t('page.devkit.datasource.password')"
        name="password"
        :extra="isEdit ? $t('page.devkit.datasource.passwordEditHint') : $t('page.devkit.datasource.passwordHint')"
      >
        <AInputPassword v-model:value="model.password" :maxlength="256" autocomplete="new-password" />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.datasource.jdbcParams')" name="jdbcParams">
        <AInput v-model:value="model.jdbcParams" :maxlength="1024" />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.datasource.readOnly')" name="readOnly">
        <ASwitch v-model:checked="model.readOnly" />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.datasource.remark')" name="remark">
        <ATextarea v-model:value="model.remark" :rows="2" :maxlength="512" show-count />
      </AFormItem>
      <AFormItem v-if="isEdit" :label="$t('page.devkit.datasource.status')" name="status">
        <ARadioGroup v-model:value="model.status">
          <ARadio :value="1">{{ $t('page.devkit.common.enabled') }}</ARadio>
          <ARadio :value="0">{{ $t('page.devkit.common.disabled') }}</ARadio>
        </ARadioGroup>
      </AFormItem>
    </AForm>
    <template #footer>
      <div class="flex-y-center justify-between gap-12px">
        <AButton :loading="testLoading" @click="handleTest">
          {{ $t('page.devkit.datasource.test') }}
        </AButton>
        <div class="flex-y-center gap-12px">
          <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
          <AButton type="primary" :loading="submitLoading" @click="handleSubmit">
            {{ $t('common.confirm') }}
          </AButton>
        </div>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
