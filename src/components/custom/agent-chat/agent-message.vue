<script setup lang="ts">
import { computed, ref } from 'vue';
import dayjs from 'dayjs';
import { useI18n } from 'vue-i18n';
import type { AgentChatMessage } from '@/store/modules/agent';
import AgentRobot from './agent-robot.vue';
import MarkdownContent from './markdown-content.vue';

defineOptions({ name: 'AgentMessage' });

const props = defineProps<AgentChatMessage>();

const { t } = useI18n();

const copied = ref(false);

const timeText = computed(() => dayjs(props.time).format('HH:mm'));

/** 工具调用摘要：不足一分钟只显示秒，超过则显示「分+秒」 */
const toolSummary = computed(() => {
  const count = props.toolCalls ?? 0;
  const seconds = props.elapsed ?? 0;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  let duration = `${seconds}s`;

  if (minutes > 0) {
    duration = rest > 0 ? `${minutes}m${rest}s` : `${minutes}m`;
  }

  return t('page.agent.toolSummary', { count, duration });
});

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(props.content);
    copied.value = true;
    window.setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    // 剪贴板不可用（非 https/localhost 环境）时保持原状，不打断阅读
    copied.value = false;
  }
}
</script>

<template>
  <!-- 提问：右对齐，渐变气泡 -->
  <div v-if="role === 'user'" class="mb-20px flex justify-end">
    <div class="max-w-82%">
      <div
        class="rounded-14px rounded-br-4px from-primary to-primary-600 bg-gradient-to-br px-14px py-10px text-14px text-white leading-24px shadow-sm"
      >
        {{ content }}
      </div>
      <div class="mt-5px text-right text-11px text-gray-400">{{ timeText }}</div>
    </div>
  </div>

  <!-- 回答：左对齐，白卡片 + 渐变头像 -->
  <div v-else-if="role === 'assistant'" class="mb-20px flex gap-10px">
    <div class="agent-mini-avatar mt-2px shrink-0">
      <AgentRobot class="text-16px" />
    </div>
    <div class="min-w-0 flex-1">
      <div
        class="border border-#eceff4 rounded-14px rounded-tl-4px bg-white px-14px py-12px text-base-text shadow-sm dark:border-#2f2f36 dark:bg-#232326"
      >
        <MarkdownContent :content="content" />
      </div>
      <div class="mt-7px flex items-center gap-8px text-11px text-gray-400">
        <span>{{ timeText }}</span>
        <span v-if="toolCalls" class="rounded-full bg-#f1f4f9 px-8px py-1px dark:bg-#2b2b31">{{ toolSummary }}</span>
        <button
          type="button"
          class="flex items-center gap-4px border-none bg-transparent p-0 text-11px transition-colors duration-200 hover:text-primary"
          :class="copied ? 'text-primary' : 'text-gray-400'"
          @click="handleCopy"
        >
          <SvgIcon icon="ant-design:copy-outlined" />
          {{ copied ? $t('page.agent.copied') : $t('page.agent.copy') }}
        </button>
      </div>
    </div>
  </div>

  <!-- 本地提示（失败/无结果）：居中胶囊 -->
  <div v-else class="mb-20px flex justify-center">
    <div
      class="border border-orange-200 rounded-full bg-orange-50 px-12px py-5px text-center text-11px text-orange-600 dark:border-#5a3f18 dark:bg-#33280f"
    >
      {{ content }}
    </div>
  </div>
</template>

<style scoped>
.agent-mini-avatar {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-radius: 9px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #22d3ee 100%);
  box-shadow: 0 4px 12px -5px rgba(99, 102, 241, 0.65);
}
</style>
