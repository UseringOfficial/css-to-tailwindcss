/* eslint-disable antfu/no-top-level-await */
import { TailwindConverter } from './src/TailwindConverter';

const simpleCSS = `
.foo,.bar {
  padding-top: 16px;
}

.text-\\[16px\\] {
  font-size: 16px;
}
.peer\\:text-\\[16px\\] {
  font-size: 16px;
}
`;

const converter = new TailwindConverter();
const converted = await converter.convertCSS(simpleCSS);

console.log(converted.convertedRoot.toString());

// console.log(parse('.peer\\:text-\\[16px\\]:hover'));
