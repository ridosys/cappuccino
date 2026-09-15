import { DocumentLogo } from "@/components/shared/document-logo";

/**
 * Branded header for document-style detail pages that are printed as-is
 * (sales / purchase returns). Hidden on screen — those pages already have
 * their own `PageHeader` — and shown only in print / PDF output, where the
 * brand mark belongs at the top of the sheet: the logo when one is set,
 * otherwise the system name as text.
 */
export function DocumentBrandHeader({
  logoUrl,
  name,
  title,
  reference,
  date,
}: {
  logoUrl: string | null;
  name: string;
  title: string;
  reference: string;
  date?: string;
}) {
  return (
    <div className="hidden items-start justify-between border-b pb-4 print:flex">
      <DocumentLogo
        logoUrl={logoUrl}
        name={name}
        nameClassName="text-xl font-bold"
      />
      <div className="text-end">
        <p className="text-lg font-bold">{title}</p>
        <p className="text-sm font-semibold" dir="ltr">
          {reference}
        </p>
        {date && <p className="text-xs text-muted-foreground">{date}</p>}
      </div>
    </div>
  );
}
