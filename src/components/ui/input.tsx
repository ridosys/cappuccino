"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { useLocale } from "@/i18n/locale-provider"

const inputClassName =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:hover:border-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 disabled:hover:border-input aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:hover:border-destructive md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

/** Every type="password" field gets a show/hide eye toggle. */
function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const { t } = useLocale()
  const [visible, setVisible] = React.useState(false)
  const label = visible ? t.common.hidePassword : t.common.showPassword

  return (
    <div className="relative w-full">
      <InputPrimitive
        type={visible ? "text" : "password"}
        data-slot="input"
        disabled={disabled}
        className={cn(inputClassName, className, "pe-10")}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        tabIndex={-1}
        className="absolute inset-y-0 end-0 flex w-10 cursor-pointer items-center justify-center rounded-e-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  if (type === "password") {
    return <PasswordInput className={className} {...props} />
  }
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputClassName, className)}
      {...props}
    />
  )
}

export { Input }
