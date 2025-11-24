import * as React from "react";

import { cn } from "@/lib/utils";

const inputBaseClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

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
          variant === "muted" && "bg-muted/40",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
