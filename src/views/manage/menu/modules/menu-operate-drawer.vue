<script setup lang="tsx">
import { computed, nextTick, ref, watch } from 'vue';
import { SimpleScrollbar } from '@sa/materials';
import { fetchAddMenu, fetchUpdateMenu } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { enumDictNameOptions } from '@/utils/enum-dict';
import { getLocalIcons } from '@/utils/icon';
import { type TreeNode, listToTree } from '@/utils/tree';
import { $t } from '@/locales';
import IconPicker from '@/components/custom/icon-picker.vue';
import SvgIcon from '@/components/custom/svg-icon.vue';
import {
  getLayoutAndPage,
  getPathParamFromRoutePath,
  getRoutePathByRouteName,
  getRoutePathWithParam,
  normalizeParentId,
  parseRouteQuery,
  transformLayoutAndPageToComponent
} from './shared';

defineOptions({
  name: 'MenuOperateDrawer'
});

export type OperateType = AntDesign.TableOperateType | 'addChild';

/**
 * 顶层菜单的父级哨兵
 *
 * 与后端 `CoreConstant.PARENT_LONG_0` 一致：库里顶层菜单的 parent_id 存的就是 0，
 * 而 VO 在 `@JsonInclude(NON_NULL)` 下可能把 0 下发成 "0"、也可能干脆不带该字段。
 * 表单统一用 "0" 表示「顶级菜单」，提交前经 `normalizeParentId` 收成 null。
 */
const ROOT_PARENT_ID = '0';

interface Props {
  /** the type of operation */
  operateType: OperateType;
  /** the edit menu data or the parent menu data when adding a child menu */
  rowData?: Api.SystemManage.Menu | null;
  /** all pages */
  allPages: string[];
  /** 全量菜单，用于「上级菜单」树选择 */
  menuList?: Api.SystemManage.Menu[];
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
const { defaultRequiredRule, patternRules, createMaxLengthRule, createNumberRangeRule } = useFormRules();

/**
 * 列宽取自 `carlos-system/docs/02-design/database/system_postgresql.sql` 的 sys_menu：
 * menu_name / route_name / i18n_key 是 VARCHAR(100)、route_path VARCHAR(200)、href VARCHAR(500)；
 * pathParam 无独立列（拼进 route_path），按路由参数名语义取 50；
 * order_num / fixed_index_in_tab 是 INTEGER；buttons 的 code / desc 落 sys_operation
 * 的 perm_code / op_name（均 VARCHAR(100)）；query 的 key / value 是 route_query（TEXT）的
 * JSON 键值，按查询参数语义取 100
 */
const MENU_NAME_MAX = 100;
const ROUTE_NAME_MAX = 100;
const ROUTE_PATH_MAX = 200;
const PATH_PARAM_MAX = 50;
const I18N_KEY_MAX = 100;
const HREF_MAX = 500;
const BUTTON_CODE_MAX = 100;
const BUTTON_DESC_MAX = 100;
const QUERY_ITEM_MAX = 100;
const ORDER_NUM_MIN = 0;
const ORDER_NUM_MAX = 9999;
const FIXED_TAB_INDEX_MIN = 0;
const FIXED_TAB_INDEX_MAX = 9999;

const title = computed(() => {
  const titles: Record<OperateType, string> = {
    add: $t('page.manage.menu.addMenu'),
    addChild: $t('page.manage.menu.addChildMenu'),
    edit: $t('page.manage.menu.editMenu')
  };
  return titles[props.operateType];
});

type Model = Pick<
  Api.SystemManage.Menu,
  | 'menuCategory'
  | 'menuName'
  | 'clientType'
  | 'routeName'
  | 'routePath'
  | 'component'
  | 'orderNum'
  | 'i18nKey'
  | 'icon'
  | 'iconType'
  | 'menuStatus'
  | 'parentId'
  | 'keepAlive'
  | 'constant'
  | 'href'
  | 'hideInMenu'
  | 'activeMenu'
  | 'multiTab'
  | 'fixedIndexInTab'
> & {
  query: NonNullable<Api.SystemManage.Menu['query']>;
  buttons: NonNullable<Api.SystemManage.Menu['buttons']>;
  layout: string;
  page: string;
  pathParam: string;
};

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    menuCategory: 'DIRECTORY',
    menuName: '',
    clientType: 'PC',
    routeName: '',
    routePath: '',
    pathParam: '',
    component: '',
    layout: '',
    page: '',
    i18nKey: null,
    icon: '',
    iconType: 'ICONIFY',
    parentId: ROOT_PARENT_ID,
    menuStatus: 'ENABLED',
    keepAlive: false,
    constant: false,
    orderNum: 0,
    href: null,
    hideInMenu: false,
    activeMenu: null,
    multiTab: false,
    fixedIndexInTab: null,
    query: [],
    buttons: []
  };
}

