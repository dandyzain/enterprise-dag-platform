import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium",
    "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-standard",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:shrink-0 [&_svg:not([class*='size-']):not([class*='h-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-accent-solid text-accent-solid-fg shadow-elev-1 hover:bg-accent-solid-hover",
        secondary:
          "border border-line bg-surface-2 text-fg shadow-elev-1 hover:border-line-strong hover:bg-surface-3",
        outline: "border border-line bg-transparent text-fg hover:border-line-strong hover:bg-surface-2",
        ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
        danger: "bg-[#e11d48] text-white shadow-elev-1 hover:bg-[#be123c]",
        "danger-ghost": "text-fg-muted hover:bg-failed/10 hover:text-failed",
        link: "h-auto px-0 text-accent underline-offset-4 hover:underline active:scale-100",
        /* Legacy aliases kept for not-yet-migrated call sites */
        destructive: "bg-[#e11d48] text-white shadow-elev-1 hover:bg-[#be123c]",
        violet: "border border-line bg-surface-2 text-fg hover:bg-surface-3",
      },
      size: {
        xs: "h-7 gap-1.5 rounded-md px-2 text-xs pointer-coarse:min-h-10 [&_svg:not([class*='size-']):not([class*='h-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-md px-3 text-[13px] pointer-coarse:min-h-10 [&_svg:not([class*='size-']):not([class*='h-'])]:size-3.5",
        default: "h-9 px-4",
        lg: "h-11 rounded-xl px-5 text-[15px]",
        icon: "size-9",
        "icon-sm": "size-8 rounded-md pointer-coarse:size-10",
        "icon-xs": "size-7 rounded-md pointer-coarse:size-10 [&_svg:not([class*='size-']):not([class*='h-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner, sets aria-busy and disables the button. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
