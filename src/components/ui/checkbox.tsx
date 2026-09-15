"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = Omit<
  React.ComponentProps<typeof CheckboxPrimitive.Root>,
  "checked" | "onCheckedChange" | "render"
> & {
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function Checkbox({
  className,
  checked,
  indeterminate = false,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked}
      indeterminate={indeterminate}
      onCheckedChange={(value) => onCheckedChange?.(value)}
      className={cn(
        "peer flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border border-input bg-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 hover:border-ring/60 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground dark:bg-input/30",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current data-unchecked:hidden">
        {indeterminate ? (
          <MinusIcon className="size-3.5" strokeWidth={3} />
        ) : (
          <CheckIcon className="size-3.5" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
