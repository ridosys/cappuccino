import "server-only";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";
import { normalizeArabicName } from "@/lib/arabic-name";
import { slugify, ensureUniqueSlug } from "@/lib/slug";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 20000;
const CLOUDINARY_FOLDER = "inventory-system/products";

const HEADER_ALIASES: Record<string, string[]> = {
  name: ["اسم المنتج", "الاسم", "name", "product name", "nom", "nom du produit"],
  sku: ["sku", "référence", "reference"],
  category: ["القسم", "الفئة", "category", "catégorie", "categorie"],
  brand: ["العلامة التجارية", "brand", "marque"],
  quantity: ["الكمية", "quantity", "qty", "quantité", "quantite"],
  minStockLevel: [
    "الحد الأدنى",
    "الحد الأدنى للمخزون",
    "min stock",
    "minstocklevel",
    "minimum stock",
    "stock minimum",
  ],
  status: ["الحالة", "status", "statut"],
  images: ["الصور", "الصورة", "images", "image", "image urls", "image url", "روابط الصور", "رابط الصورة", "urls des images", "url de l'image"],
  slug: ["الرابط", "slug", "lien"],
  barcode: ["الباركود", "barcode", "code-barres", "code barre"],
  description: ["الوصف", "description"],
  price1: ["السعر الأول", "price1", "price 1", "price", "السعر", "premier prix", "prix 1"],
  price2: ["السعر الثاني", "price2", "price 2", "deuxième prix", "deuxieme prix", "prix 2"],
  price3: ["السعر الثالث", "price3", "price 3", "troisième prix", "troisieme prix", "prix 3"],
  purchasePrice: ["سعر الشراء", "سعر الشراء (التكلفة)", "purchase price", "purchase price (cost)", "cost", "prix d'achat", "prix d'achat (coût)", "prix d'achat (cout)"],
  weight: ["الوزن", "الوزن (kg)", "weight", "weight (kg)", "poids", "poids (kg)"],
};

export type ImportRowError = { row: number; name?: string; reason: string };

export type ImportEvent =
  | {
      type: "progress";
      processed: number;
      imported: number;
      total: number;
      currentName: string;
    }
  | {
      type: "done";
      total: number;
      imported: number;
      failed: number;
      skipped: number;
      validationErrors: number;
      failedImages: number;
      errors: ImportRowError[];
    }
  | { type: "error"; message: string };

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function buildColumnMap(headerRow: ExcelJS.Row): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const raw = String(cell.value ?? "").trim();
    if (!raw) return;
    const normalized = normalizeHeader(raw);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map.has(field)) continue;
      if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
        map.set(field, colNumber);
      }
    }
  });
  return map;
}

function cellText(row: ExcelJS.Row, col: number | undefined): string {
  if (!col) return "";
  const value = row.getCell(col).value;
  if (value == null) return "";
  if (typeof value === "object") {
    if ("richText" in value) {
      return (value.richText as { text: string }[])
        .map((part) => part.text)
        .join("")
        .trim();
    }
    if ("result" in value) {
      return String(value.result ?? "").trim();
    }
    if ("text" in value) {
      return String(value.text ?? "").trim();
    }
  }
  return String(value).trim();
}

