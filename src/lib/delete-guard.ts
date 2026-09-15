import "server-only";
import { getDictionary } from "@/i18n/server";

export async function getDeletePasswordError(): Promise<string> {
  const t = await getDictionary();
  return t.common.deletePasswordError;
}

/** Gate for deleting invoices, customers, and payments — verified
 * server-side against DELETE_CONFIRM_PASSWORD so it can't be bypassed by
 * calling the server action directly. */
export function isDeletePasswordValid(password: string | undefined): boolean {
  const expected = process.env.DELETE_CONFIRM_PASSWORD;
  if (!expected) return false;
  return password === expected;
}
