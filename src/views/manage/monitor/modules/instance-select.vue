<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { fetchGetInstanceOptions } from '@/service/api';
import { $t } from '@/locales';

defineOptions({
  name: 'MonitorInstanceSelect'
});

interface Props {
  /** 选中的实例ID */
  modelValue?: string;
  /** 实例类型过滤；数组时客户端过滤（后端只支持单类型参数） */
  instanceType?: Api.Monitor.InstanceType | Api.Monitor.InstanceType[];
  placeholder?: string;
  /** 只返回健康实例 */
  onlyUp?: boolean;
  /** 未选中时是否默认选中第一项（编辑回显场景父组件已传入值，不受影响） */
  defaultFirst?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  instanceType: undefined,
  placeholder: undefined,
  onlyUp: false,
  defaultFirst: true
});

interface Emits {
  (e: 'update:modelValue', value?: string): void;

  (e: 'change', value?: string, instance?: Api.Monitor.Instance): void;
}

const emit = defineEmits<Emits>();

interface InstanceOption {
  value: string;
  label: string;
  env?: string;
  healthStatus?: string;
}

const loading = ref(false);
const instances = ref<Api.Monitor.Instance[]>([]);
const options = ref<InstanceOption[]>([]);

function buildOptions() {
  let types: Api.Monitor.InstanceType[] | null = null;
  if (props.instanceType) {
    types = Array.isArray(props.instanceType) ? props.instanceType : [props.instanceType];
  }

  options.value = instances.value
    .filter(item => {
      if (types && !types.includes(item.instanceType)) {
        return false;
      }
      if (props.onlyUp && item.healthStatus !== 'UP') {
        return false;
      }
      return true;
    })
    .map(item => ({
      value: item.id,
      label: item.instanceName,
      env: item.env,
      healthStatus: item.healthStatus
    }));
}

async function loadInstances() {
  loading.value = true;
  try {
    const singleType = props.instanceType && !Array.isArray(props.instanceType) ? props.instanceType : undefined;
    const { data, error } = await fetchGetInstanceOptions(singleType ? { instanceType: singleType } : {});
    if (error || !data) {
      return;
    }
    instances.value = data.records ?? [];
    buildOptions();
    applyDefaultFirst();
  } finally {
    loading.value = false;
  }
}

/** 只自动默认一次；用户手动清空后不再重新默认 */
const defaultApplied = ref(false);

function applyDefaultFirst() {
  if (!props.defaultFirst || defaultApplied.value) {
    return;
  }
  if (props.modelValue || options.value.length === 0) {
    return;
  }
  defaultApplied.value = true;
  const first = options.value[0].value;
  emit('update:modelValue', first);
  emit(
    'change',
    first,
    instances.value.find(item => item.id === first)
  );
}

function handleChange(value: unknown) {
  const id = typeof value === 'string' ? value : undefined;
  emit('update:modelValue', id);
  emit(
    'change',
    id,
    instances.value.find(item => item.id === id)
  );
}

watch(
  () => props.modelValue,
  (val, oldVal) => {
    // 父组件重置（如弹窗从编辑切到新增）时重新默认第一项；
    // 初次默认已发生后的用户手动清空不重复默认
    if (oldVal && !val) {
      applyDefaultFirst();
    }
  }
);

watch(
  () => props.instanceType,
  () => {
    buildOptions();
  }
);

onMounted(() => {
  loadInstances();
});
</script>

<template>
  <ASelect
    :value="modelValue"
    :options="options"
    :loading="loading"
    :placeholder="placeholder ?? $t('page.manage.monitor.common.selectInstance')"
    show-search
    option-filter-prop="label"
    allow-clear
    class="w-full"
    @change="handleChange"
  >
    <template #option="{ label, env, healthStatus }">
      <span class="flex-y-center gap-8px">
        <span
          class="inline-block h-8px w-8px rounded-full"
          :class="{
            'bg-#52c41a': healthStatus === 'UP',
            'bg-#ff4d4f': healthStatus === 'DOWN',
            'bg-#bfbfbf': healthStatus !== 'UP' && healthStatus !== 'DOWN'
          }"
        />
        <span>{{ label }}</span>
        <span v-if="env" class="text-12px text-#999">{{ env }}</span>
      </span>
    </template>
  </ASelect>
</template>

<style scoped></style>
