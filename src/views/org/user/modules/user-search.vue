<script setup lang="ts">
import { useAntdForm } from '@/hooks/common/form';
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'UserSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, resetFields } = useAntdForm();

const model = defineModel<Api.Organization.UserSearchParams>('model', { required: true });

/**
 * 这里**有意不加任何 rules**，两个原因：
 *
 * 1. 原先那段「手机号/邮箱格式校验」本来就是死代码 —— 键写成了 `userEmail` / `userPhone`，
 *    而 `UserSearchParams` 里只有 `phone` / `email`，于是
 *    `Extract<keyof ..., 'userEmail' | 'userPhone'>` 解析为 **`never`**、rules 恒为空对象，
 *    模板里 `name="phone"` / `name="email"` 一条规则都匹配不上。
 *    （typecheck 与 ESLint 都不会报错，界面看上去还有校验。）
 *
 * 2. **就算把它接对也是错的**：查证后端 `OrgUserManagerImpl#buildQueryWrapper` 后确认，
 *    用户名/昵称/手机号/邮箱这四个字段都是 **`like` 模糊匹配**，
 *    只输入手机号后四位是完全合法的查询。给模糊字段挂整段格式校验会把「按片段搜索」堵死。
 *    格式约束只应出现在**新增/编辑**表单里。
 */

async function reset() {
  await resetFields();
  emit('reset');
}

function search() {
  emit('search');
}
</script>

<template>
  <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
    <AForm
      ref="formRef"
      :model="model"
      :label-col="{
        span: 5,
        md: 7
      }"
    >
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.organization.user.userName')" name="account" class="m-0">
            <AInput v-model:value="model.account" :placeholder="$t('page.organization.user.form.userName')" />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.organization.user.userGender')" name="gender" class="m-0">
            <ASelect
              v-model:value="model.gender"
              :placeholder="$t('page.organization.user.form.userGender')"
              :options="enumDictOptions('org', 'OrgUserGender')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.organization.user.nickName')" name="nickname" class="m-0">
            <AInput v-model:value="model.nickname" :placeholder="$t('page.organization.user.form.nickName')" />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.organization.user.userPhone')" name="phone" class="m-0">
            <AInput v-model:value="model.phone" :placeholder="$t('page.organization.user.form.userPhone')" />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.organization.user.userEmail')" name="email" class="m-0">
            <AInput v-model:value="model.email" :placeholder="$t('page.organization.user.form.userEmail')" />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.organization.user.userStatus')" name="userStatus" class="m-0">
            <ASelect
              v-model:value="model.userStatus"
              :placeholder="$t('page.organization.user.form.userStatus')"
              :options="enumDictOptions('org', 'OrgUserState')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol flex="1">
          <AFormItem class="m-0">
            <div class="w-full flex-y-center justify-end gap-12px">
              <AButton @click="reset">
                <template #icon>
                  <icon-ic-round-refresh class="align-sub text-icon" />
                </template>
                <span class="ml-8px">{{ $t('common.reset') }}</span>
              </AButton>
              <AButton type="primary" ghost @click="search">
                <template #icon>
                  <icon-ic-round-search class="align-sub text-icon" />
                </template>
                <span class="ml-8px">{{ $t('common.search') }}</span>
              </AButton>
            </div>
          </AFormItem>
        </ACol>
      </ARow>
    </AForm>
  </ACard>
</template>

<style scoped></style>
