import type { TailwindConverterConfig } from '../src/TailwindConverter';
import { TailwindConverter } from '../src/TailwindConverter';
import { describe, expect, it } from 'vitest';
import nested from 'postcss-nested';

const simpleCSS = `
.foo {
  padding-top: 12px;
  padding-bottom: 12px;
  font-size: 12px;
  animation-delay: 200ms;
  border-right: 2px dashed;
  border: 4px solid transparent;

  &:hover {
    filter: blur(4px) brightness(0.5) sepia(100%) contrast(1) hue-rotate(30deg) invert(0) opacity(0.05) saturate(1.5);
    transform: translateX(12px) translateY(0.5em) translateZ(0.5rem) scaleY(0.725) rotate(124deg);
    font-size: 16px;
  }

  @media screen and (min-width: 768px) {
    font-weight: 600;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
`;

function createTailwindConverter(config?: Partial<TailwindConverterConfig>) {
  return new TailwindConverter({
    remInPx: 16,
    postCSSPlugins: [nested],
    tailwindConfig: {
      content: [],
      theme: {
        extend: {
          colors: {
            'custom-color': {
              100: '#123456',
              200: 'hsla(210, 100%, 51.0%, 0.016)',
              300: '#654321',
              400: 'some-invalid-color',
              gold: 'hsl(41, 28.3%, 79.8%)',
              marine: 'rgb(4, 55, 242, 0.75)',
            },
          },
          screens: {
            'custom-screen': { min: '768px', max: '1024px' },
          },
        },
        supports: {
          grid: 'display: grid',
          flex: 'display: flex',
        },
      },
    },
    ...(config || {}),
  });
}

describe('TailwindConverter', () => {
  it('should convert the simple CSS', async () => {
    const converter = createTailwindConverter();
    const converted = await converter.convertCSS(simpleCSS);

    expect(converted.nodes).toEqual([
      {
        rule: expect.objectContaining({ selector: '.foo' }),
        tailwindClasses: [
          'pt-3',
          'pb-3',
          'text-xs',
          '[animation-delay:200ms]',
          'border-4',
          'border-solid',
          'border-transparent',
          'hover:blur-sm',
          'hover:brightness-50',
          'hover:sepia',
          'hover:contrast-100',
          'hover:hue-rotate-30',
          'hover:invert-0',
          'hover:opacity-5',
          'hover:saturate-150',
          'hover:[transform:translateX(12px)_translateY(0.5em)_translateZ(0.5rem)_scaleY(0.725)_rotate(124deg)]',
          'hover:text-base',
          'md:font-semibold',
        ],
      },
    ]);
  });

  it('should consider `prefix`, `separator` configurations', async () => {
    const converter = createTailwindConverter({
      tailwindConfig: {
        content: [],
        prefix: 'tw-',
        separator: '_',
      },
    });
    const converted = await converter.convertCSS(simpleCSS);

    expect(converted.nodes).toEqual([
      {
        rule: expect.objectContaining({ selector: '.foo' }),
        tailwindClasses: [
          'tw-pt-3',
          'tw-pb-3',
          'tw-text-xs',
          '[animation-delay:200ms]',
          'tw-border-4',
          'tw-border-solid',
          'tw-border-transparent',
          'hover_tw-blur-sm',
          'hover_tw-brightness-50',
          'hover_tw-sepia',
          'hover_tw-contrast-100',
          'hover_tw-hue-rotate-30',
          'hover_tw-invert-0',
          'hover_tw-opacity-5',
          'hover_tw-saturate-150',
          'hover_[transform:translateX(12px)_translateY(0.5em)_translateZ(0.5rem)_scaleY(0.725)_rotate(124deg)]',
          'hover_tw-text-base',
          'md_tw-font-semibold',
        ],
      },
    ]);
  });

  it('should not prefix arbitrary properties', async () => {
    const converter = createTailwindConverter({
      tailwindConfig: {
        content: [],
        prefix: 'tw-',
      },
    });
    const converted = await converter.convertCSS(simpleCSS);

    expect(converted.nodes).toEqual([
      {
        rule: expect.objectContaining({ selector: '.foo' }),
        tailwindClasses: expect.arrayContaining([
          '[animation-delay:200ms]',
          'hover:[transform:translateX(12px)_translateY(0.5em)_translateZ(0.5rem)_scaleY(0.725)_rotate(124deg)]',
        ]),
      },
    ]);
  });

  it('should return an empty result when converting an empty string', async () => {
    const converter = createTailwindConverter();
    const converted = await converter.convertCSS('');

    expect(converted.convertedRoot.toString()).toEqual('');
    expect(converted.nodes).toEqual([]);
  });

  it('should convert the css part string', async () => {
    const converter = createTailwindConverter();
    const converted = await converter.convertCSS(
      '{ text-align: center; font-size: 12px; &:hover { font-size: 16px; } @media screen and (min-width: 768px) { font-weight: 600; } }',
    );
    expect(converted.nodes).toEqual([
      expect.objectContaining({
        rule: expect.objectContaining({ selector: '' }),
        tailwindClasses: ['text-center', 'text-xs', 'hover:text-base', 'md:font-semibold'],
      }),
    ]);
  });
});
