<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { sequenceResetCycleRecord, sequenceResetCycleTagColor } from '@/constants/business';
import { fetchDeleteSequenceRule, fetchGetSequenceRuleList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { enumTagColor, enumText } from '@/utils/common';
import { $t } from '@/locales';
import SequenceRuleOperateDrawer from './modules/sequence-rule-operate-drawer.vue';
import SequenceRuleSearch from './modules/sequence-rule-search.vue';

/**
 * 列宽：定宽列合计 64+170+180+100+150+90+80+110+130 = 1074，无弹性列。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1200);

/** 删除进行中，绑定按钮 disabled 防双击 */
const operating = ref(false);

const {
  columns,
  columnChecks,
  data,
  loading,
  getData,
  getDataByPage,
  mobilePagination,
  searchParams,
  resetSearchParams
} = useTable({
  apiFn: fetchGetSequenceRuleList,
  apiParams: {
    current: 1,
    size: 10,
    // 后端 SysSequenceRulePageParam：ruleCode / ruleName 均为模糊匹配
    ruleCode: undefined,
    ruleName: undefined
  },
  columns: () => [
    {
      key: 'index',
      dataIndex: 'index',
      title: $t('common.index'),
      width: 64,
      align: 'center'
    },
    {
      key: 'ruleCode',
      dataIndex: 'ruleCode',
      title: $t('page.manage.sequence.ruleCode'),
      align: 'center',
      width: 170,
      ellipsis: true
    },
    {
      key: 'ruleName',
      dataIndex: 'ruleName',
      title: $t('page.manage.sequence.ruleName'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      key: 'prefix',
      dataIndex: 'prefix',
      title: $t('page.manage.sequence.prefix'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => record.prefix || '-'
    },
    {
      key: 'datePattern',
      dataIndex: 'datePattern',
      title: $t('page.manage.sequence.datePattern'),
      align: 'center',
      width: 150,
      customRender: ({ record }) => record.datePattern || $t('page.manage.sequence.datePatternNone')
    },
    {
      key: 'seqLength',
      dataIndex: 'seqLength',
      title: $t('page.manage.sequence.seqLength'),
      align: 'center',
      width: 90
    },
    {
      key: 'step',
      dataIndex: 'step',
      title: $t('page.manage.sequence.step'),
      align: 'center',
      width: 80
    },
    {
      key: 'resetCycle',
      dataIndex: 'resetCycle',
      title: $t('page.manage.sequence.resetCycle'),
      align: 'center',
      width: 110,
      customRender: ({ record }) => (
        <Tag color={enumTagColor(sequenceResetCycleTagColor, record.resetCycle)}>
          {enumText(sequenceResetCycleRecord, record.resetCycle)}
        </Tag>
      )
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 130,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
            {$t('common.edit')}
          </Button>
          {/* 删除即放弃该规则的计数水位，重建会从 1 重发，故在确认框里补一句后果说明 */}
          <Popconfirm
            title={$t('common.confirmDelete')}
            description={$t('page.manage.sequence.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button danger size="small" disabled={operating.value}>
              {$t('common.delete')}
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ]
});

const { drawerVisible, operateType, editingData, handleAdd, handleEdit, onDeleted } = useTableOperate(data, getData);

function edit(id: string) {
  handleEdit(id);
}

async function handleDelete(id: string) {
  operating.value = true;
  try {
    const { error } = await fetchDeleteSequenceRule([id]);
    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }
    // 成功提示 + 刷新统一走 hook（SKILL 规则 10：页面不自弹删除成功）
    await onDeleted();
  } finally {
    operating.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <SequenceRuleSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.sequence.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :show-delete="false"
          :loading="loading"
          @add="handleAdd"
          @refresh="getData"
        />
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="data"
        :loading="loading"
        row-key="id"
        size="small"
        :pagination="mobilePagination"
        :scroll="scrollConfig"
        class="h-full"
      />
      <SequenceRuleOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
