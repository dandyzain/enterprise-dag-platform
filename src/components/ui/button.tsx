import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-600 text-zinc-950 font-semibold hover:bg-emerald-500 shadow-sm shadow-emerald-950/20 active:scale-[0.98]",
        secondary:
          "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 active:scale-[0.98]",
        outline:
          "border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200 hover:text-zinc-50 active:scale-[0.98]",
        ghost:
          "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850",
        destructive:
          "bg-rose-600/90 text-white hover:bg-rose-500 shadow-sm active:scale-[0.98]",
        violet:
          "bg-violet-600 text-white hover:bg-violet-500 shadow-sm shadow-violet-950/20 active:scale-[0.98]",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 rounded px-2 text-[11px]",
        lg: "h-9 rounded-md px-4 text-sm",
        icon: "h-8 w-8",
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
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
