<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { fetchNextSequenceCode } from '@/service/api';
import { $t } from '@/locales';

defineOptions({
  name: 'SequenceInput'
});

interface Props {
  /**
   * 编码规则编码，对应后端 `sys_sequence_rule.rule_code`
   *
   * 规则须已在「系统管理 → 编码规则」里维护好，否则后端会返回「编码规则不存在」——
   * 这是刻意的耦合：编码格式（前缀/日期段/位数）属于运营可调的业务配置，不该硬编码在前端。
   */
  ruleCode: string;
  /**
   * 只读（编辑态/详情态）
   *
   * 为 true 时按钮一并隐藏 —— 显示一个点了没反应的按钮只会让人反复点。
   */
  disabled?: boolean;
  /** 挂载时若字段为空则自动生成一次，语义见下方 onMounted 的注释 */
  auto?: boolean;
  placeholder?: string;
  /**
   * 透传给 AInput。缺省不限长（默认值见下方 withDefaults 的说明）。
   *
   * 长度校验请用表单规则 createMaxLengthRule(n)（对齐数据库列宽），
   * 输入框上的 maxlength 只是防手滑的软约束，两者不要互相替代。
   */
  maxlength?: number;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  auto: true,
  placeholder: '',
  // 显式 undefined = 不限长。本仓 vue/require-default-prop 要求每个可选 prop 都有默认值，
  // 所以这个 undefined 不能省（删掉会报 warning），语义见 Props 里 maxlength 的注释
  maxlength: undefined
});

/**
 * 业务编码
 *
 * 用 `v-model:value`（对齐 antd 输入类组件的命名习惯，也是仓内 icon-picker.vue 的写法）。
 */
const model = defineModel<string>('value', { default: '' });

const generating = ref(false);

/** 组件是否已卸载 —— 见 generate() 里对回填的保护 */
const unmounted = ref(false);

/**
 * 向后端申请一个新编码并回填
 *
 * 每调用一次就**真实消耗一个号段**（后端 Redis INCRBY），且不可撤销：关掉抽屉、
 * 连点两次都会跳号。这是本组件刻意接受的取舍 —— 换来「保存前就能看到、能复制单号」。
 * 序列号系统本就允许跳号（服务重启丢段、批量预取同理），所以跳号不是缺陷。
 *
 * 失败时**不弹提示**：请求层 onError 已经弹过了（见 `src/service/request/index.ts` 的
 * onError 与 `packages/axios/src/index.ts` 的响应拦截器），这里再弹一次就是重复提示。
 *
 * ⚠️ 两处异步回填保护，改动前请先读：
 *   1. 卸载后不再回填。`defineModel` 的 setter 在组件卸载后依然会 emit `update:value`，
 *      所以「打开抽屉 → 立刻关闭（destroy-on-close）→ 请求才返回」会在抽屉已关闭时
 *      把编码写进父级表单。
 *   2. data 为空时不清空输入框 —— 静默清空比报错更难查，且后端成功码配 null data 属异常返回。
 */
async function generate() {
  if (props.disabled || generating.value) {
    return;
  }

  generating.value = true;

  try {
    const { data, error } = await fetchNextSequenceCode(props.ruleCode);

    if (error || !data || unmounted.value) {
      return;
    }

    model.value = data;
  } finally {
    generating.value = false;
  }
}

/**
 * 挂载时自动生成一次
 *
 * ⚠️ 语义是「进场生成」，**不是「自动补空」**：用户手动清空输入框不会触发重新生成，
 * 否则用户想自己改写编码时会被一直顶掉。正因如此它只在 onMounted 判定一次。
 *
 * ⚠️ 连带后果：`ADrawer` 默认懒挂载且关闭不销毁，第二次打开抽屉时本组件已挂载、
 * 不会重新生成。集成时给抽屉加 `:destroy-on-close="true"`（每次打开重新挂载），
 * 或者拿 ref 调下面 defineExpose 出去的 generate()。
 */
onMounted(() => {
  if (props.auto && !props.disabled && !model.value) {
    generate();
  }
});

onUnmounted(() => {
  unmounted.value = true;
});

defineExpose({ generate });
</script>

<template>
  <div class="w-full flex-y-center gap-8px">
    <!--
      生成期间一并禁用输入：否则慢网下用户点完「生成」开始手敲，
      响应回来会把刚敲的内容静默顶掉（与 auto 不「自动补空」是同一类问题）
    -->
    <AInput
      v-model:value="model"
      class="flex-1"
      :disabled="disabled || generating"
      :maxlength="maxlength"
      :placeholder="placeholder"
      allow-clear
    />
    <AButton v-if="!disabled" :loading="generating" @click="generate">
      {{ $t('common.generate') }}
    </AButton>
  </div>
</template>

<style scoped></style>
