<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddNews, fetchGetRoleOptions, fetchUpdateNews } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { useNewsDetailModal } from '@/hooks/business/news-detail';
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'NewsOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.SystemManage.News | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { formRef, validate, resetFields } = useAntdForm();
const { defaultRequiredRule, createMaxLengthRule } = useFormRules();
const submitLoading = ref(false);

/** 列宽取自 `carlos-system/docs/sql/sys_news.sql`：title 是 VARCHAR(256)；content 是 TEXT（不限长） */
const NEWS_TITLE_MAX = 256;

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.news.addNews'),
    edit: $t('page.manage.news.editNews')
  };
  return titles[props.operateType];
});

/**
 * 表单模型：scopeRoleIds 在前端是字符串数组（角色多选），提交时直接传给后端，
 * 由后端序列化为 JSON 存储（SysNewsCreateParam.scopeRoleIds: List<Long>）
 */
interface Model {
  title: string;
  newsType: Api.SystemManage.NewsType | undefined;
  content: string;
  publishScope: Api.SystemManage.NewsScope;
  scopeRoleIds: string[];
  isTop: boolean;
  expireTime: string | undefined;
}

const model = ref<Model>(createDefaultModel());

function createDefaultModel(): Model {
  return {
    title: '',
    newsType: undefined,
    content: '',
    publishScope: '1',
    scopeRoleIds: [],
    isTop: false,
    expireTime: undefined
  };
}

type RuleKey = Extract<keyof Model, 'title' | 'newsType' | 'content' | 'publishScope' | 'scopeRoleIds'>;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  title: [defaultRequiredRule, createMaxLengthRule(NEWS_TITLE_MAX)],
  newsType: [defaultRequiredRule],
  content: [defaultRequiredRule],
  publishScope: [defaultRequiredRule],
  // 仅 publishScope=2 时必填，用动态 required 在模板层控制，这里只做非空校验
  scopeRoleIds: []
};

const isRoleScope = computed(() => model.value.publishScope === '2');

/** 角色下拉选项（抽屉打开时加载一次） */
const roleOptions = ref<{ label: string; value: string }[]>([]);

async function loadRoleOptions() {
  const { data, error } = await fetchGetRoleOptions();
  if (error || !data) {
    return;
  }
  roleOptions.value = data.map(role => ({ label: role.roleName, value: String(role.id) }));
}

const newsId = computed(() => props.rowData?.id ?? '');

/**
 * 编辑初始化：列表接口不下发 content（后端 select 白名单排除），
 * 直接用 rowData 初始化会把 content 置空并在保存时覆盖掉原内容（SKILL 例外 D），
 * 故编辑态必须按 id 拉详情初始化表单
 */
const { getNewsDetail } = useNewsDetailModal();

