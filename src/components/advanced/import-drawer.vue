<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Upload } from 'ant-design-vue';
import type { UploadProps } from 'ant-design-vue';
import type { FlatResponseData } from '@sa/axios';
import type { ExportRunner } from '@/hooks/business/use-export';
import { useExport } from '@/hooks/business/use-export';
import { $t } from '@/locales';

defineOptions({
  name: 'ImportDrawer'
});

/** 导入预览的一行：后端按 Excel 列名下发，另带一个 `error` 表示该行的校验失败原因 */
type PreviewRow = Record<string, unknown>;

interface Props {
  /** 抽屉标题（已翻译文案，i18n 由调用方负责，各模块标题不同） */
  title: string;
  /** 下载导入模板；不传则不显示模板区 */
  templateFn?: ExportRunner;
  /** 模板文件名主体，会追加时间戳与 .xlsx */
  templateName?: string;
  /**
   * 一次性导入（与 previewFn + confirmFn 二选一）
   *
   * 写成 `FlatResponseData<unknown>` 而不是更精确的类型，是为了让各模块的
   * `fetchImportXxx()` 直接传进来 —— 本组件只关心「成没成」，不解释返回值。
   */
  importFn?: (file: File) => Promise<FlatResponseData<unknown>>;
  /** 两阶段导入第一步：上传并返回**逐行**校验结果（每行带 error 字段） */
  previewFn?: (file: File) => Promise<FlatResponseData<PreviewRow[]>>;
  /** 两阶段导入第二步：写回用户复核过的行（有 error 的行由后端跳过） */
  confirmFn?: (rows: PreviewRow[]) => Promise<FlatResponseData<unknown>>;
  /** 预览表格要展示的列（错误列由组件自动追加） */
  previewColumns?: { key: string; title: string }[];
  /**
   * 额外的警示文案（可选）
   *
   * 给调用方一个位置说明「模板里有、但实际不会被导入」的列之类的坑 ——
   * 这类信息如果不说，用户填了却静默丢弃，比报错更难发现。
   */
  notice?: string;
}

const props = defineProps<Props>();

