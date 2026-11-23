import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared field chrome for inputs, textareas and select triggers. */
export const fieldBase = cn(
  "w-full min-w-0 rounded-lg border border-line bg-surface text-fg shadow-elev-1",
  "placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150 ease-standard",
  "hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/20",
  "aria-[invalid=true]:border-failed aria-[invalid=true]:ring-failed/20",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        fieldBase,
        // 16px on small screens prevents iOS zoom-on-focus.
        "flex h-9 px-3 text-base sm:text-sm",
        "file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
