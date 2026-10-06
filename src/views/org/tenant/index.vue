<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchChangeTenantStatus, fetchDeleteTenant, fetchGetTenantList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import TenantOperateDrawer from './modules/tenant-operate-drawer.vue';
import TenantInitAdminModal from './modules/tenant-init-admin-modal.vue';
import TenantSearch from './modules/tenant-search.vue';

// 租户状态改由后端枚举字典驱动：搜索栏共用本页加载的字典
ensureEnumDict('org');

/**
 * 列宽：定宽列合计 64+160+180+120+140+90+170+300 = 1224，remark 吃剩余宽度。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1300);

/** 平台租户保留 ID（后端 OrgProperties.tenant.platformTenantId 默认 0），不允许停用/删除/初始化管理员 */
const PLATFORM_TENANT_ID = '0';

/** 行操作进行中（停用/启用），绑定到按钮 disabled 防双击重复触发 */
const operating = ref(false);

/** 行删除进行中，绑定删除按钮 disabled 防双击重复提交 */
const deleting = ref(false);

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
  apiFn: fetchGetTenantList,
  apiParams: {
    current: 1,
    size: 10,
    // 后端 OrgTenantPageParam：tenantCode / tenantName 为模糊，tenantStatus 为精确
    tenantCode: undefined,
    tenantName: undefined,
    tenantStatus: undefined
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
      key: 'tenantCode',
      dataIndex: 'tenantCode',
      title: $t('page.organization.tenant.tenantCode'),
      align: 'center',
      width: 160,
      ellipsis: true
    },
    {
      key: 'tenantName',
      dataIndex: 'tenantName',
      title: $t('page.organization.tenant.tenantName'),
      align: 'center',
      width: 180,
      ellipsis: true
    },
    {
      key: 'contactName',
      dataIndex: 'contactName',
      title: $t('page.organization.tenant.contactName'),
      align: 'center',
      width: 120,
      ellipsis: true
    },
    {
      key: 'contactPhone',
      dataIndex: 'contactPhone',
      title: $t('page.organization.tenant.contactPhone'),
      align: 'center',
      width: 140,
      ellipsis: true
    },
    {
      key: 'tenantStatus',
      dataIndex: 'tenantStatus',
      title: $t('page.organization.tenant.tenantStatus'),
      align: 'center',
      width: 90,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('org', 'OrgTenantState', record.tenantStatus)}>
          {enumDictText('org', 'OrgTenantState', record.tenantStatus)}
        </Tag>
      )
    },
    {
      key: 'expireTime',
      dataIndex: 'expireTime',
      title: $t('page.organization.tenant.expireTime'),
      align: 'center',
      width: 170,
      // 空表示永不过期，给个明确文案而不是空白单元格
      customRender: ({ record }) => record.expireTime || $t('page.organization.tenant.neverExpire')
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'remark',
      dataIndex: 'remark',
      title: $t('page.organization.tenant.remark'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 300,
      customRender: ({ record }) => {
        // 后端 Integer 经 JSON 下发为数字，类型上按字符串声明，比较前统一转字符串
        const isNormal = String(record.tenantStatus) === '1';
        const isPlatform = record.id === PLATFORM_TENANT_ID;
        return (
          <div class="flex-center gap-8px">
            <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
              {$t('common.edit')}
            </Button>
            {!isPlatform && (
              <Button
                size="small"
                danger={isNormal}
                disabled={operating.value}
                onClick={() => handleChangeStatus(record.id, isNormal ? '2' : '1')}
              >
                {isNormal ? $t('page.organization.tenant.disable') : $t('page.organization.tenant.enable')}
              </Button>
            )}
            {!isPlatform && (
              <Button type="primary" ghost size="small" onClick={() => openInitAdmin(record.id)}>
                {$t('page.organization.tenant.initAdmin')}
              </Button>
            )}
            {!isPlatform && (
              <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
                <Button danger size="small" disabled={deleting.value}>
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

/** 初始化管理员弹窗状态 */
const initAdminVisible = ref(false);
const initAdminTenantId = ref('');

function edit(id: string) {
  handleEdit(id);
}

function openInitAdmin(id: string) {
  initAdminTenantId.value = id;
  initAdminVisible.value = true;
}

async function handleChangeStatus(id: string, targetStatus: Api.Organization.OrgTenantState) {
  operating.value = true;
  try {
    const { error } = await fetchChangeTenantStatus({ id, tenantStatus: targetStatus });
    if (error) {
      return;
    }
    await getData();
    window.$message?.success?.($t('common.updateSuccess'));
  } finally {
    operating.value = false;
  }
}

async function handleDelete(id: string) {
  deleting.value = true;
  try {
    const { error } = await fetchDeleteTenant([id]);
    if (error) {
      return;
    }
    // 成功提示 + 刷新统一走 hook（SKILL 规则 10：页面不自弹删除成功）
    await onDeleted();
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <TenantSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.organization.tenant.title')"
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
      <TenantOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />
      <TenantInitAdminModal v-model:visible="initAdminVisible" :tenant-id="initAdminTenantId" />
    </ACard>
  </div>
</template>

<style scoped></style>
