import postcssSelectorParser, { Pseudo } from 'postcss-selector-parser';

export function splitSelector(selector: string) {
  const root = postcssSelectorParser().astSync(selector);
  const selectors = root.nodes.filter((node) => node.nodes.length).map((node) => node.toString().trim());
  return selectors;
}

export const FUNCTION_PSEUDO = [':is', ':not', ':where', ':has'];

function isInPseudoParent(pseudo: Pseudo) {
  let current = pseudo.parent;
  while (current) {
    if (postcssSelectorParser.isPseudo(current)) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

export function removePseudoInSelector(
  selector: string,
  {
    excludePseudo = FUNCTION_PSEUDO,
    deep = false,
  }: {
    excludePseudo?: string[];
    deep?: boolean;
  } = {},
) {
  const removePseudoProcessor = postcssSelectorParser((selectors) => {
    selectors.walkPseudos((pseudo) => {
      if (excludePseudo.includes(pseudo.value)) {
        return;
      }

      if (!deep && isInPseudoParent(pseudo)) {
        return;
      }

      pseudo.remove();
    });
  });
  return removePseudoProcessor.processSync(selector);
}
