<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { RouteKey } from '@elegant-router/types';
import { fetchGetFavorites, fetchReplaceFavorites } from '@/service/api';
import { useRouteStore } from '@/store/modules/route';
import { useRouterPush } from '@/hooks/common/router';
import { $t } from '@/locales';

defineOptions({
  name: 'QuickNav'
});

interface NavColor {
  start: string;
  end: string;
}

/** 精选入口的固定视觉配置；未注册的菜单由用户从菜单树添加，按 PALETTE 自动取色 */
interface RegistryItem {
  icon: string;
  desc: string;
  color: NavColor;
}

const MAX_ENTRIES = 12;

const PALETTE: NavColor[] = [
  { start: '#2563eb', end: '#4f46e5' },
  { start: '#0891b2', end: '#2563eb' },
  { start: '#7c3aed', end: '#c026d3' },
  { start: '#059669', end: '#10b981' },
  { start: '#d97706', end: '#f59e0b' },
  { start: '#dc2626', end: '#f97316' },
  { start: '#4f46e5', end: '#7c3aed' },
  { start: '#0d9488', end: '#22d3ee' },
  { start: '#db2777', end: '#f472b6' },
  { start: '#65a30d', end: '#84cc16' }
];

/** 默认展示的入口（与既有视觉保持一致，也作为「恢复默认」的目标） */
const DEFAULT_KEYS: RouteKey[] = [
  'org_user',
  'org_department',
  'org_role',
  'manage_menu',
  'manage_dict',
  'audit_log',
  'message_record',
  'job_list'
];

const routeStore = useRouteStore();
const { routerPushByKey } = useRouterPush();

/** 收藏业务类型（后端 /sys/favorite 的 targetType，约定小写字母/数字/中划线） */
const FAVORITE_TYPE = 'quick-nav';

/** 用 $t 计算保证切换语言时精选入口文案跟随更新 */
const registry = computed<Record<string, RegistryItem>>(() => ({
  org_user: {
    icon: 'ant-design:user-outlined',
    desc: $t('page.home.nav.user.desc'),
    color: { start: '#2563eb', end: '#4f46e5' }
  },
  org_department: {
    icon: 'ant-design:apartment-outlined',
    desc: $t('page.home.nav.department.desc'),
    color: { start: '#0891b2', end: '#2563eb' }
  },
  org_role: {
    icon: 'ant-design:safety-certificate-outlined',
    desc: $t('page.home.nav.role.desc'),
    color: { start: '#7c3aed', end: '#c026d3' }
  },
  manage_menu: {
    icon: 'ant-design:menu-outlined',
    desc: $t('page.home.nav.menu.desc'),
    color: { start: '#059669', end: '#10b981' }
  },
  manage_dict: {
    icon: 'ant-design:book-outlined',
    desc: $t('page.home.nav.dict.desc'),
    color: { start: '#d97706', end: '#f59e0b' }
  },
  audit_log: {
    icon: 'ant-design:file-search-outlined',
    desc: $t('page.home.nav.audit.desc'),
    color: { start: '#dc2626', end: '#f97316' }
  },
  message_record: {
    icon: 'ant-design:mail-outlined',
    desc: $t('page.home.nav.message.desc'),
    color: { start: '#4f46e5', end: '#7c3aed' }
  },
  job_list: {
    icon: 'ant-design:schedule-outlined',
    desc: $t('page.home.nav.job.desc'),
    color: { start: '#0d9488', end: '#22d3ee' }
  }
}));

function paletteColor(key: string): NavColor {
  let hash = 0;

  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 997;
  }

  return PALETTE[hash % PALETTE.length];
}

/** 可访问的叶子菜单（即可以跳转的页面），供「添加」弹窗选择 */
const menuFlat = computed(() => {
  const result: Array<{
    routeKey: RouteKey;
    label: string;
    icon?: App.Global.Menu['icon'];
    parentLabel?: string;
  }> = [];

  const walk = (items: App.Global.Menu[], parent?: App.Global.Menu) => {
    items.forEach(item => {
      if (item.children?.length) {
        walk(item.children, item);
      } else if (item.routeKey) {
        result.push({
          routeKey: item.routeKey,
          label: item.label,
          icon: item.icon,
          parentLabel: parent?.label
        });
      }
    });
  };

  walk(routeStore.menus);

  return result;
});

const menuMap = computed(() => new Map(menuFlat.value.map(item => [item.routeKey, item])));

/**
 * 当前用户的自定义入口（后端 /sys/favorite 按登录用户隔离存储，targetId 即路由 key）
 *
 * 无配置或服务不可用时退回默认入口；渲染层还会再过滤掉已无权访问的菜单。
 */
const userKeys = ref<RouteKey[]>([]);
const loaded = ref(false);

