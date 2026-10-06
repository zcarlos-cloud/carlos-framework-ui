<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddRegion, fetchGetRegionTreeList, fetchUpdateRegion } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { EMPTY_TEXT } from '@/utils/common';
import { enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'RegionOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.SystemManage.Region | null;
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
const { defaultRequiredRule, createMaxLengthRule, createNumberRangeRule } = useFormRules();

/** 列宽取自 system_postgresql.sql：region_code / parent_code / region_leader 都是 VARCHAR(50)，
 *  region_name 是 VARCHAR(100)，remark 是 VARCHAR(500) */
const REGION_CODE_MAX = 50;
const REGION_NAME_MAX = 100;
const REGION_LEADER_MAX = 50;
const REMARK_MAX = 500;

/**
 * 顶级区域的上级编码哨兵
 *
 * 与后端 `RegionConstant.TOP_REGION_PARENT_CODE` 及 `CoreConstant.PARENT_LONG_0` 一致：
 * 后端服务层会把空值归一化成 "0"，区域树也按 `parentCode == "0"` 取根。
 */
const ROOT_PARENT_CODE = '0';

const submitLoading = ref(false);
const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.manage.region.addRegion'),
    edit: $t('page.manage.region.editRegion')
  };
  return titles[props.operateType];
});

/**
 * 表单模型
 *
 * `regionPeopleNumber` 在接口上是 Long（下行为字符串），但表单里用数字控件编辑，
 * 故此处收窄成 number，提交时再转回字符串。
 */
type Model = Pick<
  Api.SystemManage.Region,
  | 'regionCode'
  | 'regionName'
  | 'parentCode'
  | 'regionLevel'
  | 'regionLeader'
  | 'regionArea'
  | 'orderNum'
  | 'longitude'
  | 'latitude'
  | 'remark'
> & {
  regionPeopleNumber?: number;
};

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    regionCode: '',
    regionName: '',
    parentCode: ROOT_PARENT_CODE,
    regionLevel: 1,
    regionLeader: '',
    regionArea: undefined,
    regionPeopleNumber: undefined,
    orderNum: 0,
    longitude: undefined,
    latitude: undefined,
    remark: ''
  };
}

type RuleKey = Extract<keyof Model, 'regionCode' | 'regionName' | 'longitude' | 'latitude'>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  regionCode: [defaultRequiredRule, createMaxLengthRule(REGION_CODE_MAX)],
  regionName: [defaultRequiredRule, createMaxLengthRule(REGION_NAME_MAX)],
  // 经纬度是 NUMERIC(20,10)，DDL 拦不住越界值，只能在这里挡
  longitude: [createNumberRangeRule(-180, 180)],
  latitude: [createNumberRangeRule(-90, 90)]
}));

/** 全量区域树：既是「上级区域」下拉的数据源，也用来推导层级与类型 */
const regionTree = ref<Api.SystemManage.Region[]>([]);

async function loadRegionTree() {
  const { data, error } = await fetchGetRegionTreeList({ codeTop: true });

  if (!error && data) {
    regionTree.value = data;
  }
}

function findRegionByCode(nodes: Api.SystemManage.Region[], code: string): Api.SystemManage.Region | undefined {
  for (const node of nodes) {
    if (node.regionCode === code) {
      return node;
    }

    const hit = node.children ? findRegionByCode(node.children, code) : undefined;

    if (hit) {
      return hit;
    }
  }

  return undefined;
}

interface ParentOption {
  value: string;
  title: string;
  children?: ParentOption[];
}

/**
 * 上级区域选项
 *
 * 编辑时必须排除**自身及其整棵子树**，否则可以把区域挂到自己的下级下形成环 ——
 * 环上的节点上溯不到根，在区域树里会整棵消失（后端 update 也有成环校验兜底）。
 * 过滤掉自身节点即等于剪掉其子树（子节点只出现在该分支里），
 * 与 `org-department-operate-drawer.vue` 的解法一致。
 *
 * 根节点固定为哨兵 "0"，代表「顶级区域」。
 */