/**
 * 规则键必须与模板里 AFormItem 的 `name` 逐字一致
 * （反面教材见 SKILL.md 的 `RuleKey = Extract<...>` 一节：键写错会静默变成 `never`）
 */
type RuleKey = Extract<
  keyof Model,
  | 'menuName'
  | 'menuStatus'
  | 'routeName'
  | 'routePath'
  | 'pathParam'
  | 'i18nKey'
  | 'href'
  | 'orderNum'
  | 'fixedIndexInTab'
>;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  menuName: [defaultRequiredRule, createMaxLengthRule(MENU_NAME_MAX)],
  menuStatus: [defaultRequiredRule],
  routeName: [defaultRequiredRule, createMaxLengthRule(ROUTE_NAME_MAX)],
  routePath: [defaultRequiredRule, createMaxLengthRule(ROUTE_PATH_MAX)],
  pathParam: [createMaxLengthRule(PATH_PARAM_MAX)],
  i18nKey: [createMaxLengthRule(I18N_KEY_MAX)],
  // 外链地址走 URL 格式校验；空值合法（不填表示无外链，async-validator 对非必填空值跳过）
  href: [patternRules.url, createMaxLengthRule(HREF_MAX)],
  orderNum: [createNumberRangeRule(ORDER_NUM_MIN, ORDER_NUM_MAX)],
  fixedIndexInTab: [createNumberRangeRule(FIXED_TAB_INDEX_MIN, FIXED_TAB_INDEX_MAX)]
};

const disabledMenuType = computed(() => props.operateType === 'edit');

const localIcons = getLocalIcons();
const localIconOptions = localIcons.map(item => ({
  label: () => (
    <div class="flex-y-center gap-16px">
      <SvgIcon localIcon={item} class="text-icon" />
      <span>{item}</span>
    </div>
  ),
  value: item
}));

const showLayout = computed(() => !normalizeParentId(model.value.parentId));

const showPage = computed(() => model.value.menuCategory === 'MENU');

const pageOptions = computed(() => {
  const allPages = [...props.allPages];

  if (model.value.routeName && !allPages.includes(model.value.routeName)) {
    allPages.unshift(model.value.routeName);
  }

  const opts: CommonType.Option[] = allPages.map(page => ({
    label: page,
    value: page
  }));

  return opts;
});

const layoutOptions: CommonType.Option[] = [
  {
    label: 'base',
    value: 'base'
  },
  {
    label: 'blank',
    value: 'blank'
  }
];

interface MenuParentOption {
  /** 菜单 id，或顶级哨兵 "0" */
  value: string;
  title: string;
  children?: MenuParentOption[];
}

/**
 * 上级菜单选项
 *
 * 编辑时必须排除**自身及其整棵子树**，否则可以把菜单挂到自己的后代下形成环 ——
 * 环上的节点回溯不到根，整棵子树在树形查询里直接消失
 * （后端 `SysMenuService#checkParentCycle` 也会拒绝，但前端先挡一道，
 * 用户不必先提交一次才知道）。过滤掉自身节点即等于剪掉其子树
 * （子节点只出现在该分支里），与 `org-department-operate-drawer.vue` 的解法一致。
 *
 * 根节点固定为哨兵 "0"，代表「顶级菜单」—— 此前 parentId 在表单里根本没有控件，
 * 菜单建好就再也移不动了。
 */
const parentTreeData = computed<MenuParentOption[]>(() => {
  const excludedId = props.operateType === 'edit' ? props.rowData?.id : undefined;

  const tree = listToTree(props.menuList ?? [], (a, b) => (a.orderNum ?? 0) - (b.orderNum ?? 0));

  function toOptions(nodes: TreeNode<Api.SystemManage.Menu>[]): MenuParentOption[] {
    return nodes
      .filter(node => node.id !== excludedId)
      .map(node => {
        const children = node.children.length ? toOptions(node.children) : undefined;

        // 与列表列同样优先展示 i18n 文案，避免同一菜单在两处叫不同名字
        return { value: node.id, title: node.i18nKey ? $t(node.i18nKey) : node.menuName, children };
      });
  }

  return [{ value: ROOT_PARENT_ID, title: $t('page.manage.menu.topLevel'), children: toOptions(tree) }];
});

