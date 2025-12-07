import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border-[3px] border-border bg-secondary text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground shadow-[4px_4px_0_var(--color-accent)] transition-transform duration-75 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-4 focus-visible:ring-ring/60 hover:-translate-y-px hover:-translate-x-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-accent)] aria-invalid:border-destructive aria-invalid:shadow-[4px_4px_0_var(--color-destructive)]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-foreground shadow-[4px_4px_0_var(--color-accent)] hover:shadow-[5px_5px_0_var(--color-accent)]",
        destructive:
          "bg-destructive text-primary-foreground border-foreground shadow-[4px_4px_0_var(--color-accent)] hover:shadow-[5px_5px_0_var(--color-accent)]",
        outline:
          "bg-secondary text-foreground border-border shadow-[4px_4px_0_var(--color-accent)] hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-accent text-accent-foreground border-foreground shadow-[4px_4px_0_var(--color-accent)]",
        ghost:
          "bg-transparent text-foreground border-[3px] border-transparent shadow-none hover:border-border hover:bg-muted hover:shadow-[4px_4px_0_var(--color-accent)]",
        link: "border-0 bg-transparent p-0 text-primary underline underline-offset-4 shadow-none hover:text-accent focus-visible:ring-0",
      },
      size: {
        default: "min-h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "min-h-9 gap-1.5 px-3 py-1.5 has-[>svg]:px-2.5",
        lg: "min-h-12 px-6 py-3 has-[>svg]:px-5",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: Omit<React.ComponentProps<"button">, "ref"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