async function loadUserKeys() {
  try {
    const { data, error } = await fetchGetFavorites(FAVORITE_TYPE);

    if (!error && data && data.length > 0) {
      userKeys.value = [...new Set(data.map(item => item.targetId))] as RouteKey[];
    } else {
      userKeys.value = [...DEFAULT_KEYS];
    }
  } catch {
    userKeys.value = [...DEFAULT_KEYS];
  } finally {
    loaded.value = true;
  }
}

/** 保存整份配置（replace 语义天然幂等，拖拽/增删/恢复默认共用） */
function persist() {
  fetchReplaceFavorites(FAVORITE_TYPE, [...userKeys.value]);
}

onMounted(() => {
  loadUserKeys();
});

interface NavItem {
  route: RouteKey;
  title: string;
  desc: string;
  icon: string;
  iconRender?: App.Global.Menu['icon'];
  color: NavColor;
}

/**
 * 实际渲染的入口：存的是路由 key，名称/图标渲染时解析
 *
 * 已保存但当前用户无权访问（或已下线）的菜单不渲染 —— 菜单来自后端动态路由，
 * 无权访问的路由根本不存在于 menus 中。
 */
const navItems = computed<NavItem[]>(() =>
  userKeys.value.flatMap(route => {
    const reg = registry.value[route];
    const menu = menuMap.value.get(route);

    if (!reg && !menu) {
      return [];
    }

    const item: NavItem = {
      route,
      title: menu?.label ?? route,
      desc: reg?.desc ?? menu?.parentLabel ?? '',
      icon: reg?.icon ?? '',
      iconRender: reg ? undefined : menu?.icon,
      color: reg?.color ?? paletteColor(route)
    };

    return [item];
  })
);

const editing = ref(false);
const dragIndex = ref(-1);

function go(route: RouteKey) {
  if (editing.value) {
    return;
  }

  routerPushByKey(route);
}

function removeAt(index: number) {
  userKeys.value.splice(index, 1);
  persist();
}

function resetDefault() {
  userKeys.value = [...DEFAULT_KEYS];
  persist();
}

function onDrop(target: number) {
  if (dragIndex.value < 0 || dragIndex.value === target) {
    dragIndex.value = -1;
    return;
  }

  const next = [...userKeys.value];
  const [moved] = next.splice(dragIndex.value, 1);

  next.splice(target, 0, moved);
  userKeys.value = next;
  dragIndex.value = -1;
  persist();
}

const addOpen = ref(false);
const addSearch = ref('');
const checked = ref<RouteKey[]>([]);

const candidates = computed(() => {
  const keyword = addSearch.value.trim().toLowerCase();

  return menuFlat.value.filter(item => {
    if (userKeys.value.includes(item.routeKey)) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return item.label.toLowerCase().includes(keyword) || item.parentLabel?.toLowerCase().includes(keyword);
  });
});

function openAdd() {
  checked.value = [];
  addSearch.value = '';
  addOpen.value = true;
}

function toggleCheck(routeKey: RouteKey) {
  const index = checked.value.indexOf(routeKey);

  if (index >= 0) {
    checked.value.splice(index, 1);
    return;
  }

  if (checked.value.length < MAX_ENTRIES - userKeys.value.length) {
    checked.value.push(routeKey);
  }
}

function confirmAdd() {
  const room = MAX_ENTRIES - userKeys.value.length;

  userKeys.value = [...userKeys.value, ...checked.value.slice(0, Math.max(room, 0))];
  checked.value = [];
  addOpen.value = false;
  persist();
}

function getGradientColor(color: NavColor) {
  return `linear-gradient(135deg, ${color.start}, ${color.end})`;
}
</script>

