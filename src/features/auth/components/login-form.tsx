"use client";

import { useActionState } from "react";
import { authenticate } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/locale-provider";

export function LoginForm() {
  const t = useT();
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t.auth.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="admin@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t.auth.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      {errorMessage && (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
      <Button
        type="submit"
        className={`w-full ${isPending ? "animate-pulse cursor-not-allowed" : "cursor-pointer"}`}
        disabled={isPending}
      >
        {isPending ? t.auth.loggingIn : t.auth.loginButton}
      </Button>
    </form>
  );
}
