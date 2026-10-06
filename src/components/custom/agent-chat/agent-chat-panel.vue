<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAgentChatStore } from '@/store/modules/agent';
import AgentMessage from './agent-message.vue';
import AgentRobot from './agent-robot.vue';

defineOptions({ name: 'AgentChatPanel' });

const { t } = useI18n();

const agentStore = useAgentChatStore();

const inputValue = ref('');
const scrollRef = ref<HTMLElement>();

/** 空态建议问题，点一下直接发问（都选了边界清晰的问法：发散的问题会让工具调用打转） */
const suggestions = computed(() => [
  t('page.agent.suggestion.jobFail'),
  t('page.agent.suggestion.recentCommits'),
  t('page.agent.suggestion.redisStatus')
]);

const canSend = computed(() => inputValue.value.trim().length > 0 && !agentStore.loading);

function scrollToBottom() {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
    }
  });
}

function handleSend() {
  const question = inputValue.value.trim();

  if (!question) {
    return;
  }

  inputValue.value = '';
  agentStore.ask(question);
  scrollToBottom();
}

function handleSuggestion(question: string) {
  agentStore.ask(question);
  scrollToBottom();
}

// 监听长度而非数组本身：push 不改变数组引用，直接 watch 数组不会触发
watch(() => agentStore.messages.length, scrollToBottom);
watch(() => agentStore.loading, scrollToBottom);
</script>

<template>
  <div class="h-full flex flex-col text-base-text">
    <div ref="scrollRef" class="flex-1 overflow-y-auto px-16px py-16px">
      <!-- 居中限宽：抽屉里没影响，全屏时避免正文铺满整屏、长行难读 -->
      <div class="mx-auto max-w-1000px w-full">
        <!-- 空态：助手自我介绍 + 建议问题 -->
        <div v-if="!agentStore.hasMessages" class="flex flex-col items-center px-6px pt-9vh text-center">
          <div class="agent-hero">
            <AgentRobot class="text-32px" />
          </div>
          <div class="mt-16px text-17px font-600">{{ t('page.agent.title') }}</div>
          <div class="mt-8px max-w-340px text-12px text-gray-400 leading-20px">{{ t('page.agent.tip') }}</div>

          <div class="mt-22px w-full flex flex-col gap-9px">
            <button
              v-for="item in suggestions"
              :key="item"
              type="button"
              class="agent-suggest"
              @click="handleSuggestion(item)"
            >
              <span class="agent-suggest-dot"></span>
              <span class="flex-1 text-left">{{ item }}</span>
            </button>
          </div>
        </div>

        <AgentMessage v-for="(msg, index) in agentStore.messages" :key="index" v-bind="msg" />

        <!-- 思考中：跳动点 + 工具调用次数与耗时 -->
        <div v-if="agentStore.loading" class="flex items-center gap-10px pl-40px text-12px text-gray-400">
          <span class="agent-typing">
            <i></i>
            <i></i>
            <i></i>
          </span>
          {{ t('page.agent.thinking', { count: agentStore.toolCalls, seconds: agentStore.elapsed }) }}
        </div>
      </div>
    </div>

    <div class="border-t border-#eef1f6 px-14px pb-12px pt-12px dark:border-#2a2a2e">
      <div class="mx-auto max-w-1000px w-full">
        <div class="agent-composer">
          <ATextarea
            v-model:value="inputValue"
            :bordered="false"
            :auto-size="{ minRows: 1, maxRows: 6 }"
            :placeholder="t('page.agent.placeholder')"
            class="!resize-none !border-none !bg-transparent !px-2px !py-6px !text-14px !shadow-none"
            @keydown.enter.exact.prevent="handleSend"
          />

          <button v-if="agentStore.loading" type="button" class="agent-stop" @click="agentStore.stop()">
            <span class="block size-10px rounded-2px bg-current"></span>
          </button>
          <button v-else type="button" class="agent-send" :disabled="!canSend" @click="handleSend">
            <SvgIcon icon="ant-design:send-outlined" class="text-16px" />
          </button>
        </div>
        <div class="mt-7px text-center text-11px text-gray-400">{{ t('page.agent.hint') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============ 空态头像：渐变方块 + 柔光 ============ */
.agent-hero {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-radius: 20px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 52%, #22d3ee 100%);
  box-shadow:
    0 14px 30px -12px rgba(99, 102, 241, 0.85),
    0 0 0 8px rgba(99, 102, 241, 0.07);
}

/* ============ 建议问题卡片 ============ */
.agent-suggest {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  font-size: 13px;
  color: rgb(var(--base-text-color));
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid #e8ecf3;
  border-radius: 12px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.agent-suggest:hover {
  border-color: rgb(var(--primary-color));
  box-shadow: 0 10px 22px -12px rgba(99, 102, 241, 0.65);
  transform: translateY(-1px);
}

.agent-suggest-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #22d3ee);
}

/* ============ 思考中：三点跳动 ============ */
.agent-typing {
  display: inline-flex;
  gap: 3px;
}

.agent-typing i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgb(var(--primary-color));
  animation: agent-typing 1.2s ease-in-out infinite;
}

.agent-typing i:nth-child(2) {
  animation-delay: 0.15s;
}

.agent-typing i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes agent-typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }

  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

/* ============ 输入区 ============ */
.agent-composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  background: #fff;
  border: 1px solid #e3e8ef;
  border-radius: 14px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.agent-composer:focus-within {
  border-color: rgb(var(--primary-color));
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.agent-send {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, #6366f1, #8b5cf6 55%, #22d3ee);
  border: none;
  border-radius: 50%;
  box-shadow: 0 6px 16px -8px rgba(99, 102, 241, 0.9);
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.agent-send:hover:not(:disabled) {
  transform: scale(1.06);
}

.agent-send:disabled {
  cursor: not-allowed;
  opacity: 0.35;
  box-shadow: none;
}

.agent-stop {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
  cursor: pointer;
  background: #fff;
  border: 1px solid #e3e8ef;
  border-radius: 50%;
}

/* ============ 暗色模式 ============ */
:global(html.dark) .agent-suggest {
  background: #232326;
  border-color: #2f2f36;
}

:global(html.dark) .agent-composer {
  background: #232326;
  border-color: #2f2f36;
}

:global(html.dark) .agent-stop {
  background: #232326;
  border-color: #2f2f36;
}
</style>
