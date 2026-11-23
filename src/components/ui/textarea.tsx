import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, "flex min-h-20 px-3 py-2 text-base leading-relaxed sm:text-sm", className)}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