<template>
  <ACard :bordered="false" class="card-wrapper">
    <template #title>
      <span>{{ $t('page.home.quickNav') }}</span>
      <span v-if="editing" class="ml-8px text-12px text-#999 font-normal dark:text-#94a3b8">
        {{ navItems.length }}/{{ MAX_ENTRIES }}
      </span>
    </template>
    <template #extra>
      <template v-if="!editing">
        <AButton type="link" size="small" @click="editing = true">
          {{ $t('page.home.quickNavManage') }}
        </AButton>
      </template>
      <template v-else>
        <AButton type="link" size="small" @click="resetDefault">
          {{ $t('page.home.quickNavReset') }}
        </AButton>
        <AButton type="link" size="small" @click="editing = false">
          {{ $t('page.home.quickNavDone') }}
        </AButton>
      </template>
    </template>

    <ASpin :spinning="!loaded">
      <div class="grid grid-cols-2 min-h-160px gap-12px xl:grid-cols-4">
        <div
          v-for="(item, index) in navItems"
          :key="item.route"
          class="nav-item relative flex items-center gap-12px border rd-12px border-solid p-14px"
          :class="{ 'nav-item--editing': editing, 'nav-item--dragging': dragIndex === index }"
          :draggable="editing"
          @click="go(item.route)"
          @dragstart="dragIndex = index"
          @dragend="dragIndex = -1"
          @dragover.prevent
          @drop="onDrop(index)"
        >
          <span v-if="editing" class="nav-remove" @click.stop="removeAt(index)">
            <SvgIcon icon="ant-design:close-outlined" class="text-10px" />
          </span>
          <div
            class="size-42px flex-center shrink-0 rd-10px text-20px text-white"
            :style="{ backgroundImage: getGradientColor(item.color) }"
          >
            <component :is="item.iconRender" v-if="item.iconRender" />
            <SvgIcon v-else :icon="item.icon" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-14px font-medium">{{ item.title }}</p>
            <p class="mt-2px truncate text-12px">{{ item.desc }}</p>
          </div>
          <SvgIcon v-if="editing" icon="ant-design:more-outlined" class="nav-drag ml-auto shrink-0 text-16px" />
        </div>

        <div
          v-if="editing && navItems.length < MAX_ENTRIES"
          class="nav-add flex items-center justify-center gap-6px border rd-12px border-dashed p-14px text-13px"
          @click="openAdd"
        >
          <SvgIcon icon="ant-design:plus-outlined" class="text-14px" />
          <span>{{ $t('page.home.quickNavAdd') }}</span>
        </div>
      </div>
    </ASpin>

    <AModal
      v-model:open="addOpen"
      :title="$t('page.home.quickNavAdd')"
      :width="520"
      :ok-button-props="{ disabled: checked.length === 0 }"
      @ok="confirmAdd"
    >
      <AInput v-model:value="addSearch" :placeholder="$t('page.home.quickNavSearch')" allow-clear class="mb-10px" />
      <div class="max-h-360px flex flex-col gap-2px overflow-y-auto">
        <div
          v-for="item in candidates"
          :key="item.routeKey"
          class="candidate flex items-center gap-10px rd-8px px-10px py-8px"
          @click="toggleCheck(item.routeKey)"
        >
          <ACheckbox :checked="checked.includes(item.routeKey)" @click.stop @change="toggleCheck(item.routeKey)" />
          <div
            class="size-28px flex-center shrink-0 rd-6px text-13px text-white"
            :style="{ backgroundImage: getGradientColor(paletteColor(item.routeKey)) }"
          >
            <component :is="item.icon" v-if="item.icon" />
            <SvgIcon v-else icon="ant-design:appstore-outlined" />
          </div>
          <span class="min-w-0 flex-1 truncate text-13px">{{ item.label }}</span>
          <span class="shrink-0 text-12px text-#999 dark:text-#64748b">{{ item.parentLabel }}</span>
        </div>
        <AEmpty v-if="candidates.length === 0" :description="$t('page.home.quickNavAddEmpty')" />
      </div>
    </AModal>
  </ACard>
</template>

<style scoped>
.nav-item {
  cursor: pointer;
  border-color: rgb(0 0 0 / 6%);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.nav-item:hover {
  transform: translateY(-3px);
  border-color: rgb(37 99 235 / 45%);
  box-shadow: 0 10px 24px -12px rgb(15 23 42 / 25%);
}

.nav-item p:last-child {
  color: #999;
}

.dark .nav-item {
  border-color: rgb(255 255 255 / 9%);
}

.dark .nav-item:hover {
  border-color: rgb(96 165 250 / 50%);
}

.dark .nav-item p:last-child {
  color: #94a3b8;
}

.nav-item--editing {
  cursor: grab;
}

.nav-item--editing:hover {
  transform: none;
  box-shadow: none;
}

.nav-item--dragging {
  opacity: 0.55;
}

.nav-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: #fff;
  cursor: pointer;
  background: #ef4444;
  border-radius: 999px;
  box-shadow: 0 2px 6px rgb(239 68 68 / 40%);
}

.nav-remove:hover {
  background: #dc2626;
}

.nav-drag {
  color: #94a3b8;
}

.nav-add {
  color: #64748b;
  cursor: pointer;
  border-color: rgb(100 116 139 / 35%);
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.nav-add:hover {
  color: #2563eb;
  border-color: rgb(37 99 235 / 55%);
  background: rgb(37 99 235 / 5%);
}

.dark .nav-add {
  color: #94a3b8;
}

.dark .nav-add:hover {
  color: #60a5fa;
  border-color: rgb(96 165 250 / 55%);
  background: rgb(96 165 250 / 8%);
}

.candidate {
  cursor: pointer;
  transition: background 0.15s;
}

.candidate:hover {
  background: rgb(0 0 0 / 4%);
}

.dark .candidate:hover {
  background: rgb(255 255 255 / 6%);
}
</style>
