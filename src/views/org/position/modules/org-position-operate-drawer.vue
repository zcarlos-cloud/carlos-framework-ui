<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchAddPosition, fetchUpdatePosition } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { type TreeNode, listToTree } from '@/utils/tree';
import { enumDictCodeString, enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'OrgPositionOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.Organization.Position | null;
  /** 全量部门树，用于选择所属部门 */
  deptTree?: Api.Organization.DepartmentTree[];
  /** 职系候选项 */
  categoryOptions?: CommonType.Option<string>[];
  /** 职级候选项 */
  levelOptions?: CommonType.Option<string>[];
  /**
   * 岗位**原始列表**（不是 Option 列表）
   *
   * 选上级岗位时要排除「自身及其整个子树」，这需要每行的 `parentId` —— 而
   * `CommonType.Option` 只有 value/label，拿不到父子关系，故这里传原始记录。
   */
  positionList?: Api.Organization.Position[];
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

/**
 * 列宽取自 org_postgresql.sql：position_code / position_name 是 VARCHAR(50)、
 * position_short VARCHAR(20)、level_range VARCHAR(100)、cost_center VARCHAR(50)、
 * location VARCHAR(100)、salary_grade VARCHAR(20)；duty/requirement 等是 TEXT（不限长）。
 */
const POSITION_CODE_MAX = 50;
const POSITION_NAME_MAX = 50;
const POSITION_SHORT_MAX = 20;
const LEVEL_RANGE_MAX = 100;
const COST_CENTER_MAX = 50;
const LOCATION_MAX = 100;
const SALARY_GRADE_MAX = 20;
/** 编制人数上限：库列是 INTEGER、0 表示不限，给个业务上足够大的上界防止误输天文数字 */
const HEADCOUNT_MAX = 9999;

const submitLoading = ref(false);

const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.organization.position.addPosition'),
    edit: $t('page.organization.position.editPosition')
  };

  return titles[props.operateType];
});

interface Model {
  positionCode: string;
  positionName: string;
  positionShort: string;
  categoryId?: string;
  defaultLevelId?: string;
  levelRange: string;
  positionType?: Api.Organization.PositionType;
  positionNature?: Api.Organization.PositionNature;
  departmentId?: string;
  parentId?: string;
  headcount?: number;
  duty: string;
  requirement: string;
  qualification: string;
  kpiIndicator: string;
  costCenter: string;
  location: string;
  salaryGrade: string;
  positionStatus?: Api.Organization.PositionStatus;
}

function createDefaultModel(): Model {
  return {
    positionCode: '',
    positionName: '',
    positionShort: '',
    categoryId: undefined,
    defaultLevelId: undefined,
    levelRange: '',
    positionType: undefined,
    positionNature: undefined,
    departmentId: undefined,
    parentId: undefined,
    headcount: undefined,
    duty: '',
    requirement: '',
    qualification: '',
    kpiIndicator: '',
    costCenter: '',
    location: '',
    salaryGrade: '',
    positionStatus: '1'
  };
}

const model = ref(createDefaultModel());

/**
 * 规则键必须与模板里 AFormItem 的 `name` 逐字一致（见 SKILL 的 RuleKey 陷阱一节）
 *
 * 其中 categoryId / positionType / positionNature 是**后端 `OrgPositionCreateParam`
 * 上带 `@NotNull` 的字段**：前端不标必填的话，用户填完提交只会收到一句笼统的
 * 「参数校验失败」，无从得知少了哪一项。
 */
type RuleKey = Extract<
  keyof Model,
  | 'positionCode'
  | 'positionName'
  | 'positionShort'
  | 'levelRange'
  | 'location'
  | 'costCenter'
  | 'salaryGrade'
  | 'categoryId'
  | 'positionType'
  | 'positionNature'
  | 'headcount'
