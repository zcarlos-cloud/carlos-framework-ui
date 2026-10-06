<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchRevokeWorkflowInstance, fetchTerminateWorkflowInstance } from '@/service/api';
import { $t } from '@/locales';

/**
 * 撤销 / 终止流程实例弹窗
 *
 * 两个动作的请求体、交互完全一致（只有一个可选的审批意见），差别只在文案与接口，
 * 所以共用一个弹窗而不是拆两个。
 *
 * ⚠️ 意见为空时**由页面补默认文案**：后端 `WorkflowInstanceService#revoke` 直接把
 * `param.message` 透传给引擎（`FlowParams#message`）写进历史任务，不填就落空串，
 * 审批记录里会看到一条没有意见的记录。所以这里兜底成动作名（「撤销流程」/「终止流程」）。
 *
 * ⚠️ 这两个动作都**不可恢复**（撤销后实例结束流转，终止后直接结束），所以是
 * 「二次确认 + 意见」合成一步：弹窗本身就是那一次确认。
 */
defineOptions({
  name: 'MineActionModal'
});

interface Props {
  /** 动作：撤销 / 终止 */
  action: 'REVOKE' | 'TERMINATE';
  /** 目标流程实例 */
  instance?: Api.Workflow.WorkflowInstance | null;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

interface Emits {
  /** 动作执行成功，调用方据此刷新列表 */
  (e: 'done'): void;
}

const emit = defineEmits<Emits>();

/** 审批意见上限对齐 `flow_his_task.message varchar(500)` */
const MESSAGE_MAX_LENGTH = 500;

const message = ref('');
const submitting = ref(false);

/** 四个文案随动作切换；`default_` 就是「不填」时写进历史任务的那句话 */
const actionMeta = computed(() => {
  if (props.action === 'REVOKE') {
    return {
      title: $t('page.workflow.mine.revokeTitle'),
      placeholder: $t('page.workflow.mine.revokeMessagePlaceholder'),
      success: $t('page.workflow.mine.revokeSuccess'),
      failed: $t('page.workflow.mine.revokeFailed')
    };
  }

  return {
    title: $t('page.workflow.mine.terminateTitle'),
    placeholder: $t('page.workflow.mine.terminateMessagePlaceholder'),
    success: $t('page.workflow.mine.terminateSuccess'),
    failed: $t('page.workflow.mine.terminateFailed')
  };
});

function closeModal() {
  visible.value = false;
}

async function handleSubmit() {
  const instanceId = props.instance?.instanceId;

  if (!instanceId) {
    return;
  }

  submitting.value = true;

  try {
    const payload: Api.Workflow.WorkflowInstanceActionParams = {
      instanceId,
      message: message.value.trim() || actionMeta.value.title
    };

    const { error } =
      props.action === 'REVOKE'
        ? await fetchRevokeWorkflowInstance(payload)
        : await fetchTerminateWorkflowInstance(payload);

    if (error) {
      window.$message?.error?.(actionMeta.value.failed);

      return;
    }

    window.$message?.success?.(actionMeta.value.success);
    closeModal();
    emit('done');
  } finally {
    submitting.value = false;
  }
}

watch(visible, value => {
  if (value) {
    message.value = '';
    submitting.value = false;
  }
});
</script>

<template>
  <AModal v-model:open="visible" :title="actionMeta.title" :width="560" :mask-closable="false" :footer="null">
    <ADescriptions v-if="instance" :column="1" size="small" bordered class="mb-16px">
      <ADescriptionsItem :label="$t('page.workflow.mine.flowName')">
        {{ instance.flowName }}
      </ADescriptionsItem>
      <ADescriptionsItem :label="$t('page.workflow.mine.nodeName')">
        {{ instance.nodeName }}
      </ADescriptionsItem>
    </ADescriptions>
    <AForm layout="vertical">
      <AFormItem :label="$t('page.workflow.mine.message')">
        <ATextarea
          v-model:value="message"
          :rows="4"
          :maxlength="MESSAGE_MAX_LENGTH"
          show-count
          :placeholder="actionMeta.placeholder"
        />
      </AFormItem>
    </AForm>
    <div class="flex-y-center justify-end gap-12px">
      <AButton :disabled="submitting" @click="closeModal">{{ $t('common.cancel') }}</AButton>
      <AButton type="primary" danger :loading="submitting" @click="handleSubmit">
        {{ actionMeta.title }}
      </AButton>
    </div>
  </AModal>
</template>

<style scoped></style>
