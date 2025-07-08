import antfu from '@antfu/eslint-config';
import prettierRecommend from 'eslint-plugin-prettier/recommended';

export default antfu(
  {
    type: 'lib',
    stylistic: false,
    markdown: false,
    typescript: {
      overrides: {
        'ts/ban-ts-comment': 'off',
      },
    },
  },
  {
    rules: {
      // https://perfectionist.dev/rules/sort-imports
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [
            ['builtin', 'external'],
            'internal',
            ['parent', 'sibling', 'index'],
            'side-effect',
            'object',
            'unknown',
          ],
          newlinesBetween: 1,
          order: 'asc',
          type: 'natural',
        },
      ],
    },
  },
  prettierRecommend,
);
