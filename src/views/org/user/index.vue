<script setup lang="tsx">
import { ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import {
  fetchChangeUserState,
  fetchConfirmImportUser,
  fetchDeleteUser,
  fetchExportUser,
  fetchExportUserTemplate,
  fetchGetUserList,
  fetchPreviewImportUser,
  fetchUnlockUser
} from '@/service/api';
import { useExport } from '@/hooks/business/use-export';
import { useAuth } from '@/hooks/business/auth';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';
import UserAssignDeptDrawer from './modules/user-assign-dept-drawer.vue';
import UserDetailDrawer from './modules/user-detail-drawer.vue';
import UserOperateDrawer from './modules/user-operate-drawer.vue';
import UserResetPwdDrawer from './modules/user-reset-pwd-drawer.vue';
import UserSearch from './modules/user-search.vue';

// 性别/状态改由后端枚举字典驱动：搜索栏与两个抽屉都读这张字典，由本页统一加载
ensureEnumDict('org');

// 按钮级鉴权：权限码来自 /auth/user/me 的 buttons（后端按角色解析的 perm_code 集合）
const { hasAuth } = useAuth();

/**
 * 列宽：定宽列合计 64+140+100+140+120+100+420 = 1084，email 吃剩余宽度，故取 1200。
 * 操作列给到 420 是因为这里有六个按钮平铺，最宽组合是
 * 「详情 + 编辑 + 禁用 + 重置密码 + 分配部门 + 删除」。
 */
const { tableWrapperRef, scrollConfig } = useTableScroll(1200);

const {
  columns,
  columnChecks,
  data,
  getData,
  getDataByPage,
  loading,
  mobilePagination,
  searchParams,
  resetSearchParams
} = useTable({
  apiFn: fetchGetUserList,
  apiParams: {
    current: 1,
    size: 10,
    // 每个搜索字段都要在这里显式声明，值写 undefined，否则表单不会响应式
    userStatus: undefined,
    account: undefined,
    gender: undefined,
    nickname: undefined,
    phone: undefined,
    email: undefined
  },
  columns: () => [
    {
      key: 'index',
      title: $t('common.index'),
      dataIndex: 'index',
      align: 'center',
      width: 64
    },
    {
      key: 'account',
      dataIndex: 'account',
      title: $t('page.organization.user.userName'),
      align: 'center',
      width: 140,
      ellipsis: true
    },
    {
      key: 'gender',
      title: $t('page.organization.user.userGender'),
      align: 'center',
      dataIndex: 'gender',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('org', 'OrgUserGender', record.gender)}>
          {enumDictText('org', 'OrgUserGender', record.gender)}
        </Tag>
      )
    },
    {
      key: 'nickname',
      dataIndex: 'nickname',
      title: $t('page.organization.user.nickName'),
      align: 'center',
      width: 140,
      ellipsis: true
    },
    {
      key: 'phone',
      dataIndex: 'phone',
      title: $t('page.organization.user.userPhone'),
      align: 'center',
      width: 120
    },
    {
      // 不写宽度：吃掉剩余宽度（antd 是 table-layout: fixed，minWidth 是死属性）
      key: 'email',
      dataIndex: 'email',
      title: $t('page.organization.user.userEmail'),
      align: 'center',
      ellipsis: true
    },
    {
      key: 'userStatus',
      dataIndex: 'userStatus',
      title: $t('page.organization.user.userStatus'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => (
        <Tag color={enumDictColor('org', 'OrgUserState', record.userStatus)}>
          {enumDictText('org', 'OrgUserState', record.userStatus)}
        </Tag>
      )
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      // 六个按钮：详情 + 编辑/解锁·启用停用 + 重置密码 + 分配部门 + 删除，
      // 宽度按「最宽组合不换行」取值（去掉一个按钮就要同步调小）
      width: 420,
      customRender: ({ record }) => {
        /**
         * ⚠️ 后端 `OrgUserVO.userStatus` 是 Integer，Jackson 直接下发**数字**（0/1/2），
         * 而 `Api.Organization.UserStatus` 声明的是字符串码 `'0' | '1' | '2'`。
         *
         * 查表不受影响（对象取键会隐式把数字转成字符串），但**严格比较会恒为 false** ——
         * `record.userStatus === '1'` 在启用用户上得到 false，会让「启用/禁用」指向反方向、
         * 且锁定用户的「解锁」永远不显示。所以这里先统一成字符串再比较。
         */
        const status = String(record.userStatus);
        const enabled = status === '1';
        const locked = status === '2';

        return (
          <div class="flex-center gap-8px">
            <Button size="small" onClick={() => openDetail(record.id)}>
              {$t('page.organization.user.detail')}
            </Button>
            {hasAuth('org:user:update') && (
              <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
                {$t('common.edit')}
              </Button>
            )}
            {/* 锁定态（2）不能靠 changeState 改变：该接口只收 0/1，锁定是系统置的，只能走 unlock */}
            {hasAuth('org:user:changeState') &&
              (locked ? (
                <Button
                  type="primary"
                  ghost
                  size="small"
                  loading={isPending(record.id, 'unlock')}
                  onClick={() => handleUnlock(record.id)}
                >
                  {$t('page.organization.user.unlock')}
                </Button>
              ) : (
                <Button
                  danger
                  ghost
                  size="small"
                  loading={isPending(record.id, 'toggle')}
                  onClick={() => handleToggleState(record.id, enabled ? '0' : '1')}
                >
                  {enabled ? $t('page.manage.common.status.disable') : $t('page.manage.common.status.enable')}
                </Button>
              ))}
            {hasAuth('org:user:resetPwd') && (
              <Button size="small" onClick={() => openResetPwd(record.id, record.account)}>
                {$t('page.organization.user.resetPassword')}
              </Button>
            )}
            {hasAuth('org:user:assignDept') && (
              <Button size="small" onClick={() => openAssignDept(record.id, record.account)}>
                {$t('page.organization.user.assignDept')}
              </Button>
            )}
            {hasAuth('org:user:delete') && (
              <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
                <Button danger size="small" loading={isPending(record.id, 'delete')}>
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

const {
  drawerVisible,
  operateType,
  editingData,
  handleAdd,
  handleEdit,
  checkedRowKeys,
  rowSelection,
  onBatchDeleted,
  onDeleted
} = useTableOperate(data, getData);

const deleting = ref(false);

/**
 * 行内操作的 in-flight 标记，形如 `${id}:toggle`
 *
 * 必须按行记录：用一个全局 ref 的话，点第 1 行的「解锁」会让**所有行**的同类按钮一起转圈
 * （audit/archive 就是这个问题）。
 */
const pendingAction = ref('');

function isPending(id: string, action: string) {
  return pendingAction.value === `${id}:${action}`;
}

const resetPwdVisible = ref(false);
const resetPwdUserId = ref('');
const resetPwdAccount = ref('');

function openResetPwd(id: string, account: string) {
  resetPwdUserId.value = id;
  resetPwdAccount.value = account;
  resetPwdVisible.value = true;
}

const assignDeptVisible = ref(false);
const assignDeptUserId = ref('');
const assignDeptAccount = ref('');

function openAssignDept(id: string, account: string) {
  assignDeptUserId.value = id;
  assignDeptAccount.value = account;
  assignDeptVisible.value = true;
}

/**
 * 只读详情
 *
 * 此前存在一个 `/org/user-detail/:id` 页面（`views/org/user-detail/[id].vue`），
 * 但它只是个 `LookForward` 占位、且全仓没有任何 `router.push` 指向它 ——
 * 也就是说用户详情这个能力实际上并不存在。这里改成抽屉，与其余页面的形态一致。
 */
const detailVisible = ref(false);
const detailUserId = ref('');

function openDetail(id: string) {
  detailUserId.value = id;
  detailVisible.value = true;
}

/**
 * 启用 / 禁用
 *
 * 后端 changeState 的入参是 OrgUserStateEnum **枚举名**，且只接受 0（禁用）/ 1（启用）；
 * 传 2 会抛 InvalidUserStateException（锁定由系统设置，见 fetchChangeUserState 的注释）。
 */
async function handleToggleState(id: string, next: Extract<Api.Organization.UserStatus, '0' | '1'>) {
  pendingAction.value = `${id}:toggle`;

  try {
    const { error } = await fetchChangeUserState(id, next);

    if (error) {
      // 请求层已弹过提示，此处不得重复
      return;
    }

    window.$message?.success?.($t('page.organization.user.stateChanged'));
    await getData();
  } finally {
    pendingAction.value = '';
  }
}

/** 解锁：状态由 2（锁定）恢复为 1（启用） */
async function handleUnlock(id: string) {
  pendingAction.value = `${id}:unlock`;

  try {
    const { error } = await fetchUnlockUser(id);

    if (error) {
      return;
    }

    window.$message?.success?.($t('page.organization.user.stateChanged'));
    await getData();
  } finally {
    pendingAction.value = '';
  }
}

async function handleBatchDelete() {
  const ids = checkedRowKeys.value;

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteUser(ids);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    // success toast 由 onBatchDeleted 内部统一发出，此处不得重复
    await onBatchDeleted();
  } finally {
    deleting.value = false;
  }
}

async function handleDelete(id: string) {
  pendingAction.value = `${id}:delete`;

  try {
    const { error } = await fetchDeleteUser([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
  } finally {
    pendingAction.value = '';
  }
}

/**
 * 列定义在 useTableOperate 之前，而 handleEdit 是解构出来的 const（不提升），
 * 直接引用会触发 @typescript-eslint/no-use-before-define。
 * 用函数声明（会提升）包一层即可，调用发生在点击时，handleEdit 必然已就绪。
 */
function edit(id: string) {
  handleEdit(id);
}

const { exporting, exportFile } = useExport();

/** 导出**当前筛选结果** —— service 层剥掉 current/size，后端与列表共用同一份过滤条件 */
function handleExport() {
  return exportFile(() => fetchExportUser(searchParams), 'org_user');
}

function handleExportTemplate() {
  return exportFile(() => fetchExportUserTemplate(), 'org_user_template');
}

const importVisible = ref(false);

/**
 * 导入预览要展示的列：**只列真正会被写入的四个字段**
 *
 * 模板里还有「部门」「角色」两列，但后端 confirmImportUser 并不读取它们，
 * 因此不放进预览表（让预览表反映「会发生什么」），改用 notice 明确告知用户。
 */
const importPreviewColumns = [
  { key: 'account', title: $t('page.organization.user.userName') },
  { key: 'nickname', title: $t('page.organization.user.nickName') },
  { key: 'phone', title: $t('page.organization.user.userPhone') },
  { key: 'email', title: $t('page.organization.user.userEmail') }
];
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <UserSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.organization.user.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch card-wrapper sm:flex-1-hidden"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0 || deleting"
          :loading="loading"
          @add="handleAdd"
          @delete="handleBatchDelete"
          @refresh="getData"
        >
          <template #suffix>
            <AButton size="small" :loading="exporting" @click="handleExport">
              {{ $t('page.manage.common.export') }}
            </AButton>
            <AButton size="small" :loading="exporting" @click="handleExportTemplate">
              {{ $t('page.manage.common.template') }}
            </AButton>
            <AButton size="small" @click="importVisible = true">{{ $t('page.manage.common.import') }}</AButton>
          </template>
        </TableHeaderOperation>
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="data"
        size="small"
        :row-selection="rowSelection"
        :scroll="scrollConfig"
        :loading="loading"
        row-key="id"
        :pagination="mobilePagination"
        class="h-full"
      />

      <UserOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getDataByPage"
      />

      <UserResetPwdDrawer
        v-model:visible="resetPwdVisible"
        :user-id="resetPwdUserId"
        :account="resetPwdAccount"
        @submitted="getData"
      />

      <UserAssignDeptDrawer
        v-model:visible="assignDeptVisible"
        :user-id="assignDeptUserId"
        :account="assignDeptAccount"
        @submitted="getData"
      />

      <UserDetailDrawer v-model:visible="detailVisible" :user-id="detailUserId" />

      <!--
        两阶段导入：选完文件自动 preview（逐行校验、只读），用户看过错误行再确认写入。
        notice 用来告知「模板里有、但不会被导入」的列，避免填了却被静默丢弃。
      -->
      <ImportDrawer
        v-model:visible="importVisible"
        :title="$t('page.manage.common.import')"
        :template-fn="fetchExportUserTemplate"
        :preview-fn="fetchPreviewImportUser"
        :confirm-fn="fetchConfirmImportUser"
        :preview-columns="importPreviewColumns"
        :notice="$t('page.organization.user.importNotice')"
        template-name="org_user_template"
        @imported="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped></style>