const parentTreeData = computed<ParentOption[]>(() => {
  const excludedCode = isEdit.value ? props.rowData?.regionCode : undefined;

  function toOptions(nodes: Api.SystemManage.Region[]): ParentOption[] {
    return nodes
      .filter(node => node.regionCode !== excludedCode)
      .map(node => {
        const children = node.children?.length ? toOptions(node.children) : undefined;

        return { value: node.regionCode, title: node.regionName, children };
      });
  }

  return [
    {
      value: ROOT_PARENT_CODE,
      title: $t('page.manage.region.topLevel'),
      children: toOptions(regionTree.value)
    }
  ];
});

/**
 * 区域类型预览（只读）
 *
 * 后端 `SysRegionService#setRegionType` 在新增与修改时都会**无条件覆盖** regionType：
 * 顶级 → "5"，否则 → 上级 type - 1。也就是说这个字段填了也不生效 ——
 * 所以表单里不放可编辑控件，而是按当前选中的上级把它**将被写入的值**算出来给用户看。
 */
const derivedRegionType = computed(() => {
  const { parentCode } = model.value;

  if (!parentCode || parentCode === ROOT_PARENT_CODE) {
    return '5';
  }

  const parent = findRegionByCode(regionTree.value, parentCode);

  if (!parent?.regionType) {
    return undefined;
  }

  return String(Number(parent.regionType) - 1);
});

const derivedRegionTypeText = computed(() =>
  derivedRegionType.value ? enumDictText('sys', 'SysRegionType', derivedRegionType.value) : EMPTY_TEXT
);

/** 选了上级就顺手把层级补上（上级层级 + 1，顶级为 1），仍可手动改 */
function handleParentChange() {
  const { parentCode } = model.value;

  if (!parentCode || parentCode === ROOT_PARENT_CODE) {
    model.value.regionLevel = 1;

    return;
  }

  const parent = findRegionByCode(regionTree.value, parentCode);

  if (parent?.regionLevel) {
    model.value.regionLevel = parent.regionLevel + 1;
  }
}

/** Long 字段下行是字符串，回填数值控件前转回 number */
function toNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isNaN(parsed) ? undefined : parsed;
}

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const {
      regionCode,
      regionName,
      parentCode,
      regionLevel,
      regionLeader,
      regionArea,
      regionPeopleNumber,
      orderNum,
      longitude,
      latitude,
      remark
    } = props.rowData;

    // 显式挑选字段，避免把 id / parents / gisOid / 边界值等字段一并回传
    model.value = {
      regionCode: regionCode ?? '',
      regionName: regionName ?? '',
      // 顶级区域库里存的就是哨兵 "0"，直接回填即可让下拉选中「顶级区域」
      parentCode: parentCode ?? ROOT_PARENT_CODE,
      regionLevel: regionLevel ?? 1,
      regionLeader: regionLeader ?? '',
      regionArea: regionArea ?? undefined,
      regionPeopleNumber: toNumber(regionPeopleNumber),
      orderNum: orderNum ?? 0,
      longitude: longitude ?? undefined,
      latitude: latitude ?? undefined,
      remark: remark ?? ''
    };
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    const { regionPeopleNumber, ...rest } = model.value;

    // regionType 不提交：后端每次都会按上级重算，传了也是被覆盖
    const payload: Api.SystemManage.RegionOperateParams = {
      ...rest,
      regionPeopleNumber: regionPeopleNumber === undefined ? undefined : String(regionPeopleNumber)
    };

    const { error } = isEdit.value
      ? await fetchUpdateRegion({ id: props.rowData?.id ?? '', ...payload })
      : await fetchAddRegion(payload);

    if (error) {
      window.$message?.error?.(isEdit.value ? $t('common.updateFailed') : $t('common.addFailed'));
      return;
    }

    window.$message?.success?.(isEdit.value ? $t('common.updateSuccess') : $t('common.addSuccess'));
    closeDrawer();
    emit('submitted');
  } finally {
    submitLoading.value = false;
  }
}

watch(visible, () => {
  if (visible.value) {
    handleInitModel();
    loadRegionTree();
    resetFields();
  }
});
</script>