/**
 * 上一次由 routeName **自动推导**出来的 i18nKey
 *
 * 拿它当「这个值是不是用户手填的」的判据：与当前 i18nKey 相等 → 仍是自动生成的，
 * 可以继续跟随 routeName；不等 → 用户手填过，再跟随就是**静默覆盖用户的输入**。
 *
 * 这正是此前的缺陷：路由名一改，手写的 `i18nKey` 就被悄悄改写成 `route.<新路由名>`，
 * 而列表列是按 i18nKey 渲染的，等于改个路由名就把菜单文案换掉了。
 *
 * ⚠️ 声明必须早于 `handleInitModel`：那里要把它重置掉
 * （抽屉里行数据带来的 i18nKey 一律当作真实值，不许被 follow 覆盖），
 * 而 `const` 不提升，放后面会触发 no-use-before-define。
 */
const autoI18nKey = ref<string | null>(null);

/** 提交中状态 */
const submitLoading = ref(false);

/** - add a query input */
function addQuery(index: number) {
  model.value.query.splice(index + 1, 0, {
    key: '',
    value: ''
  });
}

/** - remove a query input */
function removeQuery(index: number) {
  model.value.query.splice(index, 1);
}

/** - add a button input */
function addButton(index: number) {
  model.value.buttons.splice(index + 1, 0, {
    code: '',
    desc: ''
  });
}

/** - remove a button input */
function removeButton(index: number) {
  model.value.buttons.splice(index, 1);
}

/**
 * 由表格行数据构造编辑态 model
 *
 * 显式挑选字段：直接 Object.assign(model, row) 会把 id / children /
 * createBy / haveChildren 等表格行数据一并写入 model，提交时又被原样回传。
 */
function buildModelFromRow(row: Api.SystemManage.Menu): Model {
  const { layout, page } = getLayoutAndPage(row.component);
  const { path, param } = getPathParamFromRoutePath(row.routePath ?? '');

  return {
    ...createDefaultModel(),
    // 顶层菜单的 parentId 是 0 或字段缺失，两种都收成哨兵 "0" 让下拉选中「顶级菜单」
    parentId: normalizeParentId(row.parentId) ?? ROOT_PARENT_ID,
    menuCategory: row.menuCategory,
    menuName: row.menuName,
    clientType: row.clientType ?? 'PC',
    routeName: row.routeName,
    routePath: path,
    pathParam: param,
    // 后端存的是 JSON 字符串，表单编辑的是 [{key, value}]，必须转回来，
    // 否则编辑已有菜单时「路由参数」一栏永远是空的，等于改不了
    query: parseRouteQuery(row.routeQuery),
    layout,
    page,
    icon: row.icon ?? '',
    iconType: row.iconType,
    menuStatus: row.menuStatus,
    orderNum: row.orderNum ?? 0,
    keepAlive: row.keepAlive ?? false,
    constant: row.constant ?? false,
    href: row.href ?? null,
    hideInMenu: row.hideInMenu ?? false,
    activeMenu: row.activeMenu ?? null,
    multiTab: row.multiTab ?? false,
    i18nKey: row.i18nKey ?? null,
    fixedIndexInTab: row.fixedIndexInTab ?? null,
    buttons: row.buttons ? row.buttons.map(item => ({ ...item })) : []
  };
}

async function handleInitModel() {
  model.value = createDefaultModel();
  // 重开抽屉时先清掉「自动生成」的标记：行里带来的 i18nKey 一律当作真实值，不许被跟随覆盖
  autoI18nKey.value = null;

  if (!props.rowData) return;

  await nextTick();

  if (props.operateType === 'addChild') {
    model.value.parentId = props.rowData.id;

    return;
  }

  if (props.operateType === 'edit') {
    model.value = buildModelFromRow(props.rowData);
  }
}

function closeDrawer() {
  visible.value = false;
}

function handleUpdateRoutePathByRouteName() {
  if (model.value.routeName) {
    model.value.routePath = getRoutePathByRouteName(model.value.routeName);
  } else {
    model.value.routePath = '';
  }
}

