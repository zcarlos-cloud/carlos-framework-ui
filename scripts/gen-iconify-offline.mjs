#!/usr/bin/env node
/**
 * 生成 Iconify 离线图标数据（src/plugins/iconify-icons.ts）
 *
 * 默认情况下 @iconify/vue 在运行时会向公网 api.iconify.design 请求图标数据，
 * 内网/离线环境会导致图标渲染失败。本脚本把项目实际用到的图标数据从本地
 * @iconify/json 依赖中打包进 bundle，运行时零网络请求。
 *
 * 扫描范围：
 * - src/**、packages/**                  前端源码中的静态图标引用
 * - src/constants/icon.ts                图标选择器内置清单（菜单管理员可选项）
 * - 前后端仓库的 .sql 种子脚本            菜单种子数据（sys_menu.icon）
 *
 * 注意：管理员在后台「手输」的清单外图标不会进入本文件，需要重新执行本脚本生成。
 *
 * 用法：pnpm gen:icons
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND_ROOT = path.resolve(UI_ROOT, '../carlos-framework-backend');
const JSON_DIR = path.join(UI_ROOT, 'node_modules/@iconify/json/json');
const OUTPUT = path.join(UI_ROOT, 'src/plugins/iconify-icons.ts');

/** 图标名引用，形如 'mdi:view-grid' */
const ICON_REF = /['"`]([a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*)['"`]/g;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'public']);

/** 递归收集指定根目录下的源码/种子文件 */
function collectFiles(root, exts, result = []) {
  if (!fs.existsSync(root)) return result;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!SKIP_DIRS.has(entry.name)) {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        collectFiles(full, exts, result);
      } else if (exts.some(ext => entry.name.endsWith(ext))) {
        result.push(full);
      }
    }
  }

  return result;
}

function scanIconRefs() {
  const refs = new Set();

  const sourceFiles = [
    ...collectFiles(path.join(UI_ROOT, 'src'), ['.ts', '.tsx', '.vue']),
    ...collectFiles(path.join(UI_ROOT, 'packages'), ['.ts', '.tsx', '.vue']),
    ...collectFiles(path.join(UI_ROOT, 'docs'), ['.sql']),
    ...collectFiles(BACKEND_ROOT, ['.sql'])
  ];

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = ICON_REF.exec(content)) !== null) {
      refs.add(match[1]);
    }
  }

  return refs;
}

/** 加载集合 JSON，并解析 alias（别名可能指向另一个别名） */
function loadCollection(prefix) {
  const file = path.join(JSON_DIR, `${prefix}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolveIcon(collection, name) {
  let current = name;
  for (let guard = 0; guard < 5; guard += 1) {
    const icon = collection.icons[current];
    if (icon) return icon;
    const alias = collection.aliases?.[current];
    if (!alias) return null;
    current = alias.parent;
  }
  return null;
}

function main() {
  const availablePrefixes = new Set(fs.readdirSync(JSON_DIR).map(file => file.replace(/\.json$/, '')));
  const refs = scanIconRefs();

  const unknownPrefixes = [...refs].filter(name => !availablePrefixes.has(name.split(':')[0]));
  if (unknownPrefixes.length > 0) {
    console.warn(`[gen-iconify-offline] 以下引用的集合不存在，已忽略：\n  ${unknownPrefixes.join('\n  ')}`);
  }

  const byPrefix = new Map();
  const bundledIcons = new Map();
  const missing = [];

  for (const ref of refs) {
    const [prefix, name] = ref.split(':');
    if (availablePrefixes.has(prefix)) {
      if (!byPrefix.has(prefix)) byPrefix.set(prefix, loadCollection(prefix));

      const collection = byPrefix.get(prefix);
      const icon = resolveIcon(collection, name);
      if (icon) {
        if (!bundledIcons.has(prefix)) bundledIcons.set(prefix, new Map());
        bundledIcons.get(prefix).set(name, icon);
      } else {
        missing.push(ref);
      }
    }
  }

  if (missing.length > 0) {
    console.warn(`[gen-iconify-offline] 以下图标在 @iconify/json 中不存在，已跳过：\n  ${missing.join('\n  ')}`);
  }

  const bundled = [...byPrefix.entries()]
    .filter(([prefix]) => bundledIcons.has(prefix))
    .map(([prefix, collection]) => ({
      prefix,
      width: collection.width,
      height: collection.height,
      icons: Object.fromEntries(bundledIcons.get(prefix))
    }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));

  const iconCount = bundled.reduce((total, collection) => total + Object.keys(collection.icons).length, 0);

  const lines = [
    '/* eslint-disable */',
    '/**',
    ' * Iconify 离线图标数据（自动生成，请勿手改）',
    ' *',
    ' * 由 scripts/gen-iconify-offline.mjs 根据源码、图标选择器清单及菜单种子 SQL 中的',
    ' * 图标引用生成，图标数据来自本地依赖 @iconify/json，运行时不再请求 api.iconify.design。',
    ' *',
    ' * 新增/变更图标引用后执行：pnpm gen:icons',
    ' */',
    "import {addCollection} from '@iconify/vue';",
    "import type {IconifyJSON} from '@iconify/types';",
    '',
    'const collections: IconifyJSON[] = ['
  ];

  for (const collection of bundled) {
    const icons = Object.fromEntries(
      Object.entries(collection.icons)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, icon]) => [name, icon])
    );

    lines.push('  {');
    lines.push(`    prefix: '${collection.prefix}',`);
    if (collection.width !== undefined) lines.push(`    width: ${collection.width},`);
    if (collection.height !== undefined) lines.push(`    height: ${collection.height},`);
    lines.push(`    icons: ${JSON.stringify(icons)},`);
    lines.push('  },');
  }

  lines.push(
    '];',
    '',
    '/** 注册全部离线图标，使运行时无需访问公网 Iconify API */',
    'export function setupBundledIconifyIcons() {',
    '  for (const collection of collections) {',
    '    addCollection(collection);',
    '  }',
    '}',
    ''
  );

  fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf8');

  const sizeKb = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
  console.log(`[gen-iconify-offline] 已生成 ${OUTPUT}`);
  console.log(`[gen-iconify-offline] 集合 ${bundled.length} 个，图标 ${iconCount} 个，文件大小 ${sizeKb} KB`);
}

main();
