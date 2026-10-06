<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  fetchGenerateDevkitCodegen,
  fetchGetDevkitCodegenSchemas,
  fetchGetDevkitCodegenTables,
  fetchGetDevkitDataSourceOptions,
  fetchGetDevkitTemplateGroupOptions,
  fetchPreviewDevkitCodegen
} from '@/service/api';
import { enumDictNameOptions } from '@/utils/enum-dict';
import { downloadBlob } from '@/utils/common';
import { $t } from '@/locales';
import DevkitGeneratedPreview from '../components/generated-preview.vue';

defineOptions({
  name: 'DevkitCodegen'
});

const dsOptions = ref<{ label: string; value: string }[]>([]);
const groupOptions = ref<{ label: string; value: string }[]>([]);
const schemaOptions = ref<{ label: string; value: string }[]>([]);
const tableList = ref<Api.Devkit.TableMeta[]>([]);

const dsLoading = ref(false);
const schemaLoading = ref(false);
const tableLoading = ref(false);
const previewLoading = ref(false);
const downloadLoading = ref(false);

const keyword = ref('');
const selectedTables = ref<string[]>([]);

const form = ref<Api.Devkit.CodeGenRunParams>({
  dsId: '',
  schema: '',
  groupId: '',
  tableNames: [],
  projectName: 'demo-service',
  packageName: 'com.carlos.demo',
  author: 'Carlos',
  useTablePrefix: true,
  nameType: 'NOT_PREFIX_AND_CAMEL'
});

const result = ref<Api.Devkit.GeneratedResult | null>(null);

const nameTypeOptions = enumDictNameOptions('devkit', 'DevkitFieldNameType');

const filteredTables = computed(() => {
  const key = keyword.value.trim().toLowerCase();
  if (!key) {
    return tableList.value;
  }
  return tableList.value.filter(
    table => table.name.toLowerCase().includes(key) || (table.comment ?? '').toLowerCase().includes(key)
  );
});

const rowSelection = computed(() => ({
  selectedRowKeys: selectedTables.value,
  onChange: (keys: (string | number)[]) => {
    selectedTables.value = keys.map(String);
  }
}));

async function loadDataSourceOptions() {
  dsLoading.value = true;
  try {
    const { error, data } = await fetchGetDevkitDataSourceOptions();
    if (!error) {
      dsOptions.value = data.map(item => ({ label: item.dsName, value: item.id }));
    }
  } finally {
    dsLoading.value = false;
  }
}

async function loadGroupOptions() {
  const { error, data } = await fetchGetDevkitTemplateGroupOptions(1);
  if (!error) {
    groupOptions.value = data.map(item => ({ label: `${item.groupName} (${item.groupCode})`, value: item.id }));
  }
}

/** 切换数据源后清空下游状态，避免拿着旧 schema 去取新库的表 */
async function handleDataSourceChange() {
  form.value.schema = '';
  schemaOptions.value = [];
  tableList.value = [];
  selectedTables.value = [];
  result.value = null;

  if (!form.value.dsId) {
    return;
  }

  schemaLoading.value = true;
  try {
    const { error, data } = await fetchGetDevkitCodegenSchemas(form.value.dsId);
    if (error) {
      return;
    }
    schemaOptions.value = data.map(item => ({ label: item, value: item }));
    // PostgreSQL 默认 public，MySQL 取第一个库
    if (data.includes('public')) {
      form.value.schema = 'public';
    } else if (data.length > 0) {
      [form.value.schema] = data;
    }
  } finally {
    schemaLoading.value = false;
  }
}

async function loadTables() {
  if (!form.value.dsId) {
    window.$message?.warning?.($t('page.devkit.codegen.pickDatasourceFirst'));
    return;
  }

  tableLoading.value = true;
  try {
    const { error, data } = await fetchGetDevkitCodegenTables({
      dsId: form.value.dsId,
      schema: form.value.schema
    });

    if (error) {
      return;
    }
    tableList.value = data;
    selectedTables.value = [];
    result.value = null;
  } finally {
    tableLoading.value = false;
  }
}

function buildPayload(): Api.Devkit.CodeGenRunParams {
  return { ...form.value, tableNames: selectedTables.value };
}

function validateBeforeRun(): boolean {
  if (!form.value.dsId) {
    window.$message?.warning?.($t('page.devkit.codegen.pickDatasourceFirst'));
    return false;
  }
  if (!form.value.groupId) {
    window.$message?.warning?.($t('page.devkit.codegen.pickTemplateFirst'));
    return false;
  }
  if (selectedTables.value.length === 0) {
    window.$message?.warning?.($t('page.devkit.codegen.pickTableFirst'));
    return false;
  }
  return true;
}