function handleUpdateI18nKeyByRouteName() {
  const { routeName, i18nKey } = model.value;

  // 用户手填的值不动
  if (i18nKey && i18nKey !== autoI18nKey.value) {
    return;
  }

  const next = routeName ? (`route.${routeName}` as App.I18n.I18nKey) : null;

  model.value.i18nKey = next;
  autoI18nKey.value = next;
}

/** 将 [{key, value}] 转为后端所需的 JSON 字符串 */
function buildRouteQuery(query: { key: string; value: string }[]): string | undefined {
  const entries = query.filter(item => item.key);

  if (entries.length === 0) {
    return undefined;
  }

  const record = entries.reduce<Record<string, string>>((acc, item) => ({ ...acc, [item.key]: item.value }), {});

  return JSON.stringify(record);
}

function getSubmitParams(): Api.SystemManage.MenuOperateParams {
  // layout / page / pathParam / query 为表单内部字段，不直接提交
  const { layout, page, pathParam, query, buttons, ...rest } = model.value;

  return {
    ...rest,
    // 顶级哨兵 "0" 收成 null：后端 ObjectUtil.isEmpty 会兜成 PARENT_LONG_0，来回一致
    parentId: normalizeParentId(model.value.parentId),
    component: transformLayoutAndPageToComponent(layout, page),
    routePath: getRoutePathWithParam(model.value.routePath, pathParam),
    routeQuery: buildRouteQuery(query),
    buttons: buttons.map(item => ({ code: item.code, desc: item.desc }))
  };
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const params = getSubmitParams();

    if (props.operateType === 'edit') {
      const { error } = await fetchUpdateMenu({ ...params, id: props.rowData?.id ?? '' });

      if (error) {
        window.$message?.error?.($t('common.updateFailed'));
        return;
      }

      window.$message?.success?.($t('common.updateSuccess'));
    } else {
      const { error } = await fetchAddMenu(params);

      if (error) {
        window.$message?.error?.($t('common.addFailed'));
        return;
      }

      window.$message?.success?.($t('common.addSuccess'));
    }

    closeDrawer();
    emit('submitted');
  } finally {
    submitLoading.value = false;
  }
}

watch(visible, () => {
  if (visible.value) {
    handleInitModel();
    resetFields();
  }
});

watch(
  () => model.value.routeName,
  () => {
    handleUpdateRoutePathByRouteName();
    handleUpdateI18nKeyByRouteName();
  }
);
</script>

