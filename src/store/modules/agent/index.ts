import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { fetchAgentChat } from '@/service/api';
import type { AgentChatHandle } from '@/service/api';
import { SetupStoreId } from '@/enum';
import { $t } from '@/locales';

/** 助手会话消息 */
export interface AgentChatMessage {
  /** 消息角色：user 提问 / assistant 回答 / system 本地提示 */
  role: 'user' | 'assistant' | 'system';
  /** 消息内容：助手为 Markdown，其余为纯文本 */
  content: string;
  /** 消息时间戳（毫秒） */
  time: number;
  /** 本轮工具调用次数（仅助手消息） */
  toolCalls?: number;
  /** 本轮耗时（秒，仅助手消息） */
  elapsed?: number;
}

/**
 * AI 助手会话状态
 *
 * 抽屉挂在布局层、跨页面存在，所以会话状态必须离开页面组件——
 * 否则切换菜单时组件卸载，聊到一半的上下文就没了。
 */
export const useAgentChatStore = defineStore(SetupStoreId.Agent, () => {
  const messages = ref<AgentChatMessage[]>([]);
  const sessionId = ref<string>();
  const loading = ref(false);
  const toolCalls = ref(0);
  const elapsed = ref(0);

  /** 抽屉显隐与全屏（长会话时切全屏看） */
  const drawerVisible = ref(false);
  const fullscreen = ref(false);

  /** 进行中的 SSE 句柄，刻意不进响应式状态：它持有 AbortController，被 proxy 包一层没有意义 */
  let currentChat: AgentChatHandle | null = null;

  const hasMessages = computed(() => messages.value.length > 0);

  function toggleDrawer() {
    drawerVisible.value = !drawerVisible.value;
  }

  function closeDrawer() {
    drawerVisible.value = false;
    fullscreen.value = false;
  }

  function toggleFullscreen() {
    fullscreen.value = !fullscreen.value;
  }

  /** 中断当前回答（不丢已收到的内容，只是停止等待） */
  function stop() {
    const interrupted = loading.value;

    currentChat?.abort();
    currentChat = null;
    loading.value = false;

    // 中断后界面上得有个交代，否则用户只看到自己的提问悬在那里
    if (interrupted) {
      messages.value.push({ role: 'system', content: $t('page.agent.stopped'), time: Date.now() });
    }
  }

  /** 开新会话：清空上下文与消息（sessionId 重置后模型不再记得前面聊过什么） */
  function newChat() {
    stop();
    messages.value = [];
    sessionId.value = undefined;
    toolCalls.value = 0;
    elapsed.value = 0;
  }

  /** 发一轮提问：先落用户消息，再消费 SSE 流，结束后落助手消息 */
  async function ask(message: string) {
    if (!message || loading.value) {
      return;
    }

    messages.value.push({ role: 'user', content: message, time: Date.now() });
    loading.value = true;
    toolCalls.value = 0;
    elapsed.value = 0;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      elapsed.value = Math.round((Date.now() - startedAt) / 1000);
    }, 1000);

    let answer = '';
    let failed = '';
    let calls = 0;

    currentChat = fetchAgentChat({ message, sessionId: sessionId.value }, (event, data) => {
      if (event === 'session') {
        sessionId.value = (JSON.parse(data) as { sessionId: string }).sessionId;
        return;
      }
      if (event === 'progress') {
        const progress = JSON.parse(data) as { toolCalls: number; elapsed: number };
        toolCalls.value = progress.toolCalls;
        elapsed.value = progress.elapsed;
        calls = progress.toolCalls;
        return;
      }
      if (event === 'done') {
        answer = (JSON.parse(data) as { finalResponse: string }).finalResponse;
        return;
      }
      if (event === 'error') {
        failed = (JSON.parse(data) as { message: string }).message;
      }
    });

    try {
      await currentChat.done;

      const seconds = Math.round((Date.now() - startedAt) / 1000);
      const duration = elapsed.value > 0 ? elapsed.value : seconds;

      if (answer) {
        messages.value.push({
          role: 'assistant',
          content: answer,
          time: Date.now(),
          toolCalls: calls,
          elapsed: duration
        });
      } else if (failed) {
        messages.value.push({
          role: 'system',
          content: $t('page.agent.failed', { message: failed }),
          time: Date.now()
        });
      } else {
        messages.value.push({ role: 'system', content: $t('page.agent.noResult'), time: Date.now() });
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const reason = (error as Error).message;
        messages.value.push({
          role: 'system',
          content: $t('page.agent.requestFailed', { message: reason }),
          time: Date.now()
        });
      }
    } finally {
      window.clearInterval(timer);
      loading.value = false;
      currentChat = null;
    }
  }

  return {
    messages,
    sessionId,
    loading,
    toolCalls,
    elapsed,
    drawerVisible,
    fullscreen,
    hasMessages,
    toggleDrawer,
    closeDrawer,
    toggleFullscreen,
    stop,
    newChat,
    ask
  };
});
