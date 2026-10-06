import type { Directive, DirectiveBinding } from 'vue';
import { useAuthStore } from '@/store/modules/auth';

/**
 * v-auth 指令：基于按钮权限编码控制元素显隐
 *
 * 用法：
 *   <AButton v-auth="'user:create'">新增用户</AButton>
 *   <AButton v-auth="['user:create', 'user:update']">编辑</AButton>
 *
 * 无权限时移除元素（display:none），有权限时正常显示
 */
const authDirective: Directive<HTMLElement, string | string[] | undefined> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[] | undefined>) {
    checkAuth(el, binding);
  },
  updated(el: HTMLElement, binding: DirectiveBinding<string | string[] | undefined>) {
    checkAuth(el, binding);
  }
};

function checkAuth(el: HTMLElement, binding: DirectiveBinding<string | string[] | undefined>) {
  const authStore = useAuthStore();
  const required = binding.value;

  // 未传入权限码，默认显示
  if (!required) return;

  // 未登录，隐藏
  if (!authStore.isLogin) {
    el.style.display = 'none';
    return;
  }

  const hasPermission =
    typeof required === 'string'
      ? authStore.userInfo.buttons.includes(required)
      : required.some(code => authStore.userInfo.buttons.includes(code));

  if (!hasPermission) {
    el.style.display = 'none';
  } else {
    el.style.display = '';
  }
}

export default authDirective;
