import * as React from "react";

import { cn } from "@/lib/utils";

const inputBaseClasses =
  "flex h-10 w-full border-[3px] border-border bg-secondary px-3 py-2 text-[12px] font-semibold tracking-wide text-foreground shadow-[4px_4px_0_var(--color-accent)] transition-colors file:border-0 file:bg-transparent file:text-[11px] file:font-semibold placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export interface InputProps extends React.ComponentProps<"input"> {
  variant?: "default" | "muted";
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "default", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          inputBaseClasses,
          variant === "muted" && "bg-muted shadow-[4px_4px_0_var(--color-border)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
