import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PrimaryCTAProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
  icon?: ReactNode;
}

export const PrimaryCTA = forwardRef<HTMLButtonElement, PrimaryCTAProps>(
  ({ fullWidth = true, icon, className, children, ...rest }, ref) => (
    <Button
      ref={ref}
      size="default"
      variant="default"
      className={cn(fullWidth && 'w-full', className)}
      {...rest}
    >
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </Button>
  ),
);
PrimaryCTA.displayName = 'PrimaryCTA';