function cellNumber(row: ExcelJS.Row, col: number | undefined): number | null {
  const text = cellText(row, col);
  if (!text) return null;
  const num = Number(text.replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

function parseImageUrls(text: string): string[] {
  return text
    .split(/[\n,;|]+/)
    .map((part) => part.trim())
    .filter((part) => /^https?:\/\//i.test(part));
}

function parseStatus(text: string): "ACTIVE" | "INACTIVE" {
  const normalized = text.trim().toLowerCase();
  if (
    normalized === "غير نشط" ||
    normalized === "inactive" ||
    normalized === "inactif" ||
    normalized === "inactive product"
  ) return "INACTIVE";
  return "ACTIVE";
}

async function downloadImage(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error(`الرابط لا يشير إلى صورة (${contentType || "غير معروف"})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("حجم الصورة كبير جداً");
    }
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

function uploadBufferToCloudinary(
  buffer: Buffer,
): Promise<{ publicId: string; secureUrl: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: CLOUDINARY_FOLDER },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("فشل رفع الصورة إلى Cloudinary"));
          return;
        }
        resolve({ publicId: result.public_id, secureUrl: result.secure_url });
      },
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}

export async function* importProductsFromBuffer(
  fileBuffer: Buffer,
  adminId?: string,
): AsyncGenerator<ImportEvent> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's bundled types predate TS 5.7's generic Buffer<TArrayBuffer>,
    // so a plain Buffer.from(...) result doesn't structurally match its param.
    await workbook.xlsx.load(
      fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    yield {
      type: "error",
      message: "تعذّرت قراءة الملف. تأكد من أنه بصيغة Excel صحيحة (.xlsx)",
    };
    return;
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    yield { type: "error", message: "لم يتم العثور على أي ورقة بيانات في الملف" };
    return;
  }

  const columnMap = buildColumnMap(worksheet.getRow(1));
  if (!columnMap.has("name")) {
    yield {
      type: "error",
      message: "لم يتم العثور على عمود اسم المنتج في الملف",
    };
    return;
  }

  const dataRows: { rowNumber: number; row: ExcelJS.Row }[] = [];
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const name = cellText(row, columnMap.get("name"));
    if (!name) continue;
    dataRows.push({ rowNumber: r, row });
  }

  const total = dataRows.length;
  if (total === 0) {
    yield { type: "error", message: "لم يتم العثور على أي منتجات في الملف" };
    return;
  }

  const [categories, brands, existingProducts] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.brand.findMany({ select: { id: true, name: true } }),
    prisma.product.findMany({ select: { sku: true, slug: true } }),
  ]);

  const categoryIdByName = new Map(
    categories.map((c) => [normalizeArabicName(c.name), c.id]),
  );
  const brandIdByName = new Map(
    brands.map((b) => [normalizeArabicName(b.name), b.id]),
  );
  const takenSkus = new Set(existingProducts.map((p) => p.sku));
  const takenSlugs = new Set(existingProducts.map((p) => p.slug));
  const takenCategorySlugs = new Set(categories.map((c) => c.slug));

  let imported = 0;
  let failed = 0;
  let skipped = 0;
  let validationErrors = 0;
  let failedImages = 0;
  const errors: ImportRowError[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const { rowNumber, row } = dataRows[i];
    const name = cellText(row, columnMap.get("name"));

    yield { type: "progress", processed: i, imported, total, currentName: name };

    await (async () => {
      const sku = cellText(row, columnMap.get("sku"));
      if (!sku) {
        validationErrors++;
        errors.push({ row: rowNumber, name, reason: "SKU مفقود" });
        return;
      }
      if (takenSkus.has(sku)) {
        skipped++;
        errors.push({
          row: rowNumber,
          name,
          reason: `SKU "${sku}" مستخدم بالفعل`,
        });
        return;
      }

      const categoryName = cellText(row, columnMap.get("category"));
      if (!categoryName) {
        validationErrors++;
        errors.push({ row: rowNumber, name, reason: "القسم مفقود" });
        return;
      }
      const normalizedCategoryName = normalizeArabicName(categoryName);
      let categoryId = categoryIdByName.get(normalizedCategoryName);
      if (!categoryId) {
        try {
          const categorySlug = ensureUniqueSlug(
            slugify(categoryName) || "category",
            takenCategorySlugs,
          );
          const createdCategory = await prisma.category.create({
            data: { name: categoryName, slug: categorySlug },
            select: { id: true },
          });
          categoryId = createdCategory.id;
          categoryIdByName.set(normalizedCategoryName, categoryId);
        } catch {
          validationErrors++;
          errors.push({
            row: rowNumber,
            name,
            reason: `تعذّر إنشاء القسم "${categoryName}"`,
          });
          return;
        }
      }

      const brandName = cellText(row, columnMap.get("brand"));
      let brandId: string | null = null;
      if (brandName) {
        const foundBrandId = brandIdByName.get(normalizeArabicName(brandName));
        if (!foundBrandId) {
          validationErrors++;
          errors.push({
            row: rowNumber,
            name,
            reason: `العلامة التجارية "${brandName}" غير موجودة`,
          });
          return;
        }
        brandId = foundBrandId;
      }

      // Not Math.trunc — quantity/minStockLevel carry up to 3 decimal
      // places now (e.g. an imported "1.5" kg), and truncating here would
      // silently import it as a whole number.
      const quantity = Math.max(0, cellNumber(row, columnMap.get("quantity")) ?? 0);
      const minStockLevel = Math.max(
        0,
        cellNumber(row, columnMap.get("minStockLevel")) ?? 0,
      );
      const price1 = Math.max(0, cellNumber(row, columnMap.get("price1")) ?? 0);
      const price2 = Math.max(0, cellNumber(row, columnMap.get("price2")) ?? 0);
      const price3 = Math.max(0, cellNumber(row, columnMap.get("price3")) ?? 0);
      const purchasePrice = Math.max(
        0,
        cellNumber(row, columnMap.get("purchasePrice")) ?? 0,
      );
      const weight = Math.max(
        0,
        cellNumber(row, columnMap.get("weight")) ?? 0,
      );
      const status = parseStatus(cellText(row, columnMap.get("status")));
      const barcode = cellText(row, columnMap.get("barcode")) || null;
      const description = cellText(row, columnMap.get("description")) || null;

      const explicitSlug = cellText(row, columnMap.get("slug"));
      const slugBase =
        slugify(explicitSlug || name) || slugify(sku) || "product";
      const slug = ensureUniqueSlug(slugBase, takenSlugs);

      const imageUrls = parseImageUrls(cellText(row, columnMap.get("images")));
      const uploadResults = await Promise.allSettled(
        imageUrls.map(async (url) => {
          const buffer = await downloadImage(url);
          return uploadBufferToCloudinary(buffer);
        }),
      );

      const images: { publicId: string; secureUrl: string; position: number }[] =
        [];
      uploadResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          images.push({ ...result.value, position: images.length });
        } else {
          failedImages++;
          console.error(
            `[product-import] فشل رفع الصورة للمنتج "${name}" (سطر ${rowNumber}): ${imageUrls[index]}`,
            result.reason,
          );
        }
      });

      try {
        await prisma.product.create({
          data: {
            name,
            slug,
            sku,
            barcode,
            description,
            categoryId,
            brandId,
            quantity,
            minStockLevel,
            price1,
            price2,
            price3,
            purchasePrice,
            weight,
            status,
            createdById: adminId,
            images: { create: images },
            // Same anchor createProduct writes for a manually-added
            // product — an imported row is a creation, not an edit, so
            // without this, any historical date between the import and the
            // product's first later price edit would have nothing to look
            // up and would fall back to today's current price.
            priceHistory: {
              create: {
                purchasePrice,
                reason: "السعر الأولي عند استيراد المنتج",
                createdById: adminId,
              },
            },
          },
        });
        takenSkus.add(sku);
        imported++;
      } catch (error) {
        failed++;
        errors.push({
          row: rowNumber,
          name,
          reason:
            error instanceof Error
              ? error.message
              : "خطأ غير متوقع أثناء الحفظ",
        });
      }
    })();

    yield {
      type: "progress",
      processed: i + 1,
      imported,
      total,
      currentName: name,
    };
  }

  yield {
    type: "done",
    total,
    imported,
    failed,
    skipped,
    validationErrors,
    failedImages,
    errors,
  };
}
