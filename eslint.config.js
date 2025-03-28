import { combine, javascript, typescript } from '@antfu/eslint-config';
import prettierRecommend from 'eslint-plugin-prettier/recommended';

export default combine(
  javascript(),
  typescript({
    overrides: {
      'ts/ban-ts-comment': 'off',
    },
  }),
  prettierRecommend,
);
