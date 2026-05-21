import { SimpleTooltip } from '@/components/simpleTooltip';
import { cn } from '@/utils/shadcn';
import { MdInfoOutline } from 'react-icons/md';
import { FormattedMessage, useIntl } from 'react-intl';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export function AboutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { formatMessage } = useIntl();
  const aboutLabel = formatMessage({ id: 'filterSupport.aboutThisFilter' });
  return (
    <Popover>
      <PopoverTrigger
        aria-label={aboutLabel}
        className="g-inline-flex g-items-center g-justify-center g-min-w-11 g-min-h-11 g-rounded hover:g-bg-slate-100"
      >
        <SimpleTooltip
          delayDuration={300}
          title={<FormattedMessage id="filterSupport.aboutThisFilter" />}
          side="top"
          asChild
        >
          <span>
            <MdInfoOutline className={cn('', className)} />
          </span>
        </SimpleTooltip>
      </PopoverTrigger>
      <PopoverContent className="g-w-96">{children}</PopoverContent>
    </Popover>
  );
}
