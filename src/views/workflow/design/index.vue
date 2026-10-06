<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getHex } from '@sa/color';
import { useThemeStore } from '@/store/modules/theme';
import { ensureWarmFlowToken, useWarmFlowTokenKeepAlive } from '@/hooks/business/warm-flow-token';
import { buildWarmFlowDesignerUrl } from '@/utils/warm-flow';
import { $t } from '@/locales';

/**
 * Warm-Flow 流程设计器宿主页
 *
 * 设计器是第三方 SPA（挂在后端 `/warm-flow-ui/index.html`），只能用 iframe 嵌入。
 * 本页只做四件事：拼 URL、挂 postMessage 监听、转发主题、处理关闭。
 *
 * ⚠️ 三条硬约束（违反任一条整条链路就废），细节见 `src/utils/warm-flow.ts`：
 *
 * 1. **iframe 的 src 必须是同源相对路径**（`/manage-api/warm-flow-ui/index.html?...`）。
 *    设计器内部所有请求都是相对路径，且只读**自己 origin** 的 localStorage 拿 token，
 *    跨源 ⇒ 没有鉴权头 ⇒ 数据接口全 401。
 * 2. **URL 上不带 token**。token 已由 `syncWarmFlowToken()` 写进 localStorage，设计器每次请求自己读。
 * 3. **`keep_alive` 必须是 FALSE**（见 `docs/sys_menu_workflow_migration.sql`）。
 *    设计器只在挂载时读一次 URL 参数，被 `<KeepAlive>` 缓存后切换定义会显示旧内容。
 */

/** 设计器 postMessage 方法名（第三方产物里的字面量，勿改） */
const MSG_GET_THEME = 'getTheme';
const MSG_CLOSE = 'close';

/** 深色画布基色兜底值（与 src/theme/settings.ts 的 tokens.dark.colors.layout 一致） */
const DARK_CANVAS_FALLBACK = 'rgb(18, 18, 18)';

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();

const iframeRef = ref<HTMLIFrameElement | null>(null);

/** 打开方式：`design`（新增/编辑）、`view`（只读）、`chart`（只看流程图） */
function normalizeMode(value: unknown) {
  return value === 'view' || value === 'chart' ? value : 'design';
}

function normalizeId(value: unknown) {
  if (typeof value === 'string' && value) {
    return value;
  }

  return undefined;
}

/**
 * 设计器入口地址
 *
 * 空串表示 **同源前缀无法确定**（后端地址是跨源绝对 URL），此时不设 iframe.src，
 * 页面提示用户改配置 —— 宁可不打开，也不要静默 401。
 */
const designerUrl = computed(() =>
  buildWarmFlowDesignerUrl({ id: normalizeId(route.query.id), mode: normalizeMode(route.query.mode) })
);

/** 设计器要的是无井号的 hex（如 `111827`），故取主应用深色 layout 令牌后去掉 `#` */
const darkColors = computed(() =>
  getHex(themeStore.tokens.dark?.colors?.layout ?? DARK_CANVAS_FALLBACK).replace('#', '')
);

/** 把当前深浅色推给 iframe（设计器只认 `theme-dark` / `theme-light`） */
function postTheme() {
  const target = iframeRef.value?.contentWindow;

  if (!target) {
    return;
  }

  target.postMessage({ type: themeStore.darkMode ? 'theme-dark' : 'theme-light', darkColors: darkColors.value }, '*');
}

function handleDesignerMessage(event: MessageEvent) {
  // 只接受本页 iframe 发来的消息：宿主页所在的 window 上还可能有外链页等其它 iframe
  if (event.origin !== window.location.origin || event.source !== iframeRef.value?.contentWindow) {
    return;
  }

  const data = event.data as { method?: string } | null;

  if (!data || typeof data !== 'object') {
    return;
  }

  if (data.method === MSG_GET_THEME) {
    postTheme();
    return;
  }

  if (data.method === MSG_CLOSE) {
    // 「保存成功」与「用户点关闭」发的是同一个方法，无法区分，统一回列表。
    // 列表路由 keep_alive=FALSE ⇒ 重挂载 ⇒ useTable 立即重新查询，无需额外的刷新信号。
    router.replace({ name: 'workflow_definition' });
  }
}

onMounted(async () => {
  // 顺序不能反：设计器在自己的 onMounted 里就会发 `getTheme`，
  // 监听必须先就位，所以 src 用命令式赋值而不是模板上的 :src
  window.addEventListener('message', handleDesignerMessage);

  // 再确保 token 是新鲜的，**然后**才让设计器启动：它启动后立刻就会查流程定义，
  // 那一刻 localStorage 里必须已经是一个有效 token，否则它只会安静地 401（界面上毫无提示）。
  // 距到期还早时这一步什么都不做，也就没有额外请求。
  //
  // ⚠️ 必须 try/catch：续期失败**不能**连累 iframe。否则 onMounted 这个 async 回调会抛出
  // 未处理的 rejection（控制台报错），并且下面的 src 永远不会被赋值 —— 整页空白，
  // 而且看不出是 token 的问题。续期这条路会自己提示（见 warnSessionExpired），
  // 而真正的兜底是 useWarmFlowTokenKeepAlive 的定时补刷。
  try {
    await ensureWarmFlowToken();
  } catch {
    // 交给心跳重试；这里只保证 iframe 一定会拿到 src
  }

  if (designerUrl.value && iframeRef.value) {
    iframeRef.value.src = designerUrl.value;
  }
});

/**
 * 心跳续期：设计器的请求都在 iframe 里，我们的 axios 拦截器看不到它的 401，
 * 而它自己既不续期也不提示 —— 不替它续，用户画满 15 分钟保存就是必丢数据。
 */
useWarmFlowTokenKeepAlive();

// 主应用切换深浅色时同步 iframe（设计器收到即切，无需重载）
watch(
  () => themeStore.darkMode,
  () => postTheme()
);

onBeforeUnmount(() => {
  window.removeEventListener('message', handleDesignerMessage);
});
</script>

<template>
  <div class="h-full">
    <!-- 无 :src 绑定：src 由 onMounted 在监听就位后命令式赋值（见 script 内注释） -->
    <AAlert
      v-if="!designerUrl"
      type="error"
      show-icon
      :message="$t('page.workflow.design.baseUrlMissing')"
      :description="$t('page.workflow.design.baseUrlMissingDesc')"
    />
    <iframe v-else ref="iframeRef" class="size-full" :title="$t('page.workflow.design.frameTitle')"></iframe>
  </div>
</template>

<style scoped></style>
