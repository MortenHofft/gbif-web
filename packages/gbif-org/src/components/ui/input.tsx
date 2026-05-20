import * as React from 'react';

import { cn } from '@/utils/shadcn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Mobile: h-11 (44px tap target) and text-base (16px, prevents iOS focus-zoom).
          // sm+ (≥640px): keep the original h-9 / text-sm density.
          'g-flex g-h-11 g-w-full g-rounded-md g-border g-border-solid g-border-input g-bg-transparent g-px-3 g-py-1 g-text-base g-shadow-sm sm:g-h-9 sm:g-text-sm',
          'g-transition-colors file:g-border-0 file:g-bg-transparent file:g-text-sm file:g-font-medium placeholder:g-text-muted-foreground',
          'focus-visible:g-outline-none focus-visible:g-ring-1 focus-visible:g-ring-ring disabled:g-cursor-not-allowed disabled:g-opacity-50',
          'focus:g-ring-2 focus:g-ring-primary-500 focus:g-border-primary-500', //colored focus ring
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
