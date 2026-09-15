import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requirePageAccess } from "@/lib/permissions";
import { UnsavedChangesProvider } from "@/components/shared/unsaved-changes";

export default async function CaisseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth: proxy.ts already guards /caisse for authentication,
  // this re-checks close to render and enforces the POS permission (the
  // edge runtime can't do the DB permission read).
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/caisse");
  await requirePageAccess("POS_VIEW");

  // The POS workspace manages its own full-height, non-scrolling shell;
  // the invoice view/print routes under /caisse need a normal scrolling
  // page. So this layout only gates access and stays out of the way.
  return (
    <div className="min-h-dvh bg-muted/30">
      <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
    </div>
  );
}
