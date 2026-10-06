<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchGenerateDevkitProject, fetchGetDevkitProjectTemplates, fetchPreviewDevkitProject } from '@/service/api';
import { downloadBlob } from '@/utils/common';
import { $t } from '@/locales';
import DevkitGeneratedPreview from '../components/generated-preview.vue';

defineOptions({
  name: 'DevkitProject'
});

const templateOptions = ref<{ label: string; value: string }[]>([]);
const templateLoading = ref(false);
const previewLoading = ref(false);
const downloadLoading = ref(false);

const form = ref<Api.Devkit.ProjectGenRunParams>({
  templateGroupId: '',
  artifactId: 'demo-service',
  projectName: '',
  mavenGroupId: 'com.carlos.demo',
  version: '1.0.0-SNAPSHOT',
  describe: '',
  author: 'Carlos'
});

const result = ref<Api.Devkit.GeneratedResult | null>(null);

async function loadTemplates() {
  templateLoading.value = true;
  try {
    const { error, data } = await fetchGetDevkitProjectTemplates();
    if (error) {
      return;
    }
    templateOptions.value = data.map(item => ({ label: `${item.groupName} (${item.groupCode})`, value: item.id }));
    if (templateOptions.value.length === 1) {
      [form.value.templateGroupId] = [templateOptions.value[0].value];
    }
  } finally {
    templateLoading.value = false;
  }
}

function validateBeforeRun(): boolean {
  if (!form.value.templateGroupId) {
    window.$message?.warning?.($t('page.devkit.project.pickTemplateFirst'));
    return false;
  }
  if (!/^[a-z][a-z0-9-]*$/.test(form.value.artifactId)) {
    window.$message?.warning?.($t('page.devkit.project.invalidArtifactId'));
    return false;
  }
  if (!form.value.mavenGroupId) {
    window.$message?.warning?.($t('page.devkit.project.missingGroupId'));
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
    const { error, data } = await fetchPreviewDevkitProject(form.value);

    if (error) {
      window.$message?.error?.($t('page.devkit.project.previewFailed'));
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
    const { error, data } = await fetchGenerateDevkitProject(form.value);

    if (error || !data) {
      window.$message?.error?.($t('page.devkit.project.generateFailed'));
      return;
    }

    downloadBlob(data as Blob, `${form.value.artifactId}.zip`);
  } finally {
    downloadLoading.value = false;
  }
}

onMounted(loadTemplates);
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <ACard :title="$t('page.devkit.project.title')" :bordered="false" class="card-wrapper">
      <AForm layout="vertical" :model="form">
        <ARow :gutter="[16, 0]">
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.devkit.project.template')">
              <ASelect
                v-model:value="form.templateGroupId"
                :options="templateOptions"
                :loading="templateLoading"
                :placeholder="$t('page.devkit.project.form.template')"
              />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.devkit.project.artifactId')" :extra="$t('page.devkit.project.artifactIdHint')">
              <AInput v-model:value="form.artifactId" :maxlength="64" placeholder="demo-service" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem
              :label="$t('page.devkit.project.projectName')"
              :extra="$t('page.devkit.project.projectNameHint')"
            >
              <AInput v-model:value="form.projectName" :maxlength="128" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem
              :label="$t('page.devkit.project.mavenGroupId')"
              :extra="$t('page.devkit.project.mavenGroupIdHint')"
            >
              <AInput v-model:value="form.mavenGroupId" :maxlength="128" placeholder="com.carlos.demo" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.devkit.project.version')">
              <AInput v-model:value="form.version" :maxlength="64" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.devkit.project.author')">
              <AInput v-model:value="form.author" :maxlength="64" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :lg="12">
            <AFormItem :label="$t('page.devkit.project.describe')">
              <AInput v-model:value="form.describe" :maxlength="512" />
            </AFormItem>
          </ACol>
        </ARow>
      </AForm>
    </ACard>

    <ACard :bordered="false" class="flex-col-stretch card-wrapper">
      <template #title>
        <div class="flex-y-center justify-between">
          <span>{{ $t('page.devkit.project.previewTitle') }}</span>
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
