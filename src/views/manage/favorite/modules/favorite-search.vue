<script setup lang="ts">
import { $t } from '@/locales';

defineOptions({
  name: 'FavoriteSearch'
});

interface Props {
  typeOptions: { value: string; label: string }[];
}

defineProps<Props>();

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

/** 搜索草稿；点「搜索」才提交到查询条件，「重置」清空（与其他管理页交互一致） */
const model = defineModel<Api.SystemManage.FavoriteSearchParams>('model', { required: true });

function reset() {
  emit('reset');
}

function search() {
  emit('search');
}
</script>

<template>
  <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
    <AForm :model="model" :label-width="80">
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.favorite.targetType')" name="targetType" class="m-0">
            <ASelect
              v-model:value="model.targetType"
              :options="typeOptions"
              :placeholder="$t('page.manage.favorite.typePlaceholder')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.manage.favorite.targetName')" name="keyword" class="m-0">
            <AInput
              v-model:value="model.keyword"
              :placeholder="$t('page.manage.favorite.keywordPlaceholder')"
              allow-clear
              @press-enter="search"
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
