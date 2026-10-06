/**
 * 本地 ESLint 规则：禁止在视图组件里硬编码中文文案。
 *
 * 为什么必须自己写而不能用 no-restricted-syntax 的 selector：
 * vue-eslint-parser 的 parseForESLint() 只返回 { ast, services }，不返回 visitorKeys，
 * ESLint 的遍历因此不会进入 Program.templateBody。实测 'VText' / 'VLiteral' selector
 * 命中 0 次。模板遍历只能通过 parserServices.defineTemplateBodyVisitor 取得。
 */

/** 只匹配表意文字（中日韩汉字），不含全角标点与 · … 等符号，避免误报 */
const CJK_RE = /[㐀-䶿一-鿿豈-﫿]/;

/** 跳过 $t('...') / t('...') / i18n.t('...') 的第一个字符串参数 */
function isTranslationKey(node) {
  const parent = node.parent;

  if (!parent || parent.type !== 'CallExpression' || parent.arguments[0] !== node) {
    return false;
  }

  const { callee } = parent;

  if (!callee) {
    return false;
  }

  if (callee.type === 'Identifier') {
    return callee.name === '$t' || callee.name === 't';
  }

  if (callee.type === 'MemberExpression' && !callee.computed && callee.property) {
    return callee.property.type === 'Identifier' && callee.property.name === 't';
  }

  return false;
}

/** 跳过正则字面量（/中文/）与模块说明符 */
function isSkippedLiteral(node) {
  if (node.regex) {
    return true;
  }

  const { parent } = node;

  return (
    Boolean(parent) &&
    (parent.type === 'ImportDeclaration' ||
      parent.type === 'ImportExpression' ||
      parent.type === 'ExportNamedDeclaration' ||
      parent.type === 'ExportAllDeclaration')
  );
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: { description: '禁止在视图组件中硬编码中文文案，请改用 $t()' },
    schema: [],
    messages: {
      hardcoded: "禁止硬编码中文文案「{{text}}」（{{where}}），请改用 $t('xxx') 并从 @/locales 引入 $t。"
    }
  },
  create(context) {
    const report = (node, where) => {
      const text = context.sourceCode.getText(node).slice(0, 24);
      context.report({ node, messageId: 'hardcoded', data: { text, where } });
    };

    const checkLiteral = (node, where) => {
      if (typeof node.value !== 'string' || !CJK_RE.test(node.value)) {
        return;
      }
      if (isSkippedLiteral(node) || isTranslationKey(node)) {
        return;
      }
      report(node, where);
    };

    const scriptVisitors = {
      Literal(node) {
        checkLiteral(node, 'script');
      },
      TemplateElement(node) {
        if (node.value.raw && CJK_RE.test(node.value.raw)) {
          report(node, 'template-literal');
        }
      }
    };

    const templateVisitors = {
      VText(node) {
        if (CJK_RE.test(node.value)) {
          report(node, 'element text');
        }
      },
      VLiteral(node) {
        if (CJK_RE.test(node.value)) {
          report(node, `attribute ${node.parent.key.name}`);
        }
      },
      // 模板指令表达式里的字符串，如 :title="x ? '新增分类' : '编辑分类'"
      'VExpressionContainer Literal': function vExpressionContainerLiteral(node) {
        checkLiteral(node, 'expression');
      }
    };

    const services = context.sourceCode.parserServices || {};

    // 非 .vue（或 parser 不是 vue-eslint-parser）时退化为只检查脚本
    if (!services.defineTemplateBodyVisitor) {
      return scriptVisitors;
    }

    return services.defineTemplateBodyVisitor(templateVisitors, scriptVisitors);
  }
};

export default {
  meta: { name: 'eslint-plugin-local' },
  rules: { 'no-hardcoded-cjk': rule }
};