async function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const detail = await getNewsDetail(String(props.rowData.id));
    // 详情拉取失败时退回列表行初始化（content 字段为空，用户可感知而非静默丢数据：
    // 此时表单内容为空，用户若不重填直接保存才会覆盖，保存按钮在内容必填校验下会被拦下）
    const source = detail ?? props.rowData;
    const { title: newsTitle, newsType, content, publishScope, scopeRoleIds, isTop, expireTime } = source;

    // 显式逐字段赋值，禁止 Object.assign 整体铺开（SKILL 列表页范式第 13 条）
    // scopeRoleIds 后端存储为 JSON 数组字符串，编辑态解析回数组供多选框使用
    let parsedRoleIds: string[] = [];
    if (scopeRoleIds) {
      try {
        parsedRoleIds = (JSON.parse(scopeRoleIds) as (string | number)[]).map(String);
      } catch {
        parsedRoleIds = [];
      }
    }

    model.value = {
      title: newsTitle ?? '',
      newsType: newsType ? (String(newsType) as Api.SystemManage.NewsType) : undefined,
      content: content ?? '',
      publishScope: publishScope ? (String(publishScope) as Api.SystemManage.NewsScope) : '1',
      scopeRoleIds: parsedRoleIds,
      isTop: isTop ?? false,
      expireTime: expireTime ?? undefined
    };
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  if (isRoleScope.value && model.value.scopeRoleIds.length === 0) {
    window.$message?.warning?.($t('page.manage.news.form.scopeRoles'));
    return;
  }
  submitLoading.value = true;
  try {
    const payload: Api.SystemManage.NewsOperateParams = {
      title: model.value.title,
      newsType: model.value.newsType as Api.SystemManage.NewsType,
      content: model.value.content,
      publishScope: model.value.publishScope,
      scopeRoleIds: isRoleScope.value ? model.value.scopeRoleIds : undefined,
      isTop: model.value.isTop,
      expireTime: model.value.expireTime || undefined
    };

    const requestFn = props.operateType === 'edit' ? fetchUpdateNews : fetchAddNews;
    const { error } = await requestFn(props.operateType === 'edit' ? { id: newsId.value, ...payload } : payload);
    if (error) {
      return;
    }
    window.$message?.success?.(props.operateType === 'edit' ? $t('common.updateSuccess') : $t('common.addSuccess'));
    closeDrawer();
    emit('submitted');
  } finally {
    submitLoading.value = false;
  }
}

watch(visible, val => {
  if (val) {
    handleInitModel();
    resetFields();
    loadRoleOptions();
  }
});

/** 内容必填规则天然兜住「详情拉取失败时 content 为空」的误保存 */
</script>

<template>
  <!-- 宽度 480：规范默认档，竖排表单含多选与日期时间选择器 -->
  <ADrawer v-model:open="visible" :title="title" :width="480">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.manage.news.newsTitle')" name="title">
        <AInput
          v-model:value="model.title"
          :maxlength="NEWS_TITLE_MAX"
          show-count
          :placeholder="$t('page.manage.news.form.newsTitle')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.manage.news.newsType')" name="newsType">
        <ASelect v-model:value="model.newsType" :placeholder="$t('page.manage.news.form.newsType')">
          <ASelectOption
            v-for="option in enumDictOptions('sys', 'SysNewsType')"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </ASelectOption>
        </ASelect>
      </AFormItem>
      <AFormItem :label="$t('page.manage.news.publishScope')" name="publishScope">
        <ARadioGroup v-model:value="model.publishScope">
          <ARadio v-for="option in enumDictOptions('sys', 'SysNewsScope')" :key="option.value" :value="option.value">
            {{ option.label }}
          </ARadio>
        </ARadioGroup>
      </AFormItem>
      <AFormItem
        v-if="isRoleScope"
        :label="$t('page.manage.news.scopeRoles')"
        name="scopeRoleIds"
        :rules="[{ required: true, message: $t('page.manage.news.form.scopeRoles'), trigger: 'change' }]"
      >
        <ASelect
          v-model:value="model.scopeRoleIds"
          mode="multiple"
          :options="roleOptions"
          :placeholder="$t('page.manage.news.form.scopeRoles')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.manage.news.isTop')" name="isTop">
        <ASwitch v-model:checked="model.isTop" />
      </AFormItem>
      <AFormItem :label="$t('page.manage.news.expireTime')" name="expireTime">
        <!-- 后端 LocalDateTime 无全局格式器，ISO-8601 原样下发/回传；空表示永不过期 -->
        <ADatePicker
          v-model:value="model.expireTime"
          show-time
          value-format="YYYY-MM-DDTHH:mm:ss"
          class="w-full"
          :placeholder="$t('page.manage.news.form.expireTime')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.manage.news.content')" name="content">
        <!-- 一期用纯文本（设计稿的富文本编辑器前端暂无依赖，二期接入） -->
        <ATextarea v-model:value="model.content" :rows="8" :placeholder="$t('page.manage.news.form.content')" />
      </AFormItem>
    </AForm>
    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" @click="handleSubmit">
          {{ $t('common.confirm') }}
        </AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
