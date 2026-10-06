<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchUpdateUserProfile } from '@/service/api';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { useAuthedImageUrl } from '@/hooks/common/authed-image-url';
import { ensureEnumDict, enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';
import AvatarCropper from './avatar-cropper.vue';

defineOptions({
  name: 'UserProfile'
});

// 性别字典由后端 /org/app/enums 下发（user-center 不在 org 路由下，自己保证加载）
ensureEnumDict('org');

interface Props {
  /** 当前登录用户的完整资料；null 表示尚未加载出来 */
  profile?: Api.Organization.User | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'updated'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, clearValidate } = useAntdForm();
const { patternRules, defaultRequiredRule, createMaxLengthRule } = useFormRules();

/**
 * 列宽取自 `carlos-org/docs/02-design/database/org_postgresql.sql` 的 `org_user`：
 * nickname VARCHAR(20)、phone VARCHAR(11)、email VARCHAR(30)、
 * address VARCHAR(100)、description VARCHAR(200)。
 * 不设上限的话，超长输入会一路走到数据库，用户只拿到一句无信息量的「保存失败」。
 */
const NICKNAME_MAX = 20;
const PHONE_MAX = 11;
const EMAIL_MAX = 30;
const ADDRESS_MAX = 100;
const DESCRIPTION_MAX = 200;

const submitting = ref(false);

/** FileUpload 组件实例（暴露了 uploading 计算属性），提交前用于拦截「头像还在上传」的竞态 */
const avatarUploadRef = ref<{ uploading?: boolean } | null>(null);

/** 裁剪弹窗状态：选图后先在这里裁，确认后才交给 FileUpload 上传 */
const cropOpen = ref(false);
const cropFile = ref<File | null>(null);

/** 等待裁剪结果的 resolve；用户取消（直接关弹窗不点确认）时以 undefined 通知上传组件中止 */
let cropResolve: ((file: File | undefined) => void) | null = null;

// 关闭即清空，确保下次选同一个文件时 file 引用仍然变化，能触发裁剪组件的预览重建；
// 若还在等裁剪结果，说明用户没点确认，resolve(undefined) 让 FileUpload 静默移除该文件
watch(cropOpen, open => {
  if (!open) {
    cropFile.value = null;
    cropResolve?.(undefined);
    cropResolve = null;
  }
});

interface Model {
  account: string;
  nickname: string;
  gender?: Api.Organization.UserGender;
  phone: string;
  email: string;
  address: string;
  description: string;
  avatar: string;
}

function createDefaultModel(): Model {
  return {
    account: '',
    nickname: '',
    gender: '0',
    phone: '',
    email: '',
    address: '',
    description: '',
    avatar: ''
  };
}

const model = ref(createDefaultModel());

/**
 * 头像的展示地址
 *
 * 不能直接把 model.avatar 交给 <AAvatar :src> —— 那是带鉴权的 `/sys/file/load?id=`
 * 地址，img 请求带不上 Authorization 头会 401，antd 会静默换成兜底图标。
 * 详见 use-authed-image-url.ts。
 */
const avatarSrc = useAuthedImageUrl(() => model.value.avatar);

const rules = computed<Record<'nickname' | 'phone' | 'email' | 'address' | 'description', App.Global.FormRule[]>>(
  () => ({
    nickname: [defaultRequiredRule, createMaxLengthRule(NICKNAME_MAX)],
    phone: [patternRules.phone, createMaxLengthRule(PHONE_MAX)],
    email: [patternRules.email, createMaxLengthRule(EMAIL_MAX)],
    address: [createMaxLengthRule(ADDRESS_MAX)],
    description: [createMaxLengthRule(DESCRIPTION_MAX)]
  })
);

/** 用资料回填表单；只挑本页可改的字段，account 仅作只读展示 */
function handleInitModel() {
  const { account, nickname, gender, phone, email, address, description, avatar } = props.profile ?? {};

  model.value = {
    account: account ?? '',
    nickname: nickname ?? '',
    // OrgUserVO 的 gender 是 Integer，JSON 下发的是**数字**（只有 create 入参才用枚举名），
    // 而 ARadio 的 value 取自选项键（字符串）且用 === 严格比较，
    // 此处不做归一会出现「资料里已有性别却一个都不选中」。
    gender: gender === undefined || gender === null ? '0' : (String(gender) as Api.Organization.UserGender),
    phone: phone ?? '',
    email: email ?? '',
    address: address ?? '',
    description: description ?? '',
    avatar: avatar ?? ''
  };
}

watch(() => props.profile, handleInitModel, { immediate: true });

/**
 * 头像上传前置钩子（FileUpload 的 transformFile）：校验通过后弹裁剪框
 *
 * 完整链路：选图 → 校验（FileUpload 做类型/2MB 大小校验）→ 裁剪 → 上传拿地址 →
 * 随「保存」写入用户记录。未点保存就离开页面时，只会在对象存储里多一个未被引用的文件，
 * 不会改动用户资料。
 */
function cropAvatar(file: File): Promise<File | undefined> {
  // accept="image/*" 拦不住「所有文件」选择器与拖拽改名文件，这里按 MIME 再拦一道
  // （原 beforeUpload 的校验；resolve(undefined) 让 FileUpload 静默移除该文件）
  if (!file.type.startsWith('image/')) {
    window.$message?.error?.($t('page.userCenter.avatarTypeError'));
    return Promise.resolve(undefined);
  }

  cropFile.value = file;
  cropOpen.value = true;

  return new Promise(resolve => {
    cropResolve = resolve;
  });
}

/** 裁剪确认：把裁好的文件交回 FileUpload 继续上传（上传/提示都由组件负责） */
function handleCropConfirm(file: File) {
  cropResolve?.(file);
  cropResolve = null;
}

/** 头像仍以访问地址存进用户资料（组件绑定值是文件 id，这里换回 url 写回 model） */
function handleAvatarChange(files: Api.SystemManage.FileInfo[]) {
  model.value = { ...model.value, avatar: files[0]?.url ?? '' };
}

/**
 * 重置为已加载的资料
 *
 * ⚠️ 这里**不能**用 resetFields()：antd 的 FormItem 在 setup 时把 initialValue 抓成快照
 * （node_modules/ant-design-vue/es/form/FormItem.js:166）后永不刷新，而 resetField() 会把该快照
 * 反写回 model（同文件 289/291）。本页表单随页面加载即挂载（此时 profile 尚未到达、model 为空默认值），
 * 快照因此是空值 —— resetFields() 会把整个表单清空，用户随后保存就会把 phone/email/address/avatar
 * 以空串写库（后端 updateById 的 NOT_NULL 策略不拦空串，视为真实修改）。
 * 用 clearValidate() 只清校验红字，值由 handleInitModel() 负责回滚。
 */
function handleReset() {
  handleInitModel();
  clearValidate();
}

async function handleSubmit() {
  await validate();

  if (!props.profile?.id) {
    return;
  }

  // 兜底：头像上传在途时提交会带上旧地址，且保存成功后的 reload 会把刚上传的新地址覆盖掉。
  // 正常情况下按钮已被 :disabled="submitting" 挡住，这里防的是上传恰好完成/失败的竞态。
  if (avatarUploadRef.value?.uploading) {
    window.$message?.warning?.($t('page.userCenter.avatarUploading'));
    return;
  }

  submitting.value = true;
  try {
    const { error } = await fetchUpdateUserProfile({
      id: props.profile.id,
      nickname: model.value.nickname,
      gender: model.value.gender,
      phone: model.value.phone,
      email: model.value.email,
      address: model.value.address,
      description: model.value.description,
      avatar: model.value.avatar
    });

    if (error) {
      // 失败原因由请求层统一弹出（后端 msg），此处不重复提示，与 user-password.vue 保持一致
      return;
    }

    window.$message?.success?.($t('page.userCenter.updateSuccess'));
    emit('updated');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AForm ref="formRef" :model="model" :rules="rules" layout="vertical" class="max-w-640px">
    <AFormItem :label="$t('page.userCenter.avatar')" name="avatar">
      <div class="flex-y-center gap-16px">
        <AAvatar :size="72" :src="avatarSrc">
          <template #icon>
            <SvgIcon icon="ph:user-circle" class="text-icon-large" />
          </template>
        </AAvatar>
        <FileUpload
          ref="avatarUploadRef"
          :value="model.avatar"
          namespace="avatar"
          accept="image/*"
          :max-file-size="2"
          :transform-file="cropAvatar"
          :disabled="submitting"
          @change="handleAvatarChange"
        >
          <AButton :loading="Boolean(avatarUploadRef?.uploading)" :disabled="submitting">
            <template #icon>
              <icon-ic-round-upload class="align-sub text-icon" />
            </template>
            <span class="ml-8px">{{ $t('page.userCenter.changeAvatar') }}</span>
          </AButton>
        </FileUpload>
        <span class="text-12px text-gray-500">{{ $t('page.userCenter.avatarTip') }}</span>
      </div>
    </AFormItem>

    <AvatarCropper v-model:open="cropOpen" :file="cropFile" @confirm="handleCropConfirm" />

    <AFormItem :label="$t('page.userCenter.account')" name="account">
      <AInput v-model:value="model.account" disabled />
      <div class="mt-4px text-12px text-gray-500">{{ $t('page.userCenter.accountTip') }}</div>
    </AFormItem>

    <AFormItem :label="$t('page.userCenter.nickname')" name="nickname">
      <AInput
        v-model:value="model.nickname"
        :maxlength="NICKNAME_MAX"
        show-count
        :placeholder="$t('page.userCenter.form.nickname')"
        allow-clear
      />
    </AFormItem>

    <AFormItem :label="$t('page.userCenter.gender')" name="gender">
      <ARadioGroup v-model:value="model.gender">
        <ARadio v-for="item in enumDictOptions('org', 'OrgUserGender')" :key="item.value" :value="item.value">
          {{ item.label }}
        </ARadio>
      </ARadioGroup>
    </AFormItem>

    <AFormItem :label="$t('page.userCenter.phone')" name="phone">
      <AInput
        v-model:value="model.phone"
        :maxlength="PHONE_MAX"
        show-count
        :placeholder="$t('page.userCenter.form.phone')"
        allow-clear
      />
    </AFormItem>

    <AFormItem :label="$t('page.userCenter.email')" name="email">
      <AInput
        v-model:value="model.email"
        :maxlength="EMAIL_MAX"
        show-count
        :placeholder="$t('page.userCenter.form.email')"
        allow-clear
      />
    </AFormItem>

    <AFormItem :label="$t('page.userCenter.address')" name="address">
      <AInput
        v-model:value="model.address"
        :maxlength="ADDRESS_MAX"
        show-count
        :placeholder="$t('page.userCenter.form.address')"
        allow-clear
      />
    </AFormItem>

    <AFormItem :label="$t('page.userCenter.description')" name="description">
      <ATextarea
        v-model:value="model.description"
        :rows="3"
        :maxlength="DESCRIPTION_MAX"
        show-count
        :placeholder="$t('page.userCenter.form.description')"
      />
    </AFormItem>

    <AFormItem>
      <ASpace :size="16">
        <AButton
          type="primary"
          :loading="submitting"
          :disabled="submitting || Boolean(avatarUploadRef?.uploading)"
          @click="handleSubmit"
        >
          {{ $t('page.userCenter.save') }}
        </AButton>
        <AButton @click="handleReset">{{ $t('common.reset') }}</AButton>
      </ASpace>
    </AFormItem>
  </AForm>
</template>

<style scoped></style>
