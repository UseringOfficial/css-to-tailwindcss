import { TailwindConverter } from './TailwindConverter';
import type { Position, Rule } from 'postcss';
import postcssSelectorParser from 'postcss-selector-parser';
import { guard, tryit } from 'radashi';
import { calculate as calculateSpecificity, compare as compareSpecificity } from 'specificity';
import { twMerge } from 'tailwind-merge';
import { FUNCTION_PSEUDO, removePseudoInSelector, splitSelector } from './utils/selectors';
import postcssNested from 'postcss-nested';
import { truthy } from './utils/ts-happy';

export interface ResolvedSelector {
  selector: string;
  noPseudoSelector: string;
  /** 在整个 Document 文档的第几个样式区块中 */
  tagIndex: number;
  /** 在样式区块中的位置 */
  position: Position;
  /** 选择器本身的优先级 */
  specificity: ReturnType<typeof calculateSpecificity>;
  tailwindClasses: string[];
}

function validateSelector(selector: string) {
  try {
    document.querySelector(selector);
    return true;
  } catch (e) {
    return false;
  }
}

function isElement(value: Node | EventTarget): value is Element {
  return 'nodeType' in value && value.nodeType === Node.ELEMENT_NODE;
}

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
function isHTMLElement(element: Element): element is HTMLElement {
  return element.namespaceURI === HTML_NAMESPACE;
}

/**
 * 比较两个选择器的生效优先级
 */
function compareSelector(a: ResolvedSelector, b: ResolvedSelector) {
  // 选择器本身的优先级
  const specificityCompareResult = compareSpecificity(a.specificity, b.specificity);
  if (specificityCompareResult !== 0) {
    return specificityCompareResult;
  }

  // 比较所处元素在文档中的位置
  if (a.tagIndex !== b.tagIndex) {
    // 后声明的样式优先生效
    return a.tagIndex - b.tagIndex || 0;
  }

  // 比较在元素中的声明位置
  if (a.position.line !== b.position.line) {
    return a.position.line - b.position.line || 0;
  }

  return a.position.column - b.position.column || 0;
}

const UNKNOWN_POSITION: Position = {
  column: Infinity,
  line: Infinity,
  offset: Infinity,
};

const EXCLUDE_SELECTORS = ['*', ':before', ':after', ':root', '::backdrop'];

export class DocumentSelectorConverter {
  private selectors: ResolvedSelector[] = [];

  pushResolvedSelectors(selectors: ResolvedSelector[]) {
    this.selectors = [...this.selectors, ...selectors].sort(compareSelector);
  }

  convertByElement(element: Element) {
    const effectiveSelectors = this.selectors.filter((selector) => {
      const [noPseudoSelectorError, noPseudoSelectorMatched] = tryit(() =>
        element.matches(selector.noPseudoSelector),
      )();

      if (!noPseudoSelectorError) {
        return noPseudoSelectorMatched;
      }

      const [selectorError, selectorMatched] = tryit(() => element.matches(selector.selector))();

      if (!selectorError) {
        return selectorMatched;
      }

      return false;
    });

    const classes = effectiveSelectors.map((selector) => selector.tailwindClasses);

    return twMerge(classes);
  }
}

export class DocumentTailwindConverter {
  private selectorConverter = new DocumentSelectorConverter();

  private remainedClasses: Set<string> = new Set();

  constructor(
    private doc: Document,
    private options: {
      baseFontSize: number;
    },
  ) {}

