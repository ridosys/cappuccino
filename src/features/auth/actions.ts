"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
    if (
      result &&
      typeof result === "object" &&
      "error" in result &&
      result.error
    ) {
      const t = await getDictionary();
      return t.auth.invalidCredentials;
    }
  } catch (error) {
    if (error instanceof AuthError) {
      const t = await getDictionary();
      switch (error.type) {
        case "CredentialsSignin":
          return t.auth.invalidCredentials;
        default:
          return t.auth.genericError;
      }
    }
    throw error;
  }

  // Let the user pick where to go (Dashboard vs La Caisse).
  redirect("/choose");
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
