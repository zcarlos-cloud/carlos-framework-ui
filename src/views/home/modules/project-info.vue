<script setup lang="ts">
import { $t } from '@/locales';

defineOptions({
  name: 'ProjectInfo'
});

const version = import.meta.env.VITE_APP_VERSION;

const techStack = ['Vue 3.5', 'Vite 7', 'TypeScript 5.9', 'Ant Design Vue 4.2', 'Pinia', 'UnoCSS', 'ECharts 6'];

const links = [
  {
    key: 'docs',
    label: $t('page.home.projectDocs'),
    url: 'http://192.168.3.40:28080/project/carlos-framework-docs',
    icon: 'ant-design:read-outlined',
    tint: 'tint-docs'
  },
  {
    key: 'backend',
    label: $t('page.home.projectBackend'),
    url: 'http://192.168.3.40:28080/project/carlos-framework',
    icon: 'ant-design:code-outlined',
    tint: 'tint-backend'
  },
  {
    key: 'frontend',
    label: $t('page.home.projectFrontend'),
    url: 'http://192.168.3.40:28080/project/carlos-framework-ui',
    icon: 'ant-design:github-outlined',
    tint: 'tint-frontend'
  }
];
</script>

<template>
  <ACard :title="$t('page.home.projectTitle')" :bordered="false" class="h-full card-wrapper">
    <div class="flex-col gap-16px">
      <div class="flex-y-center gap-12px">
        <div class="logo-square size-46px flex-center rd-12px text-24px text-white">
          <SvgIcon icon="ant-design:code-sandbox-outlined" />
        </div>
        <div>
          <p class="text-16px font-semibold">Carlos Framework</p>
          <p class="text-12px text-#999 dark:text-#94a3b8">{{ $t('page.home.projectVersion') }} v{{ version }}</p>
        </div>
      </div>
      <p class="text-13px text-#666 leading-22px dark:text-#aaa">{{ $t('page.home.projectDesc') }}</p>
      <div>
        <p class="mb-8px text-13px font-medium">{{ $t('page.home.projectStack') }}</p>
        <div class="flex flex-wrap gap-6px">
          <span v-for="tech in techStack" :key="tech" class="tech-chip">{{ tech }}</span>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-8px">
        <a
          v-for="link in links"
          :key="link.key"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          class="link-tile"
        >
          <span class="link-icon" :class="link.tint">
            <SvgIcon :icon="link.icon" class="text-16px" />
          </span>
          <span class="truncate text-13px font-medium">{{ link.label }}</span>
        </a>
      </div>
    </div>
  </ACard>
</template>

<style scoped>
.logo-square {
  background-image: linear-gradient(135deg, #2563eb, #7c3aed);
}

.tech-chip {
  padding: 3px 10px;
  font-family: var(--font-family-mono, monospace);
  font-size: 12px;
  color: #475569;
  border: 1px solid rgb(0 0 0 / 8%);
  border-radius: 999px;
  background: rgb(0 0 0 / 3%);
}

.dark .tech-chip {
  color: #94a3b8;
  border-color: rgb(255 255 255 / 12%);
  background: rgb(255 255 255 / 5%);
}

.link-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 8px;
  color: inherit;
  border: 1px solid rgb(0 0 0 / 6%);
  border-radius: 10px;
  background: rgb(0 0 0 / 2%);
  transition:
    background 0.2s,
    border-color 0.2s;
}

.link-tile:hover {
  background: rgb(0 0 0 / 5%);
  border-color: rgb(0 0 0 / 12%);
}

.dark .link-tile {
  border-color: rgb(255 255 255 / 8%);
  background: rgb(255 255 255 / 3%);
}

.dark .link-tile:hover {
  background: rgb(255 255 255 / 7%);
  border-color: rgb(255 255 255 / 16%);
}

.link-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
}

.tint-docs {
  color: #2563eb;
  background: rgb(37 99 235 / 10%);
}

.tint-backend {
  color: #7c3aed;
  background: rgb(124 58 237 / 10%);
}

.tint-frontend {
  color: #ea580c;
  background: rgb(234 88 12 / 10%);
}
</style>
