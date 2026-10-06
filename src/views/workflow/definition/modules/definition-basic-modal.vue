<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { fetchGetWorkflowDefinitionDetail, fetchSaveWorkflowDefinitionBasic } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { ensureEnumDict, enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'DefinitionBasicModal'
});

// 独立弹窗不挂在列表页也能打开，自行加载枚举字典
ensureEnumDict('workflow');

/**
 * 流程定义「基础信息」弹窗 —— 建流程的第一步
 *
 * 参考实现里有**两套入口**：① 直接进设计器（引擎自带「基础信息」tab）；
 * ② 先填这个表单、提交建定义，再进设计器画节点。本组件实现的是 ②：
 * 和设计器解耦，定义的主记录在这里落库，节点与跳转线仍由设计器写。
 *
 * ⚠️ 参考实现里这三项**刻意不做**：
 * - 「是否发布」：列表行操作已有发布 / 撤销发布，弹窗里再放一个开关会出现两处状态源；
 * - 「审批表单是否自定义」/「审批表单路径」：本项目定位是人工审批，不接业务表单；
 * - 「监听器」tab：`ListenerListService` 未实现，设计器里的监听器下拉本来就是空的。
 */
interface Props {
  /** 流程定义 id：为空 = 新建；非空 = 编辑（拉详情预填，并锁定设计器模型） */
  definitionId?: string | null;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', { default: false });

const emit = defineEmits<{
  /** 提交成功；`record` 是后端回写的定义（新建时含新 `definitionId`） */
  success: [record: Api.Workflow.WorkflowDefinition];
}>();

/** 有 id 即编辑模式 */
const isEdit = computed(() => Boolean(props.definitionId));

const loading = ref(false);
const submitting = ref(false);

const { formRef, validate, clearValidate } = useAntdForm();
const { defaultRequiredRule, createMaxLengthRule } = useFormRules();

type Model = {
  flowCode: string;
  flowName: string;
  modelValue: Api.Workflow.WorkflowModelType;
  category: string;
};

/** 设计器模型默认经典模型（与后端 `resolveModelValue` 的缺省一致） */
function createDefaultModel(): Model {
  return {
    flowCode: '',
    flowName: '',
    modelValue: 'CLASSICS',
    category: ''
  };
}

const model = ref<Model>(createDefaultModel());

/** 长度上限对齐参考实现：编码 40 / 名称 100 / 类别 20 */
const rules: Record<'flowCode' | 'flowName' | 'category', App.Global.FormRule[]> = {
  flowCode: [defaultRequiredRule, createMaxLengthRule(40)],
  flowName: [defaultRequiredRule, createMaxLengthRule(100)],
  category: [createMaxLengthRule(20)]
};

/** 编辑模式下拉详情预填；失败则保持空表单，用户看到的是错误提示而不是脏数据 */
async function fetchDetail() {
  const id = props.definitionId;

  if (!id) return;

  loading.value = true;
  try {
    const { data, error } = await fetchGetWorkflowDefinitionDetail(id);

    if (error || !data) {
      window.$message?.error?.($t('page.workflow.definition.detailLoadFailed'));
      return;
    }

    model.value = {
      flowCode: data.flowCode,
      flowName: data.flowName,
      modelValue: data.modelValue ?? 'CLASSICS',
      category: data.category ?? ''
    };
  } finally {
    loading.value = false;
  }
}

watch(visible, async val => {
  if (!val) return;

  model.value = createDefaultModel();
  await nextTick();
  // 只清校验态，不回写字段值：`resetFields` 会把挂载时的快照写回 model，
  // 连续编辑两行时会串数据（见 `useAntdForm` 的说明）
  clearValidate();
  await fetchDetail();
});

async function handleSubmit() {
  if (loading.value) return;

  await validate();

  const editId = props.definitionId;
  const flowCode = model.value.flowCode.trim();
  const flowName = model.value.flowName.trim();
  const category = model.value.category.trim();

  submitting.value = true;
  try {
    // 契约里「空值」在新建与更新下语义**不同**，故两条分支分别拼包：
    // - 新建：编码 / 名称必填、模型必传（默认 CLASSICS），类别留空则**不传该字段**（落 NULL 而非空串）；
    // - 更新：编码 / 名称留空 = 保持原值（主记录这两列非空，空串覆盖没有意义），但表单已把它们设为
    //   必填 + 预填，所以这里总是传当前值；类别传 `''` = 清空；模型**刻意不回传** ——
    //   契约里留空即保持原值，而回传一个与库中不同的值会被后端以 10701 拒绝
    //   （历史定义可能是设计器直建的，库里存的是 NULL）。
    const payload: Api.Workflow.WorkflowDefinitionBasicParams = { flowCode, flowName };

    if (editId) {
      payload.definitionId = editId;
      payload.category = category;
    } else {
      payload.modelValue = model.value.modelValue;

      if (category) {
        payload.category = category;
      }
    }

    const { data, error } = await fetchSaveWorkflowDefinitionBasic(payload);

    if (error || !data) {
      window.$message?.error?.(editId ? $t('common.updateFailed') : $t('common.addFailed'));
      return;
    }

    window.$message?.success?.(editId ? $t('common.updateSuccess') : $t('page.workflow.definition.basicCreateSuccess'));
    visible.value = false;
    emit('success', data);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <!-- 宽度 520：四个字段，其中「设计器模型」还要放下禁用提示 -->
  <AModal
    v-model:open="visible"
    :title="isEdit ? $t('page.workflow.definition.basicEditTitle') : $t('page.workflow.definition.basicCreateTitle')"
    :width="520"
    :confirm-loading="submitting"
    @ok="handleSubmit"
  >
    <ASpin :spinning="loading">
      <AForm ref="formRef" :model="model" :rules="rules" layout="vertical" class="mt-16px">
        <AFormItem :label="$t('page.workflow.definition.flowCode')" name="flowCode">
          <AInput
            v-model:value="model.flowCode"
            :maxlength="40"
            show-count
            :placeholder="$t('page.workflow.definition.form.basicFlowCode')"
          />
        </AFormItem>
        <AFormItem :label="$t('page.workflow.definition.flowName')" name="flowName">
          <AInput
            v-model:value="model.flowName"
            :maxlength="100"
            show-count
            :placeholder="$t('page.workflow.definition.form.basicFlowName')"
          />
        </AFormItem>
        <AFormItem :label="$t('page.workflow.definition.modelType')" name="modelValue">
          <!-- 编辑时禁用：两种模型节点结构不同，后端 `updateBasic` 对已变更的取值直接拒绝 -->
          <ARadioGroup v-model:value="model.modelValue" :disabled="isEdit">
            <ARadio
              v-for="item in enumDictOptions('workflow', 'WorkflowModelType')"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </ARadio>
          </ARadioGroup>
          <div class="mt-2px text-12px text-error">{{ $t('page.workflow.definition.modelTypeLocked') }}</div>
        </AFormItem>
        <AFormItem :label="$t('page.workflow.definition.category')" name="category">
          <!-- 清空即「清空类别」（提交空串）；与编码 / 名称的「留空 = 保持原值」不同 -->
          <AInput
            v-model:value="model.category"
            :maxlength="20"
            show-count
            :placeholder="$t('page.workflow.definition.form.basicCategory')"
          />
        </AFormItem>
      </AForm>
    </ASpin>
  </AModal>
</template>

<style scoped></style>