>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  positionCode: [defaultRequiredRule, createMaxLengthRule(POSITION_CODE_MAX)],
  positionName: [defaultRequiredRule, createMaxLengthRule(POSITION_NAME_MAX)],
  positionShort: [createMaxLengthRule(POSITION_SHORT_MAX)],
  levelRange: [createMaxLengthRule(LEVEL_RANGE_MAX)],
  location: [createMaxLengthRule(LOCATION_MAX)],
  costCenter: [createMaxLengthRule(COST_CENTER_MAX)],
  salaryGrade: [createMaxLengthRule(SALARY_GRADE_MAX)],
  categoryId: [defaultRequiredRule],
  positionType: [defaultRequiredRule],
  positionNature: [defaultRequiredRule],
  headcount: [createNumberRangeRule(0, HEADCOUNT_MAX)]
}));

/** 部门树 → ATreeSelect 选项 */
interface DeptOption {
  value: string;
  title: string;
  children?: DeptOption[];
}

function toDeptOptions(nodes: Api.Organization.DepartmentTree[]): DeptOption[] {
  return nodes.map(node => {
    const children = node.children?.length ? toDeptOptions(node.children) : undefined;

    return { value: node.id, title: node.deptName, children };
  });
}

const deptTreeData = computed<DeptOption[]>(() => toDeptOptions(props.deptTree ?? []));

/** 后端以 parentId = '0' 表示「无上级」（见 org_postgresql.sql：0表示无上级） */
const ROOT_PARENT_ID = '0';

/** 上级岗位不能是自身，**也不能是自己的后代** */
const parentTreeData = computed<DeptOption[]>(() => {
  const list = props.positionList ?? [];
  const excluded = collectSelfAndDescendants(list, props.rowData?.id);
  const kept = list.filter(item => !excluded.has(String(item.id)));

  const toOptions = (nodes: TreeNode<Api.Organization.Position>[]): DeptOption[] =>
    nodes.map(node => ({
      value: node.id,
      title: node.positionName,
      children: node.children?.length ? toOptions(node.children) : undefined
    }));

  const tree = toOptions(
    listToTree(kept, (a, b) => String(a.positionName ?? '').localeCompare(String(b.positionName ?? '')))
  );

  // 注入一个值为 '0' 的「无上级」根节点。
  // 不注入的话，根岗位（parentId='0'）在编辑时会显示成一个孤零零的 0 —— 因为选项里
  // 根本没有 value 为 '0' 的节点。部门抽屉用的是同一套写法（ROOT_PARENT_ID + 顶级部门）。
  return [
    {
      value: ROOT_PARENT_ID,
      title: $t('page.organization.position.topLevel'),
      children: tree.length ? tree : undefined
    }
  ];
});

/**
 * 收集「自身 + 全部后代」的 id
 *
 * 反复扫描直到不再新增。此前这里只过滤了 `value !== rowData.id`，即**只排除自身** ——
 * 于是可以把自己的子岗位（乃至更深的后代）选成上级，形成环，汇报线再也走不出去。
 *
 * 不做邻接表 + DFS 是因为岗位数据量有界（首页 200 条），这样更直白。
 */
function collectSelfAndDescendants(list: Api.Organization.Position[], selfId?: string) {
  const out = new Set<string>();

  if (!selfId) {
    return out;
  }

  out.add(String(selfId));

  let changed = true;
  while (changed) {
    changed = false;

    // 用 for...of 而不是 forEach：闭包在循环里引用外层的 `changed` 会触发 no-loop-func
    for (const item of list) {
      const pid = item.parentId ? String(item.parentId) : '';
      const id = String(item.id);

      if (pid && out.has(pid) && !out.has(id)) {
        out.add(id);
        changed = true;
      }
    }
  }

  return out;
}

