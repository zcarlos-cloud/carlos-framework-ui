<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  fetchAddInstance,
  fetchDiscoverInstances,
  fetchGetAllGroups,
  fetchTestConnection,
  fetchUpdateInstance
} from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';
import { isDbType } from '../../shared';

defineOptions({
  name: 'MonitorInstanceOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.Monitor.Instance | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const { formRef, validate, resetFields } = useAntdForm();
const { defaultRequiredRule, createMaxLengthRule, createNumberRangeRule } = useFormRules();

// 抽屉宽度 560：字段较多且含连接测试结果面板，默认 360 过窄
const NAME_MAX = 100;
const ADDRESSES_MAX = 1000;
const DB_NAME_MAX = 100;
const USERNAME_MAX = 100;
const PASSWORD_MAX = 200;
const EXT_CONFIG_MAX = 2000;
const REMARK_MAX = 500;

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.monitor.instance.addInstance'),
    edit: $t('page.manage.monitor.instance.editInstance')
  };
  return titles[props.operateType];
});

const groupOptions = ref<{ label: string; value: string }[]>([]);

const typeOptions = computed(() => [
  { label: $t('page.manage.monitor.common.typeRedisStandalone'), value: 'REDIS_STANDALONE' },
  { label: $t('page.manage.monitor.common.typeRedisCluster'), value: 'REDIS_CLUSTER' },
  { label: $t('page.manage.monitor.common.typeRedisSentinel'), value: 'REDIS_SENTINEL' },
  { label: $t('page.manage.monitor.common.typePostgresql'), value: 'POSTGRESQL' },
  { label: $t('page.manage.monitor.common.typeMysql'), value: 'MYSQL' },
  { label: $t('page.manage.monitor.common.typeDm'), value: 'DM' },
  { label: $t('page.manage.monitor.common.typeClickhouse'), value: 'CLICKHOUSE' },
  { label: $t('page.manage.monitor.common.typeMicroservice'), value: 'MICROSERVICE' }
]);

const envOptions = computed(() => [
  { label: 'dev', value: 'dev' },
  { label: 'test', value: 'test' },
  { label: 'prod', value: 'prod' }
]);

type Model = Api.Monitor.InstanceOperateParams;

const model = ref<Model>(createDefaultModel());

function createDefaultModel(): Model {
  return {
    instanceName: '',
    instanceType: 'REDIS_STANDALONE',
    env: 'dev',
    groupId: undefined,
    addresses: '',
    dbName: undefined,
    dbIndex: undefined,
    username: undefined,
    password: undefined,
    extConfig: undefined,
    collectEnabled: true,
    collectInterval: 30,
    connectTimeout: 3000,
    socketTimeout: 5000,
    manageEnabled: true,
    sqlWriteEnabled: false,
    remark: undefined,
    appNames: []
  };
}

type RuleKey = keyof Pick<
  Model,
  | 'instanceName'
  | 'instanceType'
  | 'env'
  | 'addresses'
  | 'dbName'
  | 'username'
  | 'extConfig'
  | 'remark'
  | 'collectInterval'
>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  instanceName: [{ ...defaultRequiredRule, whitespace: true }, createMaxLengthRule(NAME_MAX)],
  instanceType: [defaultRequiredRule],
  env: [defaultRequiredRule],
  addresses: [defaultRequiredRule, createMaxLengthRule(ADDRESSES_MAX)],
  dbName: isDbType(model.value.instanceType)
    ? [defaultRequiredRule, createMaxLengthRule(DB_NAME_MAX)]
    : [createMaxLengthRule(DB_NAME_MAX)],
  username: [createMaxLengthRule(USERNAME_MAX)],
  extConfig: [createMaxLengthRule(EXT_CONFIG_MAX)],
  remark: [createMaxLengthRule(REMARK_MAX)],
  collectInterval: [createNumberRangeRule(10, 600)]
}));

const showDbIndex = computed(() => model.value.instanceType === 'REDIS_STANDALONE');
const showDbName = computed(() => isDbType(model.value.instanceType));
const showSqlWrite = computed(() => isDbType(model.value.instanceType));

