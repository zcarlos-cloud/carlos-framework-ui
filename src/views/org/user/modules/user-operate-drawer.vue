<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import {
  fetchAddUser,
  fetchAssignUserRoles,
  fetchGetAllRoles,
  fetchGetUserRoles,
  fetchUpdateUser
} from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { enumDictCodeString, enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'UserOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: AntDesign.TableOperateType;
  /** the edit row data */
  rowData?: Api.Organization.User | null;
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
const { defaultRequiredRule, patternRules, createPasswordComplexityRule, createMaxLengthRule } = useFormRules();

/**
 * 列宽取自 `carlos-org/docs/02-design/database/org_postgresql.sql`：
 * account / nickname 是 VARCHAR(20)、phone VARCHAR(11)、email VARCHAR(30)。
 * 不设上限的话，超长输入会一路走到数据库，用户只拿到一句无信息量的「新增失败」。
 */
const ACCOUNT_MAX = 20;
const NICKNAME_MAX = 20;
const PHONE_MAX = 11;
const EMAIL_MAX = 30;

const submitLoading = ref(false);

const isEdit = computed(() => props.operateType === 'edit');

const title = computed(() => {
  const titles: Record<AntDesign.TableOperateType, string> = {
    add: $t('page.organization.user.addUser'),
    edit: $t('page.organization.user.editUser')
  };
  return titles[props.operateType];
});

interface Model {
  account: string;
  nickname: string;
  phone: string;
  email: string;
  gender: Api.Organization.UserGender;
  userStatus: Api.Organization.UserStatus;
  /** 仅新增时使用，提交明文由后端编码 */
  pwd: string;
  /** 已选角色 id，保存时整体覆盖 */
  roleIds: string[];
  /** 角色失效时间（ISO 字符串），空串表示长期有效；保存时对本次勾选的角色统一生效 */
  roleExpireTime: string;
}

function createDefaultModel(): Model {
  return {
    account: '',
    nickname: '',
    phone: '',
    email: '',
    gender: '0',
    userStatus: '1',
    pwd: '',
    roleIds: [],
    roleExpireTime: ''
  };
}

const model = ref(createDefaultModel());

/**
 * 规则键必须与模板里 AFormItem 的 `name` 逐字一致
 * （反面教材见 SKILL.md 的 `RuleKey = Extract<...>` 一节：键写错会静默变成 `never`）
 */
type RuleKey = Extract<keyof Model, 'account' | 'nickname' | 'pwd' | 'phone' | 'email'>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  account: [defaultRequiredRule, createMaxLengthRule(ACCOUNT_MAX)],
  nickname: [defaultRequiredRule, createMaxLengthRule(NICKNAME_MAX)],
  // 编辑态不修改密码（改密码走「重置密码」），故只有新增时校验
  pwd: isEdit.value
    ? []
    : [defaultRequiredRule, createPasswordComplexityRule($t('page.organization.user.passwordRule'))],
  // 格式校验只加在**表单**上：搜索栏那四个字段后端是 like 模糊匹配，不能挂整段格式校验
  phone: [patternRules.phone, createMaxLengthRule(PHONE_MAX)],
  email: [patternRules.email, createMaxLengthRule(EMAIL_MAX)]
}));

/** the enabled role options */
const roleOptions = ref<CommonType.Option<string>[]>([]);

async function getRoleOptions() {
  const { error, data } = await fetchGetAllRoles();

  if (error) {
    return;
  }

  roleOptions.value = (data?.records ?? []).map(item => ({
    label: item.roleName,
    value: item.id
  }));
}

/**
 * 角色回填中标志
 *
 * `fetchGetUserRoles` 是异步的，而 `handleInitModel` 是同步的（由 watch 触发）。
 * 不拦住这一段的话：打开编辑抽屉、角色还没回来就点「确认」，
 * 会把**空数组**当作「用户当前没有任何角色」提交给 assignRoles，
 * 于是「先删光再按传入值重建」把该用户的全部角色静默清空。
 */
