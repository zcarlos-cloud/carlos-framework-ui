<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchGetWorkflowAnyNodes, fetchHandleWorkflowTask } from '@/service/api';
import { $t } from '@/locales';

/**
 * 办理（审批）弹窗
 *
 * 四个按钮对应四种流转动作，`action` 一律下发**枚举名**（后端 `WorkflowActionEnum`
 * 走 Jackson 默认的按名处理，见 `Api.Workflow.WorkflowAction` 的注释）：
 *
 * | 按钮 | action | nodeCode |
 * |---|---|---|
 * | 审批通过 | 选了跳转节点 ⇒ `FREE_JUMP`，否则 `PASS` | `FREE_JUMP` 必带 |
 * | 退回 | `REJECT` | 选了节点即为「任意驳回」 |
 * | 退回上一节点 | `REJECT_LAST` | 不带（目标由引擎按历史记录决定） |
 * | 拿回 | `TAKE_BACK` | 不带 |
 *
 * ⚠️ 参考项目里还有一个「自定义流程状态」输入框 —— 我们的 `ApiWorkflowHandleParam`
 * **没有** `flowStatus` 字段（引擎 `FlowParams#flowStatus` 未被映射），那个输入框在这里
 * 无处可去，故未实现（见 `Api.Workflow.WorkflowHandleParams` 的注释）。
 */
defineOptions({
  name: 'TodoHandleModal'
});

interface Props {
  /** 目标待办任务 */
  task?: Api.Workflow.WorkflowTask | null;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

interface Emits {
  /** 办理成功，调用方据此刷新列表 */
  (e: 'handled'): void;
}

const emit = defineEmits<Emits>();

/** 审批意见上限对齐 `flow_his_task.message varchar(500)` */
const MESSAGE_MAX_LENGTH = 500;

const message = ref('');
const nodeCode = ref<string | undefined>(undefined);
const nodes = ref<Api.Workflow.WorkflowNode[]>([]);
const nodesLoading = ref(false);

/** 正在执行的动作：只让被点的那个按钮转圈，其余按钮禁用防重复提交 */
const submittingAction = ref<Api.Workflow.WorkflowAction | null>(null);

/**
 * 「审批通过」的实际动作
 *
 * 选了目标节点就是自由跳转（后端对 `FREE_JUMP` 强制校验 nodeCode），
 * 没选就是普通通过；不再给 `PASS` 带 nodeCode —— 那是另一条语义
 * （任意通过）且与按钮文案对不上。
 */
const passAction = computed<Api.Workflow.WorkflowAction>(() => (nodeCode.value ? 'FREE_JUMP' : 'PASS'));

/** 选了跳转节点时，「退回上一节点 / 拿回」的目标与所选节点冲突，隐藏之（与参考项目一致） */
const showHistoryActions = computed(() => !nodeCode.value);

const nodeOptions = computed(() => nodes.value.map(node => ({ value: node.nodeCode, label: node.nodeName })));

const idle = computed(() => submittingAction.value === null);

async function loadNodes() {
  const instanceId = props.task?.instanceId;

  if (!instanceId) {
    return;
  }

  nodesLoading.value = true;

  try {
    const { data, error } = await fetchGetWorkflowAnyNodes(instanceId);

    if (!error && data) {
      nodes.value = data;
    }
  } finally {
    nodesLoading.value = false;
  }
}

function closeModal() {
  visible.value = false;
}

async function submit(action: Api.Workflow.WorkflowAction) {
  const taskId = props.task?.taskId;

  if (!taskId) {
    return;
  }

  submittingAction.value = action;

  try {
    const { error } = await fetchHandleWorkflowTask({
      taskId,
      action,
      // REJECT_LAST / TAKE_BACK 的目标由引擎决定，带上 nodeCode 会变成「跳到该节点」
      nodeCode: action === 'REJECT_LAST' || action === 'TAKE_BACK' ? undefined : nodeCode.value,
      // 空串会被写进 flow_his_task.message，用 undefined 表达「没填」
      message: message.value || undefined
    });

    if (error) {
      window.$message?.error?.($t('page.workflow.todo.handleFailed'));
      return;
    }

    window.$message?.success?.($t('page.workflow.todo.handleSuccess'));
    closeModal();
    emit('handled');
  } finally {
    submittingAction.value = null;
  }
}

watch(visible, value => {
  if (!value) {
    return;
  }

  message.value = '';
  nodeCode.value = undefined;
  nodes.value = [];
  submittingAction.value = null;

  loadNodes();
});
</script>

<template>
  <AModal v-model:open="visible" :title="$t('page.workflow.todo.handleTitle')" :width="560" :footer="null">
    <ADescriptions v-if="task" :column="1" size="small" bordered class="mb-16px">
      <ADescriptionsItem :label="$t('page.workflow.todo.flowName')">
        {{ task.flowName }}
      </ADescriptionsItem>
      <ADescriptionsItem :label="$t('page.workflow.todo.nodeName')">
        {{ task.nodeName }}
      </ADescriptionsItem>
    </ADescriptions>
    <AForm layout="vertical">
      <AFormItem :label="$t('page.workflow.todo.jumpNode')" :extra="$t('page.workflow.todo.jumpNodeHint')">
        <ASelect
          v-model:value="nodeCode"
          :options="nodeOptions"
          :loading="nodesLoading"
          :disabled="nodes.length === 0"
          :placeholder="$t('page.workflow.todo.jumpNodePlaceholder')"
          allow-clear
          show-search
          option-filter-prop="label"
        />
      </AFormItem>
      <AFormItem :label="$t('page.workflow.todo.message')">
        <ATextarea
          v-model:value="message"
          :rows="4"
          :maxlength="MESSAGE_MAX_LENGTH"
          show-count
          :placeholder="$t('page.workflow.todo.messagePlaceholder')"
        />
      </AFormItem>
    </AForm>
    <div class="flex-y-center justify-end gap-12px">
      <AButton @click="closeModal">{{ $t('common.cancel') }}</AButton>
      <AButton
        v-if="showHistoryActions"
        :disabled="!idle"
        :loading="submittingAction === 'REJECT_LAST'"
        @click="submit('REJECT_LAST')"
      >
        {{ $t('page.workflow.todo.rejectLast') }}
      </AButton>
      <AButton
        v-if="showHistoryActions"
        :disabled="!idle"
        :loading="submittingAction === 'TAKE_BACK'"
        @click="submit('TAKE_BACK')"
      >
        {{ $t('page.workflow.todo.takeBack') }}
      </AButton>
      <AButton :disabled="!idle" :loading="submittingAction === 'REJECT'" @click="submit('REJECT')">
        {{ $t('page.workflow.todo.reject') }}
      </AButton>
      <AButton type="primary" :disabled="!idle" :loading="submittingAction === passAction" @click="submit(passAction)">
        {{ $t('page.workflow.todo.pass') }}
      </AButton>
    </div>
  </AModal>
</template>

<style scoped></style>