<template>
  <!--
    宽度偏离 SKILL 默认档（360 / 480 / 560）取 720：本表单 20+ 个字段且走双列布局，
    每列还要容纳「固定在页签中的序号」这类长标签，再窄输入框就只剩不到 200px。
    高度同理不写死 —— h-480px 在大屏留白、小屏截断，改为按视口高度减去页头页脚推导。
  -->
  <ADrawer v-model:open="visible" :title="title" :width="720">
    <div class="h-[calc(100vh-180px)]">
      <SimpleScrollbar>
        <AForm ref="formRef" :model="model" :rules="rules" :label-col="{ lg: 7, xs: 4 }" label-wrap class="pr-20px">
          <ARow>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.parentId')" name="parentId">
                <!-- 树形选择：编辑时已排除自身及其子树，不会挂出环 -->
                <ATreeSelect
                  v-model:value="model.parentId"
                  :tree-data="parentTreeData"
                  :placeholder="$t('page.manage.menu.form.parentId')"
                  tree-default-expand-all
                  show-search
                  tree-node-filter-prop="title"
                />
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.menuType')" name="menuCategory">
                <ARadioGroup v-model:value="model.menuCategory" :disabled="disabledMenuType">
                  <ARadio
                    v-for="item in enumDictNameOptions('sys', 'MenuCategory')"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </ARadio>
                </ARadioGroup>
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.menuName')" name="menuName">
                <AInput
                  v-model:value="model.menuName"
                  :maxlength="MENU_NAME_MAX"
                  show-count
                  :placeholder="$t('page.manage.menu.form.menuName')"
                />
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.routeName')" name="routeName">
                <AInput
                  v-model:value="model.routeName"
                  :maxlength="ROUTE_NAME_MAX"
                  show-count
                  :placeholder="$t('page.manage.menu.form.routeName')"
                />
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.routePath')" name="routePath">
                <AInput
                  v-model:value="model.routePath"
                  disabled
                  :maxlength="ROUTE_PATH_MAX"
                  show-count
                  :placeholder="$t('page.manage.menu.form.routePath')"
                />
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.pathParam')" name="pathParam">
                <AInput
                  v-model:value="model.pathParam"
                  :maxlength="PATH_PARAM_MAX"
                  show-count
                  :placeholder="$t('page.manage.menu.form.pathParam')"
                />
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem v-if="showLayout" :label="$t('page.manage.menu.layout')" name="layout">
                <ASelect
                  v-model:value="model.layout"
                  :options="layoutOptions"
                  :placeholder="$t('page.manage.menu.form.layout')"
                />
              </AFormItem>
            </ACol>
            <ACol v-if="showPage" :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.page')" name="page">
                <ASelect
                  v-model:value="model.page"
                  :options="pageOptions"
                  :placeholder="$t('page.manage.menu.form.page')"
                />
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem
                :label="$t('page.manage.menu.i18nKey')"
                name="i18nKey"
                :extra="$t('page.manage.menu.i18nKeyHint')"
              >
                <AInput
                  v-model:value="model.i18nKey as string"
                  :maxlength="I18N_KEY_MAX"
                  show-count
                  :placeholder="$t('page.manage.menu.form.i18nKey')"
                />
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.order')" name="orderNum">
                <AInputNumber
                  v-model:value="model.orderNum as number"
                  class="w-full"
                  :min="ORDER_NUM_MIN"
                  :max="ORDER_NUM_MAX"
                  :precision="0"
                  :placeholder="$t('page.manage.menu.form.order')"
                />
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.iconTypeTitle')" name="iconType">
                <ARadioGroup v-model:value="model.iconType">
                  <ARadio v-for="item in enumDictNameOptions('sys', 'IconType')" :key="item.value" :value="item.value">
                    {{ item.label }}
                  </ARadio>
                </ARadioGroup>
              </AFormItem>
            </ACol>

            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.icon')" name="icon">
                <template v-if="model.iconType === 'ICONIFY'">
                  <IconPicker v-model:value="model.icon" />
                </template>
                <template v-if="model.iconType === 'LOCAL'">
                  <ASelect
                    v-model:value="model.icon"
                    :placeholder="$t('page.manage.menu.form.localIcon')"
                    :options="localIconOptions"
                  />
                </template>
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.menuStatus')" name="menuStatus">
                <ARadioGroup v-model:value="model.menuStatus">
                  <ARadio
                    v-for="item in enumDictNameOptions('sys', 'MenuStatus')"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </ARadio>
                </ARadioGroup>
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.keepAlive')" name="keepAlive">
                <ARadioGroup v-model:value="model.keepAlive">
                  <ARadio :value="true">{{ $t('common.yesOrNo.yes') }}</ARadio>
                  <ARadio :value="false">{{ $t('common.yesOrNo.no') }}</ARadio>
                </ARadioGroup>
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.constant')" name="constant">
                <ARadioGroup v-model:value="model.constant">
                  <ARadio value>
                    {{ $t('common.yesOrNo.yes') }}
                  </ARadio>
                  <ARadio :value="false">
                    {{ $t('common.yesOrNo.no') }}
                  </ARadio>
                </ARadioGroup>
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.href')" name="href">
                <AInput
                  v-model:value="model.href as string"
                  :maxlength="HREF_MAX"
                  show-count
                  :placeholder="$t('page.manage.menu.form.href')"
                />
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.hideInMenu')" name="hideInMenu">
                <ARadioGroup v-model:value="model.hideInMenu">
                  <ARadio :value="true">{{ $t('common.yesOrNo.yes') }}</ARadio>
                  <ARadio :value="false">{{ $t('common.yesOrNo.no') }}</ARadio>
                </ARadioGroup>
              </AFormItem>
            </ACol>
            <ACol v-if="model.hideInMenu" :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.activeMenu')" name="activeMenu">
                <ASelect
                  v-model:value="model.activeMenu as string"
                  :options="pageOptions"
                  clearable
                  :placeholder="$t('page.manage.menu.form.activeMenu')"
                />
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.multiTab')" name="multiTab">
                <ARadioGroup v-model:value="model.multiTab">
                  <ARadio value :label="$t('common.yesOrNo.yes')" />
                  <ARadio :value="false" :label="$t('common.yesOrNo.no')" />
                </ARadioGroup>
              </AFormItem>
            </ACol>
            <ACol :lg="12" :xs="24">
              <AFormItem :label="$t('page.manage.menu.fixedIndexInTab')" name="fixedIndexInTab">
                <AInputNumber
                  v-model:value="model.fixedIndexInTab as number"
                  class="w-full"
                  clearable
                  :min="FIXED_TAB_INDEX_MIN"
                  :max="FIXED_TAB_INDEX_MAX"
                  :precision="0"
                  :placeholder="$t('page.manage.menu.form.fixedIndexInTab')"
                />
              </AFormItem>
            </ACol>
            <ACol :span="24">
              <AFormItem :label-col="{ span: 4 }" :label="$t('page.manage.menu.query')" name="query">
                <AButton v-if="model.query.length === 0" type="dashed" block @click="addQuery(-1)">
                  <template #icon>
                    <icon-carbon-add class="align-sub text-icon" />
                  </template>
                  <span class="ml-8px">{{ $t('common.add') }}</span>
                </AButton>
                <template v-else>
                  <div v-for="(item, index) in model.query" :key="index" class="flex gap-3">
                    <ACol :span="9">
                      <AFormItem
                        :name="['query', index, 'key']"
                        :rules="[{ required: true, message: $t('page.manage.menu.form.queryKey') }]"
                      >
                        <AInput
                          v-model:value="item.key"
                          :maxlength="QUERY_ITEM_MAX"
                          show-count
                          :placeholder="$t('page.manage.menu.form.queryKey')"
                          class="flex-1"
                        />
                      </AFormItem>
                    </ACol>
                    <ACol :span="9">
                      <AFormItem :name="['query', index, 'value']">
                        <AInput
                          v-model:value="item.value"
                          :maxlength="QUERY_ITEM_MAX"
                          show-count
                          :placeholder="$t('page.manage.menu.form.queryValue')"
                          class="flex-1"
                        />
                      </AFormItem>
                    </ACol>
                    <ACol :span="5">
                      <ASpace class="ml-12px">
                        <AButton size="middle" @click="addQuery(index)">
                          <template #icon>
                            <icon-ic-round-plus class="align-sub text-icon" />
                          </template>
                        </AButton>
                        <AButton size="middle" @click="removeQuery(index)">
                          <template #icon>
                            <icon-ic-round-remove class="align-sub text-icon" />
                          </template>
                        </AButton>
                      </ASpace>
                    </ACol>
                  </div>
                </template>
              </AFormItem>
            </ACol>
            <ACol :span="24">
              <AFormItem :label-col="{ span: 4 }" :label="$t('page.manage.menu.button')" name="buttons">
                <AButton v-if="model.buttons.length === 0" type="dashed" block @click="addButton(-1)">
                  <template #icon>
                    <icon-carbon-add class="align-sub text-icon" />
                  </template>
                  <span class="ml-8px">{{ $t('common.add') }}</span>
                </AButton>
                <template v-else>
                  <div v-for="(item, index) in model.buttons" :key="index" class="flex gap-3">
                    <ACol :span="9">
                      <AFormItem
                        :name="['buttons', index, 'code']"
                        :rules="[{ required: true, message: $t('page.manage.menu.form.buttonCode') }]"
                      >
                        <AInput
                          v-model:value="item.code"
                          :maxlength="BUTTON_CODE_MAX"
                          show-count
                          :placeholder="$t('page.manage.menu.form.buttonCode')"
                          class="flex-1"
                        ></AInput>
                      </AFormItem>
                    </ACol>
                    <ACol :span="9">
                      <AFormItem :name="['buttons', index, 'desc']">
                        <AInput
                          v-model:value="item.desc"
                          :maxlength="BUTTON_DESC_MAX"
                          show-count
                          :placeholder="$t('page.manage.menu.form.buttonDesc')"
                          class="flex-1"
                        ></AInput>
                      </AFormItem>
                    </ACol>
                    <ACol :span="5">
                      <ASpace class="ml-12px">
                        <AButton size="middle" @click="addButton(index)">
                          <template #icon>
                            <icon-ic-round-plus class="align-sub text-icon" />
                          </template>
                        </AButton>
                        <AButton size="middle" @click="removeButton(index)">
                          <template #icon>
                            <icon-ic-round-remove class="align-sub text-icon" />
                          </template>
                        </AButton>
                      </ASpace>
                    </ACol>
                  </div>
                </template>
              </AFormItem>
            </ACol>
          </ARow>
        </AForm>
      </SimpleScrollbar>
    </div>
    <template #footer>
      <div class="w-full flex-y-center justify-end gap-12px">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" @click="handleSubmit">{{ $t('common.confirm') }}</AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
