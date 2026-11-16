import { eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { products } from "@/lib/database/schema";
import { requireUser } from "@/lib/auth/session";
import { clientKey, handle, ok, rateLimit } from "@/lib/api/http";
import { validateBarcode } from "@/lib/scanner/barcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_DAYS = 90;

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  categories?: string;
  image_front_small_url?: string;
  quantity?: string;
};

export async function GET(request: Request) {
  return handle(async () => {
    await requireUser();
    rateLimit(clientKey(request, "product-lookup"), 40, 60 * 1000);
    const barcode = new URL(request.url).searchParams.get("barcode") ?? "";
    const validation = validateBarcode(barcode);
    if (!validation.valid) {
      return ok({ found: false, error: validation.reason, barcode: validation.normalized });
    }
    const database = await db();
    const cached = await database
      .select()
      .from(products)
      .where(eq(products.barcode, validation.normalized))
      .limit(1);
    if (cached[0] && Date.now() - new Date(cached[0].fetchedAt).getTime() < CACHE_DAYS * 86_400_000) {
      const p = cached[0];
      return ok({
        found: true,
        cached: true,
        product: {
          id: p.id,
          barcode: p.barcode,
          name: p.name,
          brand: p.brand,
          category: p.category,
          imageUrl: p.imageUrl,
          packageSize: p.packageSize,
          source: p.source,
          sourceAttribution: p.sourceAttribution,
        },
      });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${validation.normalized}.json?fields=code,product_name,product_name_en,brands,categories,image_front_small_url,quantity`,
        {
          signal: controller.signal,
          headers: {
            "User-Agent": "UseFirst/1.0 (self-hosted household food waste app; https://github.com/)",
            Accept: "application/json",
          },
          next: { revalidate: 0 },
        },
      ).finally(() => clearTimeout(timeout));

      if (response.status === 404) {
        return ok({ found: false, unavailable: false, barcode: validation.normalized });
      }
      if (!response.ok) {
        return ok({
          found: false,
          unavailable: true,
          barcode: validation.normalized,
          error: `Open Food Facts returned ${response.status}`,
        });
      }
      const payload = (await response.json()) as { status?: number; product?: OffProduct };
      const product = payload.product;
      const name = product?.product_name?.trim() || product?.product_name_en?.trim();
      if (payload.status !== 1 || !product || !name) {
        return ok({ found: false, unavailable: false, barcode: validation.normalized });
      }

      const id = crypto.randomUUID();
      const row = {
        id,
        barcode: validation.normalized,
        name,
        brand: product.brands?.split(",")[0]?.trim() || null,
        category: product.categories?.split(",")[0]?.trim() || null,
        imageUrl: product.image_front_small_url ?? null,
        packageSize: product.quantity ?? null,
        source: "openfoodfacts",
        sourceAttribution: "Product data from Open Food Facts (ODbL). https://openfoodfacts.org",
        fetchedAt: new Date(),
      };
      const upserted = await database
        .insert(products)
        .values(row)
        .onConflictDoUpdate({
          target: products.barcode,
          set: {
            name: row.name,
            brand: row.brand,
            category: row.category,
            imageUrl: row.imageUrl,
            packageSize: row.packageSize,
            fetchedAt: row.fetchedAt,
            sourceAttribution: row.sourceAttribution,
          },
        })
        .returning();

      return ok({
        found: true,
        cached: false,
        product: {
          id: upserted[0].id,
          barcode: upserted[0].barcode,
          name: upserted[0].name,
          brand: upserted[0].brand,
          category: upserted[0].category,
          imageUrl: upserted[0].imageUrl,
          packageSize: upserted[0].packageSize,
          source: upserted[0].source,
          sourceAttribution: upserted[0].sourceAttribution,
        },
      });
    } catch {
      return ok({
        found: false,
        unavailable: true,
        barcode: validation.normalized,
        error: "Open Food Facts could not be reached. Enter the product manually.",
      });
    }
  });
}
