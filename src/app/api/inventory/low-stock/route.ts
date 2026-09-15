import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/permissions";
import { getLowStockProductsFeed } from "@/features/products/queries";

export async function GET(request: NextRequest) {
  const access = await requireApiPermission("INVENTORY_VIEW");
  if (!access.ok) return access.response;

  const offset = Number(request.nextUrl.searchParams.get("offset")) || 0;
  const feed = await getLowStockProductsFeed({ offset: offset > 0 ? offset : 0 });
  return NextResponse.json(feed);
}
