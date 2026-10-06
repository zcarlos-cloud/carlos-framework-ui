<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import {
  fetchGetUserDepartments,
  fetchGetUserDetail,
  fetchGetUserPositionHistory,
  fetchGetUserPositions,
  fetchGetUserRoles
} from '@/service/api';
import { EMPTY_TEXT, formatDateTime } from '@/utils/common';
import { ensureEnumDict, enumDictColor, enumDictText } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'UserDetailDrawer'
});

// 性别/状态改由后端枚举字典驱动；抽屉可独立打开，自己保证加载（重复调用无副作用）
ensureEnumDict('org');

interface Props {
  /** 待查看的用户主键 */
  userId: string;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const loading = ref(false);

const detail = ref<Api.Organization.User | null>(null);
const roles = ref<Api.Organization.UserRole[]>([]);
const departments = ref<Api.Organization.UserDept[]>([]);
const positions = ref<Api.Organization.UserPosition[]>([]);
const histories = ref<Api.Organization.PositionHistory[]>([]);

/** 主部门：后端标了 isMain 就用它，没有则退回第一个，避免整行空白 */
const mainDeptName = computed(() => {
  const list = departments.value;
  const mainDept = list.find(item => item.isMain) ?? list[0];

  return mainDept?.departmentName || EMPTY_TEXT;
});

/** 岗位展示成「岗位名（部门名）」，缺部门名时只显示岗位名 */
const positionLabels = computed(() =>
  positions.value.map(item =>
    item.departmentName ? `${item.positionName}（${item.departmentName}）` : item.positionName
  )
);

/** 角色被删除后 roleName / roleCode 都会是 null，退回 roleId 至少能让人认出是哪一条 */
function roleLabel(role: Api.Organization.UserRole) {
  return role.roleName || role.roleCode || role.roleId;
}

/** 临期阈值：距失效 7 天内视为即将过期 */
const EXPIRING_SOON_DAYS = 7;

type RoleExpireStatus = 'permanent' | 'active' | 'expiring' | 'expired';

/**
 * 授权时效状态
 *
 * 后端管理面（listAllByUserId）会连过期授权一起返回，
 * 这里必须把「过期 / 临期 / 有效 / 长期」区分开，否则管理员会误以为过期授权仍生效。
 */
function expireStatus(expireTime?: string): RoleExpireStatus {
  if (!expireTime) {
    return 'permanent';
  }
  // 后端下发 ISO-8601(如 2026-09-17T10:00:00),用 dayjs 解析避免 Safari 对裸 new Date 的兼容问题
  const parsed = dayjs(expireTime);
  // 不可解析的脏数据按「有效」展示（不至于把真实授权误标成过期），但悬浮提示会露出原始值
  if (!parsed.isValid()) {
    return 'active';
  }
  const remain = parsed.valueOf() - Date.now();
  if (remain <= 0) {
    return 'expired';
  }
  return remain <= EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000 ? 'expiring' : 'active';
}

const EXPIRE_TAG_COLOR: Record<RoleExpireStatus, string> = {
  permanent: 'processing',
  active: 'processing',
  expiring: 'warning',
  expired: 'default'
};

/** 悬浮提示：失效时间 + 时效状态；长期有效也明确告知，避免误以为漏字段 */
function roleExpireTip(role: Api.Organization.UserRole) {
  const status = expireStatus(role.expireTime);
  if (status === 'permanent') {
    return $t('page.organization.user.rolePermanent');
  }
  const time = `${$t('page.organization.user.expireTime')}: ${formatDateTime(role.expireTime)}`;
  if (status === 'expired') {
    return `${time}（${$t('page.organization.user.roleExpired')}）`;
  }
  if (status === 'expiring' && role.expireTime) {
    const days = Math.ceil((dayjs(role.expireTime).valueOf() - Date.now()) / (24 * 60 * 60 * 1000));
    return `${time}（${$t('page.organization.user.roleExpiringSoon', { days })}）`;
  }
  return time;
}

function formatOrEmpty(value?: string | null) {
  return formatDateTime(value) || EMPTY_TEXT;
}

/**
 * 仅展示日期部分：后端 changeDate 是 LocalDate（如 2026-09-17），
 * 若走 formatDateTime 会补出假的 00:00:00，让人误以为有精确时间。
 */
function formatDateOnly(value?: string | null) {
  if (!value) {
    return EMPTY_TEXT;
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : value;
}

/**
 * 五个接口并发拉取
 *
 * 用户资料、角色、部门、岗位、任职历史互不依赖（后端都只按 userId 查），
 * 串行会让抽屉多等四个来回。
 */
async function loadAll() {
  const { userId } = props;

  if (!userId) {
    return;
  }

  loading.value = true;
  try {
    const [detailRes, roleRes, deptRes, positionRes, historyRes] = await Promise.all([
      fetchGetUserDetail(userId),
      fetchGetUserRoles(userId),
      fetchGetUserDepartments(userId),
      fetchGetUserPositions(userId),
      fetchGetUserPositionHistory(userId)
    ]);

    detail.value = detailRes.error ? null : (detailRes.data ?? null);
    roles.value = roleRes.error ? [] : (roleRes.data ?? []);
    departments.value = deptRes.error ? [] : (deptRes.data ?? []);
    positions.value = positionRes.error ? [] : (positionRes.data ?? []);
    histories.value = historyRes.error ? [] : (historyRes.data?.records ?? []);
  } finally {
    loading.value = false;
  }
}

watch(visible, () => {
  if (visible.value) {
    detail.value = null;
    roles.value = [];
    departments.value = [];
    positions.value = [];
    histories.value = [];
    loadAll();
  }
});
</script>

<template>
  <!-- 14 行单列 Descriptions 含多组 Tag，360 的默认宽度装不下，放宽到 640 -->
  <ADrawer v-model:open="visible" :title="$t('page.organization.user.detailTitle')" :width="640">
    <ASpin :spinning="loading">
      <ADescriptions v-if="detail" :column="1" size="small" bordered>
        <ADescriptionsItem :label="$t('page.organization.user.userName')">
          {{ detail.account || EMPTY_TEXT }}
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.organization.user.nickName')">
          {{ detail.nickname || EMPTY_TEXT }}
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.organization.user.userPhone')">
          {{ detail.phone || EMPTY_TEXT }}
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.organization.user.userEmail')">
          {{ detail.email || EMPTY_TEXT }}
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.organization.user.userGender')">
          {{ enumDictText('org', 'OrgUserGender', detail.gender) }}
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.organization.user.userStatus')">
          <!-- enumDictColor / enumDictText 自带「缺失与未收录」的兜底，无需再手写空值守卫 -->
          <Tag :color="enumDictColor('org', 'OrgUserState', detail.userStatus)">
            {{ enumDictText('org', 'OrgUserState', detail.userStatus) }}
          </Tag>
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.organization.user.userRole')">
          <template v-if="roles.length">
            <!-- 过期授权灰显并标注，临期（7 天内）橙色预警；悬浮可见失效时间 -->
            <ATooltip v-for="role in roles" :key="role.roleId" :title="roleExpireTip(role)">
              <Tag :color="EXPIRE_TAG_COLOR[expireStatus(role.expireTime)]">
                {{ roleLabel(role) }}
                <template v-if="expireStatus(role.expireTime) === 'expired'">
                  （{{ $t('page.organization.user.roleExpired') }}）
                </template>
              </Tag>
            </ATooltip>
          </template>
          <template v-else>{{ EMPTY_TEXT }}</template>
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.organization.user.mainDept')">
          {{ mainDeptName }}
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.organization.user.userDept')">
          <template v-if="departments.length">
            <!-- 主部门用不同颜色标出，与上方「主部门」一行相互印证 -->
            <Tag v-for="dept in departments" :key="dept.departmentId" :color="dept.isMain ? 'processing' : undefined">
              {{ dept.departmentName }}
            </Tag>
          </template>
          <template v-else>{{ EMPTY_TEXT }}</template>
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.organization.user.position')">
          <template v-if="positionLabels.length">
            <Tag v-for="label in positionLabels" :key="label">{{ label }}</Tag>
          </template>
          <template v-else>{{ EMPTY_TEXT }}</template>
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.organization.user.createTime')">
          {{ formatOrEmpty(detail.createTime) }}
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.userCenter.lastLoginTime')">
          {{ formatOrEmpty(detail.loginTime) }}
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.userCenter.lastLoginIp')">
          {{ detail.loginIp || EMPTY_TEXT }}
        </ADescriptionsItem>

        <ADescriptionsItem :label="$t('page.userCenter.loginCount')">
          {{ detail.loginCount ?? EMPTY_TEXT }}
        </ADescriptionsItem>
      </ADescriptions>

      <!-- 任职历史：old/new 岗位在 VO 里只有 ID，不展示原始 ID，只呈现 类型/原因/日期/操作人 -->
      <template v-if="detail">
        <ADivider class="!my-4">
          {{ $t('page.organization.user.historyTitle') }}
        </ADivider>
        <ATimeline v-if="histories.length">
          <ATimelineItem v-for="item in histories" :key="item.id">
            <div class="flex flex-wrap items-center gap-2">
              <Tag :color="enumDictColor('org', 'OrgPositionChangeType', item.changeType)">
                {{ enumDictText('org', 'OrgPositionChangeType', item.changeType) }}
              </Tag>
              <span>{{ item.changeReason || EMPTY_TEXT }}</span>
            </div>
            <div class="mt-1 text-xs text-gray-400">
              {{ formatDateOnly(item.changeDate) }} · {{ $t('page.organization.user.operator') }}:
              {{ item.operatorName || EMPTY_TEXT }}
            </div>
          </ATimelineItem>
        </ATimeline>
        <div v-else class="text-gray-400">{{ $t('page.organization.user.historyEmpty') }}</div>
      </template>
    </ASpin>
  </ADrawer>
</template>

<style scoped></style>