interface Emits {
  /** 导入成功，调用方据此刷新列表 */
  (e: 'imported'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { exporting, exportFile } = useExport();

/**
 * 两阶段模式：先预览校验、再由用户确认写入
 *
 * 用「选完文件就自动预览」而不是多一步按钮，是因为预览是只读的 ——
 * 多一次点击只是多一次无谓的往返；而真正需要用户决策的是「确认写入」那一步。
 */
const isTwoPhase = computed(() => Boolean(props.previewFn && props.confirmFn));

const importing = ref(false);
const previewing = ref(false);
const previewRows = ref<PreviewRow[]>([]);

/** 用 antd 自己的 fileList 类型，避免 any */
const fileList = ref<NonNullable<UploadProps['fileList']>>([]);

/**
 * 后端 `ExcelUtil.checkExcel` 的白名单就是 xls / xlsx
 *
 * ⚠️ 后端那个判断是**大小写敏感**的（`CharSequenceUtil.equalsAny(extName, "xls", "xlsx")`），
 * 所以一个叫 `用户.XLSX` 的文件会被后端拒掉。前端这里统一转小写再比，
 * 是更宽松的一侧 —— 不会出现「前端放行、后端莫名报错」以外的偏差，
 * 但遇到后端报「不支持的excel文件类型」时要知道是这个原因。
 */
const ACCEPT = '.xls,.xlsx';

const ALLOWED_EXT = ['xls', 'xlsx'];

function fileExt(name: string) {
  const dot = name.lastIndexOf('.');

  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** 阻止自动上传，改为手动控制提交时机 */
const beforeUpload: UploadProps['beforeUpload'] = file => {
  if (!ALLOWED_EXT.includes(fileExt(file.name ?? ''))) {
    window.$message?.error?.($t('common.invalidFileType'));

    // 返回 LIST_IGNORE 才是「不加入 fileList」；返回 false 只是不自动上传，
    // 文件仍会留在列表里，用户点确认就会把一个非法文件提交上去
    return Upload.LIST_IGNORE;
  }

  return false;
};

const selectedCount = computed(() => fileList.value?.length ?? 0);

/** 有 error 的行即校验失败，后端在 confirm 时会跳过它们 */
function rowError(row: PreviewRow) {
  return String(row.error ?? '');
}

const validCount = computed(() => previewRows.value.filter(row => rowError(row) === '').length);
const invalidCount = computed(() => previewRows.value.length - validCount.value);

/** 预览表格列 = 调用方给的列 + 自动追加的错误列 */
const previewTableColumns = computed(() =>
  [...(props.previewColumns ?? []), { key: 'error', title: $t('common.importErrorColumn') }].map(col => ({
    ...col,
    dataIndex: col.key,
    align: 'center' as const,
    ellipsis: true
  }))
);

function closeDrawer() {
  visible.value = false;
}

async function downloadTemplate() {
  if (!props.templateFn) {
    return;
  }

  await exportFile(props.templateFn, props.templateName ?? 'import_template');
}

function currentFile() {
  return fileList.value?.[0]?.originFileObj as File | undefined;
}

async function runPreview() {
  const raw = currentFile();

  if (!raw || !props.previewFn) {
    return;
  }

  previewing.value = true;
  previewRows.value = [];

  try {
    const { data, error } = await props.previewFn(raw);

    if (error) {
      // 请求层已弹过提示，此处不得重复
      return;
    }

    previewRows.value = data ?? [];

    if (previewRows.value.length === 0) {
      window.$message?.warning?.($t('common.importPreviewEmpty'));
    }
  } finally {
    previewing.value = false;
  }
}

async function handleSubmit() {
  const raw = currentFile();

  if (!raw) {
    window.$message?.warning?.($t('common.selectFile'));

    return;
  }

  importing.value = true;

  try {
    // 两阶段：把预览结果整体回传，后端会跳过带 error 的行
    const { error } = isTwoPhase.value ? await props.confirmFn!(previewRows.value) : await props.importFn!(raw);

    if (error) {
      return;
    }

    window.$message?.success?.($t('common.importSuccess'));
    closeDrawer();
    emit('imported');
  } finally {
    importing.value = false;
  }
}

watch(visible, value => {
  if (value) {
    fileList.value = [];
    previewRows.value = [];
  }
});

/** 选完文件即自动预览（仅两阶段模式） */
watch(selectedCount, count => {
  if (isTwoPhase.value && count > 0) {
    runPreview();
  }
});
</script>

<template>
  <!-- 导入要展示模板提示 + 选择文件 + 预览结果，比默认 360 宽一档 -->
  <ADrawer v-model:open="visible" :title="title" :width="isTwoPhase ? 720 : 480">
    <div class="flex flex-col gap-16px">
      <AAlert type="info" show-icon :message="$t('common.importHint')" />

      <AAlert v-if="notice" type="warning" show-icon :message="notice" />

      <AButton v-if="templateFn" :loading="exporting" @click="downloadTemplate">
        <template #icon>
          <icon-mdi-download class="align-sub text-icon" />
        </template>
        <span class="ml-8px">{{ $t('common.importTemplate') }}</span>
      </AButton>

      <AUpload v-model:file-list="fileList" :accept="ACCEPT" :before-upload="beforeUpload" :max-count="1">
        <AButton :disabled="importing || previewing">
          <template #icon>
            <icon-ic-round-plus class="align-sub text-icon" />
          </template>
          <span class="ml-8px">{{ $t('common.selectFile') }}</span>
        </AButton>
      </AUpload>

      <!-- 两阶段模式的预览结果：异常行必须一眼可见，否则用户会以为全部导入了 -->
      <template v-if="isTwoPhase && (previewing || previewRows.length > 0)">
        <AAlert
          v-if="!previewing"
          :type="invalidCount > 0 ? 'warning' : 'success'"
          show-icon
          :message="
            $t('common.importPreviewSummary', { total: previewRows.length, valid: validCount, invalid: invalidCount })
          "
        />
        <ATable
          :columns="previewTableColumns"
          :data-source="previewRows"
          :loading="previewing"
          :pagination="false"
          :scroll="{ x: 900, y: 320 }"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'error'">
              <ATag v-if="rowError(record)" color="error">{{ rowError(record) }}</ATag>
              <ATag v-else color="success">{{ $t('common.importRowOk') }}</ATag>
            </template>
          </template>
        </ATable>
      </template>
    </div>

    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton
          type="primary"
          :loading="importing"
          :disabled="selectedCount === 0 || previewing || (isTwoPhase && validCount === 0)"
          @click="handleSubmit"
        >
          {{ isTwoPhase ? $t('common.confirmImport') : $t('common.confirm') }}
        </AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
