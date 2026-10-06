<script setup lang="tsx">
import { ref, watch } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchDeleteDictItem, fetchGetDictItemList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { $t } from '@/locales';
import DictItemOperateDrawer from './dict-item-operate-drawer.vue';

defineOptions({
  name: 'DictItemDrawer'
});

interface Props {
  dictId?: string;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const operateType = ref<AntDesign.TableOperateType>('add');
const itemDrawerVisible = ref(false);
const editingItem = ref<Api.SystemManage.DictItem | null>(null);

const { tableWrapperRef, scrollConfig } = useTableScroll();

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
  apiFn: fetchGetDictItemList,
  // 关掉挂载即查询：本列表的作用域 dictId 来自 props，而 apiParams.dictId 是 undefined ——
  // 开着 immediate 会先发一次**不带 dictId** 的请求（列出所有字典的字典项），
  // 随后 watch 才把 dictId 补上再查一次。首屏那一瞬的列表是错的。
  immediate: false,
  apiParams: {
    current: 1,
    size: 10,
    // 后端 SysDictItemPageParam：dictId / itemName / description
    dictId: undefined,
    itemName: undefined,
    description: undefined
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
      key: 'itemName',
      dataIndex: 'itemName',
      title: $t('page.manage.dict.itemName'),
      align: 'center',
      width: 140,
      ellipsis: true
    },
    {
      key: 'itemCode',
      dataIndex: 'itemCode',
      title: $t('page.manage.dict.itemCode'),
      align: 'center',
      width: 140,
      ellipsis: true
    },
    {
      key: 'orderNum',
      dataIndex: 'orderNum',
      title: $t('page.manage.dict.orderNum'),
      align: 'center',
      width: 80
    },
    {
      key: 'enable',
      dataIndex: 'enable',
      title: $t('page.manage.common.statusTitle'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => {
        const { enable } = record;

        if (enable === null || enable === undefined) {
          return null;
        }

        const labelKey = enable ? 'page.manage.common.status.enable' : 'page.manage.common.status.disable';

        return <Tag color={enable ? 'success' : 'default'}>{$t(labelKey)}</Tag>;
      }
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 130,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          <Button type="primary" ghost size="small" onClick={() => handleEditItem(record)}>
            {$t('common.edit')}
          </Button>
          <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDeleteItem(record.id)}>
            <Button danger size="small">
              {$t('common.delete')}
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ]
});

const { checkedRowKeys, rowSelection, onBatchDeleted, onDeleted } = useTableOperate(data, getData);

const deleting = ref(false);

async function handleBatchDeleteItem() {
  const ids = checkedRowKeys.value as string[];

  if (ids.length === 0) {
    return;
  }

  deleting.value = true;
  try {
    const { error } = await fetchDeleteDictItem(ids);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    // success toast 由 onBatchDeleted 内部统一发出，此处不得重复
    await onBatchDeleted();
    emit('submitted');
  } finally {
    deleting.value = false;
  }
}

async function handleDeleteItem(id: string) {
  deleting.value = true;
  try {
    const { error } = await fetchDeleteDictItem([id]);

    if (error) {
      window.$message?.error?.($t('common.deleteFailed'));
      return;
    }

    await onDeleted();
    emit('submitted');
  } finally {
    deleting.value = false;
  }
}

function handleAddItem() {
  operateType.value = 'add';
  editingItem.value = null;
  itemDrawerVisible.value = true;
}

function handleEditItem(record: Api.SystemManage.DictItem) {
  operateType.value = 'edit';
  editingItem.value = { ...record };
  itemDrawerVisible.value = true;
}

async function handleItemSubmitted() {
  itemDrawerVisible.value = false;
  getDataByPage();
  emit('submitted');
}

/**
 * 重置只清掉「本层」的筛选条件，**父级作用域必须保住**
 *
 * `resetSearchParams()` 是把 `apiParams` 的快照写回 `searchParams`，
 * 而 `apiParams.dictId` 是 `undefined` —— 直接调它会把「打开这个抽屉的字典上下文」
 * 一起清掉。用户看不到 dictId，「点了一下重置」的后果却是：
 * 下一次搜索会列出**所有字典**的字典项。而且它本身不重新查询，
 * 错误范围要等到下一次搜索才暴露，更难排查。
 *
 * 顺带补一次重新查询：作用域被打回全量再等用户手动点搜索，中间那段时间
 * 界面上的数据与筛选条件已经不一致了。
 */
function handleResetSearchParams() {
  resetSearchParams();
  searchParams.dictId = props.dictId;
  getDataByPage();
}

/**
 * ⚠️ `{ immediate: true }` 不可省
 *
 * 父组件是 `v-if="selectedDict"`，并在**同一个 tick**里把 `visible` 置为 true
 * （见 dict/index.vue 的 openDictItem）。也就是说本组件**挂载时 visible 已经是 true**，
 * 单纯 watch(visible) 永远等不到 false→true 那一次跳变，回调一次都不会执行。
 *
 * 这正是此前 `dictId` 作用域从来没生效的原因：唯一发出的请求是 useTable 挂载时的
 * 自动查询（那时 dictId 还是 undefined），于是「字典项」列表列的其实是**所有字典**的字典项。
 * 重置按钮把这个错误范围留了下来，只是让它变得显眼而已。
 */
watch(
  visible,
  () => {
    if (visible.value && props.dictId) {
      searchParams.dictId = props.dictId;
      getDataByPage();
    }
  },
  { immediate: true }
);
</script>

<template>
  <ADrawer v-model:open="visible" :title="$t('page.manage.dict.dictItemTitle')" :width="720">
    <div class="min-h-500px flex-col-stretch gap-16px">
      <div class="flex flex-wrap gap-12px">
        <AInput
          v-model:value="searchParams.itemName"
          :placeholder="$t('page.manage.dict.form.itemName')"
          allow-clear
          class="w-200px"
          @press-enter="() => getDataByPage()"
        />
        <AInput
          v-model:value="searchParams.description"
          :placeholder="$t('page.manage.dict.form.description')"
          allow-clear
          class="w-200px"
          @press-enter="() => getDataByPage()"
        />
        <AButton @click="handleResetSearchParams">
          <template #icon>
            <icon-ic-round-refresh class="align-sub text-icon" />
          </template>
          <span class="ml-8px">{{ $t('common.reset') }}</span>
        </AButton>
        <AButton type="primary" ghost @click="() => getDataByPage()">
          <template #icon>
            <icon-ic-round-search class="align-sub text-icon" />
          </template>
          <span class="ml-8px">{{ $t('common.search') }}</span>
        </AButton>
      </div>
      <TableHeaderOperation
        v-model:columns="columnChecks"
        :disabled-delete="checkedRowKeys.length === 0 || deleting"
        :loading="loading"
        @add="handleAddItem"
        @delete="handleBatchDeleteItem"
        @refresh="getData"
      />
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
    </div>

    <DictItemOperateDrawer
      v-if="props.dictId"
      v-model:visible="itemDrawerVisible"
      :operate-type="operateType"
      :row-data="editingItem"
      :dict-id="props.dictId"
      @submitted="handleItemSubmitted"
    />
  </ADrawer>
</template>

<style scoped></style>
