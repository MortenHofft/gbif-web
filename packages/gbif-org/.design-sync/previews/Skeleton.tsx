import { Skeleton, SkeletonTable, SkeletonParagraph } from 'new-gbif-org-ts';

export const Basic = () => (
  <div className="g-flex g-items-center g-gap-3">
    <Skeleton className="g-h-12 g-w-12 g-rounded-full" />
    <div className="g-flex g-flex-col g-gap-2">
      <Skeleton className="g-h-4 g-w-48" />
      <Skeleton className="g-h-3 g-w-32" />
    </div>
  </div>
);

export const Table = () => (
  <div className="g-max-w-lg">
    <SkeletonTable rows={3} columns={4} />
  </div>
);

export const Paragraph = () => (
  <div className="g-max-w-md">
    <SkeletonParagraph lines={4} />
  </div>
);
