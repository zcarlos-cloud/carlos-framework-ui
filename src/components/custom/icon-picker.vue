<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { iconifyCommonIcons, iconifyIconGroups } from '@/constants/icon';
import { $t } from '@/locales';
import SvgIcon from './svg-icon.vue';

defineOptions({
  name: 'IconPicker'
});

/**
 * 选中的图标名
 *
 * Iconify 全名，形如 `ant-design:home-outlined`，与 sys_menu.icon 的存储值一致。
 */
const model = defineModel<string>('value', { default: '' });

const open = ref(false);
const keyword = ref('');

/**
 * 全部分组：置顶一个走 i18n 的「常用」，其余用集合名（品牌名，不翻译）
 */
const allGroups = computed(() => [
  { label: $t('page.manage.menu.iconPicker.common'), icons: iconifyCommonIcons },
  ...iconifyIconGroups
]);

/**
 * 过滤后的分组，空分组直接丢掉
 *
 * 只对图标名做子串匹配，因此两种写法都能命中同一个图标：
 * 输入 `home` 找短名，输入 `ant-design:home` 找全名。
 * 匹配在本地数组上做，不发任何网络请求。
 */
const filteredGroups = computed(() => {
  const kw = keyword.value.trim().toLowerCase();

  if (!kw) {
    return allGroups.value;
  }

  return allGroups.value
    .map(group => ({
      label: group.label,
      icons: group.icons.filter(icon => icon.toLowerCase().includes(kw))
    }))
    .filter(group => group.icons.length > 0);
});

// 关闭时清空关键词，下次打开回到完整清单
watch(open, value => {
  if (!value) {
    keyword.value = '';
  }
});

function handleSelect(icon: string) {
  model.value = icon;
  open.value = false;
}
</script>

<template>
  <AInput v-model:value="model" :placeholder="$t('page.manage.menu.form.icon')" class="flex-1">
    <template #suffix>
      <div class="flex-y-center gap-4px">
        <SvgIcon v-if="model" :icon="model" class="text-icon text-gray-400" />
        <APopover v-model:open="open" trigger="click" placement="bottomRight">
          <template #content>
            <div class="w-420px">
              <AInput
                v-model:value="keyword"
                allow-clear
                :placeholder="$t('page.manage.menu.iconPicker.search')"
                class="mb-10px"
              >
                <template #prefix>
                  <icon-ant-design-search-outlined class="text-icon text-gray-400" />
                </template>
              </AInput>

              <div v-if="filteredGroups.length > 0" class="h-300px overflow-y-auto pr-4px">
                <div v-for="group in filteredGroups" :key="group.label" class="mb-10px">
                  <div class="mb-6px text-12px text-gray-400">{{ group.label }}</div>
                  <div class="grid grid-cols-10 gap-4px">
                    <button
                      v-for="icon in group.icons"
                      :key="icon"
                      type="button"
                      :title="icon"
                      class="h-32px flex-center cursor-pointer border-0 rounded-4px bg-transparent text-icon transition-colors hover:bg-primary-50"
                      :class="icon === model ? 'bg-primary-100 text-primary' : ''"
                      @click="handleSelect(icon)"
                    >
                      <SvgIcon :icon="icon" />
                    </button>
                  </div>
                </div>
              </div>

              <AEmpty v-else :description="$t('page.manage.menu.iconPicker.empty')" />
            </div>
          </template>

          <AButton
            type="text"
            size="small"
            class="text-icon text-gray-400"
            :title="$t('page.manage.menu.iconPicker.title')"
            :aria-label="$t('page.manage.menu.iconPicker.title')"
            @click.stop
          >
            <template #icon>
              <icon-ant-design-appstore-outlined />
            </template>
          </AButton>
        </APopover>
      </div>
    </template>
  </AInput>
</template>

<style scoped></style>
