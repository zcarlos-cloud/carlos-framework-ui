<script setup lang="ts">
import { computed } from 'vue';
import { useAgentChatStore } from '@/store/modules/agent';
import AgentChatPanel from '@/components/custom/agent-chat/agent-chat-panel.vue';
import AgentRobot from '@/components/custom/agent-chat/agent-robot.vue';

defineOptions({ name: 'GlobalAgent' });

const agentStore = useAgentChatStore();

/** 全屏时铺满整屏，否则右侧固定宽度 */
const drawerWidth = computed(() => (agentStore.fullscreen ? '100%' : 480));

const fullscreenIcon = computed(() =>
  agentStore.fullscreen ? 'ant-design:shrink-outlined' : 'ant-design:arrows-alt-outlined'
);

/** 回答进行中且抽屉收起：入口按钮进入「工作中」状态 */
const busy = computed(() => agentStore.loading && !agentStore.drawerVisible);
</script>

<template>
  <div>
    <!-- 悬浮入口 -->
    <div v-show="!agentStore.fullscreen" class="fixed bottom-92px right-28px z-2000">
      <ATooltip :title="$t('page.agent.title')" placement="left">
        <button type="button" class="agent-launcher" @click="agentStore.toggleDrawer()">
          <span v-if="busy" class="agent-ping"></span>
          <AgentRobot class="text-26px" />
          <span v-if="busy" class="agent-dot"></span>
        </button>
      </ATooltip>
    </div>

    <!-- 抽屉：不铺遮罩，展开时页面照常可操作；长会话可切全屏 -->
    <ADrawer
      :open="agentStore.drawerVisible"
      :width="drawerWidth"
      :closable="false"
      :mask="false"
      :body-style="{ padding: '0px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }"
      @close="agentStore.closeDrawer()"
    >
      <template #title>
        <div class="flex items-center gap-10px">
          <div class="agent-avatar">
            <AgentRobot class="text-19px" />
          </div>
          <div class="leading-tight">
            <div class="text-14px font-600">{{ $t('page.agent.title') }}</div>
            <div class="mt-3px flex items-center gap-6px text-11px text-gray-400">
              <span class="size-6px rounded-full bg-green-500"></span>
              {{ $t('page.agent.subtitle') }}
            </div>
          </div>
        </div>
      </template>
      <template #extra>
        <ButtonIcon
          v-if="agentStore.hasMessages"
          icon="ant-design:plus-outlined"
          :tooltip-content="$t('page.agent.newChat')"
          @click="agentStore.newChat()"
        />
        <ButtonIcon
          :icon="fullscreenIcon"
          :tooltip-content="agentStore.fullscreen ? $t('page.agent.exitFullscreen') : $t('page.agent.fullscreen')"
          @click="agentStore.toggleFullscreen()"
        />
        <ButtonIcon icon="ant-design:close-outlined" @click="agentStore.closeDrawer()" />
      </template>
      <AgentChatPanel />
    </ADrawer>
  </div>
</template>

<style scoped>
/* ============ 悬浮入口：渐变球 + 呼吸光圈 ============ */
.agent-launcher {
  position: relative;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 48%, #22d3ee 100%);
  box-shadow:
    0 10px 28px -8px rgba(99, 102, 241, 0.65),
    0 2px 6px rgba(15, 23, 42, 0.12);
  transition:
    transform 0.24s ease,
    box-shadow 0.24s ease;
}

.agent-launcher:hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow:
    0 16px 34px -10px rgba(99, 102, 241, 0.75),
    0 3px 10px rgba(15, 23, 42, 0.16);
}

.agent-launcher:active {
  transform: scale(0.96);
}

/* 工作中：向外扩散的脉冲环 */
.agent-ping {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 2px solid rgba(139, 92, 246, 0.65);
  animation: agent-ping 1.9s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.agent-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #22c55e;
  border: 2px solid #fff;
  animation: agent-breathe 1.4s ease-in-out infinite;
}

@keyframes agent-ping {
  0% {
    transform: scale(0.92);
    opacity: 0.8;
  }

  70%,
  100% {
    transform: scale(1.38);
    opacity: 0;
  }
}

@keyframes agent-breathe {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

/* ============ 抽屉标题里的头像 ============ */
.agent-avatar {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #22d3ee 100%);
  box-shadow: 0 4px 12px -4px rgba(99, 102, 241, 0.6);
}
</style>