function handleInitModel() {
  model.value = createDefaultModel();

  if (isEdit.value && props.rowData) {
    const {
      positionCode,
      positionName,
      positionShort,
      categoryId,
      defaultLevelId,
      levelRange,
      positionType,
      positionNature,
      departmentId,
      parentId,
      headcount,
      duty,
      requirement,
      qualification,
      kpiIndicator,
      costCenter,
      location,
      salaryGrade,
      positionStatus
    } = props.rowData;

    // 显式挑选字段，避免把 currentCount / vacancyCount 等后端计算字段一并回传。
    // 可选字段直接透传 —— `x ?? undefined` 与 `x` 等价，只会平添分支复杂度。
    // ⚠️ 三个枚举码后端是 Integer、JSON 下发为**数字**（TS 名义类型是字符串联合），
    //    必须 enumDictCodeString 归一成字符串，否则编辑预填时 Select 匹配不到、显示原始码值。
    model.value = {
      positionCode: positionCode ?? '',
      positionName: positionName ?? '',
      positionShort: positionShort ?? '',
      categoryId,
      defaultLevelId,
      levelRange: levelRange ?? '',
      positionType: enumDictCodeString(positionType) as Api.Organization.PositionType | undefined,
      positionNature: enumDictCodeString(positionNature) as Api.Organization.PositionNature | undefined,
      departmentId,
      parentId,
      headcount,
      duty: duty ?? '',
      requirement: requirement ?? '',
      qualification: qualification ?? '',
      kpiIndicator: kpiIndicator ?? '',
      costCenter: costCenter ?? '',
      location: location ?? '',
      salaryGrade: salaryGrade ?? '',
      positionStatus: (enumDictCodeString(positionStatus) ?? '1') as Api.Organization.PositionStatus
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
    // 后端 positionType / positionNature / positionStatus 均为 Integer 数字码
    const payload: Api.Organization.PositionOperateParams = {
      positionCode: model.value.positionCode,
      positionName: model.value.positionName,
      positionShort: model.value.positionShort,
      categoryId: model.value.categoryId,
      defaultLevelId: model.value.defaultLevelId,
      levelRange: model.value.levelRange,
      positionType: model.value.positionType,
      positionNature: model.value.positionNature,
      departmentId: model.value.departmentId,
      parentId: model.value.parentId,
      headcount: model.value.headcount,
      duty: model.value.duty,
      requirement: model.value.requirement,
      qualification: model.value.qualification,
      kpiIndicator: model.value.kpiIndicator,
      costCenter: model.value.costCenter,
      location: model.value.location,
      salaryGrade: model.value.salaryGrade,
      positionStatus: model.value.positionStatus
    };

    const { error } = isEdit.value
      ? await fetchUpdatePosition({ ...payload, id: props.rowData?.id ?? '' })
      : await fetchAddPosition(payload);

    if (error) {
      window.$message?.error?.($t(isEdit.value ? 'common.updateFailed' : 'common.addFailed'));
      return;
    }

    window.$message?.success?.($t(isEdit.value ? 'common.updateSuccess' : 'common.addSuccess'));
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
</script>

<template>
  <ADrawer v-model:open="visible" :title="title" :width="480">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <ARow :gutter="16">
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.positionCode')" name="positionCode">
            <!-- positionCode 是岗位业务键（租户内唯一），编辑态放开可改会打断所有按码引用它的地方 -->
            <AInput
              v-model:value="model.positionCode"
              :disabled="isEdit"
              :maxlength="POSITION_CODE_MAX"
              show-count
              :placeholder="$t('page.organization.position.form.positionCode')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.positionName')" name="positionName">
            <AInput
              v-model:value="model.positionName"
              :maxlength="POSITION_NAME_MAX"
              show-count
              :placeholder="$t('page.organization.position.form.positionName')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.positionShort')" name="positionShort">
            <AInput
              v-model:value="model.positionShort"
              :maxlength="POSITION_SHORT_MAX"
              show-count
              :placeholder="$t('page.organization.position.form.positionShort')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.headcount')" name="headcount">
            <AInputNumber
              v-model:value="model.headcount"
              class="w-full"
              :min="0"
              :max="HEADCOUNT_MAX"
              :placeholder="$t('page.organization.position.form.headcount')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.departmentId')" name="departmentId">
            <ATreeSelect
              v-model:value="model.departmentId"
              :tree-data="deptTreeData"
              tree-default-expand-all
              allow-clear
              :placeholder="$t('page.organization.position.form.departmentId')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.parentId')" name="parentId">
            <!-- 用树形选择：岗位本身有汇报层级；选项已剔除自身及其整个子树，不会形成环 -->
            <ATreeSelect
              v-model:value="model.parentId"
              :tree-data="parentTreeData"
              show-search
              tree-node-filter-prop="title"
              tree-default-expand-all
              allow-clear
              :placeholder="$t('page.organization.position.form.parentId')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.categoryId')" name="categoryId">
            <ASelect
              v-model:value="model.categoryId"
              :options="categoryOptions"
              show-search
              option-filter-prop="label"
              allow-clear
              :placeholder="$t('page.organization.position.form.categoryId')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.defaultLevelId')" name="defaultLevelId">
            <ASelect
              v-model:value="model.defaultLevelId"
              :options="levelOptions"
              show-search
              option-filter-prop="label"
              allow-clear
              :placeholder="$t('page.organization.position.form.defaultLevelId')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.positionType')" name="positionType">
            <!-- 选项由后端枚举字典驱动（父页 ensureEnumDict('org')），本组件不请求数据 -->
            <ASelect
              v-model:value="model.positionType"
              :options="enumDictOptions('org', 'OrgPositionType')"
              allow-clear
              :placeholder="$t('page.organization.position.form.positionType')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.positionNature')" name="positionNature">
            <ASelect
              v-model:value="model.positionNature"
              :options="enumDictOptions('org', 'OrgPositionNature')"
              allow-clear
              :placeholder="$t('page.organization.position.form.positionNature')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.positionStatus')" name="positionStatus">
            <ASelect
              v-model:value="model.positionStatus"
              :options="enumDictOptions('org', 'OrgPositionStatus')"
              allow-clear
              :placeholder="$t('page.organization.position.form.positionStatus')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.salaryGrade')" name="salaryGrade">
            <AInput
              v-model:value="model.salaryGrade"
              :maxlength="SALARY_GRADE_MAX"
              show-count
              :placeholder="$t('page.organization.position.form.salaryGrade')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.levelRange')" name="levelRange">
            <AInput
              v-model:value="model.levelRange"
              :maxlength="LEVEL_RANGE_MAX"
              show-count
              :placeholder="$t('page.organization.position.form.levelRange')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.location')" name="location">
            <AInput
              v-model:value="model.location"
              :maxlength="LOCATION_MAX"
              show-count
              :placeholder="$t('page.organization.position.form.location')"
            />
          </AFormItem>
        </ACol>
        <ACol :span="12">
          <AFormItem :label="$t('page.organization.position.costCenter')" name="costCenter">
            <AInput
              v-model:value="model.costCenter"
              :maxlength="COST_CENTER_MAX"
              show-count
              :placeholder="$t('page.organization.position.form.costCenter')"
            />
          </AFormItem>
        </ACol>
      </ARow>
      <AFormItem :label="$t('page.organization.position.duty')" name="duty">
        <ATextarea v-model:value="model.duty" :rows="2" :placeholder="$t('page.organization.position.form.duty')" />
      </AFormItem>
      <AFormItem :label="$t('page.organization.position.requirement')" name="requirement">
        <ATextarea
          v-model:value="model.requirement"
          :rows="2"
          :placeholder="$t('page.organization.position.form.requirement')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.position.qualification')" name="qualification">
        <ATextarea
          v-model:value="model.qualification"
          :rows="2"
          :placeholder="$t('page.organization.position.form.qualification')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.position.kpiIndicator')" name="kpiIndicator">
        <ATextarea
          v-model:value="model.kpiIndicator"
          :rows="2"
          :placeholder="$t('page.organization.position.form.kpiIndicator')"
        />
      </AFormItem>
    </AForm>
    <template #footer>
      <ASpace :size="16">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" @click="handleSubmit">{{ $t('common.confirm') }}</AButton>
      </ASpace>
    </template>
  </ADrawer>
</template>

<style scoped></style>
