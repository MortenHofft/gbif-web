import { describe, expect, it } from 'vitest';
import { cmsImageSrcSet, cmsImageUrl } from './cmsImage';

const png = '//images.ctfassets.net/space/id/token/flower.png';

describe('cmsImageUrl', () => {
  it('resizes and converts Contentful images, resolving protocol-relative URLs', () => {
    expect(cmsImageUrl(png, { width: 800 })).toBe(
      'https://images.ctfassets.net/space/id/token/flower.png?w=800&fm=webp&q=80'
    );
  });

  it('crops to fill when a height is given and caps dimensions', () => {
    expect(cmsImageUrl(png, { width: 5000, height: 400.4 })).toBe(
      'https://images.ctfassets.net/space/id/token/flower.png?w=4000&h=400&fit=fill&fm=webp&q=80'
    );
  });

  it('leaves other hosts, SVG, GIF and empty values alone', () => {
    const thumbor = 'https://api.gbif.org/v1/image/abc=/500x400/http%3A%2F%2Fexample.org%2Fa.png';
    expect(cmsImageUrl(thumbor, { width: 100 })).toBe(thumbor);
    expect(cmsImageUrl('//images.ctfassets.net/s/i/t/logo.svg', { width: 100 })).toBe(
      '//images.ctfassets.net/s/i/t/logo.svg'
    );
    expect(cmsImageUrl('//images.ctfassets.net/s/i/t/anim.GIF', { width: 100 })).toBe(
      '//images.ctfassets.net/s/i/t/anim.GIF'
    );
    expect(cmsImageUrl(undefined, { width: 100 })).toBeUndefined();
  });
});

describe('cmsImageSrcSet', () => {
  it('lists one candidate per width with the same aspect ratio', () => {
    expect(cmsImageSrcSet(png, [500, 1000], 5 / 4)).toBe(
      'https://images.ctfassets.net/space/id/token/flower.png?w=500&h=400&fit=fill&fm=webp&q=80 500w, ' +
        'https://images.ctfassets.net/space/id/token/flower.png?w=1000&h=800&fit=fill&fm=webp&q=80 1000w'
    );
  });

  it('is undefined when the image cannot be transformed', () => {
    expect(cmsImageSrcSet('https://example.org/a.png', [500])).toBeUndefined();
  });
});
