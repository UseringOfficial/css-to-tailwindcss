import { twMerge } from 'tailwind-merge';

/**
 * 将字符串中最后一个连字符的后一位字符替换为另一个字符。
 */
function replaceLastHyphenNextMeaningChar(text: string, replacer: (char: string) => string) {
  let index = text.lastIndexOf('-');

  if (index === -1) {
    return text;
  }

  while (text[index + 1] === '[') {
    index++;
  }

  return text.slice(0, index + 1) + replacer(text[index + 1]) + text.slice(index + 2);
}

export function isTailwindLikeClass(className: string) {
  const samePrefixClassname = replaceLastHyphenNextMeaningChar(className, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 1),
  );

  return twMerge(className, samePrefixClassname) === samePrefixClassname;
}