  private convertCSSRuleFilter(rule: Rule) {
    const root = postcssSelectorParser().astSync(rule.selector);
    const selectors = root.nodes.filter((node) => node.nodes.length);

    const isAllTag = selectors.every((selector) => {
      let hasFnPseudo = false;
      selector.walkPseudos((pseudo) => {
        if (FUNCTION_PSEUDO.includes(pseudo.value)) {
          hasFnPseudo = true;
          return false;
        }
      });

      if (hasFnPseudo) {
        selector.walkClasses((classNode) => {
          this.remainedClasses.add(classNode.value);
        });
        return false;
      }

      let notOnlyTag = false;
      selector.walk((node) => {
        if (
          postcssSelectorParser.isAttribute(node) ||
          postcssSelectorParser.isClassName(node) ||
          postcssSelectorParser.isIdentifier(node)
        ) {
          notOnlyTag = true;
          return false;
        }
      });

      return !notOnlyTag;
    });

    if (isAllTag) {
      return false;
    }

    const isExclude = selectors.some((selector) => {
      return EXCLUDE_SELECTORS.includes(selector.toString());
    });

    if (isExclude) {
      return false;
    }

    return true;
  }

  private async parseCSS(css: string, tagIndex: number, converter: TailwindConverter) {
    const { convertedRoot, nodes } = await converter.convertCSS(css, {
      filter: (rule) => this.convertCSSRuleFilter(rule),
    });

    return {
      selectors: nodes.flatMap((node) =>
        splitSelector(node.rule.selector)
          .filter(validateSelector)
          .map<ResolvedSelector | null>((selector) => {
            try {
              const position = guard(() => node.rule.positionBy({ word: selector })) ?? UNKNOWN_POSITION;
              const specificity = calculateSpecificity(selector);

              return {
                selector,
                noPseudoSelector: removePseudoInSelector(selector).trim(),
                tagIndex,
                position,
                specificity,
                tailwindClasses: node.tailwindClasses,
              };
            } catch (err) {
              console.warn('resolve selector error', err);
              return null;
            }
          })
          .filter(truthy),
      ),
      remained: convertedRoot.toString().trim(),
    };
  }

  async start() {
    const doc = this.doc;

    const tailwindConverter = new TailwindConverter({
      postCSSPlugins: [postcssNested],
      remInPx: this.options.baseFontSize,
    });

    // 添加 tailwind script
    const tailwindScript = doc.createElement('script');
    tailwindScript.src = 'https://cdn.tailwindcss.com';
    doc.head.appendChild(tailwindScript);

    // 解析 CSS 内容，去除原有的选择器，保留无法被转成 tailwindcss 的部分
    const stylesheetTags = doc.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]');

    for (let tagIndex = 0; tagIndex < stylesheetTags.length; tagIndex++) {
      const tag = stylesheetTags[tagIndex];

      if (tag.tagName === 'STYLE') {
        // 将 style 内容提取出来上传
        const css = tag.textContent || '';

        // skip empty style element
        if (css.trim() === '') {
          tag.remove();
          continue;
        }

        const { selectors, remained } = await this.parseCSS(css, tagIndex, tailwindConverter);
        this.selectorConverter.pushResolvedSelectors(selectors);

        if (remained) {
          tag.innerHTML = remained;
        } else {
          tag.remove();
        }
      } else {
        // 将 link 的样式内容提取出来上传
        const linkHref = tag.getAttribute('href');

        if (!linkHref) {
          tag.remove();
          continue;
        }

        try {
          const response = await fetch(linkHref);
          const css = await response.text();

          if (css.trim() === '') {
            tag.remove();
          }

          const { selectors, remained } = await this.parseCSS(css, tagIndex, tailwindConverter);
          this.selectorConverter.pushResolvedSelectors(selectors);

          if (remained) {
            const replaceStyleTag = doc.createElement('style');
            replaceStyleTag.innerHTML = remained;
            tag.after(replaceStyleTag);
          }
        } catch (err) {
          // ignore
        } finally {
          tag.remove();
        }
      }
    }

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, (node) => {
      return isHTMLElement(node as Element) || node.nodeName === 'svg'
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    });

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!isElement(node)) {
        continue;
      }

      const classes = this.selectorConverter.convertByElement(node);

      node.classList.forEach((value) => {
        if (!this.remainedClasses.has(value)) {
          node.classList.remove(value);
        }
      });

      // 兼容 HTMLElement 和 SVGElement
      const className = node.getAttribute('class');
      node.setAttribute('class', className + ' ' + classes);
    }
  }
}
