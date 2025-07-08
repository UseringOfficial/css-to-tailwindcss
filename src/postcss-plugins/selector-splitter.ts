import { AtRule, Plugin } from 'postcss';
import { splitSelector } from '../utils/selectors';

/**
 * 将包含多个 selector 的 rule 拆分为只包含一个 selector 的多个 rule
 */
export const postcssPluginSelectorSplitter: Plugin = {
  postcssPlugin: 'selector-splitter',
  Rule(rule, helper) {
    // Skip rules inside @keyframes
    if (rule.parent?.type === 'atrule' && (rule.parent as AtRule).name.endsWith('keyframes')) {
      return;
    }

    const selectors = splitSelector(rule.selector);

    if (selectors.length <= 1) {
      return;
    }

    const newRules = selectors.map((selector) => {
      const cloned = rule.clone({ selector });
      return cloned;
    });
    rule.replaceWith(newRules);
  },
};
