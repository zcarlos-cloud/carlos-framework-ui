<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Upload } from 'ant-design-vue';
import type { UploadProps } from 'ant-design-vue';
import { fetchDeleteFile, fetchDownloadFile, fetchGetFileDetail, fetchUploadFile } from '@/service/api';
import { downloadBlob, formatFileSize } from '@/utils/common';
import { $t } from '@/locales';

defineOptions({
  name: 'FileUpload'
});

/**
 * 通用文件上传组件，对接后端 /sys/file 统一文件服务：
 * - 上传：POST /sys/file/upload（multipart，字段 files + namespace），见 fetchUploadFile
 * - 回显：GET /sys/file/detail?id=（取原始文件名/大小），见 fetchGetFileDetail
 * - 下载：GET /sys/file/load?id=（走请求层带 token，img 标签直连会 401），见 fetchDownloadFile
 * - 删除：POST /sys/file/delete（仅 deleteOnRemove 开启时调用）
 *
 * ⚠️ 绑定值约定：value 每一项是**文件 id**（字符串），或 /sys/file/load?id= 完整地址
 * （会自动提取 id）。组件对外只回写 id —— 下载地址的 host 由服务端 carlos.system.file.base-url
 * 配置决定，可能配错（该默认值就一度指向 9511 而非文件服务），id 才是稳定主键。
 * 调用方需要展示地址时，用 change/uploaded 事件里 FileInfo 的 url 字段。
 */

interface Props {
  /** 绑定值：单文件为 string | undefined，多文件为 string[]；每项是文件 id 或 load?id= 地址 */
  value?: string | string[];
  /** 上传命名空间（对应 OSS bucket），沿用现有约定：default / avatar / config ... */
  namespace?: string;
  /** 多文件模式 */
  multiple?: boolean;
  /** 最大文件数；不传时单文件为 1，多文件不限 */
  maxCount?: number;
  /** 原生 accept（如 ".jpg,.png" / "image/*"），只影响系统文件选择器 */
  accept?: string;
  /**
   * 扩展名白名单（如 ['jpg', 'png']），选中后先做客户端校验，不合法直接拒绝。
   * 不传时尝试从 accept 推导（".jpg,.png" 形式）；推导不出（如 image/*）则不校验。
   * 注意：后端 carlos.system.file.support-ext 还有一道最终白名单，两边需保持一致口径
   */
  extensions?: string[];
  /** 单文件大小上限（MB），默认 100（与后端 carlos.system.file.max-file-size 默认值一致） */
  maxFileSize?: number;
  /** 图片模式：图片文件显示缩略图（鉴权下载转 objectURL），点击可预览 */
  picture?: boolean;
  /** 拖拽上传（大块区域），默认 false（按钮式） */
  drag?: boolean;
  /** 禁用上传与删除 */
  disabled?: boolean;
  /** 纯展示：不出现上传入口与删除按钮，保留下载/预览 */
  readonly?: boolean;
  /** 从列表移除时同步调用后端删除文件记录与对象；默认 false（仅解除绑定，文件保留） */
  deleteOnRemove?: boolean;
  /**
   * 上传前转换钩子（如图片裁剪/压缩）：客户端校验通过后、上传前调用，
   * 入参是选中的原始文件，resolve 转换后的文件继续上传；
   * resolve null/undefined 表示中止本次上传（静默移除，不产生错误项，如用户取消裁剪）
   */
  transformFile?: (file: File) => Promise<File | null | undefined>;
}

const props = withDefaults(defineProps<Props>(), {
  value: undefined,
  namespace: 'default',
  multiple: false,
  maxCount: undefined,
  accept: undefined,
  extensions: undefined,
  maxFileSize: 100,
  picture: false,
  drag: false,
  disabled: false,
  readonly: false,
  deleteOnRemove: false,
  transformFile: undefined
});

interface Emits {
  /** 绑定值回写：单文件 string | undefined，多文件 string[]（统一为文件 id） */
  (e: 'update:value', value: string | string[] | undefined): void;
  /** 已绑定文件（有 id）的完整信息列表，上传/移除/回显加载后触发 */
  (e: 'change', files: Api.SystemManage.FileInfo[]): void;
  /** 单个文件上传成功（change 的细化事件，便于单文件场景取 url） */
  (e: 'uploaded', file: Api.SystemManage.FileInfo): void;
}

const emit = defineEmits<Emits>();