async function handlePreview() {
  if (!validateBeforeRun()) {
    return;
  }

  previewLoading.value = true;
  try {
    const { error, data } = await fetchPreviewDevkitCodegen(buildPayload());

    if (error) {
      window.$message?.error?.($t('page.devkit.codegen.previewFailed'));
      return;
    }
    result.value = data;
  } finally {
    previewLoading.value = false;
  }
}

async function handleDownload() {
  if (!validateBeforeRun()) {
    return;
  }

  downloadLoading.value = true;
  try {
    const { error, data } = await fetchGenerateDevkitCodegen(buildPayload());

    if (error || !data) {
      window.$message?.error?.($t('page.devkit.codegen.generateFailed'));
      return;
    }

    downloadBlob(data as Blob, `${form.value.projectName}.zip`);
  } finally {
    downloadLoading.value = false;
  }
}

onMounted(() => {
  loadDataSourceOptions();
  loadGroupOptions();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <ACard :title="$t('page.devkit.codegen.title')" :bordered="false" class="card-wrapper">
      <AForm layout="vertical" :model="form">
        <ARow :gutter="[16, 0]">
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.devkit.codegen.datasource')">
              <ASelect
                v-model:value="form.dsId"
                :options="dsOptions"
                :loading="dsLoading"
                :placeholder="$t('page.devkit.codegen.form.datasource')"
                show-search
                option-filter-prop="label"
                @change="handleDataSourceChange"
              />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.devkit.codegen.schema')">
              <ASelect
                v-model:value="form.schema"
                :options="schemaOptions"
                :loading="schemaLoading"
                :placeholder="$t('page.devkit.codegen.form.schema')"
                allow-clear
                show-search
              />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.devkit.codegen.templateGroup')">
              <ASelect
                v-model:value="form.groupId"
                :options="groupOptions"
                :placeholder="$t('page.devkit.codegen.form.templateGroup')"
                show-search
                option-filter-prop="label"
              />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.devkit.codegen.projectName')">
              <AInput v-model:value="form.projectName" :maxlength="128" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.devkit.codegen.packageName')">
              <AInput v-model:value="form.packageName" :maxlength="256" placeholder="com.carlos.demo" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.devkit.codegen.author')">
              <AInput v-model:value="form.author" :maxlength="64" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.devkit.codegen.nameType')" :extra="$t('page.devkit.codegen.nameTypeHint')">
              <ASelect v-model:value="form.nameType" :options="nameTypeOptions" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.devkit.codegen.useTablePrefix')">
              <ASwitch v-model:checked="form.useTablePrefix" />
            </AFormItem>
          </ACol>
        </ARow>
      </AForm>
    </ACard>

    <ACard :bordered="false" class="flex-col-stretch card-wrapper">
      <template #title>
        <div class="flex-y-center justify-between">
          <span>{{ $t('page.devkit.codegen.tableSelection') }}</span>
          <div class="flex-y-center gap-8px">
            <AInput
              v-model:value="keyword"
              :placeholder="$t('page.devkit.codegen.form.keyword')"
              allow-clear
              class="w-200px"
            />
            <AButton :loading="tableLoading" @click="loadTables">{{ $t('page.devkit.codegen.loadTables') }}</AButton>
          </div>
        </div>
      </template>
      <div class="mb-8px text-12px text-gray-500">
        {{ $t('page.devkit.codegen.selectedCount', { count: selectedTables.length }) }}
      </div>
      <ATable
        :data-source="filteredTables"
        :row-selection="rowSelection"
        :loading="tableLoading"
        size="small"
        row-key="name"
        :pagination="{ pageSize: 10, showSizeChanger: false }"
        :scroll="{ y: 260 }"
      >
        <ATableColumn key="name" data-index="name" :title="$t('page.devkit.codegen.tableName')" width="260" />
        <ATableColumn key="comment" data-index="comment" :title="$t('page.devkit.codegen.tableComment')" ellipsis />
      </ATable>
    </ACard>

    <ACard :bordered="false" class="flex-col-stretch card-wrapper">
      <template #title>
        <div class="flex-y-center justify-between">
          <span>{{ $t('page.devkit.codegen.previewTitle') }}</span>
          <div class="flex-y-center gap-8px">
            <AButton :loading="previewLoading" @click="handlePreview">
              {{ $t('page.devkit.codegen.preview') }}
            </AButton>
            <AButton type="primary" :loading="downloadLoading" @click="handleDownload">
              {{ $t('page.devkit.codegen.download') }}
            </AButton>
          </div>
        </div>
      </template>
      <DevkitGeneratedPreview :result="result" :loading="previewLoading" />
    </ACard>
  </div>
</template>

<style scoped></style>