// ==================== 测试连接 ====================

const testing = ref(false);
const testResult = ref<Api.Monitor.TestConnectionResult | null>(null);

async function handleTestConnection() {
  testing.value = true;
  testResult.value = null;
  try {
    const params: Api.Monitor.TestConnectionParams =
      isEdit.value && !model.value.password
        ? { instanceId: props.rowData?.id }
        : {
            instanceType: model.value.instanceType,
            addresses: model.value.addresses,
            dbName: model.value.dbName,
            dbIndex: model.value.dbIndex,
            username: model.value.username,
            password: model.value.password,
            extConfig: model.value.extConfig,
            connectTimeout: model.value.connectTimeout,
            socketTimeout: model.value.socketTimeout
          };
    const { data, error } = await fetchTestConnection(params);
    if (error || !data) {
      return;
    }
    testResult.value = data;
  } finally {
    testing.value = false;
  }
}

// ==================== Nacos 自动发现 ====================

const discoverVisible = ref(false);
const discoverLoading = ref(false);
const discoverAppName = ref('');
const discoverGroup = ref('DEFAULT_GROUP');
const drafts = ref<Api.Monitor.InstanceDraft[]>([]);

async function handleDiscover() {
  if (!discoverAppName.value) {
    window.$message?.warning?.($t('page.manage.monitor.instance.form.discoverAppName'));
    return;
  }
  discoverLoading.value = true;
  try {
    const { data, error } = await fetchDiscoverInstances({
      appName: discoverAppName.value,
      group: discoverGroup.value
    });
    if (error || !data) {
      return;
    }
    drafts.value = data;
  } finally {
    discoverLoading.value = false;
  }
}

function applyDraft(draft: Api.Monitor.InstanceDraft) {
  model.value.instanceName = draft.instanceName ?? model.value.instanceName;
  if (draft.instanceType) {
    model.value.instanceType = draft.instanceType;
  }
  model.value.addresses = draft.addresses ?? model.value.addresses;
  model.value.dbName = draft.dbName ?? model.value.dbName;
  model.value.dbIndex = draft.dbIndex ?? model.value.dbIndex;
  model.value.username = draft.username ?? model.value.username;
  if (!model.value.appNames?.includes(discoverAppName.value)) {
    model.value.appNames = [...(model.value.appNames ?? []), discoverAppName.value];
  }
  discoverVisible.value = false;
  window.$message?.success?.($t('page.manage.monitor.instance.discoverApplied'));
}

// ==================== 提交 ====================