const rolesLoading = ref(false);

/** 读取用户当前已绑定角色 */
async function setUserRoles(userId: string) {
  rolesLoading.value = true;

  try {
    const { error, data } = await fetchGetUserRoles(userId);

    if (error) {
      return;
    }

    /**
     * 失效时间回填：所有授权共享同一个未过期时间点时才回填；
     * 各角色失效时间不一致或已过期则留空（留空=长期有效），
     * 避免把管理员看不懂的混合状态强行塞进一个选择器。
     */
    const uniformExpire =
      data.length > 0 && data.every(item => item.expireTime && item.expireTime === data[0].expireTime)
        ? data[0].expireTime
        : undefined;
    const roleExpireTime = uniformExpire && dayjs(uniformExpire).isAfter(dayjs()) ? uniformExpire : '';

    model.value = { ...model.value, roleIds: data.map(item => item.roleId), roleExpireTime };
  } finally {
    rolesLoading.value = false;
  }
}

/** 禁用过去的日期：临时授权的失效时间只能是未来（后端同约束 @Future） */
function disabledPastDate(current: Dayjs) {
  return current && current < dayjs().startOf('day');
}

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    const { id, account, nickname, phone, email, gender, userStatus } = props.rowData;

    // 显式挑选字段，避免把 createBy / loginIp 等后端返回的公共字段一并回传。
    // ⚠️ gender / userStatus 后端是 Integer、JSON 下发为**数字**（TS 名义类型是字符串联合），
    //    必须 enumDictCodeString 归一成字符串，否则编辑预填时 Radio 匹配不到、看起来像「未选中」。
    model.value = {
      ...model.value,
      account: account ?? '',
      nickname: nickname ?? '',
      phone: phone ?? '',
      email: email ?? '',
      gender: (enumDictCodeString(gender) ?? '0') as Api.Organization.UserGender,
      userStatus: (enumDictCodeString(userStatus) ?? '1') as Api.Organization.UserStatus
    };

    if (id) {
      setUserRoles(id);
    }
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();
  submitLoading.value = true;

  try {
    if (isEdit.value) {
      const userId = props.rowData?.id ?? '';

      const { error } = await fetchUpdateUser({
        id: userId,
        account: model.value.account,
        nickname: model.value.nickname,
        phone: model.value.phone,
        email: model.value.email,
        gender: model.value.gender,
        userStatus: model.value.userStatus
      });

      if (error) {
        window.$message?.error?.($t('common.updateFailed'));
        return;
      }

      const { error: roleError } = await fetchAssignUserRoles(
        userId,
        model.value.roleIds,
        model.value.roleExpireTime || undefined
      );

      if (roleError) {
        // 两步写入不是原子的：走到这里说明用户信息**已经落库**、只有角色没同步。
        // 若仍报「更新失败」，管理员会以为什么都没改；必须说清哪一半成了。
        window.$message?.error?.($t('page.organization.user.roleAssignFailed'));
        // 列表刷新以反映已生效的那部分；抽屉不关，方便直接重试（重试幂等）
        emit('submitted');
        return;
      }

      window.$message?.success?.($t('common.updateSuccess'));
    } else {
      const { error } = await fetchAddUser({
        account: model.value.account,
        nickname: model.value.nickname,
        phone: model.value.phone,
        email: model.value.email,
        gender: model.value.gender,
        userStatus: model.value.userStatus,
        pwd: model.value.pwd
      });

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
    getRoleOptions();
  }
});
</script>

