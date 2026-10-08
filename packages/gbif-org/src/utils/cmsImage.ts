// CMS assets are served by Contentful's Images API, which resizes and re-encodes by query string.
// Originals are often multi-MB PNGs; GBIF's Thumbor keeps the source format, so a 500x400 thumbnail
// of a PNG is still ~300 KB where WebP at q=80 is ~25 KB.
const CONTENTFUL_IMAGES = /^(https?:)?\/\/images\.ctfassets\.net\//;
// Contentful rejects dimensions above 4000.
const MAX_SIZE = 4000;

type Size = { width: number; height?: number };

function isTransformable(url: string) {
  // SVG cannot be transformed and GIF would lose its animation.
  return CONTENTFUL_IMAGES.test(url) && !/\.(svg|gif)$/i.test(url.split('?')[0]);
}

/** A resized WebP of a Contentful image, cropped to fill when a height is given. Other URLs pass through. */
export function cmsImageUrl<T extends string | null | undefined>(
  url: T,
  { width, height }: Size
): T {
  if (!url || !isTransformable(url)) return url;
  const result = new URL(url.startsWith('//') ? `https:${url}` : url);
  result.searchParams.set('w', String(Math.min(Math.round(width), MAX_SIZE)));
  if (height) {
    result.searchParams.set('h', String(Math.min(Math.round(height), MAX_SIZE)));
    result.searchParams.set('fit', 'fill');
  }
  result.searchParams.set('fm', 'webp');
  result.searchParams.set('q', '80');
  return result.toString() as T;
}

/** A `w`-descriptor srcset; `aspectRatio` (width / height) crops every candidate the same way. */
export function cmsImageSrcSet(
  url: string | null | undefined,
  widths: number[],
  aspectRatio?: number
): string | undefined {
  if (!url || !isTransformable(url)) return undefined;
  return widths
    .map((width) => {
      const height = aspectRatio ? width / aspectRatio : undefined;
      return `${cmsImageUrl(url, { width, height })} ${width}w`;
    })
    .join(', ');
}