function handleInitModel() {
  model.value = createDefaultModel();
  testResult.value = null;

  if (props.operateType === 'edit' && props.rowData) {
    const row = props.rowData;

    // 显式挑选字段；密码为敏感字段，绝不回填（留空表示不修改）
    model.value = {
      id: row.id,
      instanceName: row.instanceName ?? '',
      instanceType: row.instanceType,
      env: row.env,
      groupId: row.groupId,
      addresses: row.addresses ?? '',
      dbName: row.dbName,
      dbIndex: row.dbIndex,
      username: row.username,
      password: undefined,
      extConfig: row.extConfig,
      collectEnabled: row.collectEnabled ?? true,
      collectInterval: row.collectInterval ?? 30,
      connectTimeout: row.connectTimeout ?? 3000,
      socketTimeout: row.socketTimeout ?? 5000,
      manageEnabled: row.manageEnabled ?? true,
      sqlWriteEnabled: row.sqlWriteEnabled ?? false,
      remark: row.remark,
      appNames: row.appNames ? [...row.appNames] : []
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
    // 去除首尾空白，避免脏数据
    model.value.instanceName = model.value.instanceName.trim();
    const params: Api.Monitor.InstanceOperateParams = { ...model.value };

    // 密码留空 = 不修改，必须从 payload 删除（提交空串会覆盖原密码）
    if (!params.password) {
      delete params.password;
    }

    const { error } = isEdit.value ? await fetchUpdateInstance(params) : await fetchAddInstance(params);

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

async function loadGroups() {
  const { data, error } = await fetchGetAllGroups();
  if (error || !data) {
    return;
  }
  groupOptions.value = data.map(item => ({ label: item.groupName, value: item.id }));
}

watch(visible, () => {
  if (visible.value) {
    handleInitModel();
    resetFields();
    // 分组可能在他处新增/修改，每次打开抽屉都刷新下拉，避免缓存失效
    loadGroups();
  }
});

onMounted(() => {
  loadGroups();
});
</script>

<template>
  <ADrawer v-model:open="visible" :title="title" :width="560">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <ARow :gutter="16">
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.instance.instanceName')" name="instanceName">
            <AInput
              v-model:value="model.instanceName"
              :maxlength="NAME_MAX"
              :placeholder="$t('page.manage.monitor.instance.form.instanceName')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.instance.instanceType')" name="instanceType">
            <ASelect
              v-model:value="model.instanceType"
              :options="typeOptions"
              :disabled="isEdit"
              :placeholder="$t('page.manage.monitor.instance.form.instanceType')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.instance.env')" name="env">
            <ASelect
              v-model:value="model.env"
              :options="envOptions"
              :placeholder="$t('page.manage.monitor.instance.form.env')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.instance.groupId')" name="groupId">
            <ASelect
              v-model:value="model.groupId"
              :options="groupOptions"
              :placeholder="$t('page.manage.monitor.instance.form.groupId')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24">
          <AFormItem :label="$t('page.manage.monitor.instance.addresses')" name="addresses">
            <ATextarea
              v-model:value="model.addresses"
              :maxlength="ADDRESSES_MAX"
              :rows="2"
              :placeholder="$t('page.manage.monitor.instance.form.addresses')"
            />
          </AFormItem>
        </ACol>
        <ACol v-if="showDbName" :span="12">
          <AFormItem :label="$t('page.manage.monitor.instance.dbName')" name="dbName">
            <AInput
              v-model:value="model.dbName"
              :maxlength="DB_NAME_MAX"
              :placeholder="$t('page.manage.monitor.instance.form.dbName')"
            />
          </AFormItem>
        </ACol>
        <ACol v-if="showDbIndex" :span="12">
          <AFormItem :label="$t('page.manage.monitor.instance.dbIndex')" name="dbIndex">
            <AInputNumber
              v-model:value="model.dbIndex"
              :min="0"
              :max="15"
              class="w-full"
              :placeholder="$t('page.manage.monitor.instance.form.dbIndex')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.instance.username')" name="username">
            <AInput
              v-model:value="model.username"
              :maxlength="USERNAME_MAX"
              :placeholder="$t('page.manage.monitor.instance.form.username')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.instance.password')" name="password">
            <AInputPassword
              v-model:value="model.password"
              :maxlength="PASSWORD_MAX"
              :placeholder="
                isEdit ? $t('page.manage.common.leaveBlankToKeep') : $t('page.manage.monitor.instance.form.password')
              "
            />
          </AFormItem>
        </ACol>
        <ACol :span="24">
          <AFormItem :label="$t('page.manage.monitor.instance.extConfig')" name="extConfig">
            <ATextarea
              v-model:value="model.extConfig"
              :maxlength="EXT_CONFIG_MAX"
              :rows="2"
              :placeholder="$t('page.manage.monitor.instance.form.extConfig')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.instance.collectInterval')" name="collectInterval">
            <AInputNumber v-model:value="model.collectInterval" :min="10" :max="600" class="w-full" />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.manage.monitor.instance.appNames')" name="appNames">
            <ASelect
              v-model:value="model.appNames"
              mode="tags"
              :placeholder="$t('page.manage.monitor.instance.form.appNames')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="8">
          <AFormItem :label="$t('page.manage.monitor.instance.collectEnabled')" name="collectEnabled">
            <ASwitch v-model:checked="model.collectEnabled" />
          </AFormItem>
        </ACol>
        <ACol :span="8">
          <AFormItem :label="$t('page.manage.monitor.instance.manageEnabled')" name="manageEnabled">
            <ASwitch v-model:checked="model.manageEnabled" />
          </AFormItem>
        </ACol>
        <ACol v-if="showSqlWrite" :span="8">
          <AFormItem :label="$t('page.manage.monitor.instance.sqlWriteEnabled')" name="sqlWriteEnabled">
            <ASwitch v-model:checked="model.sqlWriteEnabled" />
          </AFormItem>
        </ACol>
        <ACol :span="24">
          <AFormItem :label="$t('page.manage.monitor.instance.remark')" name="remark">
            <ATextarea
              v-model:value="model.remark"
              :maxlength="REMARK_MAX"
              :rows="2"
              :placeholder="$t('page.manage.monitor.instance.form.remark')"
            />
          </AFormItem>
        </ACol>
      </ARow>
    </AForm>

    <ADivider class="my-12px" />
    <div class="flex-y-center gap-12px">
      <AButton :loading="testing" @click="handleTestConnection">
        {{ $t('page.manage.monitor.instance.testConnection') }}
      </AButton>
      <AButton v-if="!isEdit" @click="discoverVisible = true">
        {{ $t('page.manage.monitor.instance.discover') }}
      </AButton>
    </div>

    <AAlert v-if="testResult" :type="testResult.success ? 'success' : 'error'" show-icon class="mt-12px">
      <template #message>
        {{
          testResult.success
            ? $t('page.manage.monitor.instance.testSuccess')
            : $t('page.manage.monitor.instance.testFailed')
        }}
        <span v-if="testResult.elapsedMs !== undefined" class="ml-8px">{{ testResult.elapsedMs }} ms</span>
      </template>
      <template #description>
        <div v-if="testResult.version">
          {{ $t('page.manage.monitor.instance.testVersion') }}: {{ testResult.version }}
        </div>
        <div v-if="testResult.role">{{ $t('page.manage.monitor.instance.testRole') }}: {{ testResult.role }}</div>
        <div v-if="testResult.errorMsg">{{ testResult.errorMsg }}</div>
        <div v-if="testResult.nodes?.length" class="mt-4px">
          <ATag v-for="node in testResult.nodes" :key="node.address" class="mb-4px">
            {{ node.address }} · {{ node.role }} · {{ node.status }}
          </ATag>
        </div>
      </template>
    </AAlert>

    <AModal
      v-model:open="discoverVisible"
      :title="$t('page.manage.monitor.instance.discover')"
      :footer="null"
      :width="520"
    >
      <div class="flex-y-center gap-12px">
        <AInput
          v-model:value="discoverAppName"
          :placeholder="$t('page.manage.monitor.instance.form.discoverAppName')"
        />
        <AInput
          v-model:value="discoverGroup"
          class="w-180px"
          :placeholder="$t('page.manage.monitor.instance.form.discoverGroup')"
        />
        <AButton type="primary" :loading="discoverLoading" @click="handleDiscover">
          {{ $t('page.manage.monitor.instance.discoverRun') }}
        </AButton>
      </div>
      <AList :data-source="drafts" size="small" class="mt-16px" :locale="{ emptyText: $t('common.noData') }">
        <template #renderItem="{ item }">
          <AListItem>
            <div class="w-full flex-y-center justify-between gap-8px">
              <div class="flex-1">
                <div>{{ item.instanceName }}（{{ item.instanceType }}）</div>
                <div class="text-12px text-#999">
                  {{ item.addresses }}
                  <template v-if="item.dbName">/ {{ item.dbName }}</template>
                </div>
              </div>
              <AButton size="small" type="link" @click="applyDraft(item)">
                {{ $t('page.manage.monitor.instance.discoverApply') }}
              </AButton>
            </div>
          </AListItem>
        </template>
      </AList>
    </AModal>

    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" @click="handleSubmit">
          {{ $t('common.confirm') }}
        </AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
