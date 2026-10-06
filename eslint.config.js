import { defineConfig } from '@soybeanjs/eslint-config';
import localRules from './eslint/rules/no-hardcoded-cjk.js';

export default defineConfig(
  { vue: true, unocss: true },
  {
    // 必须限定 files：@soybeanjs/eslint-config 把 @typescript-eslint 插件注册在
    // 它自己的、带 files 作用域的 config 条目里（dist/index.js 中的 plugins:{"@typescript-eslint":t}）。
    // 不带 files 的对象会匹配到 .json/.md 等插件不可见的文件，ESLint 9 直接报
    // "could not find plugin @typescript-eslint"。
    files: ['**/*.{ts,tsx,vue}'],
    rules: {
      'vue/multi-word-component-names': [
        'warn',
        {
          ignores: ['index', 'App', 'Register', '[id]', '[url]']
        }
      ],
      'vue/component-name-in-template-casing': [
        'warn',
        'PascalCase',
        {
          registeredComponentsOnly: false,
          ignores: ['/^icon-/']
        }
      ],
      'unocss/order-attributify': 'off',
      // soybean preset 把这项关掉了，导致 skill 里「禁止 any」形同虚设
      // （file/index.vue 的 ref<any[]>、i18n/index.vue 的 as any 就是这么活下来的）。
      // 待各模块迁移完成、OAuth2 WIP 落地后提为 error
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  {
    // elegant-router 插件自动生成，不参与人工维护
    files: ['src/router/elegant/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    // ① 全量生效：src/views 下所有视图禁止硬编码中文。
    // 迁移期间这条曾是 warn（当待办清单用），现 12 个系统管理模块 + builtin 均已清理完毕。
    files: ['src/views/**/*.vue'],
    plugins: { local: localRules },
    rules: {
      'local/no-hardcoded-cjk': 'error'
    }
  },
  {
    // ② 唯一例外：oauth2-callback 处于未提交的 WIP 中（7 处文案待随 WIP 一起迁移）。
    // 必须声明在 ① 之后：flat config 后声明者覆盖前者。
    // WIP 落地后请删除本段，让全仓库回到一致的 error。
    files: ['src/views/_builtin/oauth2-callback/**/*.vue'],
    rules: {
      'local/no-hardcoded-cjk': 'warn'
    }
  }
);
