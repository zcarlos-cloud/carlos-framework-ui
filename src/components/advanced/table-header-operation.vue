<script setup lang="ts">
import { $t } from '@/locales';

defineOptions({
  name: 'TableHeaderOperation'
});

interface Props {
  disabledDelete?: boolean;
  loading?: boolean;
  /**
   * 是否显示「新增」按钮
   *
   * 只读列表页（数据由后端链路产生）置 false。
   * 注意：不能用 `<template #default />` 覆盖插槽来隐藏——空模板会被 Vue 编译器丢弃，
   * 插槽根本没注册，内置按钮照常渲染（审计日志/归档记录两页就是这么写的，实际没生效）。
   */
  showAdd?: boolean;
  /** 是否显示「批量删除」按钮，只读列表页置 false（同 showAdd 的说明） */
  showDelete?: boolean;
}

withDefaults(defineProps<Props>(), {
  showAdd: true,
  showDelete: true
});

interface Emits {
  (e: 'add'): void;

  (e: 'delete'): void;

  (e: 'refresh'): void;
}

const emit = defineEmits<Emits>();

const columns = defineModel<AntDesign.TableColumnCheck[]>('columns', {
  default: () => []
});

function add() {
  emit('add');
}

function batchDelete() {
  emit('delete');
}

function refresh() {
  emit('refresh');
}
</script>

<template>
  <div class="flex flex-wrap justify-end gap-x-12px gap-y-8px lt-sm:(w-200px py-12px)">
    <slot name="prefix"></slot>
    <slot name="default">
      <AButton v-if="showAdd" size="small" ghost type="primary" @click="add">
        <template #icon>
          <icon-ic-round-plus class="align-sub text-icon" />
        </template>
        <span class="ml-8px">{{ $t('common.add') }}</span>
      </AButton>
      <APopconfirm
        v-if="showDelete"
        :title="$t('common.confirmDelete')"
        :disabled="disabledDelete"
        @confirm="batchDelete"
      >
        <AButton size="small" danger :disabled="disabledDelete">
          <template #icon>
            <icon-ic-round-delete class="align-sub text-icon" />
          </template>

          <span class="ml-8px">{{ $t('common.batchDelete') }}</span>
        </AButton>
      </APopconfirm>
    </slot>
    <AButton size="small" @click="refresh">
      <template #icon>
        <icon-mdi-refresh class="align-sub text-icon" :class="{ 'animate-spin': loading }" />
      </template>
      <span class="ml-8px">{{ $t('common.refresh') }}</span>
    </AButton>
    <TableColumnSetting v-model:columns="columns" />
    <slot name="suffix"></slot>
  </div>
</template>

<style scoped></style>
