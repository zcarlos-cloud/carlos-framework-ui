<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  fetchAddAppCategory,
  fetchAppCategoryList,
  fetchDeleteAppCategory,
  fetchUpdateAppCategory
} from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'AppCategoryManageModal'
});

const visible = defineModel<boolean>('visible', {
  default: false
});

const loading = ref(false);
const categoryList = ref<Api.AppCategory.AppCategory[]>([]);

async function getCategoryList() {
  loading.value = true;
  try {
    const { data: list, error } = await fetchAppCategoryList();

    if (!error && list) {
      categoryList.value = list;
    }
  } finally {
    loading.value = false;
  }
}

const columns = [
  {
    key: 'categoryCode',
    dataIndex: 'categoryCode',
    title: $t('page.manage.appClient.categoryCode'),
    align: 'center' as const,
    width: 140
  },
  {
    key: 'categoryName',
    dataIndex: 'categoryName',
    title: $t('page.manage.appClient.categoryName'),
    align: 'center' as const,
    width: 140
  },
  {
    key: 'categoryIcon',
    dataIndex: 'categoryIcon',
    title: $t('page.manage.appClient.categoryIcon'),
    align: 'center' as const,
    width: 120
  },
  {
    key: 'sortOrder',
    dataIndex: 'sortOrder',
    title: $t('page.manage.appClient.sortOrder'),
    align: 'center' as const,
    width: 80
  },
  { key: 'operate', title: $t('common.operate'), align: 'center' as const, width: 150 }
];

const { formRef, validate, resetFields } = useAntdForm();
const { defaultRequiredRule, createMaxLengthRule } = useFormRules();

/** 列宽取自 `carlos-auth/docs/02-design/database/auth_postgresql.sql` 的 app_category：
 * category_code VARCHAR(32)、category_name VARCHAR(64)、category_icon VARCHAR(128) */
const CATEGORY_CODE_MAX = 32;
const CATEGORY_NAME_MAX = 64;
const CATEGORY_ICON_MAX = 128;

const operateVisible = ref(false);
const operateType = ref<AntDesign.TableOperateType>('add');
const submitLoading = ref(false);

type Model = {
  id: string;
  categoryCode: string;
  categoryName: string;
  categoryIcon: string;
  sortOrder: number;
};

const model = ref<Model>(createDefaultModel());

function createDefaultModel(): Model {
  return {
    id: '',
    categoryCode: '',
    categoryName: '',
    categoryIcon: '',
    sortOrder: 0
  };
}

const operateTitle = ref('');

type RuleKey = Extract<keyof Model, 'categoryCode' | 'categoryName' | 'categoryIcon'>;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  categoryCode: [defaultRequiredRule, createMaxLengthRule(CATEGORY_CODE_MAX)],
  categoryName: [defaultRequiredRule, createMaxLengthRule(CATEGORY_NAME_MAX)],
  categoryIcon: [createMaxLengthRule(CATEGORY_ICON_MAX)]
};

function handleAdd() {
  operateType.value = 'add';
  operateTitle.value = $t('page.manage.appClient.addCategory');
  model.value = createDefaultModel();
  operateVisible.value = true;
}

function handleEdit(record: Api.AppCategory.AppCategory) {
  operateType.value = 'edit';
  operateTitle.value = $t('page.manage.appClient.editCategory');
  model.value = {
    id: String(record.id),
    categoryCode: record.categoryCode,
    categoryName: record.categoryName,
    categoryIcon: record.categoryIcon ?? '',
    sortOrder: record.sortOrder ?? 0
  };
  operateVisible.value = true;
}

/**
 * 表格 bodyCell 插槽的 record 是无类型的，这里收口一次断言，
 * 避免在模板里写 `record as Api.AppCategory.AppCategory`（模板不认识 Api 命名空间，
 * 会触发 vue/no-undef-properties），同时也修掉了此前 handleEdit(record) 的类型错误
 */
function handleEditRow(record: unknown) {
  handleEdit(record as Api.AppCategory.AppCategory);
}

async function handleDelete(id: string) {
  const { error } = await fetchDeleteAppCategory(id);

  if (error) {
    window.$message?.error?.($t('common.deleteFailed'));
    return;
  }

  window.$message?.success?.($t('common.deleteSuccess'));
  getCategoryList();
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const payload = {
      categoryCode: model.value.categoryCode,
      categoryName: model.value.categoryName,
      categoryIcon: model.value.categoryIcon,
      sortOrder: model.value.sortOrder
    };

    const { error } =
      operateType.value === 'add'
        ? await fetchAddAppCategory(payload)
        : await fetchUpdateAppCategory({ ...payload, id: model.value.id });

    if (error) {
      window.$message?.error?.(operateType.value === 'add' ? $t('common.addFailed') : $t('common.updateFailed'));
      return;
    }

    window.$message?.success?.(operateType.value === 'add' ? $t('common.addSuccess') : $t('common.updateSuccess'));
    operateVisible.value = false;
    getCategoryList();
  } finally {
    submitLoading.value = false;
  }
}

watch(visible, val => {
  if (val) {
    getCategoryList();
  }
});

watch(operateVisible, val => {
  if (val) {
    resetFields();
  }
});
</script>

<template>
  <AModal v-model:open="visible" :title="$t('page.manage.appClient.categoryManage')" :width="720" :footer="null">
    <div class="mb-12px flex justify-end">
      <AButton type="primary" @click="handleAdd">{{ $t('page.manage.appClient.addCategory') }}</AButton>
    </div>
    <ATable
      :columns="columns"
      :data-source="categoryList"
      size="small"
      :loading="loading"
      row-key="id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'operate'">
          <div class="flex-center gap-8px">
            <AButton type="primary" ghost size="small" @click="handleEditRow(record)">
              {{ $t('common.edit') }}
            </AButton>
            <APopconfirm :title="$t('common.confirmDelete')" @confirm="handleDelete(String(record.id))">
              <AButton danger size="small">{{ $t('common.delete') }}</AButton>
            </APopconfirm>
          </div>
        </template>
      </template>
    </ATable>

    <AModal
      v-model:open="operateVisible"
      :title="operateTitle"
      :width="440"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
    >
      <AForm ref="formRef" :model="model" :rules="rules" layout="vertical" class="mt-16px">
        <AFormItem :label="$t('page.manage.appClient.categoryCode')" name="categoryCode">
          <AInput
            v-model:value="model.categoryCode"
            :maxlength="CATEGORY_CODE_MAX"
            show-count
            :placeholder="$t('page.manage.appClient.form.categoryCode')"
          />
        </AFormItem>
        <AFormItem :label="$t('page.manage.appClient.categoryName')" name="categoryName">
          <AInput
            v-model:value="model.categoryName"
            :maxlength="CATEGORY_NAME_MAX"
            show-count
            :placeholder="$t('page.manage.appClient.form.categoryName')"
          />
        </AFormItem>
        <AFormItem :label="$t('page.manage.appClient.categoryIcon')" name="categoryIcon">
          <AInput
            v-model:value="model.categoryIcon"
            :maxlength="CATEGORY_ICON_MAX"
            show-count
            :placeholder="$t('page.manage.appClient.form.categoryIcon')"
          />
        </AFormItem>
        <AFormItem :label="$t('page.manage.appClient.sortOrder')" name="sortOrder">
          <AInputNumber v-model:value="model.sortOrder" :min="0" class="w-full" />
        </AFormItem>
      </AForm>
    </AModal>
  </AModal>
</template>

<style scoped></style>
