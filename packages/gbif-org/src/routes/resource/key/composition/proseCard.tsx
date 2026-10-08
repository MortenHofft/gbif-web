import { ConditionalWrapper } from '@/components/conditionalWrapper';
import { ProseCardImgFragment } from '@/gql/graphql';
import { DynamicLink } from '@/reactRouterPlugins';
import { fragmentManager } from '@/services/fragmentManager';
import { cmsImageSrcSet, cmsImageUrl } from '@/utils/cmsImage';

fragmentManager.register(/* GraphQL */ `
  fragment ProseCardImg on AssetImage {
    file {
      url
    }
    title
    description
  }
`);

type Props = {
  title: string;
  url?: string;
  image?: ProseCardImgFragment | null;
  description?: string | React.ReactNode | null;
};

export function ProseCard({ title, description, url, image }: Props) {
  return (
    <div className="g-mx-auto g-max-w-[min(24rem,100%)] g-bg-white g-border g-border-solid g-border-gray-200 g-rounded-lg g-shadow hover:g-shadow-md g-transition-shadow dark:g-bg-gray-800 dark:g-border-gray-700 g-w-full">
      {image && (
        <ConditionalWrapper
          condition={typeof url === 'string'}
          wrapper={(children) => <DynamicLink to={url!}>{children}</DynamicLink>}
        >
          <img
            className="g-rounded-t-lg g-aspect-[5/4] g-w-full"
            src={cmsImageUrl(image.file.url, { width: 400, height: 320 })}
            srcSet={cmsImageSrcSet(image.file.url, [400, 800], 5 / 4)}
            sizes="(max-width: 384px) 100vw, 384px"
            title={image.title ?? ''}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </ConditionalWrapper>
      )}
      <div className="g-p-5">
        <ConditionalWrapper
          condition={typeof url === 'string'}
          wrapper={(children) => <DynamicLink to={url!}>{children}</DynamicLink>}
        >
          <h5
            dir="auto"
            className="g-mb-2 g-text-lg g-font-semibold g-tracking-tight g-text-gray-900 dark:g-text-white g-break-words"
            dangerouslySetInnerHTML={{ __html: title }}
          />
        </ConditionalWrapper>
        {description && (
          <div dir="auto" className="g-text-gray-700 dark:g-text-gray-300 g-break-words">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
