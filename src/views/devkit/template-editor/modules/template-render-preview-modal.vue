<script setup lang="ts">
import { ref, watch } from 'vue';
import { fetchGetDevkitDataSourceOptions, fetchPreviewDevkitTemplate } from '@/service/api';
import { $t } from '@/locales';
import DevkitCodeEditor from '../../components/code-editor.vue';

defineOptions({
  name: 'DevkitTemplateRenderPreviewModal'
});

interface Props {
  templateId: string;
  filePath: string;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', { default: false });

const loading = ref(false);
const dsOptions = ref<{ label: string; value: string }[]>([]);

const model = ref<Api.Devkit.TemplateRenderPreviewParams>({
  templateId: '',
  dsId: '',
  schema: '',
  tableName: '',
  packageName: 'com.carlos.demo',
  author: 'Carlos',
  useTablePrefix: true,
  nameType: 'NOT_PREFIX_AND_CAMEL'
});

const result = ref<Api.Devkit.TemplateRenderPreview | null>(null);

async function loadDataSourceOptions() {
  const { error, data } = await fetchGetDevkitDataSourceOptions();
  if (error) {
    return;
  }
  dsOptions.value = data.map(item => ({ label: item.dsName, value: item.id }));
}

async function handleRender() {
  if (!model.value.dsId || !model.value.tableName) {
    window.$message?.warning?.($t('page.devkit.editor.previewRequired'));
    return;
  }

  loading.value = true;
  try {
    const { error, data } = await fetchPreviewDevkitTemplate({
      ...model.value,
      templateId: props.templateId
    });

    if (error) {
      window.$message?.error?.($t('page.devkit.editor.previewFailed'));
      return;
    }

    result.value = data;
  } finally {
    loading.value = false;
  }
}

watch(visible, () => {
  if (visible.value) {
    result.value = null;
    model.value.templateId = props.templateId;
    loadDataSourceOptions();
  }
});
</script>

<template>
  <AModal
    v-model:open="visible"
    :title="$t('page.devkit.editor.renderPreview')"
    :width="1000"
    :footer="null"
    :destroy-on-close="true"
  >
    <AForm layout="inline" class="mb-12px">
      <AFormItem :label="$t('page.devkit.codegen.datasource')" class="mb-8px">
        <ASelect
          v-model:value="model.dsId"
          :options="dsOptions"
          :placeholder="$t('page.devkit.codegen.form.datasource')"
          class="w-200px"
        />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.codegen.schema')" class="mb-8px">
        <AInput v-model:value="model.schema" placeholder="public" class="w-140px" />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.editor.sampleTable')" class="mb-8px">
        <AInput v-model:value="model.tableName" placeholder="sys_menu" class="w-180px" />
      </AFormItem>
      <AFormItem :label="$t('page.devkit.codegen.packageName')" class="mb-8px">
        <AInput v-model:value="model.packageName" class="w-200px" />
      </AFormItem>
      <AFormItem class="mb-8px">
        <AButton type="primary" :loading="loading" @click="handleRender">
          {{ $t('page.devkit.editor.render') }}
        </AButton>
      </AFormItem>
    </AForm>

    <div class="mb-4px text-12px text-gray-500">{{ props.filePath }}</div>
    <AAlert
      v-if="result && !result.success"
      type="error"
      show-icon
      :message="result.error ?? $t('page.devkit.editor.previewFailed')"
      class="mb-8px"
    />
    <DevkitCodeEditor
      v-if="result?.success"
      :model-value="result.content ?? ''"
      :path="props.filePath"
      readonly
      height="420px"
    />
    <div v-else-if="!result" class="min-h-200px flex-center text-gray-400">
      {{ $t('page.devkit.editor.previewHint') }}
    </div>
    <pre v-else class="max-h-420px overflow-auto whitespace-pre-wrap rounded-4px bg-gray-100 p-12px text-12px">{{
      result.error
    }}</pre>
  </AModal>
</template>

<style scoped></style>