const modelValue = defineModel<string | string[] | undefined>('value', {
  default: undefined
});

interface UploadItem {
  uid: string;
  /** 后端文件 id；上传完成或回显加载后才有 */
  id?: string;
  /** 展示文件名（优先后端返回的原始文件名，上传前用本地名兜底） */
  name: string;
  size?: number;
  status: 'uploading' | 'done' | 'error';
  raw?: File;
  /** 后端文件信息（fetchGetFileDetail / 上传响应） */
  detail?: Api.SystemManage.FileInfo;
  /** 图片缩略图 objectURL（picture 模式才加载，移除/卸载时必须 revoke） */
  thumb?: string;
}

const items = ref<UploadItem[]>([]);

const uploading = computed(() => items.value.some(item => item.status === 'uploading'));

/** 实际数量上限：显式 maxCount 优先；单文件默认 1，多文件不限 */
const limit = computed(() => props.maxCount ?? (props.multiple ? Number.POSITIVE_INFINITY : 1));

const isLimited = computed(() => items.value.length >= limit.value);

/** 图片扩展名兜底（detail.contentType 缺失时按后缀判断） */
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

let uidSeed = 0;

function nextUid() {
  uidSeed += 1;
  return `file-upload-${Date.now()}-${uidSeed}`;
}

