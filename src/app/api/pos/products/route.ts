import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/permissions";
import {
  getPosProducts,
  POS_PRODUCT_SORTS,
  type PosProductSort,
} from "@/features/pos/queries";

export async function GET(request: NextRequest) {
  const access = await requireApiPermission("POS_VIEW");
  if (!access.ok) return access.response;

  const params = request.nextUrl.searchParams;
  const categoryId = params.get("categoryId");
  const offset = Number(params.get("offset")) || 0;
  const sortParam = params.get("sort");
  const sort: PosProductSort = POS_PRODUCT_SORTS.includes(
    sortParam as PosProductSort,
  )
    ? (sortParam as PosProductSort)
    : "best";

  const feed = await getPosProducts({
    offset: offset > 0 ? offset : 0,
    categoryId: categoryId && categoryId !== "ALL" ? categoryId : null,
    q: params.get("q"),
    sort,
    inStockOnly: params.get("inStock") === "1",
    customerId: params.get("customerId"),
  });

  return NextResponse.json(feed);
}
