<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import { $t } from '@/locales';

defineOptions({
  name: 'AvatarCropper'
});

interface Props {
  /** 是否显示裁剪弹窗 */
  open: boolean;
  /** 待裁剪的原图；由父组件的 beforeUpload 传入 */
  file?: File | null;
}

const props = withDefaults(defineProps<Props>(), {
  file: null
});

interface Emits {
  (e: 'update:open', value: boolean): void;
  /** 裁剪完成后回调，参数是已经裁好、可直接上传的图片文件 */
  (e: 'confirm', file: File): void;
}

const emit = defineEmits<Emits>();

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null);

/** 原图的预览地址（object URL，需手动释放） */
const previewUrl = ref('');

watch(
  () => props.file,
  file => {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = '';
    }

    if (file) {
      previewUrl.value = URL.createObjectURL(file);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
});

function close() {
  emit('update:open', false);
}

function handleConfirm() {
  const result = cropperRef.value?.getResult();
  const { canvas } = result ?? {};

  if (!canvas) {
    close();
    return;
  }

  // canvas 是等比放大的位图，头像无需原图分辨率，压到 512 足够且省带宽
  const MAX_SIZE = 512;
  const scale = Math.min(1, MAX_SIZE / Math.max(canvas.width, canvas.height));
  let output = canvas;

  if (scale < 1) {
    const resized = document.createElement('canvas');
    resized.width = Math.round(canvas.width * scale);
    resized.height = Math.round(canvas.height * scale);
    resized.getContext('2d')?.drawImage(canvas, 0, 0, resized.width, resized.height);
    output = resized;
  }

  output.toBlob(blob => {
    if (blob) {
      emit('confirm', new File([blob], 'avatar.png', { type: 'image/png' }));
    }
    close();
  }, 'image/png');
}
</script>

<template>
  <AModal
    :open="props.open"
    :title="$t('page.userCenter.cropAvatar')"
    :width="560"
    :mask-closable="false"
    :destroy-on-close="true"
    @cancel="close"
  >
    <div class="h-360px bg-#f5f5f5 dark:bg-#1f1f1f">
      <Cropper ref="cropperRef" :src="previewUrl" :stencil-props="{ aspectRatio: 1 }" class="size-full" />
    </div>
    <div class="mt-8px text-12px text-gray-500">{{ $t('page.userCenter.cropTip') }}</div>

    <template #footer>
      <ASpace :size="12">
        <AButton @click="close">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" @click="handleConfirm">{{ $t('common.confirm') }}</AButton>
      </ASpace>
    </template>
  </AModal>
</template>

<style scoped></style>
