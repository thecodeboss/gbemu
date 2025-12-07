import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide shrink-0 outline-none transition-transform duration-75 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:ring-4 focus-visible:ring-ring/60 hover:-translate-y-px hover:-translate-x-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-accent)] aria-invalid:border-destructive aria-invalid:shadow-[4px_4px_0_var(--color-destructive)]",
  {
    variants: {
      variant: {
        default:
          "border-[3px] border-foreground bg-primary text-primary-foreground shadow-[4px_4px_0_var(--color-accent)] hover:shadow-[5px_5px_0_var(--color-accent)]",
        destructive:
          "border-[3px] border-foreground bg-destructive text-primary-foreground shadow-[4px_4px_0_var(--color-accent)] hover:shadow-[5px_5px_0_var(--color-accent)]",
        outline:
          "border-[3px] border-border bg-secondary text-foreground shadow-[4px_4px_0_var(--color-accent)] hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border-[3px] border-foreground bg-accent text-accent-foreground shadow-[4px_4px_0_var(--color-accent)]",
        ghost:
          "border-[3px] border-transparent bg-transparent text-foreground shadow-none hover:border-border hover:bg-muted hover:shadow-[4px_4px_0_var(--color-accent)]",
        link: "border-0 bg-transparent text-primary underline underline-offset-4 shadow-none focus-visible:ring-0 hover:text-accent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";

const buttonSizes: Record<ButtonSize, string> = {
  default: "gap-2 min-h-10 px-4 py-2 has-[>svg]:px-3",
  sm: "gap-1.5 min-h-9 px-3 py-1.5 has-[>svg]:px-2.5",
  lg: "gap-2 min-h-12 px-6 py-3 has-[>svg]:px-5",
  icon: "gap-0 size-10",
  "icon-sm": "gap-0 size-9",
  "icon-lg": "gap-0 size-12",
};

const linkButtonSizes: Record<ButtonSize, string> = {
  default: "gap-2 min-h-0 px-0 py-0",
  sm: "gap-1.5 min-h-0 px-0 py-0",
  lg: "gap-2 min-h-0 px-0 py-0",
  icon: "gap-0 size-10 p-0",
  "icon-sm": "gap-0 size-9 p-0",
  "icon-lg": "gap-0 size-12 p-0",
};

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

type ButtonProps = Omit<React.ComponentProps<"button">, "ref" | "size"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
};

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const resolvedVariant = variant ?? "default";
  const resolvedSize = (size ?? "default") as ButtonSize;
  const sizeClass = (
    resolvedVariant === "link" ? linkButtonSizes : buttonSizes
  )[resolvedSize];

  return (
    <Comp
      data-slot="button"
      className={cn(
        buttonVariants({ variant: resolvedVariant }),
        sizeClass,
        className,
      )}
      {...props}
    />
  );
}
