<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchDeleteNews, fetchGetNewsList, fetchOfflineNews, fetchPublishNews } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { useNewsDetailModal } from '@/hooks/business/news-detail';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import NewsOperateDrawer from './modules/news-operate-drawer.vue';
import NewsSearch from './modules/news-search.vue';

// 公告类型/状态/范围改由后端枚举字典驱动（sys 模块）
ensureEnumDict('sys');

/**
 * 列宽：定宽列合计 64+240+90+100+70+90+170+170+340 = 1334，无弹性列。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1400);

/** 发布/下线/删除进行中，绑定按钮 disabled 防双击 */
const operating = ref(false);

/** 查看内容弹窗（列表接口不下发 content，点开才查详情；与顶栏铃铛共用 composable） */
const { contentVisible, contentLoading, contentTitle, contentBody, viewNewsDetail } = useNewsDetailModal();

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
  apiFn: fetchGetNewsList,
  apiParams: {
    current: 1,
    size: 10,
    // 后端 SysNewsPageParam：title 模糊，newsType/status 精确
    title: undefined,
    newsType: undefined,
    status: undefined
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
      key: 'title',
      dataIndex: 'title',
      title: $t('page.manage.news.newsTitle'),
      align: 'center',
      width: 240,
      ellipsis: true
    },
    {
      key: 'newsType',
      dataIndex: 'newsType',
      title: $t('page.manage.news.newsType'),
      align: 'center',
      width: 90,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('sys', 'SysNewsType', record.newsType)}>
          {enumDictText('sys', 'SysNewsType', record.newsType)}
        </Tag>
      )
    },
    {
      key: 'publishScope',
      dataIndex: 'publishScope',
      title: $t('page.manage.news.publishScope'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => enumDictText('sys', 'SysNewsScope', record.publishScope)
    },
    {
      key: 'isTop',
      dataIndex: 'isTop',
      title: $t('page.manage.news.isTop'),
      align: 'center',
      width: 70,
      customRender: ({ record }) => (record.isTop ? <Tag color="red">{$t('page.manage.news.isTop')}</Tag> : null)
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: $t('page.manage.news.status'),
      align: 'center',
      width: 90,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('sys', 'SysNewsStatus', record.status)}>
          {enumDictText('sys', 'SysNewsStatus', record.status)}
        </Tag>
      )
    },
    {
      key: 'publishTime',
      dataIndex: 'publishTime',
      title: $t('page.manage.news.publishTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => record.publishTime || '-'
    },
    {
      key: 'expireTime',
      dataIndex: 'expireTime',
      title: $t('page.manage.news.expireTime'),
      align: 'center',
      width: 170,
      customRender: ({ record }) => record.expireTime || $t('page.manage.news.neverExpire')
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 340,
      customRender: ({ record }) => {
        // 后端 Integer 经 JSON 下发为数字，类型上按字符串声明，比较前统一转字符串
        const status = String(record.status);
        const editable = status !== '2';
        return (
          <div class="flex-center gap-8px">
            <Button type="link" size="small" onClick={() => viewNewsDetail(record.id, record.title)}>
              {$t('page.manage.news.viewContent')}
            </Button>
            {editable && (
              <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
                {$t('common.edit')}
              </Button>
            )}
            {editable && (
              <Popconfirm title={$t('page.manage.news.publishConfirm')} onConfirm={() => handlePublish(record.id)}>
                <Button type="primary" size="small" disabled={operating.value}>
                  {$t('page.manage.news.publish')}
                </Button>
              </Popconfirm>
            )}
            {status === '2' && (
              <Popconfirm title={$t('page.manage.news.offlineConfirm')} onConfirm={() => handleOffline(record.id)}>
                <Button danger size="small" disabled={operating.value}>
                  {$t('page.manage.news.offline')}
                </Button>
              </Popconfirm>
            )}
            {editable && (
              <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
                <Button danger size="small" disabled={operating.value}>
                  {$t('common.delete')}
                </Button>
              </Popconfirm>
            )}
          </div>
        );
      }
    }
  ]
});

const { drawerVisible, operateType, editingData, handleAdd, handleEdit, onDeleted } = useTableOperate(data, getData);

function edit(id: string) {
  handleEdit(id);
}

/** 发布/下线共用：仅请求函数与确认文案不同 */
async function handleChangeStatus(fetchFn: typeof fetchPublishNews, id: string) {
  operating.value = true;
  try {
    const { error } = await fetchFn(id);
    if (error) {
      return;
    }
    window.$message?.success?.($t('common.updateSuccess'));
    await getData();
  } finally {
    operating.value = false;
  }
}

function handlePublish(id: string) {
  handleChangeStatus(fetchPublishNews, id);
}

function handleOffline(id: string) {
  handleChangeStatus(fetchOfflineNews, id);
}

async function handleDelete(id: string) {
  operating.value = true;
  try {
    const { error } = await fetchDeleteNews([id]);
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
    <NewsSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.news.title')"
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
      <NewsOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
      <AModal v-model:open="contentVisible" :title="contentTitle" :footer="null" :width="640">
        <ASpin :spinning="contentLoading">
          <div class="min-h-120px whitespace-pre-wrap">{{ contentBody }}</div>
        </ASpin>
      </AModal>
    </ACard>
  </div>
</template>

<style scoped></style>