<template>
  <ADrawer v-model:open="visible" :title="title" :width="360">
    <AForm ref="formRef" layout="vertical" :model="model" :rules="rules">
      <AFormItem :label="$t('page.organization.user.userName')" name="account">
        <!--
          account 是登录键（表上有唯一索引），改名会让该用户失去原有登录名、
          并打断一切按账号引用它的地方，故编辑态锁定。
        -->
        <AInput
          v-model:value="model.account"
          :disabled="isEdit"
          :maxlength="ACCOUNT_MAX"
          show-count
          :placeholder="$t('page.organization.user.form.userName')"
        />
      </AFormItem>
      <AFormItem v-if="!isEdit" :label="$t('page.organization.user.password')" name="pwd">
        <AInputPassword
          v-model:value="model.pwd"
          :placeholder="$t('page.organization.user.form.password')"
          autocomplete="new-password"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.user.nickName')" name="nickname">
        <AInput
          v-model:value="model.nickname"
          :maxlength="NICKNAME_MAX"
          show-count
          :placeholder="$t('page.organization.user.form.nickName')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.user.userGender')" name="gender">
        <ARadioGroup v-model:value="model.gender">
          <ARadio v-for="item in enumDictOptions('org', 'OrgUserGender')" :key="item.value" :value="item.value">
            {{ item.label }}
          </ARadio>
        </ARadioGroup>
      </AFormItem>
      <AFormItem :label="$t('page.organization.user.userPhone')" name="phone">
        <AInput
          v-model:value="model.phone"
          :maxlength="PHONE_MAX"
          show-count
          :placeholder="$t('page.organization.user.form.userPhone')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.organization.user.userEmail')" name="email">
        <AInput
          v-model:value="model.email"
          :maxlength="EMAIL_MAX"
          show-count
          :placeholder="$t('page.organization.user.form.userEmail')"
        />
      </AFormItem>
      <!-- 后端新增接口不含 userStatus，创建后默认置为启用，故仅编辑态展示 -->
      <AFormItem v-if="isEdit" :label="$t('page.organization.user.userStatus')" name="userStatus">
        <ARadioGroup v-model:value="model.userStatus">
          <ARadio v-for="item in enumDictOptions('org', 'OrgUserState')" :key="item.value" :value="item.value">
            {{ item.label }}
          </ARadio>
        </ARadioGroup>
      </AFormItem>
      <!--
        角色仅编辑态可分配：后端 `/org/user/add` 返回 void，拿不到新用户 id，
        因此无法在新增后立刻调 assignRoles。这是接口契约的限制，不是遗漏。
        另需 rolesLoading 拦住回填竞态，否则空数组会被当作「清空角色」提交。
      -->
      <AFormItem v-if="isEdit" :label="$t('page.organization.user.userRole')" name="roleIds">
        <ASelect
          v-model:value="model.roleIds"
          multiple
          :loading="rolesLoading"
          :options="roleOptions"
          :placeholder="$t('page.organization.user.form.userRole')"
        />
      </AFormItem>
      <!--
        临时授权（ADR-002 expireTime）：非空时对本次勾选的角色统一生效，留空=长期有效。
        只在编辑态展示（与 roleIds 同理：新增接口拿不到 id）。
        disabled-date 禁选过去，与后端 @Future 校验一致。
      -->
      <AFormItem v-if="isEdit" :label="$t('page.organization.user.roleExpireTime')" name="roleExpireTime">
        <ADatePicker
          v-model:value="model.roleExpireTime"
          show-time
          value-format="YYYY-MM-DDTHH:mm:ss"
          :disabled-date="disabledPastDate"
          class="w-full"
          :placeholder="$t('page.organization.user.form.roleExpireTime')"
        />
        <div class="mt-4px text-12px text-gray-400">
          {{ $t('page.organization.user.roleExpireHint') }}
        </div>
      </AFormItem>
    </AForm>
    <template #footer>
      <ASpace :size="16">
        <AButton @click="closeDrawer">{{ $t('common.cancel') }}</AButton>
        <AButton type="primary" :loading="submitLoading" :disabled="rolesLoading" @click="handleSubmit">
          {{ $t('common.confirm') }}
        </AButton>
      </ASpace>
    </template>
  </ADrawer>
</template>

<style scoped></style>
