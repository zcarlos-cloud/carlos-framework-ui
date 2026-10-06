<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { TableRowSelection } from 'ant-design-vue/es/table/interface';
import { fetchGetDepartmentTree, fetchGetWorkflowCandidates } from '@/service/api';
import { $t } from '@/locales';

/**
 * 审批交互动作的选人弹窗（转办 / 委托 / 加签 / 减签）
 *
 * 候选口径由后端按 `action` 决定，前端**不再自己过滤**：
 * 减签只列该任务已有的办理人，转办 / 委托 / 加签排除已有办理人。
 *
 * 组件只负责「选人」，不发审批请求：确认后把用户 id 抛给调用方，
 * 由调用方（待办页）统一调 `/workflow/task/handle` 并在成功后关闭本弹窗
 * —— 提交中的 loading 因此由调用方通过 `confirm-loading` 传进来。
 */
defineOptions({
  name: 'TodoCandidateModal'
});

/** 只有这四个动作需要挑人 */
type CandidateAction = Extract<
  Api.Workflow.WorkflowAction,
  'TRANSFER' | 'DEPUTE' | 'ADD_SIGNATURE' | 'REDUCTION_SIGNATURE'
>;

interface Props {
  /** 目标待办任务 id */
  taskId: string;
  /** 触发选人的动作，同时决定单选 / 多选与标题 */
  action: CandidateAction;
  /** 提交中：由调用方控制确认按钮的 loading */
  confirmLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  confirmLoading: false
});

interface Emits {
  /** 已选中的用户 id（`WorkflowCandidateAO.userId`，Long ⇒ 字符串） */
  (e: 'confirmed', userIds: string[]): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const DEFAULT_PAGE_SIZE = 10;

/** 转办、委托只能是「一个人接手」，加签、减签可以多选 */
const multiple = computed(() => props.action === 'ADD_SIGNATURE' || props.action === 'REDUCTION_SIGNATURE');

const ACTION_TITLE_KEYS: Record<CandidateAction, App.I18n.I18nKey> = {
  TRANSFER: 'page.workflow.todo.candidate.transferTitle',
  DEPUTE: 'page.workflow.todo.candidate.deputeTitle',
  ADD_SIGNATURE: 'page.workflow.todo.candidate.addSignatureTitle',
  REDUCTION_SIGNATURE: 'page.workflow.todo.candidate.reductionSignatureTitle'
};

const title = computed(() => $t(ACTION_TITLE_KEYS[props.action]));

const loading = ref(false);
const data = ref<Api.Workflow.WorkflowCandidate[]>([]);
const total = ref(0);
const selectedUserIds = ref<string[]>([]);
const deptId = ref<string | undefined>(undefined);

const query = reactive({
  current: 1,
  size: DEFAULT_PAGE_SIZE
});

interface DeptTreeNode {
  value: string;
  title: string;
  children?: DeptTreeNode[];
}

const deptTreeData = ref<DeptTreeNode[]>([]);
const deptTreeLoading = ref(false);
const deptTreeLoaded = ref(false);

const columns = computed<AntDesign.TableColumnType<Api.Workflow.WorkflowCandidate>[]>(() => [
  {
    key: 'name',
    dataIndex: 'name',
    title: $t('page.workflow.todo.candidate.userName'),
    align: 'center',
    ellipsis: true
  },
  {
    key: 'code',
    dataIndex: 'code',
    title: $t('page.workflow.todo.candidate.account'),
    align: 'center',
    width: 140,
    ellipsis: true
  },
  {
    key: 'deptName',
    dataIndex: 'deptName',
    title: $t('page.workflow.todo.candidate.dept'),
    align: 'center',
    width: 180,
    ellipsis: true,
    customRender: ({ record }) => record.deptName || '-'
  }
]);

const rowSelection = computed<TableRowSelection<Api.Workflow.WorkflowCandidate>>(() => ({
  type: multiple.value ? 'checkbox' : 'radio',
  selectedRowKeys: selectedUserIds.value,
  onChange: keys => {
    selectedUserIds.value = keys.map(key => String(key));
  }
}));

const pagination = computed<AntDesign.TablePaginationConfig>(() => ({
  current: query.current,
  pageSize: query.size,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '30'],
  showTotal: t => $t('common.totalItems', { total: t })
}));

async function getData() {
  if (!props.taskId) {
    return;
  }

  loading.value = true;

  try {
    // action 是枚举名（后端 ApiWorkflowCandidatePageParam.action 是 WorkflowActionEnum）
    const { data: paging, error } = await fetchGetWorkflowCandidates(props.taskId, {
      action: props.action,
      deptId: deptId.value,
      current: query.current,
      size: query.size
    });

    if (error) {
      return;
    }

    data.value = paging?.records ?? [];
    total.value = paging?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

function toDeptTree(nodes: Api.Organization.DepartmentTree[]): DeptTreeNode[] {
  return nodes.map(node => ({
    value: node.id,
    title: node.deptName,
    children: node.children?.length ? toDeptTree(node.children) : undefined
  }));
}

/**
 * 部门筛选树只拉一次
 *
 * 拉不到（org 服务不可用 / 无权限）时**不阻断选人**：候选列表本身就是全量的，
 * 少一个筛选项不影响正确性，报错交给请求层提示。
 */
async function loadDeptTree() {
  if (deptTreeLoaded.value) {
    return;
  }

  deptTreeLoading.value = true;

  try {
    const { data: tree, error } = await fetchGetDepartmentTree();

    if (!error && tree) {
      deptTreeData.value = toDeptTree(tree);
      deptTreeLoaded.value = true;
    }
  } finally {
    deptTreeLoading.value = false;
  }
}

function handleDeptChange() {
  query.current = 1;
  getData();
}

function handleTableChange(page: AntDesign.TablePaginationConfig) {
  query.current = page.current ?? 1;
  query.size = page.pageSize ?? DEFAULT_PAGE_SIZE;
  getData();
}

function handleConfirm() {
  if (selectedUserIds.value.length === 0) {
    window.$message?.warning?.($t('page.workflow.todo.candidate.needSelection'));
    return;
  }

  emit('confirmed', selectedUserIds.value);
}

watch(visible, value => {
  if (!value) {
    return;
  }

  selectedUserIds.value = [];
  deptId.value = undefined;
  query.current = 1;
  query.size = DEFAULT_PAGE_SIZE;

  loadDeptTree();
  getData();
});
</script>

<template>
  <AModal
    v-model:open="visible"
    :title="title"
    :width="720"
    :confirm-loading="confirmLoading"
    :ok-text="$t('common.confirm')"
    :cancel-text="$t('common.cancel')"
    @ok="handleConfirm"
  >
    <AAlert
      v-if="!multiple"
      type="info"
      show-icon
      class="mb-16px"
      :message="$t('page.workflow.todo.candidate.singleTip')"
    />
    <div class="mb-12px flex-y-center justify-end">
      <ATreeSelect
        v-model:value="deptId"
        class="w-260px"
        :tree-data="deptTreeData"
        :loading="deptTreeLoading"
        :placeholder="$t('page.workflow.todo.candidate.deptFilterPlaceholder')"
        show-search
        allow-clear
        @change="handleDeptChange"
      />
    </div>
    <ATable
      row-key="userId"
      size="small"
      :columns="columns"
      :data-source="data"
      :loading="loading"
      :row-selection="rowSelection"
      :pagination="pagination"
      :scroll="{ x: 460 }"
      @change="handleTableChange"
    />
  </AModal>
</template>

<style scoped></style>