function fileExt(name: string) {
  const dot = name.lastIndexOf('.');

  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** 从 accept（".jpg,.png" 形式）推导扩展名白名单；推导不出返回 undefined */
function deriveExtensionsFromAccept() {
  if (!props.accept) {
    return undefined;
  }

  const exts = props.accept
    .split(',')
    .map(part => part.trim().toLowerCase())
    .filter(part => part.startsWith('.'))
    .map(part => part.slice(1))
    .filter(Boolean);

  return exts.length > 0 ? exts : undefined;
}

/** 生效的扩展名白名单：显式 extensions 优先，其次从 accept 推导 */
function effectiveExtensions() {
  if (props.extensions?.length) {
    return props.extensions.map(ext => ext.toLowerCase());
  }

  return deriveExtensionsFromAccept();
}

/**
 * 从绑定值项中提取文件 id
 *
 * 只认 ?id= 查询参数（与 use-authed-image-url 的口径一致），
 * 完整 URL 但认不出 id 的非本文件服务地址无法按 id 管理，直接忽略
 */
function extractFileId(entry: string): string | null {
  const text = entry.trim();

  if (!text) {
    return null;
  }

  const matched = /[?&]id=([^&]+)/.exec(text);

  if (matched) {
    return decodeURIComponent(matched[1]);
  }

  if (/^https?:\/\//.test(text)) {
    return null;
  }

  return text;
}

function normalizeValue(): string[] {
  const raw = modelValue.value;

  if (raw === undefined || raw === null) {
    return [];
  }

  const entries = Array.isArray(raw) ? raw : [raw];

  return entries.map(extractFileId).filter((id): id is string => Boolean(id));
}

function isImageItem(item: UploadItem) {
  const contentType = item.detail?.contentType ?? item.raw?.type ?? '';

  if (contentType.startsWith('image/')) {
    return true;
  }

  return IMAGE_EXTENSIONS.includes(fileExt(item.name));
}

/** 回显加载：按 id 拉文件详情（原始文件名/大小），失败标记 error 展示重试 */
async function loadDetail(item: UploadItem) {
  if (!item.id) {
    return;
  }

  const { data, error } = await fetchGetFileDetail(item.id);

  if (error || !data) {
    item.status = 'error';
    return;
  }

  item.detail = data;
  item.name = data.name || item.name;
  item.size = data.fileSize ?? item.size;
  item.status = 'done';

  if (props.picture && isImageItem(item)) {
    loadThumb(item);
  }
}

/** 图片缩略图：走带 token 的下载接口取 Blob 转 objectURL（img 直连 /sys/file/load 会 401） */
async function loadThumb(item: UploadItem) {
  if (item.thumb || !item.id) {
    return;
  }

  const { data } = await fetchDownloadFile(item.id);

  if (data) {
    item.thumb = URL.createObjectURL(data);
  }
}

function revokeThumb(item: UploadItem) {
  if (item.thumb) {
    URL.revokeObjectURL(item.thumb);
    item.thumb = undefined;
  }
}

function removeFromList(item: UploadItem) {
  revokeThumb(item);
  items.value = items.value.filter(entry => entry.uid !== item.uid);
}

/** 对外回写：仅统计已拿到 id 的条目，并同步 change 事件 */
function emitValue() {
  const bound = items.value.filter(item => item.id);

  const ids = bound.flatMap(item => (item.id ? [item.id] : []));

  modelValue.value = props.multiple ? ids : ids[0];
  emit(
    'change',
    bound.flatMap(item => (item.detail ? [item.detail] : []))
  );
}

/**
 * 绑定值 → 列表的同步（父组件清空/回填/表单初始值都走这里）
 *
 * 以 id 数组相等为循环终止条件：自身 emitValue 触发的回写与当前列表一致，
 * 不会引起二次重建；不一致时按 id 保留已有项、补拉新项详情、丢弃多余项
 */
watch(
  modelValue,
  async () => {
    const ids = normalizeValue();
    const current = items.value.map(item => item.id).filter((id): id is string => Boolean(id));

    if (ids.length === current.length && ids.every((id, index) => id === current[index])) {
      return;
    }

    const previous = items.value;

    const next: UploadItem[] = ids.map(id => {
      const existing = previous.find(item => item.id === id);

      if (existing) {
        return existing;
      }

      // 占位项：状态 uploading 仅用于显示加载中，详情拉取完成后转 done
      return { uid: nextUid(), id, name: id, status: 'uploading' };
    });

    // 释放被丢弃项的缩略图（保留项与新建占位项都无需处理）
    const nextUids = new Set(next.map(item => item.uid));
    previous.filter(item => !nextUids.has(item.uid)).forEach(revokeThumb);

    items.value = next;

    await Promise.all(next.filter(item => !item.detail).map(item => loadDetail(item)));

    // 初始回显加载完成后同步一次 change，调用方可拿到 FileInfo（url 等）做展示；
    // 空值不广播，避免每个实例挂载都刷一次空事件
    if (next.length > 0) {
      emit(
        'change',
        next.flatMap(item => (item.detail ? [item.detail] : []))
      );
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  items.value.forEach(revokeThumb);
});

/** 客户端校验 + 入列 + 触发上传；返回 false 阻止 antd 自动上传（时机由组件控制） */
const beforeUpload: UploadProps['beforeUpload'] = file => {
  if (items.value.length >= limit.value) {
    window.$message?.error?.($t('common.uploadCountLimited', { count: limit.value }));
    return Upload.LIST_IGNORE;
  }

  const allowed = effectiveExtensions();
  const ext = fileExt(file.name ?? '');

  if (allowed && !allowed.includes(ext)) {
    window.$message?.error?.(
      $t('common.uploadTypeLimited', { extensions: allowed.map(item => `.${item}`).join(' / ') })
    );
    return Upload.LIST_IGNORE;
  }

  if (file.size > props.maxFileSize * 1024 * 1024) {
    window.$message?.error?.($t('common.uploadSizeLimited', { size: formatFileSize(props.maxFileSize * 1024 * 1024) }));
    return Upload.LIST_IGNORE;
  }

  const item: UploadItem = {
    uid: nextUid(),
    name: file.name,
    size: file.size,
    status: 'uploading',
    raw: file
  };

  items.value = [...items.value, item];
  startUpload(item);

  return false;
};

/** 转换钩子（如有）→ 上传；钩子里用户取消（resolve 空）时静默移除 */
async function startUpload(item: UploadItem) {
  if (props.transformFile && item.raw) {
    try {
      const transformed = await props.transformFile(item.raw);

      if (!transformed) {
        removeFromList(item);
        return;
      }

      item.raw = transformed;
      item.name = transformed.name || item.name;
      item.size = transformed.size;
    } catch {
      // 转换异常（如裁剪组件出错）：请求层之外的本地失败，标错误态交给用户重试
      item.status = 'error';
      return;
    }
  }

  await doUpload(item);
}

async function doUpload(item: UploadItem) {
  if (!item.raw) {
    return;
  }

  item.status = 'uploading';

  const { data, error } = await fetchUploadFile(item.raw, props.namespace);

  // 请求层已弹过错误提示，此处只更新状态
  if (error || !data?.files?.length) {
    item.status = 'error';
    return;
  }

  const info = data.files[0];

  item.id = info.id;
  item.name = info.name || item.name;
  item.size = info.fileSize ?? item.size;
  item.detail = info;
  item.status = 'done';

  if (props.picture && isImageItem(item)) {
    loadThumb(item);
  }

  emitValue();
  emit('uploaded', info);
}

/** 失败重试：本地文件重新上传，回显占位项重新拉详情 */
function retryItem(item: UploadItem) {
  if (item.raw) {
    doUpload(item);
  } else if (item.id) {
    item.status = 'uploading';
    loadDetail(item);
  }
}

/** 下载：走带 token 的请求取 Blob 后本地落地（后端流式接口直开新页会被 401 拦） */
async function downloadItem(item: UploadItem) {
  if (!item.id) {
    return;
  }

  const { data, error } = await fetchDownloadFile(item.id);

  if (error || !data) {
    return;
  }

  downloadBlob(data, item.name);
}

function removeItem(item: UploadItem) {
  removeFromList(item);

  // 默认只解除绑定不删服务端文件（文件可能被其它业务引用）；
  // deleteOnRemove 开启时同步删除，失败由请求层提示
  if (props.deleteOnRemove && item.id) {
    fetchDeleteFile(item.id);
  }

  emitValue();
}

function clear() {
  items.value.forEach(revokeThumb);
  items.value = [];
  emitValue();
}

defineExpose({
  clear,
  uploading
});
</script>

<template>
  <div class="flex flex-col gap-8px">
    <AUploadDragger
      v-if="drag && !readonly && !isLimited"
      :multiple="multiple"
      :accept="accept"
      :before-upload="beforeUpload"
      :show-upload-list="false"
      :disabled="disabled"
    >
      <slot>
        <div class="py-16px">
          <p class="ant-upload-drag-icon">
            <icon-ic-round-upload class="text-icon" />
          </p>
          <p class="ant-upload-text">{{ $t('common.uploadDragHint') }}</p>
        </div>
      </slot>
    </AUploadDragger>

    <AUpload
      v-else-if="!readonly && !isLimited"
      :multiple="multiple"
      :accept="accept"
      :before-upload="beforeUpload"
      :show-upload-list="false"
      :disabled="disabled"
    >
      <slot>
        <AButton :disabled="disabled">
          <template #icon>
            <icon-ic-round-upload class="align-sub text-icon" />
          </template>
          <span class="ml-8px">{{ $t('common.selectFile') }}</span>
        </AButton>
      </slot>
    </AUpload>

    <div
      v-for="item in items"
      :key="item.uid"
      class="w-full flex-y-center gap-8px border border-#d9d9d9 rounded-4px border-solid px-8px py-6px"
    >
      <!--
        图片模式：缩略图 + 内置点击预览；加载中给占位框。
        上传已完成但缩略图下载失败（如网络抖动）时退化为普通文本行，保留下载入口
      -->
      <template v-if="picture && isImageItem(item) && (item.thumb || item.status !== 'done')">
        <AImage
          v-if="item.thumb"
          :src="item.thumb"
          :width="72"
          :height="72"
          class="overflow-hidden rounded-4px object-cover"
        />
        <div
          v-else
          class="h-72px w-72px flex-center rounded-4px bg-#f5f5f5"
          :class="{ 'cursor-pointer': item.status === 'error' }"
          @click="item.status === 'error' && retryItem(item)"
        >
          <icon-mdi-loading v-if="item.status === 'uploading'" class="animate-spin text-icon" />
          <span v-else class="text-12px text-#999">{{ $t('common.uploadRetry') }}</span>
        </div>
      </template>

      <div class="min-w-0 flex-1">
        <div class="truncate" :title="item.name">{{ item.name }}</div>
        <div v-if="item.size" class="text-12px text-#999">{{ formatFileSize(item.size) }}</div>
      </div>

      <icon-mdi-loading v-if="item.status === 'uploading'" class="animate-spin text-icon" />

      <AButton v-else-if="item.status === 'error'" type="link" size="small" @click="retryItem(item)">
        {{ $t('common.uploadRetry') }}
      </AButton>

      <template v-else>
        <AButton type="text" size="small" :title="$t('common.download')" @click="downloadItem(item)">
          <template #icon>
            <icon-mdi-download class="align-sub text-icon" />
          </template>
        </AButton>
      </template>

      <AButton
        v-if="!readonly"
        type="text"
        danger
        size="small"
        :title="$t('common.delete')"
        :disabled="disabled"
        @click="removeItem(item)"
      >
        <template #icon>
          <icon-mdi-delete class="align-sub text-icon" />
        </template>
      </AButton>
    </div>
  </div>
</template>

<style scoped></style>
