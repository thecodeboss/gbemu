import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonsRadioOption<T extends string | number> = {
  label: string;
  value: T;
};

type ButtonsRadioProps<T extends string | number> = {
  options: ButtonsRadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "default" | "sm";
};

export function ButtonsRadio<T extends string | number>({
  options,
  value,
  onChange,
  className,
  size = "default",
}: ButtonsRadioProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn("flex flex-wrap items-stretch gap-2", className)}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            variant={isSelected ? "default" : "outline"}
            size={size}
            className="flex-1 whitespace-nowrap px-3 py-2"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