<template>
  <ADrawer v-model:open="visible" :title="title" :width="400">
    <AForm ref="formRef" :model="model" :rules="rules" layout="vertical">
      <AFormItem :label="$t('page.manage.region.parentCode')" name="parentCode">
        <!--
          上级绑定的是区域**编码**（parentCode），不是 id，故 value 取 regionCode。
          留空即为顶级区域：服务端把空值归一化成哨兵 "0"。
        -->
        <ATreeSelect
          v-model:value="model.parentCode"
          :tree-data="parentTreeData"
          :field-names="{ children: 'children', label: 'title', value: 'value' }"
          :placeholder="$t('page.manage.region.form.parentCode')"
          tree-default-expand-all
          show-search
          tree-node-filter-prop="title"
          @change="handleParentChange"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.region.regionCode')" name="regionCode">
        <!-- regionCode 是区域业务键（parentCode 存的就是它），编辑态放开会打断所有按码引用处，故锁定 -->
        <AInput
          v-model:value="model.regionCode"
          :disabled="isEdit"
          :maxlength="REGION_CODE_MAX"
          show-count
          :placeholder="$t('page.manage.region.form.regionCode')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.region.regionName')" name="regionName">
        <AInput
          v-model:value="model.regionName"
          :maxlength="REGION_NAME_MAX"
          show-count
          :placeholder="$t('page.manage.region.form.regionName')"
        />
      </AFormItem>

      <!-- 只读派生：后端保存时会按上级重算，这里显示的是「将被写入的值」 -->
      <AFormItem :label="$t('page.manage.region.regionType')" :extra="$t('page.manage.region.regionTypeDerived')">
        <AInput :value="derivedRegionTypeText" disabled />
      </AFormItem>

      <AFormItem :label="$t('page.manage.region.regionLevel')" name="regionLevel">
        <AInputNumber
          v-model:value="model.regionLevel"
          class="w-full"
          :min="1"
          :max="5"
          :placeholder="$t('page.manage.region.form.regionLevel')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.region.regionLeader')" name="regionLeader">
        <AInput
          v-model:value="model.regionLeader"
          :maxlength="REGION_LEADER_MAX"
          show-count
          :placeholder="$t('page.manage.region.form.regionLeader')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.region.regionArea')" name="regionArea">
        <!-- region_area 是 NUMERIC(20,6)，按面积语义只留 2 位小数 -->
        <AInputNumber
          v-model:value="model.regionArea"
          class="w-full"
          :min="0"
          :precision="6"
          :placeholder="$t('page.manage.region.form.regionArea')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.region.regionPeopleNumber')" name="regionPeopleNumber">
        <AInputNumber
          v-model:value="model.regionPeopleNumber"
          class="w-full"
          :min="0"
          :precision="0"
          :placeholder="$t('page.manage.region.form.regionPeopleNumber')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.region.longitude')" name="longitude">
        <AInputNumber
          v-model:value="model.longitude"
          class="w-full"
          :min="-180"
          :max="180"
          :precision="10"
          :placeholder="$t('page.manage.region.form.longitude')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.region.latitude')" name="latitude">
        <AInputNumber
          v-model:value="model.latitude"
          class="w-full"
          :min="-90"
          :max="90"
          :precision="10"
          :placeholder="$t('page.manage.region.form.latitude')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.region.orderNum')" name="orderNum">
        <AInputNumber
          v-model:value="model.orderNum"
          class="w-full"
          :min="0"
          :precision="0"
          :placeholder="$t('page.manage.region.form.orderNum')"
        />
      </AFormItem>

      <AFormItem :label="$t('page.manage.region.remark')" name="remark">
        <ATextarea
          v-model:value="model.remark"
          :rows="3"
          :maxlength="REMARK_MAX"
          show-count
          :placeholder="$t('page.manage.region.form.remark')"
        />
      </AFormItem>
    </AForm>

    <template #footer>
      <div class="flex-y-center justify-end gap-12px">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" @click="handleSubmit">{{ $t('common.confirm') }}</AButton>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped></style>
