import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissions";
import {
  importProductsFromBuffer,
  type ImportEvent,
} from "@/features/products/import";

export const runtime = "nodejs";
export const maxDuration = 300;

function ndjson(event: ImportEvent) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: NextRequest) {
  const access = await requirePermission("PRODUCTS_MANAGE");
  if (!access.ok) {
    return new Response(ndjson({ type: "error", message: access.error }), {
      status: access.status,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return new Response(
      ndjson({ type: "error", message: "الرجاء اختيار ملف" }),
      {
        status: 400,
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      },
    );
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return new Response(
      ndjson({
        type: "error",
        message: "صيغة الملف غير مدعومة، الرجاء استخدام ملف .xlsx",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of importProductsFromBuffer(buffer, access.adminId)) {
          controller.enqueue(encoder.encode(ndjson(event)));
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "حدث خطأ غير متوقع أثناء الاستيراد";
        controller.enqueue(encoder.encode(ndjson({ type: "error", message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
