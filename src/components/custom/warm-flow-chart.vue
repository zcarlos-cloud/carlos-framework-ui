<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ensureWarmFlowToken, useWarmFlowTokenKeepAlive } from '@/hooks/business/warm-flow-token';
import { buildWarmFlowDesignerUrl } from '@/utils/warm-flow';
import { $t } from '@/locales';

/**
 * 流程实例流程图弹窗（只读）
 *
 * 流程图与设计器是**同一个第三方 SPA**（后端 `/warm-flow-ui/index.html`），
 * 只是入口参数不同：`type=FlowChart` + **实例 id**。所以这里直接复用
 * `buildWarmFlowDesignerUrl({ mode: 'chart' })`，不另拼一套 URL ——
 * 三条硬约束（同源相对路径、URL 不带 token、`showGrid` 显式传）都收在 `src/utils/warm-flow.ts` 里。
 *
 * ⚠️ `instanceId` 是**流程实例 id**，不是 `taskId`。传错的话设计器查不到实例，
 * 只会渲染一张空白画布（参考项目的抄送页就踩了这个坑）。
 *
 * 只读模式没有保存 / 关闭按钮，故不监听 postMessage（设计器侧只发 `getTheme`，
 * 唯一后果是深色主题下画布仍用浅色，属可接受的观感差异；如果要接，
 * 照 `src/views/workflow/design/index.vue` 的写法挂 `getTheme` 即可）。
 */
defineOptions({
  name: 'WarmFlowChart'
});

interface Props {
  /** 流程实例 id（Long ⇒ 字符串） */
  instanceId?: string | null;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

/**
 * 空串表示**同源前缀无法确定**（后端地址是跨源绝对 URL），此时不设 iframe.src 并给出提示 ——
 * 跨源时设计器读不到 localStorage 里的 token，只会得到一片空白和一连串 401。
 */
const chartUrl = computed(() =>
  props.instanceId ? buildWarmFlowDesignerUrl({ id: props.instanceId, mode: 'chart' }) : ''
);

/**
 * 令牌就绪标记
 *
 * 流程图与设计器是同一个 SPA，它启动后**立刻**就去查实例。那一刻 localStorage 里必须已经是
 * 一个有效 token，否则它只会安静地 401 —— 用户看到一张空白画布，且没有任何提示。
 * 所以打开弹窗时先确保 token 新鲜，再让 iframe 真正加载。
 */
const tokenReady = ref(false);

watch(
  visible,
  async open => {
    if (!open) {
      tokenReady.value = false;

      return;
    }

    await ensureWarmFlowToken();
    tokenReady.value = true;
  },
  { immediate: true }
);

/** 弹窗开着的时候才需要心跳：关掉之后没人再读这份 token 副本 */
useWarmFlowTokenKeepAlive(() => visible.value);
</script>

<template>
  <AModal
    v-model:open="visible"
    :title="$t('page.workflow.chart.title')"
    width="80%"
    :footer="null"
    centered
    destroy-on-close
  >
    <!--
      destroy-on-close：设计器只在挂载时读一次 URL 参数，留着实例会让「先看 A 再看 B」
      继续显示 A 的图（与设计器宿主页 keep_alive=FALSE 是同一个原因）。
    -->
    <AAlert
      v-if="!chartUrl"
      type="error"
      show-icon
      :message="$t('page.workflow.chart.baseUrlMissing')"
      :description="$t('page.workflow.chart.baseUrlMissingDesc')"
    />
    <!--
      不设 src 时 iframe 停在 about:blank：保持 70vh 的高度，避免「先塌陷再撑开」的跳动。
      tokenReady 由打开弹窗时的 ensureWarmFlowToken() 置位，见 script 内注释。
    -->
    <iframe
      v-else
      class="h-[70vh] w-full border-none"
      :src="tokenReady ? chartUrl : undefined"
      :title="$t('page.workflow.chart.frameTitle')"
    />
  </AModal>
</template>

<style scoped></style>
